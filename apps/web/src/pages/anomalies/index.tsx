import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import AppLayout from '../../components/layout/AppLayout'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import DataEmptyState from '../../components/ui/DataEmptyState'
import { useDataReady } from '../../hooks/useDataReady'
import { loadDataset } from '../../lib/dataStore'
import type { DetectedAnomaly, Severity, AnomalyStatus } from '../../lib/dataStore'
import {
  Search, Download, ChevronRight, AlertTriangle,
  CheckCircle, Clock, XCircle, Filter,
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtC(n: number): string {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return '$' + (n / 1_000).toFixed(0) + 'K'
  return '$' + n.toFixed(0)
}

function fmtFull(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function suggestedAction(type: string, severity: string): string {
  if (type === 'duplicate')       return 'Void the duplicate payment if confirmed'
  if (type === 'missing_vendor')  return 'Identify the counterparty and update records'
  if (severity === 'CRITICAL')    return 'Escalate to CFO — requires immediate review'
  if (severity === 'HIGH')        return 'Request documentation from payment approver'
  if (type === 'round_number')    return 'Verify invoice exists and amount is accurate'
  if (type === 'high_frequency')  return 'Confirm split billing or check for submission error'
  return 'Review transaction and mark as approved or investigate further'
}

const SEV_LEFT: Record<string, string> = {
  CRITICAL: 'border-l-red-600',
  HIGH:     'border-l-orange-500',
  MEDIUM:   'border-l-amber-400',
  LOW:      'border-l-slate-300',
}

const SEV_AMT: Record<string, string> = {
  CRITICAL: 'text-red-700',
  HIGH:     'text-orange-700',
  MEDIUM:   'text-amber-700',
  LOW:      'text-slate-600',
}

// ─── Component ────────────────────────────────────────────────────────────────

const severities: Severity[]    = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
const statuses: AnomalyStatus[] = ['Open', 'Under Review', 'Resolved', 'Dismissed']

export default function AnomaliesPage() {
  const { isReady, mounted } = useDataReady()
  const [anomalies, setAnomalies] = useState<DetectedAnomaly[]>([])
  const [search,       setSearch]  = useState('')
  const [sevFilter,    setSev]     = useState<Severity | 'All'>('All')
  const [statusFilter, setStatus]  = useState<AnomalyStatus | 'All'>('Open')
  const [sortBy,       setSortBy]  = useState<'amount' | 'confidence' | 'detectedAt'>('detectedAt')

  useEffect(() => {
    if (isReady) {
      const ds = loadDataset()
      setAnomalies(ds?.anomalies ?? [])
    }
  }, [isReady])

  const totals = useMemo(() => ({
    all:       anomalies.length,
    open:      anomalies.filter(a => a.status === 'Open').length,
    review:    anomalies.filter(a => a.status === 'Under Review').length,
    resolved:  anomalies.filter(a => a.status === 'Resolved').length,
    critical:  anomalies.filter(a => a.severity === 'CRITICAL').length,
    exposure:  anomalies.filter(a => a.status !== 'Resolved').reduce((s, a) => s + a.amount, 0),
  }), [anomalies])

  const filtered = useMemo(() => {
    return anomalies
      .filter(a => {
        const q = search.toLowerCase()
        if (q && !a.title.toLowerCase().includes(q) && !a.vendor.toLowerCase().includes(q) && !a.id.toLowerCase().includes(q)) return false
        if (sevFilter !== 'All' && a.severity !== sevFilter) return false
        if (statusFilter !== 'All' && a.status !== statusFilter) return false
        return true
      })
      .sort((a, b) => {
        if (sortBy === 'amount')     return b.amount - a.amount
        if (sortBy === 'confidence') return b.confidence - a.confidence
        return b.detectedAt.localeCompare(a.detectedAt)
      })
  }, [anomalies, search, sevFilter, statusFilter, sortBy])

  if (mounted && !isReady) {
    return (
      <AppLayout title="Anomalies">
        <DataEmptyState
          title="No anomalies yet"
          description="Upload your financial data or connect a data source on the Dashboard. Ventura will automatically detect anomalies, policy violations, and suspicious patterns in your transactions."
        />
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Anomalies">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Anomaly Investigation</h1>
          <p className="text-xs text-slate-500 mt-0.5">AI-detected spend anomalies, policy violations, and risk signals</p>
        </div>
        <button className="inline-flex items-center gap-1.5 text-xs text-slate-500 border border-slate-200 rounded-lg px-3 py-1.5 bg-white hover:bg-slate-50 transition-colors">
          <Download className="w-3 h-3" /> Export CSV
        </button>
      </div>

      {/* ── Clickable KPI strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 mb-5">
        {[
          { label: 'All',           count: totals.all,      value: null,                icon: Filter,        filter: () => { setSev('All'); setStatus('All') },  active: statusFilter === 'All' && sevFilter === 'All', color: 'text-slate-700',   bg: 'bg-white',       border: 'border-slate-200' },
          { label: 'Open',          count: totals.open,     value: null,                icon: AlertTriangle, filter: () => setStatus('Open'),                     active: statusFilter === 'Open',                      color: 'text-red-700',     bg: 'bg-red-50',      border: 'border-red-200' },
          { label: 'Under Review',  count: totals.review,   value: null,                icon: Clock,         filter: () => setStatus('Under Review'),             active: statusFilter === 'Under Review',              color: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200' },
          { label: 'Resolved',      count: totals.resolved, value: null,                icon: CheckCircle,   filter: () => setStatus('Resolved'),                 active: statusFilter === 'Resolved',                  color: 'text-green-700',   bg: 'bg-green-50',    border: 'border-green-200' },
          { label: 'Risk Exposure', count: null,            value: fmtC(totals.exposure), icon: XCircle,     filter: () => { setSev('All'); setStatus('Open') },  active: false,                                        color: 'text-slate-900',   bg: 'bg-white',       border: 'border-slate-200' },
        ].map((s) => {
          const Icon = s.icon
          return (
            <button
              key={s.label}
              onClick={s.filter}
              className={`flex items-center gap-2.5 ${s.bg} border ${s.border} rounded-lg px-3.5 py-3 hover:opacity-80 transition-all text-left ${s.active ? 'ring-2 ring-emerald-400 ring-offset-1' : ''}`}
            >
              <Icon className={`w-4 h-4 ${s.color} flex-shrink-0`} />
              <div>
                <p className={`text-base font-bold ${s.color} leading-none`}>{s.count !== null ? s.count : s.value}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{s.label}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-2.5 mb-4 p-3 bg-white border border-slate-200 rounded-lg">
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5 flex-1 min-w-48 max-w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search by title, vendor, or ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none w-full"
          />
        </div>
        <select
          value={sevFilter}
          onChange={e => setSev(e.target.value as Severity | 'All')}
          className="text-xs border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-600 bg-white"
        >
          <option value="All">All severities</option>
          {severities.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatus(e.target.value as AnomalyStatus | 'All')}
          className="text-xs border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-600 bg-white"
        >
          <option value="All">All statuses</option>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as typeof sortBy)}
          className="text-xs border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-600 bg-white"
        >
          <option value="detectedAt">Latest first</option>
          <option value="amount">Highest amount</option>
          <option value="confidence">Highest confidence</option>
        </select>
        <span className="text-xs text-slate-400 ml-auto">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* ── Investigation cards ── */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
          <CheckCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">
            {anomalies.length === 0 ? 'No anomalies detected' : 'No anomalies match the current filters'}
          </p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            {anomalies.length === 0
              ? 'Anomaly detection runs automatically when you upload or connect financial data.'
              : 'Try adjusting the severity, status, or search filters above.'}
          </p>
          {anomalies.length === 0 && (
            <Link href="/integrations" className="inline-flex items-center gap-1.5 mt-4 text-xs bg-[#0c1526] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#1a2640] transition-colors">
              Connect data source
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => (
            <div
              key={a.id}
              className={`bg-white border border-slate-200 border-l-4 ${SEV_LEFT[a.severity] ?? 'border-l-slate-300'} rounded-lg overflow-hidden hover:shadow-card-md transition-shadow`}
            >
              <div className="p-4">
                <div className="flex items-start gap-4">
                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    {/* Top row */}
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <Badge variant="severity" value={a.severity} dot>{a.severity}</Badge>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{a.type.replace(/_/g, ' ')}</span>
                      <span className="text-[10px] text-slate-300">·</span>
                      <span className="text-[10px] font-mono text-slate-400">{a.id}</span>
                    </div>

                    <Link href={`/anomalies/${a.id}`} className="group">
                      <p className="text-sm font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors">{a.title}</p>
                    </Link>
                    <p className="text-xs text-slate-500 mt-0.5">{a.vendor}{a.category ? ` · ${a.category}` : ''}</p>
                    <p className="text-xs text-slate-600 mt-2 leading-relaxed line-clamp-2">{a.description}</p>

                    {/* Suggested action */}
                    <div className="mt-2.5 flex items-start gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 flex-shrink-0">Suggested:</span>
                      <span className="text-xs text-slate-600">{suggestedAction(a.type, a.severity)}</span>
                    </div>
                  </div>

                  {/* Right column */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <p className={`text-xl font-bold ${SEV_AMT[a.severity] ?? 'text-slate-700'}`}>{fmtFull(a.amount)}</p>
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${a.confidence}%` }} />
                      </div>
                      <span className="text-xs text-slate-500 font-medium">{a.confidence}% conf.</span>
                    </div>
                    <Badge variant="status" value={a.status}>{a.status}</Badge>
                    <Link
                      href={`/anomalies/${a.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-800 transition-colors mt-1"
                    >
                      Investigate <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>

              {/* Transaction refs strip */}
              {a.rowRefs.length > 0 && (
                <div className="border-t border-slate-100 px-4 py-2 bg-slate-50 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Refs:</span>
                  {a.rowRefs.slice(0, 6).map(ref => (
                    <span key={ref} className="text-[10px] font-mono bg-white border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                      {ref}
                    </span>
                  ))}
                  {a.rowRefs.length > 6 && (
                    <span className="text-[10px] text-slate-400">+{a.rowRefs.length - 6} more</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  )
}
