/* UI toolkit: element builder, icons, formatters, toasts, modals, drawers, tables, states. No innerHTML with data → XSS-safe. */

const NS = 'http://www.w3.org/2000/svg';
// Null-safe append: conditional children (null/false) never render as the text "null".
const nativeAppend = Element.prototype.append;
Element.prototype.append = function (...nodes) { return nativeAppend.apply(this, nodes.flat(Infinity).filter((n) => n != null && n !== false)); };
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, kids);
  return el;
}
export function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return el;
}
export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

const ICONS = {
  dashboard: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  box: 'M21 8l-9-5-9 5v8l9 5 9-5zM3.3 7.5L12 12.5l8.7-5M12 22V12.5',
  receipt: 'M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM9 8h6M9 12h6',
  card: 'M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zM2 10h20M6 15h4',
  shield: 'M12 3l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6zM9 12l2 2 4-4',
  ticket: 'M3 9a2 2 0 0 0 0 6v3h18v-3a2 2 0 0 1 0-6V6H3zM13 6v12',
  headset: 'M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v5H5a1 1 0 0 1-1-1zM20 14h-3v5h2a1 1 0 0 0 1-1zM18 19c0 1.5-2 2-6 2',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1',
  audit: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16M21 21l-4.3-4.3',
  plus: 'M12 5v14M5 12h14',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  trash: 'M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6',
  refresh: 'M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12a9 9 0 0 1 15.5-6.2L21 8M3 21v-5h5M21 3v5h-5',
  check: 'M20 6L9 17l-5-5',
  x: 'M18 6L6 18M6 6l12 12',
  alert: 'M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0M12 9v4M12 17h.01',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 16v-4M12 8h.01',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8',
  menu: 'M3 6h18M3 12h18M3 18h18',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
  pause: 'M6 4h4v16H6zM14 4h4v16h-4z',
  play: 'M6 4l14 8-14 8z',
  send: 'M22 2L11 13M22 2l-7 20-4-9-9-4z',
  chevl: 'M15 18l-6-6 6-6',
  chevr: 'M9 18l6-6-6-6',
  copy: 'M9 9h11v11H9zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.5 5.1L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1',
  bot: 'M12 8V4H8M4 12a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM2 15h2M20 15h2M9 14v1M15 14v1',
  wallet: 'M20 12V8H6a2 2 0 0 1 0-4h12v4M4 6v12a2 2 0 0 0 2 2h14v-4M18 12a2 2 0 0 0 0 4h4v-4z',
  zap: 'M13 2L3 14h9l-1 8 10-12h-9z',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 6v6l4 2',
  scan: 'M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10',
};
export function icon(name, cls = '') {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', `icon ${cls}`); s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(NS, 'path'); p.setAttribute('d', ICONS[name] || ICONS.info); s.append(p);
  return s;
}

/* ---------- formatters (Persian digits + Jalali for display; Latin LTR for codes) ---------- */
const FA = '۰۱۲۳۴۵۶۷۸۹';
export const faDigits = (s) => String(s).replace(/\d/g, (d) => FA[d]);
export const num = (n) => (n == null ? '—' : faDigits(Number(n).toLocaleString('en-US')));
export const money = (n) => (n == null ? '—' : `${num(n)} تومان`);
export function moneyShort(n) {
  n = Number(n) || 0;
  const t = (x) => faDigits(x.toFixed(1).replace(/\.0$/, ''));
  if (n >= 1e9) return `${t(n / 1e9)} میلیارد`;
  if (n >= 1e6) return `${t(n / 1e6)} میلیون`;
  if (n >= 1e3) return `${faDigits(Math.round(n / 1e3))} هزار`;
  return faDigits(n);
}
const dtf = new Intl.DateTimeFormat('fa-IR-u-nu-latn', { dateStyle: 'medium', timeZone: 'Asia/Tehran' });
const dtf2 = new Intl.DateTimeFormat('fa-IR-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tehran' });
export const date = (d) => (d ? faDigits(dtf.format(new Date(d))) : '—');
export const datetime = (d) => (d ? faDigits(dtf2.format(new Date(d))) : '—');
export function ago(d) {
  if (!d) return '—';
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'همین الان';
  if (s < 3600) return `${faDigits(Math.floor(s / 60))} دقیقه پیش`;
  if (s < 86400) return `${faDigits(Math.floor(s / 3600))} ساعت پیش`;
  if (s < 86400 * 30) return `${faDigits(Math.floor(s / 86400))} روز پیش`;
  return date(d);
}
export function bytes(b) {
  const n = Number(b);
  if (!n) return faDigits('0') + ' MB';
  if (n >= 1073741824) return `${faDigits((n / 1073741824).toFixed(n >= 1.07e10 ? 0 : 1))} GB`;
  return `${faDigits((n / 1048576).toFixed(0))} MB`;
}
export const ltr = (t, cls = '') => h('span', { class: `ltr ${cls}`.trim(), text: t });
export const debounce = (fn, ms = 350) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/* ---------- status vocab (Persian label, English in tooltip) ---------- */
export const STATUS = {
  order: {
    PENDING_PAYMENT: ['در انتظار پرداخت', 'warn', 'Pending Payment'], PAYMENT_SUBMITTED: ['رسید ارسال شد', 'info', 'Payment Submitted'], PAYMENT_REVIEW: ['در بررسی', 'warn', 'Payment Review'],
    PAID: ['پرداخت‌شده', 'info', 'Paid'], PROVISIONING: ['در حال راه‌اندازی', 'brand', 'Provisioning'], FULFILLED: ['تحویل‌شده', 'ok', 'Fulfilled'], CANCELLED: ['لغو شده', '', 'Cancelled'], REFUNDED: ['بازگشت وجه', '', 'Refunded'],
  },
  payment: { PENDING: ['در انتظار', ''], SUBMITTED: ['ارسال‌شده', 'info'], NEEDS_REVIEW: ['نیازمند بررسی', 'warn'], APPROVED: ['تأییدشده', 'ok'], REJECTED: ['ردشده', 'err'], CANCELLED: ['لغو شده', ''] },
  verification: { VERIFIED: ['تأییدشده بانکی', 'ok'], REJECTED: ['ردشده', 'err'], NEEDS_REVIEW: ['نیاز به بررسی', 'warn'], UNKNOWN: ['نامشخص', ''] },
  risk: { LOW: ['کم', 'ok'], MEDIUM: ['متوسط', 'warn'], HIGH: ['زیاد', 'err'] },
  service: { ACTIVE: ['فعال', 'ok'], EXPIRED: ['منقضی', 'err'], SUSPENDED: ['معلق', 'warn'], CANCELLED: ['لغو شده', ''] },
  prov: { SUCCESS: ['موفق', 'ok'], FAILED: ['ناموفق', 'err'], PROCESSING: ['در حال انجام', 'info'], PENDING: ['در صف', 'warn'] },
  ticket: { OPEN: ['باز', 'warn'], ANSWERED: ['پاسخ داده شد', 'ok'], CLOSED: ['بسته', ''] },
  notif: { PENDING: ['در صف', 'warn'], SENT: ['ارسال‌شده', 'ok'], FAILED: ['ناموفق', 'err'] },
  category: { VPN_ISSUE: 'مشکل VPN', PAYMENT_ISSUE: 'مشکل پرداخت', RENEWAL: 'تمدید', OTHER: 'سایر' },
  method: { CARD_TO_CARD: 'کارت‌به‌کارت', CRYPTO: 'کریپتو', ONLINE_GATEWAY: 'درگاه' },
};
export function badge(map, key, extra = {}) {
  const v = map[key];
  if (!v) return h('span', { class: 'badge', text: key ?? '—' });
  return h('span', { class: `badge ${v[1] || ''} ${extra.plain ? 'plain' : ''}`.trim(), title: v[2] || key }, v[0]);
}

/* ---------- toast ---------- */
let toastBox;
export function toast(message, kind = 'ok', ms = 4200) {
  toastBox ??= document.body.appendChild(h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }));
  const t = h('div', { class: `toast ${kind}` }, icon(kind === 'ok' ? 'check' : kind === 'err' ? 'alert' : 'info'), h('div', { text: message }));
  toastBox.append(t);
  setTimeout(() => t.remove(), ms);
}

/* ---------- overlays ---------- */
const openOverlays = [];
function mountOverlay(node, side, onClose) {
  const ov = h('div', { class: `overlay ${side ? 'side' : ''}`.trim() }, node);
  const close = () => { ov.remove(); openOverlays.splice(openOverlays.indexOf(entry), 1); document.body.style.overflow = ''; onClose?.(); entry.prev?.focus?.(); };
  const entry = { close, prev: document.activeElement };
  ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });
  openOverlays.push(entry);
  document.body.append(ov); document.body.style.overflow = 'hidden';
  (node.querySelector('[autofocus],input,textarea,select') || node.querySelector('button'))?.focus();
  return close;
}
addEventListener('keydown', (e) => { if (e.key === 'Escape') openOverlays.at(-1)?.close(); });

export function modal({ title, body, footer, small, onClose }) {
  let close;
  const closeBtn = h('button', { class: 'btn ghost icon-only sm', 'aria-label': 'بستن', onClick: () => close() }, icon('x'));
  const node = h('div', { class: `modal ${small ? 'sm' : ''}`.trim(), role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, h('div', { class: 'modal-h' }, h('h2', { text: title }), closeBtn), h('div', { class: 'modal-b' }, body), footer ? h('div', { class: 'modal-f' }, footer) : null);
  close = mountOverlay(node, false, onClose);
  return { close, node };
}
export function drawer({ title, sub, body, footer, onClose }) {
  let close;
  const node = h('aside', { class: 'drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'modal-h' }, h('div', null, h('h2', { text: title }), sub ? h('div', { class: 'cell-sub', text: sub }) : null), h('button', { class: 'btn ghost icon-only sm', 'aria-label': 'بستن', onClick: () => close() }, icon('x'))),
    body, footer);
  close = mountOverlay(node, true, onClose);
  return { close, node };
}

/** Button with busy state: prevents double submit; shows spinner; restores afterwards. */
export function busyButton(btn, fn) {
  return async (e) => {
    if (btn.getAttribute('aria-busy') === 'true') return;
    btn.setAttribute('aria-busy', 'true'); btn.disabled = true;
    const sp = h('span', { class: 'spinner sm' });
    btn.prepend(sp);
    try { await fn(e); } finally { sp.remove(); btn.removeAttribute('aria-busy'); btn.disabled = false; }
  };
}
export function button(label, { kind = '', size = '', ico, onClick, title, disabled } = {}) {
  const b = h('button', { class: `btn ${kind} ${size}`.trim(), type: 'button', title, disabled }, ico ? icon(ico, 'sm') : null, label ? h('span', { text: label }) : null);
  if (onClick) b.addEventListener('click', busyButton(b, onClick));
  return b;
}

/** Confirmation dialog. Resolves true/false. `typed` demands an exact phrase (destructive ops). */
export function confirmDialog({ title, message, confirmLabel = 'تأیید', kind = 'primary', typed, details }) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const input = typed ? h('input', { class: 'input ltr', dir: 'ltr', placeholder: typed, autocomplete: 'off', 'aria-label': 'عبارت تأیید' }) : null;
    const ok = h('button', { class: `btn ${kind}`, type: 'button', disabled: !!typed }, confirmLabel);
    const cancel = h('button', { class: 'btn', type: 'button' }, 'انصراف');
    const m = modal({
      title, small: true, onClose: () => finish(false),
      body: h('div', { class: 'stack' }, h('p', { text: message }), details, typed ? h('div', { class: 'field' }, h('label', null, 'برای تأیید، دقیقاً این عبارت را تایپ کنید: ', h('span', { class: 'ltr mono', text: typed })), input) : null),
      footer: [ok, cancel],
    });
    input?.addEventListener('input', () => { ok.disabled = input.value !== typed; });
    ok.addEventListener('click', () => { finish(true); m.close(); });
    cancel.addEventListener('click', () => { finish(false); m.close(); });
  });
}

/* ---------- states ---------- */
export const skeletonRows = (cols, rows = 6) => h('tbody', null, Array.from({ length: rows }, () => h('tr', { class: 'skel-row' }, Array.from({ length: cols }, () => h('td', null, h('div', { class: 'skeleton', style: `width:${50 + Math.random() * 40}%` }))))));
export function emptyState(title, text, ico = 'inbox', action) {
  return h('div', { class: 'state' }, h('div', { class: 'state-ico' }, icon(ico)), h('h3', { text: title }), text ? h('p', { text }) : null, action);
}
export function errorState(message, retry) {
  return h('div', { class: 'state err' }, h('div', { class: 'state-ico' }, icon('alert')), h('h3', { text: 'خطا در دریافت اطلاعات' }), h('p', { text: message }), retry ? button('تلاش دوباره', { ico: 'refresh', onClick: retry }) : null);
}
export const skeletonBlock = (h2 = 120) => h('div', { class: 'skeleton', style: `height:${h2}px;border-radius:14px` });

/* ---------- API ---------- */
export class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
export async function api(path, { method = 'GET', body, query } = {}) {
  const qs = query ? '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== '' && v != null)).toString() : '';
  const res = await fetch(`/admin/api${path}${qs}`, { method, headers: { 'content-type': 'application/json', 'x-requested-with': 'admin-panel' }, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, json?.message || 'خطای ارتباط با سرور');
  return json;
}

/* ---------- table / pager / toolbar ---------- */
/** columns: [{ label, render(row)->Node|string, cls }]; rows rendered with data-label for mobile stacking. */
export function table(columns, rows, { onRow } = {}) {
  const t = h('table', { class: 'table' }, h('thead', null, h('tr', null, columns.map((c) => h('th', { text: c.label })))));
  const tb = h('tbody');
  for (const r of rows) {
    const tr = h('tr', { class: onRow ? 'clickable' : '', tabindex: onRow ? '0' : false });
    if (onRow) { tr.addEventListener('click', (e) => { if (!e.target.closest('button,a,input')) onRow(r); }); tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') onRow(r); }); }
    for (const c of columns) tr.append(h('td', { class: c.cls || '', 'data-label': c.label }, c.render(r)));
    tb.append(tr);
  }
  t.append(tb);
  return h('div', { class: 'table-wrap' }, t);
}
export function pager({ page, pageSize, total }, go) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0, to = Math.min(total, page * pageSize);
  return h('div', { class: 'pager' }, h('span', { text: total ? `${num(from)}–${num(to)} از ${num(total)}` : 'بدون نتیجه' }),
    h('div', { class: 'pg' }, h('button', { class: 'btn sm icon-only', 'aria-label': 'صفحه بعد', disabled: page >= pages, onClick: () => go(page + 1) }, icon('chevl', 'sm')), h('span', { text: `${num(page)} / ${num(pages)}` }), h('button', { class: 'btn sm icon-only', 'aria-label': 'صفحه قبل', disabled: page <= 1, onClick: () => go(page - 1) }, icon('chevr', 'sm'))));
}
export function segmented(options, value, onChange) {
  return h('div', { class: 'seg', role: 'group' }, options.map(([v, label]) => h('button', { type: 'button', 'aria-pressed': String(v === value), onClick: () => onChange(v) }, label)));
}
export function searchBox(value, onInput, placeholder = 'جستجو…') {
  const input = h('input', { class: 'input', type: 'search', value: value || '', placeholder, 'aria-label': placeholder, autocomplete: 'off' });
  input.addEventListener('input', debounce(() => onInput(input.value.trim()), 350));
  return h('div', { class: 'search' }, icon('search', 'sm'), input);
}
export const kv = (pairs) => h('dl', { class: 'kv' }, pairs.filter(Boolean).flatMap(([k, v]) => [h('dt', { text: k }), h('dd', null, v ?? '—')]));
export async function copyText(t) { try { await navigator.clipboard.writeText(t); toast('کپی شد', 'ok', 1800); } catch { toast('کپی ممکن نشد', 'err'); } }
