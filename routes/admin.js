const express = require('express');
const router  = express.Router();
const adminAuth = require('../middleware/adminAuth');
const User    = require('../models/User');
const Report  = require('../models/Report');
const Item    = require('../models/Item');
const ExchangeRequest = require('../models/ExchangeRequest');
const Message = require('../models/Message');
const BadWord = require('../models/BadWord');
const Contact = require('../models/Contact');
const { invalidateCache } = require('../middleware/filterBadWords');

// ── ユーザー一覧・検索 ────────────────────────
router.get('/users', adminAuth, async (req, res) => {
  try {
    const { q, page = 1 } = req.query;
    const limit  = 20;
    const filter = q ? { username: new RegExp(q, 'i') } : {};
    const total  = await User.countDocuments(filter);
    const users  = await User.find(filter)
      .select('username email avatar isBanned banUntil banReason reportCount isAdmin createdAt')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit).limit(limit);
    res.json({ users, total, pages: Math.ceil(total / limit) });
  } catch { res.status(500).json({ message: 'サーバーエラー' }); }
});

// ── BAN操作 ───────────────────────────────────
router.put('/users/:id/ban', adminAuth, async (req, res) => {
  try {
    const { duration, reason } = req.body;
    // duration: 'temp48h' | 'temp1w' | 'permanent' | 'unban'
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'ユーザーが見つかりません' });

    if (duration === 'unban') {
      user.isBanned  = false;
      user.banUntil  = null;
      user.banReason = '';
    } else if (duration === 'temp48h') {
      user.isBanned  = true;
      user.banUntil  = new Date(Date.now() + 48 * 60 * 60 * 1000);
      user.banReason = reason || '管理者による48時間停止';
    } else if (duration === 'temp1w') {
      user.isBanned  = true;
      user.banUntil  = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      user.banReason = reason || '管理者による1週間停止';
    } else if (duration === 'permanent') {
      user.isBanned  = true;
      user.banUntil  = null;
      user.banReason = reason || '管理者による永久停止';
    } else {
      return res.status(400).json({ message: '無効なdurationです' });
    }

    await user.save();
    res.json({ message: 'BANを更新しました', user });
  } catch { res.status(500).json({ message: 'サーバーエラー' }); }
});

// ── 通報一覧 ──────────────────────────────────
router.get('/reports', adminAuth, async (req, res) => {
  try {
    const { status = 'pending', page = 1 } = req.query;
    const limit   = 20;
    const filter  = status === 'all' ? {} : { status };
    const total   = await Report.countDocuments(filter);
    const reports = await Report.find(filter)
      .populate('reporter', 'username avatar')
      .populate('reported', 'username avatar isBanned reportCount')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit).limit(limit);
    res.json({ reports, total, pages: Math.ceil(total / limit) });
  } catch { res.status(500).json({ message: 'サーバーエラー' }); }
});

// ── 通報ステータス更新 ────────────────────────
router.put('/reports/:id', adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    await Report.findByIdAndUpdate(req.params.id, { status });
    res.json({ message: '更新しました' });
  } catch { res.status(500).json({ message: 'サーバーエラー' }); }
});

// ── 取引一覧 ──────────────────────────────────
router.get('/exchanges', adminAuth, async (req, res) => {
  try {
    const { status = 'accepted', page = 1 } = req.query;
    const limit   = 20;
    const filter  = status === 'all' ? {} : { status };
    const total   = await ExchangeRequest.countDocuments(filter);
    const exchanges = await ExchangeRequest.find(filter)
      .populate('requester', 'username avatar')
      .populate('owner',     'username avatar')
      .populate('targetItem','title images')
      .populate('offerItem', 'title images')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit).limit(limit);
    res.json({ exchanges, total, pages: Math.ceil(total / limit) });
  } catch { res.status(500).json({ message: 'サーバーエラー' }); }
});

// ── 取引強制終了 ──────────────────────────────
router.put('/exchanges/:id/force-end', adminAuth, async (req, res) => {
  try {
    const { reason } = req.body;
    const exchange = await ExchangeRequest.findById(req.params.id)
      .populate('requester').populate('owner')
      .populate('targetItem').populate('offerItem');
    if (!exchange) return res.status(404).json({ message: '取引が見つかりません' });

    exchange.status = 'cancelled';
    await exchange.save();

    // アイテムを募集中に戻す
    await Item.findByIdAndUpdate(exchange.targetItem?._id, { status: '募集中' });
    await Item.findByIdAndUpdate(exchange.offerItem?._id,  { status: '募集中' });

    // 両者に通知
    const msg = `管理者により取引が強制終了されました。${reason ? '理由：' + reason : ''}`;
    for (const user of [exchange.requester, exchange.owner]) {
      if (user?._id) {
        await User.findByIdAndUpdate(user._id, {
          $push: { notifications: { type: 'exchange', message: msg, link: '/my-exchanges.html', read: false, createdAt: new Date() } }
        });
      }
    }

    res.json({ message: '取引を強制終了しました' });
  } catch (err) { res.status(500).json({ message: 'サーバーエラー', error: err.message }); }
});

// ── 出品アイテム削除 ──────────────────────────
router.delete('/items/:id', adminAuth, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'アイテムが見つかりません' });
    await item.deleteOne();
    res.json({ message: '削除しました' });
  } catch { res.status(500).json({ message: 'サーバーエラー' }); }
});

// ── 統計情報 ──────────────────────────────────
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const [users, items, exchanges, reports] = await Promise.all([
      User.countDocuments(),
      Item.countDocuments(),
      ExchangeRequest.countDocuments({ status: 'accepted' }),
      Report.countDocuments({ status: 'pending' })
    ]);
    const banned = await User.countDocuments({ isBanned: true });
    res.json({ users, items, activeExchanges: exchanges, pendingReports: reports, banned });
  } catch { res.status(500).json({ message: 'サーバーエラー' }); }
});

// ── adminフラグ付与（初回セットアップ用） ──────
router.post('/setup', async (req, res) => {
  try {
    const { email, setupKey } = req.body;
    if (setupKey !== process.env.ADMIN_SETUP_KEY)
      return res.status(403).json({ message: 'セットアップキーが違います' });
    const user = await User.findOneAndUpdate(
      { email },
      { isAdmin: true },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: 'ユーザーが見つかりません' });
    res.json({ message: `${user.username} を管理者に設定しました` });
  } catch { res.status(500).json({ message: 'サーバーエラー' }); }
});

// ── 取引会話に管理者メッセージを送信 ──────────
router.post('/exchanges/:id/message', adminAuth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: 'メッセージを入力してください' });

    const exchange = await ExchangeRequest.findById(req.params.id);
    if (!exchange) return res.status(404).json({ message: '取引が見つかりません' });

    // 管理者ユーザーを取得（送信者として使用）
    const admin = await User.findById(req.user.id).select('_id username');

    // 取引の両者に同じメッセージを送る
    const convId = Message.makeConvId(
      exchange.requester.toString(),
      exchange.owner.toString()
    );

    // requesterへ
    await Message.create({
      conversationId: convId,
      sender:   admin._id,
      receiver: exchange.requester,
      text:     `【運営より】${text.trim()}`,
      read:     false
    });

    // ownerへ
    await Message.create({
      conversationId: convId,
      sender:   admin._id,
      receiver: exchange.owner,
      text:     `【運営より】${text.trim()}`,
      read:     false
    });

    // 両者に通知
    const notifMsg = `運営からメッセージが届きました`;
    for (const userId of [exchange.requester, exchange.owner]) {
      await User.findByIdAndUpdate(userId, {
        $push: { notifications: {
          type: 'dm', message: notifMsg,
          link: '/messages.html', read: false, createdAt: new Date()
        }}
      });
    }

    res.json({ message: '送信しました' });
  } catch (err) {
    res.status(500).json({ message: 'サーバーエラー', error: err.message });
  }
});

// ── 取引会話履歴を取得（管理者用） ──────────
router.get('/exchanges/:id/messages', adminAuth, async (req, res) => {
  try {
    const exchange = await ExchangeRequest.findById(req.params.id);
    if (!exchange) return res.status(404).json({ message: '取引が見つかりません' });

    const convId = Message.makeConvId(
      exchange.requester.toString(),
      exchange.owner.toString()
    );

    const messages = await Message.find({ conversationId: convId })
      .populate('sender', 'username avatar')
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch {
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

// ── 取引のメッセージ履歴取得 ──────────────────
router.get('/exchanges/:id/messages', adminAuth, async (req, res) => {
  try {
    const exchange = await ExchangeRequest.findById(req.params.id)
      .populate('requester', 'username avatar')
      .populate('owner',     'username avatar');
    if (!exchange) return res.status(404).json({ message: '取引が見つかりません' });

    const convId = Message.makeConvId(
      exchange.requester._id.toString(),
      exchange.owner._id.toString()
    );

    const messages = await Message.find({ conversationId: convId })
      .populate('sender', 'username avatar')
      .sort({ createdAt: 1 });

    res.json({ exchange, messages, convId });
  } catch (err) { res.status(500).json({ message: 'サーバーエラー', error: err.message }); }
});

// ── 管理者がメッセージ送信 ────────────────────
router.post('/exchanges/:id/messages', adminAuth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: 'メッセージを入力してください' });

    const exchange = await ExchangeRequest.findById(req.params.id)
      .populate('requester', 'username')
      .populate('owner',     'username');
    if (!exchange) return res.status(404).json({ message: '取引が見つかりません' });

    const adminUser = await User.findById(req.user.id).select('username');
    const convId = Message.makeConvId(
      exchange.requester._id.toString(),
      exchange.owner._id.toString()
    );

    // 管理者メッセージを両者に送信
    const msg = await Message.create({
      conversationId: convId,
      sender:   req.user.id,
      receiver: exchange.requester._id, // 便宜上requesterをreceiverに
      text:     `[運営] ${text.trim()}`,
      isAdmin:  true,
      senderName: adminUser.username
    });

    // 両者に通知
    const notifMsg = `運営からメッセージが届きました`;
    for (const uid of [exchange.requester._id, exchange.owner._id]) {
      await User.findByIdAndUpdate(uid, {
        $push: { notifications: { type: 'dm', message: notifMsg, link: '/messages.html', read: false, createdAt: new Date() } }
      });
    }

    res.status(201).json(msg);
  } catch (err) { res.status(500).json({ message: 'サーバーエラー', error: err.message }); }
});

// ── 禁句ワード一覧 ───────────────────────────
router.get('/badwords', adminAuth, async (req, res) => {
  try {
    const words = await BadWord.find().sort({ createdAt: -1 });
    res.json(words);
  } catch { res.status(500).json({ message: 'サーバーエラー' }); }
});

// ── 禁句ワード追加 ────────────────────────────
router.post('/badwords', adminAuth, async (req, res) => {
  try {
    const { word } = req.body;
    if (!word?.trim()) return res.status(400).json({ message: 'ワードを入力してください' });
    const bw = await BadWord.create({ word: word.trim().toLowerCase(), addedBy: req.user.id });
    invalidateCache();
    res.status(201).json(bw);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'すでに登録済みです' });
    res.status(500).json({ message: 'サーバーエラー' });
  }
});

// ── 禁句ワード削除 ────────────────────────────
router.delete('/badwords/:id', adminAuth, async (req, res) => {
  try {
    await BadWord.findByIdAndDelete(req.params.id);
    invalidateCache();
    res.json({ message: '削除しました' });
  } catch { res.status(500).json({ message: 'サーバーエラー' }); }
});

// ── お問い合わせ一覧 ──────────────────────────
router.get('/contacts', adminAuth, async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.json(contacts);
  } catch { res.status(500).json({ message: 'サーバーエラー' }); }
});

// ── お問い合わせ既読 ──────────────────────────
router.put('/contacts/:id/read', adminAuth, async (req, res) => {
  try {
    await Contact.findByIdAndUpdate(req.params.id, { read: true });
    res.json({ message: '既読にしました' });
  } catch { res.status(500).json({ message: 'サーバーエラー' }); }
});

// ── お問い合わせに返信 ────────────────────────
router.post('/contacts/:id/reply', adminAuth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: 'メッセージを入力してください' });
    const contact = await Contact.findById(req.params.id);
    if (!contact) return res.status(404).json({ message: '見つかりません' });
    contact.messages.push({ text: text.trim(), isAdmin: true });
    contact.read = true;
    await contact.save();
    res.json({ message: '返信しました' });
  } catch { res.status(500).json({ message: 'サーバーエラー' }); }
});

// ── お問い合わせ削除 ──────────────────────────
router.delete('/contacts/:id', adminAuth, async (req, res) => {
  try {
    await Contact.findByIdAndDelete(req.params.id);
    res.json({ message: '削除しました' });
  } catch { res.status(500).json({ message: 'サーバーエラー' }); }
});

// ── ユーザーのパスワード変更（管理者用） ──────
router.put('/users/:id/password', adminAuth, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ message: 'パスワードは6文字以上にしてください' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'ユーザーが見つかりません' });
    user.password = newPassword;
    await user.save();
    res.json({ message: 'パスワードを変更しました' });
  } catch { res.status(500).json({ message: 'サーバーエラー' }); }
});

// ── ユーザーのメールアドレス変更（管理者用） ──
router.put('/users/:id/email', adminAuth, async (req, res) => {
  try {
    const { newEmail } = req.body;
    if (!newEmail) return res.status(400).json({ message: 'メールアドレスを入力してください' });
    const existing = await User.findOne({ email: newEmail.toLowerCase() });
    if (existing) return res.status(400).json({ message: 'このメールアドレスはすでに使われています' });
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { email: newEmail.toLowerCase() },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: 'ユーザーが見つかりません' });
    res.json({ message: 'メールアドレスを変更しました' });
  } catch { res.status(500).json({ message: 'サーバーエラー' }); }
});

module.exports = router;
