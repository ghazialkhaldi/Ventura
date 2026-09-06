import PublicLayout from '../components/layout/PublicLayout'
import Link from 'next/link'

const practices = [
  {
    title: 'Encryption in transit, and where it matters at rest',
    desc: 'All traffic is encrypted in transit with TLS. Connected integration credentials (API keys, OAuth secrets) are encrypted at rest with AES-256-GCM. If that encryption key isn\'t configured, the app refuses to save credentials at all rather than falling back to something weaker.',
  },
  {
    title: 'Multifactor authentication',
    desc: 'Email based verification codes protect every sign in, for admins and employees alike. Session cookies are HttpOnly and SameSite.',
  },
  {
    title: 'Workspace roles',
    desc: 'Viewer, analyst, editor, and admin roles determine what each team member can see and change in the app, checked at sign in and enforced in the interface.',
  },
  {
    title: 'Append only security log',
    desc: 'Sign-in verification, role changes, member removal, workspace joins, and integration connections are written to a server side log with no update or delete path in the application.',
  },
  {
    title: 'Hardened infrastructure',
    desc: 'Strict Content Security Policy, HSTS, clickjacking protection, and security headers on every response.',
  },
  {
    title: 'Explainable, not autonomous',
    desc: 'Anomaly detection runs on a deterministic rule engine, not a black box model. Every finding shows exactly which rule and evidence triggered it. Nothing acts on its own; every status change is a manual, logged decision by someone on your team.',
  },
]

export default function SecurityPage() {
  return (
    <PublicLayout title="Security">
      <section className="bg-gradient-to-b from-surface-raised to-surface border-b border-border py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-xs font-semibold text-accent-400 uppercase tracking-widest mb-3">Security</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-text-primary leading-tight">
            Your financial data, protected at every layer
          </h1>
          <p className="text-base text-text-muted mt-4 leading-relaxed">
            Security isn't a feature at Ventura. It's the foundation. Here's specifically what's in place
            to protect the data enterprise finance teams trust us with.
          </p>
        </div>
      </section>

      <section className="py-14 bg-surface-raised border-b border-border">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid sm:grid-cols-2 gap-5">
            {practices.map(p => (
              <div key={p.title} className="border border-border rounded-lg p-5 hover:border-border-strong transition-colors">
                <h3 className="text-sm font-bold text-text-primary mb-1.5">{p.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 bg-surface">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-xl font-bold text-text-primary mb-3">Reporting a vulnerability</h2>
          <p className="text-sm text-text-muted mb-6 leading-relaxed">
            We take security reports seriously. If you believe you've found a vulnerability in Ventura,
            please reach out and our team will respond promptly.
          </p>
          <Link href="/contact" className="inline-block bg-accent-500 hover:bg-accent-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
            Contact security team
          </Link>
        </div>
      </section>
    </PublicLayout>
  )
}
