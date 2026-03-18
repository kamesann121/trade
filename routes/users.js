const express  = require('express');
const router   = express.Router();
const auth     = require('../middleware/auth');
const User     = require('../models/User');
const { cloudinary, uploadAvatar: upload } = require('../config/cloudinary');

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
router.post('/avatar', auth, (req, res, next) => {
  upload.single('avatar')(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message || '画像のアップロードに失敗しました' });
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: '画像が選択されていません' });
    const avatarUrl = req.file.path; // Cloudinary URL

    // 古いアバターをCloudinaryから削除
    const user = await User.findById(req.user.id);
    if (user.avatar && user.avatar.includes('cloudinary.com')) {
      const publicId = user.avatar.split('/').slice(-2).join('/').split('.')[0];
      await cloudinary.uploader.destroy(publicId).catch(() => {});
    }

    user.avatar = avatarUrl;
    await user.save();
    res.json({ avatar: avatarUrl });
  } catch (err) {
    res.status(500).json({ message: 'サーバーエラー：' + err.message });
  }
});

module.exports = router;
