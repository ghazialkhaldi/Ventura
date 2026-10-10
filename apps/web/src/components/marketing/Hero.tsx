import { useEffect, useRef, useState } from 'react'
import BrandIcon, { type BrandKey } from '../ui/BrandIcon'

// ── Ledger scan ──────────────────────────────────────────────────────────────
// The hero's signature: an example register streams past a scan line, and the
// rows Ventura would flag light up in their severity colour as they are caught.
// Example data only; it mirrors the findings in the inbox below the hero.

type Sev = 'critical' | 'high' | 'medium'

interface Row {
  date:   string
  vendor: string
  amount: string
  flag?:  { label: string; sev: Sev }
}

const ROWS: Row[] = [
  { date: '2026-09-02', vendor: 'Northgate Office Supply', amount: '$412.18' },
  { date: '2026-09-03', vendor: 'Lumen Telecom',           amount: '$2,240.00' },
  { date: '2026-09-04', vendor: 'Corva Freight',           amount: '$18,420.00' },
  { date: '2026-09-04', vendor: 'Pinecrest Payroll',       amount: '$41,980.55' },
  { date: '2026-09-07', vendor: 'Harbor Cloud',            amount: '$6,120.40' },
  { date: '2026-09-08', vendor: 'Brightline Staffing',     amount: '$9,850.00' },
  { date: '2026-09-09', vendor: 'Meridian Legal',          amount: '$4,800.00' },
  { date: '2026-09-10', vendor: 'Brightline Staffing',     amount: '$9,700.00' },
  { date: '2026-09-11', vendor: 'Atlas Facilities Co.',    amount: '$3,150.00' },
  { date: '2026-09-14', vendor: 'Brightline Staffing',     amount: '$9,600.00', flag: { label: 'Split under limit', sev: 'high' } },
  { date: '2026-09-15', vendor: 'Lumen Telecom',           amount: '$2,240.00' },
  { date: '2026-09-16', vendor: 'Harbor Cloud',            amount: '$5,980.10' },
  { date: '2026-09-18', vendor: 'Corva Freight',           amount: '$18,420.00', flag: { label: 'Duplicate payment', sev: 'critical' } },
  { date: '2026-09-18', vendor: 'Pinecrest Payroll',       amount: '$42,115.20' },
  { date: '2026-09-21', vendor: 'Northgate Office Supply', amount: '$389.74' },
  { date: '2026-09-23', vendor: 'Meridian Legal',          amount: '$4,800.00' },
  { date: '2026-09-24', vendor: 'Atlas Facilities Co.',    amount: '$27,300.00', flag: { label: 'Unusual for vendor', sev: 'medium' } },
  { date: '2026-09-25', vendor: 'Harbor Cloud',            amount: '$6,044.90' },
  { date: '2026-09-26', vendor: 'Keystone Advisory LLC',   amount: '$15,000.00', flag: { label: 'New vendor, round amount', sev: 'medium' } },
  { date: '2026-09-28', vendor: 'Lumen Telecom',           amount: '$2,240.00' },
  { date: '2026-09-29', vendor: 'Pinecrest Payroll',       amount: '$41,702.80' },
  { date: '2026-09-30', vendor: 'Northgate Office Supply', amount: '$455.02' },
  { date: '2026-10-02', vendor: 'Halden Software',         amount: '$42,000.00', flag: { label: 'Outside its period', sev: 'high' } },
  { date: '2026-10-02', vendor: 'Meridian Legal',          amount: '$1,250.00' },
]

const SEV_ROW: Record<Sev, { bg: string; pill: string; dot: string }> = {
  critical: { bg: 'bg-critical-bg', pill: 'bg-white text-critical-fg ring-critical-line', dot: 'bg-critical' },
  high:     { bg: 'bg-high-bg',     pill: 'bg-white text-high-fg ring-high-line',         dot: 'bg-high' },
  medium:   { bg: 'bg-medium-bg',   pill: 'bg-white text-medium-fg ring-medium-line',     dot: 'bg-medium' },
}

const VISIBLE = 8          // rows in the window
const BEAM    = 4          // window index the scan line sits on
const ROW_H   = 44         // px, kept in step with the CSS keyframe
const TOTAL   = 1431       // rows in the example file
const START   = 9          // first frame: two findings already caught

export function LedgerScan() {
  // Opens a few rows in, so the first frame already shows rows being caught
  const [tick, setTick] = useState(START)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTick(ROWS.length - BEAM - 1)          // a settled frame with every row caught
      return
    }
    let visible = true
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting }, { threshold: 0.1 })
    if (ref.current) io.observe(ref.current)
    const id = window.setInterval(() => { if (visible && !document.hidden) setTick(t => t + 1) }, 950)
    return () => { window.clearInterval(id); io.disconnect() }
  }, [])

  const pos      = tick % ROWS.length                         // position in this pass
  const window_  = Array.from({ length: VISIBLE + 1 }, (_, i) => ROWS[(tick + i) % ROWS.length])
  const scanned  = Math.min(TOTAL, Math.round(((pos + BEAM + 1) / ROWS.length) * TOTAL))
  const caught   = ROWS.slice(0, Math.min(ROWS.length, pos + BEAM + 1)).filter(r => r.flag)
  const latest   = caught[caught.length - 1]

  return (
    <div ref={ref} className="rounded-xl bg-surface-raised shadow-pop ring-1 ring-black/5 overflow-hidden text-text-primary">
      <div className="flex items-center gap-3 px-4 sm:px-5 h-12 border-b border-border">
        <span className="relative flex h-2.5 w-2.5" aria-hidden>
          <span className="absolute inline-flex h-full w-full rounded-full bg-accent-400 opacity-60 motion-safe:animate-ping" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent-600" />
        </span>
        <p className="text-[13.5px] font-medium">Scanning</p>
        <p className="hidden sm:block text-[13px] text-text-muted truncate">AP register, Sep 2026.xlsx</p>
        <span className="ml-auto inline-flex items-center h-6 px-2 rounded-md border border-dashed border-border-strong text-[12px] text-text-muted">
          Example data
        </span>
      </div>

      <div className="grid grid-cols-2 border-b border-border text-[12.5px]">
        <div className="px-4 sm:px-5 py-2.5">
          <span className="text-text-muted">Rows read </span>
          <span className="font-medium tabular-nums">{scanned.toLocaleString()}</span>
          <span className="text-text-muted tabular-nums"> / {TOTAL.toLocaleString()}</span>
        </div>
        <div className="px-4 sm:px-5 py-2.5 border-l border-border">
          <span className="text-text-muted">Findings </span>
          <span className="font-medium tabular-nums text-accent-700">{caught.length}</span>
        </div>
      </div>

      {/* The register window. Decorative; the summary below carries the content. */}
      <div aria-hidden className="relative overflow-hidden" style={{ height: VISIBLE * ROW_H }}>
        <div
          className="absolute inset-x-0 z-0 bg-accent-50 border-y border-accent-300"
          style={{ top: BEAM * ROW_H, height: ROW_H }}
        />
        <div key={tick} className="animate-ledger-step relative z-10" style={{ ['--row-h' as string]: `${ROW_H}px` }}>
          {window_.map((r, i) => {
            const hit = r.flag && i <= BEAM
            return (
              <div
                key={`${tick}-${i}`}
                className={`grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 px-4 sm:px-5 border-b border-border-subtle transition-colors duration-300 ${hit ? SEV_ROW[r.flag!.sev].bg : ''}`}
                style={{ height: ROW_H }}
              >
                <span className="text-[12.5px] text-text-muted tabular-nums">{r.date.slice(5)}</span>
                <span className="min-w-0 flex items-center gap-2">
                  <span className="truncate text-[13.5px]">{r.vendor}</span>
                  {hit && (
                    <span className={`hidden sm:inline-flex shrink-0 items-center gap-1.5 h-5 px-1.5 rounded text-[11.5px] font-medium ring-1 ring-inset ${SEV_ROW[r.flag!.sev].pill}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${SEV_ROW[r.flag!.sev].dot}`} />
                      {r.flag!.label}
                    </span>
                  )}
                </span>
                <span className={`text-[13.5px] tabular-nums ${hit ? 'font-medium' : ''}`}>{r.amount}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="px-4 sm:px-5 py-3 border-t border-border bg-surface text-[13px] min-h-[46px] flex items-center" aria-live="off">
        {latest ? (
          <p className="truncate">
            <span className="text-text-muted">Caught: </span>
            <span className="font-medium">{latest.flag!.label}</span>
            <span className="text-text-muted"> · {latest.vendor} · </span>
            <span className="tabular-nums">{latest.amount}</span>
          </p>
        ) : (
          <p className="text-text-muted">Reading every row against its vendor and category&hellip;</p>
        )}
      </div>
      <p className="sr-only">
        Example: Ventura reads a 1,431-row AP register and flags five rows: a duplicate payment, payments
        split under an approval limit, a payment outside its period, an amount unusual for its vendor, and
        a new vendor paid a round amount.
      </p>
    </div>
  )
}

// ── Systems strip ────────────────────────────────────────────────────────────
// Ventura reads exports (CSV, Excel, PDF) from these systems. It does not sync
// with them, so the strip says "exports" and nothing more.

const SYSTEMS: { name: string; brand: BrandKey }[] = [
  { name: 'QuickBooks',   brand: 'quickbooks' },
  { name: 'Xero',         brand: 'xero'       },
  { name: 'NetSuite',     brand: 'netsuite'   },
  { name: 'SAP',          brand: 'sap'        },
  { name: 'ADP',          brand: 'adp'        },
  { name: 'Gusto',        brand: 'gusto'      },
  { name: 'Stripe',       brand: 'stripe'     },
  { name: 'Expensify',    brand: 'expensify'  },
  { name: 'Zoho Books',   brand: 'zoho'       },
  { name: 'Excel and CSV', brand: 'csv'       },
  { name: 'PDF statements', brand: 'documents' },
]

export function SystemsStrip() {
  const pills = (dup: boolean) =>
    SYSTEMS.map(s => (
      <li key={`${s.brand}-${dup}`} aria-hidden={dup} className="shrink-0 inline-flex items-center gap-2.5 h-11 pl-2 pr-4 rounded-full bg-white shadow-card">
        <BrandIcon brand={s.brand} size={26} contained={false} />
        <span className="text-[14px] font-medium text-text-primary whitespace-nowrap">{s.name}</span>
      </li>
    ))
  return (
    <div>
      <p className="text-[14px] text-field-muted">Reads exports from the systems you already use</p>
      <div className="mt-4 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
        <ul className="flex w-max gap-3 animate-marquee motion-reduce:animate-none" aria-label="Systems Ventura reads exports from">
          {pills(false)}
          {pills(true)}
        </ul>
      </div>
    </div>
  )
}
