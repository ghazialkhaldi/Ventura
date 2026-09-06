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
import { DEFAULT_CONFIDENCE_THRESHOLD } from '../lib/governance'
import {
  Gauge, Shield, AlertTriangle, CheckCircle, Clock,
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
  'Low Risk':    'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
  'Medium Risk': 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
  'High Risk':   'bg-orange-500/10 text-orange-400 border border-orange-500/30',
  'Critical':    'bg-red-500/10 text-red-400 border border-red-500/30',
}

function severityTier(a: DetectedAnomaly): string {
  if (a.severity === 'CRITICAL') return 'Critical'
  if (a.severity === 'HIGH')     return 'High Risk'
  if (a.severity === 'MEDIUM')   return 'Medium Risk'
  return 'Low Risk'
}

export default function AIGovernancePage() {
  const { isReady, mounted } = useDataReady()
  const DEFAULT_RULES = [
    { label: 'Require human approval for High-risk actions',     enabled: true  },
    { label: 'Require human approval for Critical-risk actions', enabled: true  },
    { label: 'Notify CISO on behavioral anomalies',              enabled: true  },
    { label: 'Block AI from initiating any payments',            enabled: true  },
    { label: 'Send Slack notification on blocked actions',       enabled: true  },
    { label: 'Daily AI governance digest to VP Finance',         enabled: false },
  ]

  const [activeTab,            setActiveTab]            = useState<AITab>('overview')
  const [confidenceThreshold,  setConfidenceThreshold]  = useState(DEFAULT_CONFIDENCE_THRESHOLD)
  const [approvalRules,        setApprovalRules]        = useState(DEFAULT_RULES)
  const [settingsSaved,        setSettingsSaved]        = useState(false)

  // Restore persisted governance settings
  useEffect(() => {
    try {
      const raw = localStorage.getItem('sf_governance')
      if (raw) {
        const saved = JSON.parse(raw) as { threshold?: number; rules?: typeof DEFAULT_RULES }
        if (typeof saved.threshold === 'number') setConfidenceThreshold(saved.threshold)
        if (Array.isArray(saved.rules) && saved.rules.length === DEFAULT_RULES.length) setApprovalRules(saved.rules)
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleRule(index: number) {
    setApprovalRules(prev => prev.map((r, i) => i === index ? { ...r, enabled: !r.enabled } : r))
    setSettingsSaved(false)
  }

  function saveSettings() {
    try {
      localStorage.setItem('sf_governance', JSON.stringify({ threshold: confidenceThreshold, rules: approvalRules }))
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 2500)
    } catch {}
  }

  function resetSettings() {
    setConfidenceThreshold(DEFAULT_CONFIDENCE_THRESHOLD)
    setApprovalRules(DEFAULT_RULES)
    try { localStorage.removeItem('sf_governance') } catch {}
    setSettingsSaved(false)
  }
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
          { label: 'Anomalies analyzed',  value: anomalies.length,   color: 'text-text-secondary' },
          { label: 'Auto-classified',     value: autoApproved,       color: 'text-emerald-400' },
          { label: 'Human review needed', value: humanRequired,      color: 'text-red-400'   },
          { label: 'Avg confidence',      value: `${avgConf}%`,      color: 'text-emerald-400'  },
        ].map((s) => (
          <div key={s.label} className="bg-surface-raised border border-border rounded-lg px-4 py-3">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-text-muted mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0.5 mb-6 border-b border-border">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id ? 'border-accent-500 text-accent-400' : 'border-transparent text-text-muted hover:text-text-secondary'
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
                <p className="text-xs text-text-muted py-3">No anomalies detected.</p>
              ) : (
                <div className="space-y-3">
                  {[
                    { label: 'Critical', count: criticalAnomalies.length, color: 'bg-red-500' },
                    { label: 'High',     count: highAnomalies.length,     color: 'bg-orange-500' },
                    { label: 'Medium',   count: anomalies.filter(a => a.severity === 'MEDIUM').length, color: 'bg-amber-500' },
                    { label: 'Low',      count: anomalies.filter(a => a.severity === 'LOW').length, color: 'bg-emerald-500' },
                  ].map((row) => {
                    const pct = anomalies.length > 0 ? Math.round((row.count / anomalies.length) * 100) : 0
                    return (
                      <div key={row.label} className="flex items-center gap-3">
                        <span className="text-xs text-text-muted w-16 flex-shrink-0">{row.label}</span>
                        <div className="flex-1 h-2 bg-surface-overlay rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${row.color}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-text-secondary w-8 text-right">{row.count}</span>
                        <span className="text-xs text-text-muted w-8 text-right">{pct}%</span>
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
                <p className="text-xs text-text-muted py-3">No data to display.</p>
              ) : (
                <div className="space-y-3">
                  {[
                    { label: 'Low risk',    count: anomalies.filter(a => a.severity === 'LOW').length,      color: 'bg-emerald-500' },
                    { label: 'Medium risk', count: anomalies.filter(a => a.severity === 'MEDIUM').length,   color: 'bg-amber-500' },
                    { label: 'High risk',   count: highAnomalies.length,                                    color: 'bg-red-500'   },
                  ].map((row) => {
                    const pct = anomalies.length > 0 ? Math.round((row.count / anomalies.length) * 100) : 0
                    return (
                      <div key={row.label} className="flex items-center gap-3">
                        <span className="text-xs text-text-muted w-20 flex-shrink-0">{row.label}</span>
                        <div className="flex-1 h-2 bg-surface-overlay rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${row.color}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-text-secondary w-6 text-right">{row.count}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          </div>
          <Card>
            <CardHeader title="Governance rules" subtitle="What's actually active today vs. planned" icon={<Shield className="w-4 h-4" />} />
            <CardDivider />
            <div className="space-y-2">
              {[
                // "Enforced" here is used carefully: these two are backed by
                // real code (getConfidenceThreshold() in src/lib/governance.ts,
                // and the simple fact that status changes are only ever
                // written by explicit user actions — nothing in the codebase
                // changes an anomaly's status autonomously).
                { rule: `Anomalies at or above ${confidenceThreshold}% confidence are flagged high-confidence for priority review`, status: 'Enforced', icon: CheckCircle, color: 'text-emerald-400' },
                { rule: 'No automated action is ever taken on an anomaly. Every status change is a manual, logged user action', status: 'Enforced', icon: CheckCircle, color: 'text-emerald-400' },
                // These describe a routing/notification/provenance system
                // that does not exist yet — previously shown as "Enforced"
                // with a green checkmark, which was inaccurate.
                { rule: 'Critical-tier anomalies automatically routed to CISO + CFO for review', status: 'Not implemented', icon: Clock, color: 'text-amber-400' },
                { rule: 'Per-finding AI provenance log (model, prompt, confidence)', status: 'Not implemented: findings are produced by a deterministic rule engine, not a model', icon: Clock, color: 'text-amber-400' },
                { rule: 'Model explanations required before human approval UI', status: 'Draft', icon: Clock, color: 'text-amber-400' },
              ].map((r, i) => {
                const Icon = r.icon
                return (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-border-subtle last:border-0">
                    <Icon className={`w-4 h-4 flex-shrink-0 ${r.color}`} />
                    <span className="text-sm text-text-secondary flex-1">{r.rule}</span>
                    <span className={`text-xs font-medium ${r.status === 'Enforced' ? 'text-emerald-400' : 'text-amber-400'}`}>{r.status}</span>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ── Model routing ── */}
      {activeTab === 'routing' && (
        <div>
          <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 mb-4">
            <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-400">
              <span className="font-semibold">Policy reference, not a live routing log.</span> Anomaly detection in Ventura today runs on a deterministic rule engine (statistical outliers, duplicate matching, threshold checks). It does not call the language models listed below. This table documents the intended routing policy for a future model-backed detection layer; it does not reflect requests actually being made.
            </p>
          </div>
        <div className="bg-surface-raised border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-overlay border-b border-border">
                {['Risk Tier', 'Model', 'Confidence threshold', 'Auto-approve?', 'Example tasks', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {modelRoutes.map((row) => (
                <tr key={row.tier} className="hover:bg-surface-hover">
                  <td className="px-4 py-4">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${tierColor[row.tier]}`}>{row.tier}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-xs font-mono bg-surface-overlay text-text-secondary px-2 py-1 rounded">{row.model}</span>
                  </td>
                  <td className="px-4 py-4 text-sm font-semibold text-text-secondary">{row.threshold}</td>
                  <td className="px-4 py-4">
                    {row.autoApprove
                      ? <Badge variant="green"><CheckCircle className="w-3 h-3 inline mr-1" />Yes</Badge>
                      : <Badge variant="red"><XCircle className="w-3 h-3 inline mr-1" />No, human required</Badge>}
                  </td>
                  <td className="px-4 py-4 text-xs text-text-muted max-w-xs">{row.examples}</td>
                  <td className="px-4 py-4">
                    <Button variant="ghost" size="sm">Edit</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {/* ── Detection log ── */}
      {activeTab === 'history' && (
        <div className="bg-surface-raised border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-overlay border-b border-border">
                {['Timestamp', 'Anomaly', 'Type', 'Severity', 'Confidence', 'Amount', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {anomalies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-sm text-text-muted">
                    No anomalies detected in your data.
                  </td>
                </tr>
              ) : anomalies.map((a) => (
                <tr key={a.id} className="hover:bg-surface-hover">
                  <td className="px-4 py-3 text-xs text-text-muted whitespace-nowrap">{new Date(a.detectedAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-text-secondary max-w-xs">
                    <p className="truncate">{a.title}</p>
                    <p className="text-xs text-text-muted mt-0.5">{a.vendor}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono bg-surface-overlay text-text-secondary px-1.5 py-0.5 rounded">{a.type}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="severity" value={a.severity}>{a.severity}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-10 h-1.5 bg-surface-overlay rounded-full overflow-hidden">
                        <div className="h-full bg-accent-500 rounded-full" style={{ width: `${a.confidence}%` }} />
                      </div>
                      <span className="text-xs text-text-muted">{a.confidence}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-text-muted">
                    {a.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-3">
                    <a href={`/anomalies/${a.id}`} className="text-xs text-accent-400 hover:text-accent-300 flex items-center gap-0.5">
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
            <CardHeader title="Confidence Thresholds" subtitle="Minimum confidence required for automatic AI actions" icon={<Gauge className="w-4 h-4" />} />
            <CardDivider />
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-text-secondary">Auto-approval threshold</label>
                  <span className="text-lg font-bold text-accent-400">{confidenceThreshold}%</span>
                </div>
                <input
                  type="range"
                  min={60}
                  max={99}
                  value={confidenceThreshold}
                  onChange={e => setConfidenceThreshold(Number(e.target.value))}
                  className="w-full accent-accent-500"
                />
                <div className="flex justify-between text-xs text-text-muted mt-1">
                  <span>60% (permissive)</span>
                  <span>99% (strict)</span>
                </div>
                <p className="text-xs text-text-muted mt-2">AI actions with confidence below this threshold will be queued for human review.</p>
              </div>
            </div>
          </Card>
          <Card>
            <CardHeader title="Human Approval Rules" icon={<Shield className="w-4 h-4" />} />
            <CardDivider />
            <div className="space-y-3">
              {approvalRules.map((rule, i) => (
                <div key={rule.label} className="flex items-center justify-between py-2 border-b border-border-subtle last:border-0">
                  <span className="text-sm text-text-secondary">{rule.label}</span>
                  <button
                    onClick={() => toggleRule(i)}
                    role="switch"
                    aria-checked={rule.enabled}
                    aria-label={rule.label}
                    className={`w-9 h-5 rounded-full transition-colors relative ${rule.enabled ? 'bg-accent-500' : 'bg-border-strong'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${rule.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              ))}
            </div>
          </Card>
          <div className="flex items-center gap-3">
            <Button variant="primary" size="md" onClick={saveSettings}>Save settings</Button>
            <Button variant="secondary" size="md" onClick={resetSettings}>Reset to defaults</Button>
            {settingsSaved && (
              <span className="text-sm text-emerald-400 font-medium flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" /> Settings saved
              </span>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  )
}
