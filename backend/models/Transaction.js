const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    uid: { type: String, required: true },
    owner: { type: String },
    amount: { type: Number, required: true },
    newBalance: { type: Number },
    timestamp: { type: Date, default: Date.now },
    type: { type: String, default: 'topup' },
    performedBy: { type: String } // Employee who performed the transaction
});

module.exports = mongoose.model('Transaction', transactionSchema);
