const API = '/api/items';
const authHeader = () => ({ 'Authorization': `Bearer ${getToken()}` });

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── 画像モーダル ──────────────────────────────
let modalImages = [];
let modalIndex  = 0;

function initImgModal() {
  if (document.getElementById('imgModal')) return;
  const modal = document.createElement('div');
  modal.id = 'imgModal';
  modal.className = 'img-modal';
  modal.innerHTML = `
    <button class="img-modal-close" onclick="closeImgModal()">✕</button>
    <button class="img-modal-prev" id="imgModalPrev" onclick="shiftModal(-1)">‹</button>
    <img id="imgModalImg" src="" alt="">
    <button class="img-modal-next" id="imgModalNext" onclick="shiftModal(1)">›</button>`;
  modal.addEventListener('click', e => { if (e.target === modal) closeImgModal(); });
  document.body.appendChild(modal);
  document.addEventListener('keydown', e => {
    if (!document.getElementById('imgModal')?.classList.contains('open')) return;
    if (e.key === 'Escape') closeImgModal();
    if (e.key === 'ArrowLeft')  shiftModal(-1);
    if (e.key === 'ArrowRight') shiftModal(1);
  });
}

function openImgModal(images, index = 0) {
  initImgModal();
  modalImages = Array.isArray(images) ? images : [images];
  modalIndex  = index;
  updateModalImg();
  document.getElementById('imgModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeImgModal() {
  document.getElementById('imgModal')?.classList.remove('open');
  document.body.style.overflow = '';
}

function shiftModal(dir) {
  modalIndex = (modalIndex + dir + modalImages.length) % modalImages.length;
  updateModalImg();
}

function updateModalImg() {
  document.getElementById('imgModalImg').src = modalImages[modalIndex];
  const prev = document.getElementById('imgModalPrev');
  const next = document.getElementById('imgModalNext');
  if (prev) prev.style.display = modalImages.length > 1 ? '' : 'none';
  if (next) next.style.display = modalImages.length > 1 ? '' : 'none';
}

// ── プロフィールリンク ────────────────────────
function goToProfile(userId) {
  if (userId) location.href = '/profile.html?id=' + userId;
}

// ── サムネイルクリック ────────────────────────
let currentThumbIndex = 0;
function setMainImg(src, index) {
  currentThumbIndex = index;
  const mainImg = document.getElementById('mainImg');
  if (mainImg) mainImg.src = src;
  // アクティブクラス更新
  document.querySelectorAll('.detail-thumbs img').forEach((el, i) => {
    el.classList.toggle('active', i === index);
  });
}

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
    const isOwner = me && String(item.owner?._id || '') === String(me._id || '');

    const imgList = item.images || [];
    const imgsJson = JSON.stringify(imgList).replace(/"/g, '&quot;');
    const imgHtml = imgList.length
      ? `<div class="detail-imgs">
          <img src="${imgList[0]}" class="detail-main-img zoomable" id="mainImg" alt="${item.title}"
            onclick="openImgModal(${imgsJson}, currentThumbIndex || 0)">
          ${imgList.length > 1
            ? `<div class="detail-thumbs">${imgList.map((img, i) =>
                `<img src="${img}" class="zoomable ${i===0?'active':''}"
                  onclick="setMainImg('${img}',${i})">`
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

          <div class="detail-owner-card user-link" onclick="goToProfile('${item.owner?._id}')">
            <div class="owner-avatar">${item.owner?.username?.[0]?.toUpperCase()||'?'}</div>
            <div>
              <div class="owner-name">@${item.owner?.username||'?'}</div>
              <div class="owner-rating">⭐ ${item.owner?.rating?.toFixed(1)||'-'}
                (${item.owner?.ratingCount||0}件)</div>
            </div>
          </div>

          <div class="detail-actions">
            ${isOwner
              ? `<div style="display:flex;gap:8px">
                  <button class="btn-primary" onclick="openEditForm('${item._id}')">✏️ 編集</button>
                  <button class="btn-sm btn-outline" onclick="deleteItem('${item._id}')">🗑 削除</button>
                </div>`
              : item.status === '募集中'
                ? `<button class="btn-primary"
                    onclick="location.href='/exchange.html?id=${item._id}'">🔄 交換を申請する</button>
                   <button class="btn-sm btn-outline"
                    onclick="location.href='/messages.html?to=${item.owner?._id}'">💬 メッセージ</button>`
                : `<div class="closed-note">このアイテムは現在交換受付中ではありません</div>`
            }
          </div>

          <!-- 編集フォーム（初期非表示） -->
          <div id="editItemForm" style="display:none;margin-top:20px;padding-top:20px;border-top:2px solid var(--border)">
            <div style="font-size:15px;font-weight:900;margin-bottom:16px">✏️ 出品内容を編集</div>
            <div class="form-group">
              <label style="font-size:13px;color:var(--text-sub);display:block;margin-bottom:6px">アイテム名 <span style="color:var(--accent2)">*</span></label>
              <input type="text" id="editTitle" value="${item.title}"
                style="width:100%;padding:10px 14px;background:var(--bg);border:1.5px solid var(--border);border-radius:8px;color:var(--text);font-size:14px;outline:none;">
            </div>
            <div class="form-group" style="margin-top:12px">
              <label style="font-size:13px;color:var(--text-sub);display:block;margin-bottom:6px">説明・#タグ</label>
              <textarea id="editDescription" rows="4"
                style="width:100%;padding:10px 14px;background:var(--bg);border:1.5px solid var(--border);border-radius:8px;color:var(--text);font-size:14px;resize:vertical;font-family:inherit;outline:none;">${item.description || ''}</textarea>
            </div>
            <div class="form-group" style="margin-top:12px">
              <label style="font-size:13px;color:var(--text-sub);display:block;margin-bottom:6px">🔄 求めるアイテム名</label>
              <input type="text" id="editWantTitle" value="${item.wantTitle || ''}"
                style="width:100%;padding:10px 14px;background:var(--bg);border:1.5px solid var(--border);border-radius:8px;color:var(--text);font-size:14px;outline:none;">
            </div>
            <div class="form-group" style="margin-top:12px">
              <label style="font-size:13px;color:var(--text-sub);display:block;margin-bottom:6px">画像を追加（既存の画像は保持されます）</label>
              <div style="border:2px dashed var(--border);border-radius:8px;padding:20px;text-align:center;cursor:pointer;color:var(--text-sub);"
                onclick="document.getElementById('editImageInput').click()">
                📷 クリックして画像を追加（最大5枚）
              </div>
              <input type="file" id="editImageInput" accept="image/*" multiple style="display:none" onchange="previewEditImages(event)">
              <div id="editImagePreview" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"></div>
            </div>
            <div style="color:var(--danger);font-size:13px;margin-bottom:10px" id="editError"></div>
            <div style="display:flex;gap:8px;margin-top:16px">
              <button class="btn-primary" onclick="saveEditItem('${item._id}')">保存する</button>
              <button class="btn-sm btn-outline" style="flex:1;padding:12px" onclick="closeEditForm()">キャンセル</button>
            </div>
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
    loadComments(id);
    const ci = document.getElementById("commentInput");
    const cc = document.getElementById("commentChar");
    if (ci && cc) {
      ci.addEventListener("input", () => { cc.textContent = ci.value.length + " / 300"; cc.style.color = ci.value.length > 280 ? "var(--danger)" : "var(--text-sub)"; });
      ci.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); postComment(id); } });
    }
  } catch {
    main.innerHTML = '<div class="loading">読み込みに失敗しました</div>';
  }
}

// ── 編集フォーム操作 ──────────────────────────
let editSelectedFiles = [];

function openEditForm(id) {
  document.getElementById('editItemForm').style.display = '';
  document.getElementById('editItemForm').scrollIntoView({ behavior: 'smooth' });
}

function closeEditForm() {
  document.getElementById('editItemForm').style.display = 'none';
  editSelectedFiles = [];
  document.getElementById('editImagePreview').innerHTML = '';
}

function previewEditImages(event) {
  const newFiles = Array.from(event.target.files);
  editSelectedFiles = [...editSelectedFiles, ...newFiles].slice(0, 5);
  event.target.value = '';
  const preview = document.getElementById('editImagePreview');
  preview.innerHTML = '';
  editSelectedFiles.forEach((file, i) => {
    const reader = new FileReader();
    reader.onload = e => {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:relative;display:inline-block;';
      wrap.innerHTML = `
        <img src="${e.target.result}" style="width:70px;height:70px;object-fit:cover;border-radius:8px;display:block;border:2px solid var(--border);">
        <button onclick="removeEditImage(${i})" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:var(--danger);color:#fff;border:2px solid #fff;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;padding:0;font-weight:bold;">×</button>`;
      preview.appendChild(wrap);
    };
    reader.readAsDataURL(file);
  });
}

function removeEditImage(index) {
  editSelectedFiles.splice(index, 1);
  previewEditImages({ target: { files: [], value: '' } });
}

async function saveEditItem(itemId) {
  const title       = document.getElementById('editTitle').value.trim();
  const description = document.getElementById('editDescription').value.trim();
  const wantTitle   = document.getElementById('editWantTitle').value.trim();
  const errEl       = document.getElementById('editError');
  errEl.textContent = '';

  if (!title) { errEl.textContent = 'アイテム名は必須です'; return; }

  const formData = new FormData();
  formData.append('title', title);
  if (description) formData.append('description', description);
  if (wantTitle)   formData.append('wantTitle', wantTitle);
  editSelectedFiles.forEach(f => formData.append('images', f));

  try {
    const res  = await fetch(`/api/items/${itemId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.message || '保存に失敗しました'; return; }
    alert('✅ 保存しました！');
    location.reload();
  } catch {
    errEl.textContent = '通信エラーが発生しました';
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
    const data    = await res.json();
    if (!res.ok) {
      list.innerHTML = `<div class="comment-empty">読み込みエラー：${data.message || res.status}</div>`;
      return;
    }
    const comments = Array.isArray(data) ? data : [];
    countEl.textContent = `(${comments.length})`;
    if (!comments.length) {
      list.innerHTML = '<div class="comment-empty">💬 まだコメントはありません。質問をしよう！</div>';
      return;
    }
    list.innerHTML = comments.map(c => {
      const avatarHtml = c.author?.avatar
        ? `<img src="${c.author.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
        : (c.author?.username?.[0] || '?').toUpperCase();
      const isMyComment = me && String(c.author?._id || '') === String(me._id || '');
      const date = new Date(c.createdAt).toLocaleDateString('ja-JP', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
      return `
        <div class="comment-item" id="comment-${c._id}">
          <div class="comment-avatar user-link" onclick="goToProfile('${c.author?._id}')">${avatarHtml}</div>
          <div class="comment-body">
            <div class="comment-meta">
              <span class="comment-author user-link" onclick="goToProfile('${c.author?._id}')">${c.author?.username || '不明'}</span>
              <span class="comment-date">${date}</span>
              ${isMyComment ? `<button class="comment-delete-btn" onclick="deleteComment('${c._id}','${itemId}')">削除</button>` : ''}
            </div>
            <div class="comment-text">${escHtml(c.text).replace(/\n/g,'<br>')}</div>
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    list.innerHTML = `<div class="comment-empty">コメントの読み込みに失敗しました：${err.message}</div>`;
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
