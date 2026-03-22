const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  text:    { type: String, required: true },
  isAdmin: { type: Boolean, default: false }
}, { timestamps: true });

const contactSchema = new mongoose.Schema({
  email:    { type: String, required: true },
  messages: [messageSchema],
  read:     { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Contact', contactSchema);
