import { useState, useEffect } from 'react'
import AppLayout from '../components/layout/AppLayout'
import PageHeader from '../components/ui/PageHeader'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import { Card, CardHeader, CardDivider } from '../components/ui/Card'
import DataEmptyState from '../components/ui/DataEmptyState'
import { useDataReady } from '../hooks/useDataReady'
import { loadDataset } from '../lib/dataStore'
import type { AuditEntry, DetectedAnomaly } from '../lib/dataStore'
import {
  Zap, Shield, AlertTriangle, CheckCircle, Clock,
  Settings, ChevronRight, BarChart2, XCircle, Info,
} from 'lucide-react'

type AITab = 'overview' | 'routing' | 'history' | 'settings'

const modelRoutes = [
  { tier: 'Low Risk',    model: 'claude-haiku-4-5', threshold: '≥ 80%',  autoApprove: true,  examples: 'Receipt compliance, category matching, subscription detection' },
  { tier: 'Medium Risk', model: 'claude-sonnet-4-6', threshold: '≥ 85%', autoApprove: true,  examples: 'Spend spike analysis, vendor pattern matching, three-way match' },
  { tier: 'High Risk',   model: 'claude-sonnet-4-6', threshold: '≥ 90%', autoApprove: false, examples: 'Behavioral anomaly, payment threshold violations, payroll fraud' },
  { tier: 'Critical',    model: 'claude-opus-4-8',   threshold: 'Always', autoApprove: false, examples: 'Account compromise signals, CISO-required review items' },
]

const tierColor: Record<string, string> = {
  'Low Risk':    'bg-green-50 text-green-700 border border-green-200',
  'Medium Risk': 'bg-amber-50 text-amber-700 border border-amber-200',
  'High Risk':   'bg-orange-50 text-orange-700 border border-orange-200',
  'Critical':    'bg-red-50 text-red-700 border border-red-200',
}

function severityTier(a: DetectedAnomaly): string {
  if (a.severity === 'CRITICAL') return 'Critical'
  if (a.severity === 'HIGH')     return 'High Risk'
  if (a.severity === 'MEDIUM')   return 'Medium Risk'
  return 'Low Risk'
}

export default function AIGovernancePage() {
  const { isReady, mounted } = useDataReady()
  const [activeTab,            setActiveTab]            = useState<AITab>('overview')
  const [confidenceThreshold,  setConfidenceThreshold]  = useState(85)
  const [auditLog,             setAuditLog]             = useState<AuditEntry[]>([])
  const [anomalies,            setAnomalies]            = useState<DetectedAnomaly[]>([])

  useEffect(() => {
    if (isReady) {
      const ds = loadDataset()
      setAuditLog(ds?.auditLog ?? [])
      setAnomalies(ds?.anomalies ?? [])
    }
  }, [isReady])

  const tabs: { id: AITab; label: string }[] = [
    { id: 'overview',  label: 'Overview' },
    { id: 'routing',   label: 'Model Routing' },
    { id: 'history',   label: 'Detection Log' },
    { id: 'settings',  label: 'Settings' },
  ]

  if (mounted && !isReady) {
    return (
      <AppLayout title="AI Governance">
        <DataEmptyState
          title="No AI governance events yet"
          description="Upload your financial data or connect a data source on the Dashboard. Every AI analysis, confidence score, and human approval decision will be logged here for full auditability."
        />
      </AppLayout>
    )
  }

  const criticalAnomalies = anomalies.filter(a => a.severity === 'CRITICAL')
  const highAnomalies     = anomalies.filter(a => a.severity === 'HIGH')
  const autoApproved      = anomalies.filter(a => a.severity === 'MEDIUM' || a.severity === 'LOW').length
  const humanRequired     = criticalAnomalies.length + highAnomalies.length
  const avgConf           = anomalies.length > 0 ? Math.round(anomalies.reduce((s, a) => s + a.confidence, 0) / anomalies.length) : 0

  return (
    <AppLayout title="AI Governance">
      <PageHeader
        title="AI Governance"
        subtitle="Model routing, confidence thresholds, human approvals, and execution audit trail"
        actions={<Button variant="secondary" size="sm" icon={<Settings className="w-3.5 h-3.5" />}>Configure</Button>}
        className="mb-6"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Anomalies analyzed',  value: anomalies.length,   color: 'text-slate-800' },
          { label: 'Auto-classified',     value: autoApproved,       color: 'text-green-700' },
          { label: 'Human review needed', value: humanRequired,      color: 'text-red-700'   },
          { label: 'Avg confidence',      value: `${avgConf}%`,      color: 'text-emerald-700'  },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-card">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0.5 mb-6 border-b border-slate-200">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader title="Anomaly severity breakdown" subtitle="From your uploaded data" icon={<BarChart2 className="w-4 h-4" />} />
              <CardDivider />
              {anomalies.length === 0 ? (
                <p className="text-xs text-slate-400 py-3">No anomalies detected.</p>
              ) : (
                <div className="space-y-3">
                  {[
                    { label: 'Critical', count: criticalAnomalies.length, color: 'bg-red-500' },
                    { label: 'High',     count: highAnomalies.length,     color: 'bg-orange-500' },
                    { label: 'Medium',   count: anomalies.filter(a => a.severity === 'MEDIUM').length, color: 'bg-amber-500' },
                    { label: 'Low',      count: anomalies.filter(a => a.severity === 'LOW').length, color: 'bg-green-500' },
                  ].map((row) => {
                    const pct = anomalies.length > 0 ? Math.round((row.count / anomalies.length) * 100) : 0
                    return (
                      <div key={row.label} className="flex items-center gap-3">
                        <span className="text-xs text-slate-500 w-16 flex-shrink-0">{row.label}</span>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${row.color}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-slate-700 w-8 text-right">{row.count}</span>
                        <span className="text-xs text-slate-400 w-8 text-right">{pct}%</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
            <Card>
              <CardHeader title="Risk tier distribution" subtitle="Model routing by anomaly tier" icon={<Shield className="w-4 h-4" />} />
              <CardDivider />
              {anomalies.length === 0 ? (
                <p className="text-xs text-slate-400 py-3">No data to display.</p>
              ) : (
                <div className="space-y-3">
                  {[
                    { label: 'Low risk',    count: anomalies.filter(a => a.severity === 'LOW').length,      color: 'bg-green-500' },
                    { label: 'Medium risk', count: anomalies.filter(a => a.severity === 'MEDIUM').length,   color: 'bg-amber-500' },
                    { label: 'High risk',   count: highAnomalies.length,                                    color: 'bg-red-500'   },
                  ].map((row) => {
                    const pct = anomalies.length > 0 ? Math.round((row.count / anomalies.length) * 100) : 0
                    return (
                      <div key={row.label} className="flex items-center gap-3">
                        <span className="text-xs text-slate-500 w-20 flex-shrink-0">{row.label}</span>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${row.color}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-slate-700 w-6 text-right">{row.count}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          </div>
          <Card>
            <CardHeader title="Active governance rules" subtitle="Currently enforced" icon={<Shield className="w-4 h-4" />} />
            <CardDivider />
            <div className="space-y-2">
              {[
                { rule: 'High-risk AI actions require human approval before execution', status: 'Enforced', icon: CheckCircle, color: 'text-green-600' },
                { rule: `Minimum confidence threshold: ${confidenceThreshold}% for auto-approval`, status: 'Enforced', icon: CheckCircle, color: 'text-green-600' },
                { rule: 'Critical-tier: always route to CISO + CFO review', status: 'Enforced', icon: CheckCircle, color: 'text-green-600' },
                { rule: 'AI cannot initiate payments — humans must approve', status: 'Enforced', icon: CheckCircle, color: 'text-green-600' },
                { rule: 'All AI inferences are logged with full provenance', status: 'Enforced', icon: CheckCircle, color: 'text-green-600' },
                { rule: 'Model explanations required before human approval UI', status: 'Draft', icon: Clock, color: 'text-amber-600' },
              ].map((r, i) => {
                const Icon = r.icon
                return (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                    <Icon className={`w-4 h-4 flex-shrink-0 ${r.color}`} />
                    <span className="text-sm text-slate-700 flex-1">{r.rule}</span>
                    <span className={`text-xs font-medium ${r.status === 'Enforced' ? 'text-green-700' : 'text-amber-700'}`}>{r.status}</span>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ── Model routing ── */}
      {activeTab === 'routing' && (
        <div className="bg-white border border-slate-200 rounded-lg shadow-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Risk Tier', 'Model', 'Confidence threshold', 'Auto-approve?', 'Example tasks', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {modelRoutes.map((row) => (
                <tr key={row.tier} className="hover:bg-slate-50">
                  <td className="px-4 py-4">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${tierColor[row.tier]}`}>{row.tier}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-1 rounded">{row.model}</span>
                  </td>
                  <td className="px-4 py-4 text-sm font-semibold text-slate-800">{row.threshold}</td>
                  <td className="px-4 py-4">
                    {row.autoApprove
                      ? <Badge variant="green"><CheckCircle className="w-3 h-3 inline mr-1" />Yes</Badge>
                      : <Badge variant="red"><XCircle className="w-3 h-3 inline mr-1" />No — human required</Badge>}
                  </td>
                  <td className="px-4 py-4 text-xs text-slate-500 max-w-xs">{row.examples}</td>
                  <td className="px-4 py-4">
                    <Button variant="ghost" size="sm">Edit</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Detection log ── */}
      {activeTab === 'history' && (
        <div className="bg-white border border-slate-200 rounded-lg shadow-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Timestamp', 'Anomaly', 'Type', 'Severity', 'Confidence', 'Amount', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {anomalies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-sm text-slate-500">
                    No anomalies detected in your data.
                  </td>
                </tr>
              ) : anomalies.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{new Date(a.detectedAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-slate-800 max-w-xs">
                    <p className="truncate">{a.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{a.vendor}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">{a.type}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="severity" value={a.severity}>{a.severity}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-10 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${a.confidence}%` }} />
                      </div>
                      <span className="text-xs text-slate-600">{a.confidence}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-slate-600">
                    {a.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-3">
                    <a href={`/anomalies/${a.id}`} className="text-xs text-emerald-600 hover:text-emerald-800 flex items-center gap-0.5">
                      View <ChevronRight className="w-3 h-3" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Settings ── */}
      {activeTab === 'settings' && (
        <div className="space-y-6 max-w-3xl">
          <Card>
            <CardHeader title="Confidence Thresholds" subtitle="Minimum confidence required for automatic AI actions" icon={<Zap className="w-4 h-4" />} />
            <CardDivider />
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">Auto-approval threshold</label>
                  <span className="text-lg font-bold text-emerald-600">{confidenceThreshold}%</span>
                </div>
                <input
                  type="range"
                  min={60}
                  max={99}
                  value={confidenceThreshold}
                  onChange={e => setConfidenceThreshold(Number(e.target.value))}
                  className="w-full accent-emerald-600"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>60% (permissive)</span>
                  <span>99% (strict)</span>
                </div>
                <p className="text-xs text-slate-500 mt-2">AI actions with confidence below this threshold will be queued for human review.</p>
              </div>
            </div>
          </Card>
          <Card>
            <CardHeader title="Human Approval Rules" icon={<Shield className="w-4 h-4" />} />
            <CardDivider />
            <div className="space-y-3">
              {[
                { label: 'Require human approval for High-risk actions', enabled: true },
                { label: 'Require human approval for Critical-risk actions', enabled: true },
                { label: 'Notify CISO on behavioral anomalies', enabled: true },
                { label: 'Block AI from initiating any payments', enabled: true },
                { label: 'Send Slack notification on blocked actions', enabled: true },
                { label: 'Daily AI governance digest to VP Finance', enabled: false },
              ].map((rule, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <span className="text-sm text-slate-700">{rule.label}</span>
                  <button className={`w-9 h-5 rounded-full transition-colors relative ${rule.enabled ? 'bg-emerald-600' : 'bg-slate-300'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${rule.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              ))}
            </div>
          </Card>
          <div className="flex gap-3">
            <Button variant="primary" size="md">Save settings</Button>
            <Button variant="secondary" size="md">Reset to defaults</Button>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
