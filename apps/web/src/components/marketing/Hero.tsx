import { useEffect, useRef, useState } from 'react'
import {
  siQuickbooks, siXero, siSage, siSap, siZoho, siAdp, siGusto, siStripe, siExpensify, siGooglesheets,
  type SimpleIcon,
} from 'simple-icons'
import { CheckIcon, ResetIcon } from '@radix-ui/react-icons'
import { FINDINGS, SEV } from './ProductPreview'

// ── The finding, held in the dawn light ──────────────────────────────────────
// The hero's product proof: one finding with its evidence, the flagged row held
// in focus brackets, and a decision the visitor can make. Example data.

type Status = 'open' | 'resolved' | 'dismissed'

export function DawnFindingCard() {
  const f   = FINDINGS[0]
  const sev = SEV[f.sev]
  const [status, setStatus] = useState<Status>('open')
  return (
    <div className="rounded-2xl bg-surface-raised/[0.97] text-text-primary shadow-sheet ring-1 ring-black/5 overflow-hidden">
      <div className="px-5 sm:px-6 pt-5 sm:pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 h-[22px] px-2 rounded text-[12px] font-medium ring-1 ring-inset ${sev.pill}`}>
            <span className={`status-dot ${sev.dot}`} />{sev.label}
          </span>
          <span className="inline-flex items-center h-[22px] px-2 rounded bg-surface-overlay text-[12px] font-medium text-text-secondary tabular-nums">Confidence {f.confidence}</span>
          <span className="font-mono text-[12px] text-text-muted">{f.id}</span>
          <span className="ml-auto inline-flex items-center h-6 px-2 rounded-md border border-dashed border-border-strong text-[11.5px] text-text-muted">Example data</span>
        </div>
        <p className="mt-3 text-[19px] font-medium tracking-[-0.015em]">{f.title} <span className="text-text-muted font-normal">· {f.vendor}</span></p>
        <p className="mt-1 text-[13.5px] text-text-muted">Rule: {f.rule}</p>
      </div>
      <div className="mt-4">
        <div className="grid grid-cols-[1fr_auto_4.5rem] sm:grid-cols-[4rem_1fr_auto_4.5rem] gap-3 px-5 sm:px-6 py-2 bg-surface text-[12.5px] text-text-muted">
          <span className="hidden sm:block">Row</span><span>Date</span><span className="text-right">Amount</span><span />
        </div>
        {f.rows.map(r => (
          <div key={r.cells[0]} className={`relative grid grid-cols-[1fr_auto_4.5rem] sm:grid-cols-[4rem_1fr_auto_4.5rem] gap-3 px-5 sm:px-6 py-2.5 border-t border-border-subtle text-[13.5px] ${r.flagged ? 'bg-high-bg' : ''}`}>
            {r.flagged && status === 'open' && <FocusBrackets />}
            <span className="hidden sm:block text-text-muted tabular-nums">{r.cells[0]}</span>
            <span className="tabular-nums">{r.cells[1]}</span>
            <span className="text-right font-medium tabular-nums">{r.cells[3]}</span>
            <span className={`text-right text-[12.5px] ${r.flagged ? 'font-medium text-high-fg' : 'text-text-muted'}`}>{r.note}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 px-5 sm:px-6 py-4 border-t border-border-subtle">
        {status === 'open' ? (
          <>
            <span className="mr-auto text-[13px] text-text-muted">Open, awaiting a reviewer</span>
            <button onClick={() => setStatus('dismissed')} className="h-9 px-3.5 rounded-md border border-border-strong hover:bg-surface-overlay text-[13.5px] font-medium whitespace-nowrap">Dismiss</button>
            <button onClick={() => setStatus('resolved')} className="h-9 px-3.5 rounded-md bg-accent-600 hover:bg-accent-700 text-white text-[13.5px] font-medium whitespace-nowrap">Mark resolved</button>
          </>
        ) : (
          <>
            <span className="mr-auto inline-flex items-center gap-2 text-[13.5px] text-text-secondary" role="status">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-positive-bg ring-1 ring-inset ring-positive-line">
                <CheckIcon className="w-3.5 h-3.5 text-positive-fg" />
              </span>
              {status === 'resolved' ? 'Resolved' : 'Dismissed'} by you, logged
            </span>
            <button onClick={() => setStatus('open')} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md hover:bg-surface-overlay text-[13.5px] font-medium text-text-secondary">
              <ResetIcon className="w-3.5 h-3.5" /> Undo
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/** Corner brackets that tighten onto the flagged row, like a lens finding focus. */
function FocusBrackets() {
  const corner = (rot: number, pos: string) => (
    <svg viewBox="0 0 12 12" className={`absolute h-3 w-3 text-high ${pos}`} style={{ transform: `rotate(${rot}deg)` }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M1 11V3a2 2 0 0 1 2-2h8" />
    </svg>
  )
  return (
    <span aria-hidden className="pointer-events-none absolute animate-bracket-in" style={{ inset: '3px 10px' }}>
      {corner(0, 'left-0 top-0')}
      {corner(90, 'right-0 top-0')}
      {corner(270, 'left-0 bottom-0')}
      {corner(180, 'right-0 bottom-0')}
    </span>
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
      <p className="text-[14px] leading-snug text-sky-muted">
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
