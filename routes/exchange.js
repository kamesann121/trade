const express  = require('express');
const router   = express.Router();
const auth     = require('../middleware/auth');
const ExchangeRequest = require('../models/ExchangeRequest');
const Item     = require('../models/Item');
const User     = require('../models/User');

async function addNotification(userId, type, message, link) {
  await User.findByIdAndUpdate(userId, {
    $push: { notifications: { type, message, link, read: false } }
  });
}

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
      `/item-detail.html?id=${targetItemId}`
    );
    targetItem.status = '交渉中';
    await targetItem.save();
    res.status(201).json(request);
  } catch (err) {
    res.status(500).json({ message: 'サーバーエラー', error: err.message });
  }
});

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
    await Item.findByIdAndUpdate(request.targetItem._id, { status: '交換済み' });
    await Item.findByIdAndUpdate(request.offerItem._id,  { status: '交換済み' });
    await ExchangeRequest.updateMany(
      { targetItem: request.targetItem._id, status: 'pending', _id: { $ne: request._id } },
      { status: 'rejected' }
    );
    await addNotification(
      request.requester, 'exchange',
      `交換申請が承認されました！「${request.targetItem.title}」`,
      `/item-detail.html?id=${request.targetItem._id}`
    );
    res.json({ message: '承認しました', request });
  } catch (err) {
    res.status(500).json({ message: 'サーバーエラー', error: err.message });
  }
});

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
    if (remaining === 0) {
      await Item.findByIdAndUpdate(request.targetItem._id, { status: '募集中' });
    }
    await addNotification(
      request.requester, 'exchange',
      `交換申請が断られました：「${request.targetItem.title}」`,
      `/item-detail.html?id=${request.targetItem._id}`
    );
    res.json({ message: '拒否しました' });
  } catch {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

// ── 完了 ────────────────────────────────────
router.put('/:id/complete', auth, async (req, res) => {
  try {
    const request = await ExchangeRequest.findById(req.params.id)
      .populate('targetItem').populate('offerItem');
    if (!request) return res.status(404).json({ message: '申請が見つかりません' });
    const isInvolved = [request.requester.toString(), request.owner.toString()].includes(req.user.id);
    if (!isInvolved) return res.status(403).json({ message: '権限がありません' });
    if (request.status !== 'accepted')
      return res.status(400).json({ message: '承認済みの申請のみ完了にできます' });
    request.status = 'completed';
    await request.save();
    const otherId = request.requester.toString() === req.user.id ? request.owner : request.requester;
    await addNotification(otherId, 'exchange', `交換が完了しました！「${request.targetItem.title}」`, `/my-exchanges.html`);
    res.json({ message: '完了しました', request });
  } catch (err) {
    res.status(500).json({ message: 'サーバーエラー', error: err.message });
  }
});

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
    if (remaining === 0) {
      await Item.findByIdAndUpdate(request.targetItem._id, { status: '募集中' });
    }
    res.json({ message: '取り消しました' });
  } catch {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

module.exports = router;
