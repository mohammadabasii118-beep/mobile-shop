/* Technical indicators. All functions are causal: value at index i only uses data <= i. */
(function (root) {
  const MA = (root.MA = root.MA || {});
  const nanArr = (n) => new Array(n).fill(NaN);

  function sma(v, p) {
    const o = nanArr(v.length);
    let s = 0;
    for (let i = 0; i < v.length; i++) {
      s += v[i];
      if (i >= p) s -= v[i - p];
      if (i >= p - 1) o[i] = s / p;
    }
    return o;
  }

  // EMA seeded with the SMA of the first p valid values; leading NaNs are skipped.
  function ema(v, p) {
    const o = nanArr(v.length);
    const k = 2 / (p + 1);
    let prev, cnt = 0, sum = 0;
    for (let i = 0; i < v.length; i++) {
      if (isNaN(v[i])) continue;
      if (prev === undefined) {
        sum += v[i];
        if (++cnt === p) { prev = sum / p; o[i] = prev; }
      } else {
        prev = v[i] * k + prev * (1 - k);
        o[i] = prev;
      }
    }
    return o;
  }

  function rsi(c, p = 14) {
    const o = nanArr(c.length);
    if (c.length <= p) return o;
    let g = 0, l = 0;
    for (let i = 1; i <= p; i++) {
      const d = c[i] - c[i - 1];
      g += Math.max(d, 0); l += Math.max(-d, 0);
    }
    g /= p; l /= p;
    o[p] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
    for (let i = p + 1; i < c.length; i++) {
      const d = c[i] - c[i - 1];
      g = (g * (p - 1) + Math.max(d, 0)) / p;
      l = (l * (p - 1) + Math.max(-d, 0)) / p;
      o[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
    }
    return o;
  }

  function macd(c, f = 12, s = 26, sig = 9) {
    const ef = ema(c, f), es = ema(c, s);
    const line = c.map((_, i) => ef[i] - es[i]);
    const signal = ema(line, sig);
    const hist = line.map((x, i) => x - signal[i]);
    return { line, signal, hist };
  }

  function bollinger(c, p = 20, m = 2) {
    const mid = sma(c, p);
    const up = nanArr(c.length), low = nanArr(c.length), pb = nanArr(c.length), bw = nanArr(c.length);
    for (let i = p - 1; i < c.length; i++) {
      let s = 0;
      for (let j = i - p + 1; j <= i; j++) s += (c[j] - mid[i]) ** 2;
      const sd = Math.sqrt(s / p);
      up[i] = mid[i] + m * sd; low[i] = mid[i] - m * sd;
      pb[i] = up[i] === low[i] ? 0.5 : (c[i] - low[i]) / (up[i] - low[i]);
      bw[i] = mid[i] ? (up[i] - low[i]) / mid[i] : NaN;
    }
    return { mid, up, low, pb, bw };
  }

  function trueRange(h, l, c) {
    return h.map((_, i) => (i === 0 ? h[i] - l[i] : Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]))));
  }

  function atr(h, l, c, p = 14) {
    const tr = trueRange(h, l, c), o = nanArr(c.length);
    if (c.length < p) return o;
    let a = 0;
    for (let i = 0; i < p; i++) a += tr[i];
    a /= p; o[p - 1] = a;
    for (let i = p; i < c.length; i++) { a = (a * (p - 1) + tr[i]) / p; o[i] = a; }
    return o;
  }

  function stochastic(h, l, c, kp = 14, ks = 3, dp = 3) {
    const raw = nanArr(c.length);
    for (let i = kp - 1; i < c.length; i++) {
      let hh = -Infinity, ll = Infinity;
      for (let j = i - kp + 1; j <= i; j++) { hh = Math.max(hh, h[j]); ll = Math.min(ll, l[j]); }
      raw[i] = hh === ll ? 50 : ((c[i] - ll) / (hh - ll)) * 100;
    }
    const rawClean = raw.map((x) => (isNaN(x) ? 0 : x));
    const k = sma(rawClean, ks).map((x, i) => (i < kp - 1 + ks - 1 ? NaN : x));
    const kv = k.map((x) => (isNaN(x) ? 0 : x));
    const d = sma(kv, dp).map((x, i) => (i < kp - 1 + ks - 1 + dp - 1 ? NaN : x));
    return { k, d };
  }

  function adx(h, l, c, p = 14) {
    const n = c.length, o = { adx: nanArr(n), pdi: nanArr(n), mdi: nanArr(n) };
    if (n < 2 * p) return o;
    const tr = trueRange(h, l, c);
    const pdm = [0], mdm = [0];
    for (let i = 1; i < n; i++) {
      const up = h[i] - h[i - 1], dn = l[i - 1] - l[i];
      pdm.push(up > dn && up > 0 ? up : 0);
      mdm.push(dn > up && dn > 0 ? dn : 0);
    }
    let sTr = 0, sP = 0, sM = 0;
    for (let i = 1; i <= p; i++) { sTr += tr[i]; sP += pdm[i]; sM += mdm[i]; }
    const dx = nanArr(n);
    const setDI = (i) => {
      o.pdi[i] = sTr ? (100 * sP) / sTr : 0;
      o.mdi[i] = sTr ? (100 * sM) / sTr : 0;
      const s = o.pdi[i] + o.mdi[i];
      dx[i] = s ? (100 * Math.abs(o.pdi[i] - o.mdi[i])) / s : 0;
    };
    setDI(p);
    for (let i = p + 1; i < n; i++) {
      sTr = sTr - sTr / p + tr[i]; sP = sP - sP / p + pdm[i]; sM = sM - sM / p + mdm[i];
      setDI(i);
    }
    let a = 0;
    for (let i = p; i < 2 * p; i++) a += dx[i];
    a /= p; o.adx[2 * p - 1] = a;
    for (let i = 2 * p; i < n; i++) { a = (a * (p - 1) + dx[i]) / p; o.adx[i] = a; }
    return o;
  }

  function midline(h, l, p, i) {
    let hh = -Infinity, ll = Infinity;
    for (let j = i - p + 1; j <= i; j++) { hh = Math.max(hh, h[j]); ll = Math.min(ll, l[j]); }
    return (hh + ll) / 2;
  }

  // spanA/spanB are the cloud values that apply AT bar i (i.e. computed from bars 26 earlier).
  function ichimoku(h, l, c, tp = 9, kp = 26, sp = 52, disp = 26) {
    const n = c.length;
    const tenkan = nanArr(n), kijun = nanArr(n), rawA = nanArr(n), rawB = nanArr(n);
    const spanA = nanArr(n), spanB = nanArr(n);
    for (let i = 0; i < n; i++) {
      if (i >= tp - 1) tenkan[i] = midline(h, l, tp, i);
      if (i >= kp - 1) kijun[i] = midline(h, l, kp, i);
      if (i >= kp - 1) rawA[i] = (tenkan[i] + kijun[i]) / 2;
      if (i >= sp - 1) rawB[i] = midline(h, l, sp, i);
    }
    for (let i = disp; i < n; i++) { spanA[i] = rawA[i - disp]; spanB[i] = rawB[i - disp]; }
    return { tenkan, kijun, spanA, spanB };
  }

  function obv(c, v) {
    const o = [0];
    for (let i = 1; i < c.length; i++) o.push(o[i - 1] + (c[i] > c[i - 1] ? v[i] : c[i] < c[i - 1] ? -v[i] : 0));
    return o;
  }

  function mfi(h, l, c, v, p = 14) {
    const n = c.length, o = nanArr(n), tp = c.map((_, i) => (h[i] + l[i] + c[i]) / 3);
    for (let i = p; i < n; i++) {
      let pos = 0, neg = 0;
      for (let j = i - p + 1; j <= i; j++) {
        const f = tp[j] * v[j];
        if (tp[j] > tp[j - 1]) pos += f; else if (tp[j] < tp[j - 1]) neg += f;
      }
      o[i] = neg === 0 ? 100 : 100 - 100 / (1 + pos / neg);
    }
    return o;
  }

  function supertrend(h, l, c, p = 10, m = 3) {
    const n = c.length, a = atr(h, l, c, p);
    const line = nanArr(n), dir = nanArr(n);
    let fub, flb, d;
    for (let i = 0; i < n; i++) {
      if (isNaN(a[i])) continue;
      const hl2 = (h[i] + l[i]) / 2, ub = hl2 + m * a[i], lb = hl2 - m * a[i];
      if (fub === undefined) { fub = ub; flb = lb; d = 1; }
      else {
        fub = ub < fub || c[i - 1] > fub ? ub : fub;
        flb = lb > flb || c[i - 1] < flb ? lb : flb;
        if (d === -1) d = c[i] > fub ? 1 : -1;
        else d = c[i] < flb ? -1 : 1;
      }
      dir[i] = d; line[i] = d === 1 ? flb : fub;
    }
    return { line, dir };
  }

  // Session VWAP, reset every UTC day.
  function vwap(candles) {
    const o = nanArr(candles.length);
    let pv = 0, vv = 0, day = -1;
    candles.forEach((k, i) => {
      const d = Math.floor(k.t / 86400);
      if (d !== day) { day = d; pv = 0; vv = 0; }
      const tp = (k.h + k.l + k.c) / 3;
      pv += tp * k.v; vv += k.v;
      o[i] = vv ? pv / vv : NaN;
    });
    return o;
  }

  MA.ind = { sma, ema, rsi, macd, bollinger, atr, stochastic, adx, ichimoku, obv, mfi, supertrend, vwap, trueRange };
})(typeof globalThis !== 'undefined' ? globalThis : this);
