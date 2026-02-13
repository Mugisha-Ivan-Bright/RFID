const mongoose = require('mongoose');
const Card = require('./models/Card');
const Transaction = require('./models/Transaction');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rfid_db';

async function cleanupCorruptedData() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Clean up corrupted cards
        const cards = await Card.find();
        let deletedCards = 0;
        let cleanedCards = 0;

        for (const card of cards) {
            // Check if UID contains non-printable characters
            const cleanUID = card.uid.replace(/[^\x20-\x7E]/g, '');

            if (cleanUID.length < 4 || cleanUID !== card.uid) {
                // Delete corrupted card
                await Card.deleteOne({ _id: card._id });
                deletedCards++;
                console.log(`🗑️  Deleted corrupted card: ${card.uid.substring(0, 20)}...`);
            } else {
                // Clean owner name if corrupted
                if (card.owner) {
                    const cleanOwner = card.owner.replace(/[^\x20-\x7E]/g, '').trim();
                    if (cleanOwner !== card.owner) {
                        card.owner = cleanOwner || null;
                        await card.save();
                        cleanedCards++;
                        console.log(`🧹 Cleaned owner for card: ${card.uid}`);
                    }
                }
            }
        }

        // Clean up corrupted transactions
        const transactions = await Transaction.find();
        let deletedTx = 0;

        for (const tx of transactions) {
            const cleanUID = tx.uid.replace(/[^\x20-\x7E]/g, '');

            if (cleanUID.length < 4 || cleanUID !== tx.uid) {
                await Transaction.deleteOne({ _id: tx._id });
                deletedTx++;
                console.log(`🗑️  Deleted corrupted transaction`);
            }
        }

        console.log('\n📊 Cleanup Summary:');
        console.log(`   - Deleted ${deletedCards} corrupted cards`);
        console.log(`   - Cleaned ${cleanedCards} card owners`);
        console.log(`   - Deleted ${deletedTx} corrupted transactions`);
        console.log('\n✅ Cleanup complete!');

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('❌ Cleanup failed:', err);
        process.exit(1);
    }
}

cleanupCorruptedData();
