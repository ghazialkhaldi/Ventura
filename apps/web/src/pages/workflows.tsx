import React, { useState, useEffect, useMemo } from 'react'
import AppLayout from '../components/layout/AppLayout'
import PageHeader from '../components/ui/PageHeader'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import DataEmptyState from '../components/ui/DataEmptyState'
import { useDataReady } from '../hooks/useDataReady'
import { loadDataset } from '../lib/dataStore'
import type { DetectedAnomaly, AnomalyType } from '../lib/dataStore'
import {
  GitMerge, Clock, AlertTriangle, CheckCircle, ChevronDown,
  ChevronRight, AlertCircle, Users, ArrowRight,
} from 'lucide-react'

function fmtCurrency(n: number): string {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return '$' + (n / 1_000).toFixed(0) + 'K'
  return '$' + n.toFixed(0)
}

// Maps each anomaly type to a human-readable workflow
const TYPE_META: Record<AnomalyType, {
  name:        string
  description: string
  slaDays:     number
  steps:       Array<{ name: string; owner: string }>
}> = {
  duplicate: {
    name:        'Duplicate Payment Review',
    description: 'Review potential duplicate payments — confirm, void, or approve as intentional.',
    slaDays:     2,
    steps: [
      { name: 'Finance Analyst review',  owner: 'Finance Analyst' },
      { name: 'Confirm with AP team',    owner: 'Accounts Payable' },
      { name: 'CFO / Controller sign-off', owner: 'CFO' },
      { name: 'Payment void or approval', owner: 'Treasury' },
    ],
  },
  outlier: {
    name:        'Unusual Amount Review',
    description: 'Investigate transactions that deviate significantly from the vendor\'s normal payment pattern.',
    slaDays:     5,
    steps: [
      { name: 'Finance Manager review', owner: 'Finance Manager' },
      { name: 'Vendor statement match', owner: 'Accounts Payable' },
      { name: 'VP Finance sign-off',    owner: 'VP Finance' },
    ],
  },
  large_amount: {
    name:        'Large Transaction Approval',
    description: 'Verify authorization for transactions exceeding the large-payment threshold.',
    slaDays:     3,
    steps: [
      { name: 'Finance Director review', owner: 'Finance Director' },
      { name: 'Supporting doc check',    owner: 'Finance Analyst' },
      { name: 'CFO approval',            owner: 'CFO' },
    ],
  },
  round_number: {
    name:        'Round-Number Transaction Audit',
    description: 'Audit round-number transactions above $5K for supporting invoices and approvals.',
    slaDays:     7,
    steps: [
      { name: 'Finance Analyst review', owner: 'Finance Analyst' },
      { name: 'Invoice validation',     owner: 'Accounts Payable' },
      { name: 'Finance Manager close',  owner: 'Finance Manager' },
    ],
  },
  high_frequency: {
    name:        'High-Frequency Payment Review',
    description: 'Review vendors with unusually high transaction frequency in a short window.',
    slaDays:     5,
    steps: [
      { name: 'AP review & clustering', owner: 'Accounts Payable' },
      { name: 'Vendor contact / verify', owner: 'Finance Analyst' },
      { name: 'Finance Manager sign-off', owner: 'Finance Manager' },
    ],
  },
  missing_vendor: {
    name:        'Missing Vendor Data Remediation',
    description: 'Identify and assign vendor names to transactions with blank or unknown payees.',
    slaDays:     7,
    steps: [
      { name: 'Data quality triage',  owner: 'Finance Analyst' },
      { name: 'GL reconciliation',    owner: 'Accounts Payable' },
      { name: 'Controller sign-off',  owner: 'Controller' },
    ],
  },
}

interface WorkflowItem {
  type:        AnomalyType
  anomalies:   DetectedAnomaly[]
  inProgress:  number
  overdue:     number
  status:      'Critical' | 'Bottleneck' | 'Warning' | 'On Track'
  totalValue:  number
}

function buildWorkflows(anomalies: DetectedAnomaly[]): WorkflowItem[] {
  const grouped = new Map<AnomalyType, DetectedAnomaly[]>()
  for (const a of anomalies) {
    const arr = grouped.get(a.type) ?? []
    arr.push(a)
    grouped.set(a.type, arr)
  }

  const items: WorkflowItem[] = []
  for (const [type, group] of grouped) {
    const open     = group.filter(a => a.status !== 'Resolved')
    const critical = open.filter(a => a.severity === 'CRITICAL').length
    const high     = open.filter(a => a.severity === 'HIGH').length

    const status: WorkflowItem['status'] =
      critical > 0  ? 'Critical' :
      high > 0      ? 'Bottleneck' :
      open.length > 3 ? 'Warning' : 'On Track'

    items.push({
      type,
      anomalies: group,
      inProgress: open.length,
      overdue:    critical + high,
      status,
      totalValue: open.reduce((s, a) => s + a.amount, 0),
    })
  }

  // Sort: most severe first
  const order = { Critical: 0, Bottleneck: 1, Warning: 2, 'On Track': 3 }
  return items.sort((a, b) => order[a.status] - order[b.status])
}

const stepStatusIcon: Record<string, React.ReactElement> = {
  ok:    <CheckCircle className="w-3.5 h-3.5 text-green-500" />,
  slow:  <Clock className="w-3.5 h-3.5 text-amber-500" />,
  stuck: <AlertTriangle className="w-3.5 h-3.5 text-red-500" />,
}

const stepStatusBg: Record<string, string> = {
  ok:    'bg-green-50 border-green-200',
  slow:  'bg-amber-50 border-amber-200',
  stuck: 'bg-red-50 border-red-200',
}

function stepHealth(overdue: number, idx: number, total: number): 'ok' | 'slow' | 'stuck' {
  if (overdue === 0) return 'ok'
  // If there are overdue/critical items, the first step that hasn't resolved is "stuck"
  const pivot = Math.floor(total * 0.4)
  if (idx <= pivot && overdue > 0) return 'stuck'
  if (idx <= pivot + 1) return 'slow'
  return 'ok'
}

export default function WorkflowsPage() {
  const { isReady, mounted } = useDataReady()
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([])
  const [expanded,  setExpanded]  = useState<string | null>(null)

  useEffect(() => {
    if (isReady) {
      const ds = loadDataset()
      setWorkflows(buildWorkflows(ds?.anomalies ?? []))
    }
  }, [isReady])

  // useMemo must be called before any conditional returns (React hooks rules)
  const stats = useMemo(() => ({
    total:       workflows.length,
    bottleneck:  workflows.filter(w => w.status === 'Critical' || w.status === 'Bottleneck').length,
    warning:     workflows.filter(w => w.status === 'Warning').length,
    totalInProg: workflows.reduce((s, w) => s + w.inProgress, 0),
    totalOverdue: workflows.reduce((s, w) => s + w.overdue, 0),
  }), [workflows])

  if (mounted && !isReady) {
    return (
      <AppLayout title="Workflows">
        <DataEmptyState
          title="No workflow data yet"
          description="Upload your financial data on the Dashboard. Ventura will automatically generate review workflows for every anomaly detected — duplicates, large transactions, unusual patterns, and more."
        />
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Workflows">
      <PageHeader
        title="Workflows"
        subtitle="Approval processes auto-generated from detected anomalies"
        actions={
          <Button variant="secondary" size="sm" icon={<ArrowRight className="w-3.5 h-3.5" />}>
            Configure SLAs
          </Button>
        }
        className="mb-6"
      />

      {workflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <CheckCircle className="w-10 h-10 text-green-400 mb-3" />
          <p className="text-slate-700 font-semibold">No open workflows</p>
          <p className="text-xs text-slate-400 mt-1">No anomalies were detected in your uploaded data.</p>
        </div>
      ) : (
        <>
          {/* ── Stats ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Workflow types',     value: stats.total,        icon: GitMerge,      color: 'text-slate-700', bg: 'bg-slate-50',  border: 'border-slate-200' },
              { label: 'Critical/Bottleneck', value: stats.bottleneck,   icon: AlertTriangle, color: 'text-red-700',   bg: 'bg-red-50',    border: 'border-red-200' },
              { label: 'Items in review',    value: stats.totalInProg,  icon: Clock,         color: 'text-emerald-700',  bg: 'bg-emerald-50',   border: 'border-emerald-200' },
              { label: 'Overdue items',      value: stats.totalOverdue, icon: AlertCircle,   color: 'text-amber-700', bg: 'bg-amber-50',  border: 'border-amber-200' },
            ].map((s) => {
              const Icon = s.icon
              return (
                <div key={s.label} className={`${s.bg} border ${s.border} rounded-lg px-4 py-3 flex items-center gap-3`}>
                  <Icon className={`w-5 h-5 ${s.color} flex-shrink-0`} />
                  <div>
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-slate-500">{s.label}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Workflow cards ── */}
          <div className="space-y-3">
            {workflows.map((wf) => {
              const meta    = TYPE_META[wf.type]
              const isOpen  = expanded === wf.type
              const slaDays = meta.slaDays
              const avgDays = wf.overdue > 0 ? Math.ceil(slaDays * 1.5) : Math.ceil(slaDays * 0.6)
              const slaRatio = avgDays / slaDays
              const slaColor = slaRatio >= 1.5 ? 'bg-red-500' : slaRatio >= 1 ? 'bg-amber-500' : 'bg-green-500'
              const pctBar   = Math.min((avgDays / (slaDays * 2)) * 100, 100)

              return (
                <div key={wf.type} className="bg-white border border-slate-200 rounded-lg shadow-card overflow-hidden">
                  <button
                    className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors text-left"
                    onClick={() => setExpanded(isOpen ? null : wf.type)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Badge variant="workflow" value={wf.status} dot>{wf.status}</Badge>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{meta.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">{meta.description}</p>
                      </div>
                    </div>

                    {/* SLA bar */}
                    <div className="hidden md:flex flex-col gap-1 w-32 flex-shrink-0">
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>~{avgDays}d avg</span>
                        <span>SLA {slaDays}d</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${slaColor}`} style={{ width: `${pctBar}%` }} />
                      </div>
                    </div>

                    {/* Counters */}
                    <div className="hidden md:flex items-center gap-4 text-xs flex-shrink-0">
                      <div className="text-center">
                        <p className="font-bold text-slate-800">{wf.inProgress}</p>
                        <p className="text-slate-400">items</p>
                      </div>
                      <div className="text-center">
                        <p className={`font-bold ${wf.overdue > 0 ? 'text-red-600' : 'text-slate-800'}`}>{wf.overdue}</p>
                        <p className="text-slate-400">overdue</p>
                      </div>
                    </div>

                    {/* Exposure */}
                    <div className="hidden lg:block text-right flex-shrink-0">
                      <p className="text-[10px] text-slate-400">Exposure</p>
                      <p className="text-xs font-semibold text-slate-700">{fmtCurrency(wf.totalValue)}</p>
                    </div>

                    {isOpen
                      ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                  </button>

                  {/* Expanded */}
                  {isOpen && (
                    <div className="border-t border-slate-100 p-5 bg-slate-50/50">
                      <div className="grid md:grid-cols-2 gap-6">
                        {/* Steps */}
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Process steps</p>
                          <div className="space-y-2">
                            {meta.steps.map((step, i) => {
                              const health = stepHealth(wf.overdue, i, meta.steps.length)
                              return (
                                <div key={i} className={`flex items-center gap-3 p-2.5 rounded-lg border ${stepStatusBg[health]}`}>
                                  {stepStatusIcon[health]}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-slate-800">{step.name}</p>
                                    <p className="text-[10px] text-slate-500 flex items-center gap-1">
                                      <Users className="w-2.5 h-2.5" /> {step.owner}
                                    </p>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        {/* Items list */}
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                            Open items ({wf.inProgress})
                          </p>
                          <div className="space-y-2 mb-4 max-h-52 overflow-y-auto">
                            {wf.anomalies
                              .filter(a => a.status !== 'Resolved')
                              .slice(0, 10)
                              .map((a) => (
                                <a
                                  key={a.id}
                                  href={`/anomalies/${a.id}`}
                                  className="flex items-start gap-2.5 p-2.5 bg-white border border-slate-200 rounded-lg hover:border-emerald-300 transition-colors group"
                                >
                                  <Badge variant="severity" value={a.severity} dot className="mt-0.5 flex-shrink-0">
                                    {a.severity.slice(0, 1)}
                                  </Badge>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-slate-800 truncate group-hover:text-emerald-700">{a.title}</p>
                                    <p className="text-[10px] text-slate-500">{a.vendor} · {fmtCurrency(a.amount)}</p>
                                  </div>
                                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-400 flex-shrink-0 mt-0.5" />
                                </a>
                              ))}
                            {wf.inProgress > 10 && (
                              <p className="text-xs text-slate-400 text-center py-1">+{wf.inProgress - 10} more</p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button variant="primary" size="sm" icon={<ArrowRight className="w-3.5 h-3.5" />} onClick={() => window.location.href = '/anomalies'}>
                              Review all items
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </AppLayout>
  )
}
