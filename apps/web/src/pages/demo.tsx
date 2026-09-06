import Link from 'next/link'
import PublicLayout from '../components/layout/PublicLayout'
import VenturaLogo from '../components/VenturaLogo'
import {
  ArrowLeftIcon, ArrowRightIcon,
  ExclamationTriangleIcon, CheckCircleIcon,
  ClockIcon, ChevronRightIcon,
  Squares2X2Icon, ArrowsRightLeftIcon, BoltIcon,
  ScaleIcon, DocumentTextIcon, Cog6ToothIcon,
  BuildingOfficeIcon, AdjustmentsHorizontalIcon,
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
  { type: 'duplicate',    exposure: 42800, savings: 42800 },
  { type: 'outlier',      exposure: 38500, savings: 0     },
  { type: 'budget',       exposure: 18500, savings: 0     },
  { type: 'round number', exposure: 25000, savings: 0     },
  { type: 'high freq.',   exposure: 12200, savings: 12200 },
]

const ANOMALIES = [
  { id: 'ANO-001', sev: 'CRITICAL', type: 'outlier',      title: 'Statistical outlier: vendor payment 4× baseline',      vendor: 'Meridian Consulting', category: 'Professional Services', amount: 42800, confidence: 97 },
  { id: 'ANO-002', sev: 'HIGH',     type: 'duplicate',    title: 'Duplicate invoice: same vendor, same amount',           vendor: 'Apex Software Ltd',   category: 'Software',             amount: 7200,  confidence: 94 },
  { id: 'ANO-003', sev: 'HIGH',     type: 'budget',       title: 'Budget overrun: Engineering Q2 +37%',                  vendor: 'Various',             category: 'Engineering',          amount: 18500, confidence: 91 },
  { id: 'ANO-004', sev: 'MEDIUM',   type: 'round number', title: 'Round number transaction above $10,000',                vendor: 'Globex Corp',         category: 'Operations',           amount: 25000, confidence: 78 },
  { id: 'ANO-005', sev: 'MEDIUM',   type: 'high freq.',   title: 'Unusually high transaction frequency from vendor',      vendor: 'ProCloud Services',   category: 'Cloud & Hosting',      amount: 12200, confidence: 83 },
  { id: 'ANO-006', sev: 'LOW',      type: 'contract',     title: 'Vendor contract nearing expiry, no renewal on file',   vendor: 'Initech Systems',     category: 'Software',             amount: 0,     confidence: 90 },
]

const DUPLICATES = [
  { vendor: 'Apex Software Ltd', amount: 7200, confidence: 94 },
  { vendor: 'ProCloud Services', amount: 5100, confidence: 88 },
  { vendor: 'Globex Corp',       amount: 2800, confidence: 82 },
]

const CATEGORIES = [
  { category: 'Professional Services', total: 218000 },
  { category: 'Software',              total: 184000 },
  { category: 'Cloud & Hosting',       total: 156000 },
  { category: 'Engineering',           total: 139000 },
  { category: 'Operations',            total: 97000  },
  { category: 'Marketing',             total: 74000  },
  { category: 'Travel & Expense',      total: 52000  },
]

const VENDORS = [
  { vendor: 'Meridian Consulting', total: 218000, alert: true  },
  { vendor: 'Apex Software Ltd',   total: 184000, alert: true  },
  { vendor: 'AWS',                 total: 156000, alert: false },
  { vendor: 'Globex Corp',         total: 112000, alert: true  },
  { vendor: 'Salesforce',          total: 98000,  alert: false },
  { vendor: 'ProCloud Services',   total: 76000,  alert: true  },
]

const AUDIT_LOG = [
  { event: 'Anomaly ANO-001 flagged: CRITICAL statistical outlier', actor: 'Ventura AI', ts: 'just now', sev: 'critical' },
  { event: 'Duplicate invoice ANO-002 queued for review',            actor: 'Ventura AI', ts: '5m ago',   sev: 'warning'  },
  { event: 'Budget overrun ANO-003 escalated to Finance team',       actor: 'Ventura AI', ts: '1h ago',   sev: 'warning'  },
  { event: 'Data sync completed: 1,284 transactions processed',     actor: 'System',     ts: '2h ago',   sev: 'info'     },
]

// ── Sidebar nav ──────────────────────────────────────────────────────────────

const NAV_SECTIONS = [
  {
    label: 'Workspace',
    items: [
      { name: 'Dashboard',  Icon: Squares2X2Icon,          active: true,  badge: 0 },
      { name: 'Anomalies',  Icon: ExclamationTriangleIcon, active: false, badge: 6 },
      { name: 'Workflows',  Icon: ArrowsRightLeftIcon,     active: false, badge: 3 },
    ],
  },
  {
    label: 'Data',
    items: [
      { name: 'Integrations', Icon: BoltIcon, active: false, badge: 0 },
    ],
  },
  {
    label: 'Governance',
    items: [
      { name: 'AI Governance', Icon: ScaleIcon,                 active: false, badge: 0 },
      { name: 'Audit Logs',    Icon: DocumentTextIcon,          active: false, badge: 0 },
      { name: 'Data Settings', Icon: AdjustmentsHorizontalIcon, active: false, badge: 0 },
    ],
  },
  {
    label: 'Account',
    items: [
      { name: 'Settings', Icon: Cog6ToothIcon, active: false, badge: 0 },
    ],
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtC(n: number): string {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return '$' + (n / 1_000).toFixed(0) + 'K'
  return n === 0 ? 'None' : '$' + n.toFixed(0)
}

const SEV_LEFT: Record<string, string> = {
  CRITICAL: 'border-l-red-600',
  HIGH:     'border-l-orange-500',
  MEDIUM:   'border-l-amber-400',
  LOW:      'border-l-border-strong',
}
const SEV_AMT: Record<string, string> = {
  CRITICAL: 'text-red-400',
  HIGH:     'text-orange-400',
  MEDIUM:   'text-amber-400',
  LOW:      'text-text-muted',
}
const SEV_BADGE: Record<string, string> = {
  CRITICAL: 'bg-red-500/10 text-red-400 border-red-500/30',
  HIGH:     'bg-orange-500/10 text-orange-400 border-orange-500/30',
  MEDIUM:   'bg-amber-500/10 text-amber-400 border-amber-500/30',
  LOW:      'bg-surface-overlay text-text-muted border-border',
}
const TYPE_COLORS: Record<string, string> = {
  duplicate:      '#ef4444',
  outlier:        '#f97316',
  budget:         '#eab308',
  'round number': '#8b5cf6',
  'high freq.':   '#ec4899',
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DemoPage() {
  const totalSpend     = MONTHLY.reduce((s, m) => s + m.spend, 0)
  const totalExposure  = ANOMALIES.reduce((s, a) => s + a.amount, 0)
  const totalSavings   = DUPLICATES.reduce((s, d) => s + d.amount, 0)
  const maxCat         = CATEGORIES[0].total
  const topVendorShare = Math.round((VENDORS[0].total / totalSpend) * 100)

  return (
    <PublicLayout title="Product Demo">

      {/* ── Page header ── */}
      <div className="border-b border-border bg-surface-raised px-6 sm:px-8 lg:px-12 xl:px-16 2xl:px-20 pt-8 pb-6">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors mb-5">
          <ArrowLeftIcon className="w-4 h-4" /> Back to home
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">Product demo</p>
            <h1 className="text-[1.9rem] font-bold text-text-primary leading-tight">Your finance ops platform, live</h1>
            <p className="text-sm text-text-muted mt-1.5 max-w-xl">
              A full preview of Ventura with illustrative data: the exact interface your finance team would use.
              Connect your accounting stack to see real findings within hours.
            </p>
          </div>
          <Link href="/contact" className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-600 text-white font-semibold px-5 py-2.5 text-sm transition-colors whitespace-nowrap">
            Get started with your data <ArrowRightIcon className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* ── Demo notice strip ── */}
      <div className="bg-amber-500/10 border-b border-amber-500/30 px-6 sm:px-8 lg:px-12 xl:px-16 2xl:px-20 py-2.5 flex items-center gap-3">
        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full flex-shrink-0" />
        <p className="text-xs text-amber-400">
          <span className="font-semibold">Demo mode:</span> all figures are illustrative examples only.{' '}
          <Link href="/contact" className="underline underline-offset-2 font-medium hover:text-amber-300 transition-colors">
            Talk to our team
          </Link>{' '}
          to connect your real financial data.
        </p>
      </div>

      {/* ── App window ── */}
      <div className="px-6 sm:px-8 lg:px-12 xl:px-16 2xl:px-20 py-8 bg-surface-sunken">
        <div className="border border-border-strong shadow-2xl overflow-hidden h-[720px] flex flex-col">

          {/* Browser chrome */}
          <div className="h-9 bg-surface-overlay border-b border-border-strong flex items-center px-4 gap-3 flex-shrink-0">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 bg-red-400 rounded-full" />
              <div className="w-2.5 h-2.5 bg-amber-400 rounded-full" />
              <div className="w-2.5 h-2.5 bg-green-400 rounded-full" />
            </div>
            <div className="flex-1 mx-3">
              <div className="bg-surface-raised border border-border-strong rounded text-[11px] text-text-muted px-3 py-1 max-w-xs flex items-center gap-1.5 font-mono">
                <span className="text-emerald-400 text-xs">🔒</span>
                app.ventura.ai/dashboard
              </div>
            </div>
          </div>

          {/* App layout */}
          <div className="flex flex-1 overflow-hidden">

            {/* ── Sidebar ── */}
            <div className="w-56 bg-[#0c1526] flex flex-col flex-shrink-0">

              {/* Brand */}
              <div className="h-14 flex items-center px-4 border-b border-[#1e2d47] flex-shrink-0">
                <div>
                  <VenturaLogo variant="light" height={22} />
                  <span className="block text-[10px] text-[#4d6a8a] mt-0.5">Financial Operations</span>
                </div>
              </div>

              {/* Workspace chip */}
              <div className="px-3 pt-3 pb-1 flex-shrink-0">
                <div className="flex items-center gap-2 px-2.5 py-2 border border-[#1e2d47]">
                  <BuildingOfficeIcon className="w-3.5 h-3.5 text-[#4d6a8a] flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[#8ea4c0] truncate">Acme Corporation</p>
                    <p className="text-[10px] text-[#4d6a8a]">Enterprise</p>
                  </div>
                </div>
              </div>

              {/* Nav */}
              <nav className="flex-1 px-3 pt-3 pb-4 space-y-4 overflow-y-auto">
                {NAV_SECTIONS.map(section => (
                  <div key={section.label}>
                    <p className="px-2.5 mb-1 text-[10px] font-semibold tracking-widest text-[#4d6a8a] uppercase">
                      {section.label}
                    </p>
                    <ul className="space-y-px">
                      {section.items.map(({ name, Icon, active, badge }) => (
                        <li key={name}>
                          <span className={`flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium cursor-default ${
                            active
                              ? 'bg-[#1a2d44] text-white border-l-2 border-[#8ea4c0] pl-[9px]'
                              : 'text-[#8ea4c0]'
                          }`}>
                            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="flex-1 truncate">{name}</span>
                            {badge > 0 && (
                              <span className="min-w-[18px] h-4 px-1 text-[10px] font-semibold text-[#8ea4c0] bg-[#1e2d47] border border-[#2a3d5a] inline-flex items-center justify-center">
                                {badge}
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </nav>

              {/* User */}
              <div className="border-t border-[#1e2d47] px-3 py-3 flex-shrink-0">
                <div className="flex items-center gap-2 px-2.5 py-1.5">
                  <div className="w-6 h-6 bg-[#1a2d44] border border-[#2a3d5a] flex items-center justify-center flex-shrink-0">
                    <span className="text-[#8ea4c0] text-[9px] font-semibold">AC</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[#8ea4c0] truncate">demo@acme.com</p>
                    <p className="text-[10px] text-[#4d6a8a]">Admin</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Dashboard content ── */}
            <div className="flex-1 bg-surface overflow-y-auto">

              {/* Data strip */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-5 py-2.5 text-[11px] text-text-muted border-b border-border bg-surface-raised flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                  <span className="font-semibold text-text-secondary">Illustrative data</span>
                </div>
                <span className="flex items-center gap-1.5">
                  <ClockIcon className="w-3 h-3" />Last scanned just now
                </span>
                <span className="bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-wide text-[10px]">
                  Demo mode
                </span>
              </div>

              <div className="px-5 py-4">

                {/* Priority alert banner */}
                <div className="bg-surface-raised border border-border border-l-4 border-l-red-600 overflow-hidden mb-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                  <div className="flex items-stretch divide-x divide-border">
                    <div className="flex-1 p-4 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-bold tracking-widest uppercase text-red-400">Critical: Immediate Action Required</span>
                        <span className="text-[10px] text-text-muted">·</span>
                        <span className="text-[10px] text-text-muted">{ANOMALIES.length} open alerts · 5 high-confidence</span>
                      </div>
                      <p className="text-text-primary font-semibold text-sm leading-snug">{ANOMALIES[0].title}</p>
                      <p className="text-text-muted text-xs mt-0.5">{ANOMALIES[0].vendor} · {ANOMALIES[0].category}</p>
                      <p className="text-text-secondary text-xs mt-1.5 leading-relaxed line-clamp-2">
                        Payment to Meridian Consulting is 4× the vendor&apos;s 90-day baseline. Ventura has flagged this as a statistical outlier requiring immediate review.
                      </p>
                    </div>
                    <div className="px-4 py-4 flex flex-col items-center justify-center gap-1 flex-shrink-0">
                      <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">At Risk</p>
                      <p className="text-xl font-bold text-red-400">{fmtC(ANOMALIES[0].amount)}</p>
                      <div className="flex items-center gap-1.5">
                        <div className="w-14 h-1 bg-surface-overlay overflow-hidden">
                          <div className="h-full bg-text-muted" style={{ width: `${ANOMALIES[0].confidence}%` }} />
                        </div>
                        <span className="text-[10px] font-semibold text-text-secondary">{ANOMALIES[0].confidence}%</span>
                      </div>
                    </div>
                    <div className="px-4 py-4 flex flex-col items-center justify-center gap-2.5 flex-shrink-0">
                      <span
                        title="Available in your connected workspace"
                        className="flex items-center gap-1.5 bg-accent-500 text-white text-xs font-semibold px-4 py-2 opacity-60 cursor-not-allowed whitespace-nowrap"
                      >
                        Investigate <ArrowRightIcon className="w-3 h-3" />
                      </span>
                      <span className="text-[10px] text-text-muted">View all {ANOMALIES.length} alerts</span>
                    </div>
                  </div>
                  <div className="border-t border-border px-4 py-2 flex items-center gap-5 overflow-x-auto bg-surface-raised">
                    {ANOMALIES.slice(1, 4).map(a => (
                      <div key={a.id} className="flex items-center gap-2 flex-shrink-0">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${a.sev === 'CRITICAL' ? 'bg-red-500' : a.sev === 'HIGH' ? 'bg-orange-400' : 'bg-amber-400'}`} />
                        <span className="text-[11px] text-text-secondary truncate max-w-[150px]">{a.title}</span>
                        <span className="text-[11px] font-semibold text-text-muted">{fmtC(a.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Page sub-header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-text-primary">Acme Corporation</h2>
                    <p className="text-xs text-text-muted mt-0.5">Jul 2025 – Jun 2026 · 3 files · 1,284 transactions</p>
                  </div>
                </div>

                {/* KPI row */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {[
                    { label: 'Total Spend',        value: fmtC(totalSpend),    sub: 'Jul 2025 – Jun 2026',              color: 'text-text-primary' },
                    { label: 'Risk Exposure',      value: fmtC(totalExposure), sub: `${ANOMALIES.length} open anomalies`, color: 'text-red-400'   },
                    { label: 'Savings Identified', value: fmtC(totalSavings),  sub: `${DUPLICATES.length} duplicate payments`, color: 'text-text-primary' },
                    { label: 'Transactions',       value: '1,284',             sub: '22 unique vendors',                color: 'text-text-primary' },
                  ].map(k => (
                    <div key={k.label} className="bg-surface-raised border border-border px-4 py-3 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                      <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5">{k.label}</p>
                      <p className={`text-2xl font-bold leading-none ${k.color}`}>{k.value}</p>
                      <p className="text-xs text-text-muted mt-1">{k.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Risk & Savings chart */}
                <div className="bg-surface-raised border border-border shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden mb-4">
                  <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">Risk & Savings Overview</p>
                      <p className="text-xs text-text-muted">Anomaly exposure vs recoverable savings by type</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-text-muted">
                      <span className="flex items-center gap-1.5 font-medium"><span className="w-2 h-2 bg-red-400 inline-block" /> Risk</span>
                      <span className="flex items-center gap-1.5 font-medium"><span className="w-2 h-2 bg-text-muted inline-block" /> Savings</span>
                    </div>
                  </div>
                  <div className="px-2 py-3 h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={RISK_BY_TYPE} margin={{ top: 4, right: 8, left: 0, bottom: 4 }} barGap={3}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="type" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => fmtC(v)} width={48} />
                        <Tooltip contentStyle={{ fontSize: 11, border: '1px solid #e2e8f0' }} formatter={(v: number, name: string) => [`$${(v/1000).toFixed(0)}K`, name === 'exposure' ? 'Risk' : 'Savings']} />
                        <Bar dataKey="exposure" name="exposure" maxBarSize={36}>
                          {RISK_BY_TYPE.map(entry => (
                            <Cell key={entry.type} fill={TYPE_COLORS[entry.type] ?? '#94a3b8'} />
                          ))}
                        </Bar>
                        <Bar dataKey="savings" name="savings" fill="#475569" maxBarSize={36} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Main grid */}
                <div className="grid grid-cols-5 gap-4 mb-4">

                  {/* Left 3/5 */}
                  <div className="col-span-3 space-y-4">

                    {/* Spend trend */}
                    <div className="bg-surface-raised border border-border shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
                      <div className="px-4 py-3 flex items-center justify-between border-b border-border-subtle">
                        <div>
                          <p className="text-sm font-semibold text-text-primary">Spend Trend</p>
                          <p className="text-xs text-text-muted">12 months</p>
                        </div>
                        <span className="text-xs font-bold text-text-secondary">{fmtC(totalSpend)} total</span>
                      </div>
                      <div className="px-2 py-3 h-36">
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
                            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => fmtC(v)} width={48} />
                            <Tooltip contentStyle={{ fontSize: 11, border: '1px solid #e2e8f0' }} formatter={(v: number) => [`$${(v/1000).toFixed(0)}K`, 'Spend']} />
                            <Area type="monotone" dataKey="spend" stroke="#475569" strokeWidth={1.5} fill="url(#demoSpendGrad)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Open anomalies */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-sm font-semibold text-text-primary">Open Anomalies</p>
                          <p className="text-xs text-text-muted mt-0.5">{ANOMALIES.length} require review · 5 high-confidence</p>
                        </div>
                        <span className="text-xs text-text-muted flex items-center gap-0.5 font-medium">
                          All anomalies <ChevronRightIcon className="w-3 h-3" />
                        </span>
                      </div>
                      <div className="bg-surface-raised border border-border divide-y divide-border-subtle shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
                        {ANOMALIES.map(a => (
                          <div key={a.id} className={`flex items-center gap-3 border-l-4 ${SEV_LEFT[a.sev] ?? 'border-l-border-strong'} px-4 py-2.5`}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 border ${SEV_BADGE[a.sev]}`}>{a.sev}</span>
                                <span className="text-[10px] text-text-muted font-medium uppercase tracking-wide">{a.type}</span>
                              </div>
                              <p className="text-xs font-medium text-text-primary truncate">{a.title}</p>
                              <p className="text-[11px] text-text-muted truncate">{a.vendor} · {a.category}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                              <p className={`text-xs font-bold ${SEV_AMT[a.sev]}`}>{fmtC(a.amount)}</p>
                              <div className="flex items-center gap-1">
                                <div className="w-8 h-1 bg-surface-overlay overflow-hidden">
                                  <div className="h-full bg-text-muted" style={{ width: `${a.confidence}%` }} />
                                </div>
                                <span className="text-[10px] text-text-muted">{a.confidence}%</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right 2/5 */}
                  <div className="col-span-2 space-y-4">

                    {/* Savings */}
                    <div className="bg-surface-raised border border-border shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
                      <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-text-primary">Savings Opportunities</p>
                          <p className="text-xs text-text-muted">Duplicate & recoverable</p>
                        </div>
                        <p className="text-sm font-bold text-text-primary">{fmtC(totalSavings)}</p>
                      </div>
                      <div className="p-4 space-y-2.5">
                        {DUPLICATES.map(d => (
                          <div key={d.vendor} className="flex items-center justify-between">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-text-secondary truncate">{d.vendor}</p>
                              <p className="text-[10px] text-text-muted">{d.confidence}% confidence</p>
                            </div>
                            <span className="text-xs font-bold text-text-primary flex-shrink-0 ml-3">{fmtC(d.amount)}</span>
                          </div>
                        ))}
                        <div className="pt-2.5 border-t border-border-subtle flex items-center justify-between">
                          <span className="text-[11px] font-bold text-text-muted uppercase tracking-wide">Total recoverable</span>
                          <span className="text-xs font-bold text-text-primary">{fmtC(totalSavings)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Category breakdown */}
                    <div className="bg-surface-raised border border-border shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
                      <div className="px-4 py-3 border-b border-border-subtle">
                        <p className="text-sm font-semibold text-text-primary">Spend by Category</p>
                        <p className="text-xs text-text-muted">Top {CATEGORIES.length}</p>
                      </div>
                      <div className="p-4 space-y-2">
                        {CATEGORIES.map(cat => {
                          const pct     = Math.round((cat.total / maxCat) * 100)
                          const hasAlert = ANOMALIES.some(a => a.category === cat.category)
                          return (
                            <div key={cat.category}>
                              <div className="flex items-center justify-between mb-0.5">
                                <div className="flex items-center gap-1 min-w-0">
                                  <span className="text-xs text-text-secondary font-medium truncate max-w-[110px]">{cat.category}</span>
                                  {hasAlert && <ExclamationTriangleIcon className="w-2.5 h-2.5 text-amber-500 flex-shrink-0" />}
                                </div>
                                <span className="text-xs font-semibold text-text-secondary ml-2">{fmtC(cat.total)}</span>
                              </div>
                              <div className="h-1.5 bg-surface-overlay overflow-hidden">
                                <div className={`h-full ${hasAlert ? 'bg-amber-400' : 'bg-text-muted'}`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Vendor concentration */}
                    <div className="bg-surface-raised border border-border shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
                      <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-text-primary">Vendor Concentration</p>
                          <p className="text-xs text-text-muted">Top vendors by spend</p>
                        </div>
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5">
                          {topVendorShare}% top vendor
                        </span>
                      </div>
                      <div className="p-4 space-y-2">
                        {VENDORS.map(v => {
                          const pct   = Math.round((v.total / VENDORS[0].total) * 100)
                          const share = Math.round((v.total / totalSpend) * 100)
                          return (
                            <div key={v.vendor}>
                              <div className="flex items-center justify-between mb-0.5">
                                <div className="flex items-center gap-1 min-w-0">
                                  <span className="text-xs text-text-secondary font-medium truncate max-w-[110px]">{v.vendor}</span>
                                  {v.alert && <ExclamationTriangleIcon className="w-2.5 h-2.5 text-amber-500 flex-shrink-0" />}
                                </div>
                                <div className="flex items-center gap-1.5 ml-2">
                                  <span className="text-[10px] text-text-muted">{share}%</span>
                                  <span className="text-xs font-semibold text-text-secondary">{fmtC(v.total)}</span>
                                </div>
                              </div>
                              <div className="h-1.5 bg-surface-overlay overflow-hidden">
                                <div className={`h-full ${v.alert ? 'bg-amber-400' : 'bg-text-muted'}`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Processing log */}
                <div className="bg-surface-raised border border-border shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between border-b border-border-subtle">
                    <p className="text-sm font-semibold text-text-primary">Processing Log</p>
                    <span className="text-xs text-text-muted flex items-center gap-0.5">
                      Full audit log <ChevronRightIcon className="w-3 h-3" />
                    </span>
                  </div>
                  <div className="divide-y divide-border-subtle">
                    {AUDIT_LOG.map((item, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.sev === 'critical' ? 'bg-red-500' : item.sev === 'warning' ? 'bg-amber-500' : 'bg-text-muted'}`} />
                        <p className="text-xs font-medium text-text-secondary flex-1 truncate">{item.event}</p>
                        <p className="text-xs text-text-muted flex-shrink-0 hidden sm:block">{item.actor}</p>
                        <p className="text-[10px] text-text-muted flex-shrink-0">{item.ts}</p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── CTA ── */}
      <div className="bg-[#0c1526] px-6 sm:px-8 lg:px-12 xl:px-16 2xl:px-20 py-14">
        <div className="grid md:grid-cols-[1fr_auto] gap-10 items-center">
          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-4">Ready to go live?</p>
            <h2 className="text-2xl font-bold text-white mb-3">Connect your financial stack and see real findings</h2>
            <p className="text-sm text-text-muted leading-relaxed max-w-lg">
              Most finance teams identify their first findings within hours of their first sync.
              Talk to our team and we&apos;ll get you set up with your real data.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {/* Intentional inverted fill: light button reads as the strong CTA against this dark banner */}
            <Link href="/contact" className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-100 text-slate-900 font-semibold px-7 py-3 text-base transition-colors">
              Talk to our team
            </Link>
            <Link href="/" className="inline-flex items-center justify-center gap-1.5 text-text-muted hover:text-text-secondary text-sm font-medium transition-colors">
              <ArrowLeftIcon className="w-4 h-4" /> Back to home
            </Link>
          </div>
        </div>
      </div>

    </PublicLayout>
  )
}
