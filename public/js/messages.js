const token  = () => localStorage.getItem('gt_token');
const header = () => ({ Authorization: `Bearer ${token()}` });

let currentUserId   = null;
let currentUserName = '';
let pollTimer       = null;

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function getMyId() {
  try { return JSON.parse(atob(token().split('.')[1])).id; } catch { return null; }
}

// ── 会話一覧読み込み ──────────────────────────
async function loadConversations() {
  const inner = document.getElementById('convListInner');
  if (!inner) return;
  try {
    const res  = await fetch('/api/messages/conversations', { headers: header() });
    const data = await res.json();

    if (!Array.isArray(data) || !data.length) {
      inner.innerHTML = '<div class="conv-empty">💬 まだメッセージはありません</div>';
      return;
    }

    const myId = getMyId();
    inner.innerHTML = data.map(msg => {
      const partner = String(msg.sender?._id) === myId ? msg.receiver : msg.sender;
      const avatarHtml = partner?.avatar
        ? `<img src="${partner.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
        : (partner?.username?.[0] || '?').toUpperCase();
      return `
        <div class="conv-item ${currentUserId === String(partner?._id) ? 'active' : ''}"
          onclick="openConv('${partner?._id}','${escHtml(partner?.username)}')">
          <div class="conv-avatar">${avatarHtml}</div>
          <div class="conv-info">
            <div class="conv-name">${escHtml(partner?.username || '不明')}</div>
            <div class="conv-last">${escHtml(msg.text || '')}</div>
          </div>
          ${msg.unreadCount > 0 ? `<div class="conv-unread">${msg.unreadCount}</div>` : ''}
        </div>`;
    }).join('');
  } catch {
    document.getElementById('convListInner').innerHTML = '<div class="conv-empty">読み込みに失敗しました</div>';
  }
}

// ── 会話を開く ────────────────────────────────
function openConv(userId, userName) {
  currentUserId   = userId;
  currentUserName = userName;
  clearInterval(pollTimer);

  const area   = document.getElementById('chatArea');
  const layout = document.querySelector('.dm-layout');

  area.innerHTML = `
    <div class="chat-header">
      <button class="chat-back-btn" onclick="closeConv()">←</button>
      <div class="conv-avatar" style="width:36px;height:36px;font-size:14px;flex-shrink:0">${(userName[0] || '?').toUpperCase()}</div>
      ${escHtml(userName)}
    </div>
    <div class="chat-messages" id="chatMsgs"></div>
    <div class="chat-input-area">
      <textarea id="msgInput" placeholder="メッセージを入力…" rows="1"
        onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMsg();}"></textarea>
      <button class="btn-sm btn-accent send-btn" onclick="sendMsg()">➤</button>
    </div>`;

  // モバイル：チャットエリアを表示
  if (layout) layout.classList.remove('no-conv');

  loadMessages();
  pollTimer = setInterval(loadMessages, 4000);
  loadConversations();
}

// ── 会話を閉じる（モバイル用） ────────────────
function closeConv() {
  currentUserId = null;
  clearInterval(pollTimer);
  const area   = document.getElementById('chatArea');
  const layout = document.querySelector('.dm-layout');
  area.innerHTML = '<div class="chat-placeholder"><span>👆 会話を選んでください</span></div>';
  if (layout) layout.classList.add('no-conv');
}

// ── メッセージ読み込み ────────────────────────
async function loadMessages() {
  const msgs = document.getElementById('chatMsgs');
  if (!msgs || !currentUserId) return;
  const myId = getMyId();
  try {
    const res  = await fetch(`/api/messages/${currentUserId}`, { headers: header() });
    const data = await res.json();
    if (!Array.isArray(data)) return;

    const wasAtBottom = msgs.scrollHeight - msgs.scrollTop <= msgs.clientHeight + 50;

    if (!data.length) {
      msgs.innerHTML = '<div class="chat-empty">まだメッセージはありません。最初のメッセージを送ってみましょう！</div>';
      return;
    }

    msgs.innerHTML = data.map(m => {
      const isMine = String(m.sender?._id || m.sender) === myId;
      const time   = new Date(m.createdAt).toLocaleTimeString('ja-JP', { hour:'2-digit', minute:'2-digit' });
      return `
        <div class="msg-row ${isMine ? 'mine' : 'theirs'}">
          ${!isMine ? `<div class="msg-avatar">${(m.sender?.username?.[0] || '?').toUpperCase()}</div>` : ''}
          <div class="msg-bubble">
            <div class="msg-text">${escHtml(m.text).replace(/\n/g,'<br>')}</div>
            <div class="msg-time">${time}</div>
          </div>
        </div>`;
    }).join('');

    if (wasAtBottom) msgs.scrollTop = msgs.scrollHeight;
  } catch {}
}

// ── メッセージ送信 ────────────────────────────
async function sendMsg() {
  const input = document.getElementById('msgInput');
  const text  = input?.value.trim();
  if (!text || !currentUserId) return;
  input.value = '';
  try {
    await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...header() },
      body: JSON.stringify({ receiverId: currentUserId, text })
    });
    loadMessages();
    loadConversations();
  } catch {}
}

// ── URLパラメータで自動オープン ───────────────
const toId = new URLSearchParams(location.search).get('to');
if (toId) {
  // 相手のユーザー情報を取得して会話を開く
  fetch(`/api/auth/me`, { headers: header() })
    .then(r => r.json())
    .then(() => {
      // ユーザー名を取得
      fetch(`/api/messages/${toId}`, { headers: header() })
        .then(r => r.json())
        .then(msgs => {
          if (Array.isArray(msgs) && msgs.length) {
            const partner = msgs[0].sender?._id === getMyId() ? msgs[0].receiver : msgs[0].sender;
            if (partner) openConv(String(partner._id), partner.username || '相手');
          } else {
            // メッセージがなくてもIDからユーザー名を探す
            openConv(toId, '相手');
          }
        });
    });
}

// ページ読み込み
if (document.getElementById('convListInner')) {
  // モバイルは最初に会話一覧だけ表示
  const layout = document.querySelector('.dm-layout');
  if (layout && window.innerWidth <= 640) {
    layout.classList.add('no-conv');
  }
  loadConversations();
}
