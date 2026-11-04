// Generates studio-style SVG product renders for the demo catalogue.
import { writeFileSync, mkdirSync } from "node:fs";
const out = process.argv[2] ?? new URL("../assets/parts-svg", import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const defs = `
<defs>
  <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#fbfbfc"/><stop offset=".35" stop-color="#c9cdd3"/>
    <stop offset=".6" stop-color="#8a9099"/><stop offset=".8" stop-color="#d7dadf"/><stop offset="1" stop-color="#9aa0a8"/>
  </linearGradient>
  <linearGradient id="metalV" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#7d838c"/><stop offset=".25" stop-color="#e9ebee"/>
    <stop offset=".5" stop-color="#b4b9c0"/><stop offset=".75" stop-color="#f5f6f7"/><stop offset="1" stop-color="#6f757e"/>
  </linearGradient>
  <linearGradient id="metalH" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#f6f7f8"/><stop offset=".45" stop-color="#b9bec5"/><stop offset=".55" stop-color="#8d939b"/><stop offset="1" stop-color="#d4d7dc"/>
  </linearGradient>
  <linearGradient id="dark" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#5d626b"/><stop offset=".5" stop-color="#2b2e34"/><stop offset="1" stop-color="#16181b"/>
  </linearGradient>
  <linearGradient id="darkV" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#121316"/><stop offset=".3" stop-color="#4a4f57"/><stop offset=".55" stop-color="#26292e"/><stop offset="1" stop-color="#0d0e10"/>
  </linearGradient>
  <linearGradient id="red" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#ff5a4f"/><stop offset=".45" stop-color="#e10600"/><stop offset="1" stop-color="#7d0000"/>
  </linearGradient>
  <linearGradient id="redV" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#8a0000"/><stop offset=".35" stop-color="#ff4136"/><stop offset=".6" stop-color="#d40500"/><stop offset="1" stop-color="#6e0000"/>
  </linearGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#8a6a2a"/><stop offset=".35" stop-color="#f3d98b"/><stop offset=".6" stop-color="#c79a3c"/><stop offset="1" stop-color="#6b4f1c"/>
  </linearGradient>
  <linearGradient id="blue" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#4b7bd6"/><stop offset="1" stop-color="#173a7a"/>
  </linearGradient>
  <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset=".5" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </linearGradient>
  <radialGradient id="shadow" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="#000" stop-opacity=".38"/><stop offset=".6" stop-color="#000" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="disc" cx=".42" cy=".38" r=".7">
    <stop offset="0" stop-color="#f4f5f6"/><stop offset=".35" stop-color="#c3c7cd"/><stop offset=".55" stop-color="#e4e6e9"/>
    <stop offset=".75" stop-color="#959ba3"/><stop offset="1" stop-color="#666c75"/>
  </radialGradient>
  <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter>
</defs>`;

const svg = (body, shadow = { cx: 300, cy: 520, rx: 210, ry: 26 }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">${defs}
<ellipse cx="${shadow.cx}" cy="${shadow.cy}" rx="${shadow.rx}" ry="${shadow.ry}" fill="url(#shadow)"/>
${body}
</svg>`;

const range = (n) => Array.from({ length: n }, (_, i) => i);
const rot = (cx, cy, r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];

const parts = {};

/* 1. Brake disc with caliper */
parts["brake-disc"] = svg(`
<g>
  <circle cx="290" cy="290" r="215" fill="url(#disc)" stroke="#5a6068" stroke-width="3"/>
  <circle cx="290" cy="290" r="200" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>
  ${range(6).map((i) => `<circle cx="290" cy="290" r="${200 - i * 16}" fill="none" stroke="#7d838c" stroke-opacity=".18" stroke-width="1.5"/>`).join("")}
  ${range(30).map((i) => {
    const a = (i / 30) * Math.PI * 2;
    return range(3).map((k) => {
      const [x, y] = rot(290, 290, 175 - k * 28, a + k * 0.07);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6.5" fill="#2a2d32"/><circle cx="${(x - 1.4).toFixed(1)}" cy="${(y - 1.4).toFixed(1)}" r="4.2" fill="#43474e"/>`;
    }).join("");
  }).join("")}
  ${range(10).map((i) => {
    const a = (i / 10) * Math.PI * 2 + 0.15;
    const [x1, y1] = rot(290, 290, 112, a);
    const [x2, y2] = rot(290, 290, 205, a + 0.35);
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#3b3f45" stroke-width="3" stroke-linecap="round" opacity=".55"/>`;
  }).join("")}
  <circle cx="290" cy="290" r="108" fill="url(#dark)"/>
  <circle cx="290" cy="290" r="96" fill="url(#metal)"/>
  <circle cx="290" cy="290" r="96" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>
  ${range(5).map((i) => {
    const [x, y] = rot(290, 290, 62, (i / 5) * Math.PI * 2 - Math.PI / 2);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="11" fill="#1c1e22"/><circle cx="${(x - 2).toFixed(1)}" cy="${(y - 2).toFixed(1)}" r="6" fill="#3d4148"/>`;
  }).join("")}
  <circle cx="290" cy="290" r="34" fill="#16181b"/><circle cx="290" cy="290" r="34" fill="none" stroke="#9aa0a8" stroke-width="4"/>
  <ellipse cx="230" cy="190" rx="120" ry="60" fill="url(#gloss)" transform="rotate(-30 230 190)" opacity=".55"/>
</g>
<g transform="rotate(28 290 290)">
  <path d="M410 120 Q520 150 545 290 Q520 430 410 460 L385 420 Q470 380 480 290 Q470 200 385 160 Z" fill="url(#red)" stroke="#5c0000" stroke-width="3"/>
  <path d="M420 150 Q500 185 512 290 Q500 395 420 430" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="6" stroke-linecap="round"/>
  <rect x="468" y="262" width="56" height="56" rx="10" fill="#b30000" opacity=".6"/>
  <text x="496" y="296" font-family="Arial Black, Arial" font-size="20" font-weight="900" fill="#fff" text-anchor="middle" transform="rotate(90 496 290)">HAP</text>
  <circle cx="432" cy="170" r="10" fill="url(#metal)"/><circle cx="432" cy="410" r="10" fill="url(#metal)"/>
</g>`);

/* 2. Brake pads */
const pad = (dx, dy, r) => `
<g transform="translate(${dx} ${dy}) rotate(${r} 300 300)">
  <path d="M120 250 Q300 170 480 250 L470 300 Q300 230 130 300 Z" fill="url(#metalH)" stroke="#5c6168" stroke-width="3"/>
  <path d="M138 300 Q300 236 462 300 L450 380 Q300 330 150 380 Z" fill="#2b2b2e" stroke="#111" stroke-width="3"/>
  <path d="M150 320 Q300 268 450 320" fill="none" stroke="#4a4a4f" stroke-width="3"/>
  <line x1="300" y1="262" x2="300" y2="352" stroke="#0e0e10" stroke-width="7"/>
  <path d="M120 250 L104 240 L110 228 L132 243" fill="url(#metal)" stroke="#5c6168" stroke-width="2"/>
  <path d="M480 250 L496 240 L490 228 L468 243" fill="url(#metal)" stroke="#5c6168" stroke-width="2"/>
  <path d="M180 248 Q300 200 420 248" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="4"/>
  <rect x="270" y="210" width="60" height="16" rx="4" fill="#e10600" transform="rotate(0)"/>
</g>`;
parts["brake-pads"] = svg(pad(-20, -60, -6) + pad(20, 90, 4));

/* 3. Piston + rings + conrod */
parts["piston"] = svg(`
<g>
  <path d="M268 330 L250 470 Q300 500 350 470 L332 330 Z" fill="url(#metalV)" stroke="#5c6168" stroke-width="3"/>
  <ellipse cx="300" cy="478" rx="72" ry="44" fill="url(#metalV)" stroke="#5c6168" stroke-width="3"/>
  <ellipse cx="300" cy="478" rx="40" ry="24" fill="#2a2d32"/>
  <ellipse cx="300" cy="474" rx="40" ry="20" fill="#3f434a"/>
  <rect x="178" y="110" width="244" height="210" rx="18" fill="url(#metalV)" stroke="#5c6168" stroke-width="3"/>
  <ellipse cx="300" cy="112" rx="122" ry="34" fill="url(#metal)" stroke="#5c6168" stroke-width="3"/>
  <ellipse cx="300" cy="112" rx="84" ry="20" fill="none" stroke="#7d838c" stroke-width="3" opacity=".7"/>
  <ellipse cx="262" cy="108" rx="22" ry="8" fill="#a7adb4"/><ellipse cx="338" cy="108" rx="22" ry="8" fill="#a7adb4"/>
  ${[150, 172, 194].map((y, i) => `<rect x="176" y="${y}" width="248" height="${i === 2 ? 14 : 10}" fill="${i === 2 ? "#26292e" : "#1b1d21"}"/><rect x="176" y="${y + 2}" width="248" height="3" fill="#b7bcc3" opacity=".7"/>`).join("")}
  <circle cx="300" cy="262" r="38" fill="url(#dark)"/>
  <circle cx="300" cy="262" r="30" fill="url(#metal)"/>
  <circle cx="300" cy="262" r="12" fill="#2a2d32"/>
  <rect x="198" y="120" width="26" height="190" rx="12" fill="#fff" opacity=".35"/>
</g>`, { cx: 300, cy: 530, rx: 170, ry: 22 });

/* 4. Shock absorber / strut with coil spring */
parts["shock-absorber"] = svg(`
<g transform="rotate(-18 300 300)">
  <rect x="284" y="40" width="32" height="200" rx="8" fill="url(#metalV)"/>
  <rect x="262" y="230" width="76" height="290" rx="14" fill="url(#darkV)" stroke="#0b0b0c" stroke-width="2"/>
  <rect x="270" y="236" width="10" height="276" rx="5" fill="#fff" opacity=".18"/>
  <rect x="250" y="440" width="100" height="26" rx="6" fill="url(#metalV)"/>
  <path d="M276 520 L276 560 Q300 580 324 560 L324 520" fill="url(#darkV)"/>
  <circle cx="300" cy="555" r="14" fill="#16181b" stroke="#6b7078" stroke-width="5"/>
  <ellipse cx="300" cy="80" rx="96" ry="20" fill="url(#metalV)" stroke="#4d5259" stroke-width="2"/>
  <ellipse cx="300" cy="70" rx="56" ry="14" fill="url(#dark)"/>
  <ellipse cx="300" cy="420" rx="96" ry="20" fill="url(#metalV)" stroke="#4d5259" stroke-width="2"/>
  ${range(7).map((i) => {
    const y = 104 + i * 44;
    return `<path d="M210 ${y} Q300 ${y + 30} 390 ${y + 22}" fill="none" stroke="#7a0000" stroke-width="22" stroke-linecap="round"/>
    <path d="M210 ${y} Q300 ${y + 30} 390 ${y + 22}" fill="none" stroke="url(#redV)" stroke-width="16" stroke-linecap="round"/>
    <path d="M222 ${y - 3} Q300 ${y + 22} 380 ${y + 16}" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="4" stroke-linecap="round"/>`;
  }).join("")}
</g>`, { cx: 300, cy: 545, rx: 200, ry: 24 });

/* 5. Control arm (wishbone) */
parts["control-arm"] = svg(`
<g>
  <path d="M90 360 Q140 300 260 290 L470 210 Q510 200 520 235 Q526 262 496 276 L300 350 Q260 380 250 420 Q245 455 205 455 Q160 452 150 420 Q140 390 90 400 Z" fill="url(#dark)" stroke="#0c0d0f" stroke-width="3"/>
  <path d="M120 365 Q170 320 265 312 L470 232" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="8" stroke-linecap="round"/>
  <path d="M190 430 Q220 380 300 350" fill="none" stroke="#000" stroke-opacity=".4" stroke-width="10"/>
  <circle cx="110" cy="380" r="46" fill="#1a1b1e"/><circle cx="110" cy="380" r="34" fill="#2e3035"/>
  <circle cx="110" cy="380" r="16" fill="url(#metal)"/><circle cx="110" cy="380" r="6" fill="#16181b"/>
  <circle cx="200" cy="440" r="40" fill="#1a1b1e"/><circle cx="200" cy="440" r="28" fill="#2e3035"/>
  <circle cx="200" cy="440" r="13" fill="url(#metal)"/><circle cx="200" cy="440" r="5" fill="#16181b"/>
  <ellipse cx="500" cy="236" rx="42" ry="42" fill="url(#metal)" stroke="#5c6168" stroke-width="3"/>
  <path d="M480 200 Q500 150 520 200" fill="#151618"/>
  <rect x="490" y="120" width="20" height="90" rx="6" fill="url(#metalV)"/>
  <path d="M470 205 Q500 170 530 205 Q520 225 500 228 Q480 225 470 205Z" fill="#111" />
  <circle cx="500" cy="122" r="12" fill="url(#gold)"/>
</g>`, { cx: 300, cy: 500, rx: 240, ry: 26 });

/* 6. Ball joint */
parts["ball-joint"] = svg(`
<g>
  <rect x="270" y="80" width="60" height="150" rx="10" fill="url(#metalV)"/>
  ${range(10).map((i) => `<rect x="268" y="${88 + i * 12}" width="64" height="4" fill="#6f757e" opacity=".7"/>`).join("")}
  <path d="M250 230 Q300 200 350 230 L370 290 Q300 320 230 290 Z" fill="url(#darkV)"/>
  <path d="M215 290 Q300 250 385 290 Q400 330 380 360 Q300 400 220 360 Q200 330 215 290Z" fill="#141518"/>
  ${range(4).map((i) => `<path d="M${222 + i * 4} ${300 + i * 16} Q300 ${276 + i * 16} ${378 - i * 4} ${300 + i * 16}" fill="none" stroke="#33363c" stroke-width="5"/>`).join("")}
  <ellipse cx="300" cy="390" rx="130" ry="42" fill="url(#metal)" stroke="#5c6168" stroke-width="3"/>
  <path d="M170 390 L170 440 Q300 500 430 440 L430 390 Q300 450 170 390Z" fill="url(#metalV)" stroke="#5c6168" stroke-width="3"/>
  ${[-80, 0, 80].map((dx) => `<circle cx="${300 + dx}" cy="${dx === 0 ? 410 : 400}" r="13" fill="#1e2024"/><circle cx="${298 + dx}" cy="${dx === 0 ? 408 : 398}" r="7" fill="#454950"/>`).join("")}
  <circle cx="300" cy="80" r="12" fill="url(#gold)"/>
</g>`, { cx: 300, cy: 500, rx: 180, ry: 22 });

/* 7. Water pump */
parts["water-pump"] = svg(`
<g>
  <path d="M150 210 Q160 130 260 120 L400 130 Q470 150 470 240 L460 380 Q440 450 350 455 L230 450 Q150 430 150 350 Z" fill="url(#metal)" stroke="#5c6168" stroke-width="3"/>
  ${[[175, 160], [440, 165], [455, 400], [180, 420], [310, 125]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="16" fill="url(#metalV)" stroke="#4b5057" stroke-width="2"/><circle cx="${x}" cy="${y}" r="7" fill="#1b1d21"/>`).join("")}
  <circle cx="300" cy="290" r="120" fill="url(#metalV)" stroke="#5c6168" stroke-width="3" opacity=".9"/>
  <circle cx="300" cy="290" r="96" fill="#2a2d32"/>
  ${range(8).map((i) => {
    const a = (i / 8) * Math.PI * 2;
    const [x1, y1] = rot(300, 290, 26, a);
    const [x2, y2] = rot(300, 290, 92, a + 0.5);
    const [cx, cy] = rot(300, 290, 70, a + 0.05);
    return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="url(#metal)" stroke-width="12" fill="none" stroke-linecap="round"/>`;
  }).join("")}
  <circle cx="300" cy="290" r="30" fill="url(#metal)" stroke="#4b5057" stroke-width="3"/>
  <circle cx="300" cy="290" r="10" fill="#16181b"/>
  <path d="M440 300 L540 290 L545 340 L455 350 Z" fill="url(#metalH)" stroke="#5c6168" stroke-width="3"/>
  <ellipse cx="543" cy="315" rx="12" ry="26" fill="#2a2d32"/>
  <ellipse cx="230" cy="180" rx="70" ry="28" fill="url(#gloss)" transform="rotate(-20 230 180)"/>
</g>`, { cx: 320, cy: 515, rx: 220, ry: 24 });

/* 8. Radiator */
parts["radiator"] = svg(`
<g transform="skewY(-6) translate(0 30)">
  <rect x="90" y="140" width="420" height="300" rx="8" fill="url(#darkV)"/>
  <rect x="110" y="160" width="380" height="260" fill="#22252a"/>
  ${range(48).map((i) => `<rect x="${112 + i * 7.9}" y="160" width="3.2" height="260" fill="#8a9099" opacity=".75"/>`).join("")}
  ${range(13).map((i) => `<rect x="110" y="${165 + i * 20}" width="380" height="2.5" fill="#0c0d0f" opacity=".7"/>`).join("")}
  <rect x="70" y="120" width="40" height="340" rx="8" fill="url(#metalV)" stroke="#4b5057" stroke-width="2"/>
  <rect x="490" y="120" width="40" height="340" rx="8" fill="url(#metalV)" stroke="#4b5057" stroke-width="2"/>
  <rect x="35" y="160" width="40" height="28" rx="8" fill="url(#metalH)"/>
  <rect x="525" y="400" width="40" height="28" rx="8" fill="url(#metalH)"/>
  <rect x="490" y="96" width="40" height="28" rx="6" fill="#111"/><rect x="496" y="88" width="28" height="12" rx="4" fill="url(#red)"/>
  <rect x="110" y="160" width="380" height="80" fill="url(#gloss)" opacity=".35"/>
</g>`, { cx: 300, cy: 520, rx: 250, ry: 22 });

/* 9. Spark plugs (pair) */
const plug = (dx, r) => `
<g transform="translate(${dx} 0) rotate(${r} 300 300)">
  <rect x="285" y="40" width="30" height="40" rx="6" fill="url(#metalV)"/>
  <path d="M262 80 L338 80 L330 230 L270 230 Z" fill="#f3f3f1" stroke="#c6c6c2" stroke-width="2"/>
  ${range(5).map((i) => `<rect x="266" y="${96 + i * 14}" width="68" height="6" rx="3" fill="#dcdcd8"/>`).join("")}
  <rect x="268" y="160" width="12" height="60" fill="#fff" opacity=".8"/>
  <text x="300" y="214" font-family="Arial" font-weight="700" font-size="15" fill="#e10600" text-anchor="middle">HAP</text>
  <path d="M248 230 L352 230 L362 250 L362 300 L352 320 L248 320 L238 300 L238 250 Z" fill="url(#metalV)" stroke="#5c6168" stroke-width="2"/>
  <rect x="262" y="320" width="76" height="22" fill="url(#metalV)"/>
  <rect x="272" y="342" width="56" height="110" fill="url(#metalV)"/>
  ${range(10).map((i) => `<rect x="270" y="${346 + i * 10}" width="60" height="4" fill="#6a7079"/>`).join("")}
  <rect x="294" y="452" width="12" height="24" fill="#c4c8ce"/>
  <path d="M278 452 L278 488 L312 488" fill="none" stroke="#9aa0a8" stroke-width="8"/>
</g>`;
parts["spark-plug"] = svg(plug(-80, -8) + plug(90, 10), { cx: 300, cy: 530, rx: 220, ry: 22 });

/* 10. Oxygen / ABS sensor */
parts["sensor"] = svg(`
<g>
  <path d="M330 260 C 420 230, 520 280, 500 360 C 480 440, 360 420, 330 470 C 310 500, 330 530, 380 535" fill="none" stroke="#111" stroke-width="16" stroke-linecap="round"/>
  <path d="M330 260 C 420 230, 520 280, 500 360 C 480 440, 360 420, 330 470" fill="none" stroke="#3b3e44" stroke-width="5" stroke-linecap="round" opacity=".7"/>
  <rect x="360" y="510" width="80" height="48" rx="8" fill="#141518"/><rect x="368" y="518" width="20" height="32" rx="3" fill="#2b2e33"/>
  <g transform="rotate(-35 250 250)">
    <rect x="215" y="100" width="70" height="60" rx="6" fill="url(#metalV)"/>
    ${range(9).map((i) => `<rect x="213" y="${104 + i * 6}" width="74" height="2.5" fill="#646a73"/>`).join("")}
    <path d="M200 160 L300 160 L310 178 L310 230 L300 248 L200 248 L190 230 L190 178 Z" fill="url(#metalV)" stroke="#5c6168" stroke-width="2"/>
    <rect x="220" y="248" width="60" height="40" fill="url(#metalV)"/>
    <rect x="232" y="288" width="36" height="64" rx="4" fill="url(#metalV)"/>
    ${range(4).map((i) => `<rect x="236" y="${298 + i * 12}" width="28" height="5" fill="#2b2e33"/>`).join("")}
    <rect x="236" y="40" width="28" height="60" rx="6" fill="url(#darkV)"/>
  </g>
</g>`, { cx: 330, cy: 545, rx: 200, ry: 20 });

/* 11. Alternator */
parts["alternator"] = svg(`
<g>
  <circle cx="300" cy="300" r="170" fill="url(#metal)" stroke="#5c6168" stroke-width="3"/>
  ${range(16).map((i) => {
    const a = (i / 16) * Math.PI * 2;
    const [x1, y1] = rot(300, 300, 95, a);
    const [x2, y2] = rot(300, 300, 160, a);
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#2a2d32" stroke-width="12" stroke-linecap="round"/>`;
  }).join("")}
  <circle cx="300" cy="300" r="92" fill="url(#metalV)" stroke="#4b5057" stroke-width="3"/>
  <circle cx="300" cy="300" r="64" fill="url(#dark)"/>
  ${range(6).map((i) => `<circle cx="300" cy="300" r="${58 - i * 6}" fill="none" stroke="#7b818b" stroke-width="1.5" opacity=".6"/>`).join("")}
  <circle cx="300" cy="300" r="20" fill="url(#metal)"/><path d="M290 300 L310 300 M300 290 L300 310" stroke="#1b1d21" stroke-width="5"/>
  <path d="M120 200 L60 170 Q40 175 45 200 L110 240Z" fill="url(#metal)" stroke="#5c6168" stroke-width="3"/><circle cx="62" cy="192" r="10" fill="#1b1d21"/>
  <path d="M480 400 L540 430 Q560 425 555 400 L490 360Z" fill="url(#metal)" stroke="#5c6168" stroke-width="3"/><circle cx="538" cy="408" r="10" fill="#1b1d21"/>
  <rect x="420" y="160" width="70" height="44" rx="8" fill="#141518"/><circle cx="455" cy="182" r="10" fill="url(#gold)"/>
  <ellipse cx="230" cy="190" rx="90" ry="34" fill="url(#gloss)" transform="rotate(-30 230 190)"/>
</g>`, { cx: 300, cy: 510, rx: 220, ry: 24 });

/* 12. Headlight */
parts["headlight"] = svg(`
<g>
  <path d="M60 330 Q70 210 200 170 L500 140 Q560 150 548 220 L520 350 Q500 420 420 425 L130 430 Q60 420 60 330Z" fill="#141518" stroke="#000" stroke-width="3"/>
  <path d="M80 330 Q90 225 205 188 L495 160 Q540 168 530 222 L503 345 Q488 404 418 407 L135 410 Q80 402 80 330Z" fill="url(#darkV)"/>
  <circle cx="200" cy="310" r="74" fill="url(#metal)"/>
  <circle cx="200" cy="310" r="52" fill="#d9e6f5"/><circle cx="200" cy="310" r="36" fill="url(#blue)" opacity=".5"/>
  <circle cx="186" cy="296" r="14" fill="#fff"/>
  <circle cx="370" cy="290" r="64" fill="url(#metal)"/>
  <circle cx="370" cy="290" r="44" fill="#e4edf7"/><circle cx="358" cy="278" r="12" fill="#fff"/>
  <path d="M110 380 Q300 350 495 330" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round"/>
  <path d="M110 380 Q300 350 495 330" fill="none" stroke="#9fd2ff" stroke-width="16" stroke-linecap="round" opacity=".35" filter="url(#soft)"/>
  <path d="M470 220 L520 210 L505 290 L460 300Z" fill="#ff8a00" opacity=".85"/>
  <path d="M90 300 Q110 210 210 185 L500 158 Q530 162 535 190 Q300 200 160 240 Q110 260 90 300Z" fill="url(#gloss)"/>
</g>`, { cx: 300, cy: 480, rx: 250, ry: 24 });

/* 13. Side mirror */
parts["mirror"] = svg(`
<g>
  <path d="M380 330 L470 350 Q500 370 490 420 L470 450 L380 420Z" fill="url(#darkV)"/>
  <path d="M70 230 Q90 130 230 120 L400 130 Q470 150 465 260 L455 360 Q440 420 360 420 L160 410 Q70 400 70 300Z" fill="url(#dark)" stroke="#000" stroke-width="3"/>
  <path d="M95 240 Q110 150 232 142 L395 152 Q445 168 442 262 L433 352 Q422 398 360 398 L165 390 Q95 382 95 300Z" fill="url(#metal)" opacity=".9"/>
  <path d="M95 240 Q110 150 232 142 L395 152 Q445 168 442 262 L433 352 Q422 398 360 398 L165 390 Q95 382 95 300Z" fill="url(#blue)" opacity=".28"/>
  <path d="M110 230 Q130 165 240 160 L330 164 L180 380 L160 378 Q110 370 110 300Z" fill="#fff" opacity=".35"/>
  <path d="M120 400 L420 405" stroke="#ff8a00" stroke-width="8" stroke-linecap="round"/>
</g>`, { cx: 290, cy: 490, rx: 230, ry: 22 });

/* 14. Oil filter */
parts["oil-filter"] = svg(`
<g>
  <path d="M170 150 L430 150 L430 450 Q300 490 170 450Z" fill="url(#redV)" stroke="#6b0000" stroke-width="3"/>
  ${range(12).map((i) => `<rect x="${178 + i * 21}" y="150" width="7" height="34" fill="#000" opacity=".22"/>`).join("")}
  <ellipse cx="300" cy="150" rx="130" ry="36" fill="url(#metal)" stroke="#5c6168" stroke-width="3"/>
  <ellipse cx="300" cy="150" rx="100" ry="26" fill="#2b2b2e"/>
  <ellipse cx="300" cy="148" rx="40" ry="11" fill="url(#metalV)"/>
  <ellipse cx="300" cy="148" rx="18" ry="5" fill="#111"/>
  ${range(6).map((i) => { const a = (i / 6) * Math.PI * 2; const [x, y] = [300 + 70 * Math.cos(a), 150 + 18 * Math.sin(a)]; return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="8" ry="4" fill="#565a61"/>`; }).join("")}
  <rect x="200" y="260" width="200" height="90" rx="10" fill="#111"/>
  <text x="300" y="306" font-family="Arial Black, Arial" font-weight="900" font-size="34" fill="#fff" text-anchor="middle">HAMIDI</text>
  <text x="300" y="334" font-family="Arial" font-weight="700" font-size="16" fill="#e10600" text-anchor="middle" letter-spacing="4">OIL FILTER</text>
  <rect x="190" y="160" width="26" height="290" fill="#fff" opacity=".28"/>
</g>`, { cx: 300, cy: 500, rx: 180, ry: 22 });

/* 15. Air filter */
parts["air-filter"] = svg(`
<g transform="translate(0 20)">
  <path d="M90 250 L510 220 L540 330 L120 370Z" fill="#1d1f23"/>
  <path d="M110 255 L500 228 L522 322 L132 356Z" fill="#f5efe2"/>
  ${range(32).map((i) => { const t = i / 31; const x1 = 110 + t * 390, y1 = 255 - t * 27, x2 = 132 + t * 390, y2 = 356 - t * 34; return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${i % 2 ? "#d6cdb8" : "#fffaf0"}" stroke-width="7"/>`; }).join("")}
  <path d="M90 250 L120 370 L120 390 L90 270Z" fill="#0d0e10"/>
  <path d="M120 370 L540 330 L540 350 L120 390Z" fill="#0d0e10"/>
  <path d="M90 250 L510 220" stroke="#e10600" stroke-width="5"/>
</g>`, { cx: 310, cy: 450, rx: 250, ry: 24 });

/* 16. Timing belt kit */
parts["timing-belt"] = svg(`
<g>
  <path d="M170 200 Q170 110 260 110 L370 140 Q460 170 450 260 L420 400 Q400 480 310 470 L200 440 Q130 420 140 340Z" fill="none" stroke="#141518" stroke-width="30" stroke-linejoin="round"/>
  <path d="M170 200 Q170 110 260 110 L370 140 Q460 170 450 260 L420 400 Q400 480 310 470 L200 440 Q130 420 140 340Z" fill="none" stroke="#3a3d43" stroke-width="30" stroke-dasharray="4 7" stroke-linejoin="round"/>
  <path d="M170 200 Q170 110 260 110 L370 140 Q460 170 450 260 L420 400 Q400 480 310 470 L200 440 Q130 420 140 340Z" fill="none" stroke="#e10600" stroke-width="2" stroke-dasharray="40 30" opacity=".8"/>
  ${[[230, 190, 60], [380, 240, 52], [300, 390, 66]].map(([x, y, r]) => `
    <circle cx="${x}" cy="${y}" r="${r}" fill="url(#metal)" stroke="#5c6168" stroke-width="3"/>
    <circle cx="${x}" cy="${y}" r="${r * 0.62}" fill="url(#metalV)"/>
    <circle cx="${x}" cy="${y}" r="${r * 0.3}" fill="url(#dark)"/>
    <circle cx="${x}" cy="${y}" r="${r * 0.12}" fill="url(#gold)"/>`).join("")}
  <rect x="440" y="420" width="90" height="40" rx="8" fill="url(#red)" transform="rotate(-10 485 440)"/>
  <circle cx="160" cy="470" r="34" fill="url(#metal)" stroke="#5c6168" stroke-width="3"/><circle cx="160" cy="470" r="12" fill="#1b1d21"/>
</g>`, { cx: 300, cy: 525, rx: 230, ry: 22 });

/* 17. Cylinder head */
parts["cylinder-head"] = svg(`
<g transform="translate(0 20)">
  <path d="M70 250 L480 190 L540 230 L540 330 L130 400 L70 360Z" fill="url(#metalH)" stroke="#5c6168" stroke-width="3"/>
  <path d="M70 250 L480 190 L540 230 L130 290Z" fill="url(#metal)" stroke="#5c6168" stroke-width="3"/>
  <path d="M130 290 L540 230 L540 330 L130 400Z" fill="url(#metalV)" opacity=".75"/>
  ${range(4).map((i) => { const x = 160 + i * 92, y = 270 - i * 13; return `<ellipse cx="${x}" cy="${y}" rx="34" ry="12" fill="#2a2d32"/><ellipse cx="${x}" cy="${y - 2}" rx="22" ry="7" fill="url(#gold)"/>`; }).join("")}
  <path d="M120 230 L480 178" stroke="#1b1d21" stroke-width="18" stroke-linecap="round"/>
  <path d="M120 230 L480 178" stroke="url(#metalH)" stroke-width="10" stroke-linecap="round"/>
  ${range(4).map((i) => { const x = 180 + i * 92, y = 350 - i * 13; return `<ellipse cx="${x}" cy="${y}" rx="22" ry="26" fill="#1b1d21"/><ellipse cx="${x - 4}" cy="${y - 4}" rx="14" ry="16" fill="#3a3d43"/>`; }).join("")}
  ${range(8).map((i) => `<circle cx="${100 + i * 58}" cy="${(250 - i * 8.3).toFixed(1)}" r="7" fill="#1b1d21"/>`).join("")}
</g>`, { cx: 300, cy: 470, rx: 260, ry: 24 });

/* 18. Gearbox */
parts["gearbox"] = svg(`
<g>
  <path d="M120 200 Q160 120 260 130 L420 160 Q500 190 500 280 L480 390 Q460 450 380 450 L230 440 Q140 430 120 340Z" fill="url(#metal)" stroke="#5c6168" stroke-width="3"/>
  <path d="M120 200 Q100 260 120 340" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="6"/>
  ${range(6).map((i) => `<path d="M${200 + i * 45} 140 L${190 + i * 45} 440" stroke="#7d838c" stroke-width="5" opacity=".55"/>`).join("")}
  <circle cx="230" cy="300" r="90" fill="url(#metalV)" stroke="#4b5057" stroke-width="3"/>
  <circle cx="230" cy="300" r="56" fill="url(#dark)"/>
  ${range(24).map((i) => { const a = (i / 24) * Math.PI * 2; const [x, y] = rot(230, 300, 50, a); return `<rect x="${(x - 4).toFixed(1)}" y="${(y - 4).toFixed(1)}" width="8" height="8" fill="#8a9099" transform="rotate(${(a * 180 / Math.PI).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`; }).join("")}
  <circle cx="230" cy="300" r="22" fill="url(#metal)"/><circle cx="230" cy="300" r="8" fill="#16181b"/>
  ${[[150, 170], [330, 145], [470, 230], [450, 410], [270, 440], [140, 390]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="11" fill="url(#metalV)" stroke="#3a3d43" stroke-width="2"/>`).join("")}
  <rect x="490" y="270" width="60" height="44" rx="8" fill="url(#metalH)" stroke="#5c6168" stroke-width="3"/>
  <rect x="380" y="330" width="70" height="40" rx="6" fill="#141518"/><circle cx="415" cy="350" r="8" fill="url(#gold)"/>
</g>`, { cx: 310, cy: 510, rx: 230, ry: 24 });

/* 19. Engine oil bottle */
parts["engine-oil"] = svg(`
<g>
  <path d="M170 170 L340 170 L360 130 L420 130 L430 170 Q440 175 440 200 L440 470 Q440 490 420 490 L180 490 Q160 490 160 470 L160 190 Q160 170 170 170Z" fill="url(#dark)" stroke="#000" stroke-width="3"/>
  <rect x="360" y="96" width="60" height="40" rx="8" fill="url(#redV)"/>
  <path d="M240 170 L240 120 Q240 100 260 100 L330 100 Q350 100 350 120 L350 170" fill="none" stroke="#1b1d21" stroke-width="22"/>
  <rect x="180" y="250" width="240" height="190" rx="10" fill="#f4f4f5"/>
  <rect x="180" y="250" width="240" height="46" rx="10" fill="#e10600"/>
  <text x="300" y="282" font-family="Arial Black, Arial" font-weight="900" font-size="24" fill="#fff" text-anchor="middle">HAMIDI</text>
  <text x="300" y="345" font-family="Arial Black, Arial" font-weight="900" font-size="46" fill="#111" text-anchor="middle">5W-30</text>
  <text x="300" y="378" font-family="Arial" font-weight="700" font-size="16" fill="#555" text-anchor="middle" letter-spacing="3">FULL SYNTHETIC</text>
  <text x="300" y="418" font-family="Arial" font-weight="700" font-size="18" fill="#e10600" text-anchor="middle">4 L</text>
  <rect x="172" y="185" width="22" height="290" rx="8" fill="#fff" opacity=".22"/>
</g>`, { cx: 300, cy: 505, rx: 180, ry: 20 });

/* 20. Steering wheel (interior) */
parts["steering-wheel"] = svg(`
<g>
  <circle cx="300" cy="290" r="200" fill="none" stroke="#0e0f11" stroke-width="54"/>
  <circle cx="300" cy="290" r="200" fill="none" stroke="#2c2f34" stroke-width="44"/>
  <path d="M135 180 A200 200 0 0 1 300 90" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="10" stroke-linecap="round"/>
  ${range(40).map((i) => { const a = (i / 40) * Math.PI * 2; const [x1, y1] = rot(300, 290, 182, a); const [x2, y2] = rot(300, 290, 218, a); return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#e10600" stroke-width="1.5" opacity=".5"/>`; }).join("")}
  <path d="M110 300 Q200 330 240 320 L360 320 Q400 330 490 300 L470 360 Q400 380 370 420 L330 470 L270 470 L230 420 Q200 380 130 360Z" fill="url(#dark)" stroke="#000" stroke-width="3"/>
  <rect x="228" y="250" width="144" height="110" rx="30" fill="url(#darkV)" stroke="#000" stroke-width="3"/>
  <rect x="258" y="292" width="84" height="26" rx="13" fill="url(#metal)"/>
  <path d="M120 300 Q200 325 240 318" fill="none" stroke="url(#metalH)" stroke-width="5"/>
  <path d="M480 300 Q400 325 360 318" fill="none" stroke="url(#metalH)" stroke-width="5"/>
</g>`, { cx: 300, cy: 525, rx: 210, ry: 22 });

/* 21. Wheel hub bearing */
parts["hub-bearing"] = svg(`
<g>
  <ellipse cx="300" cy="360" rx="190" ry="90" fill="url(#metalV)" stroke="#5c6168" stroke-width="3"/>
  <path d="M110 360 L110 300 Q300 200 490 300 L490 360 Q300 450 110 360Z" fill="url(#metalV)" stroke="#5c6168" stroke-width="3"/>
  <ellipse cx="300" cy="300" rx="190" ry="90" fill="url(#metal)" stroke="#5c6168" stroke-width="3"/>
  ${range(5).map((i) => { const a = (i / 5) * Math.PI * 2 - Math.PI / 2; const x = 300 + 120 * Math.cos(a), y = 300 + 56 * Math.sin(a); return `<rect x="${(x - 7).toFixed(1)}" y="${(y - 90).toFixed(1)}" width="14" height="90" rx="4" fill="url(#gold)"/><ellipse cx="${x.toFixed(1)}" cy="${(y - 90).toFixed(1)}" rx="7" ry="3" fill="#f6e3a6"/><ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="16" ry="8" fill="#2a2d32"/>`; }).join("")}
  <ellipse cx="300" cy="300" rx="64" ry="30" fill="url(#dark)"/>
  <ellipse cx="300" cy="296" rx="40" ry="18" fill="url(#metalV)"/>
  <ellipse cx="300" cy="294" rx="16" ry="7" fill="#16181b"/>
  <rect x="440" y="360" width="80" height="24" rx="8" fill="#141518" transform="rotate(15 480 372)"/>
</g>`, { cx: 300, cy: 470, rx: 230, ry: 26 });

/* 22. Ignition coil */
parts["ignition-coil"] = svg(`
<g transform="rotate(-12 300 300)">
  <rect x="200" y="110" width="200" height="110" rx="16" fill="url(#dark)" stroke="#000" stroke-width="3"/>
  <rect x="350" y="140" width="80" height="54" rx="8" fill="#141518"/><rect x="372" y="152" width="40" height="30" rx="4" fill="#2b2e33"/>
  <circle cx="230" cy="140" r="16" fill="url(#metal)"/><circle cx="230" cy="140" r="6" fill="#16181b"/>
  <rect x="268" y="220" width="64" height="210" rx="10" fill="url(#darkV)"/>
  ${range(6).map((i) => `<rect x="262" y="${250 + i * 26}" width="76" height="10" rx="5" fill="#1a1b1e"/>`).join("")}
  <path d="M276 430 L324 430 L316 500 Q300 512 284 500 Z" fill="#e10600"/>
  <rect x="210" y="118" width="180" height="20" rx="8" fill="#fff" opacity=".12"/>
  <text x="300" y="186" font-family="Arial Black, Arial" font-weight="900" font-size="20" fill="#e10600" text-anchor="middle">HAP</text>
</g>`, { cx: 300, cy: 525, rx: 160, ry: 20 });

/* 23. Clutch kit */
parts["clutch"] = svg(`
<g>
  <circle cx="260" cy="300" r="190" fill="url(#metal)" stroke="#5c6168" stroke-width="3"/>
  ${range(18).map((i) => { const a = (i / 18) * Math.PI * 2; const [x1, y1] = rot(260, 300, 90, a); const [x2, y2] = rot(260, 300, 150, a + 0.12); return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="#5c6168" stroke-width="16" stroke-linecap="round"/><path d="M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="url(#metalV)" stroke-width="12" stroke-linecap="round"/>`; }).join("")}
  <circle cx="260" cy="300" r="80" fill="url(#dark)"/>
  <circle cx="260" cy="300" r="44" fill="url(#metal)"/><circle cx="260" cy="300" r="20" fill="#16181b"/>
  ${range(6).map((i) => { const [x, y] = rot(260, 300, 172, (i / 6) * Math.PI * 2); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8" fill="#1b1d21"/>`; }).join("")}
  <g transform="translate(150 60)">
    <circle cx="300" cy="320" r="120" fill="#2a2a2d" stroke="#111" stroke-width="3"/>
    <circle cx="300" cy="320" r="104" fill="#4a3b2f"/>
    ${range(12).map((i) => { const a = (i / 12) * Math.PI * 2; const [x, y] = rot(300, 320, 90, a); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="#a8a29a"/>`; }).join("")}
    <circle cx="300" cy="320" r="62" fill="url(#metal)"/>
    ${range(4).map((i) => { const [x, y] = rot(300, 320, 40, (i / 4) * Math.PI * 2 + 0.4); return `<rect x="${(x - 12).toFixed(1)}" y="${(y - 7).toFixed(1)}" width="24" height="14" rx="4" fill="url(#gold)"/>`; }).join("")}
    <circle cx="300" cy="320" r="18" fill="#16181b"/>
  </g>
</g>`, { cx: 330, cy: 520, rx: 240, ry: 24 });

/* 24. Taillight */
parts["taillight"] = svg(`
<g>
  <path d="M90 200 L470 150 Q520 150 520 210 L500 380 Q490 430 430 430 L140 420 Q80 415 85 350Z" fill="#111" stroke="#000" stroke-width="3"/>
  <path d="M110 214 L465 170 Q500 172 498 214 L480 372 Q472 408 428 408 L148 400 Q104 396 106 350Z" fill="url(#red)"/>
  ${range(6).map((i) => `<path d="M${130 + i * 58} ${232 - i * 7} L${128 + i * 58} ${390 - i * 2}" stroke="#ff8b85" stroke-width="3" opacity=".55"/>`).join("")}
  <path d="M120 320 L480 300 L476 340 L118 352Z" fill="#f2f2f2" opacity=".9"/>
  <path d="M380 230 L480 218 L474 290 L376 298Z" fill="#ff9a1f" opacity=".85"/>
  <path d="M110 214 L465 170 Q500 172 498 214 Q300 210 110 270Z" fill="url(#gloss)"/>
</g>`, { cx: 300, cy: 480, rx: 240, ry: 22 });

/* 25. Gasket set */
parts["gasket"] = svg(`
<g transform="translate(0 40) skewX(-14) translate(70 0)">
  <rect x="70" y="170" width="440" height="200" rx="26" fill="url(#metal)" stroke="#4b5057" stroke-width="3"/>
  <rect x="70" y="170" width="440" height="200" rx="26" fill="none" stroke="#2c2f34" stroke-width="10" opacity=".25"/>
  ${range(4).map((i) => `<circle cx="${135 + i * 103}" cy="270" r="44" fill="#f4f4f5" stroke="#3a3d43" stroke-width="7"/><circle cx="${135 + i * 103}" cy="270" r="44" fill="none" stroke="#e10600" stroke-width="2"/>`).join("")}
  ${range(10).map((i) => `<circle cx="${100 + (i % 5) * 95}" cy="${i < 5 ? 195 : 345}" r="9" fill="#f4f4f5" stroke="#3a3d43" stroke-width="2"/>`).join("")}
</g>`, { cx: 300, cy: 470, rx: 260, ry: 22 });

for (const [name, content] of Object.entries(parts)) {
  writeFileSync(`${out}/${name}.svg`, content.replace(/\n\s+/g, "\n"));
}
console.log(Object.keys(parts).length, "parts written");
