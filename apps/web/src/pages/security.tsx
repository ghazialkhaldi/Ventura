import PublicLayout from '../components/layout/PublicLayout'
import Link from 'next/link'
import { ShieldCheckIcon, LockClosedIcon, KeyIcon, DocumentTextIcon, ServerStackIcon, UserGroupIcon } from '@heroicons/react/24/outline'

const practices = [
  { icon: LockClosedIcon,   title: 'Encryption everywhere',      desc: 'Data is encrypted in transit with TLS 1.2+ and at rest with AES-256. Credentials and tokens are never stored in plaintext.' },
  { icon: KeyIcon,          title: 'Multi-factor authentication', desc: 'Email-based verification codes protect every sign-in, for admins and employees alike. Session cookies are HttpOnly and SameSite.' },
  { icon: UserGroupIcon,    title: 'Role-based access control',   desc: 'Granular workspace roles — viewer, analyst, editor, admin — enforced at the API layer with live permission updates.' },
  { icon: DocumentTextIcon, title: 'Immutable audit trails',      desc: 'Every user and AI action is logged append-only, with actor, timestamp, and detail. Admins can review any team member’s activity.' },
  { icon: ServerStackIcon,  title: 'Hardened infrastructure',     desc: 'Strict Content Security Policy, HSTS, clickjacking protection, and security headers on every response.' },
  { icon: ShieldCheckIcon,  title: 'AI governance built-in',      desc: 'AI actions above configurable risk thresholds require human approval. AI can never initiate payments.' },
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
            Security isn't a feature at Ventura — it's the foundation. Here's how we protect
            the data enterprise finance teams trust us with.
          </p>
        </div>
      </section>

      <section className="py-14 bg-surface-raised border-b border-border">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid sm:grid-cols-2 gap-5">
            {practices.map(p => (
              <div key={p.title} className="border border-border rounded-lg p-5 hover:border-border-strong transition-colors">
                <p.icon className="w-5 h-5 text-accent-400 mb-3" />
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
