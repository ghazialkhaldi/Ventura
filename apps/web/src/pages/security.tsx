import PublicLayout from '../components/layout/PublicLayout'
import { PageIntro, Section, FactList, ClosingCTA } from '../components/marketing/Marketing'

const practices = [
  {
    title: 'Encryption in transit, and where it matters at rest',
    body: 'All traffic is encrypted in transit with TLS. Connected integration credentials (API keys, OAuth secrets) are encrypted at rest with AES-256-GCM. If that encryption key isn\'t configured, the app refuses to save credentials at all rather than falling back to something weaker.',
  },
  {
    title: 'Multifactor authentication',
    body: 'Every sign in needs a verification code sent to your email, for admins and employees alike. The server records that a session passed the code, and refuses every workspace page and data request from one that has not, so a password alone is not enough. Session cookies are SameSite and sent only over HTTPS.',
  },
  {
    title: 'Workspace roles',
    body: 'Viewer, analyst, editor, and admin roles decide what each team member can do. Recording decisions on findings, adding data, changing settings, connecting systems and managing the team are checked on the server, not just hidden in the interface.',
  },
  {
    title: 'Append only security log',
    body: 'Sign-in verification, role changes, member removal, workspace joins, and integration connections are written to a server side log with no update or delete path in the application.',
  },
  {
    title: 'Hardened infrastructure',
    body: 'A Content Security Policy, HSTS, clickjacking protection, and security headers on every response.',
  },
  {
    title: 'Explainable, not autonomous',
    body: 'Anomaly detection runs on a deterministic rule engine, not a black box model. Every finding shows exactly which rule and evidence triggered it. Nothing acts on its own; every status change is a manual, logged decision by someone on your team.',
  },
]

export default function SecurityPage() {
  return (
    <PublicLayout title="Security">
      <PageIntro
        title="Your financial data, protected at every layer"
        lead="Here is specifically what is in place to protect the data finance teams trust us with."
      />
      <Section>
        <FactList items={practices} />
      </Section>
      <ClosingCTA
        title="Reporting a vulnerability"
        body="We take security reports seriously. If you believe you have found a vulnerability in Ventura, tell us and our team will respond promptly."
        primary={{ href: '/contact', label: 'Contact the security team' }}
        secondary={null}
      />
    </PublicLayout>
  )
}
