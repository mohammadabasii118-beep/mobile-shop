const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const S = {tab: 'dash', nodes: [], users: [], protos: []};
const TITLES = {dash: 'داشبورد', nodes: 'لوکیشن‌ها', protos: 'پروتکل‌ها', users: 'کاربران'};
const STATUS = {active: ['good', 'فعال'], disabled: ['bad', 'غیرفعال'], expired: ['bad', 'منقضی'], quota: ['bad', 'حجم تمام شده']};

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
  openModal(`<h2>ورود مدیر</h2><label class="f">رمز<input type="password" id="pw" autocomplete="current-password" style="background:var(--surface2);border:1px solid var(--line);border-radius:8px;padding:6px 10px;width:100%"></label>
    <div style="text-align:left"><button class="btn pri" id="doLogin">ورود</button></div>`);
  $('#pw').focus();
}

async function refresh() {
  [S.nodes, S.users, S.protos] = await Promise.all([api('GET', '/nodes'), api('GET', '/users'), api('GET', '/protocols')]);
  render();
}

const views = {
  dash() {
    const on = S.nodes.filter(n => n.online).length, used = S.users.reduce((a, u) => a + u.used_gb, 0);
    return `<div class="stats">
      <div class="stat"><span class="muted">لوکیشن آنلاین</span><b>${on} / ${S.nodes.length}</b></div>
      <div class="stat"><span class="muted">کاربر فعال</span><b>${S.users.filter(u => u.status === 'active').length} / ${S.users.length}</b></div>
      <div class="stat"><span class="muted">مصرف کل</span><b>${fmtGB(used)} GB</b></div></div>
      <div class="panel"><h2>بار لوکیشن‌ها</h2><div class="links">${S.nodes.length ? S.nodes.map(n => `
        <div style="display:grid;grid-template-columns:140px 1fr 44px;gap:8px;align-items:center">
          <span><span class="cc">${esc(n.cc)}</span>${esc(n.name)}</span>
          <div class="bar"><i class="${loadCls(n.load)}" style="width:${n.online ? n.load : 0}%"></i></div>
          <span class="muted mono">${n.online ? n.load + '%' : '—'}</span></div>`).join('') :
        '<p class="muted">هنوز لوکیشنی اضافه نشده. از بخش «لوکیشن‌ها» اولین نود را اضافه کنید.</p>'}</div></div>`;
  },
  nodes() {
    return `<div class="panel scroll"><table><thead><tr><th>لوکیشن</th><th>آدرس</th><th>بار</th><th>آخرین گزارش</th><th>وضعیت</th><th></th></tr></thead><tbody>
      ${S.nodes.map(n => `<tr><td><span class="cc">${esc(n.cc)}</span>${esc(n.name)}</td><td class="mono">${esc(n.address)}</td>
        <td>${n.online ? n.load + '%' : '—'}</td><td>${n.last_seen ? new Date(n.last_seen).toLocaleString('fa-IR') : 'هنوز وصل نشده'}</td>
        <td><span class="pill ${n.online ? 'good' : 'warn'}">${n.online ? 'آنلاین' : 'آفلاین'}</span></td>
        <td><button class="btn sm" data-install="${n.id}">دستور نصب</button> <button class="btn sm" data-delnode="${n.id}">حذف</button></td></tr>`).join('')
        || '<tr><td colspan="6" class="muted">لوکیشنی وجود ندارد.</td></tr>'}</tbody></table></div>`;
  },
  protos() {
    return `<div class="note">هر پروتکل را روی هر لوکیشن جداگانه روشن یا خاموش کنید. ایجنت هر نود حداکثر ۳۰ ثانیه بعد تغییر را اعمال می‌کند.</div>
      <div class="panel scroll"><table class="matrix"><thead><tr><th>پروتکل</th>${S.nodes.map(n => `<th title="${esc(n.name)}">${esc(n.cc)}</th>`).join('')}</tr></thead><tbody>
      ${S.protos.map(p => `<tr><td><b>${esc(p.label)}</b><br><small class="muted">${esc(p.engine)} · ${esc(p.desc)}</small></td>
        ${S.nodes.map(n => { const np = n.protocols.find(x => x.proto === p.id);
          return `<td><input type="checkbox" data-node="${n.id}" data-proto="${p.id}" aria-label="${esc(p.label)} در ${esc(n.cc)}" ${np && np.enabled ? 'checked' : ''}></td>`; }).join('')}</tr>`).join('')}
      </tbody></table></div>`;
  },
  users() {
    return `<div class="panel scroll"><table><thead><tr><th>کاربر</th><th>مصرف</th><th>انقضا</th><th>پروتکل‌ها</th><th>وضعیت</th><th></th></tr></thead><tbody>
      ${S.users.map(u => { const pc = u.quota_gb ? Math.min(100, u.used_gb / u.quota_gb * 100) : 0; const st = STATUS[u.status];
        return `<tr><td class="mono">${esc(u.name)}</td>
        <td><div style="display:flex;gap:8px;align-items:center"><div class="bar"><i class="${loadCls(pc)}" style="width:${pc}%"></i></div><span class="muted">${fmtGB(u.used_gb)}/${u.quota_gb ? fmtGB(u.quota_gb) : '∞'} GB</span></div></td>
        <td>${u.days_left === null ? 'نامحدود' : u.days_left + ' روز'}</td><td>${u.protos.map(p => `<span class="cc">${esc(protoLabel(p))}</span>`).join('')}</td>
        <td><span class="pill ${st[0]}">${st[1]}</span></td>
        <td><button class="btn sm" data-cfg="${u.id}">کانفیگ‌ها</button> <button class="btn sm" data-toggle="${u.id}">${u.enabled ? 'غیرفعال' : 'فعال'}</button> <button class="btn sm" data-deluser="${u.id}">حذف</button></td></tr>`; }).join('')
        || '<tr><td colspan="6" class="muted">کاربری وجود ندارد.</td></tr>'}</tbody></table></div>`;
  },
};

function render() {
  $('#title').textContent = TITLES[S.tab];
  $('#actions').innerHTML = S.tab === 'users' ? '<button class="btn pri" id="addUser">+ کاربر جدید</button>'
    : S.tab === 'nodes' ? '<button class="btn pri" id="addNode">+ لوکیشن جدید</button>' : '';
  $('#view').innerHTML = `<div style="display:flex;flex-direction:column;gap:12px">${views[S.tab]()}</div>`;
  $('#nNodes').textContent = S.nodes.length; $('#nUsers').textContent = S.users.length;
  document.querySelectorAll('nav [data-tab]').forEach(b => b.setAttribute('aria-current', b.dataset.tab === S.tab));
}

function nodeForm() {
  openModal(`<h2>لوکیشن جدید</h2><div class="form">
    <label class="f">نام<input type="text" id="nName" placeholder="آلمان - فرانکفورت"></label>
    <label class="f">کد کشور<input type="text" id="nCc" maxlength="2" placeholder="DE"></label>
    <label class="f">آدرس سرور (دامنه یا آی‌پی)<input type="text" id="nAddr" placeholder="de.example.com"></label></div>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-close>انصراف</button><button class="btn pri" id="nSave">ساخت و گرفتن دستور نصب</button></div>`);
}
function installDialog(n) {
  openModal(`<h2>نصب نود ${esc(n.name)}</h2>
    <p class="muted" style="margin:0">روی سرور تازه (اوبونتو ۲۲.۰۴ یا ۲۴.۰۴، دسترسی root) این دستور را اجرا کنید:</p>
    <pre>${esc(n.install_command)}</pre>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-copy="${esc(n.install_command)}">کپی دستور</button><button class="btn pri" data-close>بستن</button></div>`);
}
function userForm() {
  openModal(`<h2>کاربر جدید</h2><div class="form">
    <label class="f">نام کاربری<input type="text" id="fName" placeholder="ali_t"></label>
    <label class="f">حجم (GB، صفر = نامحدود)<input type="number" id="fQuota" value="50" min="0"></label>
    <label class="f">مدت (روز، صفر = نامحدود)<input type="number" id="fDays" value="30" min="0"></label></div>
    <div><div class="muted" style="margin-bottom:6px">لوکیشن‌ها (هیچ‌کدام = همه)</div><div class="chips" id="fNodes">
      ${S.nodes.map(n => `<label><input type="checkbox" value="${n.id}">${esc(n.cc)} ${esc(n.name)}</label>`).join('')}</div></div>
    <div><div class="muted" style="margin-bottom:6px">پروتکل‌ها</div><div class="chips" id="fProtos">
      ${S.protos.map(p => `<label><input type="checkbox" value="${p.id}" ${['vless', 'l2tp'].includes(p.id) ? 'checked' : ''}>${esc(p.label)}</label>`).join('')}</div></div>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-close>انصراف</button><button class="btn pri" id="fSave">ساخت کاربر</button></div>`);
}
async function configsDialog(id) {
  const u = S.users.find(x => x.id === id), rows = await api('GET', `/users/${id}/configs`);
  openModal(`<h2>کانفیگ‌های <span class="mono">${esc(u.name)}</span></h2>
    <div class="link"><span style="min-width:90px">لینک اشتراک</span><code>${esc(u.sub_url)}</code><button class="btn sm" data-copy="${esc(u.sub_url)}">کپی</button></div>
    <div class="links">${rows.length ? rows.map(r => r.link
      ? `<div class="link"><span class="cc">${esc(r.cc)}</span><span style="min-width:110px">${esc(r.label)}</span><code>${esc(r.link)}</code><button class="btn sm" data-copy="${esc(r.link)}">کپی</button></div>`
      : `<div class="link"><span class="cc">${esc(r.cc)}</span><span style="min-width:110px">${esc(r.label)}</span><code>${esc(`${r.details.server} | ${r.details.username} | ${r.details.password} | PSK: ${r.details.psk}`)}</code>
         <button class="btn sm" data-copy="${esc(`Server: ${r.details.server}\nUsername: ${r.details.username}\nPassword: ${r.details.password}\nPSK: ${r.details.psk}`)}">کپی</button></div>`).join('')
      : '<p class="muted">هنوز کانفیگی نیست. نود باید آنلاین باشد و پروتکل مورد نظر روی آن روشن باشد (برای VLESS اولین گزارش نود لازم است).</p>'}</div>
    <div style="text-align:left"><button class="btn" data-close>بستن</button></div>`);
}

document.addEventListener('click', async e => {
  const t = e.target, d = t.dataset;
  try {
    if (d.tab) { S.tab = d.tab; render(); }
    else if (t.id === 'themeBtn') { const r = document.documentElement; r.dataset.theme = getComputedStyle(r).colorScheme.includes('dark') ? 'light' : 'dark'; }
    else if (t.id === 'logoutBtn') { token = ''; try { localStorage.removeItem('tok'); } catch (_) {} showLogin(); }
    else if (t.id === 'doLogin') {
      const r = await api('POST', '/login', {password: $('#pw').value}); token = r.token;
      try { localStorage.setItem('tok', token); } catch (_) {}
      closeModal(); await refresh();
    }
    else if (t.id === 'addNode') nodeForm();
    else if (t.id === 'nSave') {
      const n = await api('POST', '/nodes', {name: $('#nName').value.trim(), cc: $('#nCc').value.trim(), address: $('#nAddr').value.trim()});
      await refresh(); installDialog(n);
    }
    else if (d.install) installDialog(nodeBy(+d.install));
    else if (d.delnode) { await api('DELETE', '/nodes/' + d.delnode); closeModal(); await refresh(); toast('لوکیشن حذف شد'); }
    else if (t.id === 'addUser') userForm();
    else if (t.id === 'fSave') {
      const checked = s => [...document.querySelectorAll(s + ' input:checked')].map(x => x.value);
      const u = await api('POST', '/users', {name: $('#fName').value.trim(), quota_gb: +$('#fQuota').value || 0, days: +$('#fDays').value || 0,
        protos: checked('#fProtos'), node_ids: checked('#fNodes').map(Number)});
      await refresh(); configsDialog(u.id);
    }
    else if (d.cfg) await configsDialog(+d.cfg);
    else if (d.toggle) { const u = S.users.find(x => x.id === +d.toggle); await api('PATCH', '/users/' + u.id, {enabled: !u.enabled}); await refresh(); }
    else if (d.deluser) { await api('DELETE', '/users/' + d.deluser); await refresh(); toast('کاربر حذف شد'); }
    else if (d.copy) copy(d.copy);
    else if ('close' in d || t.id === 'modal') closeModal();
  } catch (err) { if (err.message !== 'login') toast(err.message); }
});
document.addEventListener('change', async e => {
  const d = e.target.dataset; if (!d.proto) return;
  try { await api('PUT', `/nodes/${d.node}/protocols/${d.proto}`, {enabled: e.target.checked}); await refresh(); }
  catch (err) { toast(err.message); }
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'pw') $('#doLogin').click(); });

(async () => { if (!token) return showLogin(); try { await refresh(); } catch (e) {} })();
setInterval(() => { if (token && $('#modal').hidden) refresh().catch(() => {}); }, 20000);
