// ── 通知バッジ更新（全ページ共通） ────────────
async function updateNotifBadge() {
  const badge = document.getElementById('notifBadge');
  if (!badge) return;
  try {
    const res  = await fetch('/api/notifications/unread', {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    if (!res.ok) return;
    const { count } = await res.json();
    badge.textContent = count;
    badge.style.display = count > 0 ? '' : 'none';
  } catch {}
}

// ── 通知ページの読み込み ──────────────────────
async function loadNotifications() {
  const list = document.getElementById('notifList');
  if (!list) return;
  try {
    const res   = await fetch('/api/notifications', {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    const notifs = await res.json();

    if (!Array.isArray(notifs) || !notifs.length) {
      list.innerHTML = '<div class="empty-state"><div style="font-size:48px;margin-bottom:12px">🔔</div>通知はありません</div>';
      return;
    }

    const typeIcon = { exchange: '🔄', dm: '💬', review: '⭐' };

    list.innerHTML = notifs.map((n, i) => `
      <div class="notif-item ${n.read ? '' : 'unread'}" onclick="readNotif(${i}, '${n.link || ''}')">
        <div class="notif-type-icon">${typeIcon[n.type] || '🔔'}</div>
        <div class="notif-body">
          <div class="notif-msg">${n.message}</div>
          <div class="notif-time">${new Date(n.createdAt).toLocaleString('ja-JP', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}</div>
        </div>
        ${!n.read ? '<div class="notif-dot"></div>' : ''}
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = `<div class="empty-state">読み込みに失敗しました</div>`;
  }
}

async function readNotif(index, link) {
  try {
    await fetch(`/api/notifications/${index}/read`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${getToken()}` }
    });
  } catch {}
  if (link) location.href = link;
}

async function markAllRead() {
  try {
    await fetch('/api/notifications/read-all', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    loadNotifications();
  } catch {}
}

// ページ判定
if (document.getElementById('notifList')) {
  loadNotifications();
}
updateNotifBadge();
setInterval(updateNotifBadge, 30000);
