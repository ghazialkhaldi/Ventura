import PublicLayout from '../components/layout/PublicLayout'
import { CheckCircleIcon } from '@heroicons/react/24/solid'

const systems = [
  { name: 'Web Application',       desc: 'Dashboard, anomaly investigation, workflows' },
  { name: 'API',                   desc: 'REST API and integrations endpoints' },
  { name: 'Authentication',        desc: 'Sign-in, MFA, and session management' },
  { name: 'AI Detection Engine',   desc: 'Anomaly detection and confidence scoring' },
  { name: 'Data Ingestion',        desc: 'File uploads and connected-source syncs' },
  { name: 'Email Delivery',        desc: 'Verification codes and notifications' },
]

export default function StatusPage() {
  return (
    <PublicLayout title="System Status">
      <section className="py-14 bg-surface-raised min-h-[60vh]">
        <div className="max-w-2xl mx-auto px-6">
          <p className="text-xs font-semibold text-accent-400 uppercase tracking-widest mb-3">Status</p>
          <h1 className="text-3xl font-bold text-text-primary">System status</h1>

          {/* Overall banner */}
          <div className="mt-8 flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-5 py-4">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
            <p className="text-sm font-semibold text-emerald-400">All systems operational</p>
          </div>

          {/* Per-system status */}
          <div className="mt-6 bg-surface-raised border border-border rounded-lg divide-y divide-border-subtle">
            {systems.map(s => (
              <div key={s.name} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-semibold text-text-secondary">{s.name}</p>
                  <p className="text-xs text-text-muted mt-0.5">{s.desc}</p>
                </div>
                <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 flex-shrink-0">
                  <CheckCircleIcon className="w-4 h-4 text-emerald-400" />
                  Operational
                </span>
              </div>
            ))}
          </div>

          <p className="text-xs text-text-muted mt-6">
            Experiencing an issue not shown here?{' '}
            <a href="/contact" className="text-accent-400 hover:text-accent-300 font-medium">Contact support</a>
          </p>
        </div>
      </section>
    </PublicLayout>
  )
}
