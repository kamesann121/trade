const express  = require('express');
const router   = express.Router();
const auth     = require('../middleware/auth');
const ExchangeRequest = require('../models/ExchangeRequest');
const Item     = require('../models/Item');
const User     = require('../models/User');
const Message  = require('../models/Message');

async function addNotification(userId, type, message, link) {
  await User.findByIdAndUpdate(userId, {
    $push: { notifications: { type, message, link, read: false } }
  });
}

// ── 申請送信 ──────────────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    const { targetItemId, offerItemId, message } = req.body;
    if (!targetItemId || !offerItemId)
      return res.status(400).json({ message: 'アイテムを選択してください' });

    const targetItem = await Item.findById(targetItemId);
    const offerItem  = await Item.findById(offerItemId);
    if (!targetItem || !offerItem)
      return res.status(404).json({ message: 'アイテムが見つかりません' });
    if (targetItem.status !== '募集中')
      return res.status(400).json({ message: 'このアイテムは現在交換受付中ではありません' });
    if (offerItem.owner.toString() !== req.user.id)
      return res.status(403).json({ message: '自分のアイテムのみ提供できます' });
    if (targetItem.owner.toString() === req.user.id)
      return res.status(400).json({ message: '自分のアイテムには申請できません' });

    // ── 取引中ブロック：自分または相手が accepted の取引に関わっていたら申請不可 ──
    const myActive = await ExchangeRequest.findOne({
      $or: [{ requester: req.user.id }, { owner: req.user.id }],
      status: 'accepted'
    });
    if (myActive)
      return res.status(400).json({
        message: '現在進行中の取引があります。完了してから新しい申請を行ってください。'
      });

    // 相手も取引中なら申請不可
    const theirActive = await ExchangeRequest.findOne({
      $or: [{ requester: targetItem.owner }, { owner: targetItem.owner }],
      status: 'accepted'
    });
    if (theirActive)
      return res.status(400).json({
        message: '相手は現在別の取引中です。完了後に申請してください。'
      });

    const existing = await ExchangeRequest.findOne({
      requester: req.user.id, targetItem: targetItemId, status: 'pending'
    });
    if (existing) return res.status(400).json({ message: '既に申請中です' });

    const request = await ExchangeRequest.create({
      requester:  req.user.id,
      owner:      targetItem.owner,
      targetItem: targetItemId,
      offerItem:  offerItemId,
      message:    message || ''
    });
    await addNotification(
      targetItem.owner, 'exchange',
      `交換申請が届きました：「${targetItem.title}」`,
      `/my-exchanges.html`
    );
    res.status(201).json(request);
  } catch (err) {
    res.status(500).json({ message: 'サーバーエラー', error: err.message });
  }
});

// ── 受けた申請一覧 ────────────────────────────
router.get('/received', auth, async (req, res) => {
  try {
    const requests = await ExchangeRequest.find({ owner: req.user.id })
      .populate('requester', 'username avatar rating')
      .populate('targetItem', 'title images status')
      .populate('offerItem',  'title images condition')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

// ── 送った申請一覧 ────────────────────────────
router.get('/sent', auth, async (req, res) => {
  try {
    const requests = await ExchangeRequest.find({ requester: req.user.id })
      .populate('owner',      'username avatar rating')
      .populate('targetItem', 'title images status')
      .populate('offerItem',  'title images condition')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

// ── 承認 ─────────────────────────────────────
router.put('/:id/accept', auth, async (req, res) => {
  try {
    const request = await ExchangeRequest.findById(req.params.id)
      .populate('targetItem').populate('offerItem');
    if (!request) return res.status(404).json({ message: '申請が見つかりません' });
    if (request.owner.toString() !== req.user.id)
      return res.status(403).json({ message: '権限がありません' });
    if (request.status !== 'pending')
      return res.status(400).json({ message: 'この申請は既に処理済みです' });

    request.status = 'accepted';
    await request.save();
    // 他の申請を拒否
    await ExchangeRequest.updateMany(
      { targetItem: request.targetItem._id, status: 'pending', _id: { $ne: request._id } },
      { status: 'rejected' }
    );
    await addNotification(
      request.requester, 'exchange',
      `交換申請が承認されました！「${request.targetItem.title}」`,
      `/my-exchanges.html`
    );
    res.json({ message: '承認しました', request });
  } catch (err) {
    res.status(500).json({ message: 'サーバーエラー', error: err.message });
  }
});

// ── 拒否 ─────────────────────────────────────
router.put('/:id/reject', auth, async (req, res) => {
  try {
    const request = await ExchangeRequest.findById(req.params.id)
      .populate('targetItem');
    if (!request) return res.status(404).json({ message: '申請が見つかりません' });
    if (request.owner.toString() !== req.user.id)
      return res.status(403).json({ message: '権限がありません' });
    request.status = 'rejected';
    await request.save();
    const remaining = await ExchangeRequest.countDocuments({
      targetItem: request.targetItem._id, status: 'pending'
    });
    if (remaining === 0)
      await Item.findByIdAndUpdate(request.targetItem._id, { status: '募集中' });
    await addNotification(
      request.requester, 'exchange',
      `交換申請が断られました：「${request.targetItem.title}」`,
      `/my-exchanges.html`
    );
    res.json({ message: '拒否しました' });
  } catch {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

// ── 完了（両者承諾制） ────────────────────────
router.put('/:id/complete', auth, async (req, res) => {
  try {
    const request = await ExchangeRequest.findById(req.params.id)
      .populate('targetItem').populate('offerItem');
    if (!request) return res.status(404).json({ message: '申請が見つかりません' });

    const isInvolved = [request.requester.toString(), request.owner.toString()].includes(req.user.id);
    if (!isInvolved) return res.status(403).json({ message: '権限がありません' });
    if (request.status !== 'accepted')
      return res.status(400).json({ message: '承認済みの申請のみ完了にできます' });

    // すでに押していたらスキップ
    const alreadyPressed = request.completedBy.map(id => id.toString()).includes(req.user.id);
    if (alreadyPressed)
      return res.status(400).json({ message: 'すでに完了ボタンを押しています。相手の承諾を待ってください。' });

    request.completedBy.push(req.user.id);

    const otherId = request.requester.toString() === req.user.id
      ? request.owner.toString()
      : request.requester.toString();

    // 両者が押した → 完了
    if (request.completedBy.length >= 2) {
      request.status = 'completed';
      await request.save();
      await Item.findByIdAndUpdate(request.targetItem._id, { status: '交換済み' });
      await Item.findByIdAndUpdate(request.offerItem._id,  { status: '交換済み' });

      // 取引相手とのメッセージを自動削除
      const convId = Message.makeConvId(request.requester.toString(), request.owner.toString());
      await Message.deleteMany({ conversationId: convId });

      await addNotification(otherId, 'exchange',
        `🎉 交換が完了しました！「${request.targetItem.title}」`, `/my-exchanges.html`);
      return res.json({ message: '🎉 交換が完了しました！', status: 'completed' });
    }

    // 片方だけ押した → 相手に通知
    await request.save();
    await addNotification(otherId, 'exchange',
      `相手が交換完了ボタンを押しました。あなたも完了ボタンを押してください。`, `/my-exchanges.html`);
    res.json({ message: '完了ボタンを押しました。相手の承諾を待っています…', status: 'waiting' });
  } catch (err) {
    res.status(500).json({ message: 'サーバーエラー', error: err.message });
  }
});

// ── キャンセル ────────────────────────────────
router.put('/:id/cancel', auth, async (req, res) => {
  try {
    const request = await ExchangeRequest.findById(req.params.id)
      .populate('targetItem');
    if (!request) return res.status(404).json({ message: '申請が見つかりません' });
    if (request.requester.toString() !== req.user.id)
      return res.status(403).json({ message: '権限がありません' });
    if (request.status !== 'pending')
      return res.status(400).json({ message: '取り消せる状態ではありません' });
    request.status = 'cancelled';
    await request.save();
    const remaining = await ExchangeRequest.countDocuments({
      targetItem: request.targetItem._id, status: 'pending'
    });
    if (remaining === 0)
      await Item.findByIdAndUpdate(request.targetItem._id, { status: '募集中' });
    res.json({ message: '取り消しました' });
  } catch {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

module.exports = router;
