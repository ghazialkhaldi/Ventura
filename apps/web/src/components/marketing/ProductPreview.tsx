import { useState, useRef, useEffect, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowRightIcon, CheckIcon, ResetIcon as ArrowUturnLeftIcon } from '@radix-ui/react-icons'
import FocusBrackets from '../FocusBrackets'

// The product, shown working on labelled example data. Shared by the home page
// and the demo so both demonstrate the same mechanism: findings traced to rows,
// and a person deciding.

// ── Example findings for the hero inbox ──────────────────────────────────────
// Illustrative only, and labelled as such on the page. Each one mirrors a rule
// the detection engine actually runs.

export type Sev = 'critical' | 'high' | 'medium'
export type Status = 'open' | 'resolved' | 'dismissed'

export interface Finding {
  id:         string
  title:      string
  vendor:     string
  amount:     string
  sev:        Sev
  confidence: number
  rule:       string
  reasoning:  string
  facts:      { label: string; value: string }[]
  cols:       string[]
  rows:       { cells: string[]; flagged?: boolean; note?: string }[]
  history?:   number[]
  signals?:   string[]
}

export const FINDINGS: Finding[] = [
  {
    id: 'ANO-0142',
    title: 'Duplicate payment',
    vendor: 'Corva Freight',
    amount: '$18,420.00',
    sev: 'critical',
    confidence: 96,
    rule: 'The same invoice paid twice',
    reasoning: 'Both payments carry invoice INV-77812 for the same amount, 14 days apart. The earlier payment is treated as the original and kept as evidence; only the later one is flagged.',
    facts: [
      { label: 'Invoice',    value: 'INV-77812' },
      { label: 'Days apart', value: '14' },
      { label: 'At risk',    value: '$18,420.00' },
    ],
    cols: ['Row', 'Date', 'Description', 'Amount'],
    rows: [
      { cells: ['1,284', '2026-09-04', 'INV-77812 Linehaul', '$18,420.00'], note: 'Original' },
      { cells: ['1,302', '2026-09-18', 'INV-77812 Linehaul', '$18,420.00'], flagged: true, note: 'Flagged' },
    ],
  },
  {
    id: 'ANO-0147',
    title: 'Split under approval limit',
    vendor: 'Brightline Staffing',
    amount: '$39,100.00',
    sev: 'high',
    confidence: 91,
    rule: 'Repeated payments just under an approval limit',
    reasoning: 'Four payments in six days, each within 4% of the $10,000 dual-approval limit. None breaches the control on its own; together they total $39,100.',
    facts: [
      { label: 'Approval limit', value: '$10,000' },
      { label: 'Payments',       value: '4 in 6 days' },
      { label: 'Total',          value: '$39,100.00' },
    ],
    cols: ['Row', 'Date', 'Description', 'Amount'],
    rows: [
      { cells: ['1,311', '2026-09-08', 'Temporary labour', '$9,850.00'], flagged: true },
      { cells: ['1,327', '2026-09-10', 'Temporary labour', '$9,700.00'], flagged: true },
      { cells: ['1,333', '2026-09-11', 'Temporary labour', '$9,950.00'], flagged: true },
      { cells: ['1,349', '2026-09-14', 'Temporary labour', '$9,600.00'], flagged: true },
    ],
  },
  {
    id: 'ANO-0151',
    title: 'Posted outside its period',
    vendor: 'Halden Software',
    amount: '$42,000.00',
    sev: 'high',
    confidence: 88,
    rule: 'Transaction date outside its stated period',
    reasoning: 'Dated 2 October but labelled period Sep-26, so it posts to the wrong accounting period. Correct it at source rather than widening the period to absorb it.',
    facts: [
      { label: 'Dated',    value: '2026-10-02' },
      { label: 'Labelled', value: 'Sep-26' },
      { label: 'Posts to', value: 'September' },
    ],
    cols: ['Row', 'Date', 'Period', 'Amount'],
    rows: [
      { cells: ['1,388', '2026-10-02', 'Sep-26', '$42,000.00'], flagged: true },
    ],
  },
  {
    id: 'ANO-0156',
    title: 'Unusual for this vendor',
    vendor: 'Atlas Facilities Co.',
    amount: '$27,300.00',
    sev: 'medium',
    confidence: 82,
    rule: "Amount far above the vendor's own history",
    reasoning: "About 8.7 times this vendor's median payment. Size alone is weak evidence, so the score comes from the vendor's own history, not a register-wide threshold.",
    facts: [
      { label: 'Vendor median', value: '$3,150.00' },
      { label: 'Prior payments', value: '14' },
      { label: 'This payment',  value: '8.7× median' },
    ],
    cols: ['Row', 'Date', 'Description', 'Amount'],
    rows: [
      { cells: ['1,402', '2026-09-24', 'Quarterly maintenance', '$27,300.00'], flagged: true },
    ],
    history: [3020, 3380, 2950, 3150, 3410, 2890, 3260, 3150, 3075, 3540, 2980, 3210, 3150, 3330, 27300],
  },
  {
    id: 'ANO-0160',
    title: 'New vendor, several signals',
    vendor: 'Keystone Advisory LLC',
    amount: '$15,000.00',
    sev: 'medium',
    confidence: 74,
    rule: 'Several risk signals on a first-time vendor',
    reasoning: 'Each signal is weak on its own. Together they describe a payment worth confirming before close: verify the vendor and its bank details.',
    facts: [
      { label: 'First seen', value: '2026-09-26' },
      { label: 'Payments',   value: '1' },
      { label: 'Signals',    value: '4 of 4' },
    ],
    cols: ['Row', 'Date', 'Description', 'Amount'],
    rows: [
      { cells: ['1,417', '2026-09-26', 'Consulting retainer', '$15,000.00'], flagged: true },
    ],
    signals: ['First appearance in the register', 'Round amount', 'Posted on a Saturday', 'Material for the period'],
  },
]

export const SEV: Record<Sev, { label: string; dot: string; pill: string; bar: string }> = {
  critical: { label: 'Critical', dot: 'bg-critical', pill: 'bg-critical-bg text-critical-fg ring-critical-line', bar: 'fill-critical' },
  high:     { label: 'High',     dot: 'bg-high',     pill: 'bg-high-bg text-high-fg ring-high-line',             bar: 'fill-high' },
  medium:   { label: 'Medium',   dot: 'bg-medium',   pill: 'bg-medium-bg text-medium-fg ring-medium-line',       bar: 'fill-medium' },
}

// ── Hero: the findings inbox ─────────────────────────────────────────────────

export function FindingsFrame({ status: controlled, onDecide }: {
  status?:   Record<string, Status>
  onDecide?: (id: string, s: Status) => void
} = {}) {
  const [activeId, setActiveId] = useState(FINDINGS[0].id)
  const [own, setOwn]           = useState<Record<string, Status>>({})
  const status = controlled ?? own
  const active    = FINDINGS.find(f => f.id === activeId) ?? FINDINGS[0]
  const statusOf  = (id: string): Status => status[id] ?? 'open'
  const openCount = FINDINGS.filter(f => statusOf(f.id) === 'open').length

  function onListKey(e: KeyboardEvent<HTMLDivElement>) {
    const fwd  = e.key === 'ArrowDown' || e.key === 'ArrowRight'
    const back = e.key === 'ArrowUp'   || e.key === 'ArrowLeft'
    if (!fwd && !back) return
    e.preventDefault()
    const i    = FINDINGS.findIndex(f => f.id === activeId)
    const next = FINDINGS[(i + (fwd ? 1 : FINDINGS.length - 1)) % FINDINGS.length]
    setActiveId(next.id)
    document.getElementById(`finding-tab-${next.id}`)?.focus()
  }

  return (
    <div className="rounded-xl border border-border bg-surface-raised shadow-frame overflow-hidden">
      {/* App header */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-5 h-auto min-h-[52px] py-2.5 border-b border-border">
        <p className="text-[14px] font-medium text-text-primary">Findings</p>
        <span className="inline-flex items-center h-5 px-1.5 rounded bg-surface-overlay text-[12px] font-medium text-text-secondary tabular-nums">
          {openCount} open
        </span>
        <span className="hidden sm:inline text-[13px] text-text-muted truncate">AP register, Sep 2026.xlsx · 1,431 rows</span>
        <span className="ml-auto inline-flex items-center h-6 px-2 rounded-md border border-dashed border-border-strong text-[12px] text-text-muted">
          Example data
        </span>
      </div>

      <div className="grid lg:grid-cols-[22rem_1fr] lg:min-h-[520px]">
        {/* Inbox */}
        <div
          role="tablist"
          aria-label="Findings"
          onKeyDown={onListKey}
          className="flex lg:block overflow-x-auto snap-x snap-mandatory border-b lg:border-b-0 lg:border-r border-border lg:overflow-y-auto"
        >
          {FINDINGS.map(f => {
            const selected = f.id === activeId
            const st       = statusOf(f.id)
            return (
              <button
                key={f.id}
                id={`finding-tab-${f.id}`}
                role="tab"
                aria-selected={selected}
                aria-controls="finding-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveId(f.id)}
                className={`relative shrink-0 w-[16.5rem] lg:w-full snap-start text-left px-4 sm:px-5 py-3.5 border-r lg:border-r-0 lg:border-b border-border-subtle last:border-0 focus-visible:ring-inset focus-visible:ring-offset-0 ${
                  selected ? 'bg-accent-50' : 'hover:bg-surface-overlay'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`status-dot ${st === 'open' ? SEV[f.sev].dot : 'bg-low'}`} />
                  <span className={`text-[14px] font-medium truncate ${st === 'open' ? 'text-text-primary' : 'text-text-muted line-through decoration-text-muted/40'}`}>
                    {f.title}
                  </span>
                  <span className="ml-auto text-[13px] tabular-nums text-text-secondary">{f.amount}</span>
                </div>
                <div className="mt-1 pl-3.5 flex items-center gap-2 text-[12.5px] text-text-muted">
                  <span className="truncate">{f.vendor}</span>
                  <span aria-hidden>·</span>
                  {st === 'open'
                    ? <span className="shrink-0">{SEV[f.sev].label}, {f.confidence}</span>
                    : <span className="shrink-0 text-positive-fg">{st === 'resolved' ? 'Resolved' : 'Dismissed'}</span>}
                </div>
              </button>
            )
          })}
        </div>

        {/* Open finding */}
        <div id="finding-panel" role="tabpanel" aria-labelledby={`finding-tab-${active.id}`} className="min-w-0">
          <div key={active.id} className="animate-pane-in p-5 sm:p-7">
            <FindingDetail
              f={active}
              status={statusOf(active.id)}
              onDecide={s => {
                if (!controlled) setOwn(prev => ({ ...prev, [active.id]: s }))
                onDecide?.(active.id, s)
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// Columns that give way on a phone so the amount and its role stay visible
const MOBILE_HIDDEN = new Set(['Row', 'Description'])

function FindingDetail({ f, status, onDecide }: { f: Finding; status: Status; onDecide: (s: Status) => void }) {
  const sev = SEV[f.sev]
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 h-[22px] px-2 rounded text-[12px] font-medium ring-1 ring-inset ${sev.pill}`}>
            <span className={`status-dot ${sev.dot}`} />
            {sev.label}
          </span>
          <span className="inline-flex items-center h-[22px] px-2 rounded bg-surface-overlay text-[12px] font-medium text-text-secondary tabular-nums">
            Confidence {f.confidence}
          </span>
          <span className="font-mono text-[12px] text-text-muted">{f.id}</span>
          <Decision status={status} onDecide={onDecide} />
        </div>
        <p className="mt-3 text-[20px] font-medium tracking-[-0.015em] text-text-primary">
          {f.title} <span className="text-text-muted font-normal">· {f.vendor}</span>
        </p>
        <p className="mt-1 text-[13.5px] text-text-muted">Rule: {f.rule}</p>
      </div>

      <div className="grid grid-cols-3 rounded-lg border border-border divide-x divide-border">
        {f.facts.map(x => (
          <div key={x.label} className="px-3 sm:px-4 py-3 min-w-0">
            <p className="text-[12px] text-text-muted truncate">{x.label}</p>
            <p className="mt-0.5 text-[14px] sm:text-[15px] font-medium text-text-primary tabular-nums truncate">{x.value}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="text-[13px] font-medium text-text-primary">Evidence</p>
        <div className="mt-2 rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-surface text-text-muted text-left">
                {f.cols.map((c, i) => (
                  <th key={c} className={`px-3 py-2 font-medium whitespace-nowrap ${i === f.cols.length - 1 ? 'text-right' : ''} ${MOBILE_HIDDEN.has(c) ? 'hidden sm:table-cell' : ''}`}>{c}</th>
                ))}
                <th className="px-3 py-2" aria-label="Role" />
              </tr>
            </thead>
            <tbody>
              {f.rows.map(r => (
                <tr key={r.cells[0]} className={`relative border-t border-border-subtle ${r.flagged ? 'bg-high-bg' : ''}`}>
                  {r.cells.map((c, i) => (
                    <td key={i} className={`px-3 py-2 whitespace-nowrap ${i === 0 ? 'text-text-muted' : 'text-text-primary'} ${i === r.cells.length - 1 ? 'text-right font-medium' : ''} ${MOBILE_HIDDEN.has(f.cols[i]) ? 'hidden sm:table-cell' : ''}`}>{c}</td>
                  ))}
                  <td className={`px-3 py-2 text-right whitespace-nowrap text-[12px] ${r.flagged ? 'text-high-fg font-medium' : 'text-text-muted'}`}>
                    {r.note ?? (r.flagged ? 'Flagged' : '')}
                    {r.flagged && status === 'open' && <FocusBrackets inset="2px" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {f.history && <HistoryStrip values={f.history} />}
        {f.signals && (
          <ul className="mt-3 grid sm:grid-cols-2 gap-x-4 gap-y-1.5">
            {f.signals.map(s => (
              <li key={s} className="flex items-center gap-2 text-[13px] text-text-secondary">
                <CheckIcon className="w-4 h-4 text-medium-fg shrink-0" /> {s}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-[14.5px] leading-[1.65] text-text-secondary max-w-[60ch]">{f.reasoning}</p>

    </div>
  )
}

function Decision({ status, onDecide }: { status: Status; onDecide: (s: Status) => void }) {
  if (status === 'open') {
    return (
      <div className="w-full sm:w-auto sm:ml-auto flex items-center gap-2 mt-2 sm:mt-0">
        <button onClick={() => onDecide('dismissed')} className="h-8 px-3 rounded-md border border-border-strong bg-surface-raised hover:bg-surface-overlay text-[13px] font-medium text-text-primary">
          Dismiss
        </button>
        <button onClick={() => onDecide('resolved')} className="h-8 px-3 rounded-md bg-accent-600 hover:bg-accent-700 text-[13px] font-medium text-white">
          Mark resolved
        </button>
      </div>
    )
  }
  return (
    <div className="w-full sm:w-auto sm:ml-auto flex items-center gap-2 mt-2 sm:mt-0" role="status">
      <span className="inline-flex items-center gap-1.5 text-[13px] text-text-secondary">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-positive-bg ring-1 ring-inset ring-positive-line">
          <CheckIcon className="w-3.5 h-3.5 text-positive-fg" />
        </span>
        {status === 'resolved' ? 'Resolved' : 'Dismissed'} by you, logged
      </span>
      <button onClick={() => onDecide('open')} className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md hover:bg-surface-overlay text-[13px] font-medium text-text-secondary">
        <ArrowUturnLeftIcon className="w-3.5 h-3.5" /> Undo
      </button>
    </div>
  )
}

function HistoryStrip({ values }: { values: number[] }) {
  const max = Math.max(...values)
  return (
    <div className="mt-3 flex items-end gap-1 h-10" aria-label="This vendor's last 15 payments; the last is far above the rest">
      {values.map((v, i) => (
        <span
          key={i}
          className={`flex-1 rounded-sm ${i === values.length - 1 ? 'bg-medium' : 'bg-border-strong'}`}
          style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  )
}

export function Figure({ caption, children, className = '' }: { caption: string; children: ReactNode; className?: string }) {
  return (
    <figure className={`min-w-0 ${className}`}>
      <figcaption className="flex items-center gap-3 pb-3 border-b border-border text-[13px]">
        <span className="font-medium text-text-primary">{caption}</span>
        <span className="ml-auto shrink-0 whitespace-nowrap text-text-muted">Example data</span>
      </figcaption>
      <div className="pt-6">{children}</div>
    </figure>
  )
}

// Charts lay out in the container's real pixel width, so labels keep their size
// on a phone instead of shrinking with a scaled viewBox.
function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null)
  const [w, setW] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

export function VendorBaselineChart() {
  const [ref, W] = useWidth<HTMLDivElement>(320)
  const values = FINDINGS[3].history!
  const H = 240, padL = 40, padB = 28, padT = 28
  const max = 30000
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max)
  const bw = (W - padL) / values.length
  const median = 3150
  return (
    <div ref={ref} className="w-full min-w-0">
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block" role="img" aria-label="Fourteen payments near $3,150, then one payment of $27,300">
      {[0, 10000, 20000, 30000].map(t => (
        <g key={t}>
          <line x1={padL} x2={W} y1={y(t)} y2={y(t)} className="stroke-border-subtle" strokeWidth={1} />
          <text x={padL - 10} y={y(t) + 4} textAnchor="end" className="fill-text-muted" fontSize={11}>${t / 1000}k</text>
        </g>
      ))}
      {values.map((v, i) => {
        const last = i === values.length - 1
        return (
          <rect
            key={i}
            x={padL + i * bw + bw * 0.2}
            y={y(v)}
            width={bw * 0.6}
            height={y(0) - y(v)}
            rx={2}
            className={last ? 'fill-medium' : 'fill-border-strong'}
          />
        )
      })}
      <line x1={padL} x2={W} y1={y(median)} y2={y(median)} className="stroke-text-secondary" strokeDasharray="4 4" strokeWidth={1} />
      <text x={padL + 6} y={y(median) - 8} className="fill-text-secondary" fontSize={11.5}>Vendor median $3,150</text>
      <text x={W} y={y(27300) - 10} textAnchor="end" className="fill-medium-fg" fontSize={12} fontWeight={600}>$27,300 · 8.7× median</text>
      <text x={padL} y={H - 6} className="fill-text-muted" fontSize={11}>Oct 2025</text>
      <text x={W} y={H - 6} textAnchor="end" className="fill-text-muted" fontSize={11}>Sep 2026</text>
    </svg>
    </div>
  )
}

export function ApprovalLimitChart() {
  const [ref, W] = useWidth<HTMLDivElement>(320)
  const H = 240, padL = 40, padB = 28, padT = 16
  const max = 12000
  const x = (day: number) => padL + ((W - padL - 8) * (day - 1)) / 29
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max)
  const pts = [
    { d: 2, v: 4200 }, { d: 8, v: 9850, hit: true }, { d: 10, v: 9700, hit: true },
    { d: 11, v: 9950, hit: true }, { d: 14, v: 9600, hit: true }, { d: 22, v: 3800 }, { d: 29, v: 5100 },
  ]
  return (
    <div ref={ref} className="w-full min-w-0">
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block" role="img" aria-label="Four payments between $9,600 and $9,950 from 8 to 14 September, just under the $10,000 approval limit">
      {[0, 4000, 8000, 12000].map(t => (
        <g key={t}>
          <line x1={padL} x2={W} y1={y(t)} y2={y(t)} className="stroke-border-subtle" strokeWidth={1} />
          <text x={padL - 10} y={y(t) + 4} textAnchor="end" className="fill-text-muted" fontSize={11}>${t / 1000}k</text>
        </g>
      ))}
      <rect x={x(7.4)} y={y(10000)} width={x(14.6) - x(7.4)} height={y(9000) - y(10000)} rx={4} className="fill-high-bg stroke-high-line" strokeWidth={1} />
      <line x1={padL} x2={W} y1={y(10000)} y2={y(10000)} className="stroke-text-primary" strokeDasharray="5 4" strokeWidth={1.25} />
      <text x={W} y={y(10000) - 8} textAnchor="end" className="fill-text-primary" fontSize={11.5} fontWeight={500}>Approval limit $10,000</text>
      {pts.map(p => (
        <circle key={p.d} cx={x(p.d)} cy={y(p.v)} r={p.hit ? 5.5 : 4.5} className={p.hit ? 'fill-high' : 'fill-border-strong'} stroke="white" strokeWidth={1.5} />
      ))}
      <text x={x(11)} y={y(9000) + 18} textAnchor="middle" className="fill-high-fg" fontSize={12} fontWeight={600}>4 payments in 6 days · $39,100</text>
      <text x={padL} y={H - 6} className="fill-text-muted" fontSize={11}>1 Sep</text>
      <text x={W} y={H - 6} textAnchor="end" className="fill-text-muted" fontSize={11}>30 Sep</text>
    </svg>
    </div>
  )
}

export function MappingPanel() {
  const map = [
    ['Posting Date',  'Date'],
    ['Supplier Name', 'Vendor'],
    ['Debit',         'Amount'],
    ['Credit',        'Credit'],
    ['Memo',          'Description'],
    ['GL Account',    'Account'],
  ]
  return (
    <div className="rounded-xl border border-border bg-surface-raised overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border text-[13px]">
        <span className="font-medium text-text-primary">AP Detail, Sep 2026.xlsx</span>
        <span className="ml-auto shrink-0 whitespace-nowrap text-text-muted">Example data</span>
      </div>
      <div className="px-5 py-4 border-b border-border-subtle text-[13.5px] text-text-secondary">
        Header found on row 4 of sheet &ldquo;AP Detail&rdquo;. Columns mapped:
      </div>
      <table className="w-full text-[14px]">
        <thead>
          <tr className="text-left text-[12.5px] text-text-muted">
            <th className="px-5 py-2.5 font-medium">In your file</th>
            <th className="px-5 py-2.5 font-medium">Read as</th>
          </tr>
        </thead>
        <tbody>
          {map.map(([from, to]) => (
            <tr key={from} className="border-t border-border-subtle">
              <td className="px-5 py-2.5 text-text-primary">{from}</td>
              <td className="px-5 py-2.5">
                <span className="inline-flex items-center gap-2 text-text-secondary">
                  <ArrowRightIcon className="w-3.5 h-3.5 text-text-muted" />
                  {to}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="grid grid-cols-3 border-t border-border divide-x divide-border bg-surface">
        {[
          { k: 'Rows read',        v: '1,431' },
          { k: 'Credits set aside', v: '12' },
          { k: 'Findings',         v: '5' },
        ].map(s => (
          <div key={s.k} className="px-5 py-4">
            <p className="text-[12.5px] text-text-muted">{s.k}</p>
            <p className="mt-0.5 text-[18px] font-medium text-text-primary tabular-nums">{s.v}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export interface AuditEvent { t: string; who: string; what: string; detail: string }

export const SAMPLE_AUDIT: AuditEvent[] = [
    { t: 'Sep 30, 09:12', who: 'Ventura', what: 'Finding raised', detail: 'Duplicate payment, Corva Freight, confidence 96' },
    { t: 'Sep 30, 10:05', who: 'd.okafor@yourco.com', what: 'Status changed',  detail: 'Open to Under review' },
    { t: 'Sep 30, 11:40', who: 'd.okafor@yourco.com', what: 'Note added',      detail: '“Second payment confirmed with Corva. Credit note requested.”' },
    { t: 'Sep 30, 16:22', who: 'm.reyes@yourco.com',  what: 'Status changed',  detail: 'Under review to Resolved' },
]

export function AuditTrail({ events = SAMPLE_AUDIT, label = 'ANO-0142' }: { events?: AuditEvent[]; label?: string }) {
  return (
    <div className="rounded-xl border border-ink-line bg-ink-raised overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-ink-line text-[13px]">
        <span className="font-medium text-white">Audit trail</span>
        {label && <span className="font-mono text-[12px] text-ink-muted">{label}</span>}
        <span className="ml-auto text-ink-muted">Example data</span>
      </div>
      <ol className="px-5 py-2" aria-live="polite">
        {events.map((e, i) => (
          <li key={`${e.t}-${i}`} className="relative grid grid-cols-[1.25rem_1fr] gap-3 py-4">
            {i < events.length - 1 && <span aria-hidden className="absolute left-[0.55rem] top-[2.1rem] bottom-[-0.6rem] w-px bg-ink-line" />}
            <span aria-hidden className={`mt-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-ink-raised ${e.who === 'Ventura' ? 'bg-ink-muted' : 'bg-ink-text'}`} />
            <div className="min-w-0">
              <p className="text-[14px] text-white">
                <span className="font-medium">{e.what}</span>
                <span className="text-ink-muted"> by {e.who}</span>
              </p>
              <p className="mt-0.5 text-[13.5px] text-ink-muted">{e.detail}</p>
              <p className="mt-1 text-[12.5px] text-ink-muted/80 tabular-nums">{e.t}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
