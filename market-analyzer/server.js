#!/usr/bin/env node
/* Zero-dependency local server: serves the app and proxies Yahoo Finance chart data
   (Yahoo sends no CORS headers, so browsers cannot call it directly).
   Usage:  node server.js [port]      →  http://localhost:8787 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = +process.argv[2] || +process.env.PORT || 8787;
const ROOT = __dirname;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml' };
const cache = new Map(); // url -> {t, body}

function yahoo(query, res) {
  const symbol = query.get('symbol'), interval = query.get('interval'), range = query.get('range');
  if (!/^[A-Za-z0-9=^.\-]{1,20}$/.test(symbol || '') || !/^[0-9a-z]{1,4}$/.test(interval || '') || !/^[0-9a-z]{1,5}$/.test(range || '')) {
    res.writeHead(400); return res.end('{"chart":{"error":{"description":"bad params"}}}');
  }
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=false`;
  const hit = cache.get(url);
  const send = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(body); };
  if (hit && Date.now() - hit.t < 30000) return send(200, hit.body);
  https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (market-analyzer)' } }, (r) => {
    let b = '';
    r.on('data', (d) => (b += d));
    r.on('end', () => { if (r.statusCode === 200) cache.set(url, { t: Date.now(), body: b }); send(r.statusCode, b); });
  }).on('error', (e) => send(502, JSON.stringify({ chart: { error: { description: e.message } } })));
}

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname === '/api/yahoo') return yahoo(u.searchParams, res);
  const rel = path.normalize(decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname)).replace(/^([/\\]\.\.)+/, '');
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || /node_modules|\.git|server\.js|tests/.test(rel)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => console.log(`Market Analyzer → http://localhost:${PORT}`));
