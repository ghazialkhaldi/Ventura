import { moneyFull } from '../../lib/money'
import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import AppLayout from '../../components/layout/AppLayout'
import PageHeader from '../../components/ui/PageHeader'
import Badge, { SEVERITY_LABEL } from '../../components/ui/Badge'
import Segmented from '../../components/ui/Segmented'
import DataEmptyState from '../../components/ui/DataEmptyState'
import { useDataReady } from '../../hooks/useDataReady'
import { loadDataset, isUndecided } from '../../lib/dataStore'
import type { DetectedAnomaly, Severity, AnomalyStatus, StoredTransaction } from '../../lib/dataStore'
import { computeRiskExposure } from '../../lib/anomalyEngine'
import { MagnifyingGlassIcon, DownloadIcon, CaretUpIcon, CaretDownIcon } from '@radix-ui/react-icons'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtFull(n: number): string {
  return moneyFull(n)
}

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

const SEV_RANK: Record<Severity, number> = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 }

type View    = 'decide' | 'Under Review' | 'Resolved' | 'Dismissed' | 'All'
type SortKey = 'severity' | 'title' | 'amount' | 'confidence' | 'detectedAt'

// ─── Component ────────────────────────────────────────────────────────────────

const severities: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

export default function AnomaliesPage() {
  const router = useRouter()
  const { isReady, mounted } = useDataReady()
  const [anomalies, setAnomalies] = useState<DetectedAnomaly[]>([])
  const [rows,      setRows]      = useState<StoredTransaction[]>([])
  const [search,    setSearch]    = useState('')
  const [sevFilter, setSev]       = useState<Severity | 'All'>('All')
  const [view,      setView]      = useState<View>('decide')
  const [sort,      setSort]      = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'severity', dir: 'desc' })

  useEffect(() => {
    if (isReady) {
      const ds = loadDataset()
      setAnomalies(ds?.anomalies ?? [])
      setRows(ds?.sampleTransactions ?? [])
    }
  }, [isReady])

  const totals = useMemo(() => {
    const count = (st: AnomalyStatus) => anomalies.filter(a => a.status === st).length
    const open  = anomalies.filter(isUndecided)
    return {
      all:       anomalies.length,
      decide:    open.length,
      review:    count('Under Review'),
      resolved:  count('Resolved'),
      dismissed: count('Dismissed'),
      exposure:  computeRiskExposure(open, rows).exposure,
    }
  }, [anomalies, rows])

  const filtered = useMemo(() => {
    const q   = search.toLowerCase()
    const dir = sort.dir === 'asc' ? 1 : -1
    return anomalies
      .filter(a => {
        if (q && !a.title.toLowerCase().includes(q) && !a.vendor.toLowerCase().includes(q) && !a.id.toLowerCase().includes(q)) return false
        if (sevFilter !== 'All' && a.severity !== sevFilter) return false
        if (view === 'decide') return isUndecided(a)
        if (view !== 'All' && a.status !== view) return false
        return true
      })
      .sort((a, b) => {
        let d = 0
        if (sort.key === 'severity')   d = SEV_RANK[a.severity] - SEV_RANK[b.severity] || a.confidence - b.confidence
        if (sort.key === 'title')      d = a.title.localeCompare(b.title)
        if (sort.key === 'amount')     d = a.amount - b.amount
        if (sort.key === 'confidence') d = a.confidence - b.confidence
        if (sort.key === 'detectedAt') d = a.detectedAt.localeCompare(b.detectedAt)
        return d * dir
      })
  }, [anomalies, search, sevFilter, view, sort])

  function sortBy(key: SortKey) {
    setSort(prev => prev.key === key
      ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
      : { key, dir: key === 'title' ? 'asc' : 'desc' })
  }

  function exportCsv() {
    const rows = [
      ['ID', 'Title', 'Type', 'Vendor', 'Amount', 'Severity', 'Status', 'Confidence', 'Detected At', 'Category'],
      ...anomalies.map(a => [
        a.id, a.title, a.type, a.vendor, String(a.amount), a.severity, a.status,
        `${a.confidence}%`, a.detectedAt, a.category,
      ]),
    ]
    const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `ventura-anomalies-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

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

  const Th = ({ k, children, className = '', right = false }: { k: SortKey; children: string; className?: string; right?: boolean }) => {
    const on = sort.key === k
    return (
      <th aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={`px-4 py-2.5 font-medium ${right ? 'text-right' : 'text-left'} ${className}`}>
        <button type="button" onClick={() => sortBy(k)} className={`inline-flex items-center gap-1 hover:text-text-primary ${on ? 'text-text-primary' : ''}`}>
          {children}
          {on
            ? (sort.dir === 'asc' ? <CaretUpIcon className="w-3.5 h-3.5" /> : <CaretDownIcon className="w-3.5 h-3.5" />)
            : <span className="w-3.5" aria-hidden />}
        </button>
      </th>
    )
  }

  return (
    <AppLayout title="Anomalies">
      <PageHeader
        title="Anomalies"
        subtitle={totals.decide > 0
          ? `${totals.decide} finding${totals.decide !== 1 ? 's' : ''} to decide, ${fmtFull(totals.exposure)} at risk. Ranked by severity, then confidence.`
          : 'Every finding has a decision.'}
        actions={
          <button
            onClick={exportCsv}
            disabled={anomalies.length === 0}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border-strong bg-surface-raised hover:bg-surface-overlay text-[13px] font-medium text-text-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <DownloadIcon className="w-3.5 h-3.5" /> Export CSV
          </button>
        }
        className="mb-6"
      />

      {/* ── One row of views and filters ── */}
      <div className="flex flex-wrap items-center gap-2.5 mb-4">
        <Segmented<View>
          label="Show findings"
          value={view}
          onChange={setView}
          segments={[
            { value: 'decide',       label: 'To decide',    count: totals.decide },
            { value: 'Under Review', label: 'Under review', count: totals.review },
            { value: 'Resolved',     label: 'Resolved',     count: totals.resolved },
            { value: 'Dismissed',    label: 'Dismissed',    count: totals.dismissed },
            { value: 'All',          label: 'All',          count: totals.all },
          ]}
        />
        <label className="flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-surface-raised flex-1 min-w-[12rem] max-w-[20rem]">
          <MagnifyingGlassIcon className="w-4 h-4 text-text-muted flex-shrink-0" />
          <span className="sr-only">Search findings</span>
          <input
            type="text"
            placeholder="Search title, vendor or ID"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-[13.5px] text-text-primary placeholder-text-muted outline-none w-full"
          />
        </label>
        <select
          value={sevFilter}
          onChange={e => setSev(e.target.value as Severity | 'All')}
          aria-label="Severity"
          className="h-9 text-[13px] border border-border rounded-md px-2.5 text-text-secondary bg-surface-raised"
        >
          <option value="All">All severities</option>
          {severities.map(s => <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>)}
        </select>
      </div>

      {/* ── The findings, as a table ── */}
      {filtered.length === 0 ? (
        <div className="bg-surface-raised border border-border rounded-xl p-12 text-center">
          <p className="text-[14px] font-medium text-text-primary">
            {anomalies.length === 0 ? 'No anomalies detected' : 'No findings match this view'}
          </p>
          <p className="text-[13px] text-text-muted mt-1 max-w-xs mx-auto">
            {anomalies.length === 0
              ? 'Anomaly detection runs when you upload financial data.'
              : 'Try another view, severity or search.'}
          </p>
        </div>
      ) : (
        <div className="bg-surface-raised border border-border rounded-xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead className="bg-surface text-[12.5px] text-text-muted border-b border-border">
                <tr>
                  <Th k="severity" className="w-[8.5rem]">Severity</Th>
                  <Th k="title">Finding</Th>
                  <Th k="amount" right>Amount</Th>
                  <Th k="confidence" right className="hidden sm:table-cell">Confidence</Th>
                  <th className="hidden md:table-cell px-4 py-2.5 text-left font-medium">Status</th>
                  <Th k="detectedAt" className="hidden lg:table-cell">Detected</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <tr
                    key={a.id}
                    onClick={() => router.push(`/anomalies/${a.id}`)}
                    className="border-t border-border-subtle first:border-t-0 hover:bg-surface-hover cursor-pointer"
                  >
                    <td className="px-4 py-2.5 align-top whitespace-nowrap">
                      <Badge variant="severity" value={a.severity} dot />
                    </td>
                    <td className="px-4 py-2.5 min-w-[15rem]">
                      <Link href={`/anomalies/${a.id}`} onClick={e => e.stopPropagation()} className="font-medium text-text-primary hover:text-accent-700">
                        {a.title}
                      </Link>
                      <p className="mt-0.5 text-[12.5px] text-text-muted truncate max-w-[34rem]">
                        {a.vendor || 'No vendor'} · {a.type.replace(/_/g, ' ')} · <span className="font-mono text-[12px]">{a.id}</span>
                      </p>
                    </td>
                    <td className="px-4 py-2.5 align-top text-right font-medium text-text-primary tabular-nums whitespace-nowrap">{fmtFull(a.amount)}</td>
                    <td className="hidden sm:table-cell px-4 py-2.5 align-top text-right tabular-nums text-text-secondary">{a.confidence}</td>
                    <td className="hidden md:table-cell px-4 py-2.5 align-top whitespace-nowrap">
                      <Badge variant="status" value={a.status}>{a.status === 'Under Review' ? 'Under review' : a.status}</Badge>
                    </td>
                    <td className="hidden lg:table-cell px-4 py-2.5 align-top text-text-muted tabular-nums whitespace-nowrap">{fmtDay(a.detectedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
