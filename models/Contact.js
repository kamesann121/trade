const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  email:   { type: String, required: true },
  message: { type: String, required: true },
  read:    { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Contact', contactSchema);
