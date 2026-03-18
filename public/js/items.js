if (!getToken() && !location.pathname.includes('index')) {
  location.href = '/index.html';
}

const API = '/api/items';
const authHeader = () => ({ 'Authorization': `Bearer ${getToken()}` });

// ══════════════════════════════════════════════
// HOME PAGE
// ══════════════════════════════════════════════
let currentPage = 1;

async function searchItems(page = 1) {
  currentPage = page;
  const q = document.getElementById('searchInput')?.value.trim() || '';

  const params = new URLSearchParams({ page, limit: 12 });
  if (q) params.append('q', q);

  const grid = document.getElementById('itemsGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="loading">読み込み中…</div>';

  try {
    const res  = await fetch(`${API}?${params}`);
    const data = await res.json();
    renderItems(data.items);
    renderPagination(data.pages, page);
  } catch {
    grid.innerHTML = '<div class="loading">読み込みに失敗しました</div>';
  }
}

function renderItems(items) {
  const grid = document.getElementById('itemsGrid');
  if (!items.length) {
    grid.innerHTML = '<div class="empty-state">😢 アイテムが見つかりませんでした</div>';
    return;
  }
  grid.innerHTML = items.map(item => `
    <a href="/item-detail.html?id=${item._id}" class="item-card">
      <div class="item-img">
        ${item.images?.[0]
          ? `<img src="${item.images[0]}" alt="${item.title}" loading="lazy">`
          : '<div class="no-img">🎮</div>'}
      </div>
      <div class="item-info">
        <div class="item-title">${item.title}</div>
        ${item.tags?.length
          ? `<div class="item-tags">${item.tags.slice(0,3).map(t=>`<span class="tag">#${t}</span>`).join('')}</div>`
          : ''}
        ${item.wantTitle
          ? `<div class="item-want">🔄 ${item.wantTitle}</div>`
          : ''}
        <div class="item-owner">
          <span class="owner-name">@${item.owner?.username || '?'}</span>
          <span class="owner-rating">⭐ ${item.owner?.rating?.toFixed(1) || '-'}</span>
        </div>
      </div>
    </a>
  `).join('');
}

function renderPagination(pages, current) {
  const el = document.getElementById('pagination');
  if (!el || pages <= 1) { if (el) el.innerHTML = ''; return; }
  let html = '';
  for (let i = 1; i <= pages; i++) {
    html += `<button class="page-btn ${i === current ? 'active' : ''}"
      onclick="searchItems(${i})">${i}</button>`;
  }
  el.innerHTML = html;
}

// ══════════════════════════════════════════════
// POST ITEM PAGE
// ══════════════════════════════════════════════

// 選択中のファイルを管理する配列
let selectedFiles = [];

function previewImages(event) {
  const newFiles = Array.from(event.target.files);
  // 既存 + 新規で最大5枚
  selectedFiles = [...selectedFiles, ...newFiles].slice(0, 5);
  // inputをリセット（同じファイルを再選択できるように）
  event.target.value = '';
  renderPreviews();
}

function renderPreviews() {
  const list = document.getElementById('imagePreviewList');
  if (!list) return;
  list.innerHTML = '';

  // FileReaderは非同期なので順番がずれないようPromise.allで処理
  const promises = selectedFiles.map((file, i) => new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => resolve({ dataUrl: e.target.result, index: i });
    reader.readAsDataURL(file);
  }));

  Promise.all(promises).then(results => {
    list.innerHTML = '';
    results.forEach(({ dataUrl, index }) => {
      const wrap = document.createElement('div');
      wrap.className = 'preview-img-wrap';
      wrap.style.cssText = 'position:relative;display:inline-block;';
      wrap.innerHTML = `
        <img src="${dataUrl}" alt="preview${index}"
          style="width:80px;height:80px;object-fit:cover;border-radius:8px;display:block;border:2px solid var(--border);">
        <button onclick="removeImage(${index})"
          title="この画像を削除"
          style="
            position:absolute;top:-7px;right:-7px;
            width:22px;height:22px;border-radius:50%;
            background:var(--danger);color:#fff;
            border:2px solid #fff;cursor:pointer;font-size:13px;
            display:flex;align-items:center;justify-content:center;
            line-height:1;padding:0;font-weight:bold;
            box-shadow:0 2px 6px rgba(0,0,0,0.2);
          ">×</button>`;
      list.appendChild(wrap);
    });
  });
}

function removeImage(index) {
  selectedFiles.splice(index, 1);
  renderPreviews();
}

async function postItem() {
  const title       = document.getElementById('title')?.value.trim();
  const description = document.getElementById('description')?.value.trim();
  const wantTitle   = document.getElementById('wantTitle')?.value.trim();
  const errEl       = document.getElementById('postError');
  errEl.textContent = '';

  if (!title) { errEl.textContent = 'アイテム名は必須です'; return; }

  const formData = new FormData();
  formData.append('title', title);
  if (description) formData.append('description', description);
  if (wantTitle)   formData.append('wantTitle', wantTitle);

  selectedFiles.slice(0, 5).forEach(f => formData.append('images', f));

  try {
    const res  = await fetch(API, {
      method: 'POST',
      headers: authHeader(),
      body: formData
    });
    const data = await res.json();
    if (!res.ok) {
      errEl.textContent = data.errors?.[0]?.msg || data.message || '投稿失敗';
      return;
    }
    location.href = '/home.html'; // 出品後はホームへ
  } catch {
    errEl.textContent = '通信エラー';
  }
}

// ══════════════════════════════════════════════
// ITEM DETAIL PAGE
// ══════════════════════════════════════════════
async function loadItemDetail() {
  const main = document.getElementById('detailMain');
  if (!main) return;

  const id = new URLSearchParams(location.search).get('id');
  if (!id) { main.innerHTML = '<div class="loading">IDが不正です</div>'; return; }

  try {
    const res  = await fetch(`${API}/${id}`);
    const item = await res.json();
    if (!res.ok) {
      main.innerHTML = '<div class="loading">見つかりませんでした</div>';
      return;
    }

    const meRes  = await fetch('/api/auth/me', { headers: authHeader() });
    const me     = meRes.ok ? await meRes.json() : null;
    const isOwner = me && item.owner?._id === me._id;

    const imgHtml = item.images?.length
      ? `<div class="detail-imgs">
          <img src="${item.images[0]}" class="detail-main-img" id="mainImg" alt="${item.title}">
          ${item.images.length > 1
            ? `<div class="detail-thumbs">${item.images.map((img, i) =>
                `<img src="${img}" onclick="document.getElementById('mainImg').src='${img}'"
                  class="${i===0?'active':''}">`
              ).join('')}</div>`
            : ''}
        </div>`
      : `<div class="detail-imgs"><div class="no-img-large">🎮</div></div>`;

    main.innerHTML = `
      <button class="btn-sm btn-outline back-btn" onclick="history.back()">← 戻る</button>
      <div class="detail-grid">
        ${imgHtml}
        <div class="detail-info">
          <h1 class="detail-title">${item.title}</h1>
          <div class="detail-status status-${item.status==='募集中'?'open':'closed'}">${item.status}</div>
          ${item.description
            ? `<p class="detail-desc">${item.description.replace(/\n/g,'<br>').replace(
                /#([\w\u3040-\u9fff]+)/g,
                '<span class="tag clickable" onclick="location.href=\'/home.html?q=%23$1\'">#$1</span>'
              )}</p>`
            : ''}
          ${item.wantTitle
            ? `<div class="detail-want">🔄 求めるもの：<strong>${item.wantTitle}</strong></div>`
            : ''}
          ${item.tags?.length
            ? `<div class="detail-tags">${item.tags.map(t=>
                `<span class="tag clickable" onclick="location.href='/home.html?q=%23${t}'">#${t}</span>`
              ).join('')}</div>`
            : ''}

          <div class="detail-owner-card">
            <div class="owner-avatar">${item.owner?.username?.[0]?.toUpperCase()||'?'}</div>
            <div>
              <div class="owner-name">@${item.owner?.username||'?'}</div>
              <div class="owner-rating">⭐ ${item.owner?.rating?.toFixed(1)||'-'}
                (${item.owner?.ratingCount||0}件)</div>
            </div>
          </div>

          <div class="detail-actions">
            ${isOwner
              ? `<button class="btn-sm btn-outline" onclick="deleteItem('${item._id}')">🗑 削除</button>`
              : item.status === '募集中'
                ? `<button class="btn-primary"
                    onclick="location.href='/exchange.html?id=${item._id}'">🔄 交換を申請する</button>
                   <button class="btn-sm btn-outline"
                    onclick="location.href='/messages.html?to=${item.owner?._id}'">💬 メッセージ</button>`
                : `<div class="closed-note">このアイテムは現在交換受付中ではありません</div>`
            }
          </div>
        </div>
      </div>

      <!-- コメントセクション -->
      <div class="comment-section">
        <div class="comment-title">💬 コメント <span class="comment-count" id="commentCount"></span></div>
        <div class="comment-list" id="commentList">
          <div class="loading">読み込み中…</div>
        </div>
        <div class="comment-form">
          <textarea id="commentInput" placeholder="コメントを入力（300文字以内）" maxlength="300" rows="2"></textarea>
          <div class="comment-form-footer">
            <span class="comment-char" id="commentChar">0 / 300</span>
            <button class="btn-sm btn-accent" onclick="postComment('${item._id}')">送信</button>
          </div>
        </div>
      </div>`;
  } catch {
    main.innerHTML = '<div class="loading">読み込みに失敗しました</div>';
  }
}

// ── コメント読み込み ──────────────────────────
async function loadComments(itemId) {
  const list = document.getElementById('commentList');
  const countEl = document.getElementById('commentCount');
  if (!list) return;
  try {
    const myRes = await fetch('/api/auth/me', { headers: authHeader() });
    const me    = myRes.ok ? await myRes.json() : null;
    const res     = await fetch(`/api/comments/${itemId}`);
    const comments = await res.json();
    countEl.textContent = `(${comments.length})`;
    if (!comments.length) {
      list.innerHTML = '<div class="comment-empty">まだコメントはありません。最初のコメントを書いてみましょう！</div>';
      return;
    }
    list.innerHTML = comments.map(c => {
      const avatarHtml = c.author?.avatar
        ? `<img src="${c.author.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
        : (c.author?.username?.[0] || '?').toUpperCase();
      const isMyComment = me && c.author?._id === me._id;
      const date = new Date(c.createdAt).toLocaleDateString('ja-JP', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
      return `
        <div class="comment-item" id="comment-${c._id}">
          <div class="comment-avatar">${avatarHtml}</div>
          <div class="comment-body">
            <div class="comment-meta">
              <span class="comment-author">${c.author?.username || '不明'}</span>
              <span class="comment-date">${date}</span>
              ${isMyComment ? `<button class="comment-delete-btn" onclick="deleteComment('${c._id}','${itemId}')">削除</button>` : ''}
            </div>
            <div class="comment-text">${c.text.replace(/
/g,'<br>').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
          </div>
        </div>`;
    }).join('');
  } catch {
    list.innerHTML = '<div class="comment-empty">コメントの読み込みに失敗しました</div>';
  }
}

// ── コメント投稿 ──────────────────────────────
async function postComment(itemId) {
  const input = document.getElementById('commentInput');
  const text  = input.value.trim();
  if (!text) return;
  try {
    const res = await fetch(`/api/comments/${itemId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ text })
    });
    const data = await res.json();
    if (!res.ok) { alert(data.message || '投稿に失敗しました'); return; }
    input.value = '';
    document.getElementById('commentChar').textContent = '0 / 300';
    loadComments(itemId);
  } catch { alert('通信エラーが発生しました'); }
}

// ── コメント削除 ──────────────────────────────
async function deleteComment(commentId, itemId) {
  if (!confirm('コメントを削除しますか？')) return;
  try {
    const res = await fetch(`/api/comments/${commentId}`, {
      method: 'DELETE', headers: authHeader()
    });
    if (res.ok) loadComments(itemId);
    else alert('削除に失敗しました');
  } catch { alert('通信エラーが発生しました'); }
}

async function deleteItem(id) {
  if (!confirm('本当に削除しますか？')) return;
  try {
    const res = await fetch(`${API}/${id}`, {
      method: 'DELETE',
      headers: authHeader()
    });
    if (res.ok) location.href = '/home.html';
    else alert('削除に失敗しました');
  } catch { alert('通信エラー'); }
}

// ── ページ判定して実行 ──────────────────────
if (document.getElementById('itemsGrid')) {
  // URLにqパラメータがあれば検索
  const urlQ = new URLSearchParams(location.search).get('q');
  if (urlQ) {
    document.getElementById('searchInput').value = urlQ;
  }
  searchItems();
}
if (document.getElementById('detailMain')) loadItemDetail();
if (document.getElementById('menuBtn')) {
  document.getElementById('menuBtn').addEventListener('click', () => {
    document.getElementById('sideMenu').classList.toggle('open');
    document.getElementById('overlay').classList.toggle('open');
  });
  document.getElementById('overlay').addEventListener('click', () => {
    document.getElementById('sideMenu').classList.remove('open');
    document.getElementById('overlay').classList.remove('open');
  });
}
