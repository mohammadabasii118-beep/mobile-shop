/* Market data: symbol catalog, providers (Binance → Bybit → OKX for crypto; Yahoo via the local
   proxy and Twelve Data for everything else), CSV import, resampling, live stream, demo generator. */
(function (root) {
  const MA = (root.MA = root.MA || {});

  // ── Catalog ───────────────────────────────────────────────────────────────
  const crypto = (s, name) => ({ id: s, name, group: 'crypto', bn: s + 'USDT', bb: s + 'USDT', okx: s + '-USDT', yf: s + '-USD', td: s + '/USD' });
  const fx = (a, b) => ({ id: a + b, name: `${a}/${b}`, group: 'forex', yf: `${a}${b}=X`, td: `${a}/${b}` });
  MA.catalog = [
    crypto('BTC', 'Bitcoin'), crypto('ETH', 'Ethereum'), crypto('BNB', 'BNB'), crypto('SOL', 'Solana'), crypto('XRP', 'XRP'),
    crypto('ADA', 'Cardano'), crypto('DOGE', 'Dogecoin'), crypto('AVAX', 'Avalanche'), crypto('LINK', 'Chainlink'), crypto('TON', 'Toncoin'),
    crypto('TRX', 'TRON'), crypto('DOT', 'Polkadot'),
    fx('EUR', 'USD'), fx('GBP', 'USD'), fx('USD', 'JPY'), fx('USD', 'CHF'), fx('AUD', 'USD'), fx('USD', 'CAD'), fx('NZD', 'USD'),
    fx('EUR', 'JPY'), fx('GBP', 'JPY'), fx('EUR', 'GBP'),
    { id: 'XAUUSD', name: 'طلا (XAU/USD)', group: 'commodity', yf: 'GC=F', td: 'XAU/USD' },
    { id: 'XAGUSD', name: 'نقره (XAG/USD)', group: 'commodity', yf: 'SI=F', td: 'XAG/USD' },
    { id: 'WTI', name: 'نفت WTI', group: 'commodity', yf: 'CL=F', td: 'WTI/USD' },
    { id: 'BRENT', name: 'نفت برنت', group: 'commodity', yf: 'BZ=F', td: 'BRENT/USD' },
    { id: 'NG', name: 'گاز طبیعی', group: 'commodity', yf: 'NG=F', td: 'NG/USD' },
    { id: 'SPX', name: 'S&P 500', group: 'index', yf: '^GSPC', td: 'SPX' },
    { id: 'NDX', name: 'Nasdaq Composite', group: 'index', yf: '^IXIC', td: 'IXIC' },
    { id: 'DJI', name: 'Dow Jones', group: 'index', yf: '^DJI', td: 'DJI' },
    { id: 'DAX', name: 'DAX', group: 'index', yf: '^GDAXI', td: 'DAX' },
    { id: 'N225', name: 'Nikkei 225', group: 'index', yf: '^N225', td: 'N225' },
    { id: 'DXY', name: 'شاخص دلار (DXY)', group: 'index', yf: 'DX-Y.NYB', td: 'DXY' },
    ...['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'GOOGL', 'META'].map((s) => ({ id: s, name: s, group: 'stock', yf: s, td: s })),
  ];
  MA.groups = { crypto: 'کریپتو', forex: 'فارکس', commodity: 'طلا و کالا', index: 'شاخص‌ها', stock: 'سهام' };

  // seconds per bar + provider interval codes
  MA.timeframes = [
    { id: '5m', sec: 300, bn: '5m', bb: '5', okx: '5m', yf: '5m', yfRange: '30d', td: '5min' },
    { id: '15m', sec: 900, bn: '15m', bb: '15', okx: '15m', yf: '15m', yfRange: '60d', td: '15min' },
    { id: '30m', sec: 1800, bn: '30m', bb: '30', okx: '30m', yf: '30m', yfRange: '60d', td: '30min' },
    { id: '1h', sec: 3600, bn: '1h', bb: '60', okx: '1H', yf: '60m', yfRange: '730d', td: '1h' },
    { id: '4h', sec: 14400, bn: '4h', bb: '240', okx: '4H', yf: '60m', yfRange: '730d', td: '4h', resample: true },
    { id: '1d', sec: 86400, bn: '1d', bb: 'D', okx: '1D', yf: '1d', yfRange: '5y', td: '1day' },
    { id: '1w', sec: 604800, bn: '1w', bb: 'W', okx: '1W', yf: '1wk', yfRange: '10y', td: '1week' },
  ];
  const tfOf = (id) => MA.timeframes.find((x) => x.id === id);
  MA.tfOf = tfOf;

  // ── Helpers ───────────────────────────────────────────────────────────────
  async function getJSON(url, timeout = 12000) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeout);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(timer); }
  }

  function clean(cs) {
    const seen = new Map();
    for (const k of cs) {
      if (![k.t, k.o, k.h, k.l, k.c].every(Number.isFinite) || k.c <= 0) continue;
      seen.set(k.t, { t: k.t, o: k.o, h: Math.max(k.h, k.o, k.c), l: Math.min(k.l, k.o, k.c), c: k.c, v: Number.isFinite(k.v) ? k.v : 0 });
    }
    return [...seen.values()].sort((a, b) => a.t - b.t);
  }

  function resample(cs, sec) {
    const out = [];
    for (const k of cs) {
      const b = Math.floor(k.t / sec) * sec, last = out[out.length - 1];
      if (last && last.t === b) { last.h = Math.max(last.h, k.h); last.l = Math.min(last.l, k.l); last.c = k.c; last.v += k.v; }
      else out.push({ t: b, o: k.o, h: k.h, l: k.l, c: k.c, v: k.v });
    }
    return out;
  }

  // ── Providers ─────────────────────────────────────────────────────────────
  const providers = {
    async binance(it, tf) {
      let lastErr;
      for (const host of ['https://api.binance.com', 'https://data-api.binance.vision']) {
        try {
          const j = await getJSON(`${host}/api/v3/klines?symbol=${it.bn}&interval=${tf.bn}&limit=1000`);
          return j.map((r) => ({ t: r[0] / 1000, o: +r[1], h: +r[2], l: +r[3], c: +r[4], v: +r[5] }));
        } catch (e) { lastErr = e; }
      }
      throw lastErr;
    },
    async bybit(it, tf) {
      const j = await getJSON(`https://api.bybit.com/v5/market/kline?category=spot&symbol=${it.bb}&interval=${tf.bb}&limit=1000`);
      if (j.retCode !== 0) throw new Error(j.retMsg);
      return j.result.list.map((r) => ({ t: r[0] / 1000, o: +r[1], h: +r[2], l: +r[3], c: +r[4], v: +r[5] }));
    },
    async okx(it, tf) {
      let after = '', all = [];
      for (let p = 0; p < 4; p++) {
        const j = await getJSON(`https://www.okx.com/api/v5/market/candles?instId=${it.okx}&bar=${tf.okx}&limit=300${after}`);
        if (j.code !== '0') throw new Error(j.msg);
        if (!j.data.length) break;
        all = all.concat(j.data.map((r) => ({ t: r[0] / 1000, o: +r[1], h: +r[2], l: +r[3], c: +r[4], v: +r[5] })));
        after = '&after=' + j.data[j.data.length - 1][0];
      }
      return all;
    },
    async yahoo(it, tf, keys) {
      const base = (keys.proxy || '') + '/api/yahoo';
      const j = await getJSON(`${base}?symbol=${encodeURIComponent(it.yf)}&interval=${tf.yf}&range=${tf.yfRange}`, 20000);
      const r = j.chart && j.chart.result && j.chart.result[0];
      if (!r) throw new Error((j.chart && j.chart.error && j.chart.error.description) || 'no data');
      const q = r.indicators.quote[0];
      return r.timestamp.map((t, i) => ({ t, o: q.open[i], h: q.high[i], l: q.low[i], c: q.close[i], v: q.volume ? q.volume[i] : 0 }));
    },
    async twelvedata(it, tf, keys) {
      if (!keys.td) throw new Error('کلید Twelve Data وارد نشده');
      const j = await getJSON(`https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(it.td)}&interval=${tf.td}&outputsize=1000&order=ASC&timezone=UTC&apikey=${keys.td}`);
      if (j.status === 'error') throw new Error(j.message);
      return j.values.map((r) => ({ t: Date.parse(r.datetime.replace(' ', 'T') + 'Z') / 1000, o: +r.open, h: +r.high, l: +r.low, c: +r.close, v: +(r.volume || 0) }));
    },
  };
  MA.providerNames = { auto: 'خودکار', binance: 'Binance', bybit: 'Bybit', okx: 'OKX', yahoo: 'Yahoo (با سرور محلی)', twelvedata: 'Twelve Data (کلید API)', demo: 'داده‌ی آزمایشی' };

  async function fetchCandles(it, tfId, source = 'auto', keys = {}) {
    const tf = tfOf(tfId);
    if (source === 'demo') return { candles: demo(it.id + tfId, tf.sec), source: 'demo' };
    const chain = source !== 'auto' ? [source]
      : it.group === 'crypto' ? ['binance', 'bybit', 'okx', 'yahoo', 'twelvedata'] : ['yahoo', 'twelvedata'];
    const errors = [];
    for (const s of chain) {
      if ((s === 'binance' || s === 'bybit' || s === 'okx') && !it.bn) { errors.push(`${s}: این نماد پشتیبانی نمی‌شود`); continue; }
      try {
        let cs = clean(await providers[s](it, tf, keys));
        if (s === 'yahoo' && tf.resample) cs = resample(cs, tf.sec);
        if (cs.length < 60) throw new Error('داده‌ی کافی نیست (' + cs.length + ' کندل)');
        return { candles: cs.slice(-1000), source: s };
      } catch (e) { errors.push(`${s}: ${e.message}`); }
    }
    const err = new Error('دریافت داده ناموفق بود'); err.details = errors; throw err;
  }

  // Binance websocket for live candle updates (crypto only).
  function subscribeLive(it, tfId, onCandle) {
    const tf = tfOf(tfId);
    if (!it.bn || typeof WebSocket === 'undefined') return () => {};
    let ws, closed = false, retry = 0;
    const open = () => {
      ws = new WebSocket(`wss://stream.binance.com:9443/ws/${it.bn.toLowerCase()}@kline_${tf.bn}`);
      ws.onmessage = (m) => {
        const k = JSON.parse(m.data).k;
        if (k) onCandle({ t: k.t / 1000, o: +k.o, h: +k.h, l: +k.l, c: +k.c, v: +k.v }, k.x);
      };
      ws.onopen = () => { retry = 0; };
      ws.onclose = () => { if (!closed && retry++ < 5) setTimeout(open, 2000 * retry); };
      ws.onerror = () => ws.close();
    };
    open();
    return () => { closed = true; ws && ws.close(); };
  }

  // ── CSV ───────────────────────────────────────────────────────────────────
  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) throw new Error('فایل خالی است');
    const delim = [',', ';', '\t'].map((d) => [d, lines[0].split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
    const head = lines[0].split(delim).map((x) => x.trim().toLowerCase().replace(/"/g, ''));
    const idx = (...names) => head.findIndex((h) => names.some((n) => h === n || h.startsWith(n)));
    const ti = idx('time', 'date', 'datetime', 'timestamp', 'open time'), oi = idx('open'), hi = idx('high'), li = idx('low'), ci = idx('close'), vi = idx('volume', 'vol');
    if ([ti, oi, hi, li, ci].some((x) => x < 0)) throw new Error('ستون‌های date/open/high/low/close پیدا نشد');
    const cs = lines.slice(1).map((ln) => {
      const p = ln.split(delim).map((x) => x.trim().replace(/"/g, ''));
      let t = +p[ti];
      if (!Number.isFinite(t)) t = Date.parse(p[ti].replace(' ', 'T')) / 1000; else if (t > 1e11) t /= 1000;
      return { t, o: +p[oi], h: +p[hi], l: +p[li], c: +p[ci], v: vi >= 0 ? +p[vi] : 0 };
    });
    const out = clean(cs);
    if (out.length < 60) throw new Error('حداقل ۶۰ کندل لازم است');
    return out;
  }

  // ── Demo data: seeded regime-switching random walk ────────────────────────
  function demo(seedStr, sec, n = 900) {
    let s = 0;
    for (const ch of seedStr) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
    const base = 50 + (s % 5000) / 10;
    let p = base, drift = 0, vol = 0.004, left = 0;
    const t0 = Math.floor(Date.now() / 1000 / sec) * sec - n * sec, out = [];
    for (let i = 0; i < n; i++) {
      if (left-- <= 0) { drift = (rnd() - 0.5) * 0.0016; vol = 0.002 + rnd() * 0.006; left = 40 + Math.floor(rnd() * 120); }
      const o = p, steps = 12;
      let h = o, l = o, c = o;
      for (let k = 0; k < steps; k++) { c *= 1 + drift / steps + (vol / Math.sqrt(steps)) * gauss(); h = Math.max(h, c); l = Math.min(l, c); }
      p = c;
      out.push({ t: t0 + i * sec, o, h, l, c, v: Math.round(1000 * (1 + rnd()) * (1 + Math.abs(c - o) / o / vol)) });
    }
    return out;
  }

  // Item for any user-typed symbol: crypto base asset (PEPE) or a raw Yahoo/Twelve Data symbol.
  MA.makeItem = (group, sym) => {
    sym = sym.trim().toUpperCase().replace(/[^A-Z0-9=^.\-\/]/g, '');
    const known = MA.catalog.find((x) => x.group === group && x.id === sym);
    if (known) return known;
    if (group === 'crypto') { sym = sym.replace(/(USDT|USD)$/, ''); return { id: sym, name: sym, group, bn: sym + 'USDT', bb: sym + 'USDT', okx: sym + '-USDT', yf: sym + '-USD', td: sym + '/USD' }; }
    return { id: sym, name: sym, group, yf: sym, td: sym };
  };

  MA.data = { fetchCandles, subscribeLive, parseCSV, demo, resample, clean };
})(typeof globalThis !== 'undefined' ? globalThis : this);
