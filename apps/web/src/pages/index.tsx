import Link from 'next/link'
import PublicLayout from '../components/layout/PublicLayout'
import { ArrowRightIcon } from '@heroicons/react/20/solid'
import {
  FindingsFrame, Figure, VendorBaselineChart, ApprovalLimitChart, MappingPanel, AuditTrail,
} from '../components/marketing/ProductPreview'

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

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[46%] bg-surface border-t border-border-subtle" />
        <div className="relative max-w-page mx-auto px-5 sm:px-8 pt-14 sm:pt-20 pb-20 sm:pb-28">
          <h1 className="font-display font-medium text-[2.375rem] leading-[1.06] tracking-[-0.03em] sm:text-[3.25rem] lg:text-display max-w-[21ch] text-text-primary">
            Find the spend that needs a second look before close.
          </h1>
          <p className="mt-6 max-w-[36rem] text-[17px] sm:text-[18px] leading-[1.6] text-text-secondary">
            Upload a GL, AP or bank export. Ventura returns a short, ranked list of findings,
            each traced to the rows behind it, and nothing changes until your team decides.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/demo" className="group inline-flex items-center gap-2 h-11 px-5 rounded-md bg-accent-600 hover:bg-accent-700 text-white text-[15px] font-medium shadow-card">
              Walk through the demo
              <ArrowRightIcon className="w-4 h-4 transition-transform duration-200 ease-out-expo group-hover:translate-x-0.5" />
            </Link>
            <Link href="/contact" className="text-[15px] font-medium text-text-primary hover:text-accent-700 underline decoration-border-strong hover:decoration-accent-400">
              Talk to us
            </Link>
          </div>

          <div className="mt-14 sm:mt-16 animate-frame-settle">
            <FindingsFrame />
          </div>
        </div>
      </section>

      {/* ── What it catches ── */}
      <section id="product" className="scroll-mt-16 py-24 sm:py-32">
        <div className="max-w-page mx-auto px-5 sm:px-8">
          <div className="max-w-[40rem]">
            <h2 className={`${H2} text-text-primary`}>
              Fewer findings. The right ones.
            </h2>
            <p className="mt-5 text-[17px] leading-[1.65] text-text-secondary">
              A list nobody trusts gets ignored. Ventura judges each payment in its own context,
              merges findings that describe the same event, and ranks what is left by severity
              and confidence.
            </p>
          </div>

          <div className="mt-20 grid gap-12 lg:gap-20 lg:grid-cols-[minmax(0,26rem)_1fr] lg:items-center">
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

          <div className="mt-24 grid gap-12 lg:gap-20 lg:grid-cols-[1fr_minmax(0,26rem)] lg:items-center">
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
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="scroll-mt-16 py-24 sm:py-32 bg-surface border-y border-border-subtle">
        <div className="max-w-page mx-auto px-5 sm:px-8 grid gap-14 lg:gap-20 lg:grid-cols-[minmax(0,28rem)_1fr]">
          <div>
            <h2 className={`${H2} text-text-primary`}>
              From an export to a review queue
            </h2>
            <p className="mt-5 text-[17px] leading-[1.65] text-text-secondary">
              No integration project. Start from the file your system already produces.
            </p>
            <ol className="mt-12 space-y-9">
              {[
                { t: 'Export', b: 'Pull a GL detail, AP register or bank statement from the system you already use. CSV, Excel and PDF all work.' },
                { t: 'Upload', b: 'Ventura finds the header row, searches every sheet and maps date, vendor, amount and debit or credit columns. Credits are set aside, not dropped.' },
                { t: 'Review', b: 'Findings arrive ranked by severity and confidence, each with its rows. Resolve or dismiss them; every action is logged.' },
              ].map((s, i) => (
                <li key={s.t} className="grid grid-cols-[2rem_1fr] gap-4">
                  <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-border-strong bg-surface-raised text-[13px] font-medium text-text-secondary tabular-nums">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-[17px] font-medium text-text-primary">{s.t}</p>
                    <p className="mt-1.5 text-[15.5px] leading-[1.65] text-text-secondary">{s.b}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="lg:pt-2">
            <MappingPanel />
          </div>
        </div>
      </section>

      {/* ── A person decides ── */}
      <section className="py-24 sm:py-32 bg-ink text-ink-text">
        <div className="max-w-page mx-auto px-5 sm:px-8 grid gap-14 lg:gap-20 lg:grid-cols-[minmax(0,28rem)_1fr] lg:items-start">
          <div>
            <h2 className={`${H2} text-white`}>
              Ventura recommends. Your team decides.
            </h2>
            <p className="mt-5 text-[17px] leading-[1.65] text-ink-muted">
              Nothing in Ventura resolves, dismisses or edits a record on its own. Every status
              change is a person&rsquo;s action, recorded with who, what and when.
            </p>
            <dl className="mt-12 divide-y divide-ink-line border-y border-ink-line">
              {[
                { t: 'No autonomous actions',     b: 'Ventura flags and explains. It never pays, voids or edits.' },
                { t: 'Confidence you can read',   b: 'Every finding carries a score from 0 to 100 and the reasoning behind it.' },
                { t: 'Append-only security log',  b: 'Sign-ins, MFA checks and team changes are written server-side and cannot be edited.' },
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
      </section>

      {/* ── The checks ── */}
      <section className="py-24 sm:py-32">
        <div className="max-w-page mx-auto px-5 sm:px-8">
          <div className="max-w-[40rem]">
            <h2 className={`${H2} text-text-primary`}>
              Ten checks, one review queue
            </h2>
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
        </div>
      </section>

      {/* ── Close ── */}
      <section className="pb-24 sm:pb-32">
        <div className="max-w-page mx-auto px-5 sm:px-8">
          <div className="rounded-2xl bg-surface border border-border px-6 py-12 sm:px-14 sm:py-16 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="max-w-[36rem]">
              <h2 className={`${H2} text-text-primary`}>
                Walk through a review, from upload to close.
              </h2>
              <p className="mt-5 text-[17px] leading-[1.65] text-text-secondary">
                The demo runs on a sample AP register: 1,431 rows, five findings, and the
                decisions a reviewer makes on them.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link href="/demo" className="group inline-flex items-center gap-2 h-11 px-5 rounded-md bg-accent-600 hover:bg-accent-700 text-white text-[15px] font-medium shadow-card">
                Walk through the demo
                <ArrowRightIcon className="w-4 h-4 transition-transform duration-200 ease-out-expo group-hover:translate-x-0.5" />
              </Link>
              <Link href="/contact" className="text-[15px] font-medium text-text-primary hover:text-accent-700 underline decoration-border-strong hover:decoration-accent-400">
                Talk to us
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  )
}
