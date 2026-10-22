/* Turns an analysis result into a concrete instruction: enter now / wait for a pullback /
   stay out / exit — for spot (long-only) or futures (long & short). The signal itself is read from
   the last CLOSED candle (no repainting); the live price only decides whether the entry is still valid. */
(function (root) {
  const MA = (root.MA = root.MA || {});
  const fmt = (x) => MA.analysis.fmt(x);
  const RR = [1.5, 2.5, 4];

  function buildTargets(entry, stop, dir) {
    const risk = Math.abs(entry - stop);
    return { risk, targets: RR.map((rr) => ({ rr, price: entry + dir * risk * rr })) };
  }

  function topReasons(res, dir, k = 4) {
    return res.factors
      .filter((f) => Math.sign(f.score) === dir && Math.abs(f.score) > 0.3)
      .sort((a, b) => Math.abs(b.score * b.weight) - Math.abs(a.score * a.weight))
      .slice(0, k).map((f) => `${f.name}: ${f.text}`);
  }

  function decide({ res, ctx, candles, mode = 'futures', align = 0 }) {
    const n = candles.length, live = candles[n - 1].c, atr = res.atr, dir = res.dir;
    const spot = mode === 'spot';
    const conf = Math.max(0, Math.min(100, res.confidence + (align > 0 ? 8 : align < 0 ? -15 : 0)));
    const ema20 = ctx.ema20[n - 1], stLine = ctx.st.line[n - 1];
    const d = { mode, live, conf, score: res.score, signalBars: n - 1 - res.i, key: 'WAIT', reasons: [], exits: [], entry: null, stop: null, targets: [], lev: null };
    const set = (key, tone, title, sub) => Object.assign(d, { key, tone, title, sub });

    // Neutral: nothing to do, but say what would change it.
    if (!dir) {
      set('WAIT', 'muted', 'منتظر بمان', 'سیگنال واضحی وجود ندارد؛ ورود در بازار بدون لبه = قمار.');
      const t = [];
      if (res.res) t.push(`بسته‌شدن کندل بالای ${fmt(res.res.price)} → سناریوی ${spot ? 'خرید' : 'لانگ'} فعال می‌شود`);
      if (res.sup && !spot) t.push(`بسته‌شدن کندل زیر ${fmt(res.sup.price)} → سناریوی شورت فعال می‌شود`);
      if (res.sup && spot) t.push(`بسته‌شدن زیر ${fmt(res.sup.price)} → اگر دارید خارج شوید`);
      d.exits = t; return d;
    }

    // Spot cannot short: a bearish signal means "don't buy / sell what you hold".
    if (spot && dir < 0) {
      const strong = res.verdict === 'strong-sell';
      set(strong ? 'EXIT' : 'AVOID', 'down', strong ? 'اسپات: بفروش / خارج شو' : 'اسپات: نخر — اگر داری کاهش بده',
        'روند و مومنتوم نزولی است؛ خرید اسپات الان خلاف جهت بازار است.');
      d.reasons = topReasons(res, -1);
      d.exits = [`بازگشت صعودی وقتی معتبر است که کندل بالای ${fmt(res.res ? res.res.price : ctx.ema50[n - 1])} ببندد و سوپرترند صعودی شود`];
      return d;
    }

    d.side = dir > 0 ? (spot ? 'BUY' : 'LONG') : 'SHORT';
    d.reasons = topReasons(res, dir);
    const word = dir > 0 ? (spot ? 'خرید' : 'لانگ') : 'شورت';

    if (conf < 50 || align < 0) {
      set('WATCH', 'warn', `ستاپ ${word} ضعیف است — وارد نشو`,
        align < 0 ? 'خلاف جهت تایم‌فریم‌های بالاتر است؛ احتمال شکست بالاست.' : `اطمینان فقط ${conf}٪ است (حداقل ۵۰٪).`);
      return d;
    }
    const p = res.plan, stop = p.stop;
    if (dir * (live - stop) <= 0) {
      set('INVALID', 'muted', 'سیگنال باطل شد', 'قیمت از حد ضرر عبور کرده است؛ منتظر ستاپ جدید باش.');
      return d;
    }
    const drift = (dir * (live - p.entry)) / atr, ext = Number.isFinite(ema20) ? (dir * (live - ema20)) / atr : 0;
    const liveRisk = Math.abs(live - stop);
    d.stop = stop;

    if (drift > 0.75 || ext > 2.2 || liveRisk > 3.2 * atr) {
      let limit = p.pullback != null ? p.pullback : p.entry - dir * 0.5 * atr;
      if (dir * (limit - stop) <= 0 || Math.abs(limit - stop) < 0.5 * atr) limit = stop + dir * atr;
      const t = buildTargets(limit, stop, dir);
      set('PULLBACK', 'warn', `منتظر پولبک بمان — ${word} در ${fmt(limit)}`,
        'قیمت از نقطه‌ی منطقی ورود فاصله گرفته؛ دنبال‌کردن آن نسبت ریسک به ریوارد را خراب می‌کند. سفارش Limit بگذار.');
      d.entry = { kind: 'limit', price: limit }; d.targets = t.targets; d.risk = t.risk;
    } else {
      const t = buildTargets(live, stop, dir);
      set('ENTER', dir > 0 ? 'up' : 'down', `${spot ? 'خرید اسپات' : dir > 0 ? 'ورود لانگ' : 'ورود شورت'} — الان`,
        `سیگنال از کندل بسته‌شده + قیمت هنوز نزدیک ناحیه‌ی ورود است${res.verdict.startsWith('strong') ? ' (سیگنال قوی)' : ''}.`);
      d.entry = { kind: 'market', price: live }; d.targets = t.targets; d.risk = t.risk;
    }
    d.riskPct = (d.risk / d.entry.price) * 100;
    if (!spot) d.lev = Math.max(1, Math.min(20, Math.floor(0.4 / (d.risk / d.entry.price))));

    const [t1, t2, t3] = d.targets;
    d.exits = [
      `حد ضرر ${fmt(stop)} — ${dir > 0 ? 'زیر' : 'بالای'} این ناحیه فرضیه باطل است`,
      `${fmt(t1.price)} (1.5R): ۵۰٪ ${spot ? 'بفروش' : 'ببند'} و حد ضرر را روی نقطه‌ی ورود ببر`,
      `${fmt(t2.price)} (2.5R): ۳۰٪ دیگر`,
      `${fmt(t3.price)} (4R) یا تریلینگ با سوپرترند${Number.isFinite(stLine) ? ` (${fmt(stLine)})` : ''}: ۲۰٪ باقی‌مانده`,
      `خروج زودهنگام: کندل بسته‌شده ${dir > 0 ? 'زیر' : 'بالای'} EMA20${Number.isFinite(ema20) ? ` (${fmt(ema20)})` : ''} همراه با برگشت سوپرترند`,
    ];
    return d;
  }

  MA.decide = decide;
  // Index of the last fully closed candle.
  MA.lastClosed = (candles, sec, now = Date.now() / 1000) => {
    const n = candles.length;
    return n >= 2 && candles[n - 1].t + sec > now ? n - 2 : n - 1;
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
