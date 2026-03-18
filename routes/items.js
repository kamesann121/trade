const express  = require('express');
const router   = express.Router();
const { body, validationResult } = require('express-validator');
const auth     = require('../middleware/auth');
const Item     = require('../models/Item');
const { cloudinary, uploadItem: upload } = require('../config/cloudinary');

// ── 出品 ────────────────────────────────────
router.post('/', auth, upload.array('images', 5), [
  body('title').trim().notEmpty().withMessage('タイトルは必須です')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { title, description, wantTitle } = req.body;
    const images = (req.files || []).map(f => f.path); // Cloudinary URL

    // descriptionから#タグを自動抽出
    const tagMatches = (description || '').match(/#[\w\u3040-\u9fff]+/g) || [];
    const tags = tagMatches.map(t => t.slice(1).toLowerCase());

    const item = await Item.create({
      owner: req.user.id,
      title, description, wantTitle,
      images, tags
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ message: 'サーバーエラー', error: err.message });
  }
});

// ── 一覧・検索 ───────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { q, page = 1, limit = 12 } = req.query;
    const filter = { status: '募集中' };

    if (q) {
      const keyword = q.startsWith('#') ? q.slice(1).toLowerCase() : q;
      if (q.startsWith('#')) {
        // タグ検索
        filter.tags = keyword;
      } else {
        // テキスト検索
        filter.$or = [
          { title:       new RegExp(keyword, 'i') },
          { description: new RegExp(keyword, 'i') },
          { wantTitle:   new RegExp(keyword, 'i') },
          { tags:        keyword.toLowerCase() }
        ];
      }
    }

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Item.countDocuments(filter);
    const items = await Item.find(filter)
      .populate('owner', 'username avatar rating')
      .sort({ createdAt: -1 })
      .skip(skip).limit(Number(limit));

    res.json({ items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

// ── 自分の出品一覧 ───────────────────────────
router.get('/my/list', auth, async (req, res) => {
  try {
    const items = await Item.find({ owner: req.user.id }).sort({ createdAt: -1 });
    res.json(items);
  } catch {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

// ── 詳細 ────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const item = await Item.findById(req.params.id)
      .populate('owner', 'username avatar rating ratingCount bio');
    if (!item) return res.status(404).json({ message: 'アイテムが見つかりません' });
    res.json(item);
  } catch {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

// ── 編集 ────────────────────────────────────
router.put('/:id', auth, upload.array('images', 5), async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: '見つかりません' });
    if (item.owner.toString() !== req.user.id)
      return res.status(403).json({ message: '権限がありません' });

    const fields = ['title', 'description', 'wantTitle', 'status'];
    fields.forEach(f => { if (req.body[f] !== undefined) item[f] = req.body[f]; });

    if (req.body.description) {
      const tagMatches = req.body.description.match(/#[\w\u3040-\u9fff]+/g) || [];
      item.tags = tagMatches.map(t => t.slice(1).toLowerCase());
    }
    if (req.files?.length) item.images = req.files.map(f => f.path); // Cloudinary URL

    await item.save();
    res.json(item);
  } catch {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

// ── 削除 ────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: '見つかりません' });
    if (item.owner.toString() !== req.user.id)
      return res.status(403).json({ message: '権限がありません' });
    await item.deleteOne();
    res.json({ message: '削除しました' });
  } catch {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

module.exports = router;
