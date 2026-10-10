import PublicLayout from '../components/layout/PublicLayout'
import { CheckCircleIcon } from '@heroicons/react/20/solid'
import { PageIntro, InlineLink } from '../components/marketing/Marketing'

const systems = [
  { name: 'Web Application',       desc: 'Dashboard, anomaly investigation, workflows' },
  { name: 'API',                   desc: 'REST API and integrations endpoints' },
  { name: 'Authentication',        desc: 'Sign-in, MFA, and session management' },
  { name: 'AI Detection Engine',   desc: 'Anomaly detection and confidence scoring' },
  { name: 'Data Ingestion',        desc: 'File uploads and connected source syncs' },
  { name: 'Email Delivery',        desc: 'Verification codes and notifications' },
]

export default function StatusPage() {
  return (
    <PublicLayout title="System Status">
      <PageIntro title="System status" />
      <div className="max-w-page mx-auto px-5 sm:px-8 py-14 sm:py-20">
        <div className="max-w-[44rem]">
          <div className="flex items-center gap-3 rounded-lg border border-positive-line bg-positive-bg px-5 py-4">
            <span className="status-dot w-2.5 h-2.5 bg-positive" />
            <p className="text-[15px] font-medium text-positive-fg">All systems operational</p>
          </div>

          <ul className="mt-6 rounded-lg border border-border divide-y divide-border-subtle">
            {systems.map(s => (
              <li key={s.name} className="flex items-center justify-between gap-4 px-5 py-4">
                <div>
                  <p className="text-[15px] font-medium text-text-primary">{s.name}</p>
                  <p className="mt-0.5 text-[13.5px] text-text-muted">{s.desc}</p>
                </div>
                <span className="flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-positive-fg">
                  <CheckCircleIcon className="w-4 h-4 text-positive" />
                  Operational
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-8 text-[14.5px] text-text-secondary">
            Experiencing an issue not shown here? <InlineLink href="/contact">Contact support</InlineLink>.
          </p>
        </div>
      </div>
    </PublicLayout>
  )
}
