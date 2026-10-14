import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import AppLayout from '../../components/layout/AppLayout'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import FocusBrackets from '../../components/FocusBrackets'
import { loadDataset, saveDataset, isUndecided } from '../../lib/dataStore'
import type { DetectedAnomaly, StoredTransaction } from '../../lib/dataStore'
import { ChevronLeftIcon as ChevronLeft, ChevronRightIcon as ChevronRight } from '@radix-ui/react-icons'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtFull(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function fmtDate(iso: string): string {
  if (!iso) return 'N/A'
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return iso }
}

type ActionRisk = 'None' | 'Low' | 'Medium' | 'High'

function suggestedActions(a: DetectedAnomaly) {
  const base: { label: string; type: string; risk: ActionRisk }[] = [
    { label: 'Mark as reviewed, no action needed',           type: 'resolve',   risk: 'None' },
    { label: 'Request supporting documentation from approver', type: 'request',   risk: 'Low' },
    { label: 'Escalate to CFO / Finance Director',            type: 'escalate',  risk: 'Medium' },
  ]
  if (a.severity === 'CRITICAL' || a.severity === 'HIGH') {
    base.push({ label: 'Escalate to CISO: potential fraud', type: 'escalate', risk: 'High' })
  }
  if (a.type === 'duplicate') {
    base.unshift({ label: 'Void the duplicate payment if confirmed', type: 'payment', risk: 'High' })
  }
  return base.slice(0, 4)
}

const RISK_CLASSES: Record<string, string> = {
  None:   'bg-positive-bg text-positive-fg border-positive-line',
  Low:    'bg-accent-50 text-accent-700 border-accent-200',
  Medium: 'bg-medium-bg text-medium-fg border-medium-line',
  High:   'bg-critical-bg text-critical-fg border-critical-line',
}

// ─── Component ────────────────────────────────────────────────────────────────

// A duplicate's references are [later, earlier]: the later payment is the
// finding and the earlier one is the original, kept as evidence.
function rowRole(a: DetectedAnomaly, id: string): 'Flagged' | 'Original' {
  return a.type === 'duplicate' && a.rowRefs.indexOf(id) > 0 ? 'Original' : 'Flagged'
}

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
      const byId = new Map(ds.sampleTransactions.filter(t => refs.has(t.id)).map(t => [t.id, t]))
      setSourceTx(found.rowRefs.map(id => byId.get(id)).filter((t): t is StoredTransaction => !!t).slice(0, 10))
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
    return <AppLayout title="Loading…"><div className="h-96 animate-pulse bg-surface-overlay rounded-lg" /></AppLayout>
  }

  if (!anomaly) {
    return (
      <AppLayout title="Anomaly not found">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-text-secondary font-medium">Anomaly not found</p>
          <p className="text-xs text-text-muted mt-1">It may have been cleared when data was re-uploaded.</p>
          <Link href="/anomalies" className="text-accent-700 text-sm mt-4 hover:text-accent-800 flex items-center gap-1">
            <ChevronLeft className="w-3.5 h-3.5" /> Back to Anomalies
          </Link>
        </div>
      </AppLayout>
    )
  }

  const actions = suggestedActions(anomaly)

  return (
    <AppLayout title={`${anomaly.id}: ${anomaly.title}`}>
      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-1.5 text-xs text-text-muted mb-4">
        <Link href="/anomalies" className="hover:text-accent-800 transition-colors flex items-center gap-0.5">
          <ChevronLeft className="w-3 h-3" /> Anomalies
        </Link>
        <span className="text-text-muted">/</span>
        <span className="font-mono text-text-muted">{anomaly.id}</span>
      </div>

      {/* ── Title ── */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="severity" value={anomaly.severity} dot />
            <span className="text-[12.5px] text-text-muted">{anomaly.type.replace(/_/g, ' ')}</span>
          </div>
          <h1 className="font-display text-[26px] font-medium tracking-[-0.025em] text-text-primary leading-tight">{anomaly.title}</h1>
          <p className="text-[13.5px] text-text-muted mt-1">{anomaly.vendor}{anomaly.category ? ` · ${anomaly.category}` : ''}</p>
        </div>
        <Badge variant="status" value={anomaly.status} className="flex-shrink-0 mt-1">{anomaly.status === 'Under Review' ? 'Under review' : anomaly.status}</Badge>
      </div>

      {/* ── Key metrics bar ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 mb-6">
        <div>
          <p className="text-[12px] font-medium text-text-muted mb-1">Amount</p>
          <p className="text-2xl font-medium tracking-[-0.02em] text-text-primary leading-none">{fmtFull(anomaly.amount)}</p>
        </div>
        <div>
          <p className="text-[12px] font-medium text-text-muted mb-1">Confidence</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-medium tracking-[-0.02em] text-text-primary leading-none">{anomaly.confidence}%</p>
          </div>
          <div className="mt-1 h-1 w-20 bg-surface-overlay rounded-full overflow-hidden">
            <div className="h-full bg-accent-500 rounded-full" style={{ width: `${anomaly.confidence}%` }} />
          </div>
        </div>
        <div>
          <p className="text-[12px] font-medium text-text-muted mb-1">Severity</p>
          <p className="text-2xl font-medium tracking-[-0.02em] text-text-primary leading-none capitalize">{anomaly.severity.toLowerCase()}</p>
        </div>
        <div>
          <p className="text-[12px] font-medium text-text-muted mb-1">Detected</p>
          <p className="text-sm font-medium text-text-secondary mt-1">{fmtDate(anomaly.detectedAt)}</p>
        </div>
      </div>

      {/* ── 2-col layout ── */}
      <div className="grid lg:grid-cols-3 gap-5">

        {/* Left (2/3) */}
        <div className="lg:col-span-2 space-y-5">

          {/* Root cause analysis */}
          <div className="bg-surface-raised border border-border rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border-subtle flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-primary">Why this was flagged</p>
                <p className="text-xs text-text-muted">From the detection rule that raised it</p>
              </div>
            </div>
            <div className="p-5 space-y-3 max-w-[70ch]">
              <p className="text-[14.5px] text-text-primary leading-relaxed">{anomaly.description}</p>
              <p className="text-[14px] text-text-secondary leading-relaxed">{anomaly.reasoning}</p>
              {anomaly.alsoMatched && anomaly.alsoMatched.length > 0 && (
                <div className="pt-2">
                  <p className="text-[13px] font-medium text-text-primary">Other checks that flagged this payment</p>
                  <ul className="mt-2 divide-y divide-border-subtle border-y border-border-subtle">
                    {anomaly.alsoMatched.map(m => (
                      <li key={m.type} className="py-2.5">
                        <p className="text-[13.5px] font-medium text-text-primary">{m.title}</p>
                        <p className="mt-0.5 text-[13px] text-text-secondary leading-relaxed">{m.detail}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Source transactions */}
          {anomaly.rowRefs.length > 0 && (
            <div className="bg-surface-raised border border-border rounded-lg overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border-subtle">
                <p className="text-sm font-medium text-text-primary">Evidence</p>
                <p className="text-xs text-text-muted">{anomaly.rowRefs.length} row{anomaly.rowRefs.length !== 1 ? 's' : ''} referenced</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-surface-overlay border-b border-border-subtle">
                      <th className="text-left px-4 py-2.5 font-medium text-text-muted">Row</th>
                      <th className="text-left px-4 py-2.5 font-medium text-text-muted">Date</th>
                      <th className="text-left px-4 py-2.5 font-medium text-text-muted">Vendor</th>
                      <th className="text-left px-4 py-2.5 font-medium text-text-muted hidden md:table-cell">Category</th>
                      <th className="text-right px-4 py-2.5 font-medium text-text-muted">Amount</th>
                      <th className="px-4 py-2.5" aria-label="Role" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {sourceTx.map(tx => {
                      const role = rowRole(anomaly, tx.id)
                      return (
                      <tr key={tx.id} className={`relative ${role === 'Flagged' ? 'bg-high-bg' : ''}`}>
                        <td className="px-4 py-2.5 text-text-muted tabular-nums" title={tx.id}>{(tx.rowIndex + 2).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-text-muted">{tx.date}</td>
                        <td className="px-4 py-2.5 font-medium text-text-secondary truncate max-w-[140px]">{tx.vendor}</td>
                        <td className="px-4 py-2.5 text-text-muted hidden md:table-cell">{tx.category || 'N/A'}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-text-primary tabular-nums">{fmtFull(tx.amount)}</td>
                        <td className={`px-4 py-2.5 text-right whitespace-nowrap text-[12px] ${role === 'Flagged' ? 'font-medium text-high-fg' : 'text-text-muted'}`}>
                          {role}
                          {role === 'Flagged' && isUndecided(anomaly) && <FocusBrackets inset="2px" />}
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {sourceTx.length < anomaly.rowRefs.length && (
                <p className="px-5 py-3 border-t border-border-subtle text-[12.5px] text-text-muted">
                  {anomaly.rowRefs.length - sourceTx.length} referenced row{anomaly.rowRefs.length - sourceTx.length !== 1 ? 's are' : ' is'} not in the rows stored on this device. Re-upload the file to see {anomaly.rowRefs.length - sourceTx.length !== 1 ? 'them' : 'it'}.
                </p>
              )}
            </div>
          )}

          {/* Suggested actions */}
          <div className="bg-surface-raised border border-border rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border-subtle">
              <p className="text-sm font-medium text-text-primary">Suggested actions</p>
              <p className="text-xs text-text-muted">Typical responses for this type of finding. Ventura never takes them for you.</p>
            </div>
            <div className="divide-y divide-border-subtle">
              {actions.map((action, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-4 text-[13px] text-text-muted tabular-nums flex-shrink-0">{i + 1}</span>
                  <p className="text-sm font-medium text-text-secondary flex-1">{action.label}</p>
                  <span className={`text-[12px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${RISK_CLASSES[action.risk]}`}>
                    {action.risk === 'None' ? 'No risk' : `${action.risk} risk`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right (1/3) */}
        <div className="space-y-4">

          {/* Approval controls — prominent */}
          <div className="bg-surface-raised border border-border rounded-xl shadow-card-md overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border-subtle flex items-center justify-between">
              <p className="text-[14.5px] font-medium text-text-primary">Review decision</p>
              <p className="font-mono text-[12px] text-text-muted">{anomaly.id}</p>
            </div>
            <div className="p-5 space-y-2.5">
              <button
                onClick={() => updateStatus('Resolved')}
                disabled={updating || anomaly.status === 'Resolved'}
                className="w-full flex items-center gap-2 justify-center h-10 bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white text-[14px] font-medium px-4 rounded-md shadow-card"
              >
                {anomaly.status === 'Resolved' ? 'Resolved' : 'Mark resolved'}
              </button>
              <button
                onClick={() => updateStatus('Under Review')}
                disabled={updating || anomaly.status === 'Under Review'}
                className="w-full flex items-center gap-2 justify-center h-10 bg-surface-raised hover:bg-surface-overlay disabled:opacity-50 text-text-primary text-[14px] font-medium px-4 rounded-md border border-border-strong shadow-card"
              >
                Send for review
              </button>
              <button
                onClick={() => updateStatus('Dismissed')}
                disabled={updating || anomaly.status === 'Dismissed'}
                className="w-full flex items-center gap-2 justify-center h-10 text-text-secondary hover:text-text-primary hover:bg-surface-overlay disabled:opacity-50 text-[14px] font-medium px-4 rounded-md"
              >
                Dismiss
              </button>
            </div>
            <div className="px-5 pb-4">
              <p className="text-[12.5px] text-text-muted leading-relaxed">
                All actions are logged to the audit trail and require an override to reverse.
              </p>
            </div>
          </div>

          {/* Quick facts */}
          <div className="bg-surface-raised border border-border rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border-subtle">
              <p className="text-sm font-medium text-text-primary">Finding details</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              {[
                { label: 'Anomaly ID',    value: anomaly.id,                              mono: true },
                { label: 'Vendor',        value: anomaly.vendor },
                { label: 'Category',      value: anomaly.category || 'Uncategorized' },
                { label: 'Amount',        value: fmtFull(anomaly.amount) },
                { label: 'Confidence', value: `${anomaly.confidence}%` },
                { label: 'Type',          value: anomaly.type.replace(/_/g, ' '), cap: true },
                { label: 'Detected',      value: fmtDate(anomaly.detectedAt) },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center">
                  <span className="text-xs text-text-muted">{row.label}</span>
                  <span className={`text-xs font-medium text-text-secondary ${row.mono ? 'font-mono' : ''} ${row.cap ? 'capitalize' : ''}`}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Related anomalies */}
          {related.length > 0 && (
            <div className="bg-surface-raised border border-border rounded-lg overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border-subtle">
                <p className="text-sm font-medium text-text-primary">Same vendor</p>
                <p className="text-xs text-text-muted">{related.length} related anomal{related.length !== 1 ? 'ies' : 'y'}</p>
              </div>
              <div className="divide-y divide-border-subtle">
                {related.map(a => (
                  <Link
                    key={a.id}
                    href={`/anomalies/${a.id}`}
                    className="flex items-start gap-3 px-5 py-3 hover:bg-surface-hover transition-colors group"
                  >
                    <Badge variant="severity" value={a.severity} dot className="mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-text-secondary truncate group-hover:text-accent-800 transition-colors">{a.title}</p>
                      <p className="text-[10px] text-text-muted mt-0.5">{fmtFull(a.amount)}</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-text-muted group-hover:text-accent-800 flex-shrink-0 mt-0.5" />
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
