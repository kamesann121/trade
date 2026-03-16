const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const passport = require('passport');
const { body, validationResult } = require('express-validator');
const User    = require('../models/User');

const makeToken = (user) =>
  jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' });

// ── 新規登録 ──────────────────────────────────
router.post('/register', [
  body('username').trim().notEmpty().withMessage('ユーザー名は必須です'),
  body('email').isEmail().withMessage('メールアドレスが不正です'),
  body('password').isLength({ min: 6 }).withMessage('パスワードは6文字以上')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { username, email, password } = req.body;
    if (await User.findOne({ email }))
      return res.status(400).json({ message: 'このメールはすでに登録済みです' });

    const user = await User.create({ username, email, password });
    res.status(201).json({ token: makeToken(user), user: { id: user._id, username: user.username, email: user.email } });
  } catch (err) {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

// ── ログイン ──────────────────────────────────
router.post('/login', [
  body('email').isEmail(),
  body('password').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !user.password) return res.status(400).json({ message: 'メールまたはパスワードが違います' });
    if (!await user.comparePassword(password)) return res.status(400).json({ message: 'メールまたはパスワードが違います' });

    res.json({ token: makeToken(user), user: { id: user._id, username: user.username, email: user.email } });
  } catch (err) {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

// ── Google OAuth ──────────────────────────────
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/?error=google' }),
  (req, res) => {
    const token = makeToken(req.user);
    res.redirect(`/home.html?token=${token}`);
  }
);

// ── ログインユーザー情報取得 ──────────────────
const auth = require('../middleware/auth');
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

module.exports = router;
