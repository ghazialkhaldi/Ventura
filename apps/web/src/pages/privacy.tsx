import Link from 'next/link'
import PublicLayout from '../components/layout/PublicLayout'

const SECTIONS = [
  {
    title: '1. Information we collect',
    body: [
      'Account information: your name, work email address, and company name when you sign up or accept a team invite.',
      'Uploaded financial data: transaction records, vendor names, and amounts from files you upload or accounting systems you connect. See "How your financial data is handled" below for exactly where this data lives.',
      'Team and workspace data: the names, email addresses, and roles of teammates you invite to your workspace.',
      'Integration credentials: API keys and OAuth tokens for third party services you choose to connect (for example QuickBooks or Salesforce). These are encrypted at rest before storage.',
      'Security and account activity: sign in verification events, role changes, team member removals, workspace joins, and integration connections, each with a timestamp and the account that performed it.',
      'Usage data: basic page view and performance data collected automatically via Vercel Analytics when you use the site.',
    ],
  },
  {
    title: '2. How your financial data is handled',
    body: [
      'This is unusual enough that it deserves its own section: when you upload a transaction file or connect an accounting integration, parsing and anomaly detection run in your own browser. The resulting transactions, anomalies, and processing log are stored in your browser\'s local storage on your device, not in a central Ventura database.',
      'Practical consequences: this data does not automatically sync across your devices or to other people in your workspace unless they load it from the same browser. It is removed if you clear your browser\'s site data. It is only as protected as the device and browser you use.',
      'Account level data, uploaded team member/role information, and the security log described above are stored server side with Supabase, our database and authentication provider.',
    ],
  },
  {
    title: '3. How we use your information',
    body: [
      'To provide the service: authenticate you, run anomaly detection, maintain your workspace and team roster, and send verification codes.',
      'To operate and secure the service: detect and prevent abuse, maintain the security log described above, and troubleshoot problems.',
      'To communicate with you: respond to support requests submitted through our contact form, and send account related emails such as sign in codes.',
      'We do not sell your information, and we do not use your data to serve third party advertising.',
    ],
  },
  {
    title: '4. Third party service providers',
    body: [
      'We rely on a small number of infrastructure providers to operate Ventura, each of which processes data on our behalf under its own terms:',
      'Supabase: authentication, account data, and the security log.',
      'Resend: delivery of verification code and account emails.',
      'Vercel: application hosting and basic usage analytics.',
      'If you connect a third party integration (for example QuickBooks or Salesforce), that provider processes data according to its own privacy policy once the connection is active.',
    ],
  },
  {
    title: '5. Data security',
    body: [
      'Traffic to Ventura is encrypted in transit with TLS. Integration credentials are encrypted at rest with AES-256-GCM; if that encryption isn\'t properly configured on our end, we refuse to store the credential rather than fall back to a weaker method. Session cookies are set HttpOnly and SameSite. No security measure is perfect, and we can\'t guarantee absolute security, but these are the specific protections in place today.',
    ],
  },
  {
    title: '6. Cookies',
    body: [
      'We use cookies required for authentication (to keep you signed in) and basic analytics. We do not use third party advertising or cross site tracking cookies.',
    ],
  },
  {
    title: '7. Data retention',
    body: [
      'We retain account and workspace data for as long as your account is active. Financial data processed in your browser persists only as long as it remains in your browser\'s local storage, under your control. You can request deletion of your account and associated server side data at any time; see "Your rights" below.',
    ],
  },
  {
    title: '8. Your rights and choices',
    body: [
      'You can request access to, correction of, or deletion of your personal information by contacting us. If you\'re an employee added to a workspace by an admin, some requests (for example changes to your role) may need to go through your workspace admin.',
      'You can remove locally processed financial data at any time by clearing your browser\'s site data for Ventura, or by using the account controls in Settings.',
    ],
  },
  {
    title: '9. Children\'s privacy',
    body: [
      'Ventura is a business tool intended for use by adults in a professional capacity. It is not directed at children, and we do not knowingly collect information from children.',
    ],
  },
  {
    title: '10. Changes to this policy',
    body: [
      'We may update this policy as the product changes. We\'ll update the "last updated" date below when we do. Material changes will be communicated to account holders.',
    ],
  },
]

export default function PrivacyPage() {
  return (
    <PublicLayout title="Privacy Policy">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-4">Legal</p>
        <h1 className="text-3xl font-normal text-text-primary mb-3">Privacy Policy</h1>
        <p className="text-sm text-text-muted mb-10">Last updated: September 2026</p>

        <p className="text-sm text-text-secondary leading-relaxed mb-10">
          This policy explains what information Ventura collects, how it's used, and where it's stored.
          We've tried to write it in plain language and to describe our actual practices specifically,
          rather than generic language that could apply to any product.
        </p>

        <div className="space-y-9">
          {SECTIONS.map(section => (
            <section key={section.title}>
              <h2 className="text-base font-medium text-text-primary mb-3">{section.title}</h2>
              <div className="space-y-3">
                {section.body.map((p, i) => (
                  <p key={i} className="text-sm text-text-secondary leading-relaxed">{p}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="text-sm text-text-secondary leading-relaxed mt-10 pt-8 border-t border-border">
          Questions about this policy or how Ventura handles your data? Please{' '}
          <Link href="/contact" className="text-accent-400 hover:text-accent-300 font-medium underline underline-offset-2">
            contact our team
          </Link>.
        </p>

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors mt-8"
        >
          Back to home
        </Link>
      </div>
    </PublicLayout>
  )
}
