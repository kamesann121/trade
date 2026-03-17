const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  owner:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:       { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  wantTitle:   { type: String, default: '' },
  images:      [{ type: String }],
  status: {
    type: String,
    enum: ['募集中', '交渉中', '交換済み'],
    default: '募集中'
  },
  tags: [{ type: String }]
}, { timestamps: true });

itemSchema.index({ title: 'text', description: 'text', wantTitle: 'text', tags: 'text' });

module.exports = mongoose.model('Item', itemSchema);
