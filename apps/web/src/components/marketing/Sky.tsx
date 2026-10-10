import { useEffect, useRef, type ReactNode } from 'react'

// ── The dawn sky ─────────────────────────────────────────────────────────────
// Every marketing page sits on one sky. It opens at dawn and, as the visitor
// scrolls, moves through sunrise into full morning, so a page ends in
// daylight: the close, done. Content rides on paper sheets above it.

type Stops = [string, string, string, string, string]

// Five-stop vertical gradients at points along the page's scroll.
const KEYS: [number, Stops][] = [
  [0.00, ['#1a1b4d', '#4b3f8f', '#c4718f', '#f39a7c', '#ffd3a1']],   // dawn
  [0.35, ['#2e3478', '#7a63a8', '#e38f8f', '#f8b98e', '#ffe1b5']],   // sunrise
  [0.70, ['#4e6ab8', '#8fa9df', '#d9c3cf', '#f6d6bf', '#fff0dc']],   // morning
  [1.00, ['#7aa2e0', '#b4cdf0', '#dce8f8', '#eef3fb', '#fbf6ee']],   // day
]

const hex = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
const KEYS_RGB = KEYS.map(([t, s]) => [t, s.map(hex)] as [number, number[][]])

function skyAt(t: number): string {
  let i = 0
  while (i < KEYS_RGB.length - 2 && t > KEYS_RGB[i + 1][0]) i++
  const [t0, a] = KEYS_RGB[i], [t1, b] = KEYS_RGB[i + 1]
  const f = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)))
  const c = a.map((ca, k) => ca.map((v, j) => Math.round(v + (b[k][j] - v) * f)))
  const pos = [0, 38, 66, 86, 100]
  return `linear-gradient(to bottom, ${c.map((x, k) => `rgb(${x.join(' ')}) ${pos[k]}%`).join(', ')})`
}

// Cloud masses, lit from below by the low sun. Each is drawn twice, in its
// dawn colours and its daylight colours, and the scroll crossfades the two so
// only opacity and transform change per frame.
const CLOUDS = [
  { box: 'left-[34%] top-[5%] w-[78vw] h-[20vh]',   alpha: 0.55, dx: -14, dy: 6 },
  { box: 'left-[-22%] top-[24%] w-[58vw] h-[13vh]', alpha: 0.35, dx: 10,  dy: -4 },
  { box: 'left-[44%] top-[54%] w-[74vw] h-[15vh]',  alpha: 0.7,  dx: 8,   dy: -12 },
]
const CLOUD_DAWN = 'radial-gradient(closest-side, rgb(255 190 160 / 0.95), rgb(214 132 150 / 0.75) 45%, rgb(122 86 160 / 0.35) 75%, transparent)'
const CLOUD_DAY  = 'radial-gradient(closest-side, rgb(255 255 255 / 0.95), rgb(255 248 240 / 0.7) 50%, rgb(235 242 252 / 0.3) 78%, transparent)'

/** Fixed behind the page; its hour follows the scroll. */
export function SkyBackdrop() {
  const ref    = useRef<HTMLDivElement>(null)
  const glow   = useRef<HTMLDivElement>(null)
  const clouds = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    const paint = () => {
      raf = 0
      const max = document.documentElement.scrollHeight - window.innerHeight
      const t = still ? 0 : Math.min(1, Math.max(0, window.scrollY / Math.max(1, max)))
      if (ref.current) ref.current.style.backgroundImage = skyAt(t)
      // The sun's light climbs the sky as the page goes on.
      if (glow.current) glow.current.style.transform = `translate3d(0, ${(-t * 55).toFixed(2)}vh, 0)`
      // Clouds drift and take the hour's light: warm at dawn, white by day.
      const warm = Math.max(0, 1 - t * 1.4)
      CLOUDS.forEach((c, i) => {
        const el = clouds.current[i]
        if (!el) return
        el.style.transform = `translate3d(${(c.dx * t).toFixed(2)}vw, ${(c.dy * t).toFixed(2)}vh, 0)`
        const [dawn, day] = el.children as unknown as HTMLElement[]
        dawn.style.opacity = (c.alpha * warm).toFixed(3)
        day.style.opacity  = (c.alpha * (1 - warm) * 0.8).toFixed(3)
      })
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(paint) }
    paint()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(raf) }
  }, [])

  return (
    <div aria-hidden className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
      <div ref={ref} className="absolute inset-0" style={{ backgroundImage: skyAt(0) }} />
      <div ref={glow} className="absolute left-[38%] top-[58%] h-[110vh] w-[90vw] will-change-transform"
        style={{ background: 'radial-gradient(closest-side, rgb(255 240 210 / 0.55), rgb(255 214 176 / 0.22) 45%, transparent)' }} />
      {CLOUDS.map((c, i) => (
        <div key={i} ref={el => { clouds.current[i] = el }} className={`absolute ${c.box} will-change-transform`}>
          <div className="absolute inset-0 blur-[48px]" style={{ background: CLOUD_DAWN, opacity: c.alpha }} />
          <div className="absolute inset-0 blur-[48px]" style={{ background: CLOUD_DAY, opacity: 0 }} />
        </div>
      ))}
    </div>
  )
}

type Dash = { y: number; x: number; len: number; a: number; th: number }

// The sun's path on the water: short broken dashes, crowded near the horizon
// and opening out toward the viewer. Seeded, so the water holds still and only
// the light moves with the scroll.
function glintDashes(w: number, h: number): Dash[] {
  let s = 17
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647
  const out: Dash[] = []
  for (let y = 1; y < h; ) {
    const k = y / h                                    // 0 at the horizon, 1 at the viewer
    const spread = 36 + k * w * 0.15
    const n = 2 + Math.floor(rnd() * (3 + k * 5))
    for (let i = 0; i < n; i++) {
      const g = (rnd() + rnd() + rnd() - 1.5) / 1.5    // near-normal, -1..1
      out.push({
        y,
        x:   g * spread,
        len: (5 + rnd() * 28) * (0.6 + k * 1.8),
        a:   (1 - Math.abs(g) * 0.85) * (0.3 + rnd() * 0.7),
        th:  0.8 + k * 1.6 + rnd() * 0.6,
      })
    }
    y += 1.5 + k * 6 + rnd() * 2.5
  }
  return out
}

/** The hero's horizon: a still sea, far headlands, and a sun that rises as the hero scrolls away. */
export function HeroHorizon() {
  const wrap  = useRef<HTMLDivElement>(null)
  const sun   = useRef<HTMLDivElement>(null)
  const glint = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let dashes: Dash[] = [], dw = 0, dh = 0
    const draw = () => {
      raf = 0
      const el = wrap.current, c = glint.current
      if (!el || !c) return
      const r  = el.parentElement!.getBoundingClientRect()
      const hp = still ? 0 : Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)))   // 0 at rest, 1 once the hero has scrolled away
      if (sun.current) sun.current.style.transform = `translate3d(-50%, calc(-50% - ${(hp * 240).toFixed(1)}px), 0)`
      const w = c.clientWidth, h = c.clientHeight, dpr = window.devicePixelRatio || 1
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr) }
      if (w !== dw || h !== dh) { dashes = glintDashes(w, h); dw = w; dh = h }
      const g = c.getContext('2d')!
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, w, h)
      // Longer and brighter as the sun climbs.
      const cx = w * 0.68, reach = 0.9 + hp * 0.7, lift = 0.85 + hp * 0.35
      for (const d of dashes) {
        const k = d.y / h
        const a = d.a * Math.max(0, 0.9 - k * 0.95) * lift
        if (a < 0.02) continue
        const len = d.len * reach
        g.fillStyle = `rgba(255, 236, 204, ${a.toFixed(3)})`
        g.fillRect(cx + d.x * reach - len / 2, d.y, len, d.th)
      }
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(draw) }
    draw()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(raf) }
  }, [])

  // The sea runs on under the next section and dissolves into the sky there,
  // so the hero never ends on a hard edge.
  const fade = 'linear-gradient(to bottom, black 52%, transparent 100%)'
  return (
    <div ref={wrap} aria-hidden className="pointer-events-none absolute inset-0 overflow-x-clip">
      {/* the sun sits on the horizon and climbs as the hero leaves */}
      <div ref={sun} className="absolute left-[68%] top-[77%] h-[70vh] w-[70vh] will-change-transform"
        style={{ transform: 'translate3d(-50%, -50%, 0)', background: 'radial-gradient(closest-side, rgb(255 246 222 / 0.98), rgb(255 222 182 / 0.6) 22%, rgb(255 190 160 / 0.18) 55%, transparent)' }} />
      {/* far headlands: the farther ridge paler, both hazing into the light at the waterline */}
      <svg className="absolute left-0 top-[77%] -translate-y-full w-[58%] h-[12vh]" viewBox="0 0 800 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="ridge-far" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0"   stopColor="#8a6aa8" stopOpacity="0.38" />
            <stop offset="1"   stopColor="#e9a690" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="ridge-near" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0"   stopColor="#2c2156" stopOpacity="0.88" />
            <stop offset="0.6" stopColor="#5b3f7c" stopOpacity="0.72" />
            <stop offset="1"   stopColor="#c28591" stopOpacity="0.5" />
          </linearGradient>
        </defs>
        <path d="M0 100 L0 46 C 90 36, 170 40, 250 48 C 360 58, 430 52, 520 66 C 610 80, 700 92, 800 100 Z" fill="url(#ridge-far)" />
        <path d="M0 100 L0 20 C 50 12, 100 24, 160 34 C 220 44, 280 46, 340 60 C 400 74, 470 88, 560 100 Z" fill="url(#ridge-near)" />
      </svg>
      {/* the sea */}
      <div className="absolute inset-x-0 top-[77%] -bottom-80"
        style={{
          background: 'linear-gradient(to bottom, #e7a38c 0%, #b07a96 7%, #7e5c8e 16%, #3a2f68 30%, #262352 40%, #262352 100%)',
          maskImage: fade, WebkitMaskImage: fade,
        }} />
      <canvas ref={glint} className="absolute inset-x-0 top-[77%] w-full blur-[0.6px]" style={{ height: '23%' }} />
    </div>
  )
}

/** A white paper sheet floating on the sky; every content section sits on one. */
export function Sheet({ children, id, tone = 'paper', className = '' }: { children: ReactNode; id?: string; tone?: 'paper' | 'ink'; className?: string }) {
  return (
    <section id={id} className={`relative scroll-mt-24 mx-auto max-w-sheet px-3 sm:px-5 ${className}`}>
      <div className={`rounded-[22px] sm:rounded-[28px] shadow-sheet ${tone === 'ink' ? 'bg-ink text-ink-text' : 'bg-surface-raised'}`}>
        <div className="max-w-page mx-auto px-5 sm:px-10 lg:px-14 py-14 sm:py-20">
          {children}
        </div>
      </div>
    </section>
  )
}
