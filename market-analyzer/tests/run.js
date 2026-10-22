// Run: node tests/run.js
const assert = require('assert');
const path = require('path');
for (const f of ['indicators', 'structure', 'analysis', 'backtest', 'data']) require(path.join(__dirname, '..', 'js', f + '.js'));
const MA = globalThis.MA;
const { ind, st } = MA;
let passed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log('  ok  ' + name); } catch (e) { console.error('FAIL  ' + name + '\n      ' + e.message); process.exitCode = 1; } };
const near = (a, b, eps = 0.05) => assert.ok(Math.abs(a - b) <= eps, `${a} !≈ ${b}`);

// Reference series from the classic Wilder / StockCharts RSI worksheet.
const closes = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41, 46.22, 45.64];

test('SMA', () => { const s = ind.sma([1, 2, 3, 4, 5], 3); assert.ok(isNaN(s[1])); assert.deepStrictEqual(s.slice(2), [2, 3, 4]); });
test('EMA seeds with SMA', () => { const e = ind.ema([1, 2, 3, 4, 5], 3); near(e[2], 2); near(e[3], 3); near(e[4], 4); });
test('RSI matches Wilder reference', () => { const r = ind.rsi(closes, 14); near(r[14], 70.53, 0.1); near(r[15], 66.32, 0.1); });
test('RSI bounds', () => { ind.rsi(MA.data.demo('x', 3600), 14).filter((x) => !isNaN(x)).forEach((x) => assert.ok(x >= 0 && x <= 100)); });
test('Bollinger bands symmetric', () => { const b = ind.bollinger(closes, 5); near(b.up[10] - b.mid[10], b.mid[10] - b.low[10], 1e-9); });
test('ATR positive, MACD hist = line - signal', () => {
  const cs = MA.data.demo('atr', 3600), h = cs.map((k) => k.h), l = cs.map((k) => k.l), c = cs.map((k) => k.c);
  ind.atr(h, l, c).filter((x) => !isNaN(x)).forEach((x) => assert.ok(x > 0));
  const m = ind.macd(c); near(m.hist[300], m.line[300] - m.signal[300], 1e-9);
});
test('ADX in 0..100, DI defined', () => {
  const cs = MA.data.demo('adx', 3600), a = ind.adx(cs.map((k) => k.h), cs.map((k) => k.l), cs.map((k) => k.c));
  a.adx.filter((x) => !isNaN(x)).forEach((x) => assert.ok(x >= 0 && x <= 100));
  assert.ok(!isNaN(a.pdi[100]) && !isNaN(a.mdi[100]));
});
test('Supertrend direction flips on strong trend reversal', () => {
  const up = Array.from({ length: 60 }, (_, i) => 100 + i), dn = Array.from({ length: 60 }, (_, i) => 160 - i * 1.5), c = up.concat(dn);
  const s = ind.supertrend(c.map((x) => x + 1), c.map((x) => x - 1), c);
  assert.strictEqual(s.dir[50], 1); assert.strictEqual(s.dir[119], -1);
});
test('Pivots are confirmed n bars later', () => {
  const h = [1, 2, 3, 9, 3, 2, 1, 2, 3, 2, 1], l = h.map((x) => x - 0.5), p = st.pivots(h, l, 2);
  const top = p.find((x) => x.type === 'H');
  assert.strictEqual(top.i, 3); assert.strictEqual(top.confirm, 5);
});
test('Candlestick: bullish engulfing in downtrend', () => {
  const cs = []; let p = 100;
  for (let i = 0; i < 10; i++) { cs.push({ t: i, o: p, h: p + 0.3, l: p - 1.3, c: p - 1, v: 1 }); p -= 1; }
  cs.push({ t: 10, o: p - 0.1, h: p + 3, l: p - 0.3, c: p + 2.6, v: 1 });
  const atr = cs.map(() => 1);
  assert.ok(st.detectPatterns(cs, atr, cs.length - 1).some((x) => x.en === 'Bullish Engulfing'));
});
test('FVG detected and removed once filled', () => {
  const mk = (o, h, l, c) => ({ t: 0, o, h, l, c, v: 1 });
  const cs = [mk(10, 11, 9, 10.5), mk(10.5, 12, 10.4, 11.8), mk(11.8, 14, 11.7, 13.9), mk(13.9, 14.5, 13.5, 14)];
  assert.strictEqual(st.fairValueGaps(cs, 3, 1).length, 2); // gaps at bars 0-2 and 1-3
  cs.push(mk(14, 14, 10.5, 10.8));
  assert.strictEqual(st.fairValueGaps(cs, 4, 1).length, 0);
});

const cs = MA.data.demo('BTC1h', 3600, 900);
const ctx = MA.analysis.buildContext(cs);

test('Evaluate returns coherent result', () => {
  const r = MA.analysis.evaluate(ctx, cs.length - 1);
  assert.ok(r.score >= -100 && r.score <= 100); assert.ok(r.confidence >= 0 && r.confidence <= 100);
  assert.ok(r.factors.length >= 8);
  if (r.plan) {
    const p = r.plan; assert.ok(p.dir * (p.targets[0].price - p.entry) > 0); assert.ok(p.dir * (p.entry - p.stop) > 0);
    near(Math.abs(p.targets[1].price - p.entry) / p.risk, 2.5, 1e-9);
  }
});
test('NO LOOK-AHEAD: analysis at bar k is identical with or without future bars', () => {
  for (const k of [250, 400, 555, 700, 850]) {
    const a = MA.analysis.evaluate(ctx, k), b = MA.analysis.evaluate(MA.analysis.buildContext(cs.slice(0, k + 1)), k);
    near(a.score, b.score, 1e-9); assert.strictEqual(a.verdict, b.verdict);
    if (a.plan) near(a.plan.stop, b.plan.stop, 1e-9);
  }
});
test('Backtest: entries use next-bar open, stats consistent', () => {
  const bt = MA.backtest(cs, { threshold: 30 });
  const s = bt.stats;
  assert.ok(s.n > 0, 'expected at least one trade');
  near(s.totalR, bt.trades.reduce((a, t) => a + t.r, 0), 1e-9);
  assert.ok(s.maxDD >= 0 && s.winRate >= 0 && s.winRate <= 1);
  for (const t of bt.trades) assert.ok(t.r <= 2.5 + 1e-9 && t.r >= -1.5, 'R outside [-1-fees, rr]: ' + t.r);
});
test('CSV parser', () => {
  const rows = ['date,open,high,low,close,volume'];
  for (let i = 0; i < 70; i++) rows.push(`2024-01-${String(1 + (i % 28)).padStart(2, '0')}T${String(i % 24).padStart(2, '0')}:00:00,${1 + i},${2 + i},${i},${1.5 + i},10`);
  assert.ok(MA.data.parseCSV(rows.join('\n')).length > 60);
});
test('4h resample aggregates OHLCV', () => {
  const base = Array.from({ length: 8 }, (_, i) => ({ t: i * 3600, o: i, h: i + 2, l: i - 1, c: i + 1, v: 1 }));
  const r = MA.data.resample(base, 14400);
  assert.strictEqual(r.length, 2); assert.strictEqual(r[0].h, 5); assert.strictEqual(r[0].l, -1); assert.strictEqual(r[0].v, 4);
});

console.log(`\n${passed} passed${process.exitCode ? ' (with failures)' : ''}`);
