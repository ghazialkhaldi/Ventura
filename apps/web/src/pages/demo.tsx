import { useState } from 'react'
import PublicLayout from '../components/layout/PublicLayout'
import { ClosingCTA, H2_CLASS } from '../components/marketing/Marketing'
import { Sheet } from '../components/marketing/Sky'
import {
  FINDINGS, FindingsFrame, MappingPanel, AuditTrail, type AuditEvent, type Status,
} from '../components/marketing/ProductPreview'

// A guided walk-through of one month-end review on sample data: the upload,
// the review queue, the decisions, and the record they leave. The visitor's
// own decisions drive the audit trail and the close summary.

const STEPS = [
  { id: 'upload', n: 1, label: 'Upload' },
  { id: 'review', n: 2, label: 'Review' },
  { id: 'record', n: 3, label: 'Record' },
  { id: 'close',  n: 4, label: 'Close'  },
]

const BASE_EVENTS: AuditEvent[] = [
  { t: 'Today, 09:02', who: 'you', what: 'File uploaded', detail: 'AP register, Sep 2026.xlsx · 1,431 rows read, 12 credits set aside' },
  { t: 'Today, 09:02', who: 'Ventura', what: 'Findings raised', detail: `${FINDINGS.length} findings, ranked by severity and confidence` },
]

const amountOf = (s: string) => Number(s.replace(/[^0-9.]/g, ''))
const fmtMoney = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
const now = () => `Today, ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`

export default function DemoPage() {
  const [status, setStatus] = useState<Record<string, Status>>({})
  const [events, setEvents] = useState<AuditEvent[]>(BASE_EVENTS)

  function decide(id: string, s: Status) {
    const f    = FINDINGS.find(x => x.id === id)
    const prev = status[id] ?? 'open'
    setStatus(cur => ({ ...cur, [id]: s }))
    if (!f || prev === s) return
    const word = (x: Status) => (x === 'open' ? 'Open' : x === 'resolved' ? 'Resolved' : 'Dismissed')
    setEvents(cur => [
      ...cur,
      { t: now(), who: 'you', what: 'Status changed', detail: `${id} ${f.title}, ${f.vendor}: ${word(prev)} to ${word(s)}` },
    ])
  }

  const decided   = FINDINGS.filter(f => (status[f.id] ?? 'open') !== 'open')
  const resolved  = FINDINGS.filter(f => status[f.id] === 'resolved')
  const stillOpen = FINDINGS.filter(f => (status[f.id] ?? 'open') === 'open')
  const sum = (xs: typeof FINDINGS) => xs.reduce((n, f) => n + amountOf(f.amount), 0)

  return (
    <PublicLayout title="Product Demo">

      {/* ── Intro ── */}
      <section data-field className="text-white">
        <div className="max-w-page mx-auto px-5 sm:px-8 pt-12 sm:pt-16 pb-14 sm:pb-16">
          <h1 className="font-display font-medium text-[2.25rem] leading-[1.06] tracking-[-0.03em] sm:text-[3.25rem] text-white max-w-[20ch]">
            A month&#8209;end review, on sample data
          </h1>
          <p className="mt-5 max-w-[40rem] text-[17px] leading-[1.6] text-sky-muted">
            Five findings from a sample company&rsquo;s AP register. Work them the way your team
            would: open each one, check the rows behind it, and decide. Every figure here is an example.
          </p>
        </div>
      </section>

      {/* ── Step rail ── */}
      <nav aria-label="Demo steps" className="sticky top-20 lg:top-24 z-40 mb-10 px-3 sm:px-5">
        <div className="max-w-page mx-auto h-12 px-3 flex items-center gap-1 overflow-x-auto rounded-full bg-surface-raised/90 backdrop-blur-md shadow-pop ring-1 ring-black/5">
          {STEPS.map(s => (
            <a key={s.id} href={`#${s.id}`} className="shrink-0 inline-flex items-center gap-2 h-8 px-2.5 rounded-md text-[13.5px] text-text-secondary hover:text-text-primary hover:bg-surface-overlay">
              <span className="font-medium text-text-muted tabular-nums">{s.n}</span>
              {s.label}
            </a>
          ))}
          <span className="ml-auto shrink-0 pl-4 text-[13px] text-text-muted tabular-nums" aria-live="polite">
            {decided.length} of {FINDINGS.length} decided
          </span>
        </div>
      </nav>

      {/* ── 1. Upload ── */}
      <Sheet id="upload" className="mb-10 sm:mb-14">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-20 lg:items-center">
          <div>
            <h2 className={H2_CLASS}><StepNo n={1} />Start from an export</h2>
            <p className="mt-4 text-[16px] leading-[1.7] text-text-secondary">
              The controller exports September&rsquo;s AP register from their accounting system and
              drops it in. Ventura finds the header row, maps the columns and sets credits aside,
              so refunds never read as spend.
            </p>
          </div>
          <MappingPanel />
        </div>
      </Sheet>

      {/* ── 2. Review ── */}
      <Sheet id="review" className="mb-10 sm:mb-14">
        <div>
          <div className="max-w-[40rem]">
            <h2 className={H2_CLASS}><StepNo n={2} />Work the review queue</h2>
            <p className="mt-4 text-[16px] leading-[1.7] text-text-secondary">
              Five findings out of 1,431 rows. Open each one to see the rule that fired, its
              baseline and the rows behind it, then mark it resolved or dismiss it. You can undo
              any decision.
            </p>
          </div>
          <div className="mt-10">
            <FindingsFrame status={status} onDecide={decide} />
          </div>
        </div>
      </Sheet>

      {/* ── 3. Record ── */}
      <Sheet id="record" tone="ink" className="mb-10 sm:mb-14">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-20 lg:items-start">
          <div>
            <h2 className={`${H2_CLASS} !text-white`}><StepNo n={3} dark />Every decision is on the record</h2>
            <p className="mt-4 text-[16px] leading-[1.7] text-ink-muted">
              Ventura raised the findings; every status change after that is yours, recorded with
              who, what and when. This trail fills in as you decide above.
            </p>
          </div>
          <AuditTrail events={events} label="" />
        </div>
      </Sheet>

      {/* ── 4. Close ── */}
      <Sheet id="close" className="mb-10 sm:mb-14">
        <div>
          <div className="max-w-[40rem]">
            <h2 className={H2_CLASS}><StepNo n={4} />Close the period with nothing left unexplained</h2>
            <p className="mt-4 text-[16px] leading-[1.7] text-text-secondary">
              {stillOpen.length === 0
                ? 'Every finding has a decision and a name against it.'
                : `${stillOpen.length} finding${stillOpen.length !== 1 ? 's are' : ' is'} still open. Each one needs a decision before close.`}
            </p>
          </div>
          <dl className="mt-10 grid grid-cols-1 sm:grid-cols-3 border-y border-border divide-y sm:divide-y-0 sm:divide-x divide-border">
            {[
              { k: 'Decided',            v: `${decided.length} of ${FINDINGS.length}` },
              { k: 'Resolved at risk',   v: fmtMoney(sum(resolved)) },
              { k: 'Still open at risk', v: fmtMoney(sum(stillOpen)) },
            ].map(x => (
              <div key={x.k} className="py-5 sm:px-6 sm:first:pl-0">
                <dt className="text-[13px] text-text-muted">{x.k}</dt>
                <dd className="mt-1 text-[24px] font-medium tracking-[-0.02em] text-text-primary tabular-nums">{x.v}</dd>
              </div>
            ))}
          </dl>
          {stillOpen.length > 0 && (
            <a href="#review" className="mt-5 inline-flex text-[14.5px] font-medium text-accent-700 hover:text-accent-800 underline decoration-accent-200 hover:decoration-accent-400">
              Back to the review queue
            </a>
          )}
        </div>
      </Sheet>

      <ClosingCTA
        title="See it on your own export"
        body="Tell us how your team reviews spend today, and we will set you up to run Ventura on a file from your own system."
        primary={{ href: '/contact', label: 'Talk to us' }}
        secondary={{ href: '/', label: 'Back to home' }}
      />
    </PublicLayout>
  )
}

// The step number reads as part of the heading, quieter than the words.
function StepNo({ n, dark = false }: { n: number; dark?: boolean }) {
  return <span className={`mr-3 tabular-nums ${dark ? 'text-ink-muted' : 'text-text-muted'}`}>{n}</span>
}
