const mongoose = require('mongoose');

const badWordSchema = new mongoose.Schema({
  word:      { type: String, required: true, unique: true, trim: true, lowercase: true },
  addedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('BadWord', badWordSchema);
