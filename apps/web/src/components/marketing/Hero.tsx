import { useEffect, useRef, useState } from 'react'
import {
  siQuickbooks, siXero, siSage, siSap, siZoho, siAdp, siGusto, siStripe, siExpensify, siGooglesheets,
  type SimpleIcon,
} from 'simple-icons'
import { FINDINGS, type Sev } from './ProductPreview'

// ── The ledger matrix ────────────────────────────────────────────────────────
// The hero's signature. The example file's 1,431 rows are drawn as a 53 × 27
// grid, one cell per transaction, shaded by amount. A scan line passes down the
// register like a document scanner; the five rows Ventura flags ignite in their
// severity colour and point to their finding. Example data, labelled as such.

const COLS = 53
const ROWS = 27
const TOTAL = COLS * ROWS            // 1,431
const GAP_RATIO = 0.36               // gap as a share of the cell size
const SWEEP_MS = 7200                // one pass of the scan line
const HOLD_MS = 2600                 // pause on the finished scan before looping

// Where the five findings sit in the register (column, row), spread so their
// labels never collide. Order follows FINDINGS.
const FLAGS: { col: number; row: number; side: 'left' | 'right' }[] = [
  { col: 9,  row: 4,  side: 'right' },
  { col: 41, row: 8,  side: 'left'  },
  { col: 22, row: 13, side: 'right' },
  { col: 46, row: 19, side: 'left'  },
  { col: 14, row: 23, side: 'right' },
]

// Brighter steps of the severity hues, so a flagged cell reads against the
// ultramarine field. Only these five cells ever carry them.
const IGNITE: Record<Sev, string> = { critical: '#ff5a4a', high: '#ff9447', medium: '#ffcc3d' }

// Deterministic "amounts": the same ledger texture on every load and render.
function magnitude(i: number) {
  let x = Math.sin(i * 12.9898 + 78.233) * 43758.5453
  x = x - Math.floor(x)
  return Math.pow(x, 2.4)            // most payments small, a few large
}
const MAG = Array.from({ length: TOTAL }, (_, i) => magnitude(i))

function money(s: string) { return s.replace('.00', '') }

export function LedgerMatrix() {
  const wrapRef   = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [width, setWidth]     = useState(640)
  const [progress, setProgress] = useState(1)    // 0..1 of the sweep; 1 = finished state for SSR and reduced motion

  // Track the available width; the grid fills it exactly.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, Math.floor(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Drive the sweep. Pauses offscreen and in background tabs; reduced motion
  // shows the finished scan, still.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setProgress(1); return }
    let visible = true
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting }, { threshold: 0.05 })
    if (wrapRef.current) io.observe(wrapRef.current)
    let raf = 0, last = performance.now(), t = 900   // open a little way into the sweep
    const loop = (now: number) => {
      const dt = now - last; last = now
      if (visible && !document.hidden) {
        t = (t + dt) % (SWEEP_MS + HOLD_MS)
        setProgress(Math.min(1, t / SWEEP_MS))
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); io.disconnect() }
  }, [])

  const cell   = width / (COLS + (COLS - 1) * GAP_RATIO)
  const gap    = cell * GAP_RATIO
  const pitch  = cell + gap
  const height = ROWS * cell + (ROWS - 1) * gap
  const beamRow = progress * ROWS                         // fractional row the scan line is on
  const caught  = FLAGS.map(f => f.row + 0.5 < beamRow)
  const rowsRead = Math.min(TOTAL, Math.round(Math.min(1, beamRow / ROWS) * TOTAL))
  const compact  = width < 520

  // Paint the grid.
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    c.width = Math.round(width * dpr); c.height = Math.round(height * dpr)
    const g = c.getContext('2d')!
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, width, height)
    const r = Math.min(2, cell * 0.22)

    for (let row = 0; row < ROWS; row++) {
      const read  = row + 1 <= beamRow
      const near  = Math.abs(row + 0.5 - beamRow)        // distance from the scan line, in rows
      for (let col = 0; col < COLS; col++) {
        const i = row * COLS + col
        const m = MAG[i]
        let a = read ? 0.10 + m * 0.66 : 0.05 + m * 0.24
        if (near < 1.4 && progress < 1) a = Math.min(0.95, a + (1.4 - near) * 0.45)
        g.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`
        g.beginPath()
        g.roundRect(col * pitch, row * pitch, cell, cell, r)
        g.fill()
      }
    }

    // The scan line: a bright rule with a soft wash just behind it.
    if (progress < 1) {
      const y = Math.min(height, beamRow * pitch)
      g.fillStyle = 'rgba(255,255,255,0.10)'
      g.fillRect(0, Math.max(0, y - pitch * 2), width, pitch * 2)
      g.fillStyle = 'rgba(255,255,255,0.9)'
      g.fillRect(0, y - 1, width, 2)
    }

    // Caught rows: the cell ignites, with a white ring and a leader to its label.
    FLAGS.forEach((f, k) => {
      if (!caught[k]) return
      const x = f.col * pitch, y = f.row * pitch
      const col = IGNITE[FINDINGS[k].sev]
      g.fillStyle = col
      g.beginPath(); g.roundRect(x - gap * 0.5, y - gap * 0.5, cell + gap, cell + gap, r + 1); g.fill()
      g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 1.5
      g.beginPath(); g.roundRect(x - gap * 0.5 - 2.5, y - gap * 0.5 - 2.5, cell + gap + 5, cell + gap + 5, r + 3); g.stroke()
      if (!compact) {
        const cx = x + cell / 2, cy = y + cell / 2
        const lx = f.side === 'right' ? cx + pitch * 4 : cx - pitch * 4
        const ly = cy - pitch * 2.2
        g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 1
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(lx, ly); g.stroke()
      }
    })
  }, [width, height, cell, gap, pitch, beamRow, progress, compact]) // eslint-disable-line react-hooks/exhaustive-deps

  const latest = [...FLAGS.keys()].filter(k => caught[k]).pop()

  return (
    <figure className="w-full">
      <div ref={wrapRef} className="relative w-full" style={{ height }}>
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0" style={{ width, height }} />
        {!compact && FLAGS.map((f, k) => {
          const fnd = FINDINGS[k]
          const cx = f.col * pitch + cell / 2, cy = f.row * pitch + cell / 2
          const lx = f.side === 'right' ? cx + pitch * 4 : cx - pitch * 4
          const ly = cy - pitch * 2.2
          return (
            <div
              key={fnd.id}
              aria-hidden
              className="absolute -translate-y-1/2"
              style={{
                top: ly,
                left: f.side === 'right' ? lx : undefined,
                right: f.side === 'left' ? width - lx : undefined,
              }}
            >
            <div className={`rounded-md bg-white px-2.5 py-1.5 shadow-pop transition-[opacity,transform] duration-300 ease-out-expo ${caught[k] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}>
              <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-text-primary whitespace-nowrap leading-tight">
                <span className="h-2 w-2 rounded-full" style={{ background: IGNITE[fnd.sev] }} />
                {fnd.title}
              </p>
              <p className="mt-0.5 text-[11.5px] text-text-muted whitespace-nowrap tabular-nums leading-tight">
                {fnd.vendor} · {money(fnd.amount)}
              </p>
            </div>
            </div>
          )
        })}
      </div>
      <figcaption className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13.5px] text-field-muted">
        <span><span className="font-medium text-white tabular-nums">{rowsRead.toLocaleString()}</span> of 1,431 rows read</span>
        <span><span className="font-medium text-white tabular-nums">{caught.filter(Boolean).length}</span> findings</span>
        {compact && latest !== undefined && (
          <span className="basis-full text-white">{FINDINGS[latest].title} · {FINDINGS[latest].vendor} · {money(FINDINGS[latest].amount)}</span>
        )}
        <span className="ml-auto text-[12.5px]">Example data, one cell per transaction</span>
      </figcaption>
      <p className="sr-only">
        Example: an AP register of 1,431 transactions, drawn as a grid. Ventura flags five: a duplicate payment,
        payments split under an approval limit, a payment outside its period, an amount unusual for its vendor,
        and a new vendor paid a round amount.
      </p>
    </figure>
  )
}

// ── Systems strip ────────────────────────────────────────────────────────────
// Official marks only, all in white on the field. Ventura reads exports from
// these systems; it does not sync with them, so the strip says "exports".

// 'word' marks are wordmarks and stand alone; 'symbol' marks carry the name.
const SYSTEMS: { name: string; icon: SimpleIcon; kind: 'word' | 'symbol' }[] = [
  { name: 'QuickBooks',    icon: siQuickbooks,   kind: 'symbol' },
  { name: 'Xero',          icon: siXero,         kind: 'symbol' },
  { name: 'Sage',          icon: siSage,         kind: 'word'   },
  { name: 'SAP',           icon: siSap,          kind: 'word'   },
  { name: 'Zoho',          icon: siZoho,         kind: 'word'   },
  { name: 'ADP',           icon: siAdp,          kind: 'word'   },
  { name: 'Gusto',         icon: siGusto,        kind: 'word'   },
  { name: 'Stripe',        icon: siStripe,       kind: 'symbol' },
  { name: 'Expensify',     icon: siExpensify,    kind: 'symbol' },
  { name: 'Google Sheets', icon: siGooglesheets, kind: 'symbol' },
]

/** An official mark, cropped to its own outline so wordmarks read at a legible size. */
function Mark({ icon, name, kind }: { icon: SimpleIcon; name: string; kind: 'word' | 'symbol' }) {
  const ref = useRef<SVGPathElement>(null)
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  useEffect(() => {
    const b = ref.current?.getBBox()
    if (b && b.width && b.height) setBox({ x: b.x, y: b.y, w: b.width, h: b.height })
  }, [])
  const h = kind === 'word' ? 21 : 22
  const w = box ? Math.round((h * box.w) / box.h) : h
  return (
    <span className="inline-flex shrink-0 items-center gap-2.5 text-white/90">
      <svg
        viewBox={box ? `${box.x} ${box.y} ${box.w} ${box.h}` : '0 0 24 24'}
        width={w}
        height={h}
        fill="currentColor"
        role={kind === 'word' ? 'img' : undefined}
        aria-label={kind === 'word' ? name : undefined}
        aria-hidden={kind === 'word' ? undefined : true}
      >
        <path ref={ref} d={icon.path} />
      </svg>
      {kind === 'symbol' && <span className="text-[15px] font-medium tracking-[-0.01em] whitespace-nowrap">{name}</span>}
    </span>
  )
}

export function SystemsStrip() {
  const row = (dup: boolean) => (
    <ul className="flex shrink-0 items-center gap-14 pr-14" aria-hidden={dup}>
      {SYSTEMS.map(s => <li key={s.name}><Mark icon={s.icon} name={s.name} kind={s.kind} /></li>)}
    </ul>
  )
  return (
    <div className="grid gap-5 lg:grid-cols-[14rem_1fr] lg:items-center lg:gap-10">
      <p className="text-[14px] leading-snug text-field-muted">
        Reads exports from the systems you already use, or any CSV, Excel or PDF file.
      </p>
      <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)]" aria-label="Systems Ventura reads exports from">
        <div className="flex w-max animate-marquee motion-reduce:animate-none">
          {row(false)}
          {row(true)}
        </div>
      </div>
    </div>
  )
}
