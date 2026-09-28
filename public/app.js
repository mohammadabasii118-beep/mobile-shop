// فروشگاه — اپلیکیشن سمت کاربر
const $ = s => document.querySelector(s);
const app = $('#app');
let S = null; // shop data
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fa = n => Number(n).toLocaleString('fa-IR');
const money = n => `${fa(n)} <small>تومان</small>`;
const api = async (url, opts) => {
  const r = await fetch(url, opts && { ...opts, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(opts.body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'خطا در ارتباط با سرور');
  return j;
};
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2600); };
const safeUrl = u => /^(#|\/(?!\/)|https?:)/.test(u || '') ? u : '#/';
const bgOf = (o) => o.image ? `background-image:url('${esc(o.image)}')` : `background:${esc(o.gradient || 'linear-gradient(135deg,#7c3aed,#ec4899)')}`;

// ---- سبد خرید ----
const cart = {
  get: () => { try { return JSON.parse(localStorage.getItem('cart') || '[]'); } catch { return []; } },
  set(c) { localStorage.setItem('cart', JSON.stringify(c)); updateCount(); },
  add(productId, selected, qty) {
    const c = this.get(), key = JSON.stringify(selected);
    const e = c.find(x => x.productId === productId && JSON.stringify(x.selected) === key);
    e ? e.qty += qty : c.push({ productId, selected, qty });
    this.set(c);
  },
};
const updateCount = () => { const n = cart.get().reduce((s, x) => s + x.qty, 0); const b = $('#cartCount'); b.textContent = fa(n); b.dataset.n = n; };

// ---- دسته‌بندی ----
const catById = id => S.categories.find(c => c.id === id);
const children = id => S.categories.filter(c => c.parent === id);
const descendants = id => [id, ...children(id).flatMap(c => descendants(c.id))];
const catIcon = id => (catById(id) || {}).icon || '📦';
const GRADS = ['#a78bfa,#ec4899', '#38bdf8,#6366f1', '#fbbf24,#f97316', '#34d399,#0ea5e9', '#fb7185,#a855f7', '#2dd4bf,#22c55e'];
const phStyle = (p, i = 0) => p.images && p.images[0] ? `background-image:url('${esc(p.images[0])}')` : `background:linear-gradient(135deg,${GRADS[(p.id.charCodeAt(p.id.length - 1) + i) % GRADS.length]})`;
const phIcon = p => p.images && p.images[0] ? '' : catIcon(p.category);
const disc = p => p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;

function card(p) {
  const d = disc(p), extra = (p.options || []).map(o => o.name).join('، ');
  return `<a class="card fade" href="#/product/${esc(p.id)}">
    <div class="ph" style="${phStyle(p)}">${phIcon(p)}${d ? `<span class="off">${fa(d)}٪</span>` : ''}</div>
    <div class="info"><h3>${esc(p.name)}</h3>${extra ? `<div class="chips-mini">انتخاب: ${esc(extra)}</div>` : ''}
    ${p.stock < 1 ? '<div class="soldout">ناموجود</div>' : `<div class="price">${d ? `<del>${fa(p.oldPrice)}</del>` : ''}${money(p.price)}</div>`}</div></a>`;
}

// ---- هدر / منو ----
function buildChrome() {
  const s = S.settings;
  document.title = `${s.shopName} | لوازم جانبی موبایل`;
  $('#logo').innerHTML = '<span style="-webkit-text-fill-color:initial">📱</span> ' + esc(s.shopName);
  $('#topbar').textContent = `ارسال رایگان برای خرید بالای ${fa(s.freeShippingOver)} تومان 🚚`;
  const top = S.categories.filter(c => !c.parent);
  $('#nav').innerHTML = '<ul>' + top.map(c => {
    const ch = children(c.id);
    return `<li><a href="#/category/${esc(c.id)}">${esc(c.icon)} ${esc(c.name)}${ch.length ? ' ▾' : ''}</a>${ch.length ? `<div class="sub">${ch.map(x => `<a href="#/category/${esc(x.id)}">${esc(x.name)}</a>`).join('')}</div>` : ''}</li>`;
  }).join('') + '<li><a href="#/sale">🔥 تخفیف‌ها</a></li></ul>';
  $('#drawer').innerHTML = `<h3>${esc(s.shopName)}</h3>` + top.map(c => {
    const ch = children(c.id);
    return ch.length ? `<details><summary>${esc(c.icon)} ${esc(c.name)}</summary><a href="#/category/${esc(c.id)}">همه ${esc(c.name)}</a>${ch.map(x => `<a href="#/category/${esc(x.id)}">${esc(x.name)}</a>`).join('')}</details>`
      : `<a class="d-link" href="#/category/${esc(c.id)}">${esc(c.icon)} ${esc(c.name)}</a>`;
  }).join('') + '<a class="d-link" href="#/sale">🔥 تخفیف‌ها</a><a class="d-link" href="#/track">📦 پیگیری سفارش</a>';
  $('#footer').innerHTML = `<b>${esc(s.shopName)}</b><p>فروش تخصصی لوازم جانبی موبایل</p><p>📞 ${esc(s.phone)}</p><p>© ${new Date().toLocaleDateString("fa-IR", { year: "numeric" })} همه حقوق محفوظ است</p>`;
}
const openDrawer = v => document.body.classList.toggle('drawer-open', v);
$('#menuBtn').onclick = () => openDrawer(true);
$('#tabCats').onclick = e => { e.preventDefault(); openDrawer(true); };
$('#drawerBg').onclick = () => openDrawer(false);
$('#drawer').onclick = e => { if (e.target.closest('a')) openDrawer(false); };
$('#searchForm').onsubmit = e => { e.preventDefault(); const q = $('#searchInput').value.trim(); if (q) location.hash = '#/search/' + encodeURIComponent(q); };

// ---- اسلایدر ----
let sliderTimer;
function sliderHtml() {
  const b = S.banners; if (!b.length) return '';
  return `<section class="slider" id="slider" aria-roledescription="carousel">
    ${b.map((x, i) => `<a class="slide ${i ? '' : 'on'}" href="${esc(safeUrl(x.link))}" style="${bgOf(x)}"><div class="txt"><h2>${esc(x.title)}</h2><p>${esc(x.subtitle)}</p>${x.cta ? `<span class="cta">${esc(x.cta)}</span>` : ''}</div>${x.icon ? `<div class="ico">${esc(x.icon)}</div>` : ''}</a>`).join('')}
    ${b.length > 1 ? `<button class="s-btn s-prev" aria-label="قبلی">›</button><button class="s-btn s-next" aria-label="بعدی">‹</button>
    <div class="dots">${b.map((_, i) => `<button aria-label="بنر ${i + 1}" class="${i ? '' : 'on'}"></button>`).join('')}</div><div class="progress"></div>` : ''}</section>`;
}
function initSlider() {
  clearInterval(sliderTimer);
  const el = $('#slider'); if (!el) return;
  const slides = [...el.querySelectorAll('.slide')], dots = [...el.querySelectorAll('.dots button')], bar = el.querySelector('.progress');
  if (slides.length < 2) return;
  const DELAY = 5000; let i = 0, paused = false;
  el.style.setProperty('--d', DELAY + 'ms');
  const runBar = () => { bar.classList.remove('run'); void bar.offsetWidth; if (!paused) bar.classList.add('run'); };
  const go = n => { i = (n + slides.length) % slides.length; slides.forEach((s, k) => s.classList.toggle('on', k === i)); dots.forEach((d, k) => d.classList.toggle('on', k === i)); runBar(); };
  const tick = () => { if (!paused && document.body.contains(el)) go(i + 1); else if (!document.body.contains(el)) clearInterval(sliderTimer); };
  const restart = () => { clearInterval(sliderTimer); sliderTimer = setInterval(tick, DELAY); };
  // در RTL: دکمه راست = قبلی، چپ = بعدی
  el.querySelector('.s-prev').onclick = e => { e.preventDefault(); go(i - 1); restart(); };
  el.querySelector('.s-next').onclick = e => { e.preventDefault(); go(i + 1); restart(); };
  dots.forEach((d, k) => d.onclick = () => { go(k); restart(); });
  el.onmouseenter = () => { paused = true; bar.classList.remove('run'); };
  el.onmouseleave = () => { paused = false; runBar(); restart(); };
  let x0 = null;
  el.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; paused = true; }, { passive: true });
  el.addEventListener('touchend', e => { paused = false; if (x0 !== null) { const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 45) go(i + (dx > 0 ? -1 : 1)); } x0 = null; restart(); });
  runBar(); restart();
}

// ---- صفحات ----
function home() {
  const s = S.settings, act = S.products;
  const best = act.slice().sort((a, b) => b.sold - a.sold).slice(0, 10);
  const sale = act.filter(p => disc(p) > 0).sort((a, b) => disc(b) - disc(a)).slice(0, 10);
  const linkBox = (o, i, cls) => `<a class="${cls}" href="${esc(safeUrl(o.link))}" style="--i:${i}">${cls === 'box' ? `<div class="box-bg" style="position:absolute;inset:0;${bgOf(o)}"></div><span class="bi">${esc(o.icon)}</span><b>${esc(o.title)}</b><small>مشاهده ‹</small>` : `<div class="rc" style="${bgOf(o)}">${o.image ? '' : esc(o.icon)}</div><span>${esc(o.title)}</span>`}</a>`;
  app.innerHTML = `${sliderHtml()}
  <section class="boxes">${s.boxes.map((b, i) => linkBox(b, i, 'box')).join('')}</section>
  <div class="sec-h"><h2>دسته‌بندی‌های محبوب</h2></div>
  <div class="rail">${s.rail.map((b, i) => linkBox(b, i, 'rail-i')).join('')}</div>
  ${best.length ? `<div class="sec-h"><h2>🔥 پرفروش‌ترین‌ها</h2><a href="#/best">مشاهده همه ‹</a></div><div class="hrail">${best.map(card).join('')}</div>` : ''}
  ${sale.length ? `<div class="sec-h"><h2>🏷️ تخفیف‌خورده‌ها</h2><a href="#/sale">مشاهده همه ‹</a></div><div class="hrail">${sale.map(card).join('')}</div>` : ''}
  <div class="trust"><div><b>🚚</b>ارسال سریع به سراسر کشور</div><div><b>✅</b>ضمانت اصالت کالا</div><div><b>💳</b>پرداخت امن آنلاین</div><div><b>↩️</b>۷ روز مهلت بازگشت</div></div>`;
  initSlider();
}

function listPage(title, products, { crumbs = '', subs = '' } = {}) {
  const sortSel = `<select id="sort"><option value="new">جدیدترین</option><option value="sold">پرفروش‌ترین</option><option value="cheap">ارزان‌ترین</option><option value="exp">گران‌ترین</option><option value="disc">بیشترین تخفیف</option></select>`;
  app.innerHTML = `${crumbs}<h1 class="page-h">${esc(title)}</h1>${subs}<div class="toolbar">${sortSel}<label style="display:flex;gap:6px;align-items:center;font-size:14px"><input type="checkbox" id="onlyStock" style="width:auto"> فقط موجود</label><span style="color:var(--muted);font-size:13px">${fa(products.length)} کالا</span></div><div class="grid" id="lst"></div>`;
  const draw = () => {
    let l = products.slice();
    if ($('#onlyStock').checked) l = l.filter(p => p.stock > 0);
    const k = $('#sort').value;
    const cmp = { new: (a, b) => b.createdAt - a.createdAt, sold: (a, b) => b.sold - a.sold, cheap: (a, b) => a.price - b.price, exp: (a, b) => b.price - a.price, disc: (a, b) => disc(b) - disc(a) }[k];
    l.sort(cmp);
    $('#lst').innerHTML = l.length ? l.map(card).join('') : '<div class="empty" style="grid-column:1/-1"><div class="e">🔍</div>محصولی پیدا نشد</div>';
  };
  $('#sort').onchange = $('#onlyStock').onchange = draw; draw();
}

function categoryPage(id) {
  const c = catById(id); if (!c) return notFound();
  const path = []; for (let x = c; x; x = catById(x.parent)) path.unshift(x);
  const crumbs = `<div class="crumbs"><a href="#/">خانه</a>${path.map(p => ` / <a href="#/category/${esc(p.id)}">${esc(p.name)}</a>`).join('')}</div>`;
  const subs = children(id).length ? `<div class="subcats">${children(id).map(x => `<a class="pill" href="#/category/${esc(x.id)}">${esc(x.name)}</a>`).join('')}</div>`
    : c.parent ? `<div class="subcats">${children(c.parent).map(x => `<a class="pill ${x.id === id ? 'on' : ''}" href="#/category/${esc(x.id)}">${esc(x.name)}</a>`).join('')}</div>` : '';
  const ids = descendants(id);
  listPage(c.name, S.products.filter(p => ids.includes(p.category)), { crumbs, subs });
}

function productPage(id) {
  const p = S.products.find(x => x.id === id); if (!p) return notFound();
  const c = catById(p.category), sel = {}; let qty = 1, img = 0;
  const d = disc(p);
  const draw = () => {
    app.innerHTML = `<div class="crumbs"><a href="#/">خانه</a>${c ? ` / <a href="#/category/${esc(c.id)}">${esc(c.name)}</a>` : ''}</div>
    <div class="pd fade"><div class="gal"><div class="big" style="${p.images[img] ? `background-image:url('${esc(p.images[img])}')` : phStyle(p)}">${phIcon(p)}</div>
      ${p.images.length > 1 ? `<div class="thumbs">${p.images.map((u, i) => `<button data-i="${i}" class="${i === img ? 'on' : ''}" style="background-image:url('${esc(u)}')" aria-label="تصویر ${i + 1}"></button>`).join('')}</div>` : ''}</div>
    <div class="box2"><h1>${esc(p.name)}</h1>
      ${(p.options || []).map(o => `<div class="opt"><b>${esc(o.name)}${sel[o.name] ? `: <span style="color:var(--p)">${esc(sel[o.name])}</span>` : ''}</b><div class="chips">${o.values.map(v => `<button class="chip ${sel[o.name] === v ? 'on' : ''}" data-o="${esc(o.name)}" data-v="${esc(v)}">${esc(v)}</button>`).join('')}</div></div>`).join('')}
      <div class="big-price">${d ? `<del>${fa(p.oldPrice)}</del><span class="status canceled" style="margin-left:6px">${fa(d)}٪ تخفیف</span><br>` : ''}${money(p.price)}</div>
      ${p.stock < 1 ? '<div class="alert err">این کالا موقتاً ناموجود است</div>' : `<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><div class="qty"><button id="qm" aria-label="کم">−</button><span>${fa(qty)}</span><button id="qp" aria-label="زیاد">+</button></div><button class="btn" id="add" style="flex:1">افزودن به سبد خرید</button></div>${p.stock <= 5 ? `<p style="color:var(--bad);font-size:13px;margin-top:8px">فقط ${fa(p.stock)} عدد در انبار باقی مانده</p>` : ''}`}
      <p class="desc">${esc(p.desc)}</p></div></div>
    <div class="sec-h"><h2>محصولات مرتبط</h2></div><div class="hrail">${S.products.filter(x => x.category === p.category && x.id !== p.id).slice(0, 8).map(card).join('') || '<span style="color:var(--muted)">—</span>'}</div>`;
    app.querySelectorAll('.thumbs button').forEach(b => b.onclick = () => { img = +b.dataset.i; draw(); });
    app.querySelectorAll('.chip').forEach(b => b.onclick = () => { sel[b.dataset.o] = b.dataset.v; draw(); });
    const m = $('#qm'); if (m) { m.onclick = () => { qty = Math.max(1, qty - 1); draw(); }; $('#qp').onclick = () => { qty = Math.min(p.stock, 20, qty + 1); draw(); };
      $('#add').onclick = () => {
        const miss = (p.options || []).find(o => !sel[o.name]);
        if (miss) return toast(`لطفاً ${miss.name} را انتخاب کنید`);
        cart.add(p.id, sel, qty); toast('به سبد خرید اضافه شد ✅');
      }; }
  };
  draw();
}

function cartLines() {
  return cart.get().map(x => ({ ...x, p: S.products.find(p => p.id === x.productId) })).filter(x => x.p);
}
function totals(lines) {
  const sub = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
  const ship = !lines.length ? 0 : sub >= S.settings.freeShippingOver ? 0 : S.settings.shipping;
  return { sub, ship, total: sub + ship };
}
const summaryHtml = (t, extra = '') => `<div class="summary"><div class="row"><span>جمع کالاها</span><span>${money(t.sub)}</span></div><div class="row"><span>هزینه ارسال</span><span>${t.ship ? money(t.ship) : '<b style="color:var(--ok)">رایگان</b>'}</span></div><div class="row tot"><span>مبلغ قابل پرداخت</span><span>${money(t.total)}</span></div>${extra}</div>`;

function cartPage() {
  const lines = cartLines();
  if (!lines.length) { app.innerHTML = '<div class="empty"><div class="e">🛒</div><p>سبد خرید شما خالی است</p><br><a class="btn" href="#/">شروع خرید</a></div>'; return; }
  const t = totals(lines);
  app.innerHTML = `<h1 class="page-h">سبد خرید</h1><div class="cart-wrap"><div class="cart-l">${lines.map((l, i) => `<div class="cart-i fade"><div class="ph" style="${phStyle(l.p)}">${phIcon(l.p)}</div><div class="m"><b>${esc(l.p.name)}</b><small>${Object.entries(l.selected).map(([k, v]) => `${esc(k)}: ${esc(v)}`).join(' | ')}</small><div style="margin-top:6px">${money(l.p.price)}</div></div>
    <div style="display:grid;gap:6px;justify-items:center"><div class="qty"><button data-a="m" data-i="${i}">−</button><span>${fa(l.qty)}</span><button data-a="p" data-i="${i}">+</button></div><button data-a="d" data-i="${i}" style="color:var(--bad);font-size:13px">حذف</button></div></div>`).join('')}</div>
    ${summaryHtml(t, '<a class="btn block" href="#/checkout" style="margin-top:12px">ادامه و تسویه حساب</a>')}</div>`;
  app.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
    const c = cart.get(), i = +b.dataset.i, a = b.dataset.a;
    if (a === 'd') c.splice(i, 1); else if (a === 'm') c[i].qty = Math.max(1, c[i].qty - 1); else c[i].qty = Math.min(20, c[i].qty + 1);
    cart.set(c); cartPage();
  });
}

function checkoutPage() {
  const lines = cartLines();
  if (!lines.length) return location.hash = '#/cart';
  const t = totals(lines); let method = 'zarinpal';
  const saved = JSON.parse(localStorage.getItem('cust') || '{}');
  app.innerHTML = `<h1 class="page-h">اطلاعات ارسال و پرداخت</h1><form class="cart-wrap" id="f"><div class="form">
    <label>نام و نام خانوادگی<input name="name" required maxlength="80" value="${esc(saved.name)}" autocomplete="name"></label>
    <label>شماره موبایل<input name="phone" required inputmode="numeric" placeholder="09123456789" pattern="[0-9۰-۹]{11}" value="${esc(saved.phone)}" autocomplete="tel"></label>
    <label>شهر<input name="city" required maxlength="60" value="${esc(saved.city)}"></label>
    <label>آدرس کامل<textarea name="address" required rows="3" minlength="8" maxlength="400">${esc(saved.address)}</textarea></label>
    <label>کد پستی<input name="postal" inputmode="numeric" maxlength="10" value="${esc(saved.postal)}"></label>
    <label>توضیحات (اختیاری)<input name="note" maxlength="300"></label>
    <h3 style="margin-top:8px">روش پرداخت</h3>
    <label class="pay-opt on" data-m="zarinpal"><input type="radio" name="m" checked><span class="pi">💳</span><span><b>پرداخت آنلاین (درگاه بانکی)</b><small>پرداخت امن با تمام کارت‌های عضو شتاب</small></span></label>
    <label class="pay-opt" data-m="card"><input type="radio" name="m"><span class="pi">🏦</span><span><b>کارت به کارت</b><small>واریز به کارت فروشگاه و ارسال رسید</small></span></label>
    </div><div>${summaryHtml(t, '<button class="btn block" id="go" style="margin-top:12px">ثبت سفارش و پرداخت</button><div id="err"></div>')}</div></form>`;
  app.querySelectorAll('.pay-opt').forEach(o => o.onclick = () => { method = o.dataset.m; app.querySelectorAll('.pay-opt').forEach(x => x.classList.toggle('on', x === o)); o.querySelector('input').checked = true; });
  $('#f').onsubmit = async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target)); delete f.m;
    const btn = $('#go'); btn.disabled = true; btn.textContent = 'در حال ثبت ...'; $('#err').innerHTML = '';
    try {
      const r = await api('/api/orders', { method: 'POST', body: { ...f, method, items: lines.map(l => ({ productId: l.productId, qty: l.qty, selected: l.selected })) } });
      localStorage.setItem('cust', JSON.stringify(f));
      rememberOrder(r.order.code, r.order.customer.phone);
      cart.set([]);
      if (r.payUrl) location.href = r.payUrl; else location.hash = '#/order/' + r.order.code;
    } catch (er) { $('#err').innerHTML = `<div class="alert err">${esc(er.message)}</div>`; btn.disabled = false; btn.textContent = 'ثبت سفارش و پرداخت'; }
  };
}

const rememberOrder = (code, phone) => { const o = JSON.parse(localStorage.getItem('orders') || '{}'); o[code] = phone; localStorage.setItem('orders', JSON.stringify(o)); };
const STATUS = { pending_payment: 'در انتظار پرداخت', awaiting_receipt: 'در انتظار ارسال رسید', awaiting_review: 'رسید در حال بررسی', paid: 'پرداخت شد', processing: 'در حال آماده‌سازی', shipped: 'ارسال شد', delivered: 'تحویل شد', canceled: 'لغو شد' };

async function orderPage(code, query) {
  const phone = (JSON.parse(localStorage.getItem('orders') || '{}'))[code];
  if (!phone) { trackPage(code); return; }
  app.innerHTML = '<div class="skeleton"></div>';
  try {
    const { order: o } = await api(`/api/orders/${encodeURIComponent(code)}?phone=${encodeURIComponent(phone)}`);
    const pay = new URLSearchParams(query || '').get('pay');
    const s = S.settings;
    let html = `<h1 class="page-h">سفارش ${esc(o.code)}</h1>`;
    if (pay === 'ok' || o.status === 'paid' && pay) html += '<div class="alert ok">✅ پرداخت با موفقیت انجام شد. از خرید شما سپاسگزاریم!' + (o.refId ? ` (کد رهگیری بانک: ${esc(o.refId)})` : '') + '</div>';
    if (pay === 'fail' && o.status === 'pending_payment') html += '<div class="alert err">پرداخت ناموفق بود یا لغو شد. می‌توانید دوباره تلاش کنید یا کارت‌به‌کارت انجام دهید.</div>';
    html += `<div class="summary"><div class="row"><span>وضعیت</span><span class="status ${esc(o.status)}">${esc(STATUS[o.status] || o.status)}</span></div>
      ${o.postTracking ? `<div class="row"><span>کد رهگیری پست</span><b>${esc(o.postTracking)}</b></div>` : ''}
      <div class="row"><span>روش پرداخت</span><span>${o.method === 'card' ? 'کارت به کارت' : 'درگاه آنلاین'}</span></div>
      <hr style="border:0;border-top:1px dashed var(--line);margin:8px 0">
      ${o.items.map(i => `<div class="row"><span>${esc(i.name)} × ${fa(i.qty)}<br><small style="color:var(--muted)">${Object.entries(i.selected).map(([k, v]) => `${esc(k)}: ${esc(v)}`).join(' | ')}</small></span><span>${money(i.price * i.qty)}</span></div>`).join('')}
      <div class="row"><span>ارسال</span><span>${o.shipping ? money(o.shipping) : 'رایگان'}</span></div>
      <div class="row tot"><span>مبلغ کل</span><span>${money(o.total)}</span></div></div>`;
    if (o.method === 'card' && ['awaiting_receipt', 'awaiting_review'].includes(o.status)) {
      html += `<div class="cardbox"><div class="row"><span>${esc(s.bankName)}</span><span>مبلغ: ${fa(o.total)} تومان</span></div><div class="num" id="cn">${esc(s.cardNumber)}</div><div class="row"><span>به نام: ${esc(s.cardOwner)}</span><button class="btn sm ghost" id="copy">کپی شماره کارت</button></div></div>
      <div class="summary"><h3>ثبت رسید پرداخت</h3><p style="color:var(--muted);font-size:13px;margin:6px 0 12px">پس از واریز، تصویر رسید یا شماره پیگیری را ثبت کنید تا سفارش تایید شود.</p>
      ${o.status === 'awaiting_review' ? '<div class="alert ok">رسید شما ثبت شده و در حال بررسی است. می‌توانید دوباره ارسال کنید.</div>' : ''}
      <form class="form" id="rf"><label>شماره پیگیری / ۴ رقم آخر کارت مبدا<input name="trackingNo" maxlength="40" value="${esc(o.trackingNo || '')}"></label><label>تصویر رسید<input type="file" name="file" accept="image/png,image/jpeg,image/webp"></label><button class="btn block">ثبت رسید</button><div id="rerr"></div></form></div>`;
    }
    if (o.status === 'pending_payment' && o.method === 'zarinpal') html += '<a class="btn ghost" href="#/" style="margin-top:14px">بازگشت به فروشگاه</a>';
    app.innerHTML = html + '<div style="margin-top:16px"><a class="btn ghost" href="#/">ادامه خرید</a></div>';
    const cp = $('#copy'); if (cp) cp.onclick = () => { navigator.clipboard && navigator.clipboard.writeText(s.cardNumber.replace(/\D/g, '')); toast('شماره کارت کپی شد'); };
    const rf = $('#rf'); if (rf) rf.onsubmit = async e => {
      e.preventDefault(); const fd = new FormData(rf), file = fd.get('file'); $('#rerr').innerHTML = '';
      try {
        let image = null;
        if (file && file.size) { if (file.size > 4e6) throw new Error('حجم تصویر حداکثر ۴ مگابایت'); image = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); }); }
        await api(`/api/orders/${encodeURIComponent(code)}/receipt`, { method: 'POST', body: { phone, trackingNo: fd.get('trackingNo'), image } });
        toast('رسید ثبت شد ✅'); orderPage(code);
      } catch (er) { $('#rerr').innerHTML = `<div class="alert err">${esc(er.message)}</div>`; }
    };
  } catch (er) { app.innerHTML = `<div class="alert err">${esc(er.message)}</div>`; }
}

function trackPage(code = '') {
  app.innerHTML = `<h1 class="page-h">پیگیری سفارش</h1><form class="form" id="tf" style="max-width:420px"><label>کد سفارش<input name="code" required inputmode="numeric" value="${esc(code)}"></label><label>شماره موبایل ثبت‌شده<input name="phone" required inputmode="numeric" placeholder="09123456789"></label><button class="btn">پیگیری</button><div id="terr"></div></form>`;
  $('#tf').onsubmit = async e => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
    const en = s => s.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
    try { await api(`/api/orders/${encodeURIComponent(en(f.code.trim()))}?phone=${encodeURIComponent(en(f.phone.trim()))}`); rememberOrder(en(f.code.trim()), en(f.phone.trim())); location.hash = '#/order/' + en(f.code.trim()); }
    catch (er) { $('#terr').innerHTML = `<div class="alert err">${esc(er.message)}</div>`; }
  };
}
const notFound = () => app.innerHTML = '<div class="empty"><div class="e">😕</div><p>صفحه پیدا نشد</p><br><a class="btn" href="#/">بازگشت به خانه</a></div>';

// ---- روتر ----
function router() {
  openDrawer(false);
  const [path, query] = (location.hash.slice(1) || '/').split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  window.scrollTo(0, 0);
  clearInterval(sliderTimer);
  const tab = parts[0] === 'cart' || parts[0] === 'checkout' ? 'cart' : parts[0] === 'track' || parts[0] === 'order' ? 'track' : !parts.length ? 'home' : '';
  document.querySelectorAll('.tabbar a[data-t]').forEach(a => a.classList.toggle('on', a.dataset.t === tab));
  const [r, a] = parts;
  if (!r) home();
  else if (r === 'category') categoryPage(a);
  else if (r === 'product') productPage(a);
  else if (r === 'sale') listPage('🏷️ تخفیف‌خورده‌ها', S.products.filter(p => disc(p) > 0));
  else if (r === 'best') listPage('🔥 پرفروش‌ترین‌ها', S.products.slice().sort((x, y) => y.sold - x.sold).slice(0, 40));
  else if (r === 'search') { const q = a.toLowerCase(); listPage(`نتایج «${a}»`, S.products.filter(p => (p.name + ' ' + ((catById(p.category) || {}).name || '')).toLowerCase().includes(q))); }
  else if (r === 'cart') cartPage();
  else if (r === 'checkout') checkoutPage();
  else if (r === 'order') orderPage(a, query);
  else if (r === 'track') trackPage();
  else notFound();
}

(async function init() {
  app.innerHTML = '<div class="skeleton"></div><br><div class="skeleton" style="height:120px"></div>';
  updateCount();
  try { S = await api('/api/shop'); } catch { app.innerHTML = '<div class="alert err">ارتباط با سرور برقرار نشد. صفحه را دوباره بارگذاری کنید.</div>'; return; }
  buildChrome();
  window.addEventListener('hashchange', router);
  router();
})();
