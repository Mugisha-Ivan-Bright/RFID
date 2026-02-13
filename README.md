# Dilocash RFID Card Top-Up System

A complete RFID card management system with real-time balance tracking, top-up functionality, and admin dashboard.

## Features

- 💳 Real-time RFID card scanning and detection
- 💰 Card balance management and top-up
- 📊 Analytics dashboard with transaction history
- 🔐 Secure authentication system
- 🌐 Real-time updates via WebSocket
- 📡 MQTT communication with hardware devices
- 🎨 Modern, responsive UI with dark theme

## Tech Stack

### Frontend
- HTML5, CSS3, JavaScript
- TailwindCSS for styling
- WebSocket for real-time updates

### Backend
- Node.js with Express
- MongoDB for data persistence
- MQTT for device communication
- Session-based authentication

### Hardware
- ESP8266 / Python MQTT Bridge
- MFRC522 RFID Reader
- MicroPython firmware

## Project Structure

```
├── frontend/           # Web dashboard
│   ├── auth.html      # Login/Signup page
│   ├── dashboard.html # Main dashboard
│   └── styles.css     # Styles
├── backend/           # API server
│   ├── server.js      # Express server
│   ├── models/        # MongoDB models
│   └── .env           # Environment variables
├── device_code/       # ESP8266 code
│   └── main.py        # MicroPython RFID reader
└── python/            # Python bridge
    └── mqtt_bridge.py # MQTT bridge for hardware
```

## Setup Instructions

### 1. Backend Setup

```bash
cd backend
npm install
```

Create `.env` file:
```
MONGODB_URI=your_mongodb_connection_string
SESSION_SECRET=your_secret_key
MQTT_BROKER=broker.benax.rw
PORT=8080
```

Start the server:
```bash
node server.js
```

### 2. Frontend Setup

Open `frontend/index.html` or `frontend/auth.html` in a browser, or serve via the backend.

### 3. Hardware Setup

**For ESP8266:**
1. Flash MicroPython firmware
2. Upload `device_code/main.py` and `device_code/mfrc522.py`
3. Configure WiFi credentials in `main.py`
4. Connect MFRC522 RFID reader

**For Python Bridge:**
```bash
cd python
pip install paho-mqtt pyserial requests
python mqtt_bridge.py
```

## MQTT Topics

- `rfid/{TEAM_ID}/card/status` - Card detection events
- `rfid/{TEAM_ID}/card/balance` - Balance updates
- `rfid/{TEAM_ID}/card/topup` - Top-up requests
- `rfid/{TEAM_ID}/device/health` - Device health reports

## API Endpoints

### Authentication
- `POST /register` - Create new account
- `POST /login` - Login
- `POST /logout` - Logout
- `GET /me` - Get current user

### Cards
- `GET /cards` - Get all cards
- `GET /card/:uid` - Get specific card
- `POST /scan` - Register card scan
- `POST /topup` - Top-up card balance

### Analytics
- `GET /transactions` - Get transaction history
- `GET /stats` - Get system statistics

## Dashboard Views

1. **Dashboard** - Real-time card scanning and top-up
2. **Card Registry** - View all registered cards
3. **Analytics** - Transaction insights and metrics
4. **Profile** - User account management
5. **Settings** - System configuration

## Security Features

- Session-based authentication
- Protected API routes
- Input validation and sanitization
- CSRF protection
- Secure password hashing

## Team

Team ID: `ivan_bright`

## License

MIT License
