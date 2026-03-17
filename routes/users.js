const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const auth     = require('../middleware/auth');
const User     = require('../models/User');

// アバター用ストレージ
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/avatars';
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${req.user.id}-${Date.now()}${path.extname(file.originalname)}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/image\/(jpeg|png|gif|webp)/.test(file.mimetype)) cb(null, true);
    else cb(new Error('画像ファイルのみアップロード可能です'));
  }
});

// ── プロフィール更新 ──────────────────────────
router.put('/profile', auth, async (req, res) => {
  try {
    const { username, bio } = req.body;
    if (!username || username.trim().length === 0)
      return res.status(400).json({ message: 'ニックネームは必須です' });
    if (username.trim().length > 16)
      return res.status(400).json({ message: 'ニックネームは16文字以内にしてください' });
    if (bio && bio.length > 40)
      return res.status(400).json({ message: '自己紹介は40文字以内にしてください' });

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { username: username.trim(), bio: bio?.trim() || '' },
      { new: true }
    ).select('-password');

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

// ── アバターアップロード ──────────────────────
router.post('/avatar', auth, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: '画像が選択されていません' });
    const avatarUrl = '/' + req.file.path.replace(/\\/g, '/');

    // 古いアバターを削除（デフォルト以外）
    const user = await User.findById(req.user.id);
    if (user.avatar && user.avatar.startsWith('/uploads/avatars/')) {
      const oldPath = path.join(__dirname, '..', user.avatar);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    user.avatar = avatarUrl;
    await user.save();
    res.json({ avatar: avatarUrl });
  } catch (err) {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

module.exports = router;
