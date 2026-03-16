const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversationId: { type: String, required: true, index: true },
  sender:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text:     { type: String, required: true, trim: true },
  read:     { type: Boolean, default: false }
}, { timestamps: true });

// conversationId は常に「小さいID_大きいID」で統一
messageSchema.statics.makeConvId = (a, b) =>
  [a.toString(), b.toString()].sort().join('_');

module.exports = mongoose.model('Message', messageSchema);
