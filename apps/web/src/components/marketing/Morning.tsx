import { useMemo } from 'react'

// ── The morning after the close ──────────────────────────────────────────────
// Every marketing page ends here, edge to edge under the page's own daylight
// sky: green hills, a meadow, and two chairs facing the sun with the coffee
// still warm. The close is done. The landscape has no sky of its own, so it
// sits in whatever hour the page has scrolled to, and it anchors bottom-right
// so the chairs and the sun stay in view however narrow the screen.

type Pt = [number, number]
type Seg = [Pt, Pt, Pt, Pt]

const W = 1280, H = 680

// Hill outlines as cubic segments, so grass and flowers can follow the crests.
const RIGHT_HILL: Seg[] = [
  [[420, 604], [560, 558], [700, 530], [860, 522]],
  [[860, 522], [1000, 515], [1140, 520], [1280, 534]],
]
const FOREGROUND: Seg[] = [
  [[0, 642], [200, 620], [420, 614], [640, 624]],
  [[640, 624], [860, 634], [1060, 630], [1280, 618]],
]

function bez([a, b, c, d]: Seg, t: number): Pt {
  const u = 1 - t
  return [
    u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
    u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
  ]
}

function sample(segs: Seg[], step: number): Pt[] {
  const pts: Pt[] = []
  for (const s of segs) for (let t = 0; t < 1; t += step) pts.push(bez(s, t))
  pts.push(segs[segs.length - 1][3])
  return pts
}

const outline = (segs: Seg[]) =>
  `M${segs[0][0].join(' ')} ` + segs.map(s => `C${s[1].join(' ')} ${s[2].join(' ')} ${s[3].join(' ')}`).join(' ')

// Grass blades and wildflowers along a crest, seeded so the meadow holds still.
function meadow(segs: Seg[], seed: number, density: number, tall: number) {
  let s = seed
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647
  const blades: string[][] = [[], [], []]
  const flowers: { x: number; y: number; r: number; c: string }[] = []
  for (const [x, y] of sample(segs, density)) {
    // grass grows in clumps, with bare patches between
    const n = rnd() < 0.22 ? 0 : 1 + Math.floor(rnd() * 4)
    for (let i = 0; i < n; i++) {
      const bx = x + (rnd() - 0.5) * 6
      const h  = tall * (0.45 + rnd() * 0.75)
      const lean = (rnd() - 0.42) * tall * 0.5
      blades[Math.floor(rnd() * 3)].push(`M${bx.toFixed(1)} ${(y + 3).toFixed(1)}Q${(bx + lean * 0.35).toFixed(1)} ${(y - h * 0.55).toFixed(1)} ${(bx + lean).toFixed(1)} ${(y - h).toFixed(1)}`)
    }
    if (rnd() < 0.09) {
      flowers.push({ x: x + (rnd() - 0.5) * 10, y: y + 4 + rnd() * 22, r: 1.3 + rnd() * 1.2, c: ['#fff7d6', '#ffffff', '#f6c9d4', '#ffe28a'][Math.floor(rnd() * 4)] })
    }
  }
  return { blades: blades.map(b => b.join('')), flowers }
}

/** An Adirondack chair seen from behind, facing the sun. Origin at its feet. */
function Chair({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  const slats = [-2, -1, 0, 1, 2]
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="-4" cy="5" rx="50" ry="7" fill="#1d4a28" opacity="0.28" />
      {/* front legs, farther away */}
      <rect x="-41" y="-41" width="4" height="37" rx="1" fill="#c3ccd8" />
      <rect x="37" y="-41" width="4" height="37" rx="1" fill="#c3ccd8" />
      {/* arms */}
      <rect x="-48" y="-46" width="30" height="5.5" rx="2.5" fill="#d6dde7" />
      <rect x="18" y="-46" width="30" height="5.5" rx="2.5" fill="#d6dde7" />
      {/* back legs */}
      <rect x="-28" y="-36" width="5" height="36" rx="1" fill="#cfd7e2" />
      <rect x="23" y="-36" width="5" height="36" rx="1" fill="#cfd7e2" />
      {/* the fanned back, in shade with the sun ahead of it */}
      {slats.map(i => {
        const top = 94 - Math.abs(i) * 7 - i * i * 1.5
        return (
          <rect key={i} x={i * 10 - 4} y={-top} width="8.5" height={top - 32} rx="4"
            fill="#e6ecf3" transform={`rotate(${i * 3.2} ${i * 6} -34)`} />
        )
      })}
      <rect x="-27" y="-62" width="54" height="4.5" rx="2" fill="#cdd6e1" />
      <rect x="-25" y="-42" width="50" height="4.5" rx="2" fill="#cdd6e1" />
    </g>
  )
}

/** A low table between the chairs, two mugs on it, steam lifting off them. */
function CoffeeTable({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="-2" cy="4" rx="22" ry="4" fill="#1d4a28" opacity="0.22" />
      <rect x="-12" y="-27" width="3" height="27" fill="#c3ccd8" />
      <rect x="9" y="-27" width="3" height="27" fill="#c3ccd8" />
      <rect x="-17" y="-31" width="34" height="5" rx="2" fill="#dde4ec" />
      <rect x="-11" y="-40" width="7" height="9" rx="1.5" fill="#f2d4a8" />
      <rect x="3" y="-39" width="7" height="8" rx="1.5" fill="#bcd6f0" />
      <path className="animate-steam" d="M-7.5 -43c-2 -4 2 -6 0 -10" stroke="#ffffff" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.7" />
      <path className="animate-steam" style={{ animationDelay: '-1.6s' }} d="M6.5 -42c-2 -4 2 -6 0 -10" stroke="#ffffff" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.7" />
    </g>
  )
}

const BIRDS: { x: number; y: number; s: number; d: number }[] = [
  { x: 742, y: 246, s: 1,    d: 0 },
  { x: 776, y: 222, s: 0.82, d: -0.5 },
  { x: 812, y: 254, s: 0.9,  d: -1.1 },
  { x: 704, y: 272, s: 0.7,  d: -0.8 },
  { x: 846, y: 218, s: 0.62, d: -1.4 },
]

// The visible slice of the drawing: everything below the open sky.
const VIEW_TOP = 120

export function MorningLandscape({ className = '' }: { className?: string }) {
  const hill  = useMemo(() => meadow(RIGHT_HILL, 11, 0.016, 5), [])
  const front = useMemo(() => meadow(FOREGROUND, 29, 0.006, 22), [])
  const greens = ['#4f9a52', '#6cb466', '#2f6e38']

  return (
    <div aria-hidden className={`pointer-events-none relative w-full min-h-[340px] ${className}`} style={{ aspectRatio: `${W} / ${H - VIEW_TOP}` }}>
    <svg viewBox={`0 ${VIEW_TOP} ${W} ${H - VIEW_TOP}`} preserveAspectRatio="xMaxYMax slice" className="absolute inset-0 h-full w-full">
      <defs>
        <radialGradient id="m-sun" cx="1080" cy="238" r="360" gradientUnits="userSpaceOnUse">
          <stop offset="0"    stopColor="#fffdf2" />
          <stop offset="0.07" stopColor="#fffaf0" stopOpacity="0.95" />
          <stop offset="0.2"  stopColor="#fff1cc" stopOpacity="0.5" />
          <stop offset="0.5"  stopColor="#ffeccc" stopOpacity="0.14" />
          <stop offset="1"    stopColor="#ffeccc" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="m-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a6c7da" />
          <stop offset="1" stopColor="#bcd8cb" />
        </linearGradient>
        <linearGradient id="m-mid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#93c697" />
          <stop offset="1" stopColor="#77b07c" />
        </linearGradient>
        <linearGradient id="m-left" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6db36b" />
          <stop offset="1" stopColor="#4c9451" />
        </linearGradient>
        <linearGradient id="m-right" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#62ad60" />
          <stop offset="1" stopColor="#3f8a48" />
        </linearGradient>
        <linearGradient id="m-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3f8545" />
          <stop offset="1" stopColor="#2c6535" />
        </linearGradient>
        <filter id="m-soft" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="5" /></filter>
      </defs>

      {/* the sun, high in the morning sky */}
      <rect y={VIEW_TOP} width={W} height={H - VIEW_TOP} fill="url(#m-sun)" />
      <circle cx="1080" cy="238" r="32" fill="#fffdf4" />

      {/* clouds: white tops, a cool shade underneath */}
      <g filter="url(#m-soft)" opacity="0.92">
        <g transform="translate(470 392)">
          <ellipse cx="0" cy="8" rx="150" ry="22" fill="#dce8f5" />
          <ellipse cx="-60" cy="-4" rx="70" ry="26" fill="#ffffff" />
          <ellipse cx="20" cy="-14" rx="80" ry="34" fill="#ffffff" />
          <ellipse cx="90" cy="0" rx="60" ry="22" fill="#ffffff" />
        </g>
        <g transform="translate(760 262) scale(0.7)">
          <ellipse cx="0" cy="8" rx="130" ry="18" fill="#dce8f5" />
          <ellipse cx="-40" cy="-6" rx="64" ry="24" fill="#ffffff" />
          <ellipse cx="34" cy="-12" rx="70" ry="28" fill="#ffffff" />
        </g>
        <g transform="translate(1230 372) scale(0.8)">
          <ellipse cx="0" cy="6" rx="120" ry="18" fill="#e3edf7" />
          <ellipse cx="-30" cy="-8" rx="70" ry="26" fill="#ffffff" />
        </g>
      </g>

      {/* birds, flying loosely together */}
      <g className="animate-birds">
        {BIRDS.map((b, i) => (
          <g key={i} transform={`translate(${b.x} ${b.y}) scale(${b.s})`}>
            <path className="animate-flap" style={{ animationDelay: `${b.d}s` }} d="M-9 0Q-4.5 -5 0 0Q4.5 -5 9 0" stroke="#2c3d63" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ))}
      </g>

      {/* the hills, far to near */}
      <path d="M0 432C120 406 220 392 340 404C460 416 540 398 660 388C780 378 880 396 1000 404C1100 410 1190 396 1280 390V680H0Z" fill="url(#m-far)" />
      <path d="M0 470C140 442 260 432 380 446C500 460 600 472 720 458C840 444 960 440 1080 452C1170 462 1230 458 1280 452V680H0Z" fill="url(#m-mid)" />
      {/* a few far trees on the middle ridge */}
      <g opacity="0.9">
        <rect x="766" y="442" width="3" height="12" fill="#5b7a58" />
        <circle cx="767.5" cy="436" r="10" fill="#679f69" />
        <circle cx="761" cy="441" r="7" fill="#5f9762" />
        <rect x="800" y="440" width="2.5" height="9" fill="#5b7a58" />
        <circle cx="801" cy="435" r="7.5" fill="#6aa36c" />
        <rect x="640" y="456" width="2.5" height="9" fill="#5b7a58" />
        <circle cx="641" cy="451" r="7" fill="#679f69" />
      </g>
      <path d="M0 522C120 484 260 470 400 488C520 504 600 532 700 562V680H0Z" fill="url(#m-left)" />
      <path d={`${outline(RIGHT_HILL)}V${H}H420Z`} fill="url(#m-right)" />
      {/* sunlit rim on the near crest */}
      <path d={outline(RIGHT_HILL)} fill="none" stroke="#a6dc92" strokeWidth="2.5" opacity="0.55" />
      <g strokeWidth="0.9" fill="none" strokeLinecap="round" opacity="0.6">
        {hill.blades.map((d, i) => <path key={i} d={d} stroke={greens[i]} />)}
      </g>
      {hill.flowers.map((f, i) => <circle key={i} cx={f.x} cy={f.y} r={f.r * 0.8} fill={f.c} />)}

      {/* two chairs facing the sun, coffee between them */}
      <Chair x={1000} y={528} s={1.22} />
      <CoffeeTable x={1088} y={530} />
      <Chair x={1176} y={533} s={1.28} />

      {/* the near meadow */}
      <path d={`${outline(FOREGROUND)}V${H}H0Z`} fill="url(#m-front)" />
      <g strokeWidth="1.5" fill="none" strokeLinecap="round">
        {front.blades.map((d, i) => <path key={i} d={d} stroke={greens[i]} />)}
      </g>
      {front.flowers.map((f, i) => <circle key={i} cx={f.x} cy={f.y} r={f.r} fill={f.c} />)}
    </svg>
    </div>
  )
}
