const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  item:    { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true, index: true },
  author:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text:    { type: String, required: true, trim: true, maxlength: 300 }
}, { timestamps: true });

module.exports = mongoose.model('Comment', commentSchema);
