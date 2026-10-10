import PublicLayout from '../components/layout/PublicLayout'
import { PageIntro, Section, FactList, ClosingCTA, H2_CLASS } from '../components/marketing/Marketing'

const values = [
  { title: 'Accuracy above all',   body: 'Financial data leaves no room for error. Every finding we surface is explainable, auditable, and traceable to source transactions.' },
  { title: 'Human in the loop',    body: 'Automation should speed finance teams up, not replace their judgment. Every consequential action requires a person, by design.' },
  { title: 'Security by default',  body: 'Encryption, role-based access, and an append-only security log are built into the platform, not bolted on.' },
  { title: 'Radical transparency', body: 'Ventura shows its reasoning. Confidence scores, detection logic, and every decision are visible to everyone involved.' },
]

export default function AboutPage() {
  return (
    <PublicLayout title="About">
      <PageIntro
        title="Built for the people who close the books"
        lead="Ventura helps controllers and finance managers find the spend that needs a second look before close, with every finding traced to its rows and every decision made by a person."
      />

      <Section>
        <div className="grid gap-6 md:grid-cols-[minmax(0,18rem)_1fr] md:gap-10">
          <h2 className={H2_CLASS}>Our mission</h2>
          <p className="max-w-[62ch] text-[17px] leading-[1.7] text-text-secondary">
            Finance teams process large volumes of transactions across many systems, and errors,
            duplicates and policy breaches slip through every month. Ventura was built on a simple
            conviction: finance teams deserve the same careful tooling that transformed engineering
            and sales. We combine rule-based anomaly detection with strict human review, so teams move
            faster without ever losing control.
          </p>
        </div>
      </Section>

      <Section tone="muted">
        <h2 className={`${H2_CLASS} mb-10`}>What we believe</h2>
        <FactList items={values} />
      </Section>

      <div className="pt-16 sm:pt-24" />
      <ClosingCTA
        title="See it on a sample close"
        body="Walk through the demo, or tell us how your team reviews spend today."
      />
    </PublicLayout>
  )
}
