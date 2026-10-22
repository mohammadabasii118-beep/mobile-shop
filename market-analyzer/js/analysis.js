/* Multi-factor analysis engine.
   buildContext() computes every causal series once; evaluate(ctx, i) scores the market as it
   looked at the close of bar i using only data <= i, so the same code serves the live
   analysis (i = last bar) and the historical backtest. */
(function (root) {
  const MA = (root.MA = root.MA || {});
  const { ind, st } = MA;
  const clip = (x, a = -1, b = 1) => Math.max(a, Math.min(b, x));
  const sign = (x) => (x > 0 ? 1 : x < 0 ? -1 : 0);
  const ok = (...xs) => xs.every((x) => Number.isFinite(x));

  function fmt(x) {
    if (!Number.isFinite(x)) return '—';
    const a = Math.abs(x);
    return x.toFixed(a >= 1000 ? 2 : a >= 10 ? 3 : a >= 1 ? 4 : 6);
  }

  function buildContext(cs) {
    const o = cs.map((k) => k.o), h = cs.map((k) => k.h), l = cs.map((k) => k.l), c = cs.map((k) => k.c), v = cs.map((k) => k.v || 0);
    const hasVolume = v.filter((x) => x > 0).length > cs.length * 0.5;
    const obv = hasVolume ? ind.obv(c, v) : null;
    return {
      cs, o, h, l, c, v, hasVolume,
      ema20: ind.ema(c, 20), ema50: ind.ema(c, 50), ema200: ind.ema(c, 200),
      rsi: ind.rsi(c, 14), macd: ind.macd(c), bb: ind.bollinger(c), atr: ind.atr(h, l, c, 14),
      stoch: ind.stochastic(h, l, c), adx: ind.adx(h, l, c), ichi: ind.ichimoku(h, l, c),
      st: ind.supertrend(h, l, c), obv, obvEma: obv ? ind.ema(obv, 21) : null,
      mfi: hasVolume ? ind.mfi(h, l, c, v) : null, vwap: hasVolume ? ind.vwap(cs) : null,
      pivs: st.pivots(h, l, 5), pivsDiv: st.pivots(h, l, 3),
    };
  }

  function regimeAt(ctx, i) {
    const a = ctx.adx.adx[i];
    const kind = !Number.isFinite(a) ? 'unknown' : a >= 25 ? 'trending' : a < 20 ? 'ranging' : 'transition';
    const from = Math.max(0, i - 120), series = [];
    for (let j = from; j <= i; j++) if (Number.isFinite(ctx.atr[j])) series.push(ctx.atr[j] / ctx.c[j]);
    const cur = ctx.atr[i] / ctx.c[i];
    const volPct = series.length > 20 ? series.filter((x) => x <= cur).length / series.length : 0.5;
    const bwSeries = [];
    for (let j = from; j <= i; j++) if (Number.isFinite(ctx.bb.bw[j])) bwSeries.push(ctx.bb.bw[j]);
    const squeeze = bwSeries.length > 20 && ctx.bb.bw[i] <= Math.min(...bwSeries) * 1.15;
    return { kind, adx: a, volPct, squeeze };
  }

  function evaluate(ctx, i) {
    const { cs, c, atr } = ctx;
    const price = c[i], atrV = atr[i];
    if (i < 30 || !ok(atrV, price)) return null;

    const regime = regimeAt(ctx, i);
    const trending = regime.kind === 'trending', ranging = regime.kind === 'ranging';
    const tW = trending ? 1.3 : ranging ? 0.6 : 1;
    const rW = ranging ? 1.4 : trending ? 0.5 : 1;

    const levels = st.supportResistance(ctx.pivs, i, price, atrV);
    const sup = levels.filter((x) => x.type === 'S').pop() || null;
    const res = levels.filter((x) => x.type === 'R')[0] || null;
    const ms = st.marketStructure(ctx.pivs, i, c);
    const fib = st.fibonacci(ctx.pivs, i, price);
    const div = st.divergence(ctx.pivsDiv, i, c, ctx.rsi);
    const fvg = st.fairValueGaps(cs, i, atrV);
    const obs = st.orderBlocks(cs, i, atr);
    const sweep = st.liquiditySweep(cs, ctx.pivs, i);
    const vp = ctx.hasVolume ? st.volumeProfile(cs, i) : null;
    const patterns = [0, 1, 2].flatMap((b) => st.detectPatterns(cs, atr, i - b).map((p) => ({ ...p, age: b })));

    const factors = [];
    const add = (group, name, score, weight, text) => {
      if (Number.isFinite(score)) factors.push({ group, name, score: clip(score), weight, text });
    };
    const arrow = (s) => (s > 0.15 ? 'صعودی' : s < -0.15 ? 'نزولی' : 'خنثی');

    // ── Trend ────────────────────────────────────────────────────────────────
    {
      const e20 = ctx.ema20[i], e50 = ctx.ema50[i], e200 = ctx.ema200[i];
      const pts = [];
      if (ok(e20)) pts.push(sign(price - e20));
      if (ok(e20, e50)) pts.push(sign(e20 - e50));
      if (ok(e50, e200)) pts.push(sign(e50 - e200));
      if (pts.length) {
        const s = pts.reduce((a, b) => a + b, 0) / pts.length;
        add('trend', 'میانگین‌های متحرک (EMA 20/50/200)', s, 2 * tW,
          `قیمت ${price > e20 ? 'بالای' : 'پایین'} EMA20؛ ${ok(e200) ? `قیمت ${price > e200 ? 'بالای' : 'پایین'} EMA200 (${fmt(e200)})` : 'EMA200 هنوز محاسبه نشده'} → ساختار ${arrow(s)}`);
      }
    }
    if (ok(ctx.st.dir[i])) add('trend', 'سوپرترند (10,3)', ctx.st.dir[i], 1.5 * tW, `سوپرترند ${ctx.st.dir[i] > 0 ? 'صعودی' : 'نزولی'} است (خط ${fmt(ctx.st.line[i])})`);
    {
      const { tenkan, kijun, spanA, spanB } = ctx.ichi;
      if (ok(spanA[i], spanB[i], tenkan[i], kijun[i])) {
        const top = Math.max(spanA[i], spanB[i]), bot = Math.min(spanA[i], spanB[i]);
        const pos = price > top ? 1 : price < bot ? -1 : 0;
        const tk = sign(tenkan[i] - kijun[i]);
        add('trend', 'ایچیموکو', 0.6 * pos + 0.4 * tk, 1.5 * tW,
          `قیمت ${pos > 0 ? 'بالای ابر' : pos < 0 ? 'زیر ابر' : 'داخل ابر (بلاتکلیف)'}؛ تنکان ${tk > 0 ? 'بالای' : 'زیر'} کیجون`);
      }
    }
    {
      const a = ctx.adx.adx[i], pdi = ctx.adx.pdi[i], mdi = ctx.adx.mdi[i];
      if (ok(a, pdi, mdi)) add('trend', 'ADX / DI', sign(pdi - mdi) * Math.min(a / 40, 1), 1.5,
        `ADX=${a.toFixed(1)} (${trending ? 'روند قوی' : ranging ? 'بازار رنج' : 'روند ضعیف/در حال شکل‌گیری'})؛ +DI=${pdi.toFixed(1)} / −DI=${mdi.toFixed(1)}`);
    }
    if (ms.trend !== 'unknown') {
      let s = ms.trend === 'up' ? 0.6 : ms.trend === 'down' ? -0.6 : 0;
      const tag = { 'bull-bos': 'شکست ساختار صعودی (BOS)', 'bull-choch': 'تغییر ماهیت به صعودی (CHoCH)', 'bear-bos': 'شکست ساختار نزولی (BOS)', 'bear-choch': 'تغییر ماهیت به نزولی (CHoCH)' }[ms.bos];
      if (ms.bos) s += ms.bos.startsWith('bull') ? (ms.bos.endsWith('choch') ? 0.5 : 0.35) : (ms.bos.endsWith('choch') ? -0.5 : -0.35);
      add('structure', 'ساختار بازار (HH/HL/LH/LL)', s, 2,
        `${ms.trend === 'up' ? 'سقف و کف‌های بالاتر (HH/HL)' : ms.trend === 'down' ? 'سقف و کف‌های پایین‌تر (LH/LL)' : 'ساختار رنج/مبهم'}${tag ? ' + ' + tag : ''}`);
    }

    // ── Momentum ─────────────────────────────────────────────────────────────
    {
      const r = ctx.rsi[i];
      if (ok(r)) {
        let mom = clip((r - 50) / 20);
        if (r > 80) mom = 0.3; else if (r < 20) mom = -0.3; // exhaustion: don't chase
        const rev = r < 35 ? (35 - r) / 15 : r > 65 ? -(r - 65) / 15 : 0;
        const wt = trending ? 0.85 : ranging ? 0.15 : 0.5;
        add('momentum', 'RSI (14)', wt * mom + (1 - wt) * clip(rev), 1.5,
          `RSI=${r.toFixed(1)} ${r > 70 ? '(اشباع خرید)' : r < 30 ? '(اشباع فروش)' : ''} — در بازار ${trending ? 'روندی، مومنتوم ملاک است' : ranging ? 'رنج، برگشت به میانگین ملاک است' : 'انتقالی، ترکیبی'}`);
      }
    }
    {
      const { line, hist } = ctx.macd;
      if (ok(hist[i], hist[i - 1], line[i])) {
        const s = 0.4 * sign(hist[i]) + 0.3 * sign(hist[i] - hist[i - 1]) + 0.3 * sign(line[i]);
        add('momentum', 'MACD (12,26,9)', s, 1.5 * tW,
          `هیستوگرام ${hist[i] > 0 ? 'مثبت' : 'منفی'} و ${hist[i] > hist[i - 1] ? 'در حال تقویت' : 'در حال تضعیف'}؛ خط MACD ${line[i] > 0 ? 'بالای' : 'زیر'} صفر`);
      }
    }
    {
      const k = ctx.stoch.k[i], d = ctx.stoch.d[i];
      if (ok(k, d)) {
        let s = 0.2 * sign(k - d);
        if (k < 20) s = k > d ? 1 : 0.4; else if (k > 80) s = k < d ? -1 : -0.4;
        add('momentum', 'استوکاستیک', s, 1 * rW, `%K=${k.toFixed(1)} / %D=${d.toFixed(1)}${k < 20 ? ' (ناحیه اشباع فروش)' : k > 80 ? ' (ناحیه اشباع خرید)' : ''}`);
      }
    }
    {
      const pb = ctx.bb.pb[i];
      if (ok(pb)) {
        let s;
        if (ranging) s = pb < 0.05 ? 0.8 : pb > 0.95 ? -0.8 : -(pb - 0.5) * 0.8;
        else s = pb > 1 ? 0.5 : pb < 0 ? -0.5 : (pb - 0.5) * 0.6;
        add('volatility', 'باندهای بولینگر', s, 1.2,
          `%B=${pb.toFixed(2)}${regime.squeeze ? ' — فشردگی (Squeeze): انتظار حرکت انفجاری، جهت نامشخص' : ''}`);
      }
    }

    // ── Volume ───────────────────────────────────────────────────────────────
    if (ctx.hasVolume) {
      if (ok(ctx.obv[i], ctx.obvEma[i])) add('volume', 'OBV', ctx.obv[i] > ctx.obvEma[i] ? 0.7 : -0.7, 1,
        `OBV ${ctx.obv[i] > ctx.obvEma[i] ? 'بالای' : 'زیر'} میانگین خود — جریان حجم ${ctx.obv[i] > ctx.obvEma[i] ? 'خرید' : 'فروش'}`);
      const m = ctx.mfi[i];
      if (ok(m)) add('volume', 'MFI (جریان پول)', m < 20 ? 1 : m > 80 ? -1 : (m - 50) / 100, 0.8, `MFI=${m.toFixed(1)}`);
      const parts = [];
      if (ok(ctx.vwap[i])) parts.push(sign(price - ctx.vwap[i]) * 0.5);
      if (vp) parts.push(price > vp.vah ? 0.5 : price < vp.val ? -0.5 : sign(price - vp.poc) * 0.2);
      if (parts.length) add('volume', 'VWAP / پروفایل حجم', parts.reduce((a, b) => a + b, 0), 1,
        `${ok(ctx.vwap[i]) ? `VWAP=${fmt(ctx.vwap[i])}` : ''}${vp ? ` · POC=${fmt(vp.poc)} · ناحیه ارزش ${fmt(vp.val)}–${fmt(vp.vah)}` : ''}`);
    }

    // ── Levels & structure ───────────────────────────────────────────────────
    {
      const dS = sup ? (price - sup.price) / atrV : Infinity, dR = res ? (res.price - price) / atrV : Infinity;
      let s = 0, t = 'قیمت در فاصله‌ی خنثی از سطوح مهم است';
      if (dS < 0.8 && (!res || dS <= dR)) { s = 0.3 + 0.5 * Math.min(sup.strength / 4, 1); t = `نزدیک حمایت ${fmt(sup.price)} (${sup.touches} برخورد)`; }
      else if (dR < 0.8) { s = -(0.3 + 0.5 * Math.min(res.strength / 4, 1)); t = `نزدیک مقاومت ${fmt(res.price)} (${res.touches} برخورد)`; }
      else if (sup && res) { s = clip((dR - dS) / (dR + dS)) * 0.3; t = `حمایت ${fmt(sup.price)} (${dS.toFixed(1)} ATR پایین‌تر) / مقاومت ${fmt(res.price)} (${dR.toFixed(1)} ATR بالاتر)`; }
      if (sup || res) add('structure', 'حمایت و مقاومت', s, 2, t);
    }
    if (fib) {
      const r = fib.retrace;
      let s = null, t = '';
      if (fib.dir === 'up') {
        if (r >= 0.382 && r <= 0.65) { s = 0.6; t = 'پولبک به ناحیه طلایی فیبوناچی (۳۸.۲–۶۱.۸٪) در موج صعودی'; }
        else if (r >= 0 && r < 0.236) { s = 0.3; t = 'اصلاح بسیار کم؛ ادامه‌ی موج صعودی'; }
        else if (r > 0.786) { s = -0.4; t = 'اصلاح عمیق‌تر از ۷۸.۶٪؛ موج صعودی در خطر شکست'; }
      } else {
        if (r >= 0.382 && r <= 0.65) { s = -0.6; t = 'پولبک به ناحیه طلایی فیبوناچی در موج نزولی'; }
        else if (r >= 0 && r < 0.236) { s = -0.3; t = 'اصلاح بسیار کم؛ ادامه‌ی موج نزولی'; }
        else if (r > 0.786) { s = 0.4; t = 'اصلاح عمیق‌تر از ۷۸.۶٪؛ موج نزولی در خطر شکست'; }
      }
      if (s !== null) add('structure', 'فیبوناچی', s, 1, t);
    }
    {
      let s = 0; const notes = [];
      for (const z of fvg) if (price >= z.lo && price <= z.hi) { s += 0.5 * z.dir; notes.push(`داخل FVG ${z.dir > 0 ? 'صعودی' : 'نزولی'}`); }
      for (const z of obs) if (cs[i].l <= z.hi && cs[i].h >= z.lo) { s += 0.5 * z.dir; notes.push(`تست Order Block ${z.dir > 0 ? 'صعودی' : 'نزولی'}`); }
      if (notes.length) add('smc', 'اسمارت‌مانی (FVG / Order Block)', s, 1.2, notes.join('، '));
    }
    if (sweep) add('smc', 'جمع‌آوری نقدینگی (Liquidity Sweep)', sweep.dir * 0.8 * (1 - 0.2 * (i - sweep.i)), 1.2,
      `${sweep.dir > 0 ? 'شکار استاپ زیر کف' : 'شکار استاپ بالای سقف'} ${fmt(sweep.level)} و بازگشت به داخل محدوده`);

    // ── Patterns & divergence ────────────────────────────────────────────────
    {
      const dirPats = patterns.filter((p) => p.dir !== 0);
      if (dirPats.length) {
        let s = dirPats.reduce((a, p) => a + p.dir * p.strength * [1, 0.6, 0.35][p.age], 0);
        const nearSup = sup && (price - sup.price) / atrV < 1, nearRes = res && (res.price - price) / atrV < 1;
        if ((s > 0 && nearSup) || (s < 0 && nearRes)) s *= 1.3;
        add('patterns', 'الگوهای کندلی', s, 1.5, dirPats.map((p) => p.fa + (p.age ? ` (${p.age} کندل قبل)` : '')).join('، '));
      }
    }
    if (div.type) add('momentum', 'واگرایی RSI', div.type === 'bull' ? 0.9 : -0.9, 1.5,
      div.type === 'bull' ? 'واگرایی صعودی: کف پایین‌تر در قیمت، کف بالاتر در RSI' : 'واگرایی نزولی: سقف بالاتر در قیمت، سقف پایین‌تر در RSI');

    // ── Aggregate ────────────────────────────────────────────────────────────
    const W = factors.reduce((a, f) => a + f.weight, 0);
    const score = W ? (factors.reduce((a, f) => a + f.score * f.weight, 0) / W) * 100 : 0;
    const active = factors.filter((f) => Math.abs(f.score) > 0.15);
    const aw = active.reduce((a, f) => a + f.weight, 0);
    const agree = aw ? active.filter((f) => sign(f.score) === sign(score)).reduce((a, f) => a + f.weight, 0) / aw : 0;
    const confidence = Math.round(100 * (0.6 * agree + 0.4 * Math.min(Math.abs(score), 70) / 70));
    const verdict = score >= 55 ? 'strong-buy' : score >= 25 ? 'buy' : score <= -55 ? 'strong-sell' : score <= -25 ? 'sell' : 'neutral';
    const dir = verdict.includes('buy') ? 1 : verdict.includes('sell') ? -1 : 0;

    const groups = {};
    for (const f of factors) {
      const g = (groups[f.group] = groups[f.group] || { w: 0, s: 0 });
      g.w += f.weight; g.s += f.score * f.weight;
    }
    for (const g of Object.values(groups)) g.score = (g.s / g.w) * 100;

    const plan = dir ? tradePlan(ctx, i, dir, { levels, sup, res, ms, atrV, price }) : null;

    const warnings = [];
    const r = ctx.rsi[i];
    if (dir > 0 && r > 75) warnings.push('RSI در اشباع خرید است؛ ورود تعقیبی ریسک بالایی دارد.');
    if (dir < 0 && r < 25) warnings.push('RSI در اشباع فروش است؛ ریسک برگشت کوتاه‌مدت بالاست.');
    if (ranging && dir) warnings.push('ADX پایین است (بازار رنج): سیگنال‌های روندی قابل اتکا نیستند، معامله در لبه‌ی رنج بهتر است.');
    if (regime.squeeze) warnings.push('بولینگر فشرده است؛ شکست جعلی محتمل است، منتظر تأیید کندل بسته‌شده باشید.');
    if (regime.volPct > 0.9) warnings.push('نوسان در بالاترین ۱۰٪ اخیر است؛ حجم معامله را کم کنید.');
    if (plan && plan.blocked) warnings.push(`سطح ${plan.blocked.type === 'R' ? 'مقاومت' : 'حمایت'} ${fmt(plan.blocked.price)} پیش از TP1 قرار دارد؛ نسبت ریسک به ریوارد واقعی ضعیف‌تر است.`);
    if (!ctx.hasVolume) warnings.push('داده‌ی حجم این بازار/منبع موجود نیست؛ فاکتورهای حجمی محاسبه نشدند.');

    return {
      i, t: cs[i].t, price, atr: atrV, regime, score, confidence, verdict, dir, factors, groups, plan, warnings,
      levels, sup, res, ms, fib, div, fvg, obs, sweep, vp, patterns,
    };
  }

  function tradePlan(ctx, i, dir, { levels, sup, res, ms, atrV, price }) {
    // Stop: just beyond the nearest structure on the losing side, clamped to 1–3 ATR.
    const against = dir > 0 ? levels.filter((x) => x.price < price).pop() : levels.filter((x) => x.price > price)[0];
    const lastSwing = dir > 0 ? ms.lastLow : ms.lastHigh;
    const refs = [against && against.price, lastSwing && lastSwing.price].filter((x) => Number.isFinite(x) && (dir > 0 ? x < price : x > price));
    let stop, basis = 'atr';
    if (refs.length) {
      const ref = dir > 0 ? Math.max(...refs) : Math.min(...refs); // closest structure
      const risk = Math.abs(price - ref) + 0.25 * atrV;
      if (risk >= atrV && risk <= 3 * atrV) { stop = price - dir * risk; basis = 'structure'; }
    }
    if (stop === undefined) stop = price - dir * 1.5 * atrV;
    const risk = Math.abs(price - stop);
    const targets = [1.5, 2.5, 4].map((rr) => ({ rr, price: price + dir * risk * rr }));
    const wall = dir > 0 ? res : sup;
    const blocked = wall && Math.abs(wall.price - price) < risk * 1.5 && wall.strength >= 2.5 ? wall : null;
    const e20 = ctx.ema20[i];
    const pullback = Number.isFinite(e20) && dir * (price - e20) > 0 && Math.abs(price - e20) <= 2 * atrV ? e20 : null;
    return { dir, entry: price, stop, risk, basis, targets, blocked, pullback, riskPct: (risk / price) * 100 };
  }

  MA.analysis = { buildContext, evaluate, tradePlan, fmt };
})(typeof globalThis !== 'undefined' ? globalThis : this);
