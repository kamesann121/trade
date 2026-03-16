const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const User    = require('../models/User');

router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('notifications');
    const notifs = (user.notifications || []).slice().reverse();
    res.json(notifs);
  } catch {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

router.get('/unread', auth, async (req, res) => {
  try {
    const user  = await User.findById(req.user.id).select('notifications');
    const count = (user.notifications || []).filter(n => !n.read).length;
    res.json({ count });
  } catch {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

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

router.put('/:index/read', auth, async (req, res) => {
  try {
    const user   = await User.findById(req.user.id);
    const notifs = user.notifications || [];
    const idx    = notifs.length - 1 - Number(req.params.index);
    if (notifs[idx]) notifs[idx].read = true;
    await user.save();
    res.json({ message: '既読にしました' });
  } catch {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

module.exports = router;
