const mongoose = require('mongoose');

const exchangeSchema = new mongoose.Schema({
  requester:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  owner:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetItem:  { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true }, // 相手のアイテム
  offerItem:   { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true }, // 自分のアイテム
  message:     { type: String, default: '' },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'cancelled', 'completed'],
    default: 'pending'
  }
}, { timestamps: true });

module.exports = mongoose.model('ExchangeRequest', exchangeSchema);
