require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const session    = require('express-session');
const passport   = require('./config/passport');
const connectDB  = require('./config/db');
const path       = require('path');

const app = express();
connectDB();

// ── ミドルウェア ──────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// ── 静的ファイル ──────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── ルーティング ──────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/items',      require('./routes/items'));
app.use('/api/exchange',   require('./routes/exchange'));
app.use('/api/messages',   require('./routes/messages'));
app.use('/api/reviews',    require('./routes/reviews'));
app.use('/api/notifications', require('./routes/notifications'));

// ── SPAフォールバック ─────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 サーバー起動: http://localhost:${PORT}`));
