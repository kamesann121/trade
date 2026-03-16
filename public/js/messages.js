const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const Message = require('../models/Message');
const User    = require('../models/User');

// ── 通知ヘルパー ────────────────────────────
async function addNotification(userId, type, message, link) {
  await User.findByIdAndUpdate(userId, {
    $push: { notifications: { type, message, link, read: false } }
  });
}

// ── メッセージ送信 POST /api/messages ───────
router.post('/', auth, async (req, res) => {
  try {
    const { receiverId, text } = req.body;
    if (!receiverId || !text?.trim())
      return res.status(400).json({ message: '送信先とメッセージ本文は必須です' });
    if (receiverId === req.user.id)
      return res.status(400).json({ message: '自分にはメッセージを送れません' });

    const receiver = await User.findById(receiverId);
    if (!receiver) return res.status(404).json({ message: 'ユーザーが見つかりません' });

    const conversationId = Message.makeConvId(req.user.id, receiverId);
    const msg = await Message.create({
      conversationId,
      sender:   req.user.id,
      receiver: receiverId,
      text:     text.trim()
    });

    // 受信者に通知（最新1件だけ）
    const sender = await User.findById(req.user.id).select('username');
    await addNotification(
      receiverId, 'dm',
      `${sender.username} からメッセージが届きました`,
      `/messages.html?to=${req.user.id}`
    );

    await msg.populate('sender', 'username avatar');
    res.status(201).json(msg);
  } catch (err) {
    res.status(500).json({ message: 'サーバーエラー', error: err.message });
  }
});

// ── 会話一覧 GET /api/messages/conversations ─
router.get('/conversations', auth, async (req, res) => {
  try {
    // 自分が参加する全conversationの最新メッセージを取得
    const latest = await Message.aggregate([
      { $match: {
          $or: [
            { sender:   { $eq: require('mongoose').Types.ObjectId.createFromHexString(req.user.id) } },
            { receiver: { $eq: require('mongoose').Types.ObjectId.createFromHexString(req.user.id) } }
          ]
      }},
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$conversationId', lastMsg: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$lastMsg' } },
      { $sort: { createdAt: -1 } }
    ]);

    // 相手ユーザー情報を付加
    const populated = await Message.populate(latest, [
      { path: 'sender',   select: 'username avatar' },
      { path: 'receiver', select: 'username avatar' }
    ]);

    // 未読数も付加
    const result = await Promise.all(populated.map(async msg => {
      const unread = await Message.countDocuments({
        conversationId: msg.conversationId,
        receiver: req.user.id,
        read: false
      });
      return { ...msg, unreadCount: unread };
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'サーバーエラー', error: err.message });
  }
});

// ── 会話履歴 GET /api/messages/:userId ──────
router.get('/:userId', auth, async (req, res) => {
  try {
    const conversationId = Message.makeConvId(req.user.id, req.params.userId);
    const messages = await Message.find({ conversationId })
      .populate('sender', 'username avatar')
      .sort({ createdAt: 1 });

    // 既読にする
    await Message.updateMany(
      { conversationId, receiver: req.user.id, read: false },
      { read: true }
    );

    res.json(messages);
  } catch {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

// ── 未読数合計 GET /api/messages/unread/count ─
router.get('/unread/count', auth, async (req, res) => {
  try {
    const count = await Message.countDocuments({ receiver: req.user.id, read: false });
    res.json({ count });
  } catch {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

module.exports = router;
