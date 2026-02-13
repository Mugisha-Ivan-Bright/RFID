const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const dotenv = require('dotenv');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const bcrypt = require('bcryptjs');
const path = require('path');
const mqtt = require('mqtt');

// Models
const Card = require('./models/Card');
const Transaction = require('./models/Transaction');
const User = require('./models/User');

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rfid_db';
const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://broker.benax.rw';
const TEAM_ID = 'ivan_bright';

// MQTT Client
const mqttClient = mqtt.connect(MQTT_BROKER);

mqttClient.on('connect', () => {
    console.log(`✅ Connected to MQTT Broker: ${MQTT_BROKER} (Team: ${TEAM_ID})`);
    const topics = [
        `rfid/${TEAM_ID}/card/status`,
        `rfid/${TEAM_ID}/card/balance`,
        `rfid/${TEAM_ID}/device/health`,
        // `rfid/#` // Global capture REMOVED to avoid noise
    ];
    mqttClient.subscribe(topics, () => {
        console.log(`📡 Sniffer Active: Subscribed to ${topics.length} channels`);
    });
});

mqttClient.on('message', async (topic, message) => {
    const payloadStr = message.toString();
    console.log(`\n📥 [MQTT IN] ${topic} | Data: ${payloadStr}`);

    try {
        // Try to parse as JSON, skip if it's plain text (like "online"/"offline")
        let payload;
        try {
            payload = JSON.parse(payloadStr);
        } catch (parseErr) {
            // Not JSON, probably a status string - ignore it silently
            return;
        }

        // Handle Card SCANS (from anywhere)
        if (topic.includes('/card/status')) {
            const { uid, balance, status } = payload;
            if (!uid) return;

            // Handle card removal
            if (status === 'removed') {
                console.log(`📢 [BROADCAST] Card removed: ${uid}`);
                broadcast({
                    type: 'card_status',
                    data: {
                        uid: uid,
                        present: false,
                        status: 'removed'
                    }
                });
                return;
            }

            // Handle card detection
            // Register card in DB if new (for transaction tracking only)
            let card = await Card.findOne({ uid });
            if (!card) {
                card = new Card({ uid, balance: 0 }); // Initialize with 0
                await card.save();
                console.log(`✨ [DB] NEW Card registered: ${uid}`);
            }

            // CRITICAL: Broadcast LIVE hardware data, NOT database data
            console.log(`📢 [BROADCAST] Revealing card: ${uid} (LIVE from hardware)`);
            broadcast({
                type: 'card_status',
                data: {
                    uid: uid, // From hardware
                    present: true,
                    owner: card.owner || 'Guest User', // Owner from DB (user-assigned)
                    balance: balance || card.balance || 0, // LIVE balance from hardware, fallback to DB
                    topic: topic // Diagnostic
                }
            });
        }
        // Handle Balance Updates (Top-ups)
        else if (topic.includes('/card/balance')) {
            const { uid, new_balance, amount } = payload;
            if (!uid) return;

            const card = await Card.findOneAndUpdate(
                { uid },
                { balance: new_balance, lastUpdated: Date.now() },
                { new: true }
            );

            if (card) {
                // PERSIST TRANSACTION TO DB
                try {
                    const tx = new Transaction({
                        uid,
                        owner: card.owner,
                        amount: amount || 0,
                        newBalance: new_balance,
                        type: (amount || 0) >= 0 ? 'topup' : 'purchase',
                        timestamp: Date.now()
                    });
                    await tx.save();
                    console.log(`💾 [DB] Transaction saved for ${uid} (Owner: ${card.owner})`);
                } catch (txErr) {
                    console.error('❌ [DB] Transaction save failed:', txErr.message);
                }

                console.log(`📢 [BROADCAST] Balance updated for: ${uid}`);
                broadcast({
                    type: 'balance_update',
                    data: {
                        uid: card.uid,
                        balance: card.balance,
                        owner: card.owner, // Include owner in balance update
                        amount: amount || 0,
                        ts: Date.now()
                    }
                });
            }
        }
    } catch (err) {
        console.error('❌ [MQTT ERROR] Processing failed:', err.message);
    }
});

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'dilocash_secret_key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: MONGODB_URI,
        collectionName: 'sessions',
        ttl: 14 * 24 * 60 * 60 // 14 days
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24,
        secure: false, // Set to true if using HTTPS
        httpOnly: true,
        sameSite: 'lax'
    }
}));

app.use(cors({
    origin: true,
    credentials: true
}));

app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    // Automatically strip /frontend/ prefix if present
    if (req.url.startsWith('/frontend/')) {
        console.log(`[REWRITE] stripping /frontend from ${req.url}`);
        req.url = req.url.replace('/frontend/', '/');
    }

    console.log(`[HTTP] ${req.method} ${req.url} - ${new Date().toISOString()}`);
    if (req.headers.cookie) {
        console.log('   -> Cookies detected');
    }
    next();
});

// --- AUTH ENDPOINTS ---

app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ error: 'User already exists' });

        const user = new User({ username, email, password });
        await user.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/login', async (req, res) => {
    console.log('[DEBUG] Login route hit');
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        req.session.userId = user._id;
        console.log(`[AUTH] Attempting to save session for ${user.username}...`);

        req.session.save((err) => {
            if (err) {
                console.error('[AUTH] Session save error:', err);
                return res.status(500).json({ error: 'Session save failed' });
            }
            console.log(`[AUTH] Session saved successfully for: ${user.username}`);
            res.json({ message: 'Login successful', username: user.username });
        });
    } catch (err) {
        console.error('[AUTH] Login internal error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ error: 'Could not log out' });
        res.clearCookie('connect.sid');
        res.json({ message: 'Logged out' });
    });
});

app.get('/me', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    try {
        const user = await User.findById(req.session.userId).select('-password');
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- AUTH MIDDLEWARE ---
function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    next();
}

// --- RFID ENDPOINTS (Protected) ---

app.post('/scan', requireAuth, async (req, res) => {
    const { uid } = req.body;
    if (!uid) return res.status(400).json({ error: 'UID is required' });

    // Validate and sanitize UID
    const sanitizedUID = uid.toString().replace(/[^\x20-\x7E]/g, '').trim();
    if (!sanitizedUID || sanitizedUID.length < 4) {
        return res.status(400).json({ error: 'Invalid UID format' });
    }

    try {
        let card = await Card.findOne({ uid: sanitizedUID });
        if (!card) {
            card = new Card({ uid: sanitizedUID, balance: 0 });
            await card.save();
        }

        broadcast({
            type: 'card_status',
            data: {
                uid: card.uid,
                present: true,
                owner: card.owner,
                balance: card.balance
            }
        });

        res.json({ message: 'Card scanned', card });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/topup', requireAuth, async (req, res) => {
    const { uid, amount, newOwner } = req.body;
    if (!uid || amount === undefined) return res.status(400).json({ error: 'UID and amount are required' });

    try {
        let card = await Card.findOne({ uid });
        if (!card) return res.status(404).json({ error: 'Card not found' });

        // Update owner if provided
        if (newOwner) {
            card.owner = newOwner;
        }

        // SET MODE: Treat 'amount' as the TARGET balance (overwrite, not add)
        const oldBalance = card.balance || 0;
        const newBalance = amount; // User sets exact balance
        const delta = newBalance - oldBalance; // Calculate change for logs

        // Update balance in database immediately
        card.balance = newBalance;
        card.lastUpdated = Date.now();
        await card.save();

        console.log(`💾 [DB] Card updated: ${uid} | Owner: ${card.owner} | Balance: ${newBalance}`);

        // Publish to MQTT to sync with hardware
        const topupTopic = `rfid/${TEAM_ID}/card/topup`;
        const payload = {
            uid,
            amount: delta, // Send delta for hardware calculation if needed
            new_balance: newBalance // Send exact target balance
        };

        mqttClient.publish(topupTopic, JSON.stringify(payload), (err) => {
            if (err) {
                console.error('[MQTT] Publish error:', err);
                return res.status(500).json({ error: 'Failed to send top-up command' });
            }
            console.log(`🛰️ [MQTT OUT] Balance SET to ${newBalance} for ${uid} (Delta: ${delta > 0 ? '+' : ''}${delta})`);
            res.json({ message: 'Balance updated', uid, new_balance: newBalance, owner: card.owner });
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/card/:uid', requireAuth, async (req, res) => {
    try {
        const card = await Card.findOne({ uid: req.params.uid });
        if (!card) return res.status(404).json({ error: 'Card not found' });
        res.json(card);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/cards', requireAuth, async (req, res) => {
    try {
        const cards = await Card.find().sort({ lastUpdated: -1 });
        res.json(cards);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/transactions', requireAuth, async (req, res) => {
    try {
        const transactions = await Transaction.find().sort({ timestamp: -1 }).limit(50);
        res.json(transactions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/stats', requireAuth, async (req, res) => {
    try {
        const activeCards = await Card.countDocuments();
        const totalBalanceResult = await Card.aggregate([
            { $group: { _id: null, total: { $sum: "$balance" } } }
        ]);
        const totalBalance = totalBalanceResult.length > 0 ? totalBalanceResult[0].total : 0;

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const todaysTopupsResult = await Transaction.aggregate([
            { $match: { timestamp: { $gte: startOfToday }, type: 'topup' } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);
        const todaysTopups = todaysTopupsResult.length > 0 ? todaysTopupsResult[0].total : 0;

        res.json({
            active_cards: activeCards,
            total_balance: totalBalance,
            todays_topups: todaysTopups
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- STATIC FILES & REDIRECTS ---

// Serve static files AFTER API routes
app.use(express.static(path.join(__dirname, '../frontend')));

// Root route redirects to auth.html
app.get('/', (req, res) => {
    res.redirect('/auth.html');
});

// Catch-all 404 for API routes
app.use('/api', (req, res) => {
    console.warn(`[WARN] 404 on API route: ${req.method} ${req.url}`);
    res.status(404).json({ error: 'API route not found' });
});

// Final catch-all for any other request
app.use((req, res) => {
    console.warn(`[WARN] Unhandled request: ${req.method} ${req.url}`);
    res.status(404).send('Not Found');
});

const PORT = process.env.PORT || 8080;

// MongoDB Connection
// Basic error handling for MongoDB to avoid crashing on transient SSL alerts
mongoose.connection.on('error', err => {
    console.error('❌ MongoDB Connection Error:', err.message);
});

mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ MongoDB Disconnected. Attempting to reconnect...');
});

// Global Error Catching
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

async function startServer() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB Atlas');

        const serverNode = server.listen(PORT, () => {
            console.log(`🚀 Server ready at http://localhost:${PORT}`);
            console.log(`📡 Database URI is set and ready.`);
        });
    } catch (err) {
        console.error('❌ Failed to start server:', err.message);
        // Still start the server so the dashboard can at least load
        const serverNode = server.listen(PORT, () => {
            console.log(`🚀 Server starting without Database (Limited functionality)`);
        });
    }
}

startServer();

// WebSocket handling
wss.on('connection', (ws) => {
    console.log('🔌 [WS] New Client Connected');

    ws.on('message', (msg) => console.log(`[WS] Received: ${msg}`));
    ws.on('close', () => console.log('🔌 [WS] Client Disconnected'));

    // Send immediate welcome
    ws.send(JSON.stringify({ type: 'system', data: { message: 'Connection Established' } }));
});

// Broadcast helper
const broadcast = (data) => {
    const message = JSON.stringify(data);
    const clients = Array.from(wss.clients).filter(c => c.readyState === WebSocket.OPEN);
    console.log(`📤 [WS BROADCAST] Type: ${data.type} | To: ${clients.length} clients`);
    clients.forEach((client) => {
        client.send(message);
    });
};
