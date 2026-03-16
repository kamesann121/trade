const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true },
  password: { type: String },          // Google認証の場合はnull
  googleId: { type: String },
  avatar:   { type: String, default: '' },
  bio:      { type: String, default: '' },
  rating:   { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
  notifications: [{
    type:    { type: String }, // 'dm' | 'exchange' | 'review'
    message: { type: String },
    link:    { type: String },
    read:    { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

// パスワードハッシュ
userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function(plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('User', userSchema);
