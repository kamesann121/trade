require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const path      = require('path');

const app = express();
connectDB();

// ── セキュリティヘッダー ──────────────────────
app.use(helmet({
  contentSecurityPolicy: false // Firebaseのインラインスクリプトと競合するためOFF
}));

// ── CORS（本番は自分のドメインだけ許可） ───────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORSポリシーにより拒否されました'));
    }
  },
  credentials: true
}));

// ── レートリミット ────────────────────────────

// ログイン・登録：1IPあたり15分で10回まで
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'しばらく時間をおいてから再試行してください' },
  standardHeaders: true,
  legacyHeaders: false
});

// 通報：1IPあたり1時間で20回まで
const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { message: '通報の送信回数が上限に達しました。しばらくお待ちください' },
  standardHeaders: true,
  legacyHeaders: false
});

// 出品：1IPあたり1時間で30回まで
const postLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { message: '出品の上限に達しました。しばらくお待ちください' },
  standardHeaders: true,
  legacyHeaders: false
});

// API全体：1IPあたり15分で300回まで
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
