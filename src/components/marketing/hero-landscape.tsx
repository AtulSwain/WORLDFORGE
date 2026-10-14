import { cn } from "@/lib/utils";

/**
 * Original procedural artwork: a moonlit highland citadel above a valley of mist.
 * Pure SVG (no external assets), animated only with CSS so it stays fast and respects
 * reduced-motion preferences.
 */

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function ridge(seed: number, baseY: number, amp: number, steps = 48, w = 1600): string {
  const r = rng(seed);
  let d = `M0 900 L0 ${baseY}`;
  let y = baseY;
  for (let i = 1; i <= steps; i++) {
    const x = (i / steps) * w;
    y = baseY + Math.sin(i * 0.55 + seed) * amp * 0.5 + (r() - 0.5) * amp;
    d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return `${d} L${w} 900 Z`;
}

const STARS = (() => {
  const r = rng(7);
  return Array.from({ length: 90 }, () => ({ x: r() * 1600, y: r() * 380, s: r() * 1.3 + 0.2, o: r() * 0.6 + 0.2 }));
})();

export function HeroLandscape({ className }: { className?: string }) {
  return (
    <div className={cn("absolute inset-0 overflow-hidden bg-[#0c0d12]", className)} aria-hidden="true">
      <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full motion-safe:animate-drift">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0b0c12" />
            <stop offset="0.55" stopColor="#1a1822" />
            <stop offset="1" stopColor="#2a2324" />
          </linearGradient>
          <radialGradient id="moonGlow" cx="0.72" cy="0.24" r="0.32">
            <stop offset="0" stopColor="#e9dcc0" stopOpacity="0.35" />
            <stop offset="1" stopColor="#e9dcc0" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="far" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2c2a36" />
            <stop offset="1" stopColor="#1c1b24" />
          </linearGradient>
          <linearGradient id="mid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1e1d26" />
            <stop offset="1" stopColor="#14141b" />
          </linearGradient>
          <linearGradient id="near" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#121218" />
            <stop offset="1" stopColor="#0a0a0e" />
          </linearGradient>
          <linearGradient id="mistGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#bfb6a6" stopOpacity="0" />
            <stop offset="0.5" stopColor="#bfb6a6" stopOpacity="0.16" />
            <stop offset="1" stopColor="#bfb6a6" stopOpacity="0" />
          </linearGradient>
          <filter id="blur8">
            <feGaussianBlur stdDeviation="8" />
          </filter>
        </defs>

        <rect width="1600" height="900" fill="url(#sky)" />
        <rect width="1600" height="900" fill="url(#moonGlow)" />
        {STARS.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#efe6d2" opacity={s.o} />
        ))}
        {/* moon */}
        <circle cx="1150" cy="215" r="46" fill="#e8dcc2" opacity="0.92" />
        <circle cx="1168" cy="205" r="44" fill="#1a1822" opacity="0.18" />

        {/* far ranges */}
        <path d={ridge(3, 470, 120)} fill="url(#far)" opacity="0.9" />
        <path d={ridge(11, 540, 90)} fill="url(#mid)" />

        {/* citadel on the ridge */}
        <g transform="translate(980 395)" fill="#121219">
          <path d="M0 140 L0 70 L14 70 L14 40 L22 40 L22 10 L30 0 L38 10 L38 40 L46 40 L46 70 L70 70 L70 52 L78 52 L78 30 L86 22 L94 30 L94 52 L102 52 L102 90 L130 90 L130 64 L138 64 L138 48 L144 42 L150 48 L150 64 L158 64 L158 140 Z" />
          <rect x="26" y="20" width="3" height="6" fill="#d6bd8d" opacity="0.85" />
          <rect x="84" y="40" width="3" height="5" fill="#d6bd8d" opacity="0.7" />
          <rect x="142" y="56" width="2.5" height="5" fill="#d6bd8d" opacity="0.6" />
          <rect x="60" y="96" width="3" height="5" fill="#d6bd8d" opacity="0.5" />
        </g>

        {/* mist band */}
        <g className="motion-safe:animate-mist">
          <rect x="-200" y="560" width="2000" height="140" fill="url(#mistGrad)" filter="url(#blur8)" />
        </g>

        <path d={ridge(23, 650, 70)} fill="url(#mid)" opacity="0.95" />
        {/* road winding through the valley */}
        <path d="M120 900 C 360 760, 520 760, 700 700 S 960 640, 1010 600" stroke="#d6bd8d" strokeOpacity="0.18" strokeWidth="3" fill="none" strokeDasharray="2 10" />
        <path d={ridge(31, 760, 60)} fill="url(#near)" />
        {/* pines */}
        <g fill="#0a0a0e">
          {Array.from({ length: 26 }, (_, i) => {
            const x = 40 + i * 62 + ((i * 37) % 23);
            const h = 40 + ((i * 53) % 35);
            const y = 770 + ((i * 29) % 30);
            return <path key={i} d={`M${x} ${y} l${h * 0.28} ${h} h${-h * 0.56} z`} />;
          })}
        </g>
      </svg>
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgb(16_17_22/0.75))]" />
    </div>
  );
}
