const express  = require('express');
const router   = express.Router();
const Contact  = require('./models/Contact');

router.post('/', async (req, res) => {
  try {
    const { email, message } = req.body;
    if (!email || !message)
      return res.status(400).json({ message: 'メールアドレスとお問い合わせ内容を入力してください' });
    await Contact.create({ email, message });
    res.json({ message: '送信しました' });
  } catch {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

module.exports = router;
