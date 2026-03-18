const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reporter:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reported:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason:    { type: String, required: true },
  detail:    { type: String, default: '' },
  status:    { type: String, enum: ['pending', 'reviewed', 'dismissed'], default: 'pending' },
  fingerprint: { type: String, default: '' } // デバイス識別
}, { timestamps: true });

// 同一reporter+reportedの組み合わせはユニーク（1人1票）
reportSchema.index({ reporter: 1, reported: 1 }, { unique: true });

module.exports = mongoose.model('Report', reportSchema);
