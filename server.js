require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const connectDB = require('./config/db');
const path      = require('path');

const app = express();
connectDB();

// ── ミドルウェア ──────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── 静的ファイル ──────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── ルーティング ──────────────────────────────
// BANチェック（認証が必要な全APIに適用）
const checkBan = require('./middleware/checkBan');
const authMiddleware = require('./middleware/auth');
app.use('/api', (req, res, next) => {
  // 認証不要なエンドポイントはスキップ
  const skipPaths = ['/api/auth/firebase', '/api/auth/register', '/api/auth/login', '/api/items'];
  if (skipPaths.some(p => req.path.startsWith(p)) && req.method === 'GET') return next();
  authMiddleware(req, res, (err) => {
    if (err) return next(); // 認証エラーは各ルートに任せる
    checkBan(req, res, next);
  });
});

app.use('/api/auth',          require('./routes/auth'));
app.use('/api/reports',       require('./routes/reports'));
app.use('/api/users',         require('./routes/users'));
app.use('/api/items',         require('./routes/items'));
app.use('/api/comments',      require('./routes/comments'));
app.use('/api/exchange',      require('./routes/exchange'));
app.use('/api/messages',      require('./routes/messages'));
app.use('/api/reviews',       require('./routes/reviews'));
app.use('/api/notifications', require('./routes/notifications'));

// ── SPAフォールバック ─────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 サーバー起動: http://localhost:${PORT}`));
