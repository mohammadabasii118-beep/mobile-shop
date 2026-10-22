/* Walk-forward backtest of the analysis engine.
   Signal is read at the CLOSE of bar i, the order is filled at the OPEN of bar i+1, stop/target are
   evaluated bar by bar (stop wins if both are touched in the same bar), fees are charged per side. */
(function (root) {
  const MA = (root.MA = root.MA || {});

  function backtest(cs, opts = {}) {
    const { threshold = 35, rr = 2.5, maxBars = 60, feeBps = 5, minConf = 0, warmup = 60, ctx: given } = opts;
    const ctx = given || MA.analysis.buildContext(cs);
    const n = cs.length, trades = [];
    let pending = null, pos = null;

    for (let i = warmup; i < n; i++) {
      const bar = cs[i];
      if (pending && !pos) {
        const entry = bar.o, risk = pending.risk;
        pos = { dir: pending.dir, entry, stop: entry - pending.dir * risk, tp: entry + pending.dir * risk * rr, risk, i0: i, t0: bar.t, score: pending.score };
        pending = null;
      }
      if (pos) {
        let exit = null, why = null;
        const hitStop = pos.dir > 0 ? bar.l <= pos.stop : bar.h >= pos.stop;
        const hitTp = pos.dir > 0 ? bar.h >= pos.tp : bar.l <= pos.tp;
        if (hitStop) { exit = pos.stop; why = 'SL'; }
        else if (hitTp) { exit = pos.tp; why = 'TP'; }
        else if (i - pos.i0 >= maxBars) { exit = bar.c; why = 'TIME'; }
        if (exit !== null) {
          const gross = (pos.dir * (exit - pos.entry)) / pos.risk;
          const cost = (2 * feeBps / 1e4 * pos.entry) / pos.risk;
          trades.push({ dir: pos.dir, entry: pos.entry, exit, why, r: gross - cost, t0: pos.t0, t1: bar.t, bars: i - pos.i0 + 1, score: pos.score });
          pos = null;
        }
        continue;
      }
      if (i < n - 1) {
        const ev = MA.analysis.evaluate(ctx, i);
        if (ev && ev.dir && Math.abs(ev.score) >= threshold && ev.confidence >= minConf && ev.plan) {
          pending = { dir: ev.dir, risk: ev.plan.risk, score: ev.score };
        }
      }
    }
    return { trades, stats: stats(trades, cs, warmup, rr), opts: { threshold, rr, maxBars, feeBps, minConf } };
  }

  function stats(trades, cs, warmup, rr) {
    const wins = trades.filter((t) => t.r > 0), losses = trades.filter((t) => t.r <= 0);
    const gw = wins.reduce((a, t) => a + t.r, 0), gl = Math.abs(losses.reduce((a, t) => a + t.r, 0));
    let eq = 0, peak = 0, dd = 0;
    const curve = trades.map((t) => { eq += t.r; peak = Math.max(peak, eq); dd = Math.max(dd, peak - eq); return { t: t.t1, v: eq }; });
    const n = trades.length;
    return {
      n, winRate: n ? wins.length / n : 0, breakEvenWinRate: 1 / (1 + rr),
      avgR: n ? eq / n : 0, totalR: eq, profitFactor: gl ? gw / gl : n ? Infinity : 0, maxDD: dd,
      longs: trades.filter((t) => t.dir > 0).length, shorts: trades.filter((t) => t.dir < 0).length,
      avgBars: n ? trades.reduce((a, t) => a + t.bars, 0) / n : 0, curve,
      buyHold: cs.length > warmup ? (cs[cs.length - 1].c / cs[warmup].c - 1) * 100 : 0,
    };
  }

  MA.backtest = backtest;
})(typeof globalThis !== 'undefined' ? globalThis : this);
