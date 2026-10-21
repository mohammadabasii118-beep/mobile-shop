const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function ago(iso) { const m = Math.max(1, Math.round((Date.now() - new Date(iso)) / 60000)); return m < 60 ? m + ' دقیقه پیش' : m < 1440 ? Math.round(m / 60) + ' ساعت پیش' : Math.round(m / 1440) + ' روز پیش'; }
const S = {tab: 'dash', nodes: [], users: [], protos: [], portNode: null, routeNode: null, routing: null, sel: new Set(), q: '', me: {role: 'sudo'}, admins: [], brand: {name: 'پنل چندلوکیشن', logo: '', color: ''}, dnstt: null, tunnels: [], owner: '', onlineOnly: false};
const TITLES = {dash: 'داشبورد', nodes: 'لوکیشن‌ها', protos: 'پروتکل‌ها', routing: 'مسیریابی', users: 'کاربران', tunnels: 'تونل‌ها', admins: 'ادمین‌ها', look: 'ظاهر پنل'};
const STATUS = {active: ['good', 'فعال'], disabled: ['bad', 'غیرفعال'], expired: ['bad', 'منقضی'], quota: ['bad', 'حجم تمام شده']};

const ICO = {
  server: '<rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/>',
  activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  alert: '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  admin: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><circle cx="12" cy="10" r="2.5"/><path d="M7.5 17c.8-2 2.6-3 4.5-3s3.7 1 4.5 3"/>',
  palette: '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.7-.7 1.7-1.6 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.7 1.7-1.7H16c3.3 0 6-2.7 6-6 0-4.9-4.5-8.5-10-8.5Z"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  pie: '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10Z"/>',
};
const ic = n => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICO[n]}</svg>`;
const num = v => `<span class="num">${v}</span>`;

const logoMark = (b = S.brand) => b.logo ? `<span class="logo img"><img src="${esc(b.logo)}" alt=""></span>` : `<span class="logo">${ic('shield')}</span>`;
function applyBrand(b) {
  S.brand = b;
  document.title = b.name;
  const fav = document.querySelector('link[rel=icon]'); if (fav) fav.href = b.logo || 'data:,';
  const nb = $('#brand'); if (nb) nb.innerHTML = `${logoMark(b)}<span>${esc(b.name)}<small>مدیریت VPN</small></span>`;
  const r = document.documentElement.style, hex = /^#[0-9a-f]{6}$/i.test(b.color) ? b.color : '';
  ['--accent', '--accent2', '--accent-soft', '--accent-fg', '--glow1'].forEach(k => hex ? 0 : r.removeProperty(k));
  if (hex) {
    const [R, G, B] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    r.setProperty('--accent', hex); r.setProperty('--accent2', `color-mix(in srgb, ${hex} 62%, #0ea5e9)`);
    r.setProperty('--accent-soft', `color-mix(in srgb, ${hex} 14%, transparent)`); r.setProperty('--glow1', `rgba(${R},${G},${B},.13)`);
    r.setProperty('--accent-fg', (0.299 * R + 0.587 * G + 0.114 * B) > 150 ? '#06121a' : '#ffffff');   // readable text on the accent
  }
}
async function loadBrand() { try { applyBrand(await (await fetch('/api/branding')).json()); } catch (_) {} }

let token = ''; try { token = localStorage.getItem('tok') || ''; } catch (e) {}

async function api(method, path, body) {
  const r = await fetch('/api' + path, {method, headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + token},
    body: body === undefined ? undefined : JSON.stringify(body)});
  if (r.status === 401 && path !== '/login') { showLogin(); throw new Error('login'); }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'درخواست نامعتبر است');
  return data;
}
function toast(t) { const e = $('#toast'); e.textContent = t; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => e.hidden = true, 2200); }
function copy(t) { (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('کپی شد'), () => toast('متن را انتخاب و کپی کنید')); }
function openModal(html) { $('#box').innerHTML = html; $('#modal').hidden = false; }
function closeModal() { $('#modal').hidden = true; }
const loadCls = v => v > 75 ? 'bad' : v > 55 ? 'warn' : '';
const protoLabel = id => (S.protos.find(p => p.id === id) || {label: id}).label;
const nodeBy = id => S.nodes.find(n => n.id === id);
const fmtGB = v => v.toLocaleString('en', {maximumFractionDigits: 2});

function showLogin() {
  openModal(`<div class="login">${logoMark()}<h2>${esc(S.brand.name)}</h2><span class="muted">برای ادامه رمز مدیر را وارد کنید</span></div>
    <label class="f">نام کاربری <span class="muted">(مدیر اصلی خالی بگذارد)</span><input type="text" id="un" autocomplete="username" dir="ltr"></label>
    <label class="f">رمز<input type="password" id="pw" autocomplete="current-password"></label>
    <button class="btn pri" id="doLogin" style="justify-content:center">ورود</button>`);
  $('#pw').focus();
}

async function refresh() {
  S.me = await api('GET', '/me');
  if (S.me.role === 'reseller') {   // a sub-admin sees only their own users
    const [users, opts] = await Promise.all([api('GET', '/me/users'), api('GET', '/me/options')]);
    S.users = users; S.nodes = opts.nodes; S.protos = opts.protocols; S.admins = []; S.tab = 'users';
  } else {
    [S.nodes, S.users, S.protos, S.admins, S.dnstt, S.tunnels] = await Promise.all([api('GET', '/nodes'), api('GET', '/users'), api('GET', '/protocols'), api('GET', '/admins'), api('GET', '/dnstt'), api('GET', '/tunnels')]);
  }
  const ids = new Set(S.users.map(u => u.id));
  S.sel = new Set([...S.sel].filter(i => ids.has(i)));   // a deleted user cannot stay selected
  render();
}
const isReseller = () => S.me.role === 'reseller';
const uPath = id => (isReseller() ? '/me/users/' : '/users/') + id;   // a sub-admin goes through /me

const views = {
  dash() {
    const on = S.nodes.filter(n => n.online).length, used = S.users.reduce((a, u) => a + u.used_gb, 0);
    const count = k => S.users.filter(u => u.status === k).length, active = count('active'), blocked = S.users.length - active;
    const stat = (cls, ico, label, value, sub = '') => `<div class="stat"><span class="ico ${cls}">${ic(ico)}</span><div><span class="l">${label}</span><b>${value}${sub ? `<small>${sub}</small>` : ''}</b></div></div>`;
    const top = [...S.users].sort((a, b) => b.used_gb - a.used_gb).slice(0, 5), max = Math.max(1, ...top.map(u => u.used_gb));
    const segs = [['good', 'فعال', active, 'var(--good)'], ['quota', 'حجم تمام', count('quota'), 'var(--warn)'], ['expired', 'منقضی', count('expired'), 'var(--bad)'], ['disabled', 'غیرفعال', count('disabled'), 'var(--muted)']];
    return `<div class="stats">
      ${stat('', 'server', 'لوکیشن آنلاین', `${num(on + ' / ' + S.nodes.length)}`)}
      ${stat('blue', 'users', 'کاربر فعال', `${num(active + ' / ' + S.users.length)}`, S.users.some(u => u.online) ? `${S.users.filter(u => u.online).length} آنلاین` : '')}
      ${stat('blue', 'activity', 'مصرف کل', num(fmtGB(used)), 'GB')}
      ${stat(blocked || S.nodes.some(n => n.conflicts.length) ? 'warn' : '', 'alert', 'نیازمند توجه', num(blocked + S.nodes.filter(n => n.conflicts.length || (n.errors || []).length).length), 'مورد')}</div>
      <div class="panel"><h2>${ic('pin')}لوکیشن‌ها</h2>${S.nodes.length ? `<div class="nodes">${S.nodes.map(n => `
        <div class="ncard ${n.online ? '' : 'off'}"><div class="ring ${loadCls(n.load)}" style="--v:${n.online ? n.load : 0}"><b>${n.online ? n.load + '%' : '—'}</b></div>
          <div class="t"><strong><span class="cc">${esc(n.cc)}</span>${esc(n.name)}</strong><span class="muted mono">${esc(n.address)}</span>
            <span><span class="pill ${n.online ? 'good' : 'warn'}">${n.online ? 'آنلاین' : 'آفلاین'}</span>${n.conflicts.length ? ' <span class="pill bad" title="' + esc(n.conflicts.join('، ')) + '">تداخل پورت</span>' : ''}</span></div></div>`).join('')}</div>` :
        `<div class="empty">${ic('pin')}<span>هنوز لوکیشنی اضافه نشده. از بخش «لوکیشن‌ها» اولین نود را اضافه کنید.</span></div>`}</div>
      <div class="cols">
        <div class="panel"><h2>${ic('trophy')}پرمصرف‌ترین کاربران</h2>${top.length ? `<div class="top5">${top.map(u => `
          <div class="r"><span class="mono">${esc(u.name)}</span><div class="bar"><i class="${u.quota_gb && u.used_gb / u.quota_gb > .9 ? 'bad' : ''}" style="width:${Math.max(3, u.used_gb / max * 100)}%"></i></div>
            <span class="muted">${num(fmtGB(u.used_gb) + (u.quota_gb ? ' / ' + fmtGB(u.quota_gb) : '') + ' GB')}</span></div>`).join('')}</div>` : `<div class="empty"><span>کاربری نیست.</span></div>`}</div>
        <div class="panel"><h2>${ic('pie')}وضعیت کاربران</h2>${S.users.length ? `<div class="seg">${segs.filter(x => x[2]).map(x => `<i style="flex:${x[2]};background:${x[3]}" title="${x[1]}: ${x[2]}"></i>`).join('')}</div>
          <div class="legend">${segs.map(x => `<span><i style="background:${x[3]}"></i>${x[1]} ${num(x[2])}</span>`).join('')}</div>` : `<div class="empty"><span>کاربری نیست.</span></div>`}</div>
      </div>`;
  },
  nodes() {
    return `<div class="panel scroll"><table><thead><tr><th>لوکیشن</th><th>آدرس</th><th>بار</th><th>آخرین گزارش</th><th>وضعیت</th><th></th></tr></thead><tbody>
      ${S.nodes.map(n => `<tr><td><span class="cc">${esc(n.cc)}</span>${esc(n.name)}</td><td class="mono">${esc(n.address)}</td>
        <td>${n.online ? n.load + '%' : '—'}</td><td>${n.last_seen ? new Date(n.last_seen).toLocaleString('fa-IR') : 'هنوز وصل نشده'}</td>
        <td><span class="pill ${n.online ? 'good' : 'warn'}">${n.online ? 'آنلاین' : 'آفلاین'}</span>${(n.errors || []).length ? `<br><span class="pill bad wrap">خطا: ${esc(n.errors.join('، '))}</span>` : ''}${n.conflicts.length ? `<br><span class="pill bad wrap" title="پورتی که برنامه‌ی دیگری گرفته؛ آن پروتکل روی این نود بالا نمی‌آید. پورت را در بخش پروتکل‌ها ← پورت‌ها عوض کنید.">تداخل پورت: ${esc(n.conflicts.join('، '))}</span>` : ''}</td>
        <td><div class="chips"><button class="btn sm" data-editnode="${n.id}">ویرایش</button> <button class="btn sm" data-install="${n.id}">دستور نصب</button> <button class="btn sm" data-reality="${n.id}">Reality</button> <button class="btn sm" data-cf="${n.id}">کلادفلر${n.cf_domain ? ' ✓' : ''}</button> <button class="btn sm" data-delnode="${n.id}">حذف</button></div></td></tr>`).join('')
        || '<tr><td colspan="6" class="muted">لوکیشنی وجود ندارد.</td></tr>'}</tbody></table></div>`;
  },
  protos() {
    return `<div class="note">هر پروتکل را روی هر لوکیشن جداگانه روشن یا خاموش کنید. ایجنت هر نود حداکثر ۳۰ ثانیه بعد تغییر را اعمال می‌کند.</div>
      <div class="panel scroll"><table class="matrix"><thead><tr><th>پروتکل</th>${S.nodes.map(n => `<th title="${esc(n.name)}">${esc(n.cc)}</th>`).join('')}</tr></thead><tbody>
      ${S.protos.map(p => `<tr><td><b>${esc(p.label)}</b><br><small class="muted">${esc(p.engine)} · ${esc(p.desc)}</small></td>
        ${S.nodes.map(n => { const np = n.protocols.find(x => x.proto === p.id);
          return `<td><input type="checkbox" data-node="${n.id}" data-proto="${p.id}" aria-label="${esc(p.label)} در ${esc(n.cc)}" ${np && np.enabled ? 'checked' : ''}></td>`; }).join('')}</tr>`).join('')}
      </tbody></table></div>
      ${portPanel()}${dnsttPanel()}`;
  },
  routing() {
    if (!S.nodes.length) return '<div class="note">ابتدا یک لوکیشن اضافه کنید.</div>';
    const n = nodeBy(S.routeNode) || S.nodes[0], R = S.routing && S.routing.nodeId === n.id ? S.routing.data : null;
    const sel = `<div class="form"><label class="f">لوکیشن<select id="routeNode">${S.nodes.map(x => `<option value="${x.id}" ${x.id === n.id ? 'selected' : ''}>${esc(x.cc)} ${esc(x.name)}</option>`).join('')}</select></label></div>`;
    if (!R) { loadRouting(n.id); return sel + '<p class="muted">در حال بارگذاری...</p>'; }
    const label = id => (R.inbound_ids.find(i => i.id === id) || {label: id}).label;
    const outName = o => o === 'direct' ? 'مستقیم (direct)' : o === 'block' ? 'مسدود (block)' : o;
    const cond = r => [r.inbounds.length ? 'ورودی: ' + r.inbounds.map(label).join('، ') : '', r.ports ? 'پورت: ' + r.ports : '',
      r.domains.length ? 'دامنه: ' + r.domains.join('، ') : '', r.ips.length ? 'آی‌پی: ' + r.ips.join('، ') : ''].filter(Boolean).join(' · ');
    return `${sel}
      <div class="note">قانون‌ها به ترتیب بررسی می‌شوند و اولین قانونی که بخورد، ترافیک را از خروجی خودش رد می‌کند. بقیه‌ی ترافیک مستقیم می‌رود. فقط ورودی‌های Xray (VLESS، VMess، Trojan، Shadowsocks) قابل مسیریابی‌اند. هر قانون را می‌توانید برای مواقع ضروری روشن یا خاموش کنید.</div>
      <div class="panel"><div style="display:flex;justify-content:space-between;align-items:center"><h2>خروجی‌ها</h2><button class="btn sm pri" data-rt-addout>+ خروجی جدید</button></div>
        <div class="scroll"><table><thead><tr><th>نام</th><th>نوع</th><th>مقصد</th><th></th></tr></thead><tbody>
        <tr><td class="mono">direct</td><td>داخلی</td><td class="muted">مستقیم به اینترنت (پیش‌فرض)</td><td></td></tr>
        <tr><td class="mono">block</td><td>داخلی</td><td class="muted">مسدود کردن</td><td></td></tr>
        ${R.outbounds.map(o => `<tr><td class="mono">${esc(o.name)}</td><td>${esc(o.kind)}</td><td class="mono">${esc(o.summary)}</td><td><button class="btn sm" data-rt-delout="${o.id}">حذف</button></td></tr>`).join('')}
        </tbody></table></div></div>
      <div class="panel"><div style="display:flex;justify-content:space-between;align-items:center"><h2>قانون‌های مسیریابی</h2><button class="btn sm pri" data-rt-addrule>+ قانون جدید</button></div>
        <div class="scroll"><table><thead><tr><th>روشن</th><th>شرط</th><th>خروجی</th><th>یادداشت</th><th></th></tr></thead><tbody>
        ${R.rules.map((r, i) => `<tr><td><input type="checkbox" data-rt-toggle="${r.id}" ${r.enabled ? 'checked' : ''} aria-label="روشن یا خاموش"></td>
          <td style="white-space:normal;min-width:220px">${esc(cond(r))}</td><td class="mono">${esc(outName(r.outbound))}</td><td>${esc(r.note)}</td>
          <td><button class="btn sm" data-rt-up="${r.id}" ${i === 0 ? 'disabled' : ''}>↑</button> <button class="btn sm" data-rt-down="${r.id}" ${i === R.rules.length - 1 ? 'disabled' : ''}>↓</button> <button class="btn sm" data-rt-delrule="${r.id}">حذف</button></td></tr>`).join('')
          || '<tr><td colspan="5" class="muted">قانونی نیست؛ همه‌ی ترافیک مستقیم می‌رود.</td></tr>'}
        </tbody></table></div></div>`;
  },
  tunnels() {
    const ST = {up: ['good', 'برقرار'], wait_client: ['warn', 'ایران آماده؛ منتظر سرور خارج'], wait_iran: ['warn', 'منتظر نصب روی سرور ایران'], off: ['', 'خاموش']};
    const note = `<div class="note">تونل: کاربران به پورت‌های <b>سرور ایران</b> وصل می‌شوند و ترافیک از طریق تونل به <b>لوکیشن خارج</b> می‌رسد. فقط IP ایران، لوکیشن خارج و پورت‌ها را بدهید؛ روی سرور ایران یک بار یک دستور اجرا می‌شود و بقیه خودکار است. تونل رمزنگاری ندارد؛ از پروتکل‌های رمزشده (مثل VLESS Reality) از داخلش رد کنید. مقصد هر پورت همان پورت روی لوکیشن خارج است (مثلاً <span class="mono" dir="ltr" style="unicode-bidi:isolate">81=80</span> یعنی پورت ۸۱ ایران به پورت ۸۰ خارج).</div>`;
    if (!S.tunnels.length) return note + '<div class="panel muted">هنوز تونلی نساخته‌اید.</div>';
    return note + S.tunnels.map(t => { const st = ST[t.status];
      return `<div class="panel"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
        <div><b>${esc(t.name)}</b> <span class="pill ${st[0]}">${st[1]}</span>${t.status === 'up' ? ` <span class="muted">${num(t.pool + ' اتصال آماده')}</span>` : ''}</div>
        <div class="chips"><button class="btn sm" data-tedit="${t.id}">پورت‌ها / ویرایش</button><button class="btn sm" data-ttoggle="${t.id}">${t.enabled ? 'خاموش' : 'روشن'}</button><button class="btn sm danger" data-tdel="${t.id}">حذف</button></div></div>
        <div style="margin-top:8px" class="muted"><span class="mono" dir="ltr">${esc(t.iran_host)}</span> ← <b>${esc(t.node_name)}</b></div>
        <div class="chips" style="margin-top:8px">${t.forwards.map(f => `<span class="cc" dir="ltr">${f.proto === 'udp' ? 'UDP ' : ''}${f.listen}${f.target !== f.listen ? ' → ' + f.target : ''}</span>`).join('')}</div>
        ${t.problems.length ? `<div class="note" style="margin-top:8px;color:var(--bad)">${t.problems.map(esc).join('<br>')}</div>` : ''}
        ${t.status === 'wait_iran' ? `<div style="margin-top:10px"><div class="muted">روی سرور ایران (با دسترسی root) این دستور را یک بار اجرا کنید:</div><pre>${esc(t.install_command)}</pre><button class="btn sm" data-copy="${esc(t.install_command)}">کپی دستور</button></div>` : ''}</div>`; }).join('');
  },
  users() {
    const q = S.q.trim().toLowerCase(), rs = isReseller(), own = S.owner;
    const rows = S.users.filter(u => (!q || u.name.toLowerCase().includes(q)) && (!own || (own === 'main' ? !u.owner_id : u.owner_id === +own)) && (!S.onlineOnly || u.online));
    const allOn = rows.length && rows.every(u => S.sel.has(u.id));
    const owner = u => u.owner_id ? ((S.admins.find(a => a.id === u.owner_id) || {}).username || '؟') : '';
    const bar = !rs && S.sel.size ? `<div class="panel" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b>${S.sel.size} کاربر انتخاب شده</b>
      <button class="btn sm" id="bulkBtn">افزودن پروتکل / لوکیشن…</button>
      <button class="btn sm" id="bulkDel" style="color:var(--bad)">حذف انتخاب‌شده‌ها</button>
      <button class="btn sm" id="selClear">لغو انتخاب</button></div>` : '';
    const limits = rs ? `<div class="note">شما ${S.me.users} کاربر ساخته‌اید${S.me.max_users ? ` از حداکثر ${S.me.max_users}` : ''}.
      ${S.me.max_total_gb ? ` سقف کل حجم شما ${fmtGB(S.me.max_total_gb)} گیگابایت است و ${fmtGB(S.me.allocated_gb)} را واگذار کرده‌اید (${fmtGB(Math.max(0, S.me.max_total_gb - S.me.allocated_gb))} باقی مانده).` : ''}${S.me.max_quota_gb ? ` حجم هر کاربر تا ${S.me.max_quota_gb} گیگابایت.` : ''}${S.me.max_days ? ` مدت هر کاربر تا ${S.me.max_days} روز.` : ''}</div>` : '';
    return `${limits}<div class="panel" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><input type="search" id="uq" placeholder="جست‌وجوی نام کاربر…" value="${esc(S.q)}" style="max-width:260px" dir="ltr">
        ${!rs && S.admins.length ? `<select id="uo" style="max-width:220px"><option value="">همه‌ی کاربران</option><option value="main" ${own === 'main' ? 'selected' : ''}>ساخته‌ی مدیر اصلی</option>${S.admins.map(a => `<option value="${a.id}" ${own === String(a.id) ? 'selected' : ''}>ساخته‌ی ${esc(a.username)}</option>`).join('')}</select>` : ''}
        <label class="chips" style="gap:6px;align-items:center"><input type="checkbox" id="uOnline" ${S.onlineOnly ? 'checked' : ''}> فقط آنلاین‌ها</label>
        <span class="muted">${rows.length} از ${S.users.length} کاربر · <b style="color:var(--good)">${S.users.filter(u => u.online).length} آنلاین</b></span></div>${bar}
      <div class="panel scroll"><table><thead><tr>${rs ? '' : `<th><input type="checkbox" id="selAll" ${allOn ? 'checked' : ''} aria-label="انتخاب همه‌ی نتیجه‌ها"></th>`}<th>کاربر</th><th>مصرف</th><th>انقضا</th><th>پروتکل‌ها</th><th>وضعیت</th>${rs || !S.admins.length ? '' : '<th>ساخته‌شده توسط</th>'}<th></th></tr></thead><tbody>
      ${rows.map(u => { const pc = u.quota_gb ? Math.min(100, u.used_gb / u.quota_gb * 100) : 0; const st = STATUS[u.status];
        return `<tr>${rs ? '' : `<td><input type="checkbox" data-sel="${u.id}" ${S.sel.has(u.id) ? 'checked' : ''} aria-label="انتخاب ${esc(u.name)}"></td>`}<td><div class="who"><span class="av">${esc(u.name.replace(/^[^A-Za-z0-9]+/, '').charAt(0) || '?')}</span><span class="mono">${esc(u.name)}</span>${u.online ? '<span class="pill good">آنلاین</span>' : (u.last_seen ? `<span class="muted" style="font-size:11px">${ago(u.last_seen)}</span>` : '')}</div></td>
        <td><div style="display:flex;gap:8px;align-items:center"><div class="bar"><i class="${loadCls(pc)}" style="width:${pc}%"></i></div><span class="muted">${num(fmtGB(u.used_gb) + ' / ' + (u.quota_gb ? fmtGB(u.quota_gb) : '∞') + ' GB')}</span></div></td>
        <td>${u.days_left === null ? 'نامحدود' : u.days_left + ' روز'}</td><td class="pc">${u.protos.map(p => `<span class="cc">${esc(protoLabel(p))}</span>`).join('')}</td>
        <td><span class="pill ${st[0]}">${st[1]}</span></td>${rs || !S.admins.length ? '' : `<td>${owner(u) ? `<span class="pill acc">${esc(owner(u))}</span>` : '<span class="muted">مدیر اصلی</span>'}</td>`}
        <td><div class="chips" style="flex-wrap:nowrap"><button class="btn sm" data-copy="${esc(u.sub_url)}">کپی لینک</button><button class="btn sm" data-cfg="${u.id}">کانفیگ‌ها</button>${!rs || S.me.can_edit ? `<button class="btn sm" data-edit="${u.id}">ویرایش</button><button class="btn sm" data-toggle="${u.id}">${u.enabled ? 'غیرفعال' : 'فعال'}</button>` : ''}${!rs || S.me.can_delete ? `<button class="btn sm danger" data-deluser="${u.id}">حذف</button>` : ''}</div></td></tr>`; }).join('')
        || `<tr><td colspan="8" class="muted">کاربری وجود ندارد.</td></tr>`}</tbody></table></div>`;
  },
  look() {
    const b = S.brand, presets = ['#0d9488', '#0284c7', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#475569'];
    return `<div class="note">نام و لوگو در نوار کناری، صفحه ورود، تب مرورگر و صفحه اشتراک کاربران دیده می‌شوند.</div>
      <div class="panel"><div class="form" style="grid-template-columns:1fr">
        <label class="f">نام پنل<input type="text" id="bName" value="${esc(b.name)}" maxlength="40"></label>
        <div class="f"><span>لوگو (PNG، JPG، WebP یا SVG؛ خودکار کوچک می‌شود)</span>
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><span id="bPrev">${logoMark(b)}</span>
            <input type="file" id="bFile" accept="image/png,image/jpeg,image/webp,image/svg+xml" style="width:auto">
            <button class="btn sm" id="bClearLogo" ${b.logo ? '' : 'disabled'}>حذف لوگو</button></div></div>
        <div class="f"><span>رنگ اصلی</span><div class="chips" id="bColors">
          ${presets.map(c => `<button class="btn sm" data-color="${c}" style="background:${c};width:30px;height:30px;padding:0;border-radius:50%" aria-label="${c}"></button>`).join('')}
          <input type="color" id="bColor" value="${/^#[0-9a-f]{6}$/i.test(b.color) ? b.color : '#0d9488'}" style="width:44px;height:30px;padding:0;border:0;background:none">
          <button class="btn sm" data-color="">پیش‌فرض</button></div></div></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button class="btn pri" id="bSave">ذخیره</button></div></div>`;
  },
  admins() {
    const pill = a => a.enabled ? '<span class="pill good">فعال</span>' : '<span class="pill bad">غیرفعال</span>';
    return `<div class="note">ادمین فرعی (همکار) با نام کاربری و رمز خودش وارد می‌شود و به‌صورت پیش‌فرض <b>فقط می‌تواند کاربر بسازد</b> و کاربران خودش را ببیند و لینک و کانفیگشان را بردارد. حذف و ویرایش را برای هر ادمین جدا می‌توانید اجازه بدهید. به لوکیشن‌ها، تنظیمات و کاربران دیگران دسترسی ندارد.</div>
      <div class="panel scroll"><table><thead><tr><th>نام کاربری</th><th>کاربران (فعال / کل)</th><th>حجم واگذارشده</th><th>مصرف‌شده</th><th>سقف هر کاربر</th><th>دسترسی‌ها</th><th>وضعیت</th><th></th></tr></thead><tbody>
      ${S.admins.map(a => `<tr><td><div class="who"><span class="av">${esc(a.username.charAt(0))}</span><span class="mono">${esc(a.username)}</span></div></td>
        <td>${num(a.active_users + ' / ' + a.users + (a.max_users ? ' (سقف ' + a.max_users + ')' : ''))}</td>
        <td><div style="display:flex;gap:8px;align-items:center"><div class="bar"><i class="${loadCls(a.max_total_gb ? a.allocated_gb / a.max_total_gb * 100 : 0)}" style="width:${a.max_total_gb ? Math.min(100, a.allocated_gb / a.max_total_gb * 100) : 0}%"></i></div><span class="muted">${num(fmtGB(a.allocated_gb) + ' / ' + (a.max_total_gb ? fmtGB(a.max_total_gb) : '∞') + ' GB')}</span></div></td>
        <td>${num(fmtGB(a.used_gb) + ' GB')}</td>
        <td>${a.max_quota_gb ? num(a.max_quota_gb + ' GB') : 'بدون سقف'}${a.max_days ? ' · ' + a.max_days + ' روز' : ''}</td>
        <td><span class="pill acc">ساخت</span> ${a.can_edit ? '<span class="pill acc">ویرایش و تمدید</span> ' : ''}${a.can_delete ? '<span class="pill warn">حذف</span> ' : ''}
          ${a.allowed_protos.length ? `<span class="pill" title="${esc(a.allowed_protos.map(protoLabel).join('، '))}">${a.allowed_protos.length} پروتکل</span> ` : ''}${a.allowed_nodes.length ? `<span class="pill" title="${esc(a.allowed_nodes.map(i => (nodeBy(i) || {name: i}).name).join('، '))}">${a.allowed_nodes.length} لوکیشن</span>` : ''}</td><td>${pill(a)}</td>
        <td><div class="chips" style="flex-wrap:nowrap"><button class="btn sm" data-editadmin="${a.id}">ویرایش</button><button class="btn sm" data-toggleadmin="${a.id}">${a.enabled ? 'غیرفعال' : 'فعال'}</button><button class="btn sm danger" data-deladmin="${a.id}">حذف</button></div></td></tr>`).join('')
        || '<tr><td colspan="8" class="muted">هنوز ادمین فرعی نساخته‌اید.</td></tr>'}</tbody></table></div>`;
  },
};

function dnsttPanel() {
  const d = S.dnstt; if (!d) return '';
  const ls = d.last_sync || {}, st = (ls.nodes || {}), cell = v => !v ? '<span class="muted">—</span>' : v.startsWith('error') ? `<span class="pill bad wrap">${esc(v)}</span>` : `<span class="pill good">${esc(v === 'created' ? 'ساخته شد' : v === 'exists' ? 'هست' : 'پاک شد')}</span>`;
  return `<div class="panel"><h2>${ic('globe')}DNSTT (تونل DNS)</h2>
    <div class="note">برای وقتی که همه‌چیز بسته است و فقط DNS کار می‌کند؛ خیلی کند است. اول در جدول بالا DNSTT را برای هر نودی که می‌خواهید روشن کنید. رکوردهای DNS (A و NS) را همین‌جا خودکار می‌سازم. فایروال هر نود هم باید <b>UDP 53</b> را باز بگذارد.</div>
    <div class="form" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
      <label class="f">دامنه‌ی اصلی در Cloudflare<input type="text" id="dtZone" value="${esc(d.zone)}" placeholder="example.com" dir="ltr"></label>
      <label class="f">دامنه‌ی تونل (ساب‌دامین)<input type="text" id="dtDomain" value="${esc(d.domain)}" placeholder="t.example.com" dir="ltr"></label>
      <label class="f">پروتکل داخل تونل
        <select id="dtInner"><option value="ssh" ${d.inner === 'ssh' ? 'selected' : ''}>SSH (برای NetMod: «DNSTT + SSH»)</option><option value="vless" ${d.inner === 'vless' ? 'selected' : ''}>VLESS (برای dnstt-client + v2rayNG یا v2rayN)</option></select></label>
      <label class="f">توکن Cloudflare ${d.token_set ? `<span class="muted">(ذخیره شده، …${esc(d.token_hint)}؛ خالی = بدون تغییر)</span>` : ''}<input type="password" id="dtToken" autocomplete="off" dir="ltr"></label></div>
    ${d.inner === 'ssh' ? '<div class="note">در حالت SSH هر کاربر یک حساب SSH جدا روی نود می‌گیرد (نام کاربری و رمز در «کانفیگ‌ها»ی کاربر). کاربر منقضی یا غیرفعال ظرف ۳۰ ثانیه قطع می‌شود، ولی <b>حجم مصرفی در این حالت شمرده نمی‌شود</b>. اگر حجم برایتان مهم است، حالت VLESS را بگذارید.</div>' : ''}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0"><button class="btn pri" id="dtSave">ذخیره</button><button class="btn" id="dtSync">همگام‌سازی DNS</button>
      ${d.token_set ? '<button class="btn danger" id="dtClear">حذف توکن</button>' : ''}</div>
    ${ls.error ? `<div class="note" style="color:var(--bad)">آخرین همگام‌سازی ناموفق بود: ${esc(ls.error)}</div>` : ''}
    <div class="scroll"><table><thead><tr><th>لوکیشن</th><th>DNSTT</th><th>رکورد A</th><th>رکورد NS</th></tr></thead><tbody>
      ${d.nodes.map(n => `<tr><td>${esc(n.name)} <span class="muted mono">${esc(n.address)}</span></td><td>${n.enabled ? '<span class="pill good">روشن</span>' : '<span class="pill">خاموش</span>'}</td>
        <td>${cell((st[n.id] || {}).a)}</td><td>${cell((st[n.id] || {}).ns)}</td></tr>`).join('')}</tbody></table></div>
    <div class="note" style="margin-top:10px">${d.pubkey ? `کلید عمومی (برای کلاینت): <span class="mono" style="word-break:break-all">${esc(d.pubkey)}</span>` : 'کلید عمومی بعد از اینکه اولین نود DNSTT را راه انداخت (چند دقیقه، چون برنامه ساخته می‌شود) اینجا می‌آید.'}</div></div>`;
}
const XRAY_COPYABLE = ['vless', 'vless_tcp', 'vless_raw', 'vless_ws', 'vless_grpc', 'vmess_ws', 'vmess_tcp', 'trojan', 'trojan_ws', 'ss'];
function portPanel() {
  if (!S.nodes.length) return '';
  const n = nodeBy(S.portNode) || S.nodes[0], [lo, hi] = n.port_range;
  const base = np => (S.protos.find(x => x.id === np.proto) || {label: np.proto}).label;
  return `<div class="panel"><h2>${ic('pin')}ورودی‌ها: اسم، پورت و آدرس</h2>
    <div class="note">هر ردیف یک ورودی از این لوکیشن است. <b>اسمی</b> که می‌نویسید به کاربر نشان داده می‌شود (مثلاً «ایرانسل»، «وای‌فای»، «تانل»)، <b>آدرس</b> دامنه یا IP ای است که لینک به آن وصل می‌شود (خالی = آدرس لوکیشن). با «+ نسخه» از همان پروتکل یک ورودی دیگر با پورت و اسم و آدرس جدا می‌سازید. کاربرانی که آن پروتکل را دارند همه‌ی نسخه‌ها را در اشتراکشان می‌بینند.</div>
    <div class="form" style="margin:10px 0"><label class="f">لوکیشن<select id="portNode">${S.nodes.map(x => `<option value="${x.id}" ${x.id === n.id ? 'selected' : ''}>${esc(x.cc)} ${esc(x.name)}</option>`).join('')}</select></label></div>
    <div class="scroll"><table><thead><tr><th>پروتکل</th><th>اسم برای کاربر</th><th>پورت</th><th>آدرس در لینک</th><th></th></tr></thead><tbody>
    ${n.protocols.map(np => `<tr><td>${esc(base(np))}${np.extra ? ' <span class="pill acc">نسخه‌ی اضافه</span>' : ''}</td>
      <td><input type="text" id="npl-${np.id}" value="${esc(np.label)}" placeholder="${esc(np.extra ? base(np) + ' (' + np.port + ')' : base(np))}" maxlength="40" style="width:170px"></td>
      <td>${np.fixed ? `<span class="mono">${np.port}</span> <span class="pill">ثابت</span>` : `<input type="number" min="1" max="65535" value="${np.port}" id="npp-${np.id}" style="width:100px" dir="ltr">`}</td>
      <td><input type="text" id="nph-${np.id}" value="${esc(np.host || '')}" placeholder="خودکار: ${esc(n.address)}" dir="ltr" style="width:190px"></td>
      <td><div class="chips" style="flex-wrap:nowrap"><button class="btn sm pri" data-npsave="${np.id}">ذخیره</button>
        ${np.fixed ? '' : `<button class="btn sm" data-nprand="${np.id}">رندوم</button>`}
        ${!np.extra && XRAY_COPYABLE.includes(np.proto) ? `<button class="btn sm" data-npadd="${np.proto}" data-nid="${n.id}">+ نسخه</button>` : ''}
        ${np.extra ? `<label style="display:flex;gap:4px;align-items:center"><input type="checkbox" data-npon="${np.id}" ${np.enabled ? 'checked' : ''}>روشن</label><button class="btn sm danger" data-npdel="${np.id}">حذف</button>` : ''}</div></td></tr>`).join('')}
    </tbody></table></div>
    <div class="note" style="margin-top:10px">پورت رندوم از بازه‌ی ${lo} تا ${hi} انتخاب می‌شود؛ پورت‌های جدید را در فایروال سرویس‌دهنده باز کنید (بهتر است کل این بازه را از قبل باز بگذارید). تغییر اسم و آدرس فقط لینک‌ها را عوض می‌کند و روی نود تغییری لازم ندارد؛ تغییر پورت ظرف ۳۰ ثانیه روی نود اعمال می‌شود. لینک‌های قبلیِ پورت قدیمی کار نمی‌کنند و کاربران باید اشتراک را به‌روز کنند.</div></div>`;
}

function render() {
  $('#title').textContent = TITLES[S.tab];
  document.querySelectorAll('[data-sudo]').forEach(b => b.hidden = isReseller());
  $('#actions').innerHTML = S.tab === 'users' ? (isReseller() ? '' : '<button class="btn" id="bulkBtn">عملیات گروهی</button> ') + '<button class="btn pri" id="addUser">+ کاربر جدید</button>'
    : S.tab === 'nodes' ? '<button class="btn pri" id="addNode">+ لوکیشن جدید</button>'
    : S.tab === 'tunnels' ? '<button class="btn pri" id="addTunnel">+ تونل جدید</button>'
    : S.tab === 'admins' ? '<button class="btn pri" id="addAdmin">+ ادمین جدید</button>' : '';
  const typing = document.activeElement && document.activeElement.id === 'uq' ? document.activeElement.selectionStart : null;
  $('#view').innerHTML = `<div style="display:flex;flex-direction:column;gap:12px">${views[S.tab]()}</div>`;
  if (typing !== null && $('#uq')) { $('#uq').focus(); $('#uq').setSelectionRange(typing, typing); }
  $('#nNodes').textContent = S.nodes.length; $('#nUsers').textContent = S.users.length; $('#nAdmins').textContent = S.admins.length || ''; $('#nTunnels').textContent = S.tunnels.length || '';
  document.querySelectorAll('nav [data-tab]').forEach(b => b.setAttribute('aria-current', b.dataset.tab === S.tab));
}

function nodeForm() {
  openModal(`<h2>لوکیشن جدید</h2><div class="form">
    <label class="f">نام<input type="text" id="nName" placeholder="آلمان - فرانکفورت"></label>
    <label class="f">کد کشور<input type="text" id="nCc" maxlength="2" placeholder="DE"></label>
    <label class="f">آدرس سرور (دامنه یا آی‌پی)<input type="text" id="nAddr" placeholder="de.example.com"></label></div>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-close>انصراف</button><button class="btn pri" id="nSave">ساخت و گرفتن دستور نصب</button></div>`);
}
const flagOf = cc => /^[A-Za-z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc.toUpperCase()].map(c => 127397 + c.charCodeAt(0))) : '';
function editNodeDialog(n) {
  openModal(`<h2>ویرایش لوکیشن</h2>
    <div class="note">نام به کاربر نشان داده می‌شود (در برنامه‌ی کلاینت و صفحه‌ی اشتراک). می‌توانید ایموجی بگذارید، مثلاً <span dir="ltr">🇹🇷 Turkey - Istanbul ⚡</span>.</div>
    <div class="form"><label class="f">نام<input type="text" id="enName" value="${esc(n.name)}" maxlength="60"></label>
      <label class="f">کد کشور (دو حرف)<input type="text" id="enCc" value="${esc(n.cc)}" maxlength="2" dir="ltr"></label>
      <label class="f">آدرس سرور<input type="text" id="enAddr" value="${esc(n.address)}" dir="ltr"></label></div>
    <div class="chips"><button class="btn sm" data-addflag>افزودن پرچم ${esc(flagOf(n.cc))}</button>
      ${['⚡', '🚀', '🔒', '⭐', '🌐'].map(e => `<button class="btn sm" data-addemoji="${e}">${e}</button>`).join('')}</div>
    <div class="note">اگر آدرس را عوض کنید، لینک‌های کاربران عوض می‌شود و باید اشتراک را به‌روز کنند. نود آنلاین می‌ماند، ولی گواهی TLS آن برای آدرس قبلی صادر شده بود.</div>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-close>انصراف</button><button class="btn pri" id="enSave" data-id="${n.id}">ذخیره</button></div>`);
}
function installDialog(n) {
  openModal(`<h2>نصب نود ${esc(n.name)}</h2>
    <p class="muted" style="margin:0">روی سرور تازه (اوبونتو ۲۲.۰۴ یا ۲۴.۰۴، دسترسی root) این دستور را اجرا کنید:</p>
    <pre>${esc(n.install_command)}</pre>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-copy="${esc(n.install_command)}">کپی دستور</button><button class="btn pri" data-close>بستن</button></div>`);
}
const REALITY_SITES = ['www.apple.com', 'www.microsoft.com', 'addons.mozilla.org', 'dl.google.com', 'www.samsung.com', 'www.asus.com', 'www.lovelive-anime.jp'];
function realityDialog(n) {
  openModal(`<h2>Reality برای ${esc(n.name)}</h2>
    <p class="muted" style="margin:0">سایتی که Reality ادای آن را درمی‌آورد. باید از روی سرور نود با TLS 1.3 و h2 جواب بدهد و پشت CDN نباشد؛ همه‌ی سایت‌ها از همه‌ی سرورها جواب نمی‌دهند.</p>
    <label class="f">دامنه‌ی سایت پوشش<input type="text" id="rSni" value="${esc(n.reality_sni)}" dir="ltr"></label>
    <div class="chips">${REALITY_SITES.map(s => `<button class="btn sm" data-pick="${s}">${s}</button>`).join('')}</div>
    <div class="note">بعد از ذخیره، اشتراک را در برنامه به‌روز کنید. برای بررسی روی نود: <span class="mono">python3 /tmp/selftest.py لینک_اشتراک Reality</span></div>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-close>انصراف</button><button class="btn pri" id="rSave" data-id="${n.id}">ذخیره</button></div>`);
}
function cfDialog(n) {
  openModal(`<h2>کلادفلر برای ${esc(n.name)}</h2>
    <p class="muted" style="margin:0">برای VLESS/VMess/Trojan با WebSocket و VLESS با gRPC ورودی جداگانه‌ی «Cloudflare» ساخته می‌شود. خالی بگذارید تا غیرفعال شود.</p>
    <div class="form">
      <label class="f">دامنه (پروکسی‌شده در کلادفلر، ابر نارنجی)<input type="text" id="cfDomain" value="${esc(n.cf_domain)}" placeholder="cdn.example.com" dir="ltr"></label>
      <label class="f">آی‌پی تمیز (اختیاری)<input type="text" id="cfAddr" value="${esc(n.cf_address)}" placeholder="104.16.x.x" dir="ltr"></label></div>
    <label class="f">آدرس VLESS ساده (بدون TLS)؛ مثلاً دامنه‌ی قبلی x-ui<input type="text" id="rawHost" value="${esc(n.raw_host)}" placeholder="tunnel.example.com" dir="ltr"></label>
    <div class="note">در کلادفلر: رکورد A دامنه را به آی‌پی ${esc(n.address)} با ابر نارنجی بسازید، SSL/TLS را روی <b>Full</b> بگذارید (نه Strict)، و برای gRPC گزینه‌ی gRPC را در Network روشن کنید. فقط پورت‌های 443، 2053، 2083، 2087، 2096 و 8443 از کلادفلر رد می‌شوند.</div>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-close>انصراف</button><button class="btn pri" id="cfSave" data-id="${n.id}">ذخیره</button></div>`);
}
function editDialog(u) {
  openModal(`<h2>ویرایش <span class="mono">${esc(u.name)}</span></h2>
    <div class="note">${u.expire_at ? 'انقضا: ' + new Date(u.expire_at).toLocaleDateString('fa-IR') + ` (${u.days_left} روز مانده)` : 'بدون انقضا'}
      · مصرف ${fmtGB(u.used_gb)} از ${u.quota_gb ? fmtGB(u.quota_gb) + ' GB' : 'نامحدود'}</div>
    <div><div class="muted" style="margin-bottom:6px">تمدید</div><div class="chips">
      ${[7, 30, 90].map(n => `<button class="btn sm" data-renew="${n}" data-id="${u.id}">+${n} روز</button>`).join('')}
      <label><input type="checkbox" id="eReset" checked>ریست مصرف هنگام تمدید</label></div></div>
    <div class="form">
      <label class="f">حجم (GB، صفر = نامحدود)<input type="number" id="eQuota" value="${u.quota_gb}" min="0" step="any"></label>
      <label class="f">انقضا از امروز (روز، صفر = نامحدود)<input type="number" id="eDays" value="${u.days_left ?? 0}" min="0"></label></div>
    ${isReseller() ? '' : `<div><div class="muted" style="margin-bottom:6px">لوکیشن‌ها (هیچ‌کدام = همه)</div><div class="chips" id="eNodes">
      ${S.nodes.map(n => `<label><input type="checkbox" value="${n.id}" ${u.node_ids.includes(n.id) ? 'checked' : ''}>${esc(n.cc)} ${esc(n.name)}</label>`).join('')}</div></div>
    <div><div class="muted" style="margin-bottom:6px">پروتکل‌ها</div><div class="chips" id="eProtos">
      ${S.protos.map(p => `<label><input type="checkbox" value="${p.id}" ${u.protos.includes(p.id) ? 'checked' : ''}>${esc(p.label)}${p.counted ? '' : ' <span class="muted">(حجم شمرده نمی‌شود)</span>'}</label>`).join('')}</div></div>`}
    <div style="display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap"><button class="btn sm" data-resetusage="${u.id}">ریست مصرف</button>
      <span><button class="btn" data-close>انصراف</button> <button class="btn pri" id="eSave" data-id="${u.id}">ذخیره</button></span></div>`);
}
function bulkTargets() { return S.sel.size ? [...S.sel] : S.users.map(u => u.id); }
function bulkDialog() {
  const n = bulkTargets().length, scope = S.sel.size ? `${n} کاربر انتخاب‌شده` : `همه‌ی ${n} کاربر (چیزی انتخاب نشده)`;
  openModal(`<h2>عملیات گروهی</h2><div class="note">روی <b>${scope}</b> اعمال می‌شود.</div>
    <div><div class="muted" style="margin-bottom:6px">پروتکل‌هایی که اضافه شوند</div><div class="chips" id="bAdd">
      ${S.protos.map(p => `<label><input type="checkbox" value="${p.id}">${esc(p.label)}</label>`).join('')}</div></div>
    <div><div class="muted" style="margin-bottom:6px">پروتکل‌هایی که برداشته شوند (هر کاربر حداقل یکی را نگه می‌دارد)</div><div class="chips" id="bRem">
      ${S.protos.map(p => `<label><input type="checkbox" value="${p.id}">${esc(p.label)}</label>`).join('')}</div></div>
    <label class="f">لوکیشن‌ها<select id="bLoc"><option value="keep">بدون تغییر</option><option value="all">همه‌ی لوکیشن‌ها (جدیدها هم)</option><option value="pick">فقط لوکیشن‌های تیک‌خورده</option></select></label>
    <div class="chips" id="bNodes">${S.nodes.map(x => `<label><input type="checkbox" value="${x.id}">${esc(x.cc)} ${esc(x.name)}</label>`).join('')}</div>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-close>انصراف</button><button class="btn pri" id="bulkApply">اعمال</button></div>`);
}
function bulkDelDialog() {
  const us = S.users.filter(u => S.sel.has(u.id)), bots = us.filter(u => u.name.startsWith('tg_')).length;
  openModal(`<h2>حذف ${us.length} کاربر؟</h2>
    <p class="mono" style="margin:0;word-break:break-all">${us.slice(0, 8).map(u => esc(u.name)).join('، ')}${us.length > 8 ? ` و ${us.length - 8} نفر دیگر` : ''}</p>
    ${bots ? `<div class="note" style="color:var(--bad,#c0392b)">⚠ ${bots} تا از این‌ها کاربر ربات تلگرام‌اند (نامشان با tg_ شروع می‌شود). حذفشان مشتری را قطع می‌کند.</div>` : ''}
    <div class="note">حذف برگشت‌پذیر نیست؛ لینک اشتراک آن‌ها از کار می‌افتد.</div>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-close>انصراف</button><button class="btn pri" id="bulkDelGo" style="background:var(--bad,#c0392b)">حذف قطعی</button></div>`);
}
async function loadRouting(id) {
  try { S.routing = {nodeId: id, data: await api('GET', `/nodes/${id}/routing`)}; render(); } catch (e) { if (e.message !== 'login') toast(e.message); }
}
function outboundDialog(kind = 'link') {
  const f = (id, label, ph = '', type = 'text') => `<label class="f">${label}<input type="${type}" id="${id}" placeholder="${ph}" dir="ltr"></label>`;
  const fields = {
    link: f('oLink', 'لینک (vless:// vmess:// trojan:// ss://)', 'vless://...'),
    socks: f('oAddr', 'آدرس سرور') + f('oPort', 'پورت', '1080', 'number') + f('oUser', 'نام کاربری (اختیاری)') + f('oPass', 'رمز (اختیاری)'),
    http: f('oAddr', 'آدرس سرور') + f('oPort', 'پورت', '8080', 'number') + f('oUser', 'نام کاربری (اختیاری)') + f('oPass', 'رمز (اختیاری)'),
    wireguard: f('oEndpoint', 'Endpoint (host:port)', 'engage.cloudflareclient.com:2408') + f('oSecret', 'کلید خصوصی') + f('oPub', 'کلید عمومی سرور')
      + f('oLocal', 'آدرس داخلی', '172.16.0.2/32') + f('oReserved', 'Reserved (برای WARP، سه عدد)', '12, 34, 56'),
  };
  openModal(`<h2>خروجی جدید</h2><div class="form">
    <label class="f">نام (حروف کوچک انگلیسی)<input type="text" id="oName" placeholder="warp" dir="ltr"></label>
    <label class="f">نوع<select id="oKind">${[['link', 'لینک'], ['socks', 'SOCKS'], ['http', 'HTTP'], ['wireguard', 'WireGuard / WARP']].map(([k, l]) => `<option value="${k}" ${k === kind ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
    <div class="form">${fields[kind]}</div>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-close>انصراف</button><button class="btn pri" id="oSave">افزودن</button></div>`);
}
function ruleDialog() {
  const R = S.routing.data;
  openModal(`<h2>قانون مسیریابی جدید</h2>
    <div><div class="muted" style="margin-bottom:6px">ورودی‌ها (هیچ‌کدام = همه‌ی ورودی‌های Xray)</div><div class="chips" id="rIn">
      ${R.inbound_ids.map(i => `<label><input type="checkbox" value="${i.id}">${esc(i.label)}</label>`).join('')}</div></div>
    <div class="form"><label class="f">پورت مقصد (مثل 443 یا 80,443 یا 8000-9000)<input type="text" id="rPorts" dir="ltr"></label>
      <label class="f">خروجی<select id="rOut"><option value="direct">مستقیم (direct)</option><option value="block">مسدود (block)</option>${R.outbounds.map(o => `<option value="${esc(o.name)}">${esc(o.name)}</option>`).join('')}</select></label></div>
    <div class="form"><label class="f">دامنه‌ها (هر خط یکی؛ مثل geosite:google یا domain:example.com)<textarea id="rDomains" rows="3" dir="ltr" style="background:var(--surface2);border:1px solid var(--line);border-radius:8px;padding:6px 10px;color:inherit;font:inherit"></textarea></label>
      <label class="f">آی‌پی‌ها (هر خط یکی؛ مثل 1.2.3.0/24 یا geoip:ir)<textarea id="rIps" rows="3" dir="ltr" style="background:var(--surface2);border:1px solid var(--line);border-radius:8px;padding:6px 10px;color:inherit;font:inherit"></textarea></label></div>
    <label class="f">یادداشت (اختیاری)<input type="text" id="rNote"></label>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-close>انصراف</button><button class="btn pri" id="ruleSave">افزودن</button></div>`);
}
function userForm() {
  openModal(`<h2>کاربر جدید</h2><div class="form">
    <label class="f">نام کاربری<input type="text" id="fName" placeholder="ali_t"></label>
    <label class="f">حجم (GB${isReseller() && S.me.max_quota_gb ? `، حداکثر ${S.me.max_quota_gb}` : '، صفر = نامحدود'})<input type="number" id="fQuota" value="${isReseller() && S.me.max_quota_gb ? Math.min(50, S.me.max_quota_gb) : 50}" min="0" ${isReseller() && S.me.max_quota_gb ? `max="${S.me.max_quota_gb}"` : ''}></label>
    <label class="f">مدت (روز${isReseller() && S.me.max_days ? `، حداکثر ${S.me.max_days}` : '، صفر = نامحدود'})<input type="number" id="fDays" value="${isReseller() && S.me.max_days ? Math.min(30, S.me.max_days) : 30}" min="0" ${isReseller() && S.me.max_days ? `max="${S.me.max_days}"` : ''}></label></div>
    <div><div class="muted" style="margin-bottom:6px">لوکیشن‌ها (هیچ‌کدام = همه)</div><div class="chips" id="fNodes">
      ${S.nodes.map(n => `<label><input type="checkbox" value="${n.id}">${esc(n.cc)} ${esc(n.name)}</label>`).join('')}</div></div>
    <div><div class="muted" style="margin-bottom:6px">پروتکل‌ها</div><div class="chips" id="fProtos">
      ${S.protos.map(p => `<label><input type="checkbox" value="${p.id}" ${['vless', 'l2tp'].includes(p.id) ? 'checked' : ''}>${esc(p.label)}${p.counted ? '' : ' <span class="muted">(حجم شمرده نمی‌شود)</span>'}</label>`).join('')}</div></div>
    <div class="note">حجم و زمان بین همه‌ی کانفیگ‌ها و لوکیشن‌های این کاربر مشترک است و با یک لینک اشتراک داده می‌شود.</div>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-close>انصراف</button><button class="btn pri" id="fSave">ساخت کاربر</button></div>`);
}
function adminForm(a) {
  const n = (id, label, val, hint) => `<label class="f">${label}<input type="number" id="${id}" value="${val}" min="0" step="any"><span class="muted">${hint}</span></label>`;
  openModal(`<h2>${a ? 'ویرایش ' + esc(a.username) : 'ادمین جدید'}</h2><div class="form">
    ${a ? '' : '<label class="f">نام کاربری<input type="text" id="adUser" dir="ltr" placeholder="sara"></label>'}
    <label class="f">${a ? 'رمز جدید (خالی = بدون تغییر)' : 'رمز (حداقل ۸ کاراکتر)'}<input type="text" id="adPass" dir="ltr" autocomplete="off"></label></div>
    <div class="form">${n('adMax', 'حداکثر تعداد کاربر', a ? a.max_users : 20, 'صفر = بدون سقف')}${n('adQuota', 'حداکثر حجم هر کاربر (GB)', a ? a.max_quota_gb : 50, 'صفر = بدون سقف؛ اگر سقف بگذارید، کاربر نامحدود نمی‌سازد')}
    ${n('adDays', 'حداکثر مدت هر کاربر (روز)', a ? a.max_days : 60, 'صفر = بدون سقف')}
    ${n('adTotal', 'سقف کل حجم همه‌ی کاربرانش (GB)', a ? a.max_total_gb : 0, 'صفر = بدون سقف؛ مجموع حجمِ کاربرانی که می‌سازد از این سقف کم می‌شود')}</div>
    <div><div class="muted" style="margin-bottom:6px">پروتکل‌هایی که می‌تواند به کاربر بدهد (هیچ‌کدام = همه)</div><div class="chips" id="adProtos">
      ${S.protos.map(x => `<label><input type="checkbox" value="${x.id}" ${a && a.allowed_protos.includes(x.id) ? 'checked' : ''}>${esc(x.label)}</label>`).join('')}</div></div>
    <div><div class="muted" style="margin-bottom:6px">لوکیشن‌هایی که می‌تواند به کاربر بدهد (هیچ‌کدام = همه)</div><div class="chips" id="adNodes">
      ${S.nodes.map(x => `<label><input type="checkbox" value="${x.id}" ${a && a.allowed_nodes.includes(x.id) ? 'checked' : ''}>${esc(x.cc)} ${esc(x.name)}</label>`).join('')}</div></div>
    <div><div class="muted" style="margin-bottom:6px">دسترسی‌ها (ساخت و دیدن کاربران خودش همیشه هست)</div><div class="chips">
      <label><input type="checkbox" id="adEdit" ${a && a.can_edit ? 'checked' : ''}>ویرایش و تمدید کاربران خودش</label>
      <label><input type="checkbox" id="adDel" ${a && a.can_delete ? 'checked' : ''}>حذف کاربران خودش</label></div></div>
    ${a ? '<div class="note">با عوض کردن رمز، ادمین از همه‌ی دستگاه‌ها خارج می‌شود.</div>' : ''}
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-close>انصراف</button><button class="btn pri" id="adSave" ${a ? `data-id="${a.id}"` : ''}>ذخیره</button></div>`);
}
async function configsDialog(id) {
  const u = S.users.find(x => x.id === id), rows = await api('GET', `${isReseller() ? '/me' : ''}/users/${id}/configs`);
  openModal(`<h2>کانفیگ‌های <span class="mono">${esc(u.name)}</span></h2>
    <div class="link"><span style="min-width:90px">لینک اشتراک</span><code>${esc(u.sub_url)}</code><button class="btn sm" data-copy="${esc(u.sub_url)}">کپی</button></div>
    <div class="links">${rows.length ? rows.map(r => r.link
      ? `<div class="link"><span class="cc">${esc(r.cc)}</span><b style="white-space:nowrap">${esc(r.node)}</b><span class="muted" style="white-space:nowrap;font-size:12px">${esc(r.label)}</span><code>${esc(r.link)}</code><button class="btn sm" data-copy="${esc(r.link)}">کپی</button></div>`
      : `<div class="link"><span class="cc">${esc(r.cc)}</span><b style="white-space:nowrap">${esc(r.node)}</b><span class="muted" style="white-space:nowrap;font-size:12px">${esc(r.label)}</span><code>${esc(r.summary)}</code>${r.file_ext ? `<a class="btn sm" style="text-decoration:none" href="${esc(u.sub_url)}/file/${r.node_id}/${r.proto}">دانلود فایل</a>` : ''}<button class="btn sm" data-copy="${esc(r.copy)}">کپی</button></div>`).join('')
      : '<p class="muted">هنوز کانفیگی نیست. نود باید آنلاین باشد و پروتکل مورد نظر روی آن روشن باشد (برای VLESS اولین گزارش نود لازم است).</p>'}</div>
    <div style="text-align:left"><button class="btn" data-close>بستن</button></div>`);
}

document.addEventListener('click', async e => {
  const t = e.target.closest('button') || e.target, d = t.dataset;   // icons and labels sit inside the buttons
  try {
    if (d.tab) { if (S.draft) { S.draft = null; loadBrand(); } S.tab = d.tab; render(); }   // unsaved branding preview is dropped
    else if (t.id === 'themeBtn') { const r = document.documentElement; r.dataset.theme = getComputedStyle(r).colorScheme.includes('dark') ? 'light' : 'dark'; }
    else if (t.id === 'backupBtn') {
      const r = await fetch('/api/backup', {headers: {Authorization: 'Bearer ' + token}});
      if (!r.ok) throw new Error('پشتیبان‌گیری ناموفق بود');
      const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob());
      a.download = (r.headers.get('content-disposition') || '').split('filename=')[1]?.replace(/"/g, '') || 'panel-backup.db';
      a.click(); URL.revokeObjectURL(a.href); toast('پشتیبان دانلود شد');
    }
    else if (t.id === 'logoutBtn') { token = ''; try { localStorage.removeItem('tok'); } catch (_) {} showLogin(); }
    else if (t.id === 'doLogin') {
      const r = await api('POST', '/login', {password: $('#pw').value, username: $('#un').value.trim()}); token = r.token;
      try { localStorage.setItem('tok', token); } catch (_) {}
      closeModal(); await refresh();
    }
    else if (t.id === 'addNode') nodeForm();
    else if (t.id === 'addTunnel') {
      if (!S.nodes.length) { toast('اول یک لوکیشن خارج بسازید'); return; }
      openModal(`<h2>تونل جدید</h2><div class="form">
        <label class="f">نام<input type="text" id="tnName" placeholder="ایران - آلمان"></label>
        <label class="f">آدرس سرور ایران (IP یا دامنه)<input type="text" id="tnHost" dir="ltr" placeholder="1.2.3.4"></label>
        <label class="f">لوکیشن خارج<select id="tnNode">${S.nodes.map(n => `<option value="${n.id}">${esc(n.name)}</option>`).join('')}</select></label>
        <label class="f">پورت‌ها<input type="text" id="tnPorts" dir="ltr" placeholder="80, 81=80, udp:5000, 2000-2010"></label></div>
        <div class="note">با کاما جدا کنید. <span class="mono" dir="ltr" style="unicode-bidi:isolate">81=80</span>: پورت ۸۱ ایران به پورت ۸۰ خارج. <span class="mono" dir="ltr" style="unicode-bidi:isolate">udp:</span> برای UDP (بازی). بازه با خط تیره. پورت‌های ۷۷۷۷ به بعد برای خود تونل رزرو می‌شوند.</div>
        <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-close>انصراف</button><button class="btn pri" id="tnSave">ساخت</button></div>`);
    }
    else if (t.id === 'tnSave') {
      const r = await api('POST', '/tunnels', {name: $('#tnName').value.trim(), iran_host: $('#tnHost').value.trim(), node_id: +$('#tnNode').value, ports: $('#tnPorts').value});
      await refresh();
      openModal(`<h2>تونل ساخته شد</h2><p class="muted" style="margin:0">روی <b>سرور ایران</b> (با دسترسی root) این دستور را اجرا کنید. بقیه‌ی کارها (نصب، تنظیم، راه‌اندازی دوباره و سمت خارج) خودکار است:</p>
        <pre>${esc(r.install_command)}</pre><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-copy="${esc(r.install_command)}">کپی دستور</button><button class="btn pri" data-close>بستن</button></div>`);
    }
    else if (d.tedit) {
      const x = S.tunnels.find(q => q.id === +d.tedit);
      openModal(`<h2>ویرایش ${esc(x.name)}</h2><div class="form">
        <label class="f">نام<input type="text" id="teName" value="${esc(x.name)}"></label>
        <label class="f">آدرس سرور ایران<input type="text" id="teHost" dir="ltr" value="${esc(x.iran_host)}"></label>
        <label class="f">پورت‌ها<input type="text" id="tePorts" dir="ltr" value="${esc(x.ports)}"></label></div>
        <div class="note">تغییر پورت‌ها ظرف حدود ۳۰ ثانیه روی هر دو سرور اعمال می‌شود. اگر آدرس ایران را عوض می‌کنید، دستور نصب را روی سرور جدید اجرا کنید.</div>
        <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-close>انصراف</button><button class="btn pri" id="teSave" data-id="${x.id}">ذخیره</button></div>`);
    }
    else if (t.id === 'teSave') { await api('PATCH', '/tunnels/' + d.id, {name: $('#teName').value.trim(), iran_host: $('#teHost').value.trim(), ports: $('#tePorts').value}); closeModal(); await refresh(); toast('ذخیره شد'); }
    else if (d.ttoggle) { const x = S.tunnels.find(q => q.id === +d.ttoggle); await api('PATCH', '/tunnels/' + x.id, {enabled: !x.enabled}); await refresh(); }
    else if (d.tdel) {
      const x = S.tunnels.find(q => q.id === +d.tdel);
      openModal(`<h2>حذف تونل ${esc(x.name)}؟</h2><div class="note">تونل از هر دو سرور برداشته می‌شود و پورت‌های ایران بسته می‌شوند. به کانفیگ‌ها و کاربران کاری ندارد.</div>
        <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-close>انصراف</button><button class="btn pri" id="tdGo" data-id="${x.id}" style="background:var(--bad)">حذف</button></div>`);
    }
    else if (t.id === 'tdGo') { await api('DELETE', '/tunnels/' + d.id); closeModal(); await refresh(); toast('تونل حذف شد'); }
    else if (t.id === 'nSave') {
      const n = await api('POST', '/nodes', {name: $('#nName').value.trim(), cc: $('#nCc').value.trim(), address: $('#nAddr').value.trim()});
      await refresh(); installDialog(n);
    }
    else if (d.npsave) {
      const id = d.npsave, body = {label: $('#npl-' + id).value.trim(), host: $('#nph-' + id).value.trim()}, pe = $('#npp-' + id);
      if (pe) body.port = +pe.value;
      await api('PATCH', '/node-protocols/' + id, body); await refresh(); toast('ذخیره شد؛ اشتراک را در برنامه به‌روز کنید');
    }
    else if (d.nprand) { await api('PATCH', '/node-protocols/' + d.nprand, {random_port: true}); await refresh(); toast('پورت رندوم ساخته شد'); }
    else if (d.npadd) { await api('POST', `/nodes/${d.nid}/protocols/${d.npadd}/instances`); await refresh(); toast('نسخه‌ی جدید ساخته شد؛ اسم و آدرسش را بنویسید و ذخیره بزنید'); }
    else if (d.npdel) {
      const np = S.nodes.flatMap(x => x.protocols).find(x => x.id === +d.npdel);
      openModal(`<h2>حذف این نسخه؟</h2><div class="note">«${esc(np.label || 'بدون اسم')}» (پورت ${np.port}) از اشتراک همه‌ی کاربران برداشته می‌شود.</div>
        <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-close>انصراف</button><button class="btn pri" id="npDelGo" data-id="${np.id}" style="background:var(--bad)">حذف</button></div>`);
    }
    else if (t.id === 'npDelGo') { await api('DELETE', '/node-protocols/' + d.id); closeModal(); await refresh(); toast('نسخه حذف شد'); }
    else if (d.editnode) editNodeDialog(nodeBy(+d.editnode));
    else if ('addflag' in d) { const i = $('#enName'), f = flagOf($('#enCc').value); if (f && !i.value.startsWith(f)) i.value = f + ' ' + i.value.replace(/^\p{RI}{2}\s*/u, ''); }
    else if (d.addemoji) { const i = $('#enName'); i.value = (i.value.trimEnd() + ' ' + d.addemoji).slice(0, 60); }
    else if (t.id === 'enSave') {
      await api('PATCH', '/nodes/' + d.id, {name: $('#enName').value.trim(), cc: $('#enCc').value.trim(), address: $('#enAddr').value.trim()});
      closeModal(); await refresh(); toast('لوکیشن ذخیره شد');
    }
    else if (d.install) installDialog(nodeBy(+d.install));
    else if (d.cf) cfDialog(nodeBy(+d.cf));
    else if (d.reality) realityDialog(nodeBy(+d.reality));
    else if (d.pick) $('#rSni').value = d.pick;
    else if (t.id === 'rSave') { await api('PUT', `/nodes/${d.id}/reality`, {sni: $('#rSni').value.trim()}); closeModal(); await refresh(); toast('ذخیره شد؛ ظرف ۳۰ ثانیه روی نود اعمال می‌شود'); }
    else if (t.id === 'cfSave') { await api('PUT', `/nodes/${d.id}/cloudflare`, {cf_domain: $('#cfDomain').value.trim(), cf_address: $('#cfAddr').value.trim(), raw_host: $('#rawHost').value.trim()}); closeModal(); await refresh(); toast('ذخیره شد'); }
    else if (d.delnode) { await api('DELETE', '/nodes/' + d.delnode); closeModal(); await refresh(); toast('لوکیشن حذف شد'); }
    else if (t.id === 'addUser') userForm();
    else if (t.id === 'dtSave' || t.id === 'dtClear') {
      const body = {domain: $('#dtDomain').value.trim(), zone: $('#dtZone').value.trim(), inner: $('#dtInner').value}, tok = $('#dtToken').value.trim();
      if (t.id === 'dtClear') body.cf_token = ''; else if (tok) body.cf_token = tok;
      S.dnstt = await api('PUT', '/dnstt', body); render(); toast('ذخیره شد');
    }
    else if (t.id === 'dtSync') { S.dnstt = await api('POST', '/dnstt/sync'); render(); toast(S.dnstt.last_sync.ok ? 'DNS همگام شد' : 'همگام‌سازی ناموفق بود'); }
    else if (t.id === 'addAdmin') adminForm();
    else if (t.id === 'bSave') {
      const b = await api('PUT', '/branding', {name: $('#bName').value.trim() || S.brand.name, color: S.draft.color, logo: S.draft.logo});
      applyBrand(b); S.draft = null; render(); toast('ذخیره شد');
    }
    else if (t.id === 'bClearLogo') { draft().logo = ''; applyBrand({...S.brand, logo: ''}); render(); }
    else if ('color' in d && t.closest('#bColors')) { draft().color = d.color; applyBrand({...S.brand, color: d.color}); if (d.color) $('#bColor').value = d.color; }
    else if (d.editadmin) adminForm(S.admins.find(x => x.id === +d.editadmin));
    else if (t.id === 'adSave') {
      const v = id => $('#' + id).value.trim(), body = {max_users: +v('adMax') || 0, max_quota_gb: +v('adQuota') || 0, max_days: +v('adDays') || 0,
        max_total_gb: +v('adTotal') || 0, can_edit: $('#adEdit').checked, can_delete: $('#adDel').checked,
        allowed_protos: [...document.querySelectorAll('#adProtos input:checked')].map(x => x.value),
        allowed_nodes: [...document.querySelectorAll('#adNodes input:checked')].map(x => +x.value)};
      if (d.id) { if (v('adPass')) body.password = v('adPass'); await api('PATCH', '/admins/' + d.id, body); }
      else await api('POST', '/admins', {...body, username: v('adUser'), password: v('adPass')});
      closeModal(); await refresh(); toast('ذخیره شد');
    }
    else if (d.toggleadmin) { const a = S.admins.find(x => x.id === +d.toggleadmin); await api('PATCH', '/admins/' + a.id, {enabled: !a.enabled}); await refresh(); }
    else if (d.deladmin) {
      const a = S.admins.find(x => x.id === +d.deladmin);
      openModal(`<h2>حذف ادمین ${esc(a.username)}؟</h2><div class="note">کاربرانی که ساخته (${a.users} نفر) حذف نمی‌شوند و کار می‌کنند، فقط دیگر به هیچ ادمینی تعلق ندارند.</div>
        <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-close>انصراف</button><button class="btn pri" id="delAdminGo" data-id="${a.id}" style="background:var(--bad)">حذف</button></div>`);
    }
    else if (t.id === 'delAdminGo') { await api('DELETE', '/admins/' + d.id); closeModal(); await refresh(); toast('ادمین حذف شد'); }
    else if (t.id === 'fSave') {
      const checked = s => [...document.querySelectorAll(s + ' input:checked')].map(x => x.value);
      const u = await api('POST', isReseller() ? '/me/users' : '/users', {name: $('#fName').value.trim(), quota_gb: +$('#fQuota').value || 0, days: +$('#fDays').value || 0,
        protos: checked('#fProtos'), node_ids: checked('#fNodes').map(Number)});
      await refresh(); configsDialog(u.id);
    }
    else if (t.id === 'bulkBtn') bulkDialog();
    else if (t.id === 'bulkDel') bulkDelDialog();
    else if (t.id === 'selClear') { S.sel.clear(); render(); }
    else if (t.id === 'bulkDelGo') { const r = await api('POST', '/users/bulk', {ids: [...S.sel], delete: true}); S.sel.clear(); closeModal(); await refresh(); toast(`${r.affected} کاربر حذف شد`); }
    else if (t.id === 'bulkApply') {
      const checked = s => [...document.querySelectorAll(s + ' input:checked')].map(x => x.value), loc = $('#bLoc').value;
      const body = {ids: bulkTargets(), add_protos: checked('#bAdd'), remove_protos: checked('#bRem'),
        node_ids: loc === 'all' ? [] : loc === 'pick' ? checked('#bNodes').map(Number) : null};
      if (!body.add_protos.length && !body.remove_protos.length && body.node_ids === null) return toast('چیزی برای اعمال انتخاب نشده');
      if (loc === 'pick' && !body.node_ids.length) return toast('حداقل یک لوکیشن را تیک بزنید');
      const r = await api('POST', '/users/bulk', body); closeModal(); await refresh(); toast(`روی ${r.affected} کاربر اعمال شد؛ ظرف ۳۰ ثانیه روی نودها می‌نشیند`);
    }
    else if (d.cfg) await configsDialog(+d.cfg);
    else if (d.edit) editDialog(S.users.find(x => x.id === +d.edit));
    else if (d.renew) {
      await api('PATCH', uPath(d.id), {extend_days: +d.renew, reset_usage: $('#eReset').checked, enabled: true});
      await refresh(); editDialog(S.users.find(x => x.id === +d.id)); toast(`${d.renew} روز تمدید شد`);
    }
    else if (d.resetusage) { await api('PATCH', uPath(d.resetusage), {reset_usage: true}); await refresh(); editDialog(S.users.find(x => x.id === +d.resetusage)); toast('مصرف صفر شد'); }
    else if (t.id === 'eSave') {
      const u = S.users.find(x => x.id === +d.id), checked = s => [...document.querySelectorAll(s + ' input:checked')].map(x => x.value);
      const body = isReseller() ? {} : {protos: checked('#eProtos'), node_ids: checked('#eNodes').map(Number)};
      const quota = +$('#eQuota').value || 0, days = +$('#eDays').value || 0;
      if (quota !== u.quota_gb) body.quota_gb = quota;            // send only what changed, so an untouched
      if (days !== (u.days_left ?? 0)) body.days = days;          // expiry is not reset by rounding
      await api('PATCH', uPath(u.id), body); closeModal(); await refresh(); toast('ذخیره شد');
    }
    else if (d.toggle) { const u = S.users.find(x => x.id === +d.toggle); await api('PATCH', uPath(u.id), {enabled: !u.enabled}); await refresh(); }
    else if (d.deluser) {
      const u = S.users.find(x => x.id === +d.deluser);
      openModal(`<h2>حذف <span class="mono">${esc(u.name)}</span>؟</h2><div class="note">حذف برگشت‌پذیر نیست و لینک اشتراک این کاربر از کار می‌افتد.</div>
        <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-close>انصراف</button><button class="btn pri" id="delUserGo" data-id="${u.id}" style="background:var(--bad)">حذف قطعی</button></div>`);
    }
    else if (t.id === 'delUserGo') { await api('DELETE', uPath(d.id)); closeModal(); await refresh(); toast('کاربر حذف شد'); }
    else if ('rtAddout' in d) outboundDialog();
    else if (t.id === 'oSave') {
      const v = id => ($('#' + id) || {}).value || '', k = $('#oKind').value;
      S.routing.data = await api('POST', `/nodes/${S.routing.nodeId}/outbounds`, {name: v('oName'), kind: k, link: v('oLink'), address: v('oAddr'),
        port: +v('oPort') || 0, username: v('oUser'), password: v('oPass'), endpoint: v('oEndpoint'), secret_key: v('oSecret'),
        public_key: v('oPub'), local_address: v('oLocal'), reserved: v('oReserved')});
      closeModal(); render(); toast('خروجی افزوده شد');
    }
    else if (d.rtDelout) { S.routing.data = await api('DELETE', '/outbounds/' + d.rtDelout); render(); toast('خروجی و قانون‌های وابسته حذف شد'); }
    else if ('rtAddrule' in d) ruleDialog();
    else if (t.id === 'ruleSave') {
      const lines = id => $('#' + id).value.split('\n').map(x => x.trim()).filter(Boolean);
      S.routing.data = await api('POST', `/nodes/${S.routing.nodeId}/rules`, {inbounds: [...document.querySelectorAll('#rIn input:checked')].map(x => x.value),
        ports: $('#rPorts').value.trim(), domains: lines('rDomains'), ips: lines('rIps'), outbound: $('#rOut').value, note: $('#rNote').value.trim()});
      closeModal(); render(); toast('قانون افزوده شد؛ ظرف ۳۰ ثانیه روی نود اعمال می‌شود');
    }
    else if (d.rtDelrule) { S.routing.data = await api('DELETE', '/rules/' + d.rtDelrule); render(); }
    else if (d.rtUp || d.rtDown) { S.routing.data = await api('PATCH', '/rules/' + (d.rtUp || d.rtDown), {move: d.rtUp ? 'up' : 'down'}); render(); }
    else if (d.copy) copy(d.copy);
    else if ('close' in d || t.id === 'modal') closeModal();
  } catch (err) { if (err.message !== 'login') toast(err.message); }
});
function draft() { return S.draft || (S.draft = {color: S.brand.color, logo: S.brand.logo}); }
function shrink(file) {   // -> data URI no bigger than ~200 px, so it stays small in the database
  return new Promise((ok, no) => {
    const fr = new FileReader();
    fr.onerror = () => no(new Error('فایل خوانده نشد'));
    fr.onload = () => {
      if (file.type === 'image/svg+xml') return fr.result.length < 200000 ? ok(fr.result) : no(new Error('SVG بزرگ است (حداکثر ۱۵۰ کیلوبایت)'));
      const img = new Image();
      img.onerror = () => no(new Error('تصویر معتبر نیست'));
      img.onload = () => {
        const k = Math.min(1, 200 / Math.max(img.width, img.height)), cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(img.width * k)); cv.height = Math.max(1, Math.round(img.height * k));
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); ok(cv.toDataURL('image/png'));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
document.addEventListener('input', e => {
  if (e.target.id === 'bColor') { draft().color = e.target.value; applyBrand({...S.brand, color: e.target.value}); return; } if (e.target.id === 'uq') { S.q = e.target.value; render(); } });
document.addEventListener('change', async e => {
  if (e.target.id === 'bFile' && e.target.files[0]) {
    try { const uri = await shrink(e.target.files[0]); draft().logo = uri; applyBrand({...S.brand, logo: uri}); $('#bPrev').innerHTML = logoMark(); $('#bClearLogo').disabled = false; }
    catch (err) { toast(err.message); }
    return;
  }
  if (e.target.id === 'uOnline') { S.onlineOnly = e.target.checked; render(); return; }
  if (e.target.id === 'uo') { S.owner = e.target.value; render(); return; }
  if (e.target.dataset.sel) { const id = +e.target.dataset.sel; e.target.checked ? S.sel.add(id) : S.sel.delete(id); render(); return; }
  if (e.target.id === 'selAll') {
    const q = S.q.trim().toLowerCase();
    S.users.filter(u => !q || u.name.toLowerCase().includes(q)).forEach(u => e.target.checked ? S.sel.add(u.id) : S.sel.delete(u.id)); render(); return;
  }
  if (e.target.id === 'portNode') { S.portNode = +e.target.value; render(); return; }
  if (e.target.id === 'routeNode') { S.routeNode = +e.target.value; S.routing = null; render(); return; }
  if (e.target.id === 'oKind') { const keep = $('#oName').value; outboundDialog(e.target.value); $('#oName').value = keep; return; }
  if (e.target.dataset.rtToggle) {
    try { S.routing.data = await api('PATCH', '/rules/' + e.target.dataset.rtToggle, {enabled: e.target.checked}); render(); toast(e.target.checked ? 'قانون روشن شد' : 'قانون خاموش شد'); }
    catch (err) { toast(err.message); }
    return;
  }
  if (e.target.dataset.npon) {
    try { await api('PATCH', '/node-protocols/' + e.target.dataset.npon, {enabled: e.target.checked}); await refresh(); } catch (err) { toast(err.message); }
    return;
  }
  const d = e.target.dataset; if (!d.proto) return;
  try {
    const r = await api('PUT', `/nodes/${d.node}/protocols/${d.proto}`, {enabled: e.target.checked}); await refresh();
    if (r.dns) toast(r.dns.ok ? 'رکوردهای DNS به‌روز شد' : 'DNS: ' + r.dns.error);
  }
  catch (err) { toast(err.message); }
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'pw') $('#doLogin').click(); });

(async () => { await loadBrand(); if (!token) return showLogin(); try { await refresh(); } catch (e) {} })();
setInterval(() => { const a = document.activeElement, typing = a && ['INPUT', 'SELECT', 'TEXTAREA'].includes(a.tagName) && a.id !== 'uq' && $('#view').contains(a);
  if (token && $('#modal').hidden && S.tab !== 'look' && !typing) refresh().catch(() => {}); }, 20000);
