import { useState, useMemo, useEffect } from 'react'
import AppLayout from '../components/layout/AppLayout'
import PageHeader from '../components/ui/PageHeader'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { useDataReady } from '../hooks/useDataReady'
import { loadDataset } from '../lib/dataStore'
import type { AuditEntry } from '../lib/dataStore'
import type { AuditEventRow } from '../lib/auditServer'
import { Search, Download, AlertTriangle, Info, AlertCircle, Laptop } from 'lucide-react'

const severityIcon = {
  info:     <Info className="w-3.5 h-3.5 text-slate-400" />,
  warning:  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />,
  critical: <AlertCircle className="w-3.5 h-3.5 text-red-500" />,
}

export default function AuditLogsPage() {
  const { isReady } = useDataReady()
  const [serverEvents, setServerEvents] = useState<AuditEventRow[]>([])
  const [serverLoading, setServerLoading] = useState(true)
  const [localEntries,  setLocalEntries] = useState<AuditEntry[]>([])
  const [search,    setSearch]   = useState('')
  const [sevFilter, setSev]      = useState<'All' | 'info' | 'warning' | 'critical'>('All')

  // Real, server-side, append-only trail — independent of whether any
  // financial data has been uploaded (MFA, team, and connection events all
  // happen before that). See supabase/migrations/002_security_audit_log.sql
  // and src/lib/auditServer.ts.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/audit/list')
        if (res.ok) {
          const body = await res.json() as { events: AuditEventRow[] }
          if (!cancelled) setServerEvents(body.events ?? [])
        }
      } catch {}
      if (!cancelled) setServerLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (isReady) {
      const ds = loadDataset()
      setLocalEntries(ds?.auditLog ?? [])
    }
  }, [isReady])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return serverEvents.filter(ev => {
      const detail = ev.detail ?? '', resource = ev.resource ?? '', actor = ev.actor_email ?? ''
      if (q && !detail.toLowerCase().includes(q) && !actor.toLowerCase().includes(q) && !resource.toLowerCase().includes(q) && !ev.event.toLowerCase().includes(q)) return false
      if (sevFilter !== 'All' && ev.severity !== sevFilter) return false
      return true
    })
  }, [serverEvents, search, sevFilter])

  const stats = useMemo(() => ({
    total:    serverEvents.length,
    critical: serverEvents.filter(e => e.severity === 'critical').length,
    warning:  serverEvents.filter(e => e.severity === 'warning').length,
    info:     serverEvents.filter(e => e.severity === 'info').length,
  }), [serverEvents])

  return (
    <AppLayout title="Audit Logs">
      <PageHeader
        title="Audit Logs"
        subtitle="Server-side, append-only record of security-relevant account and workspace actions"
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

      {/* Immutability notice — true today: writes go through a service-role
          API route with no UPDATE/DELETE endpoint anywhere in the app, and
          the table's RLS grants zero access to the browser's anon key. */}
      <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mb-4">
        <Info className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-emerald-800">
          <span className="font-semibold">Append-only.</span> Written server-side when security-relevant actions occur (MFA verification, team role changes, member removal, workspace joins, integration connections). No update or delete path exists in the application for these rows.
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
      <div className="bg-white border border-slate-200 rounded-lg shadow-card overflow-hidden mb-8">
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
                  {serverLoading
                    ? 'Loading…'
                    : serverEvents.length === 0
                    ? 'No security events recorded yet. Events appear here as your team signs in, changes roles, or connects integrations.'
                    : 'No events match the current filters.'}
                </td>
              </tr>
            ) : filtered.map((ev) => (
              <tr key={ev.id} className={`hover:bg-slate-50 transition-colors ${ev.severity === 'critical' ? 'bg-red-50/40' : ''}`}>
                <td className="px-4 py-3">
                  {severityIcon[ev.severity]}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap font-mono">
                  {new Date(ev.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <p className="text-xs font-semibold text-slate-800">{ev.actor_email ?? '—'}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="auditSeverity" value={ev.severity}>{ev.event}</Badge>
                </td>
                <td className="px-4 py-3">
                  {ev.resource && <span className="text-xs font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">{ev.resource}</span>}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700 max-w-md">
                  <p className="truncate" title={ev.detail ?? ''}>{ev.detail}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Local processing log — clearly separated. This is NOT the
          compliance-grade trail above: it's regenerated in your browser
          from whatever data you've uploaded, stored in localStorage, and
          (unlike the table above) can be cleared by clearing browser data
          or edited via devtools. It exists for quick visibility into what
          the anomaly engine did with your last upload, not as an audit
          record. */}
      {localEntries.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Laptop className="w-4 h-4 text-slate-400" />
            <p className="text-sm font-semibold text-slate-900">Local processing log</p>
          </div>
          <p className="text-xs text-slate-500 mb-3 max-w-2xl">
            Generated in this browser while parsing and analyzing your uploaded files. Stored locally on this
            device only — it is not part of the server-side security audit trail above, is not shared across
            devices or team members, and is cleared if you clear browser data.
          </p>
          <div className="bg-white border border-slate-200 rounded-lg shadow-card overflow-hidden divide-y divide-slate-100">
            {localEntries.slice(0, 20).map((item, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.severity === 'critical' ? 'bg-red-500' : item.severity === 'warning' ? 'bg-amber-500' : 'bg-slate-400'}`} />
                <p className="text-xs font-medium text-slate-700 flex-1 truncate">{item.event}</p>
                <p className="text-xs text-slate-400 flex-shrink-0 hidden sm:block">{item.actor}</p>
                <p className="text-[10px] text-slate-400 flex-shrink-0 font-mono">{new Date(item.ts).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppLayout>
  )
}
