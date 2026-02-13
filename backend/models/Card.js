const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
    uid: { type: String, required: true, unique: true },
    owner: { type: String, default: 'Guest' },
    balance: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Card', cardSchema);
