/**
 * Web demo: a Telegram-like chat simulator running the REAL bot logic against a fake 3x-ui panel.
 * Run: npm run demo   → http://localhost:8080   (admin chat id = ADMIN_TELEGRAM_ID, default 9000)
 */
import http from 'node:http';
import { createEngine } from './engine';

const PORT = Number(process.env.DEMO_PORT ?? 8080);
const ADMIN = Number(process.env.ADMIN_TELEGRAM_ID ?? 9000);

const HTML = `<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>VPN Bot Demo</title>
<style>
:root{--bg:#0e1621;--panel:#17212b;--me:#2b5278;--bot:#182533;--fg:#e8eef4;--mut:#7f91a4;--btn:#2b3a4a}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px system-ui,Tahoma;display:flex;height:100vh}
.col{display:flex;flex-direction:column;flex:1;min-width:0;border-inline-start:1px solid #0b121a}
h3{margin:0;padding:10px 14px;background:var(--panel);font-size:14px}
.msgs{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:8px}
.m{max-width:85%;padding:8px 10px;border-radius:10px;background:var(--bot);white-space:pre-wrap;word-break:break-word;align-self:flex-start;font-size:14px}
.m.me{background:var(--me);align-self:flex-end}.m img{max-width:200px;display:block;margin-top:6px;background:#fff;padding:6px;border-radius:6px}
.kb{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}.kb button{flex:1 1 auto;background:var(--btn);color:var(--fg);border:0;padding:6px 10px;border-radius:6px;cursor:pointer;font:inherit;font-size:13px}
.bar{display:flex;gap:6px;padding:8px;background:var(--panel)}.bar input{flex:1;background:#0e1621;color:var(--fg);border:1px solid #2b3a4a;border-radius:6px;padding:8px;font:inherit}
.bar button,.tools button{background:#3a76b0;color:#fff;border:0;border-radius:6px;padding:8px 12px;cursor:pointer;font:inherit}
.side{width:310px;flex:none;padding:10px;overflow:auto;background:#101a24}.side pre{white-space:pre-wrap;font-size:11px;color:var(--mut)}
.tools{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.tools input{width:100px;background:#0e1621;color:var(--fg);border:1px solid #2b3a4a;border-radius:6px;padding:6px}
@media(max-width:900px){body{flex-direction:column;height:auto}.col{height:60vh}.side{width:auto}}
</style>
<div class="col"><h3>👤 کاربر (chat 111)</h3><div class="msgs" id="u"></div>
<div class="bar"><input id="ui" placeholder="پیام… (مثلاً /start)"><button onclick="send(111,'ui')">ارسال</button><button onclick="photo(111)">📎 رسید</button></div></div>
<div class="col"><h3>🛠 ادمین (chat ${ADMIN})</h3><div class="msgs" id="a"></div>
<div class="bar"><input id="ai" placeholder="/admin"><button onclick="send(${ADMIN},'ai')">ارسال</button></div></div>
<div class="side"><h3>🏦 شبیه‌ساز بانک (لجر)</h3><div class="tools"><input id="amt" value="250000" title="مبلغ تومان"><input id="trk" value="556677889" title="کد پیگیری"><button onclick="deposit()">واریز واقعی</button></div>
<small style="color:var(--mut)">واریز را قبل یا بعد از ارسال رسید بزنید؛ اگر با سفارش بخواند، تأیید خودکار انجام می‌شود.</small>
<h3 style="margin-top:12px">🛰 پنل X-UI (جعلی)</h3><pre id="panel"></pre></div>
<script>
const ADMIN=${ADMIN};const seen={111:0,[ADMIN]:0};
const el={111:document.getElementById('u'),[ADMIN]:document.getElementById('a')};
async function post(u,b){return (await fetch(u,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)})).json()}
function bubble(chat,m,me){const d=document.createElement('div');d.className='m'+(me?' me':'');d.textContent=m.text||'';
 if(m.image){const i=document.createElement('img');i.src=m.image;d.appendChild(i)}
 if(m.buttons&&m.buttons.length){const k=document.createElement('div');k.className='kb';m.buttons.flat().forEach(b=>{const x=document.createElement('button');x.textContent=b.text;x.onclick=()=>tap(chat,b.data);k.appendChild(x)});d.appendChild(k)}
 el[chat].appendChild(d);el[chat].scrollTop=1e9}
async function send(chat,id){const i=document.getElementById(id);const t=i.value.trim();if(!t)return;i.value='';bubble(chat,{text:t},true);await post('/send',{chat,text:t});poll()}
async function tap(chat,data){await post('/tap',{chat,data});poll()}
async function photo(chat){bubble(chat,{text:'📎 [تصویر رسید]'},true);await post('/photo',{chat,caption:document.getElementById('ui').value||undefined});document.getElementById('ui').value='';poll()}
async function deposit(){await post('/bank',{amount:+amt.value,tracking:trk.value});poll()}
async function poll(){const r=await (await fetch('/state?from='+JSON.stringify(seen))).json();
 for(const m of r.messages){bubble(m.chat,m);seen[m.chat]=Math.max(seen[m.chat]||0,m.id)}
 document.getElementById('panel').textContent=JSON.stringify(r.panel,null,1)}
setInterval(poll,1500);poll();
document.getElementById('ui').addEventListener('keydown',e=>e.key==='Enter'&&send(111,'ui'));
document.getElementById('ai').addEventListener('keydown',e=>e.key==='Enter'&&send(${ADMIN},'ai'));
</script></html>`;

async function main() {
  const e = await createEngine({ editInPlace: false });
  const body = async (req: http.IncomingMessage) => { const c: Buffer[] = []; for await (const x of req) c.push(x as Buffer); return JSON.parse(Buffer.concat(c).toString() || '{}'); };
  const name = (chat: number) => (chat === ADMIN ? 'Admin' : 'Demo User');
  http.createServer(async (req, res) => {
    const json = (o: unknown) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    try {
      const u = new URL(req.url!, 'http://x');
      if (u.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return void res.end(HTML); }
      if (u.pathname === '/state') {
        const seen = JSON.parse(u.searchParams.get('from') ?? '{}') as Record<string, number>;
        const messages = e.log.filter((m) => m.id > (seen[m.chat] ?? 0) && (m.chat === 111 || m.chat === ADMIN));
        const out = [];
        for (const m of messages) {
          const cfg = m.text?.match(/vless:\/\/\S+/)?.[0];
          out.push(m.image ? m : { ...m, image: undefined, qr: cfg });
        }
        const panel = [...e.panel.inbounds.values()].flatMap((i) => (i.settings.clients as any[]).map((c) => ({ inbound: i.id, email: c.email, totalGB: Math.round(c.totalGB / 1024 ** 3), expiry: new Date(c.expiryTime).toISOString().slice(0, 10), enable: c.enable })));
        return json({ messages: out, panel });
      }
      const b = await body(req);
      if (u.pathname === '/send') await e.text(b.chat, name(b.chat), b.text);
      else if (u.pathname === '/tap') await e.tap(b.chat, name(b.chat), b.data);
      else if (u.pathname === '/photo') await e.photo(b.chat, name(b.chat), b.caption);
      else if (u.pathname === '/bank') await e.bankDeposit(b.amount, b.tracking);
      json({ ok: true });
    } catch (err: any) { res.writeHead(500); res.end(String(err?.message)); }
  }).listen(PORT, () => console.log(`Demo running: http://localhost:${PORT}   (user chat=111, admin chat=${ADMIN})`));
}
main();
