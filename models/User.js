const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true },
  password: { type: String },
  googleId: { type: String },
  avatar:   { type: String, default: '' },
  bio:      { type: String, default: '' },
  rating:   { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
  notifications: [{
    type:    { type: String },
    message: { type: String },
    link:    { type: String },
    read:    { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }],
  // BAN関連
  isBanned:    { type: Boolean, default: false },
  banUntil:    { type: Date, default: null },
  banReason:   { type: String, default: '' },
  reportCount: { type: Number, default: 0 },
  // デバイスフィンガープリント（サブ垢対策）
  fingerprints: [{ type: String }],
  // 管理者フラグ
  isAdmin: { type: Boolean, default: false },

  // ── パスワードリセット／変更用 ────────────
  passwordResetCode:    { type: String },
  passwordResetExpires: { type: Date },

  // ── メールアドレス変更用 ──────────────────
  emailChangeToken:   { type: String },
  emailChangeTo:      { type: String },
  emailChangeExpires: { type: Date }

}, { timestamps: true });

userSchema.methods.isBannedNow = function() {
  if (!this.isBanned) return false;
  if (!this.banUntil) return true;
  return new Date() < this.banUntil;
};

userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function(plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('User', userSchema);
