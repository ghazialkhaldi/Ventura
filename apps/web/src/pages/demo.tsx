import Link from 'next/link'
import PublicLayout from '../components/layout/PublicLayout'
import {
  ArrowLeftIcon, ArrowRightIcon,
  ExclamationTriangleIcon, CheckCircleIcon,
  ClockIcon, ChevronRightIcon,
} from '@heroicons/react/24/outline'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

// ── Illustrative data ────────────────────────────────────────────────────────

const MONTHLY = [
  { month: 'Jul', spend: 82000  },
  { month: 'Aug', spend: 94000  },
  { month: 'Sep', spend: 87000  },
  { month: 'Oct', spend: 104000 },
  { month: 'Nov', spend: 118000 },
  { month: 'Dec', spend: 96000  },
  { month: 'Jan', spend: 110000 },
  { month: 'Feb', spend: 128000 },
  { month: 'Mar', spend: 99000  },
  { month: 'Apr', spend: 114000 },
  { month: 'May', spend: 139000 },
  { month: 'Jun', spend: 108000 },
]

const RISK_BY_TYPE = [
  { type: 'duplicate',     exposure: 42800, savings: 42800 },
  { type: 'outlier',       exposure: 38500, savings: 0     },
  { type: 'budget',        exposure: 18500, savings: 0     },
  { type: 'round number',  exposure: 25000, savings: 0     },
  { type: 'high freq.',    exposure: 12200, savings: 12200 },
]

const ANOMALIES = [
  { id: 'ANO-001', sev: 'CRITICAL', type: 'outlier',     title: 'Statistical outlier — vendor payment 4× baseline',  vendor: 'Meridian Consulting',   category: 'Professional Services', amount: 42800, confidence: 97 },
  { id: 'ANO-002', sev: 'HIGH',     type: 'duplicate',   title: 'Duplicate invoice — same vendor, same amount',       vendor: 'Apex Software Ltd',     category: 'Software',             amount: 7200,  confidence: 94 },
  { id: 'ANO-003', sev: 'HIGH',     type: 'budget',      title: 'Budget overrun — Engineering Q2 +37%',              vendor: 'Various',               category: 'Engineering',          amount: 18500, confidence: 91 },
  { id: 'ANO-004', sev: 'MEDIUM',   type: 'round_number',title: 'Round-number transaction above $10,000',            vendor: 'Globex Corp',           category: 'Operations',           amount: 25000, confidence: 78 },
  { id: 'ANO-005', sev: 'MEDIUM',   type: 'high_freq',   title: 'Unusually high transaction frequency from vendor',  vendor: 'ProCloud Services',     category: 'Cloud & Hosting',      amount: 12200, confidence: 83 },
  { id: 'ANO-006', sev: 'LOW',      type: 'contract',    title: 'Vendor contract nearing expiry — no renewal on file', vendor: 'Initech Systems',     category: 'Software',             amount: 0,     confidence: 90 },
]

const DUPLICATES = [
  { vendor: 'Apex Software Ltd',  amount: 7200,  confidence: 94 },
  { vendor: 'ProCloud Services',  amount: 5100,  confidence: 88 },
  { vendor: 'Globex Corp',        amount: 2800,  confidence: 82 },
]

const CATEGORIES = [
  { category: 'Professional Services', total: 218000 },
  { category: 'Software',              total: 184000 },
  { category: 'Cloud & Hosting',       total: 156000 },
  { category: 'Engineering',           total: 139000 },
  { category: 'Operations',            total: 97000  },
  { category: 'Marketing',             total: 74000  },
  { category: 'Travel & Expense',      total: 52000  },
  { category: 'Uncategorized',         total: 38000  },
]

const VENDORS = [
  { vendor: 'Meridian Consulting', total: 218000, alert: true  },
  { vendor: 'Apex Software Ltd',   total: 184000, alert: true  },
  { vendor: 'AWS',                 total: 156000, alert: false },
  { vendor: 'Globex Corp',         total: 112000, alert: true  },
  { vendor: 'Salesforce',          total: 98000,  alert: false },
  { vendor: 'ProCloud Services',   total: 76000,  alert: true  },
  { vendor: 'Atlassian',           total: 54000,  alert: false },
  { vendor: 'Workday',             total: 42000,  alert: false },
]

const AUDIT = [
  { event: 'Anomaly ANO-001 flagged — CRITICAL outlier', actor: 'Ventura AI', ts: 'just now',  sev: 'critical' },
  { event: 'Duplicate invoice ANO-002 queued for review', actor: 'Ventura AI', ts: '5m ago',   sev: 'warning'  },
  { event: 'Budget overrun ANO-003 escalated to Finance', actor: 'Ventura AI', ts: '1h ago',   sev: 'warning'  },
  { event: 'Data sync completed — 1,284 transactions',    actor: 'System',   ts: '2h ago',   sev: 'info'     },
]

// ── Constants ────────────────────────────────────────────────────────────────

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
  LOW:      'text-slate-500',
}

const SEV_BADGE: Record<string, string> = {
  CRITICAL: 'bg-red-50 text-red-700 border-red-200',
  HIGH:     'bg-orange-50 text-orange-700 border-orange-200',
  MEDIUM:   'bg-amber-50 text-amber-700 border-amber-200',
  LOW:      'bg-slate-100 text-slate-500 border-slate-200',
}

const TYPE_COLORS: Record<string, string> = {
  duplicate:    '#ef4444',
  outlier:      '#f97316',
  budget:       '#eab308',
  'round number': '#8b5cf6',
  'high freq.': '#ec4899',
}

function fmtC(n: number): string {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return '$' + (n / 1_000).toFixed(0) + 'K'
  return n === 0 ? '—' : '$' + n.toFixed(0)
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DemoPage() {
  const totalSpend       = MONTHLY.reduce((s, m) => s + m.spend, 0)
  const totalExposure    = ANOMALIES.reduce((s, a) => s + a.amount, 0)
  const totalSavings     = DUPLICATES.reduce((s, d) => s + d.amount, 0)
  const totalTxs         = 1284
  const maxCat           = CATEGORIES[0].total
  const topVendorShare   = Math.round((VENDORS[0].total / totalSpend) * 100)

  return (
    <PublicLayout title="Product Demo">
      <div className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-white to-slate-50">

        {/* ── Page header ── */}
        <div className="border-b border-slate-200 bg-white px-6 sm:px-8 lg:px-12 xl:px-16 2xl:px-20 pt-8 pb-6">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-5">
            <ArrowLeftIcon className="w-4 h-4" />Back to home
          </Link>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Interactive demo</p>
              <h1 className="text-[1.9rem] font-bold text-slate-900 leading-tight">Illustrative financial dashboard</h1>
              <p className="text-sm text-slate-500 mt-1.5 max-w-xl">
                This is what Ventura looks like with your data connected. All figures below are illustrative examples.
              </p>
            </div>
            <Link href="/contact" className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold px-5 py-2.5 text-sm transition-colors whitespace-nowrap">
              Talk to our team <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <div className="px-6 sm:px-8 lg:px-12 xl:px-16 2xl:px-20 py-6">

          {/* ── Data trust strip ── */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mb-5 text-[11px] text-slate-500 border-b border-slate-100 pb-3.5">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
              <span className="font-semibold text-slate-700">Illustrative data</span>
            </div>
            <span className="flex items-center gap-1.5">
              <ClockIcon className="w-3 h-3" />Last scanned just now
            </span>
            <span className="bg-amber-50 border border-amber-200 text-amber-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wide text-[10px]">
              Demo mode
            </span>
          </div>

          {/* ── Priority alert banner ── */}
          <div className="bg-white border border-slate-200 border-l-4 border-l-red-600 shadow-[0_1px_4px_rgba(0,0,0,0.06)] mb-6 overflow-hidden">
            <div className="flex items-stretch divide-x divide-slate-200">
              <div className="flex-1 p-5 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold tracking-widest uppercase text-red-700">Critical — Immediate Action Required</span>
                  <span className="text-[10px] text-slate-400">·</span>
                  <span className="text-[10px] text-slate-500">{ANOMALIES.length} open alerts · 5 high-confidence</span>
                </div>
                <p className="text-slate-900 font-semibold text-base leading-snug">{ANOMALIES[0].title}</p>
                <p className="text-slate-500 text-xs mt-1">{ANOMALIES[0].vendor} · {ANOMALIES[0].category}</p>
                <p className="text-slate-600 text-xs mt-2 leading-relaxed">
                  Payment to Meridian Consulting is 4× the vendor's 90-day baseline. Ventura has flagged this as a statistical outlier requiring immediate review before the next AP run.
                </p>
              </div>
              <div className="px-5 py-5 flex flex-col items-center justify-center gap-1.5 flex-shrink-0">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">At Risk</p>
                <p className="text-2xl font-bold text-red-700">{fmtC(ANOMALIES[0].amount)}</p>
                <div className="flex items-center gap-1.5">
                  <div className="w-16 h-1 bg-slate-200 overflow-hidden">
                    <div className="h-full bg-slate-500" style={{ width: `${ANOMALIES[0].confidence}%` }} />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-600">{ANOMALIES[0].confidence}% conf.</span>
                </div>
              </div>
              <div className="px-5 py-5 flex flex-col items-center justify-center gap-3 flex-shrink-0">
                <span
                  title="Available in your connected workspace — talk to our team to get started"
                  className="flex items-center gap-2 bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 opacity-60 cursor-not-allowed whitespace-nowrap"
                >
                  Investigate <ArrowRightIcon className="w-3.5 h-3.5" />
                </span>
                <Link
                  href="/contact"
                  title="Available in your connected workspace — talk to our team to get started"
                  className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
                >
                  View all {ANOMALIES.length} alerts
                </Link>
              </div>
            </div>
            <div className="border-t border-slate-200 px-5 py-2.5 flex items-center gap-5 overflow-x-auto bg-slate-50">
              {ANOMALIES.slice(1, 5).map(a => (
                <div key={a.id} className="flex items-center gap-2 flex-shrink-0">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${a.sev === 'CRITICAL' ? 'bg-red-500' : a.sev === 'HIGH' ? 'bg-orange-400' : 'bg-amber-400'}`} />
                  <span className="text-[11px] text-slate-600 truncate max-w-[160px]">{a.title}</span>
                  <span className="text-[11px] font-semibold text-slate-500">{fmtC(a.amount)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Page sub-header ── */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Acme Corporation (Demo)</h2>
              <p className="text-xs text-slate-500 mt-0.5">Jul 2025 – Jun 2026 · 3 files · {totalTxs.toLocaleString()} transactions</p>
            </div>
          </div>

          {/* ── KPI row ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total Spend',        value: fmtC(totalSpend),    sub: 'Jul 2025 – Jun 2026',                           color: 'text-slate-900' },
              { label: 'Risk Exposure',      value: fmtC(totalExposure), sub: `${ANOMALIES.length} open anomalies`,            color: 'text-red-700'   },
              { label: 'Savings Identified', value: fmtC(totalSavings),  sub: `${DUPLICATES.length} duplicate payments`,       color: 'text-slate-900' },
              { label: 'Transactions',       value: totalTxs.toLocaleString(), sub: `${VENDORS.length + 14} unique vendors`,   color: 'text-slate-900' },
            ].map(k => (
              <div key={k.label} className="bg-white border border-slate-200 px-5 py-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{k.label}</p>
                <p className={`text-3xl font-bold leading-none ${k.color}`}>{k.value}</p>
                <p className="text-xs text-slate-500 mt-1.5">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* ── Risk & Savings chart ── */}
          <div className="bg-white border border-slate-200 shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden mb-6">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Risk & Savings Overview</p>
                <p className="text-xs text-slate-500">Anomaly exposure vs recoverable savings by type</p>
              </div>
              <div className="flex items-center gap-5 text-xs text-slate-500">
                <span className="flex items-center gap-1.5 font-medium"><span className="w-2.5 h-2.5 bg-red-400 inline-block" /> Risk Exposure</span>
                <span className="flex items-center gap-1.5 font-medium"><span className="w-2.5 h-2.5 bg-slate-500 inline-block" /> Savings Identified</span>
              </div>
            </div>
            <div className="px-2 py-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={RISK_BY_TYPE} margin={{ top: 4, right: 8, left: 0, bottom: 4 }} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="type" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => fmtC(v)} width={52} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, border: '1px solid #e2e8f0' }}
                    formatter={(v: number, name: string) => [`$${(v/1000).toFixed(0)}K`, name === 'exposure' ? 'Risk Exposure' : 'Savings Identified']}
                  />
                  <Bar dataKey="exposure" name="exposure" maxBarSize={40}>
                    {RISK_BY_TYPE.map(entry => (
                      <Cell key={entry.type} fill={TYPE_COLORS[entry.type] ?? '#94a3b8'} />
                    ))}
                  </Bar>
                  <Bar dataKey="savings" name="savings" fill="#475569" maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Main grid ── */}
          <div className="grid lg:grid-cols-5 gap-5 mb-5">

            {/* Left 3/5 */}
            <div className="lg:col-span-3 space-y-5">

              {/* Spend trend */}
              <div className="bg-white border border-slate-200 shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
                <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-100">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Spend Trend</p>
                    <p className="text-xs text-slate-500">12 months</p>
                  </div>
                  <span className="text-xs font-bold text-slate-700">{fmtC(totalSpend)} total</span>
                </div>
                <div className="px-2 py-3 h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={MONTHLY} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="demoSpendGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#475569" stopOpacity={0.08} />
                          <stop offset="95%" stopColor="#475569" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => fmtC(v)} width={52} />
                      <Tooltip
                        contentStyle={{ fontSize: 12, border: '1px solid #e2e8f0' }}
                        formatter={(v: number) => [`$${(v/1000).toFixed(0)}K`, 'Spend']}
                      />
                      <Area type="monotone" dataKey="spend" stroke="#475569" strokeWidth={1.5} fill="url(#demoSpendGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Open anomaly list */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Open Anomalies</p>
                    <p className="text-xs text-slate-500 mt-0.5">{ANOMALIES.length} require review · 5 high-confidence</p>
                  </div>
                  <span className="text-xs text-slate-400 flex items-center gap-0.5 font-medium">
                    All anomalies <ChevronRightIcon className="w-3 h-3" />
                  </span>
                </div>

                <div className="bg-white border border-slate-200 divide-y divide-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
                  {ANOMALIES.map((a, i) => (
                    <div
                      key={a.id}
                      className={`flex items-center gap-3 border-l-4 ${SEV_LEFT[a.sev] ?? 'border-l-slate-300'} px-4 py-3`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 border ${SEV_BADGE[a.sev]}`}>{a.sev}</span>
                          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{a.type.replace(/_/g, ' ')}</span>
                        </div>
                        <p className="text-sm font-medium text-slate-900 truncate">{a.title}</p>
                        <p className="text-xs text-slate-500 truncate">{a.vendor} · {a.category}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <p className={`text-sm font-bold ${SEV_AMT[a.sev]}`}>{fmtC(a.amount)}</p>
                        <div className="flex items-center gap-1.5">
                          <div className="w-10 h-1 bg-slate-100 overflow-hidden">
                            <div className="h-full bg-slate-400" style={{ width: `${a.confidence}%` }} />
                          </div>
                          <span className="text-[10px] text-slate-400">{a.confidence}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right 2/5 */}
            <div className="lg:col-span-2 space-y-5">

              {/* Savings opportunities */}
              <div className="bg-white border border-slate-200 shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Savings Opportunities</p>
                    <p className="text-xs text-slate-500">Duplicate & recoverable spend</p>
                  </div>
                  <p className="text-base font-bold text-slate-900">{fmtC(totalSavings)}</p>
                </div>
                <div className="p-5 space-y-3">
                  {DUPLICATES.map(d => (
                    <div key={d.vendor} className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">{d.vendor}</p>
                        <p className="text-[10px] text-slate-400">{d.confidence}% confidence</p>
                      </div>
                      <span className="text-sm font-bold text-slate-900 flex-shrink-0 ml-4">{fmtC(d.amount)}</span>
                    </div>
                  ))}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Total recoverable</span>
                    <span className="text-sm font-bold text-slate-900">{fmtC(totalSavings)}</span>
                  </div>
                </div>
              </div>

              {/* Category breakdown */}
              <div className="bg-white border border-slate-200 shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-900">Spend by Category</p>
                  <p className="text-xs text-slate-500">Top {CATEGORIES.length} categories</p>
                </div>
                <div className="p-5 space-y-2.5">
                  {CATEGORIES.map(cat => {
                    const pct = Math.round((cat.total / maxCat) * 100)
                    const hasAlert = ANOMALIES.some(a => a.category === cat.category)
                    return (
                      <div key={cat.category}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs text-slate-700 font-medium truncate max-w-[120px]">{cat.category}</span>
                            {hasAlert && <ExclamationTriangleIcon className="w-2.5 h-2.5 text-amber-500 flex-shrink-0" />}
                          </div>
                          <span className="text-xs font-semibold text-slate-700 ml-2">{fmtC(cat.total)}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 overflow-hidden">
                          <div className={`h-full ${hasAlert ? 'bg-amber-400' : 'bg-slate-400'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Vendor concentration */}
              <div className="bg-white border border-slate-200 shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Vendor Concentration</p>
                    <p className="text-xs text-slate-500">Top vendors by spend</p>
                  </div>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5">
                    {topVendorShare}% top vendor
                  </span>
                </div>
                <div className="p-5 space-y-2.5">
                  {VENDORS.map(v => {
                    const pct   = Math.round((v.total / VENDORS[0].total) * 100)
                    const share = Math.round((v.total / totalSpend) * 100)
                    return (
                      <div key={v.vendor}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs text-slate-700 font-medium truncate max-w-[120px]">{v.vendor}</span>
                            {v.alert && <ExclamationTriangleIcon className="w-2.5 h-2.5 text-amber-500 flex-shrink-0" />}
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            <span className="text-[10px] text-slate-400">{share}%</span>
                            <span className="text-xs font-semibold text-slate-700">{fmtC(v.total)}</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-slate-100 overflow-hidden">
                          <div className={`h-full ${v.alert ? 'bg-amber-400' : 'bg-slate-400'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ── Processing log ── */}
          <div className="bg-white border border-slate-200 shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden mb-10">
            <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-900">Processing Log</p>
              <span className="text-xs text-slate-400 flex items-center gap-0.5">
                Full audit log <ChevronRightIcon className="w-3 h-3" />
              </span>
            </div>
            <div className="divide-y divide-slate-100">
              {AUDIT.map((item, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.sev === 'critical' ? 'bg-red-500' : item.sev === 'warning' ? 'bg-amber-500' : 'bg-slate-400'}`} />
                  <p className="text-xs font-medium text-slate-700 flex-1 truncate">{item.event}</p>
                  <p className="text-xs text-slate-400 flex-shrink-0 hidden sm:block">{item.actor}</p>
                  <p className="text-[10px] text-slate-400 flex-shrink-0">{item.ts}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── CTA ── */}
          <div className="bg-[#0c1526] border border-slate-700 px-8 py-10 mb-6">
            <div className="grid md:grid-cols-[1fr_auto] gap-8 items-center">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Ready to see your data?</p>
                <h2 className="text-2xl font-bold text-white mb-3">Connect your financial stack and go live</h2>
                <p className="text-sm text-slate-400 leading-relaxed max-w-lg">
                  Most finance teams see their first real findings within hours of their first sync. Talk to our team and we'll get you set up.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <Link href="/contact" className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-100 text-slate-900 font-semibold px-6 py-3 text-base transition-colors">
                  Talk to our team
                </Link>
                <Link href="/" className="inline-flex items-center justify-center gap-1.5 text-slate-400 hover:text-slate-200 text-sm font-medium transition-colors">
                  <ArrowLeftIcon className="w-4 h-4" />Back to home
                </Link>
              </div>
            </div>
          </div>

        </div>
      </div>
    </PublicLayout>
  )
}
