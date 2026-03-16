const express  = require('express');
const router   = express.Router();
const auth     = require('../middleware/auth');
const Review   = require('../models/Review');
const User     = require('../models/User');
const ExchangeRequest = require('../models/ExchangeRequest');

async function addNotification(userId, type, message, link) {
  await User.findByIdAndUpdate(userId, {
    $push: { notifications: { type, message, link, read: false } }
  });
}

router.post('/', auth, async (req, res) => {
  try {
    const { exchangeId, rating, comment } = req.body;
    if (!exchangeId || !rating)
      return res.status(400).json({ message: '取引IDと評価は必須です' });
    if (rating < 1 || rating > 5)
      return res.status(400).json({ message: '評価は1〜5で指定してください' });
    const exchange = await ExchangeRequest.findById(exchangeId);
    if (!exchange) return res.status(404).json({ message: '取引が見つかりません' });
    if (exchange.status !== 'accepted')
      return res.status(400).json({ message: '承認済みの取引のみ評価できます' });
    const myId = req.user.id;
    const isRequester = exchange.requester.toString() === myId;
    const isOwner     = exchange.owner.toString()     === myId;
    if (!isRequester && !isOwner)
      return res.status(403).json({ message: 'この取引に関わっていません' });
    const revieweeId = isRequester
      ? exchange.owner.toString()
      : exchange.requester.toString();
    const review = await Review.create({
      reviewer: myId,
      reviewee: revieweeId,
      exchange: exchangeId,
      rating:   Number(rating),
      comment:  comment || ''
    });
    const reviews = await Review.find({ reviewee: revieweeId });
    const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
    await User.findByIdAndUpdate(revieweeId, {
      rating: Math.round(avg * 10) / 10,
      ratingCount: reviews.length
    });
    const reviewer = await User.findById(myId).select('username');
    await addNotification(
      revieweeId, 'review',
      `${reviewer.username} さんから評価が届きました（★${rating}）`,
      `/profile.html?id=${revieweeId}`
    );
    res.status(201).json(review);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'この取引はすでに評価済みです' });
    res.status(500).json({ message: 'サーバーエラー', error: err.message });
  }
});

router.get('/user/:userId', async (req, res) => {
  try {
    const reviews = await Review.find({ reviewee: req.params.userId })
      .populate('reviewer', 'username avatar')
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

router.get('/check/:exchangeId', auth, async (req, res) => {
  try {
    const review = await Review.findOne({
      reviewer: req.user.id,
      exchange: req.params.exchangeId
    });
    res.json({ reviewed: !!review });
  } catch {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

module.exports = router;
