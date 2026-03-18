const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const Report  = require('../models/Report');
const User    = require('../models/User');

// ── 自動BAN処理 ───────────────────────────────
async function checkAndApplyBan(userId) {
  const user = await User.findById(userId);
  if (!user) return;

  const count = user.reportCount;

  if (count >= 100 && !user.isBanned) {
    // 永久BAN
    user.isBanned  = true;
    user.banUntil  = null;
    user.banReason = '通報が100件に達しました（永久停止）';
    await user.save();
  } else if (count >= 50 && (!user.isBanned || (user.banUntil && new Date() > user.banUntil))) {
    // 1週間BAN
    user.isBanned  = true;
    user.banUntil  = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    user.banReason = '通報が50件に達しました（1週間停止）';
    await user.save();
  } else if (count >= 20 && (!user.isBanned || (user.banUntil && new Date() > user.banUntil))) {
    // 48時間BAN
    user.isBanned  = true;
    user.banUntil  = new Date(Date.now() + 48 * 60 * 60 * 1000);
    user.banReason = '通報が20件に達しました（48時間停止）';
    await user.save();
  }
}

// ── 通報送信 POST /api/reports ────────────────
router.post('/', auth, async (req, res) => {
  try {
    const { reportedId, reason, detail, fingerprint } = req.body;
    if (!reportedId || !reason)
      return res.status(400).json({ message: '通報対象と理由は必須です' });
    if (reportedId === req.user.id)
      return res.status(400).json({ message: '自分自身を通報することはできません' });

    const reported = await User.findById(reportedId);
    if (!reported) return res.status(404).json({ message: 'ユーザーが見つかりません' });

    // デバイスフィンガープリントによるサブ垢チェック
    if (fingerprint) {
      const fpReporter = await User.findById(req.user.id).select('fingerprints');
      // フィンガープリントを保存
      if (!fpReporter.fingerprints.includes(fingerprint)) {
        await User.findByIdAndUpdate(req.user.id, {
          $addToSet: { fingerprints: fingerprint }
        });
      }
      // 同じフィンガープリントを持つ別のアカウントが既に通報してないか確認
      const sameDevice = await User.findOne({
        _id: { $ne: req.user.id },
        fingerprints: fingerprint
      });
      if (sameDevice) {
        const alreadyReported = await Report.findOne({
          reporter: sameDevice._id, reported: reportedId
        });
        if (alreadyReported)
          return res.status(400).json({ message: '同じデバイスから既に通報されています' });
      }
    }

    // 同一ユーザーからの重複通報チェック（upsertで1件カウント）
    const existing = await Report.findOne({ reporter: req.user.id, reported: reportedId });
    if (existing)
      return res.status(400).json({ message: 'すでにこのユーザーを通報済みです' });

    await Report.create({
      reporter: req.user.id,
      reported: reportedId,
      reason, detail: detail || '',
      fingerprint: fingerprint || ''
    });

    // 通報カウントを増やす
    reported.reportCount = (reported.reportCount || 0) + 1;
    await reported.save();

    // 自動BAN判定
    await checkAndApplyBan(reportedId);

    res.json({ message: '通報を受け付けました' });
  } catch (err) {
    if (err.code === 11000)
      return res.status(400).json({ message: 'すでにこのユーザーを通報済みです' });
    res.status(500).json({ message: 'サーバーエラー', error: err.message });
  }
});

// ── ユーザーIDで検索 GET /api/reports/search ─
router.get('/search', auth, async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return res.status(400).json({ message: 'ユーザー名を入力してください' });
    const users = await User.find({
      username: new RegExp(username, 'i'),
      _id: { $ne: req.user.id }
    }).select('username avatar _id').limit(10);
    res.json(users);
  } catch {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

module.exports = router;
