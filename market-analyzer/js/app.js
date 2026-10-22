/* UI: data loading, charts (TradingView lightweight-charts), side panels. */
(function () {
  const MA = window.MA, LC = window.LightweightCharts;
  const A = MA.analysis, D = MA.data, fmt = A.fmt;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem('ma.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('ma.' + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };

  const OVERLAYS = [
    ['ema', 'EMA', true], ['bb', 'بولینگر', false], ['ichi', 'ایچیموکو', false], ['st', 'سوپرترند', false], ['vwap', 'VWAP', false],
    ['sr', 'حمایت/مقاومت', true], ['fib', 'فیبوناچی', false], ['zones', 'FVG / OB', true], ['pat', 'الگوهای کندلی', true],
    ['plan', 'پلن معامله', true], ['vol', 'حجم', true], ['bt', 'معاملات بک‌تست', false],
  ];
  const VERDICT = {
    'strong-buy': ['خرید قوی', 'up'], buy: ['خرید', 'up'], neutral: ['خنثی — صبر کنید', 'muted'], sell: ['فروش', 'down'], 'strong-sell': ['فروش قوی', 'down'],
  };
  const GROUP_FA = { trend: 'روند', momentum: 'مومنتوم', volatility: 'نوسان', volume: 'حجم', structure: 'ساختار/سطوح', smc: 'اسمارت‌مانی', patterns: 'الگوها' };
  const REGIME_FA = { trending: 'روندی', ranging: 'رنج', transition: 'انتقالی', unknown: 'نامشخص' };

  const state = {
    group: store.get('group', 'crypto'), id: store.get('id', 'BTC'), tf: store.get('tf', '1h'), source: store.get('source', 'auto'),
    keys: { td: store.get('td', ''), proxy: store.get('proxy', '') },
    ov: Object.assign(Object.fromEntries(OVERLAYS.map(([k, , d]) => [k, d])), store.get('ov', {})),
    mode: store.get('mode', 'futures'), custom: store.get('custom', null), dec: null, prevKey: null, wl: store.get('wl', ['BTC', 'ETH', 'SOL', 'BNB', 'XRP']), wlData: {},
    item: null, candles: [], ctx: null, res: null, used: null, bt: null, mtf: null, seq: 0, stopLive: null, timer: null, csv: null,
  };

  // ── Header controls ───────────────────────────────────────────────────────
  function buildHeader() {
    $('groups').innerHTML = Object.entries(MA.groups).map(([k, v]) => `<button data-g="${k}" class="${k === state.group ? 'on' : ''}">${v}</button>`).join('');
    $('groups').onclick = (e) => {
      const g = e.target.dataset.g; if (!g) return;
      state.group = g; state.csv = null; state.custom = null; store.set('custom', null);
      state.id = MA.catalog.find((x) => x.group === g).id;
      buildHeader(); load();
    };
    const items = MA.catalog.filter((x) => x.group === state.group);
    if (!items.some((x) => x.id === state.id)) state.id = items[0].id;
    $('symbol').innerHTML = items.map((x) => `<option value="${x.id}">${esc(x.name)}${x.group === 'crypto' ? ' · ' + x.id + '/USDT' : ''}</option>`).join('');
    $('symbol').value = state.id;
    $('symbol').onchange = (e) => { state.id = e.target.value; state.csv = null; state.custom = null; store.set('custom', null); load(); };
    $('tfs').innerHTML = MA.timeframes.map((t) => `<button data-t="${t.id}" class="${t.id === state.tf ? 'on' : ''}">${t.id}</button>`).join('');
    $('tfs').onclick = (e) => { const t = e.target.dataset.t; if (!t) return; state.tf = t; state.csv = null; buildHeader(); load(); };
    $('modes').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.m === state.mode));
    $('modes').onclick = (e) => { const m = e.target.dataset.m; if (!m) return; state.mode = m; store.set('mode', m); buildHeader(); redecide(); scanWatch(); };
    $('custom').onkeydown = (e) => {
      if (e.key !== 'Enter' || !e.target.value.trim()) return;
      state.custom = MA.makeItem(state.group, e.target.value); store.set('custom', state.custom);
      e.target.value = ''; load();
    };
    store.set('group', state.group); store.set('id', state.id); store.set('tf', state.tf);
  }

  function buildOverlayToggles() {
    $('overlays').innerHTML = OVERLAYS.map(([k, label]) => `<label><input type="checkbox" data-o="${k}" ${state.ov[k] ? 'checked' : ''}>${label}</label>`).join('');
    $('overlays').onchange = (e) => { state.ov[e.target.dataset.o] = e.target.checked; store.set('ov', state.ov); applyOverlays(); };
  }

  // ── Charts ────────────────────────────────────────────────────────────────
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let C = null; // chart objects

  class ZonePrimitive {
    constructor() {
      this.zones = [];
      const self = this;
      this._pv = { zOrder: () => 'bottom', renderer: () => ({ draw() {}, drawBackground: (t) => self.paint(t) }) };
    }
    attached(p) { this.chart = p.chart; this.series = p.series; this.req = p.requestUpdate; }
    detached() {}
    paneViews() { return [this._pv]; }
    updateAllViews() {}
    set(z) { this.zones = z; if (this.req) this.req(); }
    paint(target) {
      target.useBitmapCoordinateSpace(({ context: ctx, horizontalPixelRatio: hr, verticalPixelRatio: vr, bitmapSize }) => {
        for (const z of this.zones) {
          const y1 = this.series.priceToCoordinate(z.hi), y2 = this.series.priceToCoordinate(z.lo);
          if (y1 == null || y2 == null) continue;
          let x = this.chart.timeScale().timeToCoordinate(z.t);
          x = Math.max(0, (x == null ? 0 : x) * hr);
          const top = Math.min(y1, y2) * vr, h = Math.max(2, Math.abs(y2 - y1) * vr);
          ctx.fillStyle = z.fill; ctx.fillRect(x, top, bitmapSize.width - x, h);
          ctx.fillStyle = z.line; ctx.fillRect(x, top, bitmapSize.width - x, Math.max(1, vr));
          ctx.font = `${11 * hr}px sans-serif`; ctx.fillText(z.label, x + 4 * hr, top + 12 * vr);
        }
      });
    }
  }

  function createCharts() {
    const bg = css('--chart-bg'), grid = css('--chart-grid'), text = css('--muted');
    const base = () => ({
      autoSize: true,
      layout: { background: { type: 'solid', color: bg }, textColor: text, fontFamily: 'system-ui, sans-serif' },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      rightPriceScale: { borderColor: grid, minimumWidth: 72 }, timeScale: { borderColor: grid, timeVisible: true, secondsVisible: false, rightOffset: 8 },
      crosshair: { mode: LC.CrosshairMode.Normal },
    });
    const main = LC.createChart($('cMain'), base()), rsi = LC.createChart($('cRsi'), base()), macd = LC.createChart($('cMacd'), base());
    const up = css('--up'), down = css('--down');
    const L = (chart, color, w = 1, extra = {}) => chart.addLineSeries({ color, lineWidth: w, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, ...extra });

    const candle = main.addCandlestickSeries({ upColor: up, downColor: down, wickUpColor: up, wickDownColor: down, borderVisible: false });
    const vol = main.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'vol', lastValueVisible: false, priceLineVisible: false });
    main.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    const zones = new ZonePrimitive(); candle.attachPrimitive(zones);

    C = {
      main, rsi, macd, candle, vol, zones, lines: [],
      ema20: L(main, '#f0b429'), ema50: L(main, '#4c8dff'), ema200: L(main, '#b57cf5', 2),
      bbU: L(main, '#7d8a9a'), bbM: L(main, '#7d8a9a', 1, { lineStyle: 2 }), bbL: L(main, '#7d8a9a'),
      tenkan: L(main, '#4c8dff'), kijun: L(main, '#ef5350'), spanA: L(main, 'rgba(38,166,154,.7)'), spanB: L(main, 'rgba(239,83,80,.7)'),
      st: L(main, up, 2), vwap: L(main, '#e6a23c', 1, { lineStyle: 2 }),
      rsiS: L(rsi, '#b57cf5', 2, { lastValueVisible: true }),
      mHist: macd.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false }),
      mLine: L(macd, '#4c8dff', 1), mSig: L(macd, '#f0b429', 1),
    };
    for (const p of [30, 50, 70]) C.rsiS.createPriceLine({ price: p, color: p === 50 ? grid : '#7d8a9a', lineWidth: 1, lineStyle: 2, axisLabelVisible: false });

    // keep the three panes on the same time window
    let busy = false;
    const charts = [main, rsi, macd];
    charts.forEach((c) => c.timeScale().subscribeVisibleLogicalRangeChange((r) => {
      if (busy || !r) return; busy = true;
      charts.forEach((o) => o !== c && o.timeScale().setVisibleLogicalRange(r));
      busy = false;
    }));
    // crosshair readouts
    main.subscribeCrosshairMove((p) => {
      const i = p.time ? state.candles.findIndex((k) => k.t === p.time) : state.candles.length - 1;
      updateLabels(i < 0 ? state.candles.length - 1 : i);
    });
  }

  const ser = (arr, cs) => cs.map((k, i) => (Number.isFinite(arr[i]) ? { time: k.t, value: arr[i] } : null)).filter(Boolean);

  function setChartData() {
    const { ctx, candles: cs } = state, up = css('--up'), down = css('--down');
    C.candle.setData(cs.map((k) => ({ time: k.t, open: k.o, high: k.h, low: k.l, close: k.c })));
    C.vol.setData(ctx.hasVolume ? cs.map((k) => ({ time: k.t, value: k.v, color: k.c >= k.o ? 'rgba(38,166,154,.35)' : 'rgba(239,83,80,.35)' })) : []);
    C.ema20.setData(ser(ctx.ema20, cs)); C.ema50.setData(ser(ctx.ema50, cs)); C.ema200.setData(ser(ctx.ema200, cs));
    C.bbU.setData(ser(ctx.bb.up, cs)); C.bbM.setData(ser(ctx.bb.mid, cs)); C.bbL.setData(ser(ctx.bb.low, cs));
    C.tenkan.setData(ser(ctx.ichi.tenkan, cs)); C.kijun.setData(ser(ctx.ichi.kijun, cs));
    C.spanA.setData(ser(ctx.ichi.spanA, cs)); C.spanB.setData(ser(ctx.ichi.spanB, cs));
    C.st.setData(cs.map((k, i) => (Number.isFinite(ctx.st.line[i]) ? { time: k.t, value: ctx.st.line[i], color: ctx.st.dir[i] > 0 ? up : down } : null)).filter(Boolean));
    C.vwap.setData(ctx.hasVolume ? ser(ctx.vwap, cs) : []);
    C.rsiS.setData(ser(ctx.rsi, cs));
    const h = ctx.macd.hist;
    C.mHist.setData(cs.map((k, i) => (Number.isFinite(h[i]) ? { time: k.t, value: h[i], color: h[i] >= 0 ? (h[i] >= (h[i - 1] || 0) ? up : 'rgba(38,166,154,.45)') : (h[i] <= (h[i - 1] || 0) ? down : 'rgba(239,83,80,.45)') } : null)).filter(Boolean));
    C.mLine.setData(ser(ctx.macd.line, cs)); C.mSig.setData(ser(ctx.macd.signal, cs));
  }

  function applyOverlays() {
    const o = state.ov, set = (s, v) => s.applyOptions({ visible: !!v });
    [C.ema20, C.ema50, C.ema200].forEach((s) => set(s, o.ema));
    [C.bbU, C.bbM, C.bbL].forEach((s) => set(s, o.bb));
    [C.tenkan, C.kijun, C.spanA, C.spanB].forEach((s) => set(s, o.ichi));
    set(C.st, o.st); set(C.vwap, o.vwap); set(C.vol, o.vol);
    drawAnnotations();
  }

  function drawAnnotations() {
    const r = state.res, o = state.ov;
    C.lines.forEach((l) => C.candle.removePriceLine(l)); C.lines = [];
    const line = (price, color, title, style = 0, width = 1) => C.lines.push(C.candle.createPriceLine({ price, color, lineWidth: width, lineStyle: style, axisLabelVisible: true, title }));
    const up = css('--up'), down = css('--down');
    let markers = [], zones = [];
    if (r) {
      if (o.sr) {
        // only the 3 nearest levels on each side, otherwise the chart drowns in lines
        const near = [...r.levels.filter((l) => l.type === 'R').slice(0, 3), ...r.levels.filter((l) => l.type === 'S').slice(-3)];
        near.forEach((l) => line(l.price, l.type === 'S' ? 'rgba(38,166,154,.8)' : 'rgba(239,83,80,.8)', `${l.type === 'S' ? 'حمایت' : 'مقاومت'} ×${l.touches}`, 2));
      }
      if (o.fib && r.fib) {
        r.fib.levels.forEach((f) => line(f.price, 'rgba(240,180,41,.6)', `Fib ${f.r}`, 3));
        r.fib.ext.forEach((f) => line(f.price, 'rgba(181,124,245,.5)', `Fib ${f.r}`, 3));
      }
      if (o.vol && r.vp) { line(r.vp.poc, '#e6a23c', 'POC', 0, 1); }
      if (o.plan && state.dec && state.dec.entry) {
        const d = state.dec;
        line(d.entry.price, '#4c8dff', d.entry.kind === 'limit' ? 'Limit' : 'ورود', d.entry.kind === 'limit' ? 2 : 0, 2); line(d.stop, down, 'حد ضرر', 0, 2);
        d.targets.forEach((t, k) => line(t.price, up, `TP${k + 1} (${t.rr}R)`, 0, 1));
      }
      if (o.zones) {
        const t0 = (z) => state.candles[z.i].t;
        r.fvg.forEach((z) => zones.push({ t: t0(z), lo: z.lo, hi: z.hi, label: 'FVG', fill: z.dir > 0 ? 'rgba(38,166,154,.14)' : 'rgba(239,83,80,.14)', line: z.dir > 0 ? up : down }));
        r.obs.forEach((z) => zones.push({ t: t0(z), lo: z.lo, hi: z.hi, label: 'OB', fill: z.dir > 0 ? 'rgba(76,141,255,.16)' : 'rgba(240,180,41,.16)', line: z.dir > 0 ? '#4c8dff' : '#f0b429' }));
      }
      if (o.pat) {
        const n = state.candles.length;
        for (let i = Math.max(10, n - 80); i < n; i++) {
          for (const p of MA.st.detectPatterns(state.candles, state.ctx.atr, i)) {
            if (p.dir === 0 || p.strength < 0.6) continue;
            markers.push({ time: state.candles[i].t, position: p.dir > 0 ? 'belowBar' : 'aboveBar', shape: p.dir > 0 ? 'arrowUp' : 'arrowDown', color: p.dir > 0 ? up : down, text: p.strength >= 0.75 ? p.fa : '' });
          }
        }
      }
    }
    if (o.bt && state.bt) {
      for (const t of state.bt.trades) {
        markers.push({ time: t.t0, position: t.dir > 0 ? 'belowBar' : 'aboveBar', shape: t.dir > 0 ? 'arrowUp' : 'arrowDown', color: '#4c8dff', text: 'ورود' });
        markers.push({ time: t.t1, position: t.dir > 0 ? 'aboveBar' : 'belowBar', shape: 'circle', color: t.r > 0 ? up : down, text: `${t.r > 0 ? '+' : ''}${t.r.toFixed(1)}R` });
      }
    }
    markers.sort((a, b) => a.time - b.time);
    C.candle.setMarkers(markers);
    C.zones.set(zones);
  }

  function updateLabels(i) {
    const c = state.ctx; if (!c || i < 0) return;
    const f = (x) => (Number.isFinite(x) ? x.toFixed(2) : '—');
    $('lblRsi').textContent = f(c.rsi[i]);
    $('lblMacd').textContent = `${f(c.macd.line[i])} / ${f(c.macd.signal[i])} / ${f(c.macd.hist[i])}`;
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  function showMsg(html) { const m = $('msg'); m.hidden = !html; m.innerHTML = html || ''; }

  async function load(silent = false) {
    const seq = ++state.seq;
    clearTimeout(state.timer); if (state.stopLive) { state.stopLive(); state.stopLive = null; }
    state.item = state.csv ? state.csv.item : state.custom || MA.catalog.find((x) => x.id === state.id);
    if (!silent) { document.querySelector('.charts').classList.add('loading'); showMsg(''); }
    try {
      let out;
      if (state.csv) out = { candles: state.csv.candles, source: 'csv' };
      else out = await D.fetchCandles(state.item, state.tf, state.source, state.keys);
      if (seq !== state.seq) return;
      state.candles = out.candles; state.used = out.source; state.mtf = null; state.bt = null;
      refresh(true);
      runBacktest();
      runMTF(seq);
      if (state.used === 'binance') {
        state.stopLive = D.subscribeLive(state.item, state.tf, onLive);
      }
      const every = state.used === 'binance' ? 120 : ['demo', 'csv'].includes(state.used) ? 0 : 300;
      if (every) state.timer = setTimeout(() => load(true), every * 1000);
    } catch (e) {
      if (seq !== state.seq) return;
      const det = (e.details || [e.message]).map((d) => `<li>${esc(d)}</li>`).join('');
      showMsg(`<b>${esc(e.message)}</b><ul>${det}</ul>
        <p class="small">برای فارکس/طلا/سهام: <code dir="ltr">node server.js</code> را اجرا و از <code dir="ltr">http://localhost:8787</code> باز کنید، یا در ⚙ کلید رایگان Twelve Data بگذارید. برای کریپتو ممکن است شبکه‌ی شما Binance/Bybit/OKX را مسدود کرده باشد (VPN).</p>
        <button class="btn primary" id="useDemo">نمایش با داده‌ی آزمایشی</button> <button class="btn" id="openSet">تنظیمات</button>`);
      $('useDemo').onclick = () => { state.source = 'demo'; load(); };
      $('openSet').onclick = openSettings;
    } finally {
      if (seq === state.seq) document.querySelector('.charts').classList.remove('loading');
    }
  }

  // Recompute everything from state.candles and redraw.
  function refresh(fit) {
    const cs = state.candles;
    state.ctx = A.buildContext(cs);
    state.sigIdx = state.csv || state.used === 'demo' ? cs.length - 1 : MA.lastClosed(cs, MA.tfOf(state.tf).sec);
    state.res = A.evaluate(state.ctx, state.sigIdx);
    state.dec = state.res ? MA.decide({ res: state.res, ctx: state.ctx, candles: cs, mode: state.mode, align: mtfAdjust().align }) : null;
    checkAlert();
    if (!C) createCharts();
    setChartData(); applyOverlays();
    if (fit) { const n = cs.length; C.main.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - 160), to: n + 8 }); }
    renderHeader(); renderPanels(); updateLabels(cs.length - 1);
  }

  let liveT = 0;
  function onLive(k, closed) {
    const cs = state.candles, last = cs[cs.length - 1];
    if (!last) return;
    if (k.t === last.t) cs[cs.length - 1] = k;
    else if (k.t > last.t) cs.push(k); else return;
    C.candle.update({ time: k.t, open: k.o, high: k.h, low: k.l, close: k.c });
    const now = Date.now();
    if (closed || now - liveT > 3000) {
      liveT = now; refresh(false);
      if (closed) runBacktest();
    } else renderHeader();
  }

  function renderHeader() {
    const cs = state.candles, last = cs[cs.length - 1], prev = cs[cs.length - 2];
    $('chTitle').textContent = `${state.item.name}${state.item.group === 'crypto' ? '/USDT' : ''} · ${state.csv ? 'CSV' : state.tf}`;
    $('chPrice').textContent = fmt(last.c);
    const chg = ((last.c / prev.c - 1) * 100);
    $('chChg').textContent = `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%`;
    $('chChg').className = 'num ' + (chg >= 0 ? 'up' : 'down');
    const b = $('srcBadge');
    b.textContent = MA.providerNames[state.used] || state.used || '';
    b.className = 'badge ' + (state.used === 'demo' ? 'demo' : state.used === 'binance' ? 'live' : '');
    if (state.used === 'demo') b.textContent = 'داده‌ی آزمایشی (واقعی نیست)';
    if (state.used === 'csv') b.textContent = 'CSV';
  }

  // ── Side panels ───────────────────────────────────────────────────────────
  const sgn = (x) => (x > 0 ? 1 : x < 0 ? -1 : 0);
  const cls = (x) => (x > 0.15 ? 'up' : x < -0.15 ? 'down' : 'muted');
  const barHTML = (s) => `<div class="bar"><i style="${s >= 0 ? 'left:50%' : 'right:50%'};width:${Math.abs(s) * 50}%;background:var(${s >= 0 ? '--up' : '--down'})"></i></div>`;

  function mtfAdjust() {
    const r = state.res; if (!r) return { conf: 0, note: null, align: 0 };
    let conf = r.confidence, note = null, align = 0;
    if (state.mtf && r.dir) {
      const higher = state.mtf.rows.filter((x) => x.rel > 0 && x.res);
      if (higher.length) {
        const avg = higher.reduce((a, x) => a + x.res.score, 0) / higher.length;
        if (sgn(avg) === r.dir && Math.abs(avg) >= 15) { conf = Math.min(100, conf + 8); align = 1; note = 'هم‌جهت با تایم‌فریم‌های بالاتر ✓'; }
        else if (sgn(avg) === -r.dir && Math.abs(avg) >= 15) { conf = Math.max(0, conf - 15); align = -1; note = 'خلاف جهت تایم‌فریم‌های بالاتر ✗ — ریسک بالاتر'; }
        else note = 'تایم‌فریم‌های بالاتر خنثی‌اند';
      }
    }
    return { conf, note, align };
  }

  function renderPanels() {
    const r = state.res;
    if (!r) { ['verdict', 'plan', 'calc', 'factors', 'levels'].forEach((k) => ($(k).innerHTML = '')); $('verdict').innerHTML = '<p class="muted">داده برای تحلیل کافی نیست.</p>'; return; }
    renderVerdict(); renderPlan(); renderCalc(); renderWatch(); renderFactors(); renderLevels(); renderBacktest(); renderMTF();
  }

  function renderVerdict() {
    const r = state.res, [label, c] = VERDICT[r.verdict], adj = mtfAdjust();
    const pos = 50 + r.score / 2;
    $('verdict').innerHTML = `
      <div class="v-row"><div><div class="v-label ${c}">${label}</div><div class="muted small">امتیاز کل از ۱۰۰− تا ۱۰۰+</div></div>
        <div style="text-align:end"><div class="num v-label ${c}">${r.score > 0 ? '+' : ''}${r.score.toFixed(0)}</div><div class="small">اطمینان <b class="num">${adj.conf}%</b></div></div></div>
      <div class="gauge"><i style="left:${pos}%"></i></div>
      <div class="gauge-scale"><span>Strong Sell</span><span>Neutral</span><span>Strong Buy</span></div>
      <div class="chips">
        <span class="chip">رژیم بازار: <b>${REGIME_FA[r.regime.kind]}</b>${Number.isFinite(r.regime.adx) ? ` (ADX ${r.regime.adx.toFixed(0)})` : ''}</span>
        <span class="chip">ATR: <b class="num">${(r.atr / r.price * 100).toFixed(2)}%</b></span>
        <span class="chip">نوسان نسبی: <b class="num">${(r.regime.volPct * 100).toFixed(0)}٪ اخیر</b></span>
        <span class="chip">ساختار: <b>${{ up: 'صعودی', down: 'نزولی', range: 'رنج', unknown: '—' }[r.ms.trend]}</b></span>
        ${adj.note ? `<span class="chip ${adj.align > 0 ? 'up' : adj.align < 0 ? 'down' : ''}">${adj.note}</span>` : ''}
      </div>
      ${r.warnings.length ? `<ul class="warnings">${r.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
      ${state.used === 'binance' ? '<p class="small">کندل جاری هنوز بسته نشده؛ سیگنال با بسته‌شدن کندل نهایی می‌شود.</p>' : ''}`;
  }

  function redecide() {
    if (!state.res) return;
    state.dec = MA.decide({ res: state.res, ctx: state.ctx, candles: state.candles, mode: state.mode, align: mtfAdjust().align });
    checkAlert(); renderVerdict(); renderPlan(); renderCalc(); drawAnnotations();
  }

  function renderPlan() {
    const d = state.dec; if (!d) { $('plan').innerHTML = ''; return; }
    const spot = d.mode === 'spot', fe = (x) => fmt(x), pc = (x) => `${(((x - d.live) / d.live) * 100).toFixed(2)}%`;
    const sideTag = d.side ? `<span class="pill ${d.tone}">${{ BUY: 'خرید اسپات', LONG: 'Long ▲', SHORT: 'Short ▼' }[d.side]}</span>` : '';
    const age = d.signalBars > 0 ? `بر پایه‌ی کندل بسته‌شده‌ی ${d.signalBars} کندل قبل` : 'بر پایه‌ی آخرین کندل بسته‌شده';
    let body = '';
    if (d.entry) {
      body = `<table><thead><tr><th></th><th class="r">قیمت</th><th class="r">فاصله از قیمت فعلی</th><th class="r">R</th></tr></thead><tbody>
        <tr><td><b>${d.entry.kind === 'limit' ? 'سفارش Limit' : 'ورود بازار'}</b></td><td class="r num">${fe(d.entry.price)}</td><td class="r num">${pc(d.entry.price)}</td><td class="r"></td></tr>
        <tr><td class="down">${spot ? 'حد ضرر (فروش)' : 'حد ضرر'}</td><td class="r num down">${fe(d.stop)}</td><td class="r num">${pc(d.stop)}</td><td class="r num">−1</td></tr>
        ${d.targets.map((t, k) => `<tr><td class="up">هدف ${k + 1}</td><td class="r num up">${fe(t.price)}</td><td class="r num">${pc(t.price)}</td><td class="r num">+${t.rr}</td></tr>`).join('')}</tbody></table>
        <div class="kv"><span>ریسک تا حد ضرر</span><b class="num">${d.riskPct.toFixed(2)}%</b>${d.lev ? `<span>اهرم پیشنهادی (حداکثر)</span><b class="num">${d.lev}x · Isolated</b>` : ''}</div>`;
    }
    $('plan').className = `card act ${d.tone}`;
    $('plan').innerHTML = `<div class="small muted">${spot ? 'اسپات' : 'فیوچرز'} · ${esc(state.item.name)} ${state.csv ? '' : state.tf} · ${age} ${sideTag}</div>
      <div class="act-title ${d.tone}">${esc(d.title)}</div><div class="act-sub">${esc(d.sub)} · اطمینان <b class="num">${d.conf}%</b> · امتیاز <b class="num">${d.score > 0 ? '+' : ''}${d.score.toFixed(0)}</b></div>
      ${body}
      ${d.reasons.length ? `<h5>چرا؟</h5><ul>${d.reasons.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${d.exits.length ? `<h5>${d.entry ? 'مدیریت خروج' : 'چه چیزی وضعیت را عوض می‌کند'}</h5><ul>${d.exits.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <p class="plan-note">قیمت‌ها زنده‌اند و سیگنال فقط با بسته‌شدن کندل تغییر می‌کند. اگر قیمت ورود از دست رفت، دنبالش نکنید.</p>`;
  }

  function renderCalc() {
    const d = state.dec;
    if (!d || !d.entry) { $('calc').innerHTML = ''; return; }
    $('calc').innerHTML = `<h4>مدیریت سرمایه</h4>
      <div class="field"><span>سرمایه‌ی حساب</span><input id="cap" type="number" min="0" value="${store.get('cap', 10000)}"></div>
      <div class="field"><span>ریسک هر معامله (٪)</span><input id="rsk" type="number" min="0.1" max="10" step="0.1" value="${store.get('rsk', 1)}"></div>
      <div class="kv" id="calcOut"></div>`;
    const upd = () => {
      const cap = +$('cap').value, rk = +$('rsk').value;
      store.set('cap', cap); store.set('rsk', rk);
      const amt = cap * rk / 100, units = amt / d.risk, notional = units * d.entry.price, lev = cap ? notional / cap : 0;
      const isFx = state.item.group === 'forex';
      $('calcOut').innerHTML = `
        <span>مبلغ در معرض ریسک</span><b class="num">${amt.toFixed(2)}</b>
        <span>حجم پوزیشن</span><b class="num">${units >= 100 ? units.toFixed(0) : units.toFixed(4)} واحد${isFx ? ` (${(units / 100000).toFixed(2)} لات)` : ''}</b>
        <span>ارزش اسمی</span><b class="num">${notional.toFixed(2)}</b>
        <span>${d.mode === 'spot' ? 'سهم از سرمایه' : 'اهرم لازم'}</span><b class="num ${lev > (d.mode === 'spot' ? 1 : 10) ? 'down' : ''}">${d.mode === 'spot' ? (lev * 100).toFixed(0) + '%' : lev.toFixed(1) + 'x'}</b>
        <span>سود در هدف ۲ (۲.۵R)</span><b class="num up">+${(amt * 2.5).toFixed(2)}</b>
        ${d.mode === 'spot' && lev > 1 ? '<span class="down">هشدار</span><b class="down">با این ریسک، بیش از کل سرمایه لازم است؛ ریسک را کم کنید</b>' : ''}`;
    };
    $('cap').oninput = upd; $('rsk').oninput = upd; upd();
  }

  function renderFactors() {
    const r = state.res;
    const groups = Object.entries(r.groups).sort((a, b) => b[1].w - a[1].w);
    const sorted = r.factors.slice().sort((a, b) => Math.abs(b.score * b.weight) - Math.abs(a.score * a.weight));
    $('factors').innerHTML = `<h4>تحلیل چندلایه <small>${r.factors.length} فاکتور</small></h4>
      ${groups.map(([g, v]) => `<div class="grp"><span>${GROUP_FA[g] || g}</span>${barHTML(v.score / 100)}<b class="num ${cls(v.score / 100)}">${v.score > 0 ? '+' : ''}${v.score.toFixed(0)}</b></div>`).join('')}
      <details open><summary>جزئیات فاکتورها</summary>
      ${sorted.map((f) => `<div class="frow"><div class="t"><span>${esc(f.name)}</span><b class="num ${cls(f.score)}">${f.score > 0 ? '+' : ''}${(f.score * 100).toFixed(0)}</b></div><div class="d">${esc(f.text)}</div>${barHTML(f.score)}</div>`).join('')}
      </details>`;
  }

  function renderLevels() {
    const r = state.res, price = state.candles[state.candles.length - 1].c, pct = (x) => `${(((x - price) / price) * 100).toFixed(2)}%`;
    const lv = r.levels.slice().sort((a, b) => b.price - a.price);
    const recent = r.patterns.filter((p) => p.dir !== 0 || p.age === 0);
    $('levels').innerHTML = `<h4>سطوح کلیدی</h4>
      <table><thead><tr><th>سطح</th><th class="r">قیمت</th><th class="r">فاصله</th><th class="r">قدرت</th></tr></thead><tbody>
      ${lv.map((l) => `<tr><td class="${l.type === 'S' ? 'up' : 'down'}">${l.type === 'S' ? 'حمایت' : 'مقاومت'}</td><td class="r num">${fmt(l.price)}</td><td class="r num">${pct(l.price)}</td><td class="r num">${'●'.repeat(Math.min(5, Math.round(l.strength)))}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">سطح معتبری یافت نشد</td></tr>'}
      </tbody></table>
      <div class="kv">
        ${r.vp ? `<span>POC (بیشترین حجم)</span><b class="num">${fmt(r.vp.poc)}</b><span>ناحیه‌ی ارزش (۷۰٪ حجم)</span><b class="num">${fmt(r.vp.val)} – ${fmt(r.vp.vah)}</b>` : ''}
        ${r.fib ? `<span>موج فیبوناچی ${r.fib.dir === 'up' ? 'صعودی' : 'نزولی'}</span><b class="num">${fmt(r.fib.start.price)} → ${fmt(r.fib.end.price)} (اصلاح ${(r.fib.retrace * 100).toFixed(0)}٪)</b>` : ''}
        ${r.fvg.length ? `<span>FVG باز</span><b class="num">${r.fvg.map((z) => `${z.dir > 0 ? '▲' : '▼'}${fmt(z.lo)}–${fmt(z.hi)}`).join(' ، ')}</b>` : ''}
        ${r.obs.length ? `<span>Order Block فعال</span><b class="num">${r.obs.map((z) => `${z.dir > 0 ? '▲' : '▼'}${fmt(z.lo)}–${fmt(z.hi)}`).join(' ، ')}</b>` : ''}
        ${recent.length ? `<span>الگوهای اخیر</span><b>${recent.map((p) => esc(p.fa)).join('، ')}</b>` : ''}
      </div>`;
  }

  async function runMTF(seq) {
    if (state.csv || !state.res) { $('mtf').innerHTML = ''; return; }
    const tfs = MA.timeframes, idx = tfs.findIndex((t) => t.id === state.tf);
    const want = [idx - 1, idx, idx + 1, idx + 2].filter((i) => i >= 0 && i < tfs.length);
    $('mtf').innerHTML = '<h4>هم‌راستایی تایم‌فریم‌ها</h4><p class="muted small">در حال دریافت…</p>';
    const rows = [];
    for (const i of want) {
      const tf = tfs[i], rel = i - idx;
      try {
        let cs = i === idx ? state.candles : (await D.fetchCandles(state.item, tf.id, state.used === 'demo' ? 'demo' : state.used, state.keys)).candles;
        const res = A.evaluate(A.buildContext(cs), cs.length - 1);
        rows.push({ tf: tf.id, rel, res });
      } catch (e) { rows.push({ tf: tf.id, rel, res: null, err: e.message }); }
      if (seq !== state.seq) return;
    }
    state.mtf = { rows };
    renderMTF(); redecide();
  }

  function renderMTF() {
    if (!state.mtf) return;
    const rows = state.mtf.rows, W = { '-1': 0.5, 0: 1, 1: 1.5, 2: 2 };
    const ok = rows.filter((x) => x.res);
    const tot = ok.reduce((a, x) => a + (W[x.rel] || 1), 0);
    const agg = tot ? ok.reduce((a, x) => a + x.res.score * (W[x.rel] || 1), 0) / tot : 0;
    $('mtf').innerHTML = `<h4>هم‌راستایی تایم‌فریم‌ها <small>میانگین وزنی: <b class="num ${cls(agg / 100)}">${agg > 0 ? '+' : ''}${agg.toFixed(0)}</b></small></h4>
      <table><thead><tr><th>تایم‌فریم</th><th>وضعیت</th><th class="r">امتیاز</th><th>رژیم</th></tr></thead><tbody>
      ${rows.map((x) => x.res ? `<tr><td class="num"><b>${x.tf}</b>${x.rel === 0 ? ' ◂' : ''}</td><td class="${VERDICT[x.res.verdict][1]}">${VERDICT[x.res.verdict][0]}</td><td class="r num ${cls(x.res.score / 100)}">${x.res.score > 0 ? '+' : ''}${x.res.score.toFixed(0)}</td><td>${REGIME_FA[x.res.regime.kind]}</td></tr>`
        : `<tr><td class="num">${x.tf}</td><td colspan="3" class="muted small">${esc(x.err || 'ناموجود')}</td></tr>`).join('')}
      </tbody></table><p class="plan-note">قاعده‌ی طلایی: در جهت تایم‌فریم بالاتر معامله کنید؛ سیگنال خلاف آن اطمینان را کاهش می‌دهد.</p>`;
  }

  // ── Backtest ──────────────────────────────────────────────────────────────
  function btParams() {
    return { threshold: +($('btTh') ? $('btTh').value : store.get('btTh', 35)), rr: +($('btRr') ? $('btRr').value : store.get('btRr', 2.5)), feeBps: +($('btFee') ? $('btFee').value : store.get('btFee', 5)), maxBars: 60 };
  }
  function runBacktest() {
    const p = btParams();
    store.set('btTh', p.threshold); store.set('btRr', p.rr); store.set('btFee', p.feeBps);
    setTimeout(() => {
      state.bt = MA.backtest(state.candles, { ...p, ctx: state.ctx });
      renderBacktest(); if (state.ov.bt) drawAnnotations();
    }, 30);
  }
  function renderBacktest() {
    const bt = state.bt, p = btParams();
    const ctl = `<div class="bt-ctl">
      <label>آستانه‌ی امتیاز<input id="btTh" type="number" min="10" max="90" value="${p.threshold}"></label>
      <label>R:R هدف<input id="btRr" type="number" min="1" max="6" step="0.5" value="${p.rr}"></label>
      <label>کارمزد (bps/سمت)<input id="btFee" type="number" min="0" step="1" value="${p.feeBps}"></label>
      <button class="btn primary" id="btRun">اجرا</button></div>`;
    if (!bt) { $('backtest').innerHTML = `<h4>بک‌تست روی همین داده</h4>${ctl}<p class="muted small">در حال محاسبه…</p>`; $('btRun').onclick = runBacktest; return; }
    const s = bt.stats;
    let note;
    if (s.n < 30) note = `فقط ${s.n} معامله — نمونه برای نتیجه‌گیری کم است.`;
    else if (s.avgR > 0.1 && s.winRate > s.breakEvenWinRate) note = 'روی این بازه امید ریاضی مثبت بوده؛ اما قبل از اتکا روی چند نماد/تایم‌فریم دیگر هم تست کنید (بیش‌برازش).';
    else if (s.avgR > 0) note = 'امید ریاضی به‌زحمت مثبت است؛ لبه‌ی معناداری ثابت نشده.';
    else note = 'روی این بازه امید ریاضی منفی یا صفر بوده؛ به‌تنهایی به سیگنال تکیه نکنید.';
    const w = 300, h = 90, cv = s.curve;
    let svg = '';
    if (cv.length > 1) {
      const ys = cv.map((c) => c.v).concat(0), lo = Math.min(...ys), hi = Math.max(...ys), sy = (v) => h - 8 - ((v - lo) / (hi - lo || 1)) * (h - 16);
      svg = `<svg class="eq" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><line x1="0" x2="${w}" y1="${sy(0)}" y2="${sy(0)}" stroke="var(--line)" stroke-dasharray="3"/><polyline fill="none" stroke="${s.totalR >= 0 ? 'var(--up)' : 'var(--down)'}" stroke-width="2" vector-effect="non-scaling-stroke" points="${cv.map((c, i) => `${(i / (cv.length - 1)) * w},${sy(c.v)}`).join(' ')}"/></svg>`;
    }
    $('backtest').innerHTML = `<h4>بک‌تست روی همین داده <small>${state.candles.length} کندل</small></h4>${ctl}
      <div class="stats">
        <div class="stat"><small>تعداد معاملات</small><b class="num">${s.n}</b></div>
        <div class="stat"><small>نرخ برد (سر‌به‌سر ${(s.breakEvenWinRate * 100).toFixed(0)}٪)</small><b class="num ${s.winRate > s.breakEvenWinRate ? 'up' : 'down'}">${(s.winRate * 100).toFixed(0)}٪</b></div>
        <div class="stat"><small>میانگین R / معامله</small><b class="num ${s.avgR > 0 ? 'up' : 'down'}">${s.avgR.toFixed(2)}</b></div>
        <div class="stat"><small>Profit Factor</small><b class="num">${Number.isFinite(s.profitFactor) ? s.profitFactor.toFixed(2) : '∞'}</b></div>
        <div class="stat"><small>مجموع R</small><b class="num ${s.totalR > 0 ? 'up' : 'down'}">${s.totalR.toFixed(1)}</b></div>
        <div class="stat"><small>حداکثر افت (R)</small><b class="num down">−${s.maxDD.toFixed(1)}</b></div>
      </div>${svg}
      <p class="plan-note">${note} ورود روی باز شدن کندل بعد، کارمزد لحاظ شده، در صورت لمس هم‌زمان حد ضرر و هدف، ضرر فرض می‌شود. خرید‌ونگهداری همین بازه: <span class="num">${s.buyHold.toFixed(1)}%</span>.</p>`;
    $('btRun').onclick = runBacktest;
  }

  // ── Watchlist & alerts ────────────────────────────────────────────────────
  const ACTION_FA = { ENTER: 'ورود الان', PULLBACK: 'منتظر پولبک', WAIT: 'صبر', WATCH: 'ضعیف', AVOID: 'نخر', EXIT: 'خروج', INVALID: 'باطل' };
  let audio = null;
  function beep() {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator(), g = audio.createGain();
      o.connect(g); g.connect(audio.destination); o.frequency.value = 880; g.gain.value = 0.08; o.start(); o.stop(audio.currentTime + 0.25);
    } catch { /* audio unavailable */ }
  }
  function notify(text) {
    beep();
    try { if ('Notification' in window && Notification.permission === 'granted') new Notification('تحلیلگر بازار', { body: text }); } catch { /* ignore */ }
    const t = document.title; document.title = '🔔 ' + text; setTimeout(() => (document.title = t), 8000);
  }
  const keyOf = (d) => (d ? d.key + (d.side || '') : null);
  function checkAlert() {
    const k = keyOf(state.dec), id = `${state.item.id}|${state.tf}|${state.mode}`;
    if (state.prevKey && state.prevKey.id === id && state.prevKey.k !== k && ['ENTER', 'PULLBACK', 'EXIT'].includes(state.dec.key))
      notify(`${state.item.name} ${state.tf}: ${state.dec.title}`);
    state.prevKey = { id, k };
  }

  let wlBusy = false;
  async function scanWatch() {
    if (wlBusy) return; wlBusy = true;
    try {
      for (const sym of state.wl) {
        const item = MA.makeItem('crypto', sym), id = `${sym}|${state.tf}|${state.mode}`;
        try {
          const { candles, source } = await D.fetchCandles(item, state.tf, state.source === 'demo' ? 'demo' : 'auto', state.keys);
          const ctx = A.buildContext(candles);
          const i = source === 'demo' ? candles.length - 1 : MA.lastClosed(candles, MA.tfOf(state.tf).sec);
          const res = A.evaluate(ctx, i);
          const dec = res && MA.decide({ res, ctx, candles, mode: state.mode });
          const prev = state.wlData[id];
          state.wlData[id] = { dec, price: candles[candles.length - 1].c };
          if (prev && dec && keyOf(prev.dec) !== keyOf(dec) && ['ENTER', 'PULLBACK', 'EXIT'].includes(dec.key)) notify(`${sym} ${state.tf}: ${dec.title}`);
        } catch (e) { state.wlData[id] = { err: e.message }; }
        renderWatch();
      }
    } finally { wlBusy = false; }
  }
  function renderWatch() {
    const rows = state.wl.map((sym) => {
      const x = state.wlData[`${sym}|${state.tf}|${state.mode}`];
      const d = x && x.dec, tone = d ? d.tone : 'muted';
      const label = !x ? '…' : x.err ? '—' : d ? ACTION_FA[d.key] + (d.side ? ' ' + { BUY: 'خرید', LONG: 'لانگ', SHORT: 'شورت' }[d.side] : '') : '—';
      return `<div class="wl-row" data-s="${esc(sym)}"><b>${esc(sym)}</b><span class="num muted">${x && x.price ? fmt(x.price) : ''}</span><span class="pill ${tone}">${label}${d ? ` · ${d.score > 0 ? '+' : ''}${d.score.toFixed(0)}` : ''}</span><button class="x" data-x="${esc(sym)}" title="حذف">×</button></div>`;
    }).join('');
    $('watch').innerHTML = `<h4>دیده‌بان ارزها <small>${state.tf} · هر ۶۰ ثانیه · ${state.mode === 'spot' ? 'اسپات' : 'فیوچرز'}</small></h4>${rows || '<p class="muted small">ارزی اضافه نشده.</p>'}
      <div class="wl-add"><input id="wlIn" type="text" placeholder="افزودن ارز: DOGE" maxlength="12"><button class="btn" id="wlAdd">افزودن</button><button class="btn" id="wlNotif" title="فعال‌سازی اعلان مرورگر">🔔</button></div>
      <p class="small">با تغییر سیگنال به «ورود/پولبک/خروج» اعلان صوتی و مرورگر می‌آید. صفحه باید باز بماند.</p>`;
    $('watch').onclick = (e) => {
      const x = e.target.dataset.x, row = e.target.closest('.wl-row');
      if (x) { state.wl = state.wl.filter((y) => y !== x); store.set('wl', state.wl); renderWatch(); return; }
      if (row) { state.custom = MA.makeItem('crypto', row.dataset.s); state.group = 'crypto'; store.set('custom', state.custom); store.set('group', 'crypto'); state.csv = null; buildHeader(); load(); }
    };
    const add = () => {
      const v = $('wlIn').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/(USDT)$/, '');
      if (v && !state.wl.includes(v)) { state.wl.push(v); store.set('wl', state.wl); scanWatch(); }
      renderWatch();
    };
    $('wlAdd').onclick = add; $('wlIn').onkeydown = (e) => e.key === 'Enter' && add();
    $('wlNotif').onclick = () => { try { Notification.requestPermission().then(() => notify('اعلان‌ها فعال شد')); } catch { beep(); } };
  }

  // ── Settings / CSV ────────────────────────────────────────────────────────
  function openSettings() {
    $('setSource').innerHTML = Object.entries(MA.providerNames).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
    $('setSource').value = state.source; $('setTd').value = state.keys.td; $('setProxy').value = state.keys.proxy;
    $('dlg').showModal();
  }
  $('btnSettings').onclick = openSettings;
  $('setSave').onclick = () => {
    state.source = $('setSource').value; state.keys.td = $('setTd').value.trim(); state.keys.proxy = $('setProxy').value.trim().replace(/\/$/, '');
    store.set('source', state.source); store.set('td', state.keys.td); store.set('proxy', state.keys.proxy);
    load();
  };
  $('btnRefresh').onclick = () => load();
  $('btnCsv').onclick = () => $('csvFile').click();
  $('csvFile').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const candles = D.parseCSV(await f.text());
      state.csv = { candles, item: { id: 'CSV', name: f.name.replace(/\.\w+$/, ''), group: 'forex' } };
      load();
    } catch (err) { showMsg(`<b>خطا در خواندن CSV:</b> ${esc(err.message)}`); }
    e.target.value = '';
  };

  buildHeader(); buildOverlayToggles(); load(); renderWatch(); scanWatch(); setInterval(scanWatch, 60000);
  window.MAApp = { state, load };
})();
