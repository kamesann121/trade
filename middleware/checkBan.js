const User = require('../models/User');

const checkBan = async (req, res, next) => {
  try {
    if (!req.user?.id) return next();
    const user = await User.findById(req.user.id).select('isBanned banUntil banReason');
    if (!user) return next();

    if (user.isBanned) {
      if (!user.banUntil || new Date() < user.banUntil) {
        const until = user.banUntil
          ? `${new Date(user.banUntil).toLocaleString('ja-JP')}まで`
          : '永久';
        return res.status(403).json({
          message: `アカウントが停止されています（${until}）`,
          reason: user.banReason || '',
          banned: true
        });
      } else {
        // 期間が過ぎたら自動解除
        await User.findByIdAndUpdate(req.user.id, { isBanned: false, banUntil: null });
      }
    }
    next();
  } catch (err) {
    next();
  }
};

module.exports = checkBan;
