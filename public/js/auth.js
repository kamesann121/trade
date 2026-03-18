// ── トークン管理 ────────────────────────────
const TOKEN_KEY  = 'gt_token';
const getToken   = () => localStorage.getItem(TOKEN_KEY);
const setToken   = (t) => localStorage.setItem(TOKEN_KEY, t);
const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// ── JWTの有効期限チェック ────────────────────
function isTokenValid() {
  const token = getToken();
  if (!token) return false;
  try {
    // JWTの形式チェックのみ（3つのパートがあるか）
    const parts = token.split('.');
    if (parts.length !== 3) { clearToken(); return false; }
    JSON.parse(atob(parts[1])); // パースできるか確認
    return true;
  } catch (e) {
    clearToken();
    return false;
  }
}

// ── ページ振り分け ───────────────────────────
const publicPages = ['/index.html', '/'];
const isPublicPage = publicPages.some(p =>
  location.pathname === p
);

if (isPublicPage) {
  // トップページ：ログイン済みなら home へ
  if (isTokenValid()) {
    location.href = '/home.html';
  }
} else {
  // その他：未ログインならトップへ
  if (!isTokenValid()) {
    clearToken();
    location.href = '/index.html';
  }
}

// ── ログアウト ──────────────────────────────
function logout() {
  clearToken();
  location.href = '/index.html';
}

// ── サイドメニュー ──────────────────────────
function initSideMenu() {
  const menuBtn = document.getElementById('menuBtn');
  const sideMenu = document.getElementById('sideMenu');
  const overlay  = document.getElementById('overlay');

  if (!menuBtn) return; // メニューがないページはスキップ

  // 重複登録防止
  const newBtn = menuBtn.cloneNode(true);
  menuBtn.parentNode.replaceChild(newBtn, menuBtn);

  newBtn.addEventListener('click', () => {
    sideMenu?.classList.toggle('open');
    overlay?.classList.toggle('open');
  });

  overlay?.addEventListener('click', () => {
    sideMenu?.classList.remove('open');
    overlay?.classList.remove('open');
  });
}

// DOMの状態に関係なく確実に実行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSideMenu);
} else {
  initSideMenu();
}

// ── レビュー強制表示（全ページ共通） ────────────
function checkPendingReview() {
  // index.htmlでは表示しない
  if (location.pathname === '/' || location.pathname.endsWith('/index.html')) return;

  const pending = localStorage.getItem('pending_review');
  if (!pending) return;

  const data = JSON.parse(pending);

  // すでにモーダルがあれば作らない
  if (document.getElementById('pendingReviewModal')) return;

  const modal = document.createElement('div');
  modal.id = 'pendingReviewModal';
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:2000;
    display:flex;align-items:center;justify-content:center;
  `;
  modal.innerHTML = `
    <div style="background:var(--card);border:1.5px solid var(--border);border-radius:var(--radius);
      padding:28px;width:100%;max-width:420px;margin:16px;box-shadow:0 8px 40px rgba(0,0,0,0.3)">
      <div style="font-size:32px;text-align:center;margin-bottom:12px">⭐</div>
      <h3 style="font-size:18px;font-weight:900;text-align:center;margin-bottom:8px">取引完了！レビューをお願いします</h3>
      <p style="font-size:13px;color:var(--text-sub);text-align:center;line-height:1.7;margin-bottom:20px">
        <strong>${data.partnerName}</strong> さんとの取引が完了しました。<br>
        レビューを送ってこのダイアログを閉じてください。
      </p>
      <div style="display:flex;justify-content:center;gap:8px;margin-bottom:16px" id="prStarRow">
        ${[1,2,3,4,5].map(n => `<span style="font-size:36px;cursor:pointer" onclick="setPrStar(${n})">☆</span>`).join('')}
      </div>
      <textarea id="prComment" placeholder="コメント（任意）" rows="3"
        style="width:100%;padding:10px 14px;background:var(--bg);border:1.5px solid var(--border);
        border-radius:8px;color:var(--text);font-size:14px;resize:none;font-family:inherit;outline:none;margin-bottom:12px"></textarea>
      <div style="color:var(--danger);font-size:13px;margin-bottom:8px" id="prError"></div>
      <button onclick="submitPendingReview()" style="width:100%;padding:12px;background:linear-gradient(135deg,var(--accent),var(--accent2));
        border:none;border-radius:8px;color:#fff;font-size:15px;font-weight:700;cursor:pointer;margin-bottom:8px">
        レビューを送る
      </button>
      <button onclick="skipPendingReview()" style="width:100%;padding:8px;background:none;border:1.5px solid var(--border);
        border-radius:8px;color:var(--text-sub);font-size:13px;cursor:pointer">
        後で送る（次回また表示されます）
      </button>
    </div>`;
  document.body.appendChild(modal);
}

let prStars = 0;
function setPrStar(n) {
  prStars = n;
  const stars = document.querySelectorAll('#prStarRow span');
  stars.forEach((s, i) => s.textContent = i < n ? '⭐' : '☆');
}

async function submitPendingReview() {
  const errEl = document.getElementById('prError');
  errEl.textContent = '';
  if (!prStars) { errEl.textContent = '星を選んでください'; return; }

  const data    = JSON.parse(localStorage.getItem('pending_review'));
  const comment = document.getElementById('prComment').value.trim();

  try {
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({
        reviewee:   data.partnerId,
        exchangeId: data.exchangeId,
        rating:     prStars,
        comment
      })
    });
    const result = await res.json();
    if (!res.ok) { errEl.textContent = result.message || '送信に失敗しました'; return; }

    localStorage.removeItem('pending_review');
    document.getElementById('pendingReviewModal')?.remove();
    alert('✅ レビューを送りました！');
  } catch {
    errEl.textContent = '通信エラーが発生しました';
  }
}

function skipPendingReview() {
  document.getElementById('pendingReviewModal')?.remove();
  // 次回ページ遷移時にまた表示される（localStorageは消さない）
}

// DOM読み込み後にチェック
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkPendingReview);
} else {
  checkPendingReview();
}

// ── 画像ビューワー（全ページ共通） ────────────
function openImgViewer(src) {
  let overlay = document.getElementById('imgViewerOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'imgViewerOverlay';
    overlay.className = 'img-viewer-overlay';
    overlay.innerHTML = `
      <button class="img-viewer-close" onclick="closeImgViewer()">✕</button>
      <img id="imgViewerImg" src="" alt="preview">`;
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeImgViewer();
    });
    document.body.appendChild(overlay);
  }
  document.getElementById('imgViewerImg').src = src;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeImgViewer() {
  const overlay = document.getElementById('imgViewerOverlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}
// ESCキーで閉じる
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeImgViewer();
});
