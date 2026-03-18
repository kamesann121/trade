const jwt  = require('jsonwebtoken');
const User = require('../models/User');

const adminAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: '認証が必要です' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await User.findById(decoded.id).select('isAdmin isBanned');

    if (!user || !user.isAdmin)
      return res.status(403).json({ message: '管理者権限が必要です' });

    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: 'トークンが無効です' });
  }
};

module.exports = adminAuth;
