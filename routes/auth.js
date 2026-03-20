require('dotenv').config();
const express  = require('express');
const router   = express.Router();
const jwt      = require('jsonwebtoken');
const admin    = require('../config/passport');
const { body, validationResult } = require('express-validator');
const User     = require('../models/User');
const auth     = require('../middleware/auth');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);
const crypto   = require('crypto');

const makeToken = (user) =>
  jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' });

// ── メール送信設定 ────────────────────────────
async function sendMail(to, subject, html) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'GameTrade <onboarding@resend.dev>',
      to,
      subject,
      html
    });
    if (error) {
      console.error('メール送信失敗:', error);
      throw new Error(error.message);
    }
    console.log('メール送信成功:', data.id);
  } catch (err) {
    console.error('メール送信失敗:', err.message);
    throw err;
  }
}

// ── 確認コード生成（6桁） ─────────────────────
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── Firebaseトークンでログイン/登録 ──────────
router.post('/firebase', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ message: 'トークンがありません' });

    const decoded = await admin.auth().verifyIdToken(idToken);
    const { uid, email, name, picture } = decoded;

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        username: name || email.split('@')[0],
        email, googleId: uid, avatar: picture || ''
      });
    } else {
      if (!user.googleId) { user.googleId = uid; await user.save(); }
    }

    res.json({ token: makeToken(user), user: { id: user._id, username: user.username, email: user.email } });
  } catch (err) {
    res.status(401).json({ message: '認証失敗', error: err.message });
  }
});

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
    if (!user || !user.password)
      return res.status(400).json({ message: 'メールまたはパスワードが違います' });
    if (!await user.comparePassword(password))
      return res.status(400).json({ message: 'メールまたはパスワードが違います' });

    res.json({ token: makeToken(user), user: { id: user._id, username: user.username, email: user.email } });
  } catch {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

// ── ログインユーザー情報取得 ──────────────────
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

// ════════════════════════════════════════════
// 設定：メールアドレス変更
// POST /api/auth/change-email
// ════════════════════════════════════════════
router.post('/change-email', auth, async (req, res) => {
  try {
    const { newEmail, password } = req.body;
    if (!newEmail || !password)
      return res.status(400).json({ message: 'メールアドレスとパスワードを入力してください' });

    const user = await User.findById(req.user.id);
    if (!user.password)
      return res.status(400).json({ message: 'Googleログインのアカウントはメール変更できません' });
    if (!await user.comparePassword(password))
      return res.status(400).json({ message: 'パスワードが違います' });
    if (await User.findOne({ email: newEmail.toLowerCase() }))
      return res.status(400).json({ message: 'このメールアドレスはすでに使われています' });

    // 確認トークン生成（1時間有効）
    const token   = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    user.emailChangeToken   = token;
    user.emailChangeTo      = newEmail.toLowerCase();
    user.emailChangeExpires = expires;
    await user.save();

    const link = `${process.env.BASE_URL}/api/auth/confirm-email?token=${token}`;
    await sendMail(newEmail, '【GameTrade】メールアドレス変更の確認', `
      <p>以下のリンクをクリックしてメールアドレスの変更を完了してください。</p>
      <p><a href="${link}">${link}</a></p>
      <p>このリンクは1時間有効です。身に覚えがない場合は無視してください。</p>
    `);

    res.json({ message: '確認メールを送信しました' });
  } catch (err) {
    res.status(500).json({ message: 'サーバーエラー', error: err.message });
  }
});

// メールアドレス変更確認リンク（メールのリンクをクリック）
router.get('/confirm-email', async (req, res) => {
  try {
    const { token } = req.query;
    const user = await User.findOne({
      emailChangeToken:   token,
      emailChangeExpires: { $gt: new Date() }
    });
    if (!user) return res.status(400).send('リンクが無効か期限切れです。設定画面から再度お試しください。');

    user.email              = user.emailChangeTo;
    user.emailChangeToken   = undefined;
    user.emailChangeTo      = undefined;
    user.emailChangeExpires = undefined;
    await user.save();

    res.send('✅ メールアドレスを変更しました。ログイン画面からログインし直してください。<br><a href="/index.html">ログイン画面へ</a>');
  } catch {
    res.status(500).send('サーバーエラーが発生しました');
  }
});

// ════════════════════════════════════════════
// 設定：パスワード変更（ログイン済み）
// POST /api/auth/send-password-code
// ════════════════════════════════════════════
router.post('/send-password-code', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user.password)
      return res.status(400).json({ message: 'Googleログインのアカウントはパスワード変更できません' });

    const code    = generateCode();
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15分

    user.passwordResetCode    = code;
    user.passwordResetExpires = expires;
    await user.save();

    await sendMail(user.email, '【GameTrade】パスワード変更の確認コード', `
      <p>パスワード変更の確認コードです。</p>
      <h2 style="letter-spacing:6px;font-size:32px">${code}</h2>
      <p>このコードは15分間有効です。身に覚えがない場合は無視してください。</p>
    `);

    res.json({ message: '確認コードを送信しました' });
  } catch (err) {
    res.status(500).json({ message: 'サーバーエラー', error: err.message });
  }
});

router.post('/change-password', auth, async (req, res) => {
  try {
    const { code, newPassword } = req.body;
    if (!code || !newPassword)
      return res.status(400).json({ message: 'コードと新しいパスワードを入力してください' });
    if (newPassword.length < 6)
      return res.status(400).json({ message: 'パスワードは6文字以上にしてください' });

    const user = await User.findById(req.user.id);
    if (!user.passwordResetCode || user.passwordResetCode !== code)
      return res.status(400).json({ message: '確認コードが違います' });
    if (!user.passwordResetExpires || new Date() > user.passwordResetExpires)
      return res.status(400).json({ message: '確認コードの有効期限が切れています。再度送信してください' });

    user.password             = newPassword;
    user.passwordResetCode    = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.json({ message: 'パスワードを変更しました' });
  } catch {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

// ════════════════════════════════════════════
// パスワードリセット（ログアウト状態）
// POST /api/auth/send-reset-code
// ════════════════════════════════════════════
router.post('/send-reset-code', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'メールアドレスを入力してください' });

    const user = await User.findOne({ email: email.toLowerCase() });
    // ユーザーが存在しなくても同じメッセージを返す（メール列挙攻撃対策）
    if (!user || !user.password) {
      return res.json({ message: '確認コードを送信しました' });
    }

    const code    = generateCode();
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15分

    user.passwordResetCode    = code;
    user.passwordResetExpires = expires;
    await user.save();

    await sendMail(email, '【GameTrade】パスワードリセットの確認コード', `
      <p>パスワードリセットの確認コードです。</p>
      <h2 style="letter-spacing:6px;font-size:32px">${code}</h2>
      <p>このコードは15分間有効です。身に覚えがない場合は無視してください。</p>
    `);

    res.json({ message: '確認コードを送信しました' });
  } catch (err) {
    res.status(500).json({ message: 'サーバーエラー', error: err.message });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword)
      return res.status(400).json({ message: '全て入力してください' });
    if (newPassword.length < 6)
      return res.status(400).json({ message: 'パスワードは6文字以上にしてください' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.passwordResetCode || user.passwordResetCode !== code)
      return res.status(400).json({ message: '確認コードが違います' });
    if (!user.passwordResetExpires || new Date() > user.passwordResetExpires)
      return res.status(400).json({ message: '確認コードの有効期限が切れています。再度送信してください' });

    user.password             = newPassword;
    user.passwordResetCode    = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.json({ message: 'パスワードをリセットしました' });
  } catch {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

module.exports = router;
