// ── トークン管理 ────────────────────────────
const TOKEN_KEY  = 'gt_token';
const getToken   = () => localStorage.getItem(TOKEN_KEY);
const setToken   = (t) => localStorage.setItem(TOKEN_KEY, t);
const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// ── 全ページ共通：未ログインならトップへ ───
const publicPages = ['/index.html', '/'];
const isPublicPage = publicPages.some(p => location.pathname === p || location.pathname.endsWith(p));

if (!getToken() && !isPublicPage) {
  clearToken();
  location.href = '/index.html';
}

// ── ログアウト ──────────────────────────────
function logout() {
  clearToken();
  location.href = '/index.html';
}

// ── サイドメニュー ──────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('menuBtn')?.addEventListener('click', () => {
    document.getElementById('sideMenu')?.classList.toggle('open');
    document.getElementById('overlay')?.classList.toggle('open');
  });
  document.getElementById('overlay')?.addEventListener('click', () => {
    document.getElementById('sideMenu')?.classList.remove('open');
    document.getElementById('overlay')?.classList.remove('open');
  });
});
