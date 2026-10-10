import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  siQuickbooks, siXero, siSage, siSap, siZoho, siAdp, siGusto, siStripe, siExpensify, siGooglesheets,
  type SimpleIcon,
} from 'simple-icons'
import { CheckIcon } from '@radix-ui/react-icons'
import { FINDINGS, SEV, type Sev } from './ProductPreview'

// ── Scroll to scan ───────────────────────────────────────────────────────────
// The home hero is a pinned scroll story. The example file's 1,431 rows are a
// 53 × 27 grid, one cell per transaction. Scrolling drives a scan line down the
// register and the five flagged rows ignite; then the view zooms into one of
// them, which opens into its finding, its evidence, and a person's decision.
// Example data throughout, labelled as such.

const COLS = 53
const ROWS = 27
const TOTAL = COLS * ROWS            // 1,431
const GAP_RATIO = 0.36
const FOCUS = 0                      // the finding the story opens: the duplicate payment

const FLAGS: { col: number; row: number; side: 'left' | 'right' }[] = [
  { col: 9,  row: 4,  side: 'right' },
  { col: 41, row: 8,  side: 'left'  },
  { col: 22, row: 13, side: 'right' },
  { col: 46, row: 19, side: 'left'  },
  { col: 14, row: 23, side: 'right' },
]

// Brighter steps of the severity hues so a flagged cell reads on ultramarine.
const IGNITE: Record<Sev, string> = { critical: '#ff5a4a', high: '#ff9447', medium: '#ffcc3d' }

function magnitude(i: number) {
  let x = Math.sin(i * 12.9898 + 78.233) * 43758.5453
  x = x - Math.floor(x)
  return Math.pow(x, 2.4)
}
const MAG = Array.from({ length: TOTAL }, (_, i) => magnitude(i))

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const span  = (p: number, a: number, b: number) => clamp((p - a) / (b - a))
const ease  = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const money = (s: string) => s.replace('.00', '')

// The story's beats, as fractions of the pinned scroll distance.
function beats(p: number) {
  return {
    scan:    span(p, 0.06, 0.48),          // scan line travels the register
    zoom:    ease(span(p, 0.50, 0.66)),    // the view closes in on one flagged row
    card:    ease(span(p, 0.62, 0.72)),    // the row opens into its finding
    decide:  span(p, 0.84, 0.90),          // a person marks it resolved
    logged:  ease(span(p, 0.90, 0.97)),    // and the decision is on the record
  }
}

/** The register, drawn to canvas and steered entirely by props. */
function MatrixCanvas({ width, scan, zoom, showLabels }: { width: number; scan: number; zoom: number; showLabels: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const cell   = width / (COLS + (COLS - 1) * GAP_RATIO)
  const gap    = cell * GAP_RATIO
  const pitch  = cell + gap
  const height = ROWS * cell + (ROWS - 1) * gap
  const beamRow = scan * ROWS
  const caught  = FLAGS.map(f => f.row + 0.5 < beamRow)
  const labelsOn = showLabels && zoom < 0.05

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    c.width = Math.round(width * dpr); c.height = Math.round(height * dpr)
    const g = c.getContext('2d')!
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, width, height)

    // Zoom about the focus cell: it moves to the centre and grows, the rest falls away.
    const f  = FLAGS[FOCUS]
    const fx = f.col * pitch + cell / 2, fy = f.row * pitch + cell / 2
    const k  = 1 + zoom * 7
    const tx = (width / 2 - fx) * zoom, ty = (height / 2 - fy) * zoom
    g.save()
    g.translate(fx + tx, fy + ty); g.scale(k, k); g.translate(-fx, -fy)

    const r = Math.min(2, cell * 0.22)
    for (let row = 0; row < ROWS; row++) {
      const read = row + 1 <= beamRow
      const near = Math.abs(row + 0.5 - beamRow)
      for (let col = 0; col < COLS; col++) {
        const i = row * COLS + col
        const m = MAG[i]
        let a = read ? 0.10 + m * 0.66 : 0.05 + m * 0.24
        if (near < 1.4 && scan > 0 && scan < 1) a = Math.min(0.95, a + (1.4 - near) * 0.45)
        a *= 1 - zoom * 0.92
        if (a < 0.01) continue
        g.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`
        g.beginPath(); g.roundRect(col * pitch, row * pitch, cell, cell, r); g.fill()
      }
    }

    if (scan > 0 && scan < 1 && zoom === 0) {
      const y = beamRow * pitch
      g.fillStyle = 'rgba(255,255,255,0.10)'
      g.fillRect(0, Math.max(0, y - pitch * 2), width, pitch * 2)
      g.fillStyle = 'rgba(255,255,255,0.9)'
      g.fillRect(0, y - 1, width, 2)
    }

    FLAGS.forEach((fl, idx) => {
      if (!caught[idx]) return
      if (idx !== FOCUS && zoom > 0) { g.globalAlpha = 1 - zoom }
      const x = fl.col * pitch, y = fl.row * pitch
      g.fillStyle = IGNITE[FINDINGS[idx].sev]
      g.beginPath(); g.roundRect(x - gap * 0.5, y - gap * 0.5, cell + gap, cell + gap, r + 1); g.fill()
      g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 1.5 / k
      g.beginPath(); g.roundRect(x - gap * 0.5 - 2.5 / k, y - gap * 0.5 - 2.5 / k, cell + gap + 5 / k, cell + gap + 5 / k, r + 3 / k); g.stroke()
      if (labelsOn) {
        const cx = x + cell / 2, cy = y + cell / 2
        const lx = fl.side === 'right' ? cx + pitch * 4 : cx - pitch * 4
        g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 1
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(lx, cy - pitch * 2.2); g.stroke()
      }
      g.globalAlpha = 1
    })
    g.restore()
  }, [width, height, cell, gap, pitch, beamRow, scan, zoom, labelsOn]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative w-full" style={{ height }}>
      <canvas ref={ref} aria-hidden className="absolute inset-0" style={{ width, height }} />
      {labelsOn && FLAGS.map((fl, idx) => {
        const fnd = FINDINGS[idx]
        const cx = fl.col * pitch + cell / 2, cy = fl.row * pitch + cell / 2
        const lx = fl.side === 'right' ? cx + pitch * 4 : cx - pitch * 4
        return (
          <div key={fnd.id} aria-hidden className="absolute -translate-y-1/2"
            style={{ top: cy - pitch * 2.2, left: fl.side === 'right' ? lx : undefined, right: fl.side === 'left' ? width - lx : undefined }}>
            <div className={`rounded-md bg-white px-2.5 py-1.5 shadow-pop transition-[opacity,transform] duration-300 ease-out-expo ${caught[idx] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}>
              <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-text-primary whitespace-nowrap leading-tight">
                <span className="h-2 w-2 rounded-full" style={{ background: IGNITE[fnd.sev] }} />{fnd.title}
              </p>
              <p className="mt-0.5 text-[11.5px] text-text-muted whitespace-nowrap tabular-nums leading-tight">{fnd.vendor} · {money(fnd.amount)}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** The finding the zoom opens into, with the decision played by the scroll. */
function FindingCard({ decide, logged }: { decide: number; logged: number }) {
  const f   = FINDINGS[FOCUS]
  const sev = SEV[f.sev]
  const resolved = decide >= 0.6
  const pressing = decide > 0.15 && decide < 0.6
  return (
    <div className="w-full">
      <div className="rounded-xl bg-surface-raised text-text-primary shadow-pop ring-1 ring-black/5 overflow-hidden">
        <div className="px-5 pt-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 h-[22px] px-2 rounded text-[12px] font-medium ring-1 ring-inset ${sev.pill}`}>
              <span className={`status-dot ${sev.dot}`} />{sev.label}
            </span>
            <span className="inline-flex items-center h-[22px] px-2 rounded bg-surface-overlay text-[12px] font-medium text-text-secondary tabular-nums">Confidence {f.confidence}</span>
            <span className="font-mono text-[12px] text-text-muted">{f.id}</span>
            <span className="ml-auto inline-flex items-center h-6 px-2 rounded-md border border-dashed border-border-strong text-[11.5px] text-text-muted">Example data</span>
          </div>
          <p className="mt-3 text-[18px] font-medium tracking-[-0.015em]">{f.title} <span className="text-text-muted font-normal">· {f.vendor}</span></p>
          <p className="mt-1 text-[13px] text-text-muted">Rule: {f.rule}</p>
        </div>
        <table className="mt-4 w-full text-[13px]">
          <thead>
            <tr className="bg-surface text-left text-text-muted">
              <th className="px-5 py-2 font-medium">Row</th>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium text-right">Amount</th>
              <th className="px-5 py-2" aria-label="Role" />
            </tr>
          </thead>
          <tbody>
            {f.rows.map(r => (
              <tr key={r.cells[0]} className={`border-t border-border-subtle ${r.flagged ? 'bg-high-bg' : ''}`}>
                <td className="px-5 py-2 text-text-muted tabular-nums">{r.cells[0]}</td>
                <td className="px-3 py-2 tabular-nums">{r.cells[1]}</td>
                <td className="px-3 py-2 text-right font-medium tabular-nums">{r.cells[3]}</td>
                <td className={`px-5 py-2 text-right text-[12px] ${r.flagged ? 'font-medium text-high-fg' : 'text-text-muted'}`}>{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center gap-2 px-5 py-4 border-t border-border-subtle">
          {resolved ? (
            <span className="inline-flex items-center gap-2 text-[13.5px] text-text-secondary">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-positive-bg ring-1 ring-inset ring-positive-line">
                <CheckIcon className="w-3.5 h-3.5 text-positive-fg" />
              </span>
              Resolved by you, logged
            </span>
          ) : (
            <span className="text-[13px] text-text-muted">Open, awaiting a reviewer</span>
          )}
          <span className={`ml-auto inline-flex shrink-0 items-center whitespace-nowrap h-8 px-3 rounded-md border border-border-strong text-[13px] font-medium transition-opacity duration-200 ${resolved ? 'opacity-0' : 'opacity-100'}`}>Dismiss</span>
          <span className={`inline-flex shrink-0 items-center whitespace-nowrap h-8 px-3 rounded-md text-[13px] font-medium text-white transition-[transform,background-color,opacity] duration-200 ease-out-expo ${resolved ? 'opacity-0' : 'opacity-100'} ${pressing ? 'bg-accent-800 scale-[0.96] ring-4 ring-accent-200' : 'bg-accent-600'}`}>Mark resolved</span>
        </div>
      </div>
      <div className="mt-4 flex items-start gap-3 text-[13.5px] text-white transition-[opacity,transform] duration-200"
        style={{ opacity: logged, transform: `translateY(${(1 - logged) * 8}px)` }}>
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-white" />
        <p><span className="font-medium">Status changed</span><span className="text-field-muted"> by you · Open to Resolved · written to the audit trail</span></p>
      </div>
    </div>
  )
}

const STEPS = [
  { label: 'Scan',   caption: 'Every row read against its vendor and category' },
  { label: 'Trace',  caption: 'Each finding opens to the rows behind it' },
  { label: 'Decide', caption: 'A person resolves it, and it is on the record' },
]

export function ScrollScanHero({ children }: { children: ReactNode }) {
  const sectionRef = useRef<HTMLElement>(null)
  const trackRef   = useRef<HTMLDivElement>(null)
  const stageRef   = useRef<HTMLDivElement>(null)
  const [p, setP]           = useState(0)
  const [width, setWidth]   = useState(600)
  const [still, setStill]   = useState(false)

  // Stage width drives the grid size.
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(260, Math.floor(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Scroll position → story progress, eased toward its target so scrubbing
  // feels weighted rather than stepped. Desktop pins the whole hero; phones pin
  // only the stage, after the copy has scrolled past.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setStill(true); setP(1); return }
    const lg = window.matchMedia('(min-width: 1024px)')
    let target = 0, current = 0, raf = 0
    const measure = () => {
      const el = lg.matches ? sectionRef.current : trackRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const travel = r.height - (window.innerHeight - 64)
      target = clamp((64 - r.top) / Math.max(1, travel))
    }
    const tick = () => {
      current += (target - current) * 0.16
      if (Math.abs(target - current) < 0.0005) current = target
      setP(current)
      raf = current === target ? 0 : requestAnimationFrame(tick)
    }
    const onScroll = () => { measure(); if (!raf) raf = requestAnimationFrame(tick) }
    measure(); current = target; setP(current)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(raf) }
  }, [])

  const b = beats(p)
  const compact = width < 520
  const step = b.decide > 0 ? 2 : b.zoom > 0.3 ? 1 : 0
  const rowsRead = Math.round(b.scan * TOTAL)
  const found = FLAGS.filter(f => f.row + 0.5 < b.scan * ROWS).length

  const stage = (
    <div className="w-full">
      {still ? (
        <div ref={stageRef} className="w-full space-y-8">
          <MatrixCanvas width={width} scan={1} zoom={0} showLabels={!compact} />
          <FindingCard decide={1} logged={1} />
        </div>
      ) : (
      <div ref={stageRef} className="relative w-full min-h-[400px] flex items-center">
        <div className="w-full" style={{ opacity: Math.max(0, 1 - b.card * 1.8) }}>
          <MatrixCanvas width={width} scan={b.scan} zoom={b.zoom} showLabels={!compact} />
        </div>
        {/* The focus row opens into its finding: the card grows out of the centre the zoom left it in. */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ opacity: b.card, transform: `scale(${0.35 + 0.65 * b.card})`, visibility: b.card > 0.01 ? 'visible' : 'hidden' }}>
          <div className="w-full max-w-[34rem]">
            <FindingCard decide={b.decide} logged={b.logged} />
          </div>
        </div>
      </div>
      )}

      {/* Where the story is, in words and figures */}
      <div className="mt-6">
        <ol className="grid grid-cols-3 gap-3" aria-label="Scan, trace, decide">
          {STEPS.map((s, i) => {
            const fill = i < step ? 1 : i === step ? (i === 0 ? b.scan : i === 1 ? b.card : b.logged) : 0
            return (
              <li key={s.label}>
                <div className="h-[3px] rounded-full bg-white/20 overflow-hidden">
                  <div className="h-full bg-white" style={{ width: `${fill * 100}%` }} />
                </div>
                <p className={`mt-2 text-[13px] font-medium ${i === step ? 'text-white' : 'text-field-muted'}`}>{s.label}</p>
              </li>
            )
          })}
        </ol>
        <p className="mt-2 text-[13.5px] text-field-muted min-h-[1.5em]">
          {step === 0 && (
            <>
              <span className="font-medium text-white tabular-nums">{rowsRead.toLocaleString()}</span> of 1,431 rows read ·{' '}
              <span className="font-medium text-white tabular-nums">{found}</span> findings
              {p < 0.04 && !still && <span> · scroll to scan</span>}
            </>
          )}
          {step > 0 && STEPS[step].caption}
        </p>
      </div>
      <p className="sr-only">
        Example: an AP register of 1,431 transactions. Ventura flags five, including a duplicate payment to
        Corva Freight of $18,420, paid 14 days after the original. A reviewer marks it resolved, and the change
        is written to the audit trail.
      </p>
    </div>
  )

  return (
    <section ref={sectionRef} data-field className={`bg-field text-white ${still ? '' : 'lg:h-[330vh]'}`}>
      <div className={`${still ? '' : 'lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)]'} max-w-page mx-auto px-5 sm:px-8 lg:flex lg:items-center`}>
        <div className="w-full grid gap-12 pt-12 sm:pt-16 lg:pt-0 lg:grid-cols-[minmax(0,27rem)_minmax(0,1fr)] lg:gap-16 lg:items-center">
          <div>{children}</div>
          {/* Phones: the stage pins on its own once the copy has scrolled away. */}
          <div ref={trackRef} className={still ? '' : 'h-[260vh] lg:h-auto'}>
            <div className={`${still ? '' : 'sticky top-16 h-[calc(100svh-4rem)] lg:static lg:h-auto'} flex items-center`}>
              {stage}
            </div>
          </div>
        </div>
      </div>
    </section>
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
