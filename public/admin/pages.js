import { h, icon, api, ApiError, badge, STATUS, money, moneyShort, num, faDigits, date, datetime, ago, bytes, ltr, table, pager, segmented, searchBox, kv, skeletonRows, skeletonBlock, emptyState, errorState, button, toast, modal, drawer, confirmDialog, clear, copyText } from './ui.js';
import { areaChart, barChart, donut } from './charts.js';

const userCell = (u) => h('div', null, h('div', { class: 'cell-main', text: u.name || (u.username ? `@${u.username}` : '—') }), h('div', { class: 'cell-sub' }, ltr(String(u.telegramId)), u.username ? ` · @${u.username}` : ''));
const can = (ctx, p) => ctx.me.permissions.includes(p);
const errMsg = (e) => (e instanceof ApiError ? e.message : 'خطای ارتباط با سرور');
const pageHead = (title, sub, ...actions) => h('div', { class: 'page-h' }, h('div', null, h('h1', { text: title }), sub ? h('p', { text: sub }) : null), h('div', { class: 'row' }, actions));

/** Reusable list page: toolbar (search + filter) → skeleton/table/empty/error → pager. State lives in the URL. */
function listPage(ctx, root, o) {
  const card = h('div', { class: o.bare ? '' : 'card' });
  const bar = h('div', { class: 'toolbar' });
  const body = h('div');
  const foot = h('div');
  card.append(bar, body, foot);
  root.append(card);
  const q = () => ctx.query();
  const seg = h('div', { class: 'seg-wrap' });
  const renderBar = () => {
    clear(seg);
    if (o.filters) seg.append(segmented(o.filters, q().get(o.filterKey || 'status') || o.filters[0][0], (v) => { ctx.setQuery({ [o.filterKey || 'status']: v === o.filters[0][0] ? '' : v, page: '' }); renderBar(); load(); }));
  };
  if (o.search !== false) bar.append(searchBox(q().get('q') || '', (v) => { ctx.setQuery({ q: v, page: '' }); load(); }, o.search || 'جستجو…'));
  bar.append(seg);
  if (o.extra) bar.append(h('div', { style: 'margin-inline-start:auto' }, o.extra));
  renderBar();
  async function load() {
    clear(body); clear(foot);
    body.append(h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, skeletonRows(o.columns.length))));
    const p = q();
    try {
      const data = await api(o.endpoint, { query: { q: p.get('q') || '', [o.filterKey || 'status']: p.get(o.filterKey || 'status') || '', page: p.get('page') || '1', ...(o.query || {}) } });
      o.onData?.(data);
      clear(body);
      if (!data.items.length) {
        const filtered = p.get('q') || p.get(o.filterKey || 'status');
        body.append(emptyState(filtered ? 'نتیجه‌ای پیدا نشد' : o.emptyTitle, filtered ? 'فیلتر یا عبارت جستجو را تغییر دهید.' : o.emptyText, o.emptyIcon));
        return;
      }
      body.append(table(o.columns, data.items, { onRow: o.onRow && ((r) => o.onRow(r, load)) }));
      foot.append(pager(data, (pg) => { ctx.setQuery({ page: pg === 1 ? '' : String(pg) }); load(); }));
    } catch (e) { clear(body); body.append(errorState(errMsg(e), load)); }
  }
  load();
  return { load };
}

/* ================================ Dashboard ================================ */
export async function dashboard(ctx, root) {
  root.append(pageHead('داشبورد', 'نمای کلی از وضعیت فروش و سرویس‌ها'));
  const wrap = h('div', { class: 'stack' }, h('div', { class: 'stats' }, Array.from({ length: 8 }, () => h('div', { class: 'card stat' }, skeletonBlock(56)))), skeletonBlock(260));
  root.append(wrap);
  let d;
  try { d = await api('/dashboard'); } catch (e) { clear(wrap); wrap.append(errorState(errMsg(e), () => { clear(root); dashboard(ctx, root); })); return; }
  const s = d.stats;
  const card = (label, value, ico, tone, href, unit) => h('div', { class: `card stat ${href ? 'stat-link' : ''}`, onClick: href ? () => (location.hash = href) : null, tabindex: href ? '0' : false },
    h('div', { class: 'stat-top' }, h('span', { text: label }), h('span', { class: `stat-ico ${tone}` }, icon(ico))), h('div', { class: 'stat-v' }, value, unit ? h('small', { text: unit }) : null));
  const stats = h('div', { class: 'stats' },
    card('کاربران', num(s.users), 'users', '', '#/users'), card('سفارش‌ها', num(s.orders), 'receipt', 'info', '#/orders'),
    card('درآمد (تأییدشده)', s.revenue >= 1e9 ? moneyShort(s.revenue) : num(s.revenue), 'wallet', 'ok', '#/payments?filter=approved', 'تومان'),
    card('پرداخت در انتظار', num(s.pendingPayments), 'clock', 'warn', '#/payments?filter=submitted'), card('نیازمند بررسی', num(s.needsReview), 'card', s.needsReview ? 'warn' : '', '#/payments?filter=review'),
    card('تأیید خودکار', num(s.autoApproved), 'bot', 'ok', '#/payments?filter=auto'),
    card('سرویس فعال', num(s.activeVpn), 'shield', 'ok', '#/services?status=ACTIVE'), card('سرویس منقضی', num(s.expiredVpn), 'shield', 'err', '#/services?status=EXPIRED'),
    card('خطای راه‌اندازی', num(d.failedProvisioning), 'alert', d.failedProvisioning ? 'err' : '', '#/services?status=failed'));
  const hasSales = d.series.some((x) => x.revenue > 0 || x.orders > 0);
  const chartCard = (title, sub, node, legend) => h('div', { class: 'card' }, h('div', { class: 'card-h' }, h('div', null, h('h3', { text: title }), h('div', { class: 'cell-sub', text: sub })), legend || null), h('div', { class: 'card-b' }, node));
  const emptyChart = emptyState('هنوز داده‌ای ثبت نشده', 'بعد از اولین پرداخت تأییدشده، نمودار اینجا نمایش داده می‌شود.', 'dashboard');
  const rev = chartCard('درآمد روزانه', '۳۰ روز گذشته · تومان', hasSales ? areaChart(d.series.map((x) => ({ day: x.day, v: x.revenue })), { unit: 'تومان' }) : emptyChart);
  const ordersCard = chartCard('سفارش‌های ثبت‌شده', '۳۰ روز گذشته', hasSales ? barChart(d.series.map((x) => ({ day: x.day, v: x.orders })), { color: 'var(--chart-1)', unit: 'سفارش' }) : emptyChart);
  const salesCard = chartCard('فروش موفق', 'پرداخت‌های تأییدشده · ۳۰ روز گذشته', hasSales ? barChart(d.series.map((x) => ({ day: x.day, v: x.sales })), { color: 'var(--chart-2)', unit: 'فروش' }) : emptyChart);
  const sv = d.servicesByStatus;
  const parts = [{ label: 'فعال', value: sv.ACTIVE || 0, color: 'var(--chart-2)' }, { label: 'منقضی', value: sv.EXPIRED || 0, color: 'var(--chart-4)' }, { label: 'معلق', value: sv.SUSPENDED || 0, color: 'var(--chart-3)' }, { label: 'لغو شده', value: sv.CANCELLED || 0, color: 'var(--border-strong)' }];
  const total = parts.reduce((a, p) => a + p.value, 0);
  const svcCard = chartCard('وضعیت سرویس‌ها', 'بر اساس داده‌ی ثبت‌شده', total ? h('div', { class: 'stack' }, donut(parts), h('div', { class: 'legend', style: 'justify-content:center' }, parts.filter((p) => p.value).map((p) => h('span', null, h('i', { style: `background:${p.color}` }), `${p.label}: ${num(p.value)}`)))) : emptyState('سرویسی وجود ندارد', 'بعد از اولین فروش نمایش داده می‌شود.', 'shield'));
  const attention = h('div', { class: 'card' }, h('div', { class: 'card-h' }, h('h3', { text: 'نیازمند اقدام' }), button('همه', { size: 'sm', kind: 'ghost', onClick: () => (location.hash = '#/payments?filter=review') })),
    d.attention.length ? d.attention.map((p) => h('div', { class: 'list-item', tabindex: '0', onClick: () => openPayment(ctx, p.id) }, h('div', { class: 'grow' }, h('div', { class: 'cell-main' }, ltr(p.orderNumber)), h('div', { class: 'cell-sub', text: `${p.user.username ? '@' + p.user.username : p.user.telegramId} · ${ago(p.createdAt)}` })), h('span', { class: 'num', text: money(p.amount) }), badge(STATUS.risk, p.riskLevel))) : emptyState('همه‌چیز مرتب است', 'پرداختی در صف بررسی نیست.', 'check'));
  const recent = h('div', { class: 'card' }, h('div', { class: 'card-h' }, h('h3', { text: 'آخرین سفارش‌ها' }), button('همه', { size: 'sm', kind: 'ghost', onClick: () => (location.hash = '#/orders') })),
    d.recentOrders.length ? d.recentOrders.map((o) => h('div', { class: 'list-item', onClick: () => (location.hash = `#/orders?q=${o.orderNumber}`) }, h('div', { class: 'grow' }, h('div', { class: 'cell-main', text: o.product }), h('div', { class: 'cell-sub' }, ltr(o.orderNumber), ` · ${ago(o.createdAt)}`)), h('span', { class: 'num', text: money(o.finalAmount) }), badge(STATUS.order, o.status))) : emptyState('سفارشی ثبت نشده', 'پس از اولین سفارش اینجا نمایش داده می‌شود.', 'receipt'));
  clear(wrap);
  wrap.append(stats, h('div', { class: 'grid-2' }, rev, svcCard), h('div', { class: 'grid-eq' }, ordersCard, salesCard), h('div', { class: 'grid-eq' }, attention, recent));
}

/* ================================== Users ================================== */
export function users(ctx, root) {
  root.append(pageHead('کاربران', 'کاربران ثبت‌نام‌شده در ربات'));
  listPage(ctx, root, {
    endpoint: '/users', search: 'جستجو: آیدی تلگرام، نام یا username', filters: [['', 'همه'], ['active', 'فعال'], ['blocked', 'مسدود']],
    emptyTitle: 'هنوز کاربری ثبت‌نام نکرده', emptyText: 'کاربران بعد از اولین /start در ربات اینجا نمایش داده می‌شوند.', emptyIcon: 'users',
    columns: [
      { label: 'کاربر', render: userCell }, { label: 'Telegram ID', render: (u) => ltr(String(u.telegramId), 'mono') },
      { label: 'سفارش‌ها', cls: 'num', render: (u) => num(u.orders) }, { label: 'سرویس فعال', cls: 'num', render: (u) => num(u.activeServices) },
      { label: 'وضعیت', render: (u) => h('span', { class: `badge ${u.isBlocked ? 'err' : 'ok'}`, text: u.isBlocked ? 'مسدود' : 'فعال' }) },
      { label: 'عضویت', render: (u) => date(u.createdAt) },
      { label: '', render: (u) => h('div', { class: 'actions' }, button('جزئیات', { size: 'sm', ico: 'eye', onClick: () => openUser(u.id) })) },
    ],
    onRow: (u) => openUser(u.id),
  });
}
async function openUser(id) {
  const body = h('div', { class: 'drawer-b' }, skeletonBlock(200));
  drawer({ title: 'جزئیات کاربر', body });
  try {
    const u = await api(`/users/${id}`);
    clear(body);
    body.append(kv([['نام', [u.firstName, u.lastName].filter(Boolean).join(' ') || '—'], ['Username', u.username ? ltr('@' + u.username) : '—'], ['Telegram ID', ltr(String(u.telegramId), 'mono')], ['عضویت', datetime(u.createdAt)], ['وضعیت', h('span', { class: `badge ${u.isBlocked ? 'err' : 'ok'}`, text: u.isBlocked ? 'مسدود' : 'فعال' })]]),
      h('div', null, h('div', { class: 'section-t', text: 'آخرین سفارش‌ها' }), u.orders.length ? table([{ label: 'سفارش', render: (o) => ltr(o.orderNumber, 'mono') }, { label: 'محصول', render: (o) => o.product.name }, { label: 'مبلغ', render: (o) => money(o.finalAmount) }, { label: 'وضعیت', render: (o) => badge(STATUS.order, o.status) }], u.orders) : emptyState('سفارشی ندارد', '', 'receipt')),
      h('div', null, h('div', { class: 'section-t', text: 'سرویس‌ها' }), u.services.length ? table([{ label: 'سرویس', render: (s) => s.product.name }, { label: 'انقضا', render: (s) => date(s.expiresAt) }, { label: 'وضعیت', render: (s) => badge(STATUS.service, s.status) }], u.services) : emptyState('سرویسی ندارد', '', 'shield')));
  } catch (e) { clear(body); body.append(errorState(errMsg(e))); }
}

/* ================================= Products ================================= */
export function products(ctx, root) {
  const newBtn = can(ctx, 'products.manage') ? button('محصول جدید', { kind: 'primary', ico: 'plus', onClick: () => productForm(null, () => reload()) }) : null;
  const bulkBtn = can(ctx, 'products.manage') ? button('افزودن گروهی', { ico: 'plus', onClick: () => bulkProductsForm(() => reload()) }) : null;
  root.append(pageHead('محصولات', 'پلن‌های قابل فروش و تنظیمات inbound', bulkBtn, newBtn));
  const card = h('div', { class: 'card' });
  root.append(card);
  async function reload() {
    clear(card); card.append(h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, skeletonRows(9, 4))));
    try {
      const [{ items }, cats] = await Promise.all([api('/products'), loadCategories()]);
      const catById = new Map(cats.map((c) => [c.id, c]));
      clear(card);
      if (!items.length) return void card.append(emptyState('هنوز محصولی تعریف نشده', 'اولین پلن را بسازید تا کاربران بتوانند خرید کنند.', 'box', newBtn && button('ساخت محصول', { kind: 'primary', ico: 'plus', onClick: () => productForm(null, reload) })));
      card.append(table([
        { label: 'نام', render: (p) => h('div', null, h('div', { class: 'cell-main', text: p.name }), h('div', { class: 'cell-sub', text: p.description || '' })) },
        { label: 'قیمت', cls: 'num', render: (p) => money(p.price) }, { label: 'حجم', cls: 'num', render: (p) => `${num(p.trafficGB)} GB` }, { label: 'مدت', cls: 'num', render: (p) => `${num(p.durationDays)} روز` },
        { label: 'دسته', render: (p) => (p.categoryId && catById.get(p.categoryId) ? h('span', { class: 'badge plain', text: catById.get(p.categoryId).path }) : h('span', { class: 'muted', text: 'صفحه‌ی اول' })) },
        { label: 'Protocol', render: (p) => h('span', { class: 'badge plain brand', text: p.protocol }) }, { label: 'Inbound', cls: 'num', render: (p) => ltr('#' + p.xuiInboundId, 'mono') },
        { label: 'ترتیب', cls: 'num', render: (p) => num(p.sortOrder) },
        { label: 'وضعیت', render: (p) => h('span', { class: `badge ${p.isActive ? 'ok' : ''}`, text: p.isActive ? 'فعال' : 'غیرفعال' }) },
        { label: '', render: (p) => h('div', { class: 'actions' },
          button('', { size: 'sm', kind: 'ghost', ico: 'edit', title: 'ویرایش', onClick: () => productForm(p, reload) }),
          button('', { size: 'sm', kind: 'ghost', ico: p.isActive ? 'pause' : 'play', title: p.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی', onClick: async () => { try { await api(`/products/${p.id}`, { method: 'PATCH', body: { isActive: !p.isActive } }); toast(p.isActive ? 'محصول غیرفعال شد' : 'محصول فعال شد'); reload(); } catch (e) { toast(errMsg(e), 'err'); } } }),
          button('', { size: 'sm', kind: 'ghost', ico: 'trash', title: 'حذف', onClick: async () => { if (!(await confirmDialog({ title: 'حذف محصول', message: `«${p.name}» حذف شود؟ اگر در سفارشی استفاده شده باشد، حذف انجام نمی‌شود.`, confirmLabel: 'حذف', kind: 'danger' }))) return; try { await api(`/products/${p.id}`, { method: 'DELETE' }); toast('محصول حذف شد'); reload(); } catch (e) { toast(errMsg(e), 'err'); } } })) },
      ], items));
    } catch (e) { clear(card); card.append(errorState(errMsg(e), reload)); }
  }
  reload();
}
function bulkProductsForm(done) {
  const text = h('textarea', { class: 'textarea ltr', dir: 'auto', style: 'min-height:200px;font-family:var(--mono);font-size:13px', placeholder: 'اقتصادی ۵۰ گیگ | 30 | 50 | 250000\nویژه ۱۰۰ گیگ | 60 | 100 | 450000\nویژه ۲۰۰ گیگ | 90 | 200 | 800000 | 25 | VLESS | توضیح', 'aria-label': 'لیست محصولات' });
  const inbound = h('input', { class: 'input', type: 'number', inputmode: 'numeric', placeholder: 'مثلاً ۲۳', 'aria-label': 'Inbound پیش‌فرض' });
  const proto = h('select', { class: 'select', 'aria-label': 'پروتکل پیش‌فرض' }, ['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS'].map((x) => h('option', { value: x }, x)));
  const cat = h('input', { class: 'input', placeholder: 'مثلاً: ماهانه ▸ حجمی (اگر نبود ساخته می‌شود)', 'aria-label': 'دسته‌بندی' });
  const err = h('pre', { class: 'form-error', hidden: true, style: 'white-space:pre-wrap;margin:0;font-family:inherit' });
  const ok = button('ثبت همه', { kind: 'primary', onClick: async () => {
    err.hidden = true;
    try {
      const r = await api('/products/bulk', { method: 'POST', body: { text: text.value, inbound: inbound.value ? Number(inbound.value) : null, protocol: proto.value, category: cat.value.trim() || null } });
      toast(`${num(r.created)} محصول ثبت شد`); m.close(); done();
    } catch (e) { err.hidden = false; err.textContent = errMsg(e); }
  } });
  const m = modal({ title: 'افزودن گروهی محصولات', body: h('div', { class: 'stack' },
    h('div', { class: 'callout' }, icon('info'), h('div', null, 'هر محصول یک خط: ', h('b', { class: 'ltr', text: 'نام | روز | حجم GB | قیمت | [inbound] | [پروتکل] | [توضیح]' }), '. اگر inbound یکی است، پایین فقط یک‌بار تعیینش کنید. اگر یک خط خطا داشته باشد هیچ‌کدام ثبت نمی‌شود.')),
    h('div', { class: 'form-grid' }, h('div', { class: 'field' }, h('label', { text: 'Inbound پیش‌فرض' }), inbound), h('div', { class: 'field' }, h('label', { text: 'پروتکل پیش‌فرض' }), proto), h('div', { class: 'field full' }, h('label', { text: 'دسته‌بندی پیش‌فرض (اختیاری)' }), cat)),
    h('div', { class: 'field' }, h('label', { text: 'لیست محصولات' }), text), err), footer: [ok, button('انصراف', { onClick: () => m.close() })] });
}
async function loadCategories() {
  try { return (await api('/categories')).items; } catch { return []; }
}
const catLabel = (c) => `${'· '.repeat(c.depth)}${c.icon || '📁'} ${c.name}`;

function productForm(p, done) {
  const f = (label, name, type = 'text', val = '', hint) => h('div', { class: 'field' }, h('label', { for: `pf-${name}`, text: label }), h('input', { class: 'input', id: `pf-${name}`, name, type, value: val, inputmode: type === 'number' ? 'numeric' : false }), hint ? h('div', { class: 'hint', text: hint }) : null);
  const catSel = h('select', { class: 'select', id: 'pf-category', 'aria-label': 'دسته‌بندی' }, h('option', { value: '' }, '🏠 بدون دسته (صفحه‌ی اول)'));
  loadCategories().then((cs) => cs.forEach((c) => catSel.append(h('option', { value: c.id, selected: p?.categoryId === c.id }, catLabel(c)))));
  const proto = h('select', { class: 'select', id: 'pf-protocol' }, ['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS'].map((x) => h('option', { value: x, selected: p?.protocol === x }, x)));
  const active = h('button', { type: 'button', class: 'switch', role: 'switch', 'aria-checked': String(p ? p.isActive : true), 'aria-label': 'فعال' });
  active.addEventListener('click', () => active.setAttribute('aria-checked', String(active.getAttribute('aria-checked') !== 'true')));
  const form = h('form', { class: 'form-grid', novalidate: true },
    h('div', { class: 'full' }, f('نام محصول', 'name', 'text', p?.name || '')), h('div', { class: 'full' }, f('توضیح (اختیاری)', 'description', 'text', p?.description || '')),
    f('قیمت (تومان)', 'price', 'number', p?.price ?? '', 'عدد صحیح'), f('حجم (GB)', 'trafficGB', 'number', p?.trafficGB ?? ''), f('مدت (روز)', 'durationDays', 'number', p?.durationDays ?? ''),
    f('Inbound ID در X-UI', 'xuiInboundId', 'number', p?.xuiInboundId ?? '', 'شناسه inbound در پنل'), h('div', { class: 'field' }, h('label', { for: 'pf-protocol', text: 'Protocol' }), proto), f('ترتیب نمایش', 'sortOrder', 'number', p?.sortOrder ?? 0),
    h('div', { class: 'field' }, h('label', { text: 'دسته‌بندی در منوی خرید' }), catSel), h('div', { class: 'field' }, h('label', { text: 'وضعیت' }), h('div', { class: 'row' }, active, h('span', { class: 'muted', text: 'قابل خرید' }))), h('div', { class: 'full form-error', hidden: true, id: 'pf-err' }));
  const save = button(p ? 'ذخیره تغییرات' : 'ایجاد محصول', { kind: 'primary', onClick: async () => {
    const v = (n) => form.querySelector(`[name=${n}]`).value.trim();
    const err = form.querySelector('#pf-err');
    const body = { name: v('name'), description: v('description') || null, price: Number(v('price')), trafficGB: Number(v('trafficGB')), durationDays: Number(v('durationDays')), xuiInboundId: Number(v('xuiInboundId')), sortOrder: Number(v('sortOrder') || 0), protocol: proto.value, isActive: active.getAttribute('aria-checked') === 'true', categoryId: catSel.value || null };
    const bad = !body.name ? 'نام محصول را وارد کنید' : ['price', 'trafficGB', 'durationDays', 'xuiInboundId'].find((k) => !Number.isInteger(body[k]) || body[k] < (k === 'price' ? 0 : 1)) ? 'قیمت، حجم، مدت و Inbound باید عدد صحیح معتبر باشند' : '';
    if (bad) { err.hidden = false; err.textContent = bad; return; }
    try { await api(p ? `/products/${p.id}` : '/products', { method: p ? 'PATCH' : 'POST', body }); toast(p ? 'تغییرات ذخیره شد' : 'محصول ساخته شد'); m.close(); done(); }
    catch (e) { err.hidden = false; err.textContent = errMsg(e); }
  } });
  const m = modal({ title: p ? 'ویرایش محصول' : 'محصول جدید', body: form, footer: [save, button('انصراف', { onClick: () => m.close() })] });
  form.addEventListener('submit', (e) => e.preventDefault());
}

/* ================================== Orders ================================== */
export function orders(ctx, root) {
  root.append(pageHead('سفارش‌ها', 'همه‌ی سفارش‌های ثبت‌شده'));
  const opts = [['', 'همه'], ...Object.entries(STATUS.order).map(([k, v]) => [k, v[0]])];
  listPage(ctx, root, {
    endpoint: '/orders', search: 'جستجو: شماره سفارش یا کاربر', filters: opts, emptyTitle: 'هنوز سفارشی ثبت نشده', emptyText: 'سفارش‌ها بعد از خرید کاربران اینجا نمایش داده می‌شوند.', emptyIcon: 'receipt',
    columns: [
      { label: 'سفارش', render: (o) => h('div', null, h('div', { class: 'cell-main' }, ltr(o.orderNumber, 'mono')), h('div', { class: 'cell-sub', text: o.isRenewal ? 'تمدید' : 'خرید جدید' })) },
      { label: 'کاربر', render: (o) => userCell(o.user) }, { label: 'محصول', render: (o) => o.product },
      { label: 'مبلغ', cls: 'num', render: (o) => h('div', null, h('div', { text: money(o.finalAmount) }), o.discountAmount ? h('div', { class: 'cell-sub', text: `تخفیف ${money(o.discountAmount)}` }) : null) },
      { label: 'روش پرداخت', render: (o) => STATUS.method[o.paymentMethod] || o.paymentMethod }, { label: 'وضعیت', render: (o) => badge(STATUS.order, o.status) }, { label: 'تاریخ', render: (o) => datetime(o.createdAt) },
    ],
  });
}

/* ================================== Payments ================================== */
export function payments(ctx, root) {
  root.append(pageHead('پرداخت‌ها', 'بررسی، تأیید و ممیزی پرداخت‌ها'));
  const f = [['', 'همه'], ['review', 'نیازمند بررسی'], ['submitted', 'ارسال‌شده'], ['auto', 'تأیید خودکار'], ['approved', 'تأییدشده'], ['rejected', 'ردشده'], ['pending', 'در انتظار']];
  listPage(ctx, root, {
    endpoint: '/payments', filterKey: 'filter', filters: f, search: 'جستجو: سفارش، کد پیگیری یا کاربر', emptyTitle: 'هنوز پرداختی ثبت نشده', emptyText: 'پرداخت‌ها پس از ارسال رسید توسط کاربران نمایش داده می‌شوند.', emptyIcon: 'card',
    columns: [
      { label: 'سفارش / کاربر', render: (p) => h('div', null, h('div', { class: 'cell-main' }, ltr(p.orderNumber, 'mono')), h('div', { class: 'cell-sub', text: p.user.username ? '@' + p.user.username : String(p.user.telegramId) })) },
      { label: 'مبلغ', cls: 'num', render: (p) => money(p.amount) }, { label: 'روش', render: (p) => STATUS.method[p.provider] },
      { label: 'کد پیگیری', render: (p) => (p.trackingCode ? ltr(p.trackingCode, 'mono') : h('span', { class: 'muted', text: '—' })) },
      { label: 'وضعیت', render: (p) => h('div', { class: 'row', style: 'gap:6px' }, badge(STATUS.payment, p.status), p.autoApproved ? h('span', { class: 'badge brand plain', title: 'تأیید خودکار توسط سیستم' }, icon('bot', 'sm'), 'خودکار') : null) },
      { label: 'تأیید بانکی', render: (p) => (p.verificationStatus ? badge(STATUS.verification, p.verificationStatus) : h('span', { class: 'muted', text: '—' })) },
      { label: 'ریسک', render: (p) => (p.riskLevel ? h('div', null, badge(STATUS.risk, p.riskLevel), h('div', { class: 'cell-sub num', text: `امتیاز ${num(p.riskScore)}` })) : '—') },
      { label: 'OCR', render: (p) => (p.ocrAmount == null ? h('span', { class: 'muted', text: 'نامشخص' }) : h('span', { class: `badge ${p.ocrAmount === p.amount ? 'ok' : 'warn'}`, title: money(p.ocrAmount) }, p.ocrAmount === p.amount ? 'مبلغ منطبق' : 'مبلغ متفاوت')) },
      { label: 'ایجاد', render: (p) => datetime(p.createdAt) },
    ],
    onRow: (p, reload) => openPayment(ctx, p.id, reload),
  });
}

export async function openPayment(ctx, id, onChange) {
  const body = h('div', { class: 'drawer-b' }, skeletonBlock(180), skeletonBlock(120));
  const foot = h('div', { class: 'drawer-f', hidden: true });
  const dr = drawer({ title: 'جزئیات پرداخت', sub: id, body, footer: foot });
  let receiptUrl;
  const origClose = dr.close;
  async function load() {
    try {
      const { payment: p, audit } = await api(`/payments/${id}`);
      clear(body); clear(foot);
      const rd = p.receiptData || {};
      const head = h('div', { class: 'row between' }, h('div', null, h('div', { class: 'cell-main', text: `سفارش ${p.order.orderNumber}` }), h('div', { class: 'cell-sub', text: `${p.order.product.name} · ${datetime(p.createdAt)}` })), h('div', { class: 'row', style: 'gap:6px' }, badge(STATUS.payment, p.status), p.autoApproved ? h('span', { class: 'badge brand plain' }, icon('bot', 'sm'), 'تأیید خودکار') : null));
      const callout = p.status === 'NEEDS_REVIEW' ? h('div', { class: 'callout warn' }, icon('alert'), h('div', { text: 'این پرداخت به‌صورت خودکار تأیید نشد و منتظر بررسی شماست. فقط رسید یا OCR برای تأیید قطعی کافی نیست.' })) : p.autoApproved ? h('div', { class: 'callout ok' }, icon('check'), h('div', { text: 'این پرداخت بعد از تطبیق با تراکنش واقعی بانک به‌صورت خودکار تأیید شد. می‌توانید شواهد را بازبینی کنید.' })) : null;
      const sum = h('div', { class: 'panel' }, kv([
        ['کاربر', h('span', null, `${p.user.firstName || ''} `, p.user.username ? ltr('@' + p.user.username) : '', ' ', ltr(String(p.user.telegramId), 'mono'))],
        ['مبلغ سفارش', h('b', { text: money(p.amount) })], ['روش پرداخت', STATUS.method[p.provider]], ['کد پیگیری', p.trackingCode ? ltr(p.trackingCode, 'mono') : '—'],
        ['زمان ارسال', datetime(p.submittedAt)], p.reviewedBy ? ['بررسی‌کننده', h('span', null, ltr(p.reviewedBy), ' · ', datetime(p.reviewedAt))] : null, p.rejectionReason ? ['دلیل رد', p.rejectionReason] : null,
        p.order.service ? ['سرویس VPN', h('span', null, badge(STATUS.prov, p.order.service.provisioningStatus), ' ', badge(STATUS.service, p.order.service.status))] : null]));
      const receipt = h('div', null, h('div', { class: 'section-t' }, icon('scan', 'sm'), 'رسید'), p.receiptPath ? h('img', { class: 'receipt', alt: 'رسید پرداخت', id: 'rcpt' }) : emptyState('رسید تصویری ثبت نشده', 'کاربر فقط کد پیگیری ارسال کرده است.', 'receipt'));
      if (p.receiptPath && !receiptUrl) fetch(`/admin/api/payments/${id}/receipt`, { credentials: 'same-origin' }).then((r) => (r.ok ? r.blob() : Promise.reject())).then((b) => { receiptUrl = URL.createObjectURL(b); const im = body.querySelector('#rcpt'); if (im) im.src = receiptUrl; }).catch(() => { const im = body.querySelector('#rcpt'); if (im) im.replaceWith(emptyState('فایل رسید در دسترس نیست', '', 'alert')); });
      else if (receiptUrl) setTimeout(() => { const im = body.querySelector('#rcpt'); if (im) im.src = receiptUrl; });
      const ocr = h('div', null, h('div', { class: 'section-t' }, icon('scan', 'sm'), 'نتیجه OCR / استخراج رسید ', h('span', { class: 'muted', text: '(فقط استخراج؛ مدرک پرداخت نیست)' })),
        rd.source && rd.source !== 'none' ? h('div', { class: 'panel' }, kv([['مبلغ', rd.amount != null ? h('span', null, money(rd.amount), ' ', h('span', { class: `badge ${rd.amount === p.amount ? 'ok' : 'warn'}`, text: rd.amount === p.amount ? 'منطبق' : 'متفاوت' })) : '—'], ['کد پیگیری', rd.trackingCode ? ltr(rd.trackingCode, 'mono') : '—'], ['تاریخ / ساعت', `${rd.date ? faDigits(rd.date) : '—'} ${rd.time ? faDigits(rd.time) : ''}`], ['بانک', rd.bank || '—'], ['اطمینان', `${num(Math.round((rd.confidence || 0) * 100))}٪ (${rd.source})`]])) : emptyState('داده‌ای استخراج نشد', 'OCR انجام نشده یا چیزی از رسید قابل خواندن نبود.', 'scan'));
      const risk = h('div', null, h('div', { class: 'section-t' }, icon('alert', 'sm'), 'ریسک'), p.riskLevel ? h('div', { class: 'panel stack', style: 'gap:8px' }, h('div', { class: 'row' }, badge(STATUS.risk, p.riskLevel), h('span', { class: 'muted', text: `امتیاز ${num(p.riskScore)} از ۱۰۰` })),
        (p.riskFactors || []).length ? h('ul', { style: 'margin:0;padding-inline-start:18px;font-size:13px' }, p.riskFactors.map((x) => h('li', null, ltr(x.code, 'mono'), ` (${x.points > 0 ? '+' : ''}${faDigits(x.points)})`, x.detail ? ` — ${x.detail}` : ''))) : h('span', { class: 'muted', text: 'عامل ریسکی ثبت نشده.' })) : emptyState('هنوز ارزیابی نشده', '', 'alert'));
      const ver = h('div', null, h('div', { class: 'section-t' }, icon('shield', 'sm'), 'تأیید بانکی'),
        p.bankTx ? h('div', { class: 'panel' }, kv([['تراکنش بانکی', h('span', null, ltr(p.bankTx.trackingCode || '—', 'mono'), ' · ', money(p.bankTx.amount))], ['زمان تراکنش', datetime(p.bankTx.occurredAt)], ['منبع', p.bankTx.source]])) : null,
        p.verifications.length ? h('ul', { class: 'timeline', style: 'margin-top:10px' }, p.verifications.map((v) => h('li', null, h('div', { class: 'row', style: 'gap:6px' }, badge(STATUS.verification, v.result), h('span', { class: 'cell-sub', text: `${v.provider} · ${datetime(v.createdAt)}` })), v.reason ? h('div', { class: 'cell-sub', text: v.reason }) : null))) : (p.bankTx ? null : emptyState('نتیجه‌ای ثبت نشده', 'هنوز تأییدی از لجر بانکی دریافت نشده است.', 'shield')));
      const hist = h('div', null, h('div', { class: 'section-t' }, icon('audit', 'sm'), 'تاریخچه (Audit)'), audit.length ? h('ul', { class: 'timeline' }, audit.map((a) => h('li', null, h('div', null, ltr(a.action, 'mono')), h('div', { class: 'cell-sub' }, `${a.actor} · ${datetime(a.createdAt)}`)))) : emptyState('رویدادی ثبت نشده', '', 'audit'));
      body.append(head, callout, sum, receipt, ocr, risk, ver, hist);
      if ((p.status === 'SUBMITTED' || p.status === 'NEEDS_REVIEW') && can(ctx, 'payments.review')) {
        foot.hidden = false;
        foot.append(
          button('تأیید پرداخت', { kind: 'ok', ico: 'check', onClick: async () => {
            const ok = await confirmDialog({ title: 'تأیید پرداخت', message: `پرداخت ${money(p.amount)} برای سفارش ${p.order.orderNumber} تأیید و سرویس ساخته شود؟`, confirmLabel: 'بله، تأیید و ساخت سرویس', kind: 'ok',
              details: p.riskLevel && p.riskLevel !== 'LOW' ? h('div', { class: 'callout warn' }, icon('alert'), h('div', { text: `سطح ریسک این پرداخت «${STATUS.risk[p.riskLevel][0]}» است. قبل از تأیید رسید و شواهد را بررسی کرده باشید.` })) : null });
            if (!ok) return;
            try { const r = await api(`/payments/${id}/approve`, { method: 'POST' }); toast(r.changed ? 'پرداخت تأیید شد و سرویس در حال ساخت است' : 'این پرداخت قبلاً پردازش شده بود', r.changed ? 'ok' : 'warn'); onChange?.(); load(); } catch (e) { toast(errMsg(e), 'err'); }
          } }),
          button('رد پرداخت', { kind: 'danger', ico: 'x', onClick: () => rejectModal(id, () => { onChange?.(); load(); }) }),
          p.status === 'SUBMITTED' ? button('درخواست بررسی', { ico: 'eye', onClick: async () => { try { await api(`/payments/${id}/review`, { method: 'POST', body: {} }); toast('به صف بررسی منتقل شد'); onChange?.(); load(); } catch (e) { toast(errMsg(e), 'err'); } } }) : null);
      } else foot.hidden = true;
    } catch (e) { clear(body); body.append(errorState(errMsg(e), load)); }
  }
  dr.close = () => { if (receiptUrl) URL.revokeObjectURL(receiptUrl); origClose(); };
  load();
}
function rejectModal(id, done) {
  const t = h('textarea', { class: 'textarea', placeholder: 'دلیل رد (به کاربر نمایش داده می‌شود)', maxlength: '300', 'aria-label': 'دلیل رد' });
  const err = h('div', { class: 'form-error', hidden: true });
  const ok = button('رد پرداخت', { kind: 'danger', onClick: async () => {
    if (t.value.trim().length < 2) { err.hidden = false; err.textContent = 'دلیل رد را بنویسید'; return; }
    try { await api(`/payments/${id}/reject`, { method: 'POST', body: { reason: t.value.trim() } }); toast('پرداخت رد شد و به کاربر اطلاع داده شد'); m.close(); done(); } catch (e) { err.hidden = false; err.textContent = errMsg(e); }
  } });
  const m = modal({ title: 'رد پرداخت', small: true, body: h('div', { class: 'stack' }, h('div', { class: 'field' }, h('label', { text: 'دلیل رد' }), t), err), footer: [ok, button('انصراف', { onClick: () => m.close() })] });
}

/* ================================ VPN Services ================================ */
const usage = (s) => {
  if (!s.synced || !Number(s.trafficLimit)) return h('span', { class: 'muted', text: s.synced ? 'نامحدود' : 'همگام‌سازی نشده' });
  const pct = Math.min(100, Math.round((Number(s.trafficUsed) / Number(s.trafficLimit)) * 100));
  return h('div', { style: 'min-width:130px' }, h('div', { class: `progress ${pct > 90 ? 'err' : pct > 70 ? 'warn' : ''}` }, h('i', { style: `width:${pct}%` })), h('div', { class: 'cell-sub num' }, ltr(bytes(s.trafficUsed)), ' / ', ltr(bytes(s.trafficLimit))));
};
export function services(ctx, root) {
  root.append(pageHead('سرویس‌های VPN', 'وضعیت Clientها و عملیات مدیریتی'));
  listPage(ctx, root, {
    endpoint: '/services', search: 'جستجو: client، کاربر', filters: [['', 'همه'], ['ACTIVE', 'فعال'], ['EXPIRED', 'منقضی'], ['SUSPENDED', 'معلق'], ['failed', 'خطای راه‌اندازی']],
    emptyTitle: 'هنوز سرویسی ساخته نشده', emptyText: 'بعد از اولین پرداخت تأییدشده، سرویس‌ها اینجا نمایش داده می‌شوند.', emptyIcon: 'shield',
    columns: [
      { label: 'کاربر', render: (s) => userCell(s.user) }, { label: 'محصول', render: (s) => h('div', null, h('div', { class: 'cell-main', text: s.product }), h('div', { class: 'cell-sub' }, h('span', { text: s.protocol }), ' · inbound ', ltr('#' + s.inboundId))) },
      { label: 'Client', render: (s) => h('div', null, s.displayName ? h('div', { class: 'cell-main', text: s.displayName }) : null, ltr(s.externalId, 'mono'), h('div', { class: 'cell-sub' }, ltr(s.uuid.slice(0, 8) + '…', 'mono'))) },
      { label: 'مصرف', render: usage }, { label: 'انقضا', render: (s) => date(s.expiresAt) },
      { label: 'وضعیت', render: (s) => h('div', { class: 'row', style: 'gap:6px' }, s.provisioningStatus === 'SUCCESS' ? badge(STATUS.service, s.status) : null, s.provisioningStatus !== 'SUCCESS' ? badge(STATUS.prov, s.provisioningStatus) : null) },
    ],
    onRow: (s, reload) => openService(ctx, s.id, reload),
  });
}
async function openService(ctx, id, onChange) {
  const body = h('div', { class: 'drawer-b' }, skeletonBlock(200));
  const foot = h('div', { class: 'drawer-f', hidden: true });
  const dr = drawer({ title: 'جزئیات سرویس', sub: id, body, footer: foot });
  async function load() {
    try {
      const { service: s, audit } = await api(`/services/${id}`);
      clear(body); clear(foot);
      const failed = s.provisioningStatus !== 'SUCCESS';
      body.append(
        h('div', { class: 'row between' }, h('div', null, h('div', { class: 'cell-main', text: s.product.name }), h('div', { class: 'cell-sub', text: `ساخته‌شده ${datetime(s.createdAt)}` })), h('div', { class: 'row', style: 'gap:6px' }, failed ? null : badge(STATUS.service, s.status), badge(STATUS.prov, s.provisioningStatus))),
        failed ? h('div', { class: 'callout err' }, icon('alert'), h('div', { text: `راه‌اندازی کامل نشده است${s.order?.task?.lastError ? ` — ${s.order.task.lastError}` : ''}. تلاش‌ها: ${faDigits(s.order?.task?.attempts ?? 0)}` })) : null,
        h('div', { class: 'panel' }, kv([['کاربر', h('span', null, s.user.username ? ltr('@' + s.user.username) : '', ' ', ltr(String(s.user.telegramId), 'mono'))], ['نام انتخابی مشتری', s.displayName || h('span', { class: 'muted', text: 'خودکار' })], ['Client (email)', ltr(s.externalId, 'mono')], ['UUID / Credential', h('span', { class: 'row', style: 'gap:6px' }, ltr(s.uuid.slice(0, 13) + '…', 'mono'), button('', { size: 'sm', kind: 'ghost', ico: 'copy', title: 'کپی', onClick: () => copyText(s.uuid) }))], ['Protocol / Inbound', `${s.protocol} · #${s.inboundId}`], ['حجم', h('span', null, ltr(bytes(s.trafficUsed)), ' از ', ltr(bytes(s.trafficLimit)), s.lastSyncAt ? '' : ' (همگام‌سازی نشده)')], ['انقضا', datetime(s.expiresAt)], ['آخرین sync', s.lastSyncAt ? ago(s.lastSyncAt) : '—']])),
        h('div', null, h('div', { class: 'section-t' }, icon('audit', 'sm'), 'تاریخچه'), audit.length ? h('ul', { class: 'timeline' }, audit.map((a) => h('li', null, ltr(a.action, 'mono'), h('div', { class: 'cell-sub' }, `${a.actor} · ${datetime(a.createdAt)}`)))) : emptyState('رویدادی ثبت نشده', '', 'audit')));
      const refresh = () => { onChange?.(); load(); };
      const act = (label, ico, path, opts = {}) => button(label, { ico, kind: opts.kind || '', onClick: async () => {
        if (opts.confirm && !(await confirmDialog(opts.confirm))) return;
        try { await api(`/services/${id}/${path}`, { method: 'POST', body: opts.body || {} }); toast(opts.ok || 'انجام شد'); refresh(); } catch (e) { toast(errMsg(e), 'err'); }
      } });
      foot.hidden = false;
      foot.append(act('Sync', 'refresh', 'sync', { ok: 'همگام‌سازی انجام شد' }));
      if (can(ctx, 'vpn.manage')) {
        if (failed) foot.append(act('Retry', 'zap', 'retry', { kind: 'primary', ok: 'تلاش مجدد اجرا شد' }));
        if (!failed && s.status !== 'SUSPENDED') foot.append(act('Suspend', 'pause', 'suspend', { ok: 'سرویس معلق شد', confirm: { title: 'تعلیق سرویس', message: 'اتصال کاربر قطع می‌شود تا زمانی که دوباره فعال کنید.', confirmLabel: 'تعلیق', kind: 'danger' } }));
        if (s.status === 'SUSPENDED') foot.append(act('Resume', 'play', 'resume', { ok: 'سرویس فعال شد' }));
        if (!failed) foot.append(button('Renew', { ico: 'refresh', onClick: () => renewModal(s, refresh) }));
      }
      if (can(ctx, 'vpn.delete') && s.status !== 'CANCELLED') foot.append(button('Delete', { kind: 'danger', ico: 'trash', onClick: () => deleteModal(s, refresh) }));
    } catch (e) { clear(body); body.append(errorState(errMsg(e), load)); }
  }
  load();
  return dr;
}
async function renewModal(s, done) {
  let items = [];
  try { items = (await api('/products')).items.filter((p) => p.xuiInboundId === s.inboundId && p.xuiProviderId === s.provider); } catch (e) { return toast(errMsg(e), 'err'); }
  if (!items.length) return toast('پلن سازگار با این inbound وجود ندارد', 'warn');
  const sel = h('select', { class: 'select', 'aria-label': 'پلن تمدید' }, items.map((p) => h('option', { value: p.id }, `${p.name} — ${money(p.price)}`)));
  const ok = button('تمدید رایگان', { kind: 'primary', onClick: async () => { try { await api(`/services/${s.id}/renew`, { method: 'POST', body: { productId: sel.value } }); toast('سرویس تمدید شد'); m.close(); done(); } catch (e) { toast(errMsg(e), 'err'); } } });
  const m = modal({ title: 'تمدید توسط ادمین', small: true, body: h('div', { class: 'stack' }, h('div', { class: 'callout' }, icon('info'), h('div', { text: 'زمان و حجم پلن به همین Client اضافه می‌شود؛ Client جدید ساخته نمی‌شود و پرداختی ثبت نمی‌شود.' })), h('div', { class: 'field' }, h('label', { text: 'پلن' }), sel)), footer: [ok, button('انصراف', { onClick: () => m.close() })] });
}
async function deleteModal(s, done) {
  const phrase = `DELETE ${s.externalId.slice(-6)}`;
  const ok = await confirmDialog({ title: 'حذف دائمی Client از X-UI', message: 'این کار Client را از پنل X-UI حذف می‌کند و قابل بازگشت نیست. کاربر دیگر نمی‌تواند وصل شود.', confirmLabel: 'حذف دائمی', kind: 'danger', typed: phrase,
    details: h('div', { class: 'callout err' }, icon('alert'), h('div', null, 'Client: ', ltr(s.externalId, 'mono'))) });
  if (!ok) return;
  try { await api(`/services/${s.id}/delete`, { method: 'POST', body: { confirm: phrase } }); toast('Client حذف شد'); done(); } catch (e) { toast(errMsg(e), 'err'); }
}

/* ================================== Coupons ================================== */
export function coupons(ctx, root) {
  const nb = button('کد تخفیف جدید', { kind: 'primary', ico: 'plus', onClick: () => couponForm(reload) });
  root.append(pageHead('کدهای تخفیف', 'مدیریت کدهای تخفیف درصدی و ثابت', nb));
  const card = h('div', { class: 'card' }); root.append(card);
  async function reload() {
    clear(card); card.append(h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, skeletonRows(6, 4))));
    try {
      const { items } = await api('/coupons'); clear(card);
      if (!items.length) return void card.append(emptyState('هنوز کدی ساخته نشده', 'برای شروع یک کد تخفیف بسازید.', 'ticket', button('ساخت کد', { kind: 'primary', ico: 'plus', onClick: () => couponForm(reload) })));
      card.append(table([
        { label: 'کد', render: (c) => ltr(c.code, 'mono cell-main') }, { label: 'نوع / مقدار', render: (c) => (c.type === 'PERCENT' ? `${num(c.value)}٪` : money(c.value)) },
        { label: 'استفاده', cls: 'num', render: (c) => `${num(c.usedCount)} / ${c.maxUses == null ? '∞' : num(c.maxUses)}` }, { label: 'انقضا', render: (c) => (c.expiresAt ? date(c.expiresAt) : 'بدون انقضا') },
        { label: 'وضعیت', render: (c) => h('span', { class: `badge ${c.isActive ? 'ok' : ''}`, text: c.isActive ? 'فعال' : 'غیرفعال' }) },
        { label: '', render: (c) => h('div', { class: 'actions' }, button(c.isActive ? 'غیرفعال' : 'فعال‌سازی', { size: 'sm', onClick: async () => { try { await api(`/coupons/${c.id}/toggle`, { method: 'POST', body: { isActive: !c.isActive } }); toast('ذخیره شد'); reload(); } catch (e) { toast(errMsg(e), 'err'); } } })) },
      ], items));
    } catch (e) { clear(card); card.append(errorState(errMsg(e), reload)); }
  }
  reload();
}
function couponForm(done) {
  const code = h('input', { class: 'input ltr', dir: 'ltr', placeholder: 'OFF20', maxlength: '30', 'aria-label': 'کد' });
  const type = h('select', { class: 'select', 'aria-label': 'نوع' }, h('option', { value: 'PERCENT' }, 'درصدی'), h('option', { value: 'FIXED' }, 'مبلغ ثابت (تومان)'));
  const value = h('input', { class: 'input', type: 'number', inputmode: 'numeric', 'aria-label': 'مقدار' });
  const max = h('input', { class: 'input', type: 'number', inputmode: 'numeric', placeholder: 'نامحدود', 'aria-label': 'حداکثر استفاده' });
  const exp = h('input', { class: 'input', type: 'date', 'aria-label': 'تاریخ انقضا' });
  const err = h('div', { class: 'form-error', hidden: true });
  const ok = button('ایجاد', { kind: 'primary', onClick: async () => {
    const body = { code: code.value.trim(), type: type.value, value: Number(value.value), maxUses: max.value ? Number(max.value) : null, expiresAt: exp.value ? new Date(`${exp.value}T23:59:59`).toISOString() : null };
    if (!body.code || !Number.isInteger(body.value) || body.value <= 0) { err.hidden = false; err.textContent = 'کد و مقدار معتبر وارد کنید'; return; }
    if (body.type === 'PERCENT' && body.value > 100) { err.hidden = false; err.textContent = 'درصد باید حداکثر ۱۰۰ باشد'; return; }
    try { await api('/coupons', { method: 'POST', body }); toast('کد ساخته شد'); m.close(); done(); } catch (e) { err.hidden = false; err.textContent = errMsg(e); }
  } });
  const m = modal({ title: 'کد تخفیف جدید', body: h('div', { class: 'form-grid' }, h('div', { class: 'field' }, h('label', { text: 'کد' }), code), h('div', { class: 'field' }, h('label', { text: 'نوع' }), type), h('div', { class: 'field' }, h('label', { text: 'مقدار' }), value), h('div', { class: 'field' }, h('label', { text: 'حداکثر استفاده' }), max), h('div', { class: 'field full' }, h('label', { text: 'تاریخ انقضا (اختیاری)' }), exp), h('div', { class: 'full' }, err)), footer: [ok, button('انصراف', { onClick: () => m.close() })] });
}

/* ================================== Support ================================== */
export function support(ctx, root) {
  root.append(pageHead('پشتیبانی', 'تیکت‌های کاربران'));
  const card = h('div', { class: 'card' });
  const split = h('div', { class: 'split' });
  const listPane = h('div', { class: 'pane-list' });
  const detail = h('div', { class: 'pane-detail' });
  split.append(listPane, detail); card.append(split); root.append(card);
  const renderDetail = () => {
    const id = ctx.query().get('id');
    split.classList.toggle('has-detail', !!id);
    clear(detail);
    if (!id) return void detail.append(emptyState('یک تیکت را انتخاب کنید', 'گفتگو و پاسخ در این بخش نمایش داده می‌شود.', 'headset'));
    openTicket(ctx, id, detail, () => { ctx.setQuery({ id: '' }); renderDetail(); }, () => lp.load());
  };
  const lp = listPage(ctx, listPane, {
    bare: true, endpoint: '/tickets', search: 'جستجو: موضوع یا کاربر', filters: [['', 'همه'], ['OPEN', 'باز'], ['ANSWERED', 'پاسخ‌داده'], ['CLOSED', 'بسته']],
    emptyTitle: 'تیکتی وجود ندارد', emptyText: 'تیکت‌های کاربران اینجا نمایش داده می‌شوند.', emptyIcon: 'headset',
    columns: [{ label: 'تیکت', render: (t) => h('div', null,
      h('div', { class: 'row between', style: 'gap:8px' }, h('span', { class: 'cell-main', text: t.subject }), badge(STATUS.ticket, t.status)),
      h('div', { class: 'cell-sub', text: `${STATUS.category[t.category]} · ${t.user.username ? '@' + t.user.username : t.user.telegramId} · ${ago(t.updatedAt)}` }),
      t.lastMessage ? h('div', { class: 'cell-sub', text: `${t.lastMessage.fromAdmin ? 'شما: ' : ''}${t.lastMessage.text}` }) : null) }],
    onRow: (t) => { ctx.setQuery({ id: t.id }); renderDetail(); },
  });
  renderDetail();
}
async function openTicket(ctx, id, root, onBack, onChange) {
  root.append(h('div', { class: 'card-b' }, skeletonBlock(200)));
  const load = async () => {
    try {
      const t = await api(`/tickets/${id}`);
      clear(root);
      const ta = h('textarea', { class: 'textarea', placeholder: 'پاسخ خود را بنویسید…', maxlength: '3000', 'aria-label': 'پاسخ', disabled: t.status === 'CLOSED' });
      const send = button('ارسال', { kind: 'primary', ico: 'send', disabled: t.status === 'CLOSED', onClick: async () => {
        if (!ta.value.trim()) return;
        try { await api(`/tickets/${id}/reply`, { method: 'POST', body: { text: ta.value.trim() } }); toast('پاسخ ارسال شد'); onChange(); load(); } catch (e) { toast(errMsg(e), 'err'); }
      } });
      const body = h('div', { class: 'chat-body' }, t.messages.map((m) => h('div', { class: `bubble ${m.fromAdmin ? 'admin' : ''}` }, m.text, h('time', { text: `${m.fromAdmin ? 'پشتیبان' : 'کاربر'} · ${datetime(m.createdAt)}` }))));
      root.append(h('div', { class: 'chat' },
        h('div', { class: 'card-h' }, h('div', { class: 'row' }, h('button', { class: 'btn ghost icon-only sm menu-btn', 'aria-label': 'بازگشت', onClick: onBack }, icon('chevr')), h('div', null, h('h3', { text: t.subject }), h('div', { class: 'cell-sub', text: `${STATUS.category[t.category]} · ${t.user.firstName || ''} ${t.user.username ? '@' + t.user.username : ''} · ${t.user.telegramId}` }))),
          h('div', { class: 'row' }, badge(STATUS.ticket, t.status), t.status !== 'CLOSED' ? button('بستن تیکت', { size: 'sm', onClick: async () => { if (!(await confirmDialog({ title: 'بستن تیکت', message: 'تیکت بسته شود؟ کاربر دیگر نمی‌تواند پاسخ دهد.', confirmLabel: 'بستن' }))) return; try { await api(`/tickets/${id}/close`, { method: 'POST' }); toast('تیکت بسته شد'); onChange(); load(); } catch (e) { toast(errMsg(e), 'err'); } } }) : null)),
        body, h('div', { class: 'chat-f' }, ta, send)));
      body.scrollTop = body.scrollHeight;
    } catch (e) { clear(root); root.append(errorState(errMsg(e), load)); }
  };
  load();
}

/* ================================ Notifications ================================ */
export function notifications(ctx, root) {
  const flush = button('ارسال مجدد صف', { ico: 'refresh', onClick: async () => { try { const r = await api('/notifications/flush', { method: 'POST' }); toast(`${num(r.attempted)} اعلان بررسی شد`); lp.load(); } catch (e) { toast(errMsg(e), 'err'); } } });
  root.append(pageHead('اعلان‌ها', 'صف پیام‌های ارسالی به کاربران و ادمین‌ها', flush));
  const counts = h('div', { class: 'stats' });
  root.append(counts);
  const lp = listPage(ctx, root, {
    endpoint: '/notifications', search: false, filters: [['', 'همه'], ['PENDING', 'در صف'], ['SENT', 'ارسال‌شده'], ['FAILED', 'ناموفق']],
    emptyTitle: 'اعلانی ثبت نشده', emptyText: 'پیام‌های سیستم بعد از اولین رویداد اینجا نمایش داده می‌شوند.', emptyIcon: 'bell',
    onData: (d) => { clear(counts); counts.append(...[['در صف', d.counts.PENDING || 0, 'clock', 'warn'], ['ارسال‌شده', d.counts.SENT || 0, 'check', 'ok'], ['ناموفق', d.counts.FAILED || 0, 'alert', 'err']].map(([l, v, i, t]) => h('div', { class: 'card stat' }, h('div', { class: 'stat-top' }, h('span', { text: l }), h('span', { class: `stat-ico ${t}` }, icon(i))), h('div', { class: 'stat-v', text: num(v) })))); },
    columns: [
      { label: 'نوع', render: (n) => h('div', null, ltr(n.type, 'mono'), h('div', { class: 'cell-sub', text: n.audience === 'ADMIN' ? 'ادمین' : 'کاربر' })) },
      { label: 'متن', render: (n) => h('div', { style: 'max-width:420px' }, h('div', { text: n.text }), n.lastError ? h('div', { class: 'cell-sub', style: 'color:var(--err)', text: n.lastError }) : null) },
      { label: 'وضعیت', render: (n) => badge(STATUS.notif, n.status) }, { label: 'تلاش', cls: 'num', render: (n) => num(n.attempts) }, { label: 'زمان', render: (n) => datetime(n.createdAt) },
    ],
  });
}

/* ================================== Settings ================================== */
export async function settings(ctx, root) {
  root.append(pageHead('تنظیمات', 'پرداخت، تأیید خودکار، provisioning و اتصال X-UI'));
  const wrap = h('div', { class: 'stack' }, skeletonBlock(200), skeletonBlock(200)); root.append(wrap);
  let d;
  try { d = await api('/settings'); } catch (e) { clear(wrap); return void wrap.append(errorState(errMsg(e), () => { clear(root); settings(ctx, root); })); }
  const S = d.settings;
  const save = async (key, value, cb) => { try { await api('/settings', { method: 'PUT', body: { key, value } }); S[key] = value; toast('ذخیره شد'); cb?.(); return true; } catch (e) { toast(errMsg(e), 'err'); return false; } };
  const toggle = (key, label, hint) => { const sw = h('button', { type: 'button', class: 'switch', role: 'switch', 'aria-checked': String(S[key] === 'true'), 'aria-label': label });
    sw.addEventListener('click', async () => { if (sw.disabled) return; sw.disabled = true; const next = sw.getAttribute('aria-checked') !== 'true'; if (await save(key, String(next))) sw.setAttribute('aria-checked', String(next)); sw.disabled = false; });
    return h('div', { class: 'row between', style: 'padding:12px 0;border-bottom:1px solid var(--border)' }, h('div', null, h('div', { class: 'cell-main', text: label }), hint ? h('div', { class: 'cell-sub', text: hint }) : null), sw); };
  const choice = (key, label, opts, hint) => { const sel = h('select', { class: 'select', style: 'max-width:240px', 'aria-label': label }, opts.map(([v, l]) => h('option', { value: v, selected: S[key] === v }, l)));
    sel.addEventListener('change', async () => { sel.disabled = true; if (!(await save(key, sel.value))) sel.value = S[key]; sel.disabled = false; });
    return h('div', { class: 'row between', style: 'padding:12px 0;border-bottom:1px solid var(--border)' }, h('div', null, h('div', { class: 'cell-main', text: label }), hint ? h('div', { class: 'cell-sub', text: hint }) : null), sel); };
  const text = (key, label, o = {}) => { const inp = h('input', { class: `input ${o.ltr ? 'ltr' : ''}`, dir: o.ltr ? 'ltr' : false, value: S[key], style: 'width:240px;flex:none', 'aria-label': label, inputmode: o.num ? 'numeric' : false });
    const b = button('ذخیره', { size: 'sm', onClick: async () => { await save(key, inp.value.trim()); } });
    return h('div', { class: 'row between', style: 'padding:12px 0;border-bottom:1px solid var(--border)' }, h('div', null, h('div', { class: 'cell-main', text: label }), o.hint ? h('div', { class: 'cell-sub', text: o.hint }) : null), h('div', { class: 'row', style: 'gap:6px;flex-wrap:nowrap' }, inp, b)); };
  const section = (title, sub, ...rows) => h('div', { class: 'card' }, h('div', { class: 'card-h' }, h('div', null, h('h3', { text: title }), h('div', { class: 'cell-sub', text: sub }))), h('div', { class: 'card-b', style: 'padding-block:4px' }, rows));
  const xuiBox = h('div', { class: 'row between', style: 'padding:12px 0' });
  const checkXui = async () => { clear(xuiBox); xuiBox.append(h('span', { class: 'row' }, h('span', { class: 'spinner sm' }), 'در حال بررسی اتصال…'));
    try { const r = await api('/xui/status'); clear(xuiBox); xuiBox.append(h('div', null, h('div', { class: 'row' }, h('span', { class: `badge ${r.ok ? 'ok' : 'err'}`, text: r.ok ? 'متصل' : 'خطا' }), h('span', { class: 'cell-main', text: `Provider: ${r.provider}` })), h('div', { class: 'cell-sub', text: r.detail })), button('تست مجدد', { ico: 'refresh', onClick: checkXui })); } catch (e) { clear(xuiBox); xuiBox.append(errorState(errMsg(e), checkXui)); } };
  const rt = d.runtime;
  const info = (label, ok, okText, noText) => h('div', { class: 'row between', style: 'padding:10px 0;border-bottom:1px solid var(--border)' }, h('span', { text: label }), h('span', { class: `badge ${ok ? 'ok' : 'warn'}`, text: ok ? okText : noText }));
  clear(wrap);
  wrap.append(
    section('کارت‌به‌کارت', 'اطلاعاتی که کاربر هنگام پرداخت می‌بیند', toggle('card.enabled', 'فعال بودن کارت‌به‌کارت'), text('card.holder', 'نام دارنده کارت'), text('card.number', 'شماره کارت', { ltr: true, num: true, hint: '۱۶ رقم' }), text('card.bank', 'بانک'), text('card.instructions', 'توضیحات پرداخت', { hint: 'اختیاری' })),
    section('تأیید خودکار و ریسک', 'پیش‌فرض‌ها امن‌اند: رسید تنها هرگز تأیید قطعی نیست', choice('verification.mode', 'حالت تأیید', [['AUTO_VERIFICATION', 'تأیید خودکار (با لجر بانک)'], ['MANUAL_REVIEW', 'همیشه بررسی دستی']]),
      choice('verification.provider', 'منبع تأیید', [['ledger', 'لجر تراکنش‌های بانکی'], ['none', 'هیچ (همه به بررسی دستی)']]), toggle('verification.allowReceiptOnlyAutoApprove', 'تأیید خودکار فقط با رسید', 'پیشنهاد نمی‌شود؛ بدون تأیید بانکی ریسک دارد'),
      choice('risk.highAction', 'رفتار در ریسک بالا', [['MANUAL_REVIEW', 'بررسی دستی'], ['REJECT', 'رد خودکار']]), text('risk.mediumAt', 'آستانه ریسک متوسط', { num: true }), text('risk.highAt', 'آستانه ریسک بالا', { num: true }), text('risk.maxSubmissions24h', 'حداکثر ارسال رسید در ۲۴ ساعت', { num: true })),
    section('Provisioning و اعلان‌ها', 'تلاش مجدد خودکار و یادآوری انقضا', text('provisioning.maxRetries', 'حداکثر تلاش مجدد', { num: true }), text('provisioning.backoffSeconds', 'فاصله تلاش‌ها (ثانیه)', { ltr: true, hint: 'مثال: 60,300,900' }), text('notify.expiryDays', 'یادآوری انقضا (روز مانده)', { ltr: true, hint: 'مثال: 3,1' }), text('orders.expireMinutes', 'انقضای سفارش پرداخت‌نشده (دقیقه)', { num: true })),
    section('اتصال X-UI', 'اعتبارنامه‌ها فقط در env سرور نگه‌داری می‌شوند و در پنل نمایش داده نمی‌شوند', xuiBox, info('Provider', rt.vpnProvider === 'xui', 'X-UI واقعی', rt.vpnProvider), info('احراز هویت', rt.xuiAuth !== 'none', rt.xuiAuth === 'api-token' ? 'API Token' : 'نام کاربری/رمز', 'تنظیم نشده'), info('لینک Subscription', rt.xuiSubscription, 'فعال', 'غیرفعال (XUI_SUB_BASE_URL)')),
    section('سیستم', 'وضعیت اجزای محیطی', info('Webhook تراکنش‌های بانکی', rt.bankWebhook, 'پیکربندی شده', 'پیکربندی نشده — تأیید خودکار ممکن نیست'), info('پرداخت کریپتو', false, '', 'غیرفعال تا اتصال تأییدکننده‌ی زنجیره'), info('محیط اجرا', rt.nodeEnv === 'production', 'Production', rt.nodeEnv)));
  checkXui();
}

/* =================================== Audit =================================== */
export function audit(ctx, root) {
  root.append(pageHead('Audit Logs', 'ثبت تغییرات و عملیات حساس (بدون اطلاعات محرمانه)'));
  const actions = [['', 'همه'], ['payment', 'پرداخت'], ['vpn', 'VPN'], ['product', 'محصول'], ['order', 'سفارش'], ['setting', 'تنظیمات'], ['admin', 'ورود ادمین']];
  listPage(ctx, root, {
    endpoint: '/audit', filterKey: 'action', filters: actions, search: 'جستجو: actor، عملیات یا شناسه', emptyTitle: 'رویدادی ثبت نشده', emptyText: 'عملیات حساس بعد از اجرا اینجا ثبت می‌شوند.', emptyIcon: 'audit',
    columns: [
      { label: 'زمان', render: (a) => datetime(a.createdAt) }, { label: 'Actor', render: (a) => ltr(a.actor, 'mono') }, { label: 'عملیات', render: (a) => h('span', { class: 'badge plain brand' }, ltr(a.action, 'mono')) },
      { label: 'هدف', render: (a) => (a.target ? h('span', null, a.target, ' ', ltr((a.targetId || '').slice(-8), 'mono')) : '—') },
      { label: 'جزئیات', render: (a) => (a.metadata ? h('code', { class: 'mono cell-sub ltr', style: 'max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block', title: JSON.stringify(a.metadata), text: JSON.stringify(a.metadata) }) : '—') },
      { label: 'IP', render: (a) => (a.ip ? ltr(a.ip, 'mono') : '—') },
    ],
  });
}

/* ================================= Categories ================================= */
export function categories(ctx, root) {
  const nb = button('دسته‌ی جدید', { kind: 'primary', ico: 'plus', onClick: () => categoryForm(null, null, [], reload) });
  root.append(pageHead('دسته‌بندی منوی خرید', 'ساختار منوی «خرید VPN» در ربات: دسته، زیرمجموعه و محصولات', nb));
  root.append(h('div', { class: 'callout' }, icon('info'), h('div', { text: 'مشتری ابتدا دسته‌ها را می‌بیند و با انتخاب هر دسته، زیرمجموعه‌ها و پلن‌های آن باز می‌شود (تا ۳ سطح). دسته‌ای که محصول فعال نداشته باشد یا غیرفعال باشد برای مشتری نمایش داده نمی‌شود.' })));
  const card = h('div', { class: 'card' }); root.append(card);
  async function reload() {
    clear(card); card.append(h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, skeletonRows(5, 4))));
    try {
      const { items } = await api('/categories'); clear(card);
      if (!items.length) return void card.append(emptyState('هنوز دسته‌ای نساخته‌اید', 'مثلاً «ماهانه» و «حجمی» بسازید و محصولات را داخلشان قرار دهید. تا وقتی دسته‌ای نباشد، همه‌ی پلن‌ها در صفحه‌ی اول نمایش داده می‌شوند.', 'folder', button('ساخت اولین دسته', { kind: 'primary', ico: 'plus', onClick: () => categoryForm(null, null, [], reload) })));
      const sib = (c) => items.filter((x) => x.parentId === c.parentId);
      card.append(table([
        { label: 'دسته', cls: 'wrap', render: (c) => h('div', { style: `padding-inline-start:${c.depth * 30}px` }, h('div', { class: 'cell-main', text: `${c.depth ? '↳ ' : ''}${c.icon || '📁'} ${c.name}` }), c.description ? h('div', { class: 'cell-sub', text: c.description }) : null) },
        { label: 'محصولات', cls: 'num', render: (c) => h('span', { title: 'مستقیم در این دسته (فعال در کل شاخه)' }, `${num(c.productCount)} (${num(c.activeProductCount)} فعال در شاخه)`) },
        { label: 'وضعیت', render: (c) => h('span', { class: `badge ${c.isActive ? 'ok' : ''}`, text: c.isActive ? 'فعال' : 'غیرفعال' }) },
        { label: '', render: (c) => h('div', { class: 'actions' },
          button('', { size: 'sm', kind: 'ghost', ico: 'up', title: 'بالا', disabled: sib(c)[0].id === c.id, onClick: async () => { try { await api(`/categories/${c.id}/move`, { method: 'POST', body: { dir: 'up' } }); reload(); } catch (e) { toast(errMsg(e), 'err'); } } }),
          button('', { size: 'sm', kind: 'ghost', ico: 'down', title: 'پایین', disabled: sib(c).at(-1).id === c.id, onClick: async () => { try { await api(`/categories/${c.id}/move`, { method: 'POST', body: { dir: 'down' } }); reload(); } catch (e) { toast(errMsg(e), 'err'); } } }),
          c.depth < 2 ? button('', { size: 'sm', kind: 'ghost', ico: 'plus', title: 'زیرمجموعه', onClick: () => categoryForm(null, c.id, items, reload) }) : null,
          button('', { size: 'sm', kind: 'ghost', ico: 'edit', title: 'ویرایش / انتقال', onClick: () => categoryForm(c, c.parentId, items, reload) }),
          button('', { size: 'sm', kind: 'ghost', ico: c.isActive ? 'pause' : 'play', title: c.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی', onClick: async () => { try { await api(`/categories/${c.id}`, { method: 'PATCH', body: { isActive: !c.isActive } }); reload(); } catch (e) { toast(errMsg(e), 'err'); } } }),
          button('', { size: 'sm', kind: 'ghost', ico: 'trash', title: 'حذف', onClick: async () => { if (!(await confirmDialog({ title: 'حذف دسته', message: `«${c.name}» حذف شود؟ محصولات داخلش به دسته‌ی بالاتر (یا صفحه‌ی اول) منتقل می‌شوند. اگر زیرمجموعه داشته باشد حذف نمی‌شود.`, confirmLabel: 'حذف', kind: 'danger' }))) return; try { const r = await api(`/categories/${c.id}`, { method: 'DELETE' }); toast(r.movedProducts ? `دسته حذف شد؛ ${num(r.movedProducts)} محصول منتقل شد` : 'دسته حذف شد'); reload(); } catch (e) { toast(errMsg(e), 'err'); } } })) },
      ], items));
    } catch (e) { clear(card); card.append(errorState(errMsg(e), reload)); }
  }
  reload();
}
function categoryForm(cat, parentId, all, done) {
  const name = h('input', { class: 'input', value: cat?.name || '', maxlength: '40', 'aria-label': 'نام دسته' });
  const iconIn = h('input', { class: 'input', value: cat?.icon || '', maxlength: '8', placeholder: '📁', 'aria-label': 'آیکون' });
  const desc = h('input', { class: 'input', value: cat?.description || '', maxlength: '300', placeholder: 'اختیاری؛ زیر عنوان به مشتری نمایش داده می‌شود', 'aria-label': 'توضیح' });
  const banned = new Set(); // can't move into itself or its descendants
  if (cat) { banned.add(cat.id); let grew = true; while (grew) { grew = false; for (const c of all) if (c.parentId && banned.has(c.parentId) && !banned.has(c.id)) { banned.add(c.id); grew = true; } } }
  const parent = h('select', { class: 'select', 'aria-label': 'دسته‌ی والد' }, h('option', { value: '' }, '🏠 سطح اول'), all.filter((c) => !banned.has(c.id) && c.depth < 2).map((c) => h('option', { value: c.id, selected: parentId === c.id }, catLabel(c))));
  const err = h('div', { class: 'form-error', hidden: true });
  const ok = button(cat ? 'ذخیره' : 'ایجاد', { kind: 'primary', onClick: async () => {
    const body = { name: name.value.trim(), icon: iconIn.value.trim() || null, description: desc.value.trim() || null, parentId: parent.value || null };
    if (!body.name) { err.hidden = false; err.textContent = 'نام دسته را وارد کنید'; return; }
    try { await api(cat ? `/categories/${cat.id}` : '/categories', { method: cat ? 'PATCH' : 'POST', body }); toast(cat ? 'ذخیره شد' : 'دسته ساخته شد'); m.close(); done(); } catch (e) { err.hidden = false; err.textContent = errMsg(e); }
  } });
  const m = modal({ title: cat ? 'ویرایش دسته' : 'دسته‌ی جدید', body: h('div', { class: 'form-grid' }, h('div', { class: 'field' }, h('label', { text: 'نام' }), name), h('div', { class: 'field' }, h('label', { text: 'آیکون (ایموجی)' }), iconIn), h('div', { class: 'field full' }, h('label', { text: 'توضیح' }), desc), h('div', { class: 'field full' }, h('label', { text: 'قرار گرفتن در' }), parent), h('div', { class: 'full' }, err)), footer: [ok, button('انصراف', { onClick: () => m.close() })] });
}
