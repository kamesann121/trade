const express = require('express');
const router  = express.Router();
const Contact = require('../models/Contact');

// ── チャット開始 or メッセージ送信 ────────────
router.post('/', async (req, res) => {
  try {
    const { email, message } = req.body;
    if (!email || !message)
      return res.status(400).json({ message: 'メールアドレスとメッセージを入力してください' });

    // 同じメールで既存のチャットがあれば追記、なければ新規作成
    let contact = await Contact.findOne({ email: email.toLowerCase() });
    if (!contact) {
      contact = await Contact.create({
        email: email.toLowerCase(),
        messages: [{ text: message, isAdmin: false }],
        read: false
      });
    } else {
      contact.messages.push({ text: message, isAdmin: false });
      contact.read = false; // 新メッセージで未読に戻す
      await contact.save();
    }

    res.json({ message: '送信しました', contactId: contact._id });
  } catch (err) {
    res.status(500).json({ message: 'サーバーエラー', error: err.message });
  }
});

// ── メール指定でチャット履歴取得 ──────────────
router.get('/', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: 'メールアドレスを入力してください' });
    const contact = await Contact.findOne({ email: email.toLowerCase() });
    if (!contact) return res.json({ messages: [] });
    res.json({ messages: contact.messages, contactId: contact._id });
  } catch {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

module.exports = router;
