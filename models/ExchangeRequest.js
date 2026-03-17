const mongoose = require('mongoose');

const exchangeSchema = new mongoose.Schema({
  requester:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  owner:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetItem:  { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  offerItem:   { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  message:     { type: String, default: '' },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'cancelled', 'completed'],
    default: 'pending'
  },
  // 交換完了ボタンを押したユーザーのIDリスト（両者が押したら完了）
  completedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

module.exports = mongoose.model('ExchangeRequest', exchangeSchema);
