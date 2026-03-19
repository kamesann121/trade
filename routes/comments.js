const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const Comment = require('../models/Comment');
const Item    = require('../models/Item');
const { maskBadWords } = require('../middleware/filterBadWords');

// ── コメント一覧取得 ──────────────────────────
router.get('/:itemId', async (req, res) => {
  try {
    const comments = await Comment.find({ item: req.params.itemId })
      .populate('author', 'username avatar')
      .sort({ createdAt: 1 });
    res.json(comments);
  } catch {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

// ── コメント投稿 ──────────────────────────────
router.post('/:itemId', auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: 'コメントを入力してください' });
    if (text.trim().length > 300) return res.status(400).json({ message: 'コメントは300文字以内にしてください' });

    const item = await Item.findById(req.params.itemId);
    if (!item) return res.status(404).json({ message: 'アイテムが見つかりません' });

    const filteredText = await maskBadWords(text.trim());

    const comment = await Comment.create({
      item:   req.params.itemId,
      author: req.user.id,
      text:   filteredText
    });
    await comment.populate('author', 'username avatar');
    res.status(201).json(comment);
  } catch {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

// ── コメント削除（本人のみ） ──────────────────
router.delete('/:commentId', auth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: 'コメントが見つかりません' });
    if (comment.author.toString() !== req.user.id)
      return res.status(403).json({ message: '自分のコメントのみ削除できます' });
    await comment.deleteOne();
    res.json({ message: '削除しました' });
  } catch {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

module.exports = router;
