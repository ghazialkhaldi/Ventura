import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import AppLayout from '../../components/layout/AppLayout'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { loadDataset, saveDataset } from '../../lib/dataStore'
import type { DetectedAnomaly, StoredTransaction } from '../../lib/dataStore'
import {
  ChevronLeft, ChevronRight, AlertTriangle, CheckCircle,
  XCircle, ShieldAlert, Info, Zap, FileText,
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtFull(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function fmtDate(iso: string): string {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return iso }
}

type ActionRisk = 'None' | 'Low' | 'Medium' | 'High'

function suggestedActions(a: DetectedAnomaly) {
  const base: { label: string; type: string; risk: ActionRisk }[] = [
    { label: 'Mark as reviewed — no action needed',           type: 'resolve',   risk: 'None' },
    { label: 'Request supporting documentation from approver', type: 'request',   risk: 'Low' },
    { label: 'Escalate to CFO / Finance Director',            type: 'escalate',  risk: 'Medium' },
  ]
  if (a.severity === 'CRITICAL' || a.severity === 'HIGH') {
    base.push({ label: 'Escalate to CISO — potential fraud', type: 'escalate', risk: 'High' })
  }
  if (a.type === 'duplicate') {
    base.unshift({ label: 'Void the duplicate payment if confirmed', type: 'payment', risk: 'High' })
  }
  return base.slice(0, 4)
}

const SEV_LEFT: Record<string, string> = {
  CRITICAL: 'border-l-red-600',
  HIGH:     'border-l-orange-500',
  MEDIUM:   'border-l-amber-400',
  LOW:      'border-l-slate-300',
}

const RISK_CLASSES: Record<string, string> = {
  None:   'bg-green-50 text-green-700 border-green-200',
  Low:    'bg-blue-50 text-blue-700 border-blue-200',
  Medium: 'bg-amber-50 text-amber-700 border-amber-200',
  High:   'bg-red-50 text-red-700 border-red-200',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AnomalyDetailPage() {
  const router = useRouter()
  const { id } = router.query as { id: string }
  const [anomaly,  setAnomaly]  = useState<DetectedAnomaly | null | undefined>(undefined)
  const [related,  setRelated]  = useState<DetectedAnomaly[]>([])
  const [sourceTx, setSourceTx] = useState<StoredTransaction[]>([])
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    const ds = loadDataset()
    if (!ds) { setAnomaly(null); return }
    const found = ds.anomalies.find(a => a.id === id)
    setAnomaly(found ?? null)
    if (found) {
      setRelated(ds.anomalies.filter(a => a.id !== id && a.vendor === found.vendor).slice(0, 4))
      const refs = new Set(found.rowRefs)
      setSourceTx(ds.sampleTransactions.filter(t => refs.has(t.id)).slice(0, 10))
    }
  }, [id])

  function updateStatus(status: DetectedAnomaly['status']) {
    setUpdating(true)
    const ds = loadDataset()
    if (!ds) return
    const idx = ds.anomalies.findIndex(a => a.id === id)
    if (idx >= 0) {
      ds.anomalies[idx] = { ...ds.anomalies[idx], status }
      saveDataset(ds)
      setAnomaly(a => a ? { ...a, status } : a)
    }
    setUpdating(false)
  }

  // ── Loading / not found ────────────────────────────────────────────────────
  if (anomaly === undefined) {
    return <AppLayout title="Loading…"><div className="h-96 animate-pulse bg-slate-100 rounded-lg" /></AppLayout>
  }

  if (!anomaly) {
    return (
      <AppLayout title="Anomaly not found">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <AlertTriangle className="w-10 h-10 text-slate-300 mb-4" />
          <p className="text-slate-700 font-semibold">Anomaly not found</p>
          <p className="text-xs text-slate-400 mt-1">It may have been cleared when data was re-uploaded.</p>
          <Link href="/anomalies" className="text-blue-600 text-sm mt-4 hover:text-blue-800 flex items-center gap-1">
            <ChevronLeft className="w-3.5 h-3.5" /> Back to Anomalies
          </Link>
        </div>
      </AppLayout>
    )
  }

  const actions = suggestedActions(anomaly)

  return (
    <AppLayout title={`${anomaly.id} — ${anomaly.title}`}>
      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-4">
        <Link href="/anomalies" className="hover:text-blue-700 transition-colors flex items-center gap-0.5">
          <ChevronLeft className="w-3 h-3" /> Anomalies
        </Link>
        <span className="text-slate-300">/</span>
        <span className="font-mono text-slate-400">{anomaly.id}</span>
      </div>

      {/* ── Title + severity banner ── */}
      {anomaly.severity === 'CRITICAL' && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-3.5 mb-4">
          <ShieldAlert className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-red-800">Critical — Immediate action required</p>
        </div>
      )}

      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="severity" value={anomaly.severity} dot>{anomaly.severity}</Badge>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{anomaly.type.replace(/_/g, ' ')}</span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 leading-snug">{anomaly.title}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{anomaly.vendor}{anomaly.category ? ` · ${anomaly.category}` : ''}</p>
        </div>
        <Badge variant="status" value={anomaly.status} className="flex-shrink-0 mt-1">{anomaly.status}</Badge>
      </div>

      {/* ── Key metrics bar ── */}
      <div className={`grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-6 border-l-4 ${SEV_LEFT[anomaly.severity] ?? 'border-l-slate-300'} pl-4`}>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Amount</p>
          <p className="text-2xl font-bold text-slate-900 leading-none">{fmtFull(anomaly.amount)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Confidence</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold text-slate-900 leading-none">{anomaly.confidence}%</p>
          </div>
          <div className="mt-1 h-1 w-20 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${anomaly.confidence}%` }} />
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Severity</p>
          <p className="text-2xl font-bold text-slate-900 leading-none capitalize">{anomaly.severity.toLowerCase()}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Detected</p>
          <p className="text-sm font-semibold text-slate-700 mt-1">{fmtDate(anomaly.detectedAt)}</p>
        </div>
      </div>

      {/* ── 2-col layout ── */}
      <div className="grid lg:grid-cols-3 gap-5">

        {/* Left (2/3) */}
        <div className="lg:col-span-2 space-y-5">

          {/* Root cause analysis */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-blue-500" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Root Cause Analysis</p>
                  <p className="text-xs text-slate-500">Powered by Ventura Intelligence</p>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${anomaly.severity === 'CRITICAL' ? 'bg-red-50 text-red-700 border-red-200' : anomaly.severity === 'HIGH' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                {anomaly.severity} RISK
              </span>
            </div>
            <div className="p-5">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Detection Reasoning</p>
                <p className="text-sm text-slate-800 leading-relaxed">{anomaly.reasoning}</p>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{anomaly.description}</p>
            </div>
          </div>

          {/* Source transactions */}
          {sourceTx.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg shadow-card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Source Transactions</p>
                  <p className="text-xs text-slate-500">{sourceTx.length} transaction{sourceTx.length !== 1 ? 's' : ''} referenced</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-4 py-2.5 font-bold text-slate-400 uppercase tracking-wider">ID</th>
                      <th className="text-left px-4 py-2.5 font-bold text-slate-400 uppercase tracking-wider">Date</th>
                      <th className="text-left px-4 py-2.5 font-bold text-slate-400 uppercase tracking-wider">Vendor</th>
                      <th className="text-left px-4 py-2.5 font-bold text-slate-400 uppercase tracking-wider hidden md:table-cell">Category</th>
                      <th className="text-right px-4 py-2.5 font-bold text-slate-400 uppercase tracking-wider">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sourceTx.map(tx => (
                      <tr key={tx.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-mono text-slate-400">{tx.id}</td>
                        <td className="px-4 py-2.5 text-slate-600">{tx.date}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-800 truncate max-w-[140px]">{tx.vendor}</td>
                        <td className="px-4 py-2.5 text-slate-500 hidden md:table-cell">{tx.category || '—'}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-slate-800">{fmtFull(tx.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Suggested actions */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-sm font-semibold text-slate-900">Suggested Actions</p>
                <p className="text-xs text-slate-500">AI-recommended responses based on anomaly type</p>
              </div>
            </div>
            <div className="p-4 space-y-2.5">
              {actions.map((action, i) => (
                <div key={i} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </div>
                  <p className="text-sm font-medium text-slate-800 flex-1">{action.label}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${RISK_CLASSES[action.risk]}`}>
                    {action.risk} risk
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right (1/3) */}
        <div className="space-y-4">

          {/* Approval controls — prominent */}
          <div className="bg-[#0c1526] border border-[#1e2d47] rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#1e2d47]">
              <p className="text-xs font-bold text-[#8ea4c0] uppercase tracking-widest">Review Decision</p>
              <p className="text-sm font-semibold text-white mt-0.5">{anomaly.id}</p>
            </div>
            <div className="p-5 space-y-2.5">
              <button
                onClick={() => updateStatus('Resolved')}
                disabled={updating || anomaly.status === 'Resolved'}
                className="w-full flex items-center gap-2 justify-center bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold px-4 py-2.5 rounded-lg transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                {anomaly.status === 'Resolved' ? 'Approved' : 'Approve finding'}
              </button>
              <button
                onClick={() => updateStatus('Under Review')}
                disabled={updating || anomaly.status === 'Under Review'}
                className="w-full flex items-center gap-2 justify-center bg-[#1e2d47] hover:bg-[#253654] disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-lg border border-[#2d4268] transition-colors"
              >
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Escalate to CFO / CISO
              </button>
              <button
                onClick={() => updateStatus('Dismissed')}
                disabled={updating || anomaly.status === 'Dismissed'}
                className="w-full flex items-center gap-2 justify-center text-[#4d6a8a] hover:text-slate-300 disabled:opacity-50 text-sm font-medium px-4 py-2.5 rounded-lg border border-[#1e2d47] hover:border-[#2d4268] transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Dismiss as false positive
              </button>
            </div>
            <div className="px-5 pb-4">
              <p className="text-[10px] text-[#4d6a8a] flex items-start gap-1.5">
                <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
                All actions are logged to the audit trail and require an override to reverse.
              </p>
            </div>
          </div>

          {/* Quick facts */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-900">Finding Details</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              {[
                { label: 'Anomaly ID',    value: anomaly.id,                              mono: true },
                { label: 'Vendor',        value: anomaly.vendor },
                { label: 'Category',      value: anomaly.category || 'Uncategorized' },
                { label: 'Amount',        value: fmtFull(anomaly.amount) },
                { label: 'AI Confidence', value: `${anomaly.confidence}%` },
                { label: 'Type',          value: anomaly.type.replace(/_/g, ' '), cap: true },
                { label: 'Detected',      value: fmtDate(anomaly.detectedAt) },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">{row.label}</span>
                  <span className={`text-xs font-semibold text-slate-800 ${row.mono ? 'font-mono' : ''} ${row.cap ? 'capitalize' : ''}`}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Related anomalies */}
          {related.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg shadow-card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-900">Same Vendor</p>
                <p className="text-xs text-slate-500">{related.length} related anomal{related.length !== 1 ? 'ies' : 'y'}</p>
              </div>
              <div className="divide-y divide-slate-100">
                {related.map(a => (
                  <Link
                    key={a.id}
                    href={`/anomalies/${a.id}`}
                    className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50 transition-colors group"
                  >
                    <Badge variant="severity" value={a.severity} dot className="mt-0.5 flex-shrink-0">{a.severity.slice(0, 1)}</Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate group-hover:text-blue-700 transition-colors">{a.title}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{fmtFull(a.amount)}</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-400 flex-shrink-0 mt-0.5" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
