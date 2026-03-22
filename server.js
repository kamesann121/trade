require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const path      = require('path');

const app = express();
app.set('trust proxy', 1); // Render等のプロキシ環境用
connectDB();

// ── セキュリティヘッダー ──────────────────────
app.use(helmet({
  contentSecurityPolicy: false
}));

// ── CORS ─────────────────────────────────────
app.use(cors());

// ── レートリミット ────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'しばらく時間をおいてから再試行してください' },
  standardHeaders: true,
  legacyHeaders: false
});

const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { message: '通報の送信回数が上限に達しました。しばらくお待ちください' },
  standardHeaders: true,
  legacyHeaders: false
});

const postLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { message: '出品の上限に達しました。しばらくお待ちください' },
  standardHeaders: true,
  legacyHeaders: false
});

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { message: 'リクエストが多すぎます。しばらくお待ちください' },
  standardHeaders: true,
  legacyHeaders: false
});

// ── ミドルウェア ──────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── 静的ファイル ──────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── ルーティング ──────────────────────────────
app.use('/api/auth',          authLimiter,   require('./routes/auth'));
app.use('/api/reports',       reportLimiter, require('./routes/reports'));
app.use('/api/items',         postLimiter,   require('./routes/items'));
app.use('/api/users',         globalLimiter, require('./routes/users'));
app.use('/api/comments',      globalLimiter, require('./routes/comments'));
app.use('/api/exchange',      globalLimiter, require('./routes/exchange'));
app.use('/api/messages',      globalLimiter, require('./routes/messages'));
app.use('/api/reviews',       globalLimiter, require('./routes/reviews'));
app.use('/api/notifications', globalLimiter, require('./routes/notifications'));
app.use('/api/admin',                        require('./routes/admin'));
app.use('/api/contact',                      require('./routes/contact'));

// ── 管理者パネル ─────────────────────────────
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ── SPAフォールバック ─────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 サーバー起動: http://localhost:${PORT}`));
