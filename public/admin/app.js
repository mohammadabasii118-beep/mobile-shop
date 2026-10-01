import { h, icon, api, ApiError, clear, button, emptyState, errorState } from './ui.js';
import * as P from './pages.js';

const app = document.getElementById('app');

/* ---------- theme: explicit choice wins, otherwise follow the OS; data-theme is always set ---------- */
const THEME_KEY = 'vpn-admin-theme';
const savedTheme = () => { try { return localStorage.getItem(THEME_KEY); } catch { return null; } };
const osDark = matchMedia('(prefers-color-scheme: dark)');
const applyTheme = (t) => { document.documentElement.dataset.theme = t === 'dark' ? 'dark' : 'light'; };
applyTheme(savedTheme() || (osDark.matches ? 'dark' : 'light'));
osDark.addEventListener?.('change', (e) => { if (!savedTheme()) { applyTheme(e.matches ? 'dark' : 'light'); themeBtn?.replaceChildren(icon(effectiveDark() ? 'sun' : 'moon')); } });
const effectiveDark = () => document.documentElement.dataset.theme === 'dark';
function toggleTheme() {
  const next = effectiveDark() ? 'light' : 'dark';
  try { localStorage.setItem(THEME_KEY, next); } catch { /* storage unavailable */ }
  applyTheme(next);
  themeBtn?.replaceChildren(icon(effectiveDark() ? 'sun' : 'moon'));
}
let themeBtn;

/* ---------- routing: #/route?query ; filters/search/page live in the URL ---------- */
const NAV = [
  ['dashboard', 'داشبورد', 'dashboard', 'stats.view'], ['users', 'کاربران', 'users', 'users.view'], ['products', 'محصولات', 'box', 'products.manage'], ['categories', 'دسته‌بندی منو', 'folder', 'products.manage'],
  ['orders', 'سفارش‌ها', 'receipt', 'users.view'], ['payments', 'پرداخت‌ها', 'card', 'payments.view'], ['services', 'سرویس‌های VPN', 'shield', 'vpn.view'],
  ['coupons', 'کدهای تخفیف', 'ticket', 'coupons.manage'], ['support', 'پشتیبانی', 'headset', 'support.reply'], ['notifications', 'اعلان‌ها', 'bell', 'stats.view'],
  ['texts', 'متن‌های ربات', 'edit', 'texts.manage'], ['channels', 'کانال‌های اجباری', 'bell', 'settings.manage'], ['settings', 'تنظیمات', 'settings', 'settings.manage'], ['audit', 'Audit Logs', 'audit', 'audit.view'],
];
const PAGES = { dashboard: P.dashboard, users: P.users, products: P.products, categories: P.categories, orders: P.orders, payments: P.payments, services: P.services, coupons: P.coupons, support: P.support, notifications: P.notifications, settings: P.settings, texts: P.texts, channels: P.channels, audit: P.audit };
const parse = () => { const raw = location.hash.replace(/^#\/?/, ''); const [route, qs = ''] = raw.split('?'); return { route: route || 'dashboard', q: new URLSearchParams(qs) }; };
const ctx = {
  me: null,
  query: () => parse().q,
  setQuery(patch) {
    const { route, q } = parse();
    for (const [k, v] of Object.entries(patch)) { if (v === '' || v == null) q.delete(k); else q.set(k, v); }
    const s = q.toString();
    history.replaceState(null, '', `#/${route}${s ? '?' + s : ''}`);
  },
};

let badgeTimer;
async function refreshBadges() {
  if (!ctx.me?.permissions.includes('stats.view')) return;
  try {
    const d = await api('/dashboard');
    const set = (route, n) => { const a = document.querySelector(`.nav a[data-route="${route}"]`); if (!a) return; a.querySelector('.count')?.remove(); if (n > 0) a.append(h('span', { class: 'count', text: new Intl.NumberFormat('fa-IR').format(n) })); };
    set('payments', d.stats.needsReview); set('services', d.failedProvisioning); set('support', d.stats.openTickets);
  } catch { /* badges are best-effort */ }
}

function shell() {
  const side = h('aside', { class: 'sidebar', id: 'sidebar', 'aria-label': 'منوی اصلی' },
    h('div', { class: 'logo' }, h('div', { class: 'brand-mark' }, icon('shield')), h('div', null, 'پنل VPN', h('small', { text: 'مدیریت فروش و سرویس' }))),
    h('nav', { class: 'nav' }, NAV.filter(([, , , perm]) => ctx.me.permissions.includes(perm)).map(([r, label, ico]) => h('a', { href: `#/${r}`, 'data-route': r }, icon(ico), h('span', { text: label })))),
    h('div', { class: 'side-foot' }, h('div', { text: `نقش: ${ctx.me.role}` }), h('div', { class: 'ltr mono', text: `ID ${ctx.me.telegramId}` })));
  const scrim = h('div', { class: 'scrim' });
  const closeNav = () => { side.classList.remove('open'); scrim.classList.remove('show'); };
  scrim.addEventListener('click', closeNav);
  themeBtn = h('button', { class: 'btn ghost icon-only', 'aria-label': 'تغییر تم', title: 'تم روشن/تیره', onClick: toggleTheme }, icon(effectiveDark() ? 'sun' : 'moon'));
  const title = h('div', { class: 'title', id: 'page-title' });
  const top = h('header', { class: 'topbar' },
    h('button', { class: 'btn ghost icon-only menu-btn', 'aria-label': 'منو', onClick: () => { side.classList.add('open'); scrim.classList.add('show'); } }, icon('menu')),
    title, h('div', { class: 'grow' }), themeBtn,
    button('خروج', { ico: 'logout', size: 'sm', onClick: async () => { await fetch('/admin/logout', { method: 'POST', headers: { 'x-requested-with': 'admin-panel' } }); location.href = '/admin/'; } }));
  const content = h('main', { class: 'content', id: 'content' });
  app.classList.remove('boot');
  clear(app);
  app.append(h('div', { class: 'layout' }, side, h('div', { class: 'main' }, top, content)), scrim);
  window.addEventListener('hashchange', () => { closeNav(); render(); });
  return { content, title };
}

let view;
function render() {
  const { route } = parse();
  const entry = NAV.find(([r]) => r === route && ctx.me.permissions.includes(NAV.find(([x]) => x === r)[3]));
  document.querySelectorAll('.nav a').forEach((a) => (a.dataset.route === route ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  clear(view.content);
  if (!entry) {
    const first = NAV.find(([, , , perm]) => ctx.me.permissions.includes(perm));
    if (route !== first?.[0] && first) { location.hash = `#/${first[0]}`; return; }
    view.content.append(emptyState('دسترسی ندارید', 'نقش شما به این بخش دسترسی ندارد.', 'lock'));
    return;
  }
  view.title.textContent = entry[1];
  document.title = `${entry[1]} · پنل VPN`;
  try { PAGES[route](ctx, view.content); } catch (e) { view.content.append(errorState('نمایش صفحه با خطا مواجه شد.', render)); console.error(e); }
  view.content.focus?.();
  scrollTo({ top: 0 });
}

function loginScreen(reason) {
  const failed = new URLSearchParams(location.search).get('login') === 'failed';
  app.classList.remove('boot');
  clear(app);
  app.append(h('div', { class: 'login' }, h('div', { class: 'card' },
    h('div', { class: 'brand-mark' }, icon('shield')), h('h1', { text: 'پنل مدیریت VPN' }),
    failed ? h('div', { class: 'form-error', text: 'لینک ورود نامعتبر یا منقضی شده است. دوباره از ربات لینک بگیرید.' }) : null,
    reason ? h('div', { class: 'callout warn' }, icon('alert'), h('div', { text: reason })) : null,
    h('p', { class: 'muted' }, 'برای ورود، در ربات تلگرام دستور ', h('code', { text: '/panel' }), ' را بفرستید و روی لینک یک‌بارمصرف بزنید.'),
    h('div', { class: 'row', style: 'justify-content:center' }, icon('lock', 'sm'), h('span', { class: 'muted', text: 'فقط ادمین‌های ثبت‌شده' })),
    button('تلاش دوباره', { ico: 'refresh', onClick: () => (location.href = '/admin/') }))));
}

async function boot() {
  try {
    ctx.me = await api('/me');
  } catch (e) {
    if (e instanceof ApiError && e.status === 503) return loginScreen('پنل هنوز پیکربندی نشده است (PANEL_SESSION_SECRET یا BOT_TOKEN).');
    if (e instanceof ApiError && e.status === 401) return loginScreen();
    app.classList.remove('boot'); clear(app); app.append(errorState('اتصال به سرور برقرار نشد.', boot)); return;
  }
  view = shell();
  render();
  refreshBadges();
  clearInterval(badgeTimer);
  badgeTimer = setInterval(refreshBadges, 60_000);
}
boot();
