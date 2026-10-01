/* Dependency-free SVG charts. Real data only: callers pass an empty-state instead when there is nothing to plot. */
import { faDigits, moneyShort } from './ui.js';
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, text) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text != null) e.textContent = text; return e; };
const H = 230, P = { t: 12, r: 12, b: 28, l: 52 };
/** Charts are drawn at the real container width (1 viewBox unit = 1 CSS px) so text stays readable on phones. */
function responsive(draw) {
  const box = document.createElement('div');
  box.style.width = '100%';
  let last = 0;
  const paint = (w) => { if (Math.abs(w - last) < 2 || w < 80) return; last = w; box.replaceChildren(draw(Math.round(w))); };
  new ResizeObserver((e) => paint(e[0].contentRect.width)).observe(box);
  return box;
}
const ticks = (max) => { const step = Math.pow(10, Math.floor(Math.log10(max || 1))); const nice = [1, 2, 2.5, 5, 10].map((m) => m * step).find((s) => max / s <= 4) || step * 10; return Array.from({ length: Math.floor(max / nice) + 2 }, (_, i) => i * nice).filter((v) => v <= max + nice).slice(0, 6); };
const dayLabel = (d) => faDigits(new Intl.DateTimeFormat('fa-IR-u-nu-latn', { month: 'short', day: 'numeric', timeZone: 'Asia/Tehran' }).format(new Date(d + 'T12:00:00Z')));

function frame(series, fmt, W) {
  const max = Math.max(...series.map((s) => s.v), 1);
  const t = ticks(max), top = t.at(-1) || max;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'chart', role: 'img' });
  const x = (i) => P.l + (series.length === 1 ? (W - P.l - P.r) / 2 : (i * (W - P.l - P.r)) / (series.length - 1));
  const y = (v) => P.t + (H - P.t - P.b) * (1 - v / top);
  for (const v of t) { svg.append(el('line', { x1: P.l, x2: W - P.r, y1: y(v), y2: y(v), class: 'grid' }), el('text', { x: P.l - 8, y: y(v) + 4, 'text-anchor': 'end' }, fmt(v))); }
  const every = Math.max(1, Math.ceil(series.length / Math.max(2, Math.floor((W - P.l) / 80))));
  series.forEach((s, i) => { if (i % every === 0 || i === series.length - 1) svg.append(el('text', { x: x(i), y: H - 6, 'text-anchor': 'middle' }, dayLabel(s.day))); });
  return { svg, x, y, top };
}

export function areaChart(series, opts = {}) { return responsive((W) => drawArea(series, opts, W)); }
function drawArea(series, { color = 'var(--chart-1)', fmt = moneyShort, unit = '' }, W) {
  const { svg, x, y } = frame(series, fmt, W);
  const pts = series.map((s, i) => [x(i), y(s.v)]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  svg.append(el('path', { d: `${line} L${x(series.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z`, fill: color, opacity: '.12' }), el('path', { d: line, fill: 'none', stroke: color, 'stroke-width': 2.2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
  series.forEach((s, i) => {
    const g = el('g'); const c = el('circle', { cx: x(i), cy: y(s.v), r: 3.2, fill: color, opacity: s.v ? '1' : '0' });
    const hit = el('rect', { x: x(i) - 9, y: P.t, width: 18, height: H - P.t - P.b, fill: 'transparent' });
    hit.append(el('title', {}, `${dayLabel(s.day)}: ${faDigits(Number(s.v).toLocaleString('en-US'))} ${unit}`.trim()));
    g.append(c, hit); svg.append(g);
  });
  return svg;
}

export function barChart(series, opts = {}) { return responsive((W) => drawBar(series, opts, W)); }
function drawBar(series, { color = 'var(--chart-1)', unit = '' }, W) {
  const { svg, x, y } = frame(series, (v) => faDigits(Math.round(v)), W);
  const bw = Math.max(4, Math.min(18, ((W - P.l - P.r) / series.length) * 0.62));
  series.forEach((s, i) => {
    const r = el('rect', { x: x(i) - bw / 2, y: y(s.v), width: bw, height: Math.max(0, y(0) - y(s.v)), rx: 3, fill: color });
    r.append(el('title', {}, `${dayLabel(s.day)}: ${faDigits(s.v)} ${unit}`.trim()));
    svg.append(r);
  });
  return svg;
}

/** parts: [{label, value, color}] — donut with total in the centre. */
export function donut(parts) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  const svg = el('svg', { viewBox: '0 0 160 160', class: 'chart', style: 'max-width:180px;margin:auto', role: 'img' });
  const R = 56, C = 2 * Math.PI * R; let off = 0;
  svg.append(el('circle', { cx: 80, cy: 80, r: R, fill: 'none', stroke: 'var(--chart-grid)', 'stroke-width': 18 }));
  for (const p of parts) {
    if (!p.value) continue;
    const len = (p.value / total) * C;
    const c = el('circle', { cx: 80, cy: 80, r: R, fill: 'none', stroke: p.color, 'stroke-width': 18, 'stroke-dasharray': `${len} ${C - len}`, 'stroke-dashoffset': -off, transform: 'rotate(-90 80 80)' });
    c.append(el('title', {}, `${p.label}: ${faDigits(p.value)}`)); svg.append(c); off += len;
  }
  svg.append(el('text', { x: 80, y: 80, 'text-anchor': 'middle', style: 'font-size:24px;font-weight:700;fill:var(--text)' }, faDigits(total)), el('text', { x: 80, y: 98, 'text-anchor': 'middle' }, 'سرویس'));
  return svg;
}
