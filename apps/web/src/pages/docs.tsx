import PublicLayout from '../components/layout/PublicLayout'
import Link from 'next/link'

const guides = [
  {
    title: 'Getting started',
    desc: 'Create your workspace, connect a data source or upload a file, and see your first anomaly report in minutes.',
    steps: ['Sign up and verify your email', 'Connect an integration or upload transactions', 'Review detected anomalies on your dashboard'],
  },
  {
    title: 'Integrations',
    desc: 'Connect QuickBooks, NetSuite, Stripe, Plaid, and more. Each integration syncs transactions automatically.',
    steps: ['Open Integrations from the sidebar', 'Choose a provider and follow the connect flow', 'Data syncs and anomaly detection runs automatically'],
  },
  {
    title: 'Working with anomalies',
    desc: 'Every anomaly includes severity, confidence score, and the reasoning behind the flag. Approve, dismiss, or escalate.',
    steps: ['Filter by severity or status on the Anomalies tab', 'Open an anomaly to see reasoning and source rows', 'Resolve or dismiss with a full audit trail'],
  },
  {
    title: 'AI governance',
    desc: 'Set a confidence threshold that controls which findings get flagged as high-confidence for priority review.',
    steps: ['Open AI Governance, then Settings', 'Set your confidence threshold', 'Review which rules are active versus planned'],
  },
  {
    title: 'Team management',
    desc: 'Invite employees with a workspace code and control what each member can see and do.',
    steps: ['Settings, then Users, then Invite user', 'Share the generated code or link', 'Assign viewer, analyst, or editor roles; changes apply live'],
  },
  {
    title: 'API reference',
    desc: 'Programmatic access to anomalies, workflows, and audit events for Enterprise plans.',
    steps: ['Generate an API key in Settings, then Security', 'Authenticate with a Bearer token', 'Full endpoint documentation is provided during Enterprise onboarding'],
  },
]

export default function DocsPage() {
  return (
    <PublicLayout title="Documentation">
      <section className="bg-gradient-to-b from-surface-raised to-surface border-b border-border py-14">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-xs font-semibold text-accent-400 uppercase tracking-widest mb-3">Documentation</p>
          <h1 className="text-3xl font-bold text-text-primary">Learn Ventura</h1>
          <p className="text-base text-text-muted mt-3">
            Everything you need to set up your workspace, connect data, and put AI-powered
            financial intelligence to work.
          </p>
        </div>
      </section>

      <section className="py-14 bg-surface-raised">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {guides.map(g => (
              <div key={g.title} id={g.title === 'API reference' ? 'api' : undefined} className="border border-border rounded-lg p-5 hover:border-border-strong hover:shadow-sm transition-all">
                <h3 className="text-sm font-bold text-text-primary mb-1.5">{g.title}</h3>
                <p className="text-xs text-text-muted leading-relaxed mb-3">{g.desc}</p>
                <ol className="space-y-1.5">
                  {g.steps.map((s, i) => (
                    <li key={s} className="flex items-start gap-2 text-xs text-text-secondary">
                      <span className="w-4 h-4 rounded-full bg-surface-overlay text-text-muted text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-px">{i + 1}</span>
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <p className="text-sm text-text-muted">
              Can't find what you need?{' '}
              <Link href="/contact" className="text-accent-400 hover:text-accent-300 font-medium">Contact support</Link>
              {' '}or{' '}
              <Link href="/demo" className="text-accent-400 hover:text-accent-300 font-medium">explore the interactive demo</Link>.
            </p>
          </div>
        </div>
      </section>
    </PublicLayout>
  )
}
