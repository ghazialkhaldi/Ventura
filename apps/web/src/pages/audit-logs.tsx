import { useState, useMemo, useEffect } from 'react'
import AppLayout from '../components/layout/AppLayout'
import PageHeader from '../components/ui/PageHeader'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import DataEmptyState from '../components/ui/DataEmptyState'
import { useDataReady } from '../hooks/useDataReady'
import { loadDataset } from '../lib/dataStore'
import type { AuditEntry } from '../lib/dataStore'
import { Search, Download, AlertTriangle, Info, AlertCircle } from 'lucide-react'

const severityIcon = {
  info:     <Info className="w-3.5 h-3.5 text-slate-400" />,
  warning:  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />,
  critical: <AlertCircle className="w-3.5 h-3.5 text-red-500" />,
}

export default function AuditLogsPage() {
  const { isReady, mounted } = useDataReady()
  const [entries,   setEntries]  = useState<AuditEntry[]>([])
  const [search,    setSearch]   = useState('')
  const [sevFilter, setSev]      = useState<'All' | 'info' | 'warning' | 'critical'>('All')

  useEffect(() => {
    if (isReady) {
      const ds = loadDataset()
      setEntries(ds?.auditLog ?? [])
    }
  }, [isReady])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return entries.filter(ev => {
      if (q && !ev.detail.toLowerCase().includes(q) && !ev.actor.toLowerCase().includes(q) && !ev.resource.toLowerCase().includes(q) && !ev.event.toLowerCase().includes(q)) return false
      if (sevFilter !== 'All' && ev.severity !== sevFilter) return false
      return true
    })
  }, [entries, search, sevFilter])

  const stats = useMemo(() => ({
    total:    entries.length,
    critical: entries.filter(e => e.severity === 'critical').length,
    warning:  entries.filter(e => e.severity === 'warning').length,
    info:     entries.filter(e => e.severity === 'info').length,
  }), [entries])

  if (mounted && !isReady) {
    return (
      <AppLayout title="Audit Logs">
        <DataEmptyState
          title="No audit events yet"
          description="Upload your financial data or connect a data source on the Dashboard. All system activity, anomaly actions, user logins, and data sync events will appear here once data is flowing."
        />
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Audit Logs">
      <PageHeader
        title="Audit Logs"
        subtitle="Immutable record of all system, AI, and user actions"
        actions={
          <Button variant="secondary" size="sm" icon={<Download className="w-3.5 h-3.5" />}>
            Export logs
          </Button>
        }
        className="mb-6"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total events',   value: stats.total,    color: 'text-slate-800', bg: 'bg-slate-50', border: 'border-slate-200'  },
          { label: 'Critical',       value: stats.critical, color: 'text-red-700',   bg: 'bg-red-50',   border: 'border-red-200'    },
          { label: 'Warnings',       value: stats.warning,  color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200'  },
          { label: 'Informational',  value: stats.info,     color: 'text-emerald-700',  bg: 'bg-emerald-50',  border: 'border-emerald-200'   },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} border ${s.border} rounded-lg px-4 py-3`}>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Immutability notice */}
      <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mb-4">
        <Info className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-emerald-800">
          <span className="font-semibold">Append-only log.</span> Events are generated automatically by Ventura during data processing, anomaly detection, and user actions. Entries cannot be modified or deleted.
        </p>
      </div>

      {/* Filters */}
      <Card padding="sm" className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5 flex-1 min-w-48 max-w-80">
            <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search by actor, resource, or detail…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none w-full"
            />
          </div>
          <select
            value={sevFilter}
            onChange={e => setSev(e.target.value as typeof sevFilter)}
            className="text-xs border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-600 bg-white"
          >
            <option value="All">All severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
          <span className="text-xs text-slate-500 ml-auto">{filtered.length} events</span>
        </div>
      </Card>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-card overflow-hidden">
        <table className="w-full data-table">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-6"></th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Timestamp</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actor</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Event</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Resource</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-sm text-slate-500">
                  {entries.length === 0
                    ? 'No events recorded yet.'
                    : 'No events match the current filters.'}
                </td>
              </tr>
            ) : filtered.map((ev) => (
              <tr key={ev.id} className={`hover:bg-slate-50 transition-colors ${ev.severity === 'critical' ? 'bg-red-50/40' : ''}`}>
                <td className="px-4 py-3">
                  {severityIcon[ev.severity]}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap font-mono">
                  {new Date(ev.ts).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <p className="text-xs font-semibold text-slate-800">{ev.actor}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="auditSeverity" value={ev.severity}>{ev.event}</Badge>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">{ev.resource}</span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-700 max-w-md">
                  <p className="truncate" title={ev.detail}>{ev.detail}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppLayout>
  )
}
