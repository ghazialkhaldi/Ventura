import React from 'react'
import Link from 'next/link'
import PublicLayout from '../components/layout/PublicLayout'
import BrandIcon, { type BrandKey } from '../components/ui/BrandIcon'
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  LockClosedIcon,
  UsersIcon,
  ChartBarIcon,
  ArrowRightIcon,
  ArrowsRightLeftIcon,
  ScaleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'

// ── Illustrative demo chart data ─────────────────────────────────────────────
const DEMO_DATA = [
  { month: 'Jul', spend: 82,  anomalyExposure: 0,  savingsFound: 0 },
  { month: 'Aug', spend: 94,  anomalyExposure: 22, savingsFound: 22 },
  { month: 'Sep', spend: 87,  anomalyExposure: 0,  savingsFound: 0 },
  { month: 'Oct', spend: 104, anomalyExposure: 9,  savingsFound: 9 },
  { month: 'Nov', spend: 118, anomalyExposure: 58, savingsFound: 45 },
  { month: 'Dec', spend: 96,  anomalyExposure: 12, savingsFound: 12 },
  { month: 'Jan', spend: 110, anomalyExposure: 0,  savingsFound: 0 },
  { month: 'Feb', spend: 128, anomalyExposure: 67, savingsFound: 67 },
  { month: 'Mar', spend: 99,  anomalyExposure: 0,  savingsFound: 0 },
  { month: 'Apr', spend: 114, anomalyExposure: 22, savingsFound: 22 },
  { month: 'May', spend: 139, anomalyExposure: 33, savingsFound: 33 },
  { month: 'Jun', spend: 108, anomalyExposure: 9,  savingsFound: 9  },
]

// ── Integration brands for scrolling stream ───────────────────────────────────
const STREAM_BRANDS: { id: string; name: string; brand: BrandKey }[] = [
  { id: 'quickbooks', name: 'QuickBooks',  brand: 'quickbooks' },
  { id: 'plaid',      name: 'Plaid',       brand: 'plaid'      },
  { id: 'adp',        name: 'ADP',         brand: 'adp'        },
  { id: 'salesforce', name: 'Salesforce',  brand: 'salesforce' },
  { id: 'netsuite',   name: 'NetSuite',    brand: 'netsuite'   },
  { id: 'xero',       name: 'Xero',        brand: 'xero'       },
  { id: 'okta',       name: 'Okta',        brand: 'okta'       },
  { id: 'stripe',     name: 'Stripe',      brand: 'stripe'     },
  { id: 'sap',        name: 'SAP',         brand: 'sap'        },
  { id: 'expensify',  name: 'Expensify',   brand: 'expensify'  },
  { id: 'gusto',      name: 'Gusto',       brand: 'gusto'      },
  { id: 'csv',        name: 'CSV / Excel', brand: 'csv'        },
]

// ── Capabilities ──────────────────────────────────────────────────────────────
const capabilities = [
  {
    id: 'anomaly',
    eyebrow: 'Spend intelligence',
    title: 'Continuous anomaly detection across every financial source',
    body: 'Ventura runs rule-based checks against your accounting systems, bank feeds, payroll, and card data — flagging duplicates, budget overruns, policy violations, and statistical outliers before they close in the ledger.',
    bullets: [
      'Duplicate and near-duplicate payment detection',
      'Vendor spend baseline and spike analysis',
      'Round-number and high-frequency payment flags',
      'Transaction evidence references on every finding',
    ],
    icon: ExclamationTriangleIcon,
    iconBg: 'bg-orange-500/10',
    iconColor: 'text-orange-400',
  },
  {
    id: 'workflow',
    eyebrow: 'Approval controls',
    title: 'Map and enforce every approval workflow with SLA tracking',
    body: 'Model every finance approval process — vendor onboarding, invoice sign-off, contract amendments, expense reimbursements. Surface bottlenecks and SLA breaches in real time so nothing stays stuck in someone\'s inbox.',
    bullets: [
      'Per-workflow SLA targets with overdue detection',
      'Bottleneck identification per anomaly type',
      'Step-by-step owner assignment for each workflow stage',
      'Status tracking across Open, Under Review, and Resolved',
    ],
    icon: ArrowsRightLeftIcon,
    iconBg: 'bg-surface-overlay',
    iconColor: 'text-text-secondary',
  },
  {
    id: 'governance',
    eyebrow: 'Explainable by design',
    title: 'Every finding is explainable, auditable, and human-controlled',
    body: 'Nothing in Ventura is a black box, and nothing acts on its own. Every finding shows the exact rule and evidence that triggered it. Status only ever changes through an explicit, logged action by a person on your team — never automatically.',
    bullets: [
      'Every finding cites the transactions and math behind it',
      'Confidence-threshold prioritization, configurable per workspace',
      'No autonomous actions — every status change is a manual, logged decision',
      'Append-only server-side audit trail for security-relevant events',
    ],
    icon: ScaleIcon,
    iconBg: 'bg-surface-overlay',
    iconColor: 'text-text-secondary',
  },
]

function fmtK(v: number) { return `$${v}K` }

export default function HomePage() {
  return (
    <PublicLayout title="Financial Operations Intelligence">

      {/* ── Hero ── */}
      <section className="bg-gradient-to-b from-surface-raised to-surface border-b border-border pt-10 pb-12">
        <div className="px-6 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
          <div className="grid lg:grid-cols-[1fr_1fr] gap-12 items-start">

            {/* Left: copy */}
            <div className="pt-2">
              <h1 className="text-[3rem] font-bold leading-[1.08] tracking-tight mb-5 bg-gradient-to-br from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                Detect spend anomalies.<br />
                Enforce approval controls.<br />
                Protect your operations.
              </h1>
              <p className="text-lg text-text-secondary leading-relaxed mb-7 max-w-xl">
                Ventura connects to your ERP, bank feeds, payroll, and card data to surface financial risk
                and workflow bottlenecks — with explainable AI decisions and a complete audit trail built
                for enterprise compliance requirements.
              </p>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-2 mb-8">
                {['AI Anomaly Detection', 'Approval Workflows', 'Immutable Audit Log', 'Explainable AI'].map((cert, i) => (
                  <React.Fragment key={cert}>
                    {i > 0 && <span className="text-text-muted select-none" aria-hidden="true">·</span>}
                    <span className="inline-flex items-center gap-1.5 text-sm text-text-secondary bg-surface-raised border border-border px-3 py-1.5 font-medium">
                      <CheckCircleIcon className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      {cert}
                    </span>
                  </React.Fragment>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <Link href="/contact" className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-600 text-white font-semibold px-6 py-3 text-base transition-colors">
                  Get started
                </Link>
                <Link href="/demo" className="inline-flex items-center gap-1.5 text-base font-medium text-text-secondary hover:text-text-primary transition-colors">
                  View a demo <ArrowRightIcon className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Right: demo chart */}
            <div className="lg:pt-2">
              <div className="bg-surface-raised border border-border shadow-[0_4px_24px_-4px_rgba(0,0,0,0.10)] overflow-hidden">
                <div className="px-4 py-3 bg-surface-raised border-b border-border flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-text-secondary">Spend & Anomaly Overview</p>
                    <p className="text-[10px] text-text-muted mt-0.5">Monthly spend · risk exposure · savings identified</p>
                  </div>
                  <span className="text-[10px] text-text-muted border border-border px-2 py-0.5 font-medium">
                    Illustrative example
                  </span>
                </div>
                <div className="px-3 pt-4 pb-3 h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={DEMO_DATA} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#4f88cb" stopOpacity={0.14} />
                          <stop offset="95%" stopColor="#4f88cb" stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="spend" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={fmtK} width={44} />
                      <YAxis yAxisId="risk" orientation="right" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={fmtK} width={44} />
                      <Tooltip
                        contentStyle={{ fontSize: 11, border: '1px solid #e2e8f0' }}
                        formatter={(v: number, name: string) => [
                          `$${v}K`,
                          name === 'spend' ? 'Monthly Spend' : name === 'anomalyExposure' ? 'Risk Exposure' : 'Savings Found',
                        ]}
                      />
                      <Legend
                        iconSize={8}
                        formatter={(v) => (
                          <span style={{ fontSize: 10, color: '#64748b' }}>
                            {v === 'spend' ? 'Monthly Spend' : v === 'anomalyExposure' ? 'Risk Exposure' : 'Savings Found'}
                          </span>
                        )}
                      />
                      <Area yAxisId="spend" type="monotone" dataKey="spend" stroke="#4f88cb" strokeWidth={1.5} fill="url(#spendGrad)" />
                      <Bar yAxisId="risk" dataKey="anomalyExposure" fill="#f87171" maxBarSize={14} opacity={0.8} />
                      <Bar yAxisId="risk" dataKey="savingsFound" fill="#34d399" maxBarSize={14} opacity={0.8} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className="px-4 py-2.5 bg-surface-overlay border-t border-border">
                  <p className="text-[10px] text-text-muted">Connect your data to see real spend trends and detected anomalies</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Integration logo stream ── */}
      <section className="bg-surface border-b border-border py-6">
        <div className="px-6 sm:px-8 lg:px-12 xl:px-16 2xl:px-20 mb-5 flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Native integrations</p>
            <p className="text-base font-semibold text-text-secondary">Connects to your existing financial stack</p>
          </div>
          <p className="text-xs text-text-muted">Also available: REST API · Webhook · SFTP · Custom ETL</p>
        </div>

        <div className="relative overflow-hidden select-none">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-24 z-10 bg-gradient-to-r from-surface to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-24 z-10 bg-gradient-to-l from-surface to-transparent" />
          <div className="animate-marquee flex gap-4 w-max px-4">
            {[...STREAM_BRANDS, ...STREAM_BRANDS].map((b, i) => (
              <div
                key={`${b.id}-${i}`}
                className="flex items-center gap-3 bg-surface-raised border border-border px-5 py-3 shadow-sm flex-shrink-0"
              >
                <BrandIcon brand={b.brand} size={30} />
                <span className="text-sm font-semibold text-text-secondary whitespace-nowrap">{b.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Capabilities ── */}
      {capabilities.map((cap, i) => {
        const Icon = cap.icon
        const isEven = i % 2 === 0
        return (
          <section key={cap.id} id={cap.id} className={`py-14 border-b border-border ${isEven ? 'bg-surface-raised' : 'bg-surface'}`}>
            <div className="px-6 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
              <div className="grid lg:grid-cols-2 gap-14 items-center">
                <div className={!isEven ? 'lg:order-2' : ''}>
                  <div className={`w-11 h-11 ${cap.iconBg} border border-border flex items-center justify-center mb-5`}>
                    <Icon className={`w-6 h-6 ${cap.iconColor}`} />
                  </div>
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">{cap.eyebrow}</p>
                  <h2 className="text-[2rem] font-bold text-text-primary mb-4 leading-snug">{cap.title}</h2>
                  <p className="text-base text-text-secondary leading-relaxed mb-6">{cap.body}</p>
                  <ul className="space-y-3">
                    {cap.bullets.map(b => (
                      <li key={b} className="flex items-start gap-3 text-base text-text-secondary">
                        <CheckCircleIcon className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                        {b}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-7">
                    <Link href="/demo" className="inline-flex items-center gap-1.5 text-base font-semibold text-text-secondary hover:text-text-primary transition-colors">
                      See it in action <ArrowRightIcon className="w-5 h-5" />
                    </Link>
                  </div>
                </div>
                <div className={!isEven ? 'lg:order-1' : ''}>
                  {cap.id === 'anomaly'    && <AnomalyPreviewPanel />}
                  {cap.id === 'workflow'   && <WorkflowPreviewPanel />}
                  {cap.id === 'governance' && <GovernancePreviewPanel />}
                </div>
              </div>
            </div>
          </section>
        )
      })}

      {/* ── Transparency & Audit Trail ── */}
      <section id="security" className="py-14 bg-surface-raised border-b border-border">
        <div className="px-6 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
          <div className="grid md:grid-cols-2 gap-14 items-start">
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-4">Transparency & Audit Trail</p>
              <h2 className="text-[2rem] font-bold text-text-primary mb-4 leading-snug">
                Every AI decision is explainable, logged, and traceable to source transactions
              </h2>
              <p className="text-base text-text-secondary leading-relaxed mb-8">
                Ventura doesn't just flag anomalies — it shows its reasoning. Every finding includes a
                confidence score, a plain-language explanation, and direct references to the underlying
                transactions, so your team can investigate, approve, or dismiss with full context.
              </p>
              <div className="space-y-5">
                {[
                  { icon: ChartBarIcon,    title: 'Complete audit trail',             body: 'Every detection, manual review, status change, and approval is logged with a timestamp and actor — giving you a full history of every decision.' },
                  { icon: ShieldCheckIcon, title: 'Confidence scores on every finding', body: 'Each anomaly includes a model confidence score (0–100%) and the reasoning behind it, so reviewers know exactly how certain the system is.' },
                  { icon: LockClosedIcon,  title: 'Transaction evidence references',  body: 'Every anomaly links directly to the specific transaction IDs involved — no guessing which rows triggered the alert.' },
                  { icon: UsersIcon,       title: 'Data masking and testing modes',   body: 'Run analysis on masked or synthetic data to protect sensitive information during demos, onboarding, or internal testing.' },
                ].map(item => {
                  const IIcon = item.icon
                  return (
                    <div key={item.title} className="flex gap-4 items-start">
                      <div className="w-10 h-10 bg-surface-overlay border border-border flex items-center justify-center flex-shrink-0">
                        <IIcon className="w-5 h-5 text-text-secondary" />
                      </div>
                      <div>
                        <p className="text-base font-semibold text-text-secondary">{item.title}</p>
                        <p className="text-sm text-text-muted mt-1 leading-relaxed">{item.body}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="bg-[#0f1923] border border-border p-6">
              <p className="text-text-muted mb-4 text-[10px] font-mono uppercase tracking-wider">// AI decision log — structure</p>
              <div className="space-y-1.5 font-mono text-[12px] leading-relaxed">
                {[
                  { k: 'event',      v: '"anomaly.detected"',          c: 'text-green-400' },
                  { k: 'anomaly_id', v: '"ANO-xxx"',                   c: 'text-amber-300' },
                  { k: 'confidence', v: '0.97',                        c: 'text-purple-300' },
                  { k: 'risk_tier',  v: '"High"',                      c: 'text-orange-400' },
                  { k: 'action',     v: '"human_approval_required"',   c: 'text-amber-300' },
                  { k: 'actor',      v: '"finance@yourcompany.com"',   c: 'text-green-300' },
                  { k: 'immutable',  v: 'true',                        c: 'text-emerald-400' },
                  { k: 'log_id',     v: '"evt_xxxxxxxxxx"',            c: 'text-text-muted' },
                ].map(row => (
                  <div key={row.k} className="flex gap-3">
                    <span className="text-text-muted select-none">{row.k}:</span>
                    <span className={row.c}>{row.v}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-border flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-text-muted font-mono">tamper-evident · append-only · exportable</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-14 bg-[#0c1526]">
        <div className="px-6 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
          <div className="grid md:grid-cols-[1fr_auto] gap-10 items-center">
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-4">Get started</p>
              <h2 className="text-[2rem] font-bold text-white mb-4 leading-snug">
                Purpose-built for enterprise finance operations
              </h2>
              <p className="text-base text-text-muted leading-relaxed max-w-lg">
                Connect your accounting system and Ventura will scan your transactions automatically.
                Most finance teams identify their first findings within hours of their first sync.
              </p>
            </div>
            <div className="flex flex-col gap-3 md:flex-shrink-0">
              {/* Intentional inverted fill: light button reads as the strong CTA against this dark banner */}
              <Link href="/contact" className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-100 text-slate-900 font-semibold px-7 py-3 text-base transition-colors">
                Talk to us
              </Link>
              <Link href="/contact" className="inline-flex items-center justify-center gap-2 bg-[#1a2640] text-slate-200 font-medium px-7 py-3 text-base border border-border hover:bg-[#1e3a6e] transition-colors">
                Sign up for access <ArrowRightIcon className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

    </PublicLayout>
  )
}

// ── Sub-panels ────────────────────────────────────────────────────────────────

function AnomalyPreviewPanel() {
  const rows = [
    { title: 'Duplicate invoice — same vendor, same amount', type: 'Duplicate',      sev: 'HIGH',     sevCls: 'border-orange-500/30 bg-orange-500/10 text-orange-400' },
    { title: 'Statistical outlier — payment 4× vendor baseline', type: 'Outlier',   sev: 'CRITICAL', sevCls: 'border-red-500/30 bg-red-500/10 text-red-400' },
    { title: 'Round-number transaction above $10,000',         type: 'Round Number', sev: 'MEDIUM',   sevCls: 'border-amber-500/30 bg-amber-500/10 text-amber-400' },
  ]
  return (
    <div className="bg-surface-raised border border-border shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-surface-overlay">
        <p className="text-xs font-semibold text-text-secondary">Anomaly Detection Results</p>
        <span className="text-[10px] text-text-muted border border-border px-2 py-0.5">Example</span>
      </div>
      {rows.map((row, i) => (
        <div key={i} className={`px-4 py-3 flex items-start gap-3 ${i < rows.length - 1 ? 'border-b border-border-subtle' : ''}`}>
          <span className={`text-[10px] font-semibold px-2 py-0.5 border flex-shrink-0 mt-0.5 ${row.sevCls}`}>{row.sev}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-text-secondary leading-snug">{row.title}</p>
            <p className="text-[10px] text-text-muted mt-0.5">{row.type}</p>
          </div>
        </div>
      ))}
      <div className="px-4 py-2.5 bg-surface-overlay border-t border-border">
        <p className="text-[10px] text-text-muted">AI evidence chain and suggested actions available per finding</p>
      </div>
    </div>
  )
}

function WorkflowPreviewPanel() {
  const steps = [
    { step: 'Invoice received',         status: 'done',  actor: 'System',     time: '0h'  },
    { step: '3-way match verification', status: 'done',  actor: 'System',     time: '2h'  },
    { step: 'Manager approval',         status: 'stuck', actor: 'Pending',    time: '6d'  },
    { step: 'AP final sign-off',        status: 'wait',  actor: 'AP Team',    time: '—'   },
    { step: 'Payment release',          status: 'wait',  actor: 'Finance',    time: '—'   },
  ]
  const statusStyle: Record<string, string> = {
    done:  'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    stuck: 'bg-red-500/10 border-red-500/30 text-red-400',
    wait:  'bg-surface-overlay border-border text-text-muted',
  }
  const statusLabel: Record<string, string> = { done: 'Done', stuck: 'Overdue', wait: 'Waiting' }

  return (
    <div className="bg-surface-raised border border-border shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-surface-overlay flex items-center justify-between">
        <p className="text-xs font-semibold text-text-secondary">Invoice Approval Workflow</p>
        <span className="text-[10px] font-semibold text-red-400 bg-red-500/10 border border-red-500/30 px-2 py-0.5">SLA breach</span>
      </div>
      {steps.map((s, i) => (
        <div key={s.step} className={`flex items-center gap-3 px-4 py-2.5 ${i < steps.length - 1 ? 'border-b border-border-subtle' : ''}`}>
          <div className={`w-5 h-5 flex items-center justify-center flex-shrink-0 text-[9px] font-bold ${s.status === 'done' ? 'bg-emerald-500 text-white' : s.status === 'stuck' ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-surface-overlay text-text-muted border border-border'}`}>
            {i + 1}
          </div>
          <p className="text-xs text-text-secondary flex-1">{s.step}</p>
          <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
            <span className="text-[10px] text-text-muted">{s.actor}</span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 border ${statusStyle[s.status]}`}>{statusLabel[s.status]}</span>
          </div>
        </div>
      ))}
      <div className="px-4 py-2.5 bg-amber-500/10 border-t border-amber-500/30">
        <p className="text-[10px] text-amber-400 font-medium">Bottleneck detected at step 3 — SLA target: 48h, approval pending for 6 days</p>
      </div>
    </div>
  )
}

function GovernancePreviewPanel() {
  const events = [
    { ts: 'Today', type: 'AUTO_APPROVED',  tier: 'Low',      conf: 96, action: 'Duplicate invoice flagged and logged'       },
    { ts: 'Today', type: 'HUMAN_REQUIRED', tier: 'Critical', conf: 94, action: 'Statistical outlier — investigation opened' },
    { ts: 'Today', type: 'AUTO_APPROVED',  tier: 'Low',      conf: 90, action: 'License consolidation opportunity noted'    },
    { ts: 'Today', type: 'HUMAN_APPROVED', tier: 'High',     conf: 85, action: 'Budget overrun escalated and reviewed'      },
  ]
  const typeCls: Record<string, string> = {
    AUTO_APPROVED:  'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    HUMAN_REQUIRED: 'bg-red-500/10 text-red-400 border-red-500/30',
    HUMAN_APPROVED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  }
  return (
    <div className="bg-surface-raised border border-border shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-surface-overlay flex items-center justify-between">
        <p className="text-xs font-semibold text-text-secondary">AI Governance Log</p>
        <span className="text-[10px] text-text-muted border border-border px-2 py-0.5">Example</span>
      </div>
      {events.map((e, i) => (
        <div key={i} className={`px-4 py-2.5 ${i < events.length - 1 ? 'border-b border-border-subtle' : ''}`}>
          <div className="flex items-start gap-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-text-secondary leading-snug">{e.action}</p>
              <p className="text-[9px] text-text-muted mt-1">Risk tier: {e.tier} · Confidence {e.conf}%</p>
            </div>
            <span className={`text-[9px] font-semibold px-1.5 py-0.5 border flex-shrink-0 ${typeCls[e.type]}`}>
              {e.type.replace('_', ' ')}
            </span>
          </div>
        </div>
      ))}
      <div className="px-4 py-2.5 bg-surface-overlay border-t border-border">
        <p className="text-[10px] text-text-muted">Every AI action is logged · human approval gates enforced by policy</p>
      </div>
    </div>
  )
}
