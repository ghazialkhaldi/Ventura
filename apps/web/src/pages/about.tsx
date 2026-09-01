import PublicLayout from '../components/layout/PublicLayout'
import Link from 'next/link'

const values = [
  { title: 'Accuracy above all',   desc: 'Financial data leaves no room for error. Every anomaly we surface is explainable, auditable, and traceable to source transactions.' },
  { title: 'Human in the loop',    desc: 'AI accelerates finance teams — it does not replace their judgment. Every consequential action requires human approval by design.' },
  { title: 'Security by default',  desc: 'Enterprise-grade encryption, role-based access, and immutable audit trails are built into the platform, not bolted on.' },
  { title: 'Radical transparency', desc: 'Our AI shows its reasoning. Confidence scores, detection logic, and model decisions are visible to every stakeholder.' },
]

export default function AboutPage() {
  return (
    <PublicLayout title="About">
      {/* Hero */}
      <section className="bg-gradient-to-b from-surface-raised to-surface border-b border-border py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-xs font-semibold text-accent-400 uppercase tracking-widest mb-3">About Ventura</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-text-primary leading-tight">
            Financial operations intelligence for the enterprise
          </h1>
          <p className="text-base text-text-muted mt-4 leading-relaxed">
            Ventura helps finance teams detect anomalies, streamline workflows, and govern AI-driven
            decisions — with full auditability at every step.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-14 bg-surface-raised border-b border-border">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-xl font-bold text-text-primary mb-4">Our mission</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            Enterprise finance teams process millions of transactions across dozens of systems — and errors,
            duplicates, and policy violations slip through every day. Ventura was built on a simple conviction:
            finance teams deserve the same intelligent tooling that transformed engineering and sales. We combine
            AI-powered anomaly detection with strict human-in-the-loop governance, so teams move faster without
            ever losing control.
          </p>
        </div>
      </section>

      {/* Values */}
      <section className="py-14 bg-surface border-b border-border">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-xl font-bold text-text-primary mb-8 text-center">What we believe</h2>
          <div className="grid sm:grid-cols-2 gap-5">
            {values.map(v => (
              <div key={v.title} className="bg-surface-raised border border-border rounded-lg p-5">
                <h3 className="text-sm font-bold text-text-primary mb-2">{v.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-14 bg-surface-raised">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-xl font-bold text-text-primary mb-3">Want to learn more?</h2>
          <p className="text-sm text-text-muted mb-6">See the platform in action or talk to our team about your use case.</p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/demo" className="bg-accent-500 hover:bg-accent-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
              Explore the demo
            </Link>
            <Link href="/contact" className="text-sm font-semibold text-text-secondary hover:text-text-primary border border-border-strong hover:border-border px-5 py-2.5 rounded-lg transition-colors">
              Contact us
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  )
}
