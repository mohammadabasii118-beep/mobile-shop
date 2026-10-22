/* Price-structure analysis: pivots, support/resistance, market structure, Fibonacci,
   divergence, candlestick patterns, Smart-Money concepts (FVG / order blocks / liquidity sweeps),
   volume profile. Every function that takes an index `i` only reads data <= i (no look-ahead). */
(function (root) {
  const MA = (root.MA = root.MA || {});

  // Swing pivots. A pivot at bar i is only *known* at bar i+n (its `confirm` index).
  function pivots(h, l, n) {
    const out = [];
    for (let i = n; i < h.length - n; i++) {
      let isH = true, isL = true;
      for (let j = 1; j <= n; j++) {
        if (!(h[i] >= h[i - j] && h[i] > h[i + j])) isH = false;
        if (!(l[i] <= l[i - j] && l[i] < l[i + j])) isL = false;
        if (!isH && !isL) break;
      }
      if (isH) out.push({ i, confirm: i + n, price: h[i], type: 'H' });
      if (isL) out.push({ i, confirm: i + n, price: l[i], type: 'L' });
    }
    return out;
  }
  const known = (pivs, i) => pivs.filter((p) => p.confirm <= i);

  function supportResistance(pivs, i, price, atrV, maxAge = 400) {
    const ps = known(pivs, i).filter((p) => i - p.i <= maxAge);
    const tol = Math.max(0.6 * atrV, price * 0.0008);
    const sorted = ps.slice().sort((a, b) => a.price - b.price);
    const clusters = [];
    for (const p of sorted) {
      const c = clusters[clusters.length - 1];
      if (c && p.price - c.sum / c.n <= tol) { c.sum += p.price; c.n++; c.last = Math.max(c.last, p.i); c.items.push(p); }
      else clusters.push({ sum: p.price, n: 1, last: p.i, items: [p] });
    }
    return clusters
      .map((c) => {
        const recency = Math.exp(-(i - c.last) / 150);
        return { price: c.sum / c.n, touches: c.n, strength: c.n + 2 * recency, last: c.last };
      })
      .filter((l) => l.touches >= 2 || i - l.last < 60)
      .map((l) => ({ ...l, type: l.price < price ? 'S' : 'R' }))
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 12)
      .sort((a, b) => a.price - b.price);
  }

  function marketStructure(pivs, i, closes) {
    const k = known(pivs, i);
    const highs = k.filter((p) => p.type === 'H'), lows = k.filter((p) => p.type === 'L');
    if (highs.length < 2 || lows.length < 2) return { trend: 'unknown', bos: null };
    const [h2, h1] = [highs[highs.length - 2], highs[highs.length - 1]];
    const [l2, l1] = [lows[lows.length - 2], lows[lows.length - 1]];
    const hh = h1.price > h2.price, hl = l1.price > l2.price;
    const trend = hh && hl ? 'up' : !hh && !hl ? 'down' : 'range';
    let bos = null;
    if (closes[i] > h1.price) bos = trend === 'down' ? 'bull-choch' : 'bull-bos';
    else if (closes[i] < l1.price) bos = trend === 'up' ? 'bear-choch' : 'bear-bos';
    return { trend, bos, lastHigh: h1, lastLow: l1, prevHigh: h2, prevLow: l2, hh, hl };
  }

  const FIB = [0.236, 0.382, 0.5, 0.618, 0.786];
  function fibonacci(pivs, i, price) {
    const k = known(pivs, i);
    if (k.length < 2) return null;
    const last = k[k.length - 1];
    let start = null;
    for (let j = k.length - 2; j >= 0; j--) if (k[j].type !== last.type) { start = k[j]; break; }
    if (!start) return null;
    const up = last.type === 'H';
    const end = last, span = Math.abs(end.price - start.price);
    if (!span) return null;
    const lv = (r) => (up ? end.price - r * span : end.price + r * span);
    return {
      dir: up ? 'up' : 'down', start, end,
      levels: FIB.map((r) => ({ r, price: lv(r) })),
      ext: [1.272, 1.618].map((r) => ({ r, price: up ? start.price + r * span : start.price - r * span })),
      retrace: up ? (end.price - price) / span : (price - end.price) / span,
    };
  }

  function divergence(pivsDiv, i, c, rsiArr, maxAge = 40) {
    const k = known(pivsDiv, i);
    const res = { type: null };
    for (const t of ['H', 'L']) {
      const ps = k.filter((p) => p.type === t);
      if (ps.length < 2) continue;
      const b = ps[ps.length - 1], a = ps[ps.length - 2];
      if (i - b.i > maxAge || b.i - a.i < 5 || isNaN(rsiArr[a.i]) || isNaN(rsiArr[b.i])) continue;
      if (res.type) continue;
      // bearish: higher high in price, lower high in RSI. bullish: lower low in price, higher low in RSI.
      const bearish = t === 'H' && b.price > a.price && rsiArr[b.i] < rsiArr[a.i] - 2;
      const bullish = t === 'L' && b.price < a.price && rsiArr[b.i] > rsiArr[a.i] + 2;
      if (bearish || bullish) { res.type = bullish ? 'bull' : 'bear'; res.a = a; res.b = b; }
    }
    return res;
  }

  function detectPatterns(cs, atrArr, i) {
    const out = [];
    if (i < 6) return out;
    const k = cs[i], p = cs[i - 1], pp = cs[i - 2];
    const a = atrArr[i];
    if (isNaN(a)) return out;
    const body = (x) => Math.abs(x.c - x.o), range = (x) => x.h - x.l;
    const up = (x) => Math.min(x.o, x.c), hi = (x) => Math.max(x.o, x.c);
    const bull = (x) => x.c > x.o, bear = (x) => x.c < x.o;
    const upper = (x) => x.h - hi(x), lower = (x) => up(x) - x.l;
    const mv = (cs[i - 1].c - cs[i - 5].c) / a;
    const downT = mv < -1, upT = mv > 1;
    const add = (fa, en, dir, strength) => out.push({ fa, en, dir, strength, i });

    const r = range(k), b = body(k);
    if (r > 0.3 * a) {
      if (b <= 0.1 * r) add('دوجی', 'Doji', 0, 0.2);
      if (lower(k) >= 2 * b && upper(k) <= 0.25 * r && b >= 0.05 * r) {
        if (downT) add('چکش', 'Hammer', 1, 0.6); else if (upT) add('مرد آویزان', 'Hanging Man', -1, 0.4);
      }
      if (upper(k) >= 2 * b && lower(k) <= 0.25 * r && b >= 0.05 * r) {
        if (upT) add('ستاره دنباله‌دار', 'Shooting Star', -1, 0.6); else if (downT) add('چکش معکوس', 'Inverted Hammer', 1, 0.4);
      }
      if (b >= 0.9 * r && r >= 1.2 * a) add(bull(k) ? 'ماروبوزو صعودی' : 'ماروبوزو نزولی', 'Marubozu', bull(k) ? 1 : -1, 0.4);
    }
    if (bear(p) && bull(k) && k.o <= p.c && k.c >= p.o && b > body(p)) add('انگالفینگ صعودی', 'Bullish Engulfing', 1, downT ? 0.75 : 0.4);
    if (bull(p) && bear(k) && k.o >= p.c && k.c <= p.o && b > body(p)) add('انگالفینگ نزولی', 'Bearish Engulfing', -1, upT ? 0.75 : 0.4);
    if (bear(p) && bull(k) && body(p) > 0.8 * a && k.o < p.c && k.c > (p.o + p.c) / 2 && k.c < p.o) add('خط نافذ', 'Piercing Line', 1, downT ? 0.6 : 0.3);
    if (bull(p) && bear(k) && body(p) > 0.8 * a && k.o > p.c && k.c < (p.o + p.c) / 2 && k.c > p.o) add('پوشش ابر تیره', 'Dark Cloud Cover', -1, upT ? 0.6 : 0.3);
    if (body(p) > 0 && b < body(p) * 0.6 && hi(k) <= hi(p) && up(k) >= up(p) && body(p) > 0.8 * a) {
      if (bear(p) && bull(k)) add('هارامی صعودی', 'Bullish Harami', 1, 0.35);
      if (bull(p) && bear(k)) add('هارامی نزولی', 'Bearish Harami', -1, 0.35);
    }
    if (bear(pp) && body(pp) > 0.8 * a && body(p) < 0.3 * body(pp) && bull(k) && k.c > (pp.o + pp.c) / 2) add('ستاره صبحگاهی', 'Morning Star', 1, 0.85);
    if (bull(pp) && body(pp) > 0.8 * a && body(p) < 0.3 * body(pp) && bear(k) && k.c < (pp.o + pp.c) / 2) add('ستاره شامگاهی', 'Evening Star', -1, 0.85);
    if (bull(k) && bull(p) && bull(pp) && k.c > p.c && p.c > pp.c && k.o > p.o && k.o < p.c && p.o > pp.o && p.o < pp.c && body(k) > 0.5 * a) add('سه سرباز سفید', 'Three White Soldiers', 1, 0.8);
    if (bear(k) && bear(p) && bear(pp) && k.c < p.c && p.c < pp.c && k.o < p.o && k.o > p.c && p.o < pp.o && p.o > pp.c && body(k) > 0.5 * a) add('سه کلاغ سیاه', 'Three Black Crows', -1, 0.8);
    if (Math.abs(k.l - p.l) <= 0.1 * a && bear(p) && bull(k) && downT) add('تویزر کف', 'Tweezer Bottom', 1, 0.45);
    if (Math.abs(k.h - p.h) <= 0.1 * a && bull(p) && bear(k) && upT) add('تویزر سقف', 'Tweezer Top', -1, 0.45);
    return out;
  }

  function fairValueGaps(cs, i, atrV, lookback = 80) {
    const zones = [];
    for (let j = Math.max(2, i - lookback); j <= i; j++) {
      const minGap = 0.1 * atrV;
      if (cs[j].l - cs[j - 2].h > minGap) zones.push({ dir: 1, lo: cs[j - 2].h, hi: cs[j].l, i: j - 1 });
      else if (cs[j - 2].l - cs[j].h > minGap) zones.push({ dir: -1, lo: cs[j].h, hi: cs[j - 2].l, i: j - 1 });
    }
    // Shrink / remove zones as price trades back into them.
    const live = [];
    for (const z of zones) {
      let { lo, hi } = z, dead = false;
      for (let k = z.i + 2; k <= i; k++) {
        if (z.dir === 1) { if (cs[k].l <= lo) { dead = true; break; } hi = Math.min(hi, cs[k].l); }
        else { if (cs[k].h >= hi) { dead = true; break; } lo = Math.max(lo, cs[k].h); }
      }
      if (!dead) live.push({ ...z, lo, hi });
    }
    return live.slice(-6);
  }

  function orderBlocks(cs, i, atrArr, lookback = 100) {
    const out = [];
    for (let j = Math.max(2, i - lookback); j <= i; j++) {
      const a = atrArr[j];
      if (isNaN(a)) continue;
      const k = cs[j], p = cs[j - 1], bd = Math.abs(k.c - k.o);
      if (bd < 1.5 * a) continue;
      if (k.c > k.o && p.c < p.o) out.push({ dir: 1, lo: p.l, hi: p.h, i: j - 1 });
      else if (k.c < k.o && p.c > p.o) out.push({ dir: -1, lo: p.l, hi: p.h, i: j - 1 });
    }
    return out
      .filter((z) => {
        for (let k = z.i + 2; k <= i; k++) {
          if (z.dir === 1 && cs[k].c < z.lo) return false;
          if (z.dir === -1 && cs[k].c > z.hi) return false;
        }
        return true;
      })
      .slice(-4);
  }

  function liquiditySweep(cs, pivs, i) {
    const ps = known(pivs, i).filter((p) => i - p.i < 80);
    for (let k = i; k >= i - 2; k--) {
      for (let j = ps.length - 1; j >= 0; j--) {
        const p = ps[j];
        if (p.i >= k) continue;
        if (p.type === 'H' && cs[k].h > p.price && cs[k].c < p.price) return { dir: -1, level: p.price, i: k };
        if (p.type === 'L' && cs[k].l < p.price && cs[k].c > p.price) return { dir: 1, level: p.price, i: k };
      }
    }
    return null;
  }

  function volumeProfile(cs, i, lookback = 120, bins = 40) {
    const from = Math.max(0, i - lookback + 1);
    let lo = Infinity, hi = -Infinity, tv = 0;
    for (let j = from; j <= i; j++) { lo = Math.min(lo, cs[j].l); hi = Math.max(hi, cs[j].h); tv += cs[j].v; }
    if (!(tv > 0) || hi <= lo) return null;
    const step = (hi - lo) / bins, vol = new Array(bins).fill(0);
    for (let j = from; j <= i; j++) {
      const k = cs[j], b0 = Math.min(bins - 1, Math.floor((k.l - lo) / step)), b1 = Math.min(bins - 1, Math.floor((k.h - lo) / step));
      const share = k.v / (b1 - b0 + 1);
      for (let b = b0; b <= b1; b++) vol[b] += share;
    }
    let poc = 0;
    vol.forEach((v, b) => { if (v > vol[poc]) poc = b; });
    let a = poc, z = poc, acc = vol[poc];
    while (acc < 0.7 * tv && (a > 0 || z < bins - 1)) {
      const dn = a > 0 ? vol[a - 1] : -1, upv = z < bins - 1 ? vol[z + 1] : -1;
      if (dn >= upv) { a--; acc += vol[a]; } else { z++; acc += vol[z]; }
    }
    return { poc: lo + (poc + 0.5) * step, val: lo + a * step, vah: lo + (z + 1) * step, bins: vol, lo, step };
  }

  MA.st = { pivots, known, supportResistance, marketStructure, fibonacci, divergence, detectPatterns, fairValueGaps, orderBlocks, liquiditySweep, volumeProfile };
})(typeof globalThis !== 'undefined' ? globalThis : this);
