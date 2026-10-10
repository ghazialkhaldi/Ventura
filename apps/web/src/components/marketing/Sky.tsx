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

/** Fixed behind the page; its hour follows the scroll. */
export function SkyBackdrop() {
  const ref  = useRef<HTMLDivElement>(null)
  const glow = useRef<HTMLDivElement>(null)

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
    </div>
  )
}

/** The hero's horizon: a still sea, a far headland, and a sun that rises as the hero scrolls away. */
export function HeroHorizon() {
  const wrap  = useRef<HTMLDivElement>(null)
  const sun   = useRef<HTMLDivElement>(null)
  const glint = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    const draw = () => {
      raf = 0
      const el = wrap.current, c = glint.current
      if (!el || !c) return
      const r  = el.parentElement!.getBoundingClientRect()
      const hp = still ? 0 : Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)))   // 0 at rest, 1 once the hero has scrolled away
      if (sun.current) sun.current.style.transform = `translate3d(-50%, calc(-50% - ${(hp * 240).toFixed(1)}px), 0)`
      const w = c.clientWidth, h = c.clientHeight, dpr = window.devicePixelRatio || 1
      if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr) }
      const g = c.getContext('2d')!
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, w, h)
      // The glint: bright lines under the sun, longer and brighter as it rises.
      const cx = w * 0.68, reach = 0.9 + hp * 0.8
      for (let y = 2; y < h; y += 4) {
        const k = y / h
        const lw = (140 + y * 2.3) * reach
        const a = Math.max(0, (0.6 - k * 0.75) * (0.8 + hp * 0.4))
        g.fillStyle = `rgba(255, 238, 205, ${a.toFixed(3)})`
        g.fillRect(cx - lw / 2 + Math.sin(y * 1.7) * 14, y, lw, 1.2)
      }
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(draw) }
    draw()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(raf) }
  }, [])

  return (
    <div ref={wrap} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* the sun sits on the horizon and climbs as the hero leaves */}
      <div ref={sun} className="absolute left-[68%] top-[77%] h-[70vh] w-[70vh] will-change-transform"
        style={{ transform: 'translate3d(-50%, -50%, 0)', background: 'radial-gradient(closest-side, rgb(255 246 222 / 0.98), rgb(255 222 182 / 0.6) 22%, rgb(255 190 160 / 0.18) 55%, transparent)' }} />
      {/* far headland */}
      <svg className="absolute left-0 top-[77%] -translate-y-full w-[42%] h-[11vh]" viewBox="0 0 600 100" preserveAspectRatio="none">
        <path d="M0 100 L0 22 C 60 14, 120 30, 190 40 C 260 50, 330 58, 400 70 C 470 82, 540 92, 600 100 Z" fill="rgb(60 40 90 / 0.55)" />
      </svg>
      {/* the sea */}
      <div className="absolute inset-x-0 top-[77%] bottom-0"
        style={{ background: 'linear-gradient(to bottom, #e7a38c 0%, #b07a96 18%, #7e5c8e 42%, #3a2f68 78%, #1f1e4a 100%)' }} />
      <canvas ref={glint} className="absolute inset-x-0 top-[77%] bottom-0 w-full" style={{ height: '23%' }} />
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
