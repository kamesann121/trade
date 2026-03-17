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
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 > Date.now();
  } catch (e) {
    return false;
  }
}

// ── 全ページ共通：未ログインならトップへ ───
const publicPages = ['/index.html', '/'];
const isPublicPage = publicPages.some(p => location.pathname === p || location.pathname.endsWith(p));

if (!isTokenValid() && !isPublicPage) {
  clearToken();
  location.href = '/index.html';
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
  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      sideMenu?.classList.toggle('open');
      overlay?.classList.toggle('open');
    });
  }
  if (overlay) {
    overlay.addEventListener('click', () => {
      sideMenu?.classList.remove('open');
      overlay?.classList.remove('open');
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSideMenu);
} else {
  initSideMenu();
}
