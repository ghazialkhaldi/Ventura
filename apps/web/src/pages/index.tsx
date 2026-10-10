import Link from 'next/link'
import PublicLayout from '../components/layout/PublicLayout'
import {
  FindingsFrame, Figure, VendorBaselineChart, ApprovalLimitChart, MappingPanel, AuditTrail,
} from '../components/marketing/ProductPreview'
import { DawnFindingCard, SystemsStrip } from '../components/marketing/Hero'
import { HeroHorizon, Sheet } from '../components/marketing/Sky'
import { ClosingCTA } from '../components/marketing/Marketing'
import { ArrowRightIcon } from '@radix-ui/react-icons'

const H2 = 'font-display font-medium text-[1.875rem] leading-[1.1] tracking-[-0.025em] sm:text-title'

// ── The ten checks the engine runs ───────────────────────────────────────────
const CHECKS = [
  { name: 'Duplicate payment',         body: 'Same vendor and amount within 30 days. The later payment is flagged; the original is kept as evidence.' },
  { name: 'Split under approval limit', body: 'Several payments to one vendor just under the approval limit, inside a short window.' },
  { name: 'Period cut-off',            body: 'A transaction dated outside the accounting period it is labelled with.' },
  { name: 'Unusual for the vendor',    body: "An amount far above the vendor's own history, once there is enough of it to trust." },
  { name: 'Unusual for the category',  body: "Large relative to the category's own median and spread, not one threshold for the whole register." },
  { name: 'Coding change',             body: 'A vendor with an established coding pattern suddenly booked to a different category.' },
  { name: 'Payment burst',             body: "More payments in a short window than the vendor's own busiest history, weighted higher for new vendors." },
  { name: 'New-vendor risk',           body: 'First appearance, a round amount, weekend posting and materiality, scored together as one finding.' },
  { name: 'Round amounts',             body: 'Round-number payments to vendors with other activity, for invoice support.' },
  { name: 'Missing payee',             body: 'Rows with a blank or unknown vendor, so nothing posts without a counterparty.' },
]

export default function HomePage() {
  return (
    <PublicLayout>

      {/* ── Hero: dawn over still water, the finding held in its light ── */}
      <section data-field className="relative min-h-[calc(100svh-4rem)] lg:min-h-[calc(100svh-5rem)] text-white">
        <HeroHorizon />
        <div className="relative max-w-page mx-auto px-5 sm:px-8 pt-10 sm:pt-16 lg:pt-20 pb-28 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)] lg:gap-16">
          <div>
            <h1 className="font-display font-medium text-[2.75rem] leading-[1.02] tracking-[-0.04em] sm:text-[4rem] lg:text-[4.75rem] max-w-[11ch]">
              Close the month with nothing unexplained.
            </h1>
            <p className="mt-7 max-w-[31rem] text-[17px] sm:text-[18px] leading-[1.6] text-white/90">
              Ventura reads every row of your spend export and shows you the few payments that need
              a second look, each traced to its evidence. Nothing changes until your team decides.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link href="/demo" className="group inline-flex items-center gap-2 h-12 px-6 rounded-full bg-white hover:bg-accent-50 text-accent-800 text-[15.5px] font-medium shadow-pop">
                Walk through the demo
                <ArrowRightIcon className="w-4 h-4 transition-transform duration-200 ease-out-expo group-hover:translate-x-0.5" />
              </Link>
              <Link href="/contact" className="text-[15.5px] font-medium text-white underline underline-offset-4 decoration-white/40 hover:decoration-white">
                Talk to us
              </Link>
            </div>
          </div>
          <div className="lg:pt-28 animate-frame-settle">
            <DawnFindingCard />
          </div>
        </div>
      </section>

      {/* ── The systems, on the morning sky ── */}
      <section data-field className="relative text-white">
        <div className="max-w-page mx-auto px-5 sm:px-8 pt-6 pb-20 sm:pb-24">
          <SystemsStrip />
        </div>
      </section>

      {/* ── The queue ── */}
      <Sheet id="product" className="mb-10 sm:mb-14">
        <div className="grid gap-12 lg:grid-cols-[auto_minmax(0,28rem)] lg:justify-between lg:items-end">
          <div className="flex items-end gap-5 sm:gap-8" role="img" aria-label="1,431 rows in, 5 findings out">
            <Figure_ value="1,431" caption="rows in the example file" muted />
            <svg aria-hidden viewBox="0 0 64 24" className="mb-14 sm:mb-16 w-12 sm:w-16 shrink-0 text-border-strong" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 12h58M50 3l10 9-10 9" />
            </svg>
            <Figure_ value="5" caption="findings worth a person’s time" />
          </div>
          <div>
            <h2 className={`${H2} text-text-primary`}>Fewer findings. The right ones.</h2>
            <p className="mt-5 text-[17px] leading-[1.65] text-text-secondary">
              A list nobody trusts gets ignored. Ventura judges each payment in its own context,
              merges findings that describe the same event, and ranks what is left by severity
              and confidence. Open one, check its rows, and decide.
            </p>
          </div>
        </div>
        <div className="mt-14">
          <FindingsFrame />
        </div>
      </Sheet>

      {/* ── What it catches ── */}
      <Sheet className="mb-10 sm:mb-14">
        <div className="grid gap-12 lg:gap-20 lg:grid-cols-[minmax(0,26rem)_1fr] lg:items-center">
          <div>
            <h3 className="text-heading font-medium text-text-primary">Judged against the vendor&rsquo;s own history</h3>
            <p className="mt-4 text-[16px] leading-[1.7] text-text-secondary">
              A $40,000 payroll remittance is routine. A $27,300 invoice from a vendor you
              normally pay around $3,000 is not. Ventura scores amounts against each category&rsquo;s
              and each vendor&rsquo;s own baseline, so the routine stays quiet and the outlier surfaces.
            </p>
          </div>
          <Figure caption="Atlas Facilities Co., last 15 payments">
            <VendorBaselineChart />
          </Figure>
        </div>
        <div className="mt-20 grid gap-12 lg:gap-20 lg:grid-cols-[1fr_minmax(0,26rem)] lg:items-center">
          <div className="lg:order-2">
            <h3 className="text-heading font-medium text-text-primary">Patterns no single payment reveals</h3>
            <p className="mt-4 text-[16px] leading-[1.7] text-text-secondary">
              Invoices split to stay under an approval limit. A payment dated October but booked
              to September. A vendor suddenly coded to a different account. A first-time payee
              paid a round amount on a Saturday. None of these breaks a rule on its own, so
              Ventura looks at the pattern.
            </p>
          </div>
          <Figure caption="Brightline Staffing, September payments" className="lg:order-1">
            <ApprovalLimitChart />
          </Figure>
        </div>
      </Sheet>

      {/* ── How it works ── */}
      <Sheet id="how" className="mb-10 sm:mb-14">
        <div className="grid gap-14 lg:gap-20 lg:grid-cols-[minmax(0,28rem)_1fr]">
          <div>
            <h2 className={`${H2} text-text-primary`}>From an export to a review queue</h2>
            <p className="mt-5 text-[17px] leading-[1.65] text-text-secondary">
              No integration project. Start from the file your system already produces.
            </p>
            <ol className="mt-12 space-y-9">
              {[
                { t: 'Export', b: 'Pull a GL detail, AP register or bank statement from the system you already use. CSV, Excel and PDF all work.' },
                { t: 'Upload', b: 'Ventura finds the header row, searches every sheet and maps date, vendor, amount and debit or credit columns. Credits are set aside, not dropped.' },
                { t: 'Review', b: 'Findings arrive ranked by severity and confidence, each with its rows. Resolve or dismiss them; every action is logged.' },
              ].map((st, i) => (
                <li key={st.t} className="grid grid-cols-[2rem_1fr] gap-4">
                  <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-accent-50 text-[13px] font-medium text-accent-700 tabular-nums">{i + 1}</span>
                  <div>
                    <p className="text-[17px] font-medium text-text-primary">{st.t}</p>
                    <p className="mt-1.5 text-[15.5px] leading-[1.65] text-text-secondary">{st.b}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="lg:pt-2">
            <MappingPanel />
          </div>
        </div>
      </Sheet>

      {/* ── A person decides: the one night-blue sheet ── */}
      <Sheet tone="ink" className="mb-10 sm:mb-14">
        <div className="grid gap-14 lg:gap-20 lg:grid-cols-[minmax(0,28rem)_1fr] lg:items-start">
          <div>
            <h2 className={`${H2} text-white`}>Ventura recommends. Your team decides.</h2>
            <p className="mt-5 text-[17px] leading-[1.65] text-ink-muted">
              Nothing in Ventura resolves, dismisses or edits a record on its own. Every status
              change is a person&rsquo;s action, recorded with who, what and when.
            </p>
            <dl className="mt-12 divide-y divide-ink-line border-y border-ink-line">
              {[
                { t: 'No autonomous actions',    b: 'Ventura flags and explains. It never pays, voids or edits.' },
                { t: 'Confidence you can read',  b: 'Every finding carries a score from 0 to 100 and the reasoning behind it.' },
                { t: 'Append-only security log', b: 'Sign-ins, MFA checks and team changes are written server-side and cannot be edited.' },
              ].map(d => (
                <div key={d.t} className="py-5">
                  <dt className="text-[15.5px] font-medium text-white">{d.t}</dt>
                  <dd className="mt-1 text-[15px] leading-[1.6] text-ink-muted">{d.b}</dd>
                </div>
              ))}
            </dl>
          </div>
          <AuditTrail />
        </div>
      </Sheet>

      {/* ── The checks ── */}
      <Sheet>
        <div className="max-w-[40rem]">
          <h2 className={`${H2} text-text-primary`}>Ten checks, one review queue</h2>
          <p className="mt-5 text-[17px] leading-[1.65] text-text-secondary">
            Every threshold comes from a stated statistical or control rationale, not from tuning
            to one company&rsquo;s file, so the same settings hold on your register.
          </p>
        </div>
        <dl className="mt-14 grid sm:grid-cols-2 gap-x-14 border-t border-border">
          {CHECKS.map(c => (
            <div key={c.name} className="grid gap-1 py-5 border-b border-border md:grid-cols-[13rem_1fr] md:gap-6">
              <dt className="text-[15.5px] font-medium text-text-primary">{c.name}</dt>
              <dd className="text-[15px] leading-[1.6] text-text-secondary">{c.body}</dd>
            </div>
          ))}
        </dl>
      </Sheet>

      {/* ── Close: by now it is morning ── */}
      <ClosingCTA
        title="Morning, and nothing left unexplained."
        body="Walk through a month-end review on a sample AP register: 1,431 rows, five findings, and the decisions a reviewer makes on them."
      />
    </PublicLayout>
  )
}

function Figure_({ value, caption, muted = false }: { value: string; caption: string; muted?: boolean }) {
  return (
    <div>
      <p className={`font-display font-medium leading-[0.9] tracking-[-0.045em] tabular-nums text-[4rem] sm:text-[5.5rem] lg:text-[6rem] ${muted ? 'text-text-muted/60' : 'text-accent-600'}`}>
        {value}
      </p>
      <p className="mt-3 max-w-[11rem] text-[15px] leading-snug text-text-muted">{caption}</p>
    </div>
  )
}
