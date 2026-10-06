// تست دودی روی سرور در حال اجرا:  npm run smoke   (یا: BASE=https://example.com npm run smoke)
const BASE = process.env.BASE || 'http://localhost:3000';
const pages = ['/', '/shop', '/cart', '/checkout', '/wishlist', '/search?q=قاب', '/account/login', '/admin/login', '/sitemap.xml', '/robots.txt'];
let bad = 0;
for (const p of pages) {
  const r = await fetch(BASE + p, { redirect: 'manual' });
  const ok = r.status === 200;
  if (!ok) bad++;
  console.log(`${ok ? '✓' : '✗'} ${r.status} ${p}`);
}
const r = await fetch(BASE + '/admin', { redirect: 'manual' });
const guarded = r.status === 307 || r.status === 302;
if (!guarded) bad++;
console.log(`${guarded ? '✓' : '✗'} /admin بدون ورود ریدایرکت می‌شود (${r.status})`);
const up = await fetch(BASE + '/api/upload', { method: 'POST' });
if (up.status !== 401) bad++;
console.log(`${up.status === 401 ? '✓' : '✗'} آپلود بدون ورود رد می‌شود (${up.status})`);
console.log(bad ? `\n${bad} مورد مشکل دارد` : '\nهمه‌چیز سالم است');
process.exit(bad ? 1 : 0);
