// Offline-safe media placeholders (SVG data URIs) so the demo needs no external images.
const PALETTES: [string, string][] = [
  ["#6d4aff", "#c04dff"],
  ["#0ea5e9", "#6366f1"],
  ["#f97316", "#ec4899"],
  ["#10b981", "#0ea5e9"],
  ["#f43f5e", "#f59e0b"],
  ["#334155", "#6d4aff"],
];

export function placeholderImage(emoji: string, seed: number, label = "") {
  const [a, b] = PALETTES[Math.abs(seed) % PALETTES.length];
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs><rect width='400' height='400' fill='url(#g)'/><circle cx='320' cy='80' r='120' fill='white' fill-opacity='.08'/><text x='200' y='225' font-size='140' text-anchor='middle'>${emoji}</text><text x='200' y='350' font-size='26' fill='white' fill-opacity='.85' text-anchor='middle' font-family='sans-serif'>${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function avatarColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 65% 55%)`;
}
