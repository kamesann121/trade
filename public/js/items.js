const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const { body, validationResult } = require('express-validator');
const auth     = require('../middleware/auth');
const Item     = require('../models/Item');

// ── 画像アップロード設定 ────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/items';
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (/image\/(jpeg|png|gif|webp)/.test(file.mimetype)) cb(null, true);
    else cb(new Error('画像ファイルのみアップロード可能です'));
  }
});

// ── 出品 POST /api/items ────────────────────
router.post('/', auth, upload.array('images', 5), [
  body('title').trim().notEmpty().withMessage('タイトルは必須です'),
  body('category').notEmpty(),
  body('condition').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { title, description, category, platform, condition, wantTitle, tags } = req.body;
    const images = (req.files || []).map(f => '/' + f.path.replace(/\\/g, '/'));
    const tagArray = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];

    const item = await Item.create({
      owner: req.user.id,
      title, description, category, platform, condition, wantTitle,
      images, tags: tagArray
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ message: 'サーバーエラー', error: err.message });
  }
});

// ── 一覧・検索 GET /api/items ───────────────
router.get('/', async (req, res) => {
  try {
    const { q, category, platform, condition, status, page = 1, limit = 12 } = req.query;
    const filter = {};

    if (q) filter.$text = { $search: q };
    if (category)  filter.category  = category;
    if (platform)  filter.platform  = new RegExp(platform, 'i');
    if (condition) filter.condition = condition;
    filter.status = status || '募集中';

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

// ── 詳細 GET /api/items/:id ─────────────────
router.get('/:id', async (req, res) => {
  try {
    const item = await Item.findById(req.params.id).populate('owner', 'username avatar rating ratingCount bio');
    if (!item) return res.status(404).json({ message: 'アイテムが見つかりません' });
    res.json(item);
  } catch {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

// ── 編集 PUT /api/items/:id ─────────────────
router.put('/:id', auth, upload.array('images', 5), async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: '見つかりません' });
    if (item.owner.toString() !== req.user.id) return res.status(403).json({ message: '権限がありません' });

    const fields = ['title','description','category','platform','condition','wantTitle','status'];
    fields.forEach(f => { if (req.body[f] !== undefined) item[f] = req.body[f]; });
    if (req.body.tags) item.tags = req.body.tags.split(',').map(t => t.trim()).filter(Boolean);
    if (req.files?.length) item.images = req.files.map(f => '/' + f.path.replace(/\\/g, '/'));

    await item.save();
    res.json(item);
  } catch {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

// ── 削除 DELETE /api/items/:id ──────────────
router.delete('/:id', auth, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: '見つかりません' });
    if (item.owner.toString() !== req.user.id) return res.status(403).json({ message: '権限がありません' });
    await item.deleteOne();
    res.json({ message: '削除しました' });
  } catch {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

// ── 自分の出品一覧 GET /api/items/my/list ───
router.get('/my/list', auth, async (req, res) => {
  try {
    const items = await Item.find({ owner: req.user.id }).sort({ createdAt: -1 });
    res.json(items);
  } catch {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

module.exports = router;
