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
