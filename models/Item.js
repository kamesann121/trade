const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  category: {
    type: String,
    enum: ['ソフト', 'カード', 'グッズ', 'ハード周辺機器', 'その他'],
    default: 'その他'
  },
  platform: { type: String, default: '' }, // Switch, PS5, PCなど
  condition: {
    type: String,
    enum: ['新品同様', '良好', '普通', 'やや傷あり', '難あり'],
    default: '普通'
  },
  wantTitle: { type: String, default: '' },   // 求めるアイテム名
  images: [{ type: String }],                 // ファイルパス
  status: {
    type: String,
    enum: ['募集中', '交渉中', '交換済み'],
    default: '募集中'
  },
  tags: [{ type: String }]
}, { timestamps: true });

// テキスト検索インデックス
itemSchema.index({ title: 'text', description: 'text', wantTitle: 'text', tags: 'text' });

module.exports = mongoose.model('Item', itemSchema);
