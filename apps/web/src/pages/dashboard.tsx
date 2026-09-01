import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import AppLayout from '../components/layout/AppLayout'
import Badge from '../components/ui/Badge'
import DataUploadWidget from '../components/ui/DataUploadWidget'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useDataReady } from '../hooks/useDataReady'
import { loadDataset } from '../lib/dataStore'
import type { Dataset } from '../lib/dataStore'
import { computeTierSummary, loadTierConfig, tierLabel, tierColor, tierDot } from '../lib/dataLayers'
import type { TierSummary } from '../lib/dataLayers'
import { getTestingMode } from '../lib/dataMasking'
import { getConfidenceThreshold } from '../lib/governance'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  ExclamationTriangleIcon,
  ArrowRightIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowUpTrayIcon,
  ChartBarIcon,
  InboxIcon,
} from '@heroicons/react/24/outline'
import { Copy, RefreshCw, Trash2, UserPlus, Check, Shield } from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtC(n: number): string {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return '$' + (n / 1_000).toFixed(0) + 'K'
  return '$' + n.toFixed(0)
}

function fmtFull(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function fmtDate(iso: string): string {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return iso }
}

function timeAgo(iso: string): string {
  if (!iso) return '—'
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (sec < 60)    return 'just now'
  if (sec < 3600)  return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  return `${Math.floor(sec / 86400)}d ago`
}

const SEV_LEFT: Record<string, string> = {
  CRITICAL: 'border-l-red-500',
  HIGH:     'border-l-orange-400',
  MEDIUM:   'border-l-amber-400',
  LOW:      'border-l-slate-500',
}

const SEV_AMT: Record<string, string> = {
  CRITICAL: 'text-red-400',
  HIGH:     'text-orange-400',
  MEDIUM:   'text-amber-400',
  LOW:      'text-text-muted',
}

const SEV_BANNER: Record<string, string> = {
  CRITICAL: 'border-l-red-500',
  HIGH:     'border-l-orange-400',
  MEDIUM:   'border-l-amber-400',
  LOW:      'border-l-slate-500',
}

const SEV_LABEL: Record<string, string> = {
  CRITICAL: 'text-red-400',
  HIGH:     'text-orange-400',
  MEDIUM:   'text-amber-400',
  LOW:      'text-text-muted',
}

// ─── Component ────────────────────────────────────────────────────────────────

interface TeamMember {
  user_id: string
  email: string
  name: string
  role: string
  joined_at: string
}

const ROLE_COLORS: Record<string, string> = {
  admin:   'bg-purple-500/10 text-purple-400 border-purple-500/30',
  editor:  'bg-accent-500/10 text-accent-300 border-accent-500/30',
  analyst: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  viewer:  'bg-surface-overlay text-text-muted border-border',
}

function fmtJoined(iso: string): string {
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return '—' }
}

export default function DashboardPage() {
  const user = useCurrentUser()
  const { isReady, mounted, markReady } = useDataReady()
  const [dataset,     setDataset]     = useState<Dataset | null>(null)
  const [tierSummary, setTierSummary] = useState<TierSummary | null>(null)
  const [testMode,    setTestMode]    = useState<string>('live')

  // Team state
  const [members,        setMembers]        = useState<TeamMember[]>([])
  const [inviteCode,     setInviteCode]     = useState<string | null>(null)
  const [teamLoading,    setTeamLoading]    = useState(false)
  const [generating,     setGenerating]     = useState(false)
  const [copied,         setCopied]         = useState<'code' | 'link' | null>(null)
  const [removingId,     setRemovingId]     = useState<string | null>(null)
  const [updatingRole,   setUpdatingRole]   = useState<string | null>(null)

  const company = user?.company || 'Your Organization'

  useEffect(() => {
    if (isReady) {
      const ds = loadDataset()
      setDataset(ds)
      setTestMode(getTestingMode())
      if (ds?.sampleTransactions?.length) {
        setTierSummary(computeTierSummary(ds.sampleTransactions, loadTierConfig()))
      }
    }
  }, [isReady])

  const loadTeam = useCallback(async () => {
    setTeamLoading(true)
    try {
      const res = await fetch('/api/team/members')
      if (res.ok) {
        const body = await res.json() as { members: TeamMember[]; inviteCode: string | null }
        setMembers(body.members)
        setInviteCode(body.inviteCode)
      }
    } catch {}
    setTeamLoading(false)
  }, [])

  useEffect(() => { loadTeam() }, [loadTeam])

  async function generateInvite() {
    setGenerating(true)
    try {
      const res = await fetch('/api/invite/generate', { method: 'POST' })
      if (res.ok) {
        const body = await res.json() as { code: string }
        setInviteCode(body.code)
      }
    } catch {}
    setGenerating(false)
  }

  function copyToClipboard(text: string, type: 'code' | 'link') {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(type)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  async function removeMember(userId: string) {
    setRemovingId(userId)
    try {
      const res = await fetch('/api/team/remove', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId }),
      })
      if (res.ok) setMembers(prev => prev.filter(m => m.user_id !== userId))
    } catch {}
    setRemovingId(null)
  }

  async function updateRole(userId: string, role: string) {
    setUpdatingRole(userId)
    try {
      const res = await fetch('/api/team/update-role', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId, role }),
      })
      if (res.ok) setMembers(prev => prev.map(m => m.user_id === userId ? { ...m, role } : m))
    } catch {}
    setUpdatingRole(null)
  }

  if (!mounted) return <AppLayout title="Dashboard"><div className="h-96" /></AppLayout>

  // ── Onboarding / empty state ───────────────────────────────────────────────
  if (!isReady || !dataset) {
    // Financial data currently lives in this browser's local storage, not a
    // shared backend — an employee signing in on their own device has never
    // uploaded anything themselves, so this is never "their" data to
    // connect. Showing them the admin's upload flow implied they were the
    // ones expected to connect a data source, which is both wrong and (for
    // viewer/analyst roles) not something they're even permitted to do.
    if (user?.role === 'employee') {
      return (
        <AppLayout title="Dashboard">
          <div className="max-w-lg mx-auto py-16 text-center">
            <div className="w-14 h-14 bg-surface-overlay border border-border flex items-center justify-center mx-auto mb-4">
              <InboxIcon className="w-7 h-7 text-text-muted" />
            </div>
            <h1 className="text-xl font-bold text-text-primary mb-2">No data on this device yet</h1>
            <p className="text-sm text-text-muted max-w-sm mx-auto">
              Financial data is uploaded per-device by your workspace admin and hasn&apos;t been loaded in this
              browser. Ask your admin to upload from your device, or check back after they&apos;ve connected data
              from theirs.
            </p>
          </div>
        </AppLayout>
      )
    }
    return (
      <AppLayout title="Dashboard">
        <div className="max-w-lg mx-auto py-16">
          <div className="text-center mb-10">
            <div className="w-14 h-14 bg-surface-overlay border border-border flex items-center justify-center mx-auto mb-4">
              <ChartBarIcon className="w-7 h-7 text-text-muted" />
            </div>
            <h1 className="text-xl font-bold text-text-primary mb-2">Set up your finance workspace</h1>
            <p className="text-sm text-text-muted max-w-sm mx-auto">
              Connect your accounting data to detect anomalies, surface savings, and take action on financial risk.
            </p>
          </div>

          <div className="space-y-2 mb-8">
            {[
              { n: 1, text: 'Upload a transaction export or connect your accounting system', href: '/integrations', cta: 'Connect data' },
              { n: 2, text: 'Ventura normalizes and scans transactions for anomalies automatically' },
              { n: 3, text: 'Review findings — approve, escalate, or dismiss each alert' },
              { n: 4, text: 'Monitor spend trends, vendor risk, and savings opportunities' },
            ].map(s => (
              <div key={s.n} className="flex items-center gap-3 p-3.5 bg-surface-raised border border-border">
                <div className="w-6 h-6 bg-surface-overlay text-text-muted text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {s.n}
                </div>
                <p className="text-sm text-text-secondary flex-1">{s.text}</p>
                {s.href && (
                  <Link href={s.href} className="text-xs bg-accent-500 text-white px-3 py-1.5 font-semibold whitespace-nowrap hover:bg-accent-600 transition-colors">
                    {s.cta}
                  </Link>
                )}
              </div>
            ))}
          </div>

          <DataUploadWidget onReady={markReady} />
        </div>
      </AppLayout>
    )
  }

  // ── Data derivations ───────────────────────────────────────────────────────
  const openAnomalies      = dataset.anomalies.filter(a => a.status !== 'Resolved')
  const criticalCount      = openAnomalies.filter(a => a.severity === 'CRITICAL').length
  const highCount          = openAnomalies.filter(a => a.severity === 'HIGH').length
  const totalExposure      = openAnomalies.reduce((s, a) => s + a.amount, 0)
  const topAnomaly         = openAnomalies[0] ?? null
  const topSeverity        = criticalCount > 0 ? 'CRITICAL' : highCount > 0 ? 'HIGH' : 'MEDIUM'
  const duplicates         = openAnomalies.filter(a => a.type === 'duplicate')
  const duplicateSavings   = duplicates.reduce((s, a) => s + a.amount, 0)
  const highConf           = openAnomalies.filter(a => a.confidence >= getConfidenceThreshold())
  const topVendors         = dataset.topVendors.slice(0, 8)
  const categories         = dataset.categoryBreakdown.slice(0, 8)
  const maxCat             = categories[0]?.total ?? 1
  const recentAudit        = dataset.auditLog.slice(0, 4)
  const topVendorShare     = topVendors[0] ? Math.round((topVendors[0].total / dataset.totalSpend) * 100) : 0
  const dateLabel          = dataset.dateRange.from
    ? `${fmtDate(dataset.dateRange.from)} – ${fmtDate(dataset.dateRange.to)}`
    : 'All time'

  return (
    <AppLayout title="Dashboard">

      {/* ── Data trust strip ── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mb-5 text-[11px] text-text-muted border-b border-border-subtle pb-3.5">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
          <span className="font-semibold text-text-secondary">
            {testMode === 'live' ? 'Live data' : testMode === 'masked' ? 'Masked data' : 'Synthetic data'}
          </span>
        </div>
        {dataset.uploadedAt && (
          <span className="flex items-center gap-1.5">
            <ClockIcon className="w-3 h-3" />
            Last scanned {timeAgo(dataset.uploadedAt)}
          </span>
        )}
        {testMode !== 'live' && (
          <span className="bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-wide text-[10px]">
            {testMode === 'masked' ? 'Masked mode active' : 'Synthetic mode active'}
          </span>
        )}
        {(dataset.creditCount ?? 0) > 0 && (
          <span title="Credit/refund rows identified via a Debit/Credit column split — excluded from spend totals and anomaly detection so refunds don't get counted as vendor spend.">
            {dataset.creditCount} credit{dataset.creditCount !== 1 ? 's' : ''} excluded ({fmtC(dataset.totalCredits ?? 0)})
          </span>
        )}
        {tierSummary && (
          <>
            <span className="text-border">|</span>
            {(['hot', 'warm', 'cold'] as const).map(t => {
              const b = tierSummary[t]
              if (!b.count) return null
              return (
                <span key={t} className={`flex items-center gap-1 font-medium ${tierColor(t)}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${tierDot(t)}`} />
                  {tierLabel(t)}: {b.count.toLocaleString()}
                </span>
              )
            })}
          </>
        )}
        {(dataset.pendingReviewCount ?? 0) > 0 && (
          <Link href="/import-center" className="flex items-center gap-1 text-amber-400 font-semibold hover:text-amber-300 transition-colors">
            <InboxIcon className="w-3 h-3" /> {dataset.pendingReviewCount} pending review
          </Link>
        )}
        <Link href="/admin/data-settings" className="ml-auto flex items-center gap-0.5 text-text-muted hover:text-text-secondary transition-colors">
          Configure <ChevronRightIcon className="w-3 h-3" />
        </Link>
      </div>

      {/* ── Priority alert banner ── */}
      {topAnomaly && (
        <div className={`bg-surface-raised border border-border border-l-4 ${SEV_BANNER[topSeverity]} mb-6 overflow-hidden`}>
          <div className="flex items-stretch divide-x divide-border">
            {/* Content */}
            <div className="flex-1 p-5 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[10px] font-bold tracking-widest uppercase ${SEV_LABEL[topSeverity]}`}>
                  {criticalCount > 0 ? 'Critical — Immediate Action Required' : highCount > 0 ? 'High Priority' : 'Needs Review'}
                </span>
                <span className="text-[10px] text-text-muted">·</span>
                <span className="text-[10px] text-text-muted">
                  {openAnomalies.length} open alert{openAnomalies.length !== 1 ? 's' : ''}
                  {highConf.length > 0 ? ` · ${highConf.length} high-confidence` : ''}
                </span>
              </div>
              <p className="text-text-primary font-semibold text-base leading-snug">{topAnomaly.title}</p>
              <p className="text-text-muted text-xs mt-1">
                {topAnomaly.vendor}{topAnomaly.category ? ` · ${topAnomaly.category}` : ''}
              </p>
              <p className="text-text-secondary text-xs mt-2 leading-relaxed line-clamp-2">{topAnomaly.description}</p>
            </div>

            {/* Amount */}
            <div className="px-5 py-5 flex flex-col items-center justify-center gap-1.5 flex-shrink-0">
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">At Risk</p>
              <p className={`text-2xl font-bold ${SEV_AMT[topSeverity]}`}>
                {fmtC(topAnomaly.amount)}
              </p>
              <div className="flex items-center gap-1.5">
                <div className="w-16 h-1 bg-surface-overlay overflow-hidden">
                  <div className="h-full bg-slate-400" style={{ width: `${topAnomaly.confidence}%` }} />
                </div>
                <span className="text-[10px] font-semibold text-text-secondary">{topAnomaly.confidence}% conf.</span>
              </div>
            </div>

            {/* CTA */}
            <div className="px-5 py-5 flex flex-col items-center justify-center gap-3 flex-shrink-0">
              <Link
                href={`/anomalies/${topAnomaly.id}`}
                className="flex items-center gap-2 bg-accent-500 hover:bg-accent-600 text-white text-sm font-semibold px-4 py-2.5 transition-colors whitespace-nowrap"
              >
                Investigate <ArrowRightIcon className="w-3.5 h-3.5" />
              </Link>
              <Link href="/anomalies" className="text-[10px] text-text-muted hover:text-text-secondary transition-colors">
                View all {openAnomalies.length} alerts
              </Link>
            </div>
          </div>

          {/* Secondary alerts strip */}
          {openAnomalies.length > 1 && (
            <div className="border-t border-border px-5 py-2.5 flex items-center gap-5 overflow-x-auto bg-surface-hover">
              {openAnomalies.slice(1, 5).map(a => (
                <Link key={a.id} href={`/anomalies/${a.id}`} className="flex items-center gap-2 flex-shrink-0 group">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${a.severity === 'CRITICAL' ? 'bg-red-500' : a.severity === 'HIGH' ? 'bg-orange-400' : 'bg-amber-400'}`} />
                  <span className="text-[11px] text-text-secondary group-hover:text-text-primary transition-colors truncate max-w-[160px]">{a.title}</span>
                  <span className="text-[11px] font-semibold text-text-muted">{fmtC(a.amount)}</span>
                </Link>
              ))}
              {openAnomalies.length > 5 && (
                <span className="text-[10px] text-text-muted flex-shrink-0">+{openAnomalies.length - 5} more</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold text-text-primary">{company}</h1>
          <p className="text-xs text-text-muted mt-0.5">{dateLabel} · {dataset.files.length} file{dataset.files.length !== 1 ? 's' : ''} · {dataset.totalTransactions.toLocaleString()} transactions</p>
        </div>
        <Link
          href="/integrations"
          className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary border border-border px-3 py-1.5 bg-surface-raised hover:bg-surface-hover transition-colors"
        >
          <ArrowUpTrayIcon className="w-3 h-3" /> Upload more
        </Link>
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-surface-raised border border-border px-5 py-4">
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Total Spend</p>
          <p className="text-3xl font-bold leading-none text-text-primary">{fmtC(dataset.totalSpend)}</p>
          <p className="text-xs text-text-muted mt-1.5">{dateLabel}</p>
        </div>

        <div className="bg-surface-raised border border-border px-5 py-4">
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Risk Exposure</p>
          <p className={`text-3xl font-bold leading-none ${totalExposure > 0 ? 'text-red-400' : 'text-text-muted'}`}>{fmtC(totalExposure)}</p>
          <p className="text-xs text-text-muted mt-1.5">{openAnomalies.length} open anomal{openAnomalies.length !== 1 ? 'ies' : 'y'}</p>
        </div>

        <div className="bg-surface-raised border border-border px-5 py-4">
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Savings Identified</p>
          <p className={`text-3xl font-bold leading-none ${duplicateSavings > 0 ? 'text-text-primary' : 'text-text-muted'}`}>{fmtC(duplicateSavings)}</p>
          <p className="text-xs text-text-muted mt-1.5">{duplicates.length} duplicate payment{duplicates.length !== 1 ? 's' : ''}</p>
        </div>

        <div className="bg-surface-raised border border-border px-5 py-4">
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Transactions</p>
          <p className="text-3xl font-bold leading-none text-text-primary">{dataset.totalTransactions.toLocaleString()}</p>
          <p className="text-xs text-text-muted mt-1.5">{dataset.uniqueVendors.toLocaleString()} unique vendors</p>
        </div>
      </div>

      {/* ── Risk & Savings Chart ── */}
      {openAnomalies.length > 0 && (() => {
        type TypeRow = { type: string; exposure: number; savings: number }
        const byType = openAnomalies.reduce<Record<string, TypeRow>>((acc, a) => {
          const key = a.type.replace(/_/g, ' ')
          if (!acc[key]) acc[key] = { type: key, exposure: 0, savings: 0 }
          acc[key].exposure += a.amount
          if (a.type === 'duplicate') acc[key].savings += a.amount
          return acc
        }, {})
        const chartData = Object.values(byType).sort((a, b) => b.exposure - a.exposure)
        const SEV_COLORS: Record<string, string> = {
          duplicate: '#f87171', outlier: '#fb923c', large_amount: '#fbbf24',
          round_number: '#c084fc', high_frequency: '#f472b6', missing_vendor: '#94a3b8',
        }
        return (
          <div className="bg-surface-raised border border-border overflow-hidden mb-6">
            <div className="px-5 py-3.5 border-b border-border-subtle flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-text-primary">Risk & Savings Overview</p>
                <p className="text-xs text-text-muted">Anomaly exposure vs recoverable savings by type</p>
              </div>
              <div className="flex items-center gap-5 text-xs text-text-muted">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-2.5 h-2.5 bg-red-400 inline-block" /> Risk Exposure
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-2.5 h-2.5 bg-accent-300 inline-block" /> Savings Identified
                </span>
              </div>
            </div>
            <div className="px-2 py-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#22304a" vertical={false} />
                  <XAxis dataKey="type" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => fmtC(v)} width={52} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, background: '#111a2c', border: '1px solid #22304a', color: '#e8edf5' }}
                    formatter={(v: number, name: string) => [fmtFull(v), name === 'exposure' ? 'Risk Exposure' : 'Savings Identified']}
                  />
                  <Bar dataKey="exposure" name="exposure" maxBarSize={40}>
                    {chartData.map((entry) => (
                      <Cell key={entry.type} fill={SEV_COLORS[entry.type.replace(/ /g, '_')] ?? '#94a3b8'} />
                    ))}
                  </Bar>
                  <Bar dataKey="savings" name="savings" fill="#7ea9dc" maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )
      })()}

      {/* ── Main grid ── */}
      <div className="grid lg:grid-cols-5 gap-5 mb-5">

        {/* Left 3/5 */}
        <div className="lg:col-span-3 space-y-5">

          {/* Spend trend */}
          {dataset.monthlyBreakdown.length > 1 && (
            <div className="bg-surface-raised border border-border overflow-hidden">
              <div className="px-5 py-3.5 flex items-center justify-between border-b border-border-subtle">
                <div>
                  <p className="text-sm font-semibold text-text-primary">Spend Trend</p>
                  <p className="text-xs text-text-muted">{dataset.monthlyBreakdown.length} months</p>
                </div>
                <span className="text-xs font-bold text-text-secondary">{fmtC(dataset.totalSpend)} total</span>
              </div>
              <div className="px-2 py-3 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dataset.monthlyBreakdown} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#7ea9dc" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#7ea9dc" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#22304a" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => fmtC(v)} width={52} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, background: '#111a2c', border: '1px solid #22304a', color: '#e8edf5' }}
                      formatter={(v: number) => [fmtFull(v), 'Spend']}
                    />
                    <Area type="monotone" dataKey="spend" stroke="#7ea9dc" strokeWidth={1.5} fill="url(#spendGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Open anomaly list */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-text-primary">Open Anomalies</p>
                <p className="text-xs text-text-muted mt-0.5">
                  {openAnomalies.length} require review
                  {highConf.length > 0 ? ` · ${highConf.length} high-confidence` : ''}
                </p>
              </div>
              <Link href="/anomalies" className="text-xs text-text-secondary hover:text-text-primary flex items-center gap-0.5 font-medium transition-colors">
                All anomalies <ChevronRightIcon className="w-3 h-3" />
              </Link>
            </div>

            {openAnomalies.length === 0 ? (
              <div className="bg-surface-raised border border-border p-8 text-center">
                <CheckCircleIcon className="w-8 h-8 text-text-muted mx-auto mb-2" />
                <p className="text-sm font-semibold text-text-secondary">No open anomalies</p>
                <p className="text-xs text-text-muted mt-1">All findings reviewed or none detected in current data.</p>
              </div>
            ) : (
              <div className="bg-surface-raised border border-border divide-y divide-border-subtle overflow-hidden">
                {openAnomalies.slice(0, 6).map(a => (
                  <Link
                    key={a.id}
                    href={`/anomalies/${a.id}`}
                    className={`flex items-center gap-3 border-l-4 ${SEV_LEFT[a.severity] ?? 'border-l-slate-500'} px-4 py-3 hover:bg-surface-hover transition-colors group`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Badge variant="severity" value={a.severity} dot>{a.severity}</Badge>
                        <span className="text-[10px] text-text-muted font-medium uppercase tracking-wide">{a.type.replace(/_/g, ' ')}</span>
                      </div>
                      <p className="text-sm font-medium text-text-primary group-hover:text-text-secondary transition-colors truncate">{a.title}</p>
                      <p className="text-xs text-text-muted truncate">{a.vendor}{a.category ? ` · ${a.category}` : ''}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <p className={`text-sm font-bold ${SEV_AMT[a.severity]}`}>{fmtC(a.amount)}</p>
                      <div className="flex items-center gap-1.5">
                        <div className="w-10 h-1 bg-surface-overlay overflow-hidden">
                          <div className="h-full bg-slate-400" style={{ width: `${a.confidence}%` }} />
                        </div>
                        <span className="text-[10px] text-text-muted">{a.confidence}%</span>
                      </div>
                    </div>
                  </Link>
                ))}
                {openAnomalies.length > 6 && (
                  <Link
                    href="/anomalies"
                    className="flex items-center justify-center gap-1.5 py-3 text-xs font-medium text-text-muted hover:text-text-secondary hover:bg-surface-hover border-t border-border-subtle transition-colors"
                  >
                    View {openAnomalies.length - 6} more <ChevronRightIcon className="w-3 h-3" />
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right 2/5 */}
        <div className="lg:col-span-2 space-y-5">

          {/* Savings opportunities */}
          <div className="bg-surface-raised border border-border overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border-subtle flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-text-primary">Savings Opportunities</p>
                <p className="text-xs text-text-muted">Duplicate & recoverable spend</p>
              </div>
              {duplicateSavings > 0 && (
                <p className="text-base font-bold text-text-primary">{fmtC(duplicateSavings)}</p>
              )}
            </div>
            <div className="p-5">
              {duplicates.length > 0 ? (
                <div className="space-y-3">
                  {duplicates.slice(0, 4).map(a => (
                    <Link key={a.id} href={`/anomalies/${a.id}`} className="flex items-center justify-between group">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-text-secondary group-hover:text-text-muted transition-colors truncate">{a.vendor}</p>
                        <p className="text-[10px] text-text-muted">{a.confidence}% confidence</p>
                      </div>
                      <span className="text-sm font-bold text-text-primary flex-shrink-0 ml-4">{fmtC(a.amount)}</span>
                    </Link>
                  ))}
                  {duplicates.length > 4 && (
                    <p className="text-[11px] text-text-muted">+{duplicates.length - 4} more duplicates</p>
                  )}
                  <div className="pt-3 border-t border-border-subtle flex items-center justify-between">
                    <span className="text-[11px] font-bold text-text-muted uppercase tracking-wide">Total recoverable</span>
                    <span className="text-sm font-bold text-text-primary">{fmtC(duplicateSavings)}</span>
                  </div>
                </div>
              ) : (
                <div className="py-3 text-center">
                  <CheckCircleIcon className="w-6 h-6 text-text-muted mx-auto mb-1.5" />
                  <p className="text-xs text-text-muted">No duplicate payments detected.</p>
                </div>
              )}
            </div>
          </div>

          {/* Category breakdown */}
          {categories.length > 0 && (
            <div className="bg-surface-raised border border-border overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border-subtle">
                <p className="text-sm font-semibold text-text-primary">Spend by Category</p>
                <p className="text-xs text-text-muted">Top {categories.length} categories</p>
              </div>
              <div className="p-5 space-y-2.5">
                {categories.map(cat => {
                  const pct = Math.round((cat.total / maxCat) * 100)
                  const hasAlert = openAnomalies.some(a => a.category === cat.category)
                  return (
                    <div key={cat.category}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs text-text-secondary font-medium truncate max-w-[120px]">{cat.category || 'Uncategorized'}</span>
                          {hasAlert && <ExclamationTriangleIcon className="w-2.5 h-2.5 text-amber-400 flex-shrink-0" />}
                        </div>
                        <span className="text-xs font-semibold text-text-secondary ml-2">{fmtC(cat.total)}</span>
                      </div>
                      <div className="h-1.5 bg-surface-overlay overflow-hidden">
                        <div className={`h-full ${hasAlert ? 'bg-amber-400' : 'bg-slate-400'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Vendor concentration */}
          {topVendors.length > 0 && (
            <div className="bg-surface-raised border border-border overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border-subtle flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-text-primary">Vendor Concentration</p>
                  <p className="text-xs text-text-muted">Top vendors by spend</p>
                </div>
                {topVendorShare > 40 && (
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5">
                    {topVendorShare}% top vendor
                  </span>
                )}
              </div>
              <div className="p-5 space-y-2.5">
                {topVendors.map(v => {
                  const pct = Math.round((v.total / (topVendors[0]?.total ?? 1)) * 100)
                  const share = Math.round((v.total / dataset.totalSpend) * 100)
                  const alert = openAnomalies.some(a => a.vendor.toLowerCase() === v.vendor.toLowerCase())
                  return (
                    <div key={v.vendor}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs text-text-secondary font-medium truncate max-w-[120px]" title={v.vendor}>{v.vendor}</span>
                          {alert && <ExclamationTriangleIcon className="w-2.5 h-2.5 text-amber-400 flex-shrink-0" />}
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <span className="text-[10px] text-text-muted">{share}%</span>
                          <span className="text-xs font-semibold text-text-secondary">{fmtC(v.total)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-surface-overlay overflow-hidden">
                        <div className={`h-full ${alert ? 'bg-amber-400' : 'bg-slate-400'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Processing log ── */}
      {recentAudit.length > 0 && (
        <div className="bg-surface-raised border border-border overflow-hidden mb-6">
          <div className="px-5 py-3.5 flex items-center justify-between border-b border-border-subtle">
            <p className="text-sm font-semibold text-text-primary">Processing Log</p>
            <Link href="/audit-logs" className="text-xs text-text-secondary hover:text-text-primary flex items-center gap-0.5 transition-colors">
              Full audit log <ChevronRightIcon className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-border-subtle">
            {recentAudit.map((item, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.severity === 'critical' ? 'bg-red-500' : item.severity === 'warning' ? 'bg-amber-500' : 'bg-slate-400'}`} />
                <p className="text-xs font-medium text-text-secondary flex-1 truncate">{item.event}</p>
                <p className="text-xs text-text-muted flex-shrink-0 hidden sm:block">{item.actor}</p>
                <p className="text-[10px] text-text-muted flex-shrink-0">{timeAgo(item.ts)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Team ── */}
      <div className="bg-surface-raised border border-border overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border-subtle flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-text-primary">Team Access</p>
            <p className="text-xs text-text-muted">
              {members.length === 0 ? 'No members yet' : `${members.length} member${members.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <Link
            href="/employee-login"
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary border border-border px-3 py-1.5 bg-surface-raised hover:bg-surface-hover transition-colors"
          >
            <UserPlus className="w-3 h-3" /> Employee portal
          </Link>
        </div>

        <div className="p-5 space-y-5">
          {/* Invite code card */}
          <div className="border border-border rounded-lg p-4 bg-surface-hover">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-text-secondary">Invite link</p>
              <button
                onClick={generateInvite}
                disabled={generating}
                className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-text-secondary transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${generating ? 'animate-spin' : ''}`} />
                {inviteCode ? 'Regenerate' : 'Generate'}
              </button>
            </div>

            {inviteCode ? (
              <div className="space-y-2">
                {/* Code display */}
                <div className="flex items-center gap-2 bg-surface-raised border border-border rounded px-3 py-2">
                  <code className="text-[11px] text-text-secondary flex-1 truncate font-mono">{inviteCode}</code>
                  <button
                    onClick={() => copyToClipboard(inviteCode, 'code')}
                    className="flex-shrink-0 text-text-muted hover:text-text-secondary transition-colors"
                    title="Copy invite code"
                  >
                    {copied === 'code' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {/* Link display */}
                <div className="flex items-center gap-2 bg-surface-raised border border-border rounded px-3 py-2">
                  <span className="text-[11px] text-text-muted flex-1 truncate">
                    {typeof window !== 'undefined' ? `${window.location.origin}/join?code=${inviteCode}` : `/join?code=${inviteCode}`}
                  </span>
                  <button
                    onClick={() => copyToClipboard(
                      `${typeof window !== 'undefined' ? window.location.origin : ''}/join?code=${inviteCode}`,
                      'link'
                    )}
                    className="flex-shrink-0 text-text-muted hover:text-text-secondary transition-colors"
                    title="Copy invite link"
                  >
                    {copied === 'link' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[11px] text-text-muted">
                  Share this link with employees. Regenerating the link invalidates the old one.
                </p>
              </div>
            ) : (
              <p className="text-xs text-text-muted">
                No invite link yet.{' '}
                <button onClick={generateInvite} className="text-accent-400 hover:text-accent-300 font-medium transition-colors">
                  Generate one
                </button>{' '}
                to let employees join this workspace.
              </p>
            )}
          </div>

          {/* Members table */}
          {teamLoading ? (
            <p className="text-xs text-text-muted py-2">Loading team…</p>
          ) : members.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-10 h-10 rounded-full bg-surface-overlay flex items-center justify-center mx-auto mb-2">
                <Shield className="w-5 h-5 text-text-muted" />
              </div>
              <p className="text-sm font-medium text-text-muted">No team members yet</p>
              <p className="text-xs text-text-muted mt-1">
                Generate an invite link above and share it with your team.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border-subtle">
                    <th className="text-left text-[10px] font-semibold text-text-muted uppercase tracking-wider pb-2 pr-4">Member</th>
                    <th className="text-left text-[10px] font-semibold text-text-muted uppercase tracking-wider pb-2 pr-4">Role</th>
                    <th className="text-left text-[10px] font-semibold text-text-muted uppercase tracking-wider pb-2 pr-4">Joined</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {members.map(m => (
                    <tr key={m.user_id} className="group">
                      <td className="py-2.5 pr-4">
                        <p className="font-medium text-text-secondary">{m.name}</p>
                        <p className="text-text-muted">{m.email}</p>
                      </td>
                      <td className="py-2.5 pr-4">
                        <select
                          value={m.role}
                          onChange={e => updateRole(m.user_id, e.target.value)}
                          disabled={updatingRole === m.user_id}
                          className={`text-[11px] font-semibold border rounded px-2 py-0.5 focus:outline-none cursor-pointer disabled:opacity-50 ${ROLE_COLORS[m.role] ?? ROLE_COLORS['viewer']}`}
                        >
                          <option value="admin">Admin</option>
                          <option value="editor">Editor</option>
                          <option value="analyst">Analyst</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      </td>
                      <td className="py-2.5 pr-4 text-text-muted whitespace-nowrap">{fmtJoined(m.joined_at)}</td>
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() => removeMember(m.user_id)}
                          disabled={removingId === m.user_id}
                          className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 transition-all disabled:opacity-50"
                          title="Remove member"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
