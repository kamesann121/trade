const jwt  = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'ログインが必要です' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);

    // BANチェック
    const user = await User.findById(req.user.id).select('isBanned banUntil banReason');
    if (user?.isBanned) {
      if (!user.banUntil || new Date() < user.banUntil) {
        const until = user.banUntil
          ? new Date(user.banUntil).toLocaleString('ja-JP') + 'まで'
          : '永久';
        return res.status(403).json({
          message: `アカウントが停止されています（${until}）`,
          reason: user.banReason || '',
          banned: true
        });
      } else {
        // 期限切れなら自動解除
        await User.findByIdAndUpdate(req.user.id, { isBanned: false, banUntil: null });
      }
    }

    next();
  } catch {
    res.status(401).json({ message: 'トークンが無効です' });
  }
};

module.exports = authMiddleware;
