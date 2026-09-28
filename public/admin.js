const $ = s => document.querySelector(s);
const root = $('#root');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fa = n => Number(n).toLocaleString('fa-IR');
const toast = m => { const t = $('#toast'); t.textContent = m; t.style.bottom = '30px'; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2500); };
const api = async (url, method = 'GET', body) => {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && !url.includes('login')) { login(); throw new Error(j.error); }
  if (!r.ok) throw new Error(j.error || 'خطا');
  return j;
};
const STATUS = { pending_payment: 'در انتظار پرداخت', awaiting_receipt: 'منتظر رسید', awaiting_review: 'رسید در انتظار تایید', paid: 'پرداخت شده', processing: 'در حال آماده‌سازی', shipped: 'ارسال شد', delivered: 'تحویل شد', canceled: 'لغو شده' };
const money = n => fa(n) + ' تومان';
const dt = t => new Date(t).toLocaleString('fa-IR');
const readFile = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
let D, tab = 'dash';

function login(msg = '') {
  root.innerHTML = `<form class="login" id="lf"><div style="font-size:50px">🔐</div><h2>ورود به پنل مدیریت</h2><br><input type="password" name="password" placeholder="رمز عبور" required autofocus><br><br><button class="btn block">ورود</button><div id="le">${msg ? `<div class="alert err">${esc(msg)}</div>` : ''}</div></form>`;
  $('#lf').onsubmit = async e => {
    e.preventDefault();
    try { const r = await api('/api/admin/login', 'POST', { password: new FormData(e.target).get('password') }); await load(); if (r.defaultPassword) toast('⚠️ رمز پیش‌فرض است؛ از تنظیمات آن را تغییر دهید'); }
    catch (er) { $('#le').innerHTML = `<div class="alert err">${esc(er.message)}</div>`; }
  };
}
async function load() { D = await api('/api/admin/data'); render(); }

const TABS = [['dash', '📊 داشبورد'], ['orders', '🧾 سفارش‌ها'], ['products', '📦 محصولات'], ['cats', '🗂️ دسته‌بندی‌ها'], ['banners', '🖼️ بنرها'], ['home', '🏠 صفحه اصلی'], ['settings', '⚙️ تنظیمات و پرداخت']];
function render() {
  root.innerHTML = `<div class="adm"><div class="side">${TABS.map(([k, v]) => `<button data-t="${k}" class="${k === tab ? 'on' : ''}">${v}</button>`).join('')}<button id="lo">🚪 خروج</button><a href="/" target="_blank" style="padding:9px 14px;color:var(--p);white-space:nowrap">🌐 مشاهده سایت</a></div><div class="panel" id="pn"></div></div>`;
  root.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { tab = b.dataset.t; render(); });
  $('#lo').onclick = async () => { await api('/api/admin/logout', 'POST'); login(); };
  ({ dash, orders, products, cats, banners, home, settings })[tab]();
}
const pn = h => $('#pn').innerHTML = h;
const act = async (fn, ok = 'ذخیره شد ✅') => { try { await fn(); await load(); toast(ok); } catch (e) { toast(e.message); } };

function modal(html, onSubmit) {
  const bg = document.createElement('div'); bg.className = 'modal-bg';
  bg.innerHTML = `<form class="modal">${html}<div class="row-a" style="margin-top:14px"><button class="btn">ذخیره</button><button type="button" class="btn ghost" data-close>انصراف</button></div><div class="err"></div></form>`;
  document.body.appendChild(bg);
  const close = () => bg.remove();
  bg.querySelector('[data-close]').onclick = close;
  bg.onmousedown = e => { if (e.target === bg) close(); };
  bg.querySelector('form').onsubmit = async e => { e.preventDefault(); try { await onSubmit(e.target); close(); } catch (er) { bg.querySelector('.err').innerHTML = `<div class="alert err">${esc(er.message)}</div>`; } };
  return bg;
}

// ---------- داشبورد ----------
function dash() {
  const s = D.stats;
  pn(`<h2 style="margin-bottom:12px">داشبورد</h2><div class="stats"><div class="stat"><b>${fa(s.orders)}</b><span>کل سفارش‌ها</span></div><div class="stat"><b style="color:#b45309">${fa(s.pending)}</b><span>رسید در انتظار تایید</span></div><div class="stat"><b>${money(s.revenue)}</b><span>کل فروش</span></div><div class="stat"><b>${money(s.revenue30)}</b><span>فروش ۳۰ روز اخیر</span></div><div class="stat"><b style="color:var(--bad)">${fa(s.lowStock)}</b><span>کالاهای کم‌موجودی</span></div></div>
  <h3 style="margin:10px 0">آخرین سفارش‌ها</h3>${ordersTable(D.orders.slice(0, 6))}`);
  bindOrders();
}

// ---------- سفارش‌ها ----------
function ordersTable(list) {
  if (!list.length) return '<p style="color:var(--muted)">سفارشی وجود ندارد</p>';
  return `<table><tr><th>کد</th><th>مشتری</th><th>مبلغ</th><th>پرداخت</th><th>وضعیت</th><th>تاریخ</th><th></th></tr>${list.map(o => `<tr><td>${esc(o.code)}</td><td>${esc(o.customer.name)}<br><small>${esc(o.customer.phone)}</small></td><td>${money(o.total)}</td><td>${o.method === 'card' ? '🏦 کارت‌به‌کارت' : '💳 آنلاین'}</td><td><span class="status ${esc(o.status)}">${esc(STATUS[o.status])}</span></td><td><small>${dt(o.createdAt)}</small></td><td><button class="btn sm ghost" data-o="${esc(o.id)}">جزئیات</button></td></tr>`).join('')}</table>`;
}
let ofilter = '';
function orders() {
  const list = D.orders.filter(o => !ofilter || o.status === ofilter);
  pn(`<h2 style="margin-bottom:12px">سفارش‌ها</h2><div class="tools"><select id="of"><option value="">همه وضعیت‌ها</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${k === ofilter ? 'selected' : ''}>${v}</option>`).join('')}</select></div>${ordersTable(list)}`);
  $('#of').onchange = e => { ofilter = e.target.value; orders(); };
  bindOrders();
}
function bindOrders() {
  document.querySelectorAll('[data-o]').forEach(b => b.onclick = () => {
    const o = D.orders.find(x => x.id === b.dataset.o), c = o.customer;
    const bg = modal(`<h3>سفارش ${esc(o.code)}</h3>
      <p><b>${esc(c.name)}</b> — ${esc(c.phone)}<br>${esc(c.city)}، ${esc(c.address)}<br>کد پستی: ${esc(c.postal || '-')}${o.note ? `<br>توضیح مشتری: ${esc(o.note)}` : ''}</p>
      <table>${o.items.map(i => `<tr><td>${esc(i.name)}<br><small>${Object.entries(i.selected).map(([k, v]) => `${esc(k)}: ${esc(v)}`).join(' | ')}</small></td><td>× ${fa(i.qty)}</td><td>${money(i.price * i.qty)}</td></tr>`).join('')}<tr><td>ارسال</td><td></td><td>${money(o.shipping)}</td></tr><tr><td><b>جمع کل</b></td><td></td><td><b>${money(o.total)}</b></td></tr></table>
      ${o.method === 'card' ? `<h4 style="margin-top:10px">رسید کارت‌به‌کارت</h4>${o.receipt ? `<a href="${esc(o.receipt)}" target="_blank"><img src="${esc(o.receipt)}" style="max-height:240px;border-radius:12px;margin:6px 0"></a>` : '<p style="color:var(--muted)">تصویری ثبت نشده</p>'}<p>شماره پیگیری: <b>${esc(o.trackingNo || '-')}</b></p>` : `<p>کد رهگیری بانک: <b>${esc(o.refId || '-')}</b></p>`}
      <label>وضعیت<select name="status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${k === o.status ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label style="margin-top:8px">کد رهگیری پست<input name="postTracking" value="${esc(o.postTracking || '')}"></label>
      <label style="margin-top:8px">یادداشت مدیر<input name="adminNote" value="${esc(o.adminNote || '')}"></label>
      ${o.method === 'card' && o.status === 'awaiting_review' ? '<button type="button" class="btn" id="approve" style="margin-top:10px">✅ تایید پرداخت</button>' : ''}
      <button type="button" class="btn danger sm" id="del" style="margin-top:10px">حذف سفارش</button>`,
      async f => { const v = Object.fromEntries(new FormData(f)); await api('/api/admin/orders/' + o.id, 'PUT', v); await load(); toast('ذخیره شد ✅'); });
    const ap = bg.querySelector('#approve'); if (ap) ap.onclick = () => { bg.querySelector('[name=status]').value = 'paid'; bg.querySelector('form').requestSubmit(); };
    bg.querySelector('#del').onclick = () => { if (confirm('این سفارش حذف شود؟')) { bg.remove(); act(() => api('/api/admin/orders/' + o.id, 'DELETE'), 'حذف شد'); } };
  });
}

// ---------- محصولات ----------
const catName = id => (D.categories.find(c => c.id === id) || {}).name || '—';
const catOptions = sel => D.categories.map(c => ({ c, d: c.parent ? 1 : 0 })).map(({ c }) => `<option value="${esc(c.id)}" ${c.id === sel ? 'selected' : ''}>${c.parent ? '— ' : ''}${esc(c.name)}</option>`).join('');
let pq = '';
function products() {
  const list = D.products.filter(p => !pq || p.name.includes(pq));
  pn(`<h2 style="margin-bottom:12px">محصولات (${fa(D.products.length)})</h2><div class="tools"><input id="pq" placeholder="جستجو..." value="${esc(pq)}"><button class="btn" id="np">+ محصول جدید</button></div>
  <table><tr><th></th><th>نام</th><th>دسته</th><th>قیمت</th><th>موجودی</th><th>فروش</th><th></th></tr>${list.map(p => `<tr><td><div class="thumb" style="${p.images[0] ? `background-image:url('${esc(p.images[0])}')` : ''}">${p.images[0] ? '' : '📦'}</div></td><td>${esc(p.name)}${p.active ? '' : ' <small style="color:var(--bad)">(مخفی)</small>'}<br><small>${(p.options || []).map(o => esc(o.name)).join('، ')}</small></td><td>${esc(catName(p.category))}</td><td>${money(p.price)}${p.oldPrice ? `<br><del><small>${fa(p.oldPrice)}</small></del>` : ''}</td><td style="${p.stock <= 5 ? 'color:var(--bad);font-weight:700' : ''}">${fa(p.stock)}</td><td>${fa(p.sold)}</td><td class="row-a"><button class="btn sm ghost" data-e="${esc(p.id)}">ویرایش</button><button class="btn sm danger" data-d="${esc(p.id)}">حذف</button></td></tr>`).join('')}</table>`);
  $('#pq').oninput = e => { pq = e.target.value; const pos = e.target.selectionStart; products(); const i = $('#pq'); i.focus(); i.setSelectionRange(pos, pos); };
  $('#np').onclick = () => productForm();
  document.querySelectorAll('[data-e]').forEach(b => b.onclick = () => productForm(D.products.find(p => p.id === b.dataset.e)));
  document.querySelectorAll('[data-d]').forEach(b => b.onclick = () => confirm('حذف شود؟') && act(() => api('/api/admin/product/' + b.dataset.d, 'DELETE'), 'حذف شد'));
}
function productForm(p) {
  const isNew = !p; p = p || { name: '', category: D.categories[0]?.id, price: 0, oldPrice: 0, stock: 10, desc: '', images: [], options: [], active: true };
  let images = [...p.images], options = p.options.map(o => ({ name: o.name, values: o.values.join('، ') }));
  const bg = modal(`<h3>${isNew ? 'محصول جدید' : 'ویرایش محصول'}</h3><div class="form">
    <label>نام محصول<input name="name" required value="${esc(p.name)}"></label>
    <label>دسته‌بندی<select name="category">${catOptions(p.category)}</select></label>
    <div class="g2"><label>قیمت (تومان)<input name="price" type="number" min="0" required value="${p.price}"></label><label>قیمت قبل از تخفیف<input name="oldPrice" type="number" min="0" value="${p.oldPrice || 0}"></label></div>
    <div class="g2"><label>موجودی<input name="stock" type="number" min="0" value="${p.stock}"></label><label style="align-content:end"><span><input type="checkbox" name="active" ${p.active ? 'checked' : ''} style="width:auto"> نمایش در سایت</span></label></div>
    <label>توضیحات<textarea name="desc" rows="3">${esc(p.desc)}</textarea></label>
    <div><b style="font-size:13.5px">تصاویر</b><div class="imgs" id="imgs"></div><input type="file" id="up" accept="image/png,image/jpeg,image/webp" multiple></div>
    <div><b style="font-size:13.5px">تنوع محصول (رنگ، مدل گوشی و ...)</b><div id="opts"></div><button type="button" class="btn sm ghost" id="addopt">+ افزودن ویژگی</button><p style="font-size:12px;color:var(--muted);margin-top:4px">مقادیر را با ویرگول «،» جدا کنید. مثال: مشکی، سفید، آبی</p></div></div>`,
    async f => {
      const fd = new FormData(f);
      const body = { name: fd.get('name'), category: fd.get('category'), price: fd.get('price'), oldPrice: fd.get('oldPrice'), stock: fd.get('stock'), desc: fd.get('desc'), active: fd.has('active'), images,
        options: options.map(o => ({ name: o.name, values: o.values.split(/[،,\n]/).map(s => s.trim()).filter(Boolean) })).filter(o => o.name.trim() && o.values.length) };
      await api(isNew ? '/api/admin/product' : '/api/admin/product/' + p.id, isNew ? 'POST' : 'PUT', body); await load(); toast('ذخیره شد ✅');
    });
  const drawImgs = () => { const el = bg.querySelector('#imgs'); el.innerHTML = images.map((u, i) => `<div class="im"><div class="thumb" style="background-image:url('${esc(u)}')"></div><button type="button" data-x="${i}">×</button></div>`).join(''); el.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { images.splice(+b.dataset.x, 1); drawImgs(); }); };
  const drawOpts = () => { const el = bg.querySelector('#opts'); el.innerHTML = options.map((o, i) => `<div class="optbox"><div class="g2"><input placeholder="نام ویژگی (مثلاً رنگ)" data-n="${i}" value="${esc(o.name)}"><input placeholder="مقادیر با «،» جدا شوند" data-v="${i}" value="${esc(o.values)}"></div><button type="button" class="btn sm danger" data-r="${i}" style="justify-self:start">حذف ویژگی</button></div>`).join('');
    el.querySelectorAll('[data-n]').forEach(x => x.oninput = () => options[+x.dataset.n].name = x.value); el.querySelectorAll('[data-v]').forEach(x => x.oninput = () => options[+x.dataset.v].values = x.value);
    el.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { options.splice(+b.dataset.r, 1); drawOpts(); }); };
  bg.querySelector('#addopt').onclick = () => { options.push({ name: '', values: '' }); drawOpts(); };
  bg.querySelector('#up').onchange = async e => { for (const f of e.target.files) { try { images.push((await api('/api/admin/upload', 'POST', { image: await readFile(f) })).url); } catch (er) { toast(er.message); } } drawImgs(); e.target.value = ''; };
  drawImgs(); drawOpts();
}

// ---------- دسته‌ها ----------
function cats() {
  const top = D.categories.filter(c => !c.parent), row = (c, sub) => `<tr><td>${sub ? '&nbsp;&nbsp;&nbsp;↳ ' : ''}${esc(c.icon)} ${esc(c.name)}</td><td>${fa(D.products.filter(p => p.category === c.id).length)}</td><td class="row-a"><button class="btn sm ghost" data-e="${esc(c.id)}">ویرایش</button><button class="btn sm danger" data-d="${esc(c.id)}">حذف</button></td></tr>`;
  pn(`<h2 style="margin-bottom:12px">دسته‌بندی‌ها و منو</h2><div class="tools"><button class="btn" id="nc">+ دسته جدید</button></div><table><tr><th>نام</th><th>محصول</th><th></th></tr>${top.map(c => row(c) + D.categories.filter(x => x.parent === c.id).map(x => row(x, true)).join('')).join('')}</table>`);
  $('#nc').onclick = () => catForm();
  document.querySelectorAll('[data-e]').forEach(b => b.onclick = () => catForm(D.categories.find(c => c.id === b.dataset.e)));
  document.querySelectorAll('[data-d]').forEach(b => b.onclick = () => confirm('حذف شود؟') && act(() => api('/api/admin/category/' + b.dataset.d, 'DELETE'), 'حذف شد'));
}
function catForm(c) {
  const isNew = !c; c = c || { name: '', parent: '', icon: '📦', order: D.categories.length };
  modal(`<h3>${isNew ? 'دسته جدید' : 'ویرایش دسته'}</h3><div class="form"><label>نام<input name="name" required value="${esc(c.name)}"></label><label>زیرمجموعه‌ی<select name="parent"><option value="">— دسته اصلی —</option>${D.categories.filter(x => !x.parent && x.id !== c.id).map(x => `<option value="${esc(x.id)}" ${x.id === c.parent ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label><div class="g2"><label>آیکون (ایموجی)<input name="icon" value="${esc(c.icon)}" maxlength="4"></label><label>ترتیب<input name="order" type="number" value="${c.order}"></label></div></div>`,
    async f => { const v = Object.fromEntries(new FormData(f)); await api(isNew ? '/api/admin/category' : '/api/admin/category/' + c.id, isNew ? 'POST' : 'PUT', v); await load(); toast('ذخیره شد ✅'); });
}

// ---------- بنرها ----------
function banners() {
  pn(`<h2 style="margin-bottom:12px">بنرهای اسلایدر بالای سایت</h2><div class="tools"><button class="btn" id="nb">+ بنر جدید</button></div><table><tr><th>پیش‌نمایش</th><th>عنوان</th><th>لینک</th><th></th></tr>${D.banners.map(b => `<tr><td><div style="width:110px;height:56px;border-radius:10px;${b.image ? `background:url('${esc(b.image)}') center/cover` : `background:${esc(b.gradient)}`};display:grid;place-items:center;font-size:26px">${esc(b.icon)}</div></td><td>${esc(b.title)}<br><small>${esc(b.subtitle)}</small></td><td><small>${esc(b.link)}</small></td><td class="row-a"><button class="btn sm ghost" data-e="${esc(b.id)}">ویرایش</button><button class="btn sm danger" data-d="${esc(b.id)}">حذف</button></td></tr>`).join('')}</table>`);
  $('#nb').onclick = () => bannerForm();
  document.querySelectorAll('[data-e]').forEach(b => b.onclick = () => bannerForm(D.banners.find(x => x.id === b.dataset.e)));
  document.querySelectorAll('[data-d]').forEach(b => b.onclick = () => confirm('حذف شود؟') && act(() => api('/api/admin/banner/' + b.dataset.d, 'DELETE'), 'حذف شد'));
}
const GRAD_PRESETS = ['linear-gradient(135deg,#7c3aed,#ec4899)', 'linear-gradient(135deg,#0ea5e9,#6366f1)', 'linear-gradient(135deg,#f97316,#f43f5e)', 'linear-gradient(135deg,#10b981,#0ea5e9)', 'linear-gradient(135deg,#fbbf24,#f97316)', 'linear-gradient(135deg,#1f2437,#7c3aed)'];
async function uploadInto(bg, name) {
  const inp = bg.querySelector('[data-up]'); inp.onchange = async e => { const f = e.target.files[0]; if (!f) return; try { bg.querySelector(`[name=${name}]`).value = (await api('/api/admin/upload', 'POST', { image: await readFile(f) })).url; toast('بارگذاری شد'); } catch (er) { toast(er.message); } };
}
function bannerForm(b) {
  const isNew = !b; b = b || { title: '', subtitle: '', cta: 'مشاهده', link: '#/', gradient: GRAD_PRESETS[0], icon: '✨', image: '' };
  const bg = modal(`<h3>${isNew ? 'بنر جدید' : 'ویرایش بنر'}</h3><div class="form"><label>عنوان<input name="title" required value="${esc(b.title)}"></label><label>زیرعنوان<input name="subtitle" value="${esc(b.subtitle)}"></label><div class="g2"><label>متن دکمه<input name="cta" value="${esc(b.cta)}"></label><label>آیکون (ایموجی)<input name="icon" value="${esc(b.icon)}"></label></div>
  <label>لینک (مثلاً #/category/c-iphone یا #/sale)<input name="link" value="${esc(b.link)}" dir="ltr"></label>
  <label>رنگ پس‌زمینه<select name="gradient">${GRAD_PRESETS.map((g, i) => `<option value="${g}" ${g === b.gradient ? 'selected' : ''}>طرح ${fa(i + 1)}</option>`).join('')}</select></label>
  <label>تصویر پس‌زمینه (اختیاری؛ جایگزین رنگ می‌شود)<input name="image" value="${esc(b.image)}" dir="ltr" placeholder="/uploads/..."><input type="file" data-up accept="image/*"></label></div>`,
    async f => { const v = Object.fromEntries(new FormData(f)); await api(isNew ? '/api/admin/banner' : '/api/admin/banner/' + b.id, isNew ? 'POST' : 'PUT', v); await load(); toast('ذخیره شد ✅'); });
  uploadInto(bg, 'image');
}

// ---------- صفحه اصلی: باکس‌ها و ریل ----------
function home() {
  const sec = (key, title) => `<h3 style="margin:14px 0 8px">${title}</h3><table><tr><th>عنوان</th><th>لینک</th><th></th></tr>${D.settings[key].map((x, i) => `<tr><td>${esc(x.icon)} ${esc(x.title)}</td><td><small dir="ltr">${esc(x.link)}</small></td><td class="row-a"><button class="btn sm ghost" data-k="${key}" data-e="${i}">ویرایش</button><button class="btn sm danger" data-k="${key}" data-d="${i}">حذف</button></td></tr>`).join('')}</table><button class="btn sm" data-k="${key}" data-n>+ افزودن</button>`;
  pn(`<h2>صفحه اصلی</h2><p style="color:var(--muted);font-size:13px">باکس‌های زیر بنر و ریل دسته‌بندی‌ها (کاور آیفون، کاور اندروید، بند و آویز و ...). محصولات «پرفروش» و «تخفیف‌خورده» به‌صورت خودکار از فروش و قیمت قبل از تخفیف ساخته می‌شوند.</p>${sec('boxes', 'باکس‌های زیر بنر')}${sec('rail', 'ریل دسته‌بندی‌ها')}`);
  const save = async (key, arr) => act(() => api('/api/admin/settings', 'PUT', { [key]: arr }));
  document.querySelectorAll('[data-n]').forEach(b => b.onclick = () => linkForm(null, x => save(b.dataset.k, [...D.settings[b.dataset.k], x])));
  document.querySelectorAll('[data-e]').forEach(b => b.onclick = () => { const k = b.dataset.k, i = +b.dataset.e; linkForm(D.settings[k][i], x => { const a = [...D.settings[k]]; a[i] = x; save(k, a); }); });
  document.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { if (confirm('حذف شود؟')) save(b.dataset.k, D.settings[b.dataset.k].filter((_, i) => i !== +b.dataset.d)); });
}
function linkForm(x, cb) {
  x = x || { title: '', link: '#/', icon: '✨', gradient: GRAD_PRESETS[0], image: '' };
  const bg = modal(`<h3>باکس / آیتم ریل</h3><div class="form"><label>عنوان<input name="title" required value="${esc(x.title)}"></label><label>لینک<input name="link" dir="ltr" value="${esc(x.link)}"></label><label>آیکون (ایموجی)<input name="icon" value="${esc(x.icon)}"></label><label>رنگ<select name="gradient">${GRAD_PRESETS.map((g, i) => `<option value="${g}" ${g === x.gradient ? 'selected' : ''}>طرح ${fa(i + 1)}</option>`).join('')}</select></label><label>تصویر (اختیاری)<input name="image" dir="ltr" value="${esc(x.image || '')}"><input type="file" data-up accept="image/*"></label></div>`,
    async f => cb(Object.fromEntries(new FormData(f))));
  uploadInto(bg, 'image');
}

// ---------- تنظیمات ----------
function settings() {
  const s = D.settings;
  pn(`<h2 style="margin-bottom:12px">تنظیمات و درگاه‌های پرداخت</h2><form class="form" id="sf" style="max-width:560px">
  <h3>فروشگاه</h3><label>نام فروشگاه<input name="shopName" value="${esc(s.shopName)}"></label><label>تلفن پشتیبانی<input name="phone" value="${esc(s.phone)}"></label>
  <div class="g2"><label>هزینه ارسال (تومان)<input name="shipping" type="number" min="0" value="${s.shipping}"></label><label>ارسال رایگان از (تومان)<input name="freeShippingOver" type="number" min="0" value="${s.freeShippingOver}"></label></div>
  <h3 style="margin-top:10px">💳 درگاه آنلاین (زرین‌پال)</h3>
  <label>مرچنت‌کد<input name="zarinpalMerchant" dir="ltr" value="${esc(s.zarinpalMerchant)}" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"></label>
  <label><span><input type="checkbox" name="zarinpalSandbox" ${s.zarinpalSandbox ? 'checked' : ''} style="width:auto"> حالت آزمایشی (Sandbox) — برای دریافت پول واقعی غیرفعال کنید</span></label>
  <p class="alert">اگر مرچنت‌کد خالی باشد، سایت از «درگاه آزمایشی داخلی» استفاده می‌کند و پولی دریافت نمی‌شود.</p>
  <h3 style="margin-top:10px">🏦 کارت به کارت</h3>
  <label>شماره کارت<input name="cardNumber" dir="ltr" value="${esc(s.cardNumber)}"></label><div class="g2"><label>نام صاحب کارت<input name="cardOwner" value="${esc(s.cardOwner)}"></label><label>بانک<input name="bankName" value="${esc(s.bankName)}"></label></div>
  <button class="btn">ذخیره تنظیمات</button></form>
  <form class="form" id="pf" style="max-width:560px;margin-top:26px"><h3>🔑 تغییر رمز مدیر</h3><label>رمز جدید (حداقل ۸ کاراکتر)<input type="password" name="password" minlength="8" required autocomplete="new-password"></label><button class="btn ghost">تغییر رمز</button></form>`);
  $('#sf').onsubmit = e => { e.preventDefault(); const fd = new FormData(e.target), v = Object.fromEntries(fd); v.zarinpalSandbox = fd.has('zarinpalSandbox'); act(() => api('/api/admin/settings', 'PUT', v)); };
  $('#pf').onsubmit = e => { e.preventDefault(); act(() => api('/api/admin/password', 'POST', { password: new FormData(e.target).get('password') }), 'رمز تغییر کرد ✅'); e.target.reset(); };
}

api('/api/admin/me').then(load).catch(() => login());
