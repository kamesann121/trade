const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const User    = require('../models/User');

// ── 通知一覧 GET /api/notifications ─────────
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('notifications');
    const notifs = (user.notifications || []).slice().reverse(); // 新しい順
    res.json(notifs);
  } catch {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

// ── 未読数 GET /api/notifications/unread ─────
router.get('/unread', auth, async (req, res) => {
  try {
    const user  = await User.findById(req.user.id).select('notifications');
    const count = (user.notifications || []).filter(n => !n.read).length;
    res.json({ count });
  } catch {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

// ── 全て既読 PUT /api/notifications/read-all ─
router.put('/read-all', auth, async (req, res) => {
  try {
    await User.updateOne(
      { _id: req.user.id },
      { $set: { 'notifications.$[].read': true } }
    );
    res.json({ message: '全て既読にしました' });
  } catch {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

// ── 1件既読 PUT /api/notifications/:index/read ─
router.put('/:index/read', auth, async (req, res) => {
  try {
    const user  = await User.findById(req.user.id);
    const notifs = user.notifications || [];
    const idx   = notifs.length - 1 - Number(req.params.index); // reverse順→元の順
    if (notifs[idx]) notifs[idx].read = true;
    await user.save();
    res.json({ message: '既読にしました' });
  } catch {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

module.exports = router;
