// Generates WorldForge's original, deterministic SVG artwork into /public.
//   node scripts/generate-art.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
const f = (n) => n.toFixed(1);

function write(rel, content) {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
  console.log("wrote", rel, `${(content.length / 1024).toFixed(1)} KB`);
}

const W = 2400;
const H = 1600;

const defs = `
<defs>
  <radialGradient id="seaGlow" cx="0.5" cy="0.5" r="0.75">
    <stop offset="0" stop-color="#171a22"/><stop offset="1" stop-color="#0d0f14"/>
  </radialGradient>
  <linearGradient id="land" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#2d2922"/><stop offset="1" stop-color="#24211c"/>
  </linearGradient>
  <pattern id="waves" width="60" height="22" patternUnits="userSpaceOnUse">
    <path d="M0 11 q15 -6 30 0 t30 0" fill="none" stroke="#2a3040" stroke-width="1" opacity="0.5"/>
  </pattern>
  <pattern id="sand" width="14" height="14" patternUnits="userSpaceOnUse">
    <circle cx="3" cy="4" r="0.9" fill="#8f7e5c" opacity="0.45"/><circle cx="10" cy="10" r="0.7" fill="#8f7e5c" opacity="0.35"/>
  </pattern>
  <pattern id="marsh" width="18" height="12" patternUnits="userSpaceOnUse">
    <path d="M2 9 h6 M5 9 v-4 M11 6 h5 M13.5 6 v-3" stroke="#5f6b5a" stroke-width="1" opacity="0.6"/>
  </pattern>
  <filter id="rough"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 0.9  0 0 0 0 0.85  0 0 0 0 0.75  0 0 0 0.06 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
  <filter id="soft"><feGaussianBlur stdDeviation="6"/></filter>
</defs>`;

function frame(title) {
  return `
  <rect x="18" y="18" width="${W - 36}" height="${H - 36}" fill="none" stroke="#8f7e5c" stroke-width="2" opacity="0.55"/>
  <rect x="30" y="30" width="${W - 60}" height="${H - 60}" fill="none" stroke="#8f7e5c" stroke-width="0.8" opacity="0.4"/>
  ${compass(2190, 1380, 90)}
  ${title ? `<g transform="translate(120 120)">
    <rect x="-20" y="-58" width="560" height="92" fill="#15161c" stroke="#8f7e5c" stroke-width="1.2" opacity="0.92" rx="4"/>
    <text x="260" y="0" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="46" fill="#d6bd8d" letter-spacing="4">${title}</text>
    <text x="260" y="24" text-anchor="middle" font-family="Georgia, serif" font-size="15" fill="#a4a5af" letter-spacing="6">AS SURVEYED IN THE YEAR 858 AC</text>
  </g>` : ""}`;
}

function compass(cx, cy, r) {
  return `<g transform="translate(${cx} ${cy})" opacity="0.75">
    <circle r="${r}" fill="none" stroke="#8f7e5c" stroke-width="1"/>
    <circle r="${r * 0.72}" fill="none" stroke="#8f7e5c" stroke-width="0.6" stroke-dasharray="3 5"/>
    <path d="M0 ${-r * 1.1} L${r * 0.13} 0 L0 ${r * 1.1} L${-r * 0.13} 0 Z" fill="#d6bd8d" opacity="0.85"/>
    <path d="M${-r * 1.1} 0 L0 ${r * 0.13} L${r * 1.1} 0 L0 ${-r * 0.13} Z" fill="#8f7e5c" opacity="0.7"/>
    <text y="${-r * 1.22}" text-anchor="middle" font-family="Georgia, serif" font-size="22" fill="#d6bd8d">N</text>
  </g>`;
}

function grid() {
  let g = `<g stroke="#8f7e5c" stroke-width="0.6" opacity="0.12">`;
  for (let x = 200; x < W; x += 200) g += `<line x1="${x}" y1="30" x2="${x}" y2="${H - 30}"/>`;
  for (let y = 200; y < H; y += 200) g += `<line x1="30" y1="${y}" x2="${W - 30}" y2="${y}"/>`;
  return g + "</g>";
}

// ── The Western Reaches (The Ashen Crown) ──
function continent() {
  const r = rng(42);
  const cx = 1250;
  const cy = 820;
  const rx = 1120;
  const ry = 700;
  const N = 420;
  const phases = Array.from({ length: 6 }, () => r() * Math.PI * 2);
  const pts = [];
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    let k = 1 + 0.07 * Math.sin(3 * t + phases[0]) + 0.05 * Math.sin(7 * t + phases[1]) + 0.025 * Math.sin(13 * t + phases[2]) + 0.012 * Math.sin(29 * t + phases[3]) + 0.006 * Math.sin(53 * t + phases[4]);
    // Saltmere bay on the west coast (~180°)
    const d = Math.atan2(Math.sin(t - Math.PI), Math.cos(t - Math.PI));
    k -= 0.2 * Math.exp(-(d * d) / (2 * 0.06 * 0.06));
    // Southern gulf near Duskmere
    const d2 = Math.atan2(Math.sin(t - 1.25), Math.cos(t - 1.25));
    k -= 0.09 * Math.exp(-(d2 * d2) / (2 * 0.08 * 0.08));
    k = Math.max(k, 0.74);
    pts.push([cx + Math.cos(t) * rx * k, cy + Math.sin(t) * ry * k]);
  }
  return "M" + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(" L") + " Z";
}

function islands() {
  const r = rng(9);
  const spots = [[150, 560], [120, 1300], [2250, 240], [760, 1530]];
  return spots
    .map(([x, y]) => {
      const n = 40;
      const a = 30 + r() * 50;
      const b = 18 + r() * 30;
      const pts = Array.from({ length: n }, (_, i) => {
        const t = (i / n) * Math.PI * 2;
        const k = 1 + 0.15 * Math.sin(3 * t + r() * 6);
        return `${f(x + Math.cos(t) * a * k)} ${f(y + Math.sin(t) * b * k)}`;
      });
      return `<path d="M${pts.join(" L")} Z" fill="url(#land)" stroke="#8f7e5c" stroke-width="1.5"/>`;
    })
    .join("");
}

function mountains(seed, cx, cy, spreadX, spreadY, count, scale = 1) {
  const r = rng(seed);
  const items = [];
  for (let i = 0; i < count; i++) {
    const x = cx + (r() - 0.5) * spreadX;
    const y = cy + (r() - 0.5) * spreadY;
    const h = (26 + r() * 30) * scale;
    const w = h * (0.9 + r() * 0.5);
    items.push({ x, y, h, w });
  }
  items.sort((a, b) => a.y - b.y);
  return items
    .map(
      ({ x, y, h, w }) =>
        `<path d="M${f(x - w / 2)} ${f(y)} L${f(x)} ${f(y - h)} L${f(x + w / 2)} ${f(y)} Z" fill="#26231e" stroke="#a49274" stroke-width="1.3" stroke-linejoin="round"/>` +
        `<path d="M${f(x)} ${f(y - h)} L${f(x + w * 0.18)} ${f(y - h * 0.45)} L${f(x + w / 2)} ${f(y)}" fill="#1b1915" opacity="0.8"/>`,
    )
    .join("");
}

function forest(seed, cx, cy, sx, sy, count) {
  const r = rng(seed);
  let out = "";
  for (let i = 0; i < count; i++) {
    const x = cx + (r() - 0.5) * sx;
    const y = cy + (r() - 0.5) * sy;
    const s = 6 + r() * 5;
    out += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(s)}" fill="#2b3229" stroke="#6b7a63" stroke-width="0.8"/>`;
  }
  return out;
}

const westernReaches = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
${defs}
<rect width="${W}" height="${H}" fill="url(#seaGlow)"/>
<rect width="${W}" height="${H}" fill="url(#waves)"/>
${grid()}
<path d="${continent()}" fill="#8f7e5c" opacity="0.18" filter="url(#soft)" transform="translate(0 6)"/>
<path d="${continent()}" fill="url(#land)" stroke="#a49274" stroke-width="2.5"/>
<path d="${continent()}" fill="none" stroke="#8f7e5c" stroke-width="10" opacity="0.08"/>
${islands()}
<ellipse cx="1700" cy="1070" rx="300" ry="170" fill="url(#sand)"/>
<ellipse cx="1760" cy="1110" rx="200" ry="110" fill="url(#sand)"/>
<ellipse cx="640" cy="1290" rx="170" ry="90" fill="url(#marsh)"/>
<ellipse cx="1290" cy="1085" rx="78" ry="46" fill="#0d0f14" stroke="#8d80b8" stroke-width="1.5" opacity="0.95"/>
<ellipse cx="1290" cy="1085" rx="50" ry="26" fill="none" stroke="#8d80b8" stroke-width="0.8" opacity="0.5"/>
<path d="M1060 520 C 1010 640, 960 760, 930 860 S 800 960, 700 965 S 520 990, 420 1000" fill="none" stroke="#4b6a80" stroke-width="3.2" opacity="0.8"/>
<path d="M1450 360 C 1400 520, 1340 700, 1310 840 S 1290 1000, 1290 1050" fill="none" stroke="#4b6a80" stroke-width="2.4" opacity="0.7"/>
<path d="M1980 480 C 2000 560, 1990 620, 1980 680" fill="none" stroke="#4b6a80" stroke-width="2" opacity="0.6"/>
${mountains(5, 1120, 360, 900, 170, 46)}
${mountains(17, 780, 560, 220, 120, 14, 0.85)}
${mountains(29, 2030, 470, 380, 120, 18, 0.9)}
${forest(3, 560, 900, 260, 160, 60)}
${forest(13, 1000, 1180, 300, 160, 55)}
${forest(21, 1580, 650, 260, 140, 50)}
<g font-family="Georgia, serif" fill="#a49274" opacity="0.6" font-style="italic" letter-spacing="10">
  <text x="1100" y="215" font-size="30" text-anchor="middle">THE GREYMANTLE</text>
  <text x="1720" y="1210" font-size="30" text-anchor="middle">THE GLASS WASTES</text>
  <text x="240" y="300" font-size="34" text-anchor="middle" fill="#56637a">WESTERN SEA</text>
  <text x="1300" y="1520" font-size="30" text-anchor="middle" fill="#56637a">SEA OF EMBERS</text>
</g>
${frame("THE WESTERN REACHES")}
</svg>`;

write("maps/ashen-crown.svg", westernReaches);

const parchment = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
${defs}
<rect width="${W}" height="${H}" fill="#1d1b17"/>
<rect width="${W}" height="${H}" fill="#2a2620" filter="url(#rough)"/>
${grid()}
<g font-family="Georgia, serif" fill="#8f7e5c" opacity="0.35" font-style="italic" letter-spacing="12">
  <text x="${W / 2}" y="${H / 2}" font-size="40" text-anchor="middle">TERRA INCOGNITA</text>
  <text x="${W / 2}" y="${H / 2 + 44}" font-size="16" text-anchor="middle" letter-spacing="4">Upload your own map in the Atlas, or place markers on this survey sheet</text>
</g>
${frame("")}
</svg>`;
write("maps/parchment.svg", parchment);

// ── Cover art for The Ashen Crown ──
const r = rng(77);
let embers = "";
for (let i = 0; i < 70; i++) {
  embers += `<circle cx="${f(r() * 1200)}" cy="${f(200 + r() * 500)}" r="${f(r() * 2.2 + 0.4)}" fill="#e6a46a" opacity="${f(r() * 0.6 + 0.15)}"/>`;
}
const cover = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 600" width="1200" height="600">
<defs>
  <radialGradient id="g" cx="0.5" cy="0.62" r="0.7"><stop offset="0" stop-color="#3a2a22"/><stop offset="0.55" stop-color="#1a1619"/><stop offset="1" stop-color="#0e0f14"/></radialGradient>
  <linearGradient id="crown" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e4cfa6"/><stop offset="1" stop-color="#6d5b3e"/></linearGradient>
  <filter id="glow"><feGaussianBlur stdDeviation="14"/></filter>
</defs>
<rect width="1200" height="600" fill="url(#g)"/>
<ellipse cx="600" cy="390" rx="260" ry="60" fill="#c27a45" opacity="0.18" filter="url(#glow)"/>
${embers}
<g transform="translate(600 330)">
  <path d="M-170 60 L-190 -70 L-110 -10 L-60 -110 L0 -30 L60 -110 L110 -10 L190 -70 L170 60 Z" fill="url(#crown)" opacity="0.9"/>
  <path d="M-170 60 L170 60 L160 95 L-160 95 Z" fill="#8f7e5c"/>
  <path d="M-170 60 L-190 -70 L-110 -10 L-60 -110 L0 -30 L60 -110 L110 -10 L190 -70 L170 60" fill="none" stroke="#101116" stroke-width="3" opacity="0.6"/>
  <path d="M-40 10 L-10 -40 L10 5 L35 -20 L20 40 Z" fill="#101116" opacity="0.55"/>
  <circle cx="0" cy="25" r="11" fill="#8d80b8"/>
  <circle cx="-95" cy="40" r="7" fill="#c27a45"/><circle cx="95" cy="40" r="7" fill="#c27a45"/>
</g>
<rect width="1200" height="600" fill="none" stroke="#8f7e5c" stroke-width="2" opacity="0.4"/>
</svg>`;
write("art/ashen-crown-cover.svg", cover);
