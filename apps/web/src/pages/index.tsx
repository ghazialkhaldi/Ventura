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
      'Duplicate and near-duplicate invoice detection',
      'Vendor spend baseline and spike analysis',
      'Round-number and high-frequency payment flags',
      'Policy rule violations with evidence chains',
    ],
    icon: ExclamationTriangleIcon,
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-600',
  },
  {
    id: 'workflow',
    eyebrow: 'Approval controls',
    title: 'Map and enforce every approval workflow with SLA tracking',
    body: 'Model every finance approval process — vendor onboarding, invoice sign-off, contract amendments, expense reimbursements. Surface bottlenecks and SLA breaches in real time so nothing stays stuck in someone\'s inbox.',
    bullets: [
      'Per-workflow SLA targets and breach alerting',
      'Bottleneck identification at each handoff stage',
      'Approval queue analytics by team and role',
      'Automated escalation on SLA breach',
    ],
    icon: ArrowsRightLeftIcon,
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-600',
  },
  {
    id: 'governance',
    eyebrow: 'AI governance',
    title: 'Every AI action is explainable, auditable, and human-controlled',
    body: 'Ventura\'s AI layer is a governed intelligence system — not a black box. Every inference includes confidence scores, evidence references, and risk tier routing. Human approval gates are enforced by policy before any action is taken.',
    bullets: [
      'Risk-tiered model routing by decision type',
      'Confidence score thresholds per workflow',
      'Human-in-the-loop approval gates',
      'Immutable AI execution log for compliance',
    ],
    icon: ScaleIcon,
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-600',
  },
]

function fmtK(v: number) { return `$${v}K` }

export default function HomePage() {
  return (
    <PublicLayout title="Financial Operations Intelligence">

      {/* ── Hero ── */}
      <section className="bg-gradient-to-b from-white to-slate-50 border-b border-slate-200 pt-10 pb-12">
        <div className="px-6 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
          <div className="grid lg:grid-cols-[1fr_1fr] gap-12 items-start">

            {/* Left: copy */}
            <div className="pt-2">
              <h1 className="text-[3rem] font-bold leading-[1.08] tracking-tight mb-5 bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500 bg-clip-text text-transparent">
                Detect spend anomalies.<br />
                Enforce approval controls.<br />
                Protect your operations.
              </h1>
              <p className="text-lg text-slate-600 leading-relaxed mb-7 max-w-xl">
                Ventura connects to your ERP, bank feeds, payroll, and card data to surface financial risk
                and workflow bottlenecks — with explainable AI decisions and a complete audit trail built
                for enterprise compliance requirements.
              </p>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-2 mb-8">
                {['SOC 2 Type II', 'SAML 2.0 / SCIM', 'Role-Based Access', 'Immutable Audit Log'].map((cert, i) => (
                  <React.Fragment key={cert}>
                    {i > 0 && <span className="text-slate-300 select-none" aria-hidden="true">·</span>}
                    <span className="inline-flex items-center gap-1.5 text-sm text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 font-medium">
                      <CheckCircleIcon className="w-4 h-4 text-green-500 flex-shrink-0" />
                      {cert}
                    </span>
                  </React.Fragment>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <Link href="/contact" className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold px-6 py-3 text-base transition-colors">
                  Get started
                </Link>
                <Link href="/demo" className="inline-flex items-center gap-1.5 text-base font-medium text-slate-600 hover:text-slate-900 transition-colors">
                  View a demo <ArrowRightIcon className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Right: demo chart */}
            <div className="lg:pt-2">
              <div className="bg-white border border-slate-200 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.10)] overflow-hidden">
                <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Spend & Anomaly Overview</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Monthly spend · risk exposure · savings identified</p>
                  </div>
                  <span className="text-[10px] text-slate-400 border border-slate-200 px-2 py-0.5 font-medium">
                    Illustrative example
                  </span>
                </div>
                <div className="px-3 pt-4 pb-3 h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={DEMO_DATA} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#10b981" stopOpacity={0.14} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.01} />
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
                      <Area yAxisId="spend" type="monotone" dataKey="spend" stroke="#10b981" strokeWidth={1.5} fill="url(#spendGrad)" />
                      <Bar yAxisId="risk" dataKey="anomalyExposure" fill="#f87171" maxBarSize={14} opacity={0.8} />
                      <Bar yAxisId="risk" dataKey="savingsFound" fill="#34d399" maxBarSize={14} opacity={0.8} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200">
                  <p className="text-[10px] text-slate-400">Connect your data to see real spend trends and detected anomalies</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Integration logo stream ── */}
      <section className="bg-slate-50 border-b border-slate-200 py-6">
        <div className="px-6 sm:px-8 lg:px-12 xl:px-16 2xl:px-20 mb-5 flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Native integrations</p>
            <p className="text-base font-semibold text-slate-700">Connects to your existing financial stack</p>
          </div>
          <p className="text-xs text-slate-400">Also available: REST API · Webhook · SFTP · Custom ETL</p>
        </div>

        <div className="relative overflow-hidden select-none">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-24 z-10 bg-gradient-to-r from-slate-50 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-24 z-10 bg-gradient-to-l from-slate-50 to-transparent" />
          <div className="animate-marquee flex gap-4 w-max px-4">
            {[...STREAM_BRANDS, ...STREAM_BRANDS].map((b, i) => (
              <div
                key={`${b.id}-${i}`}
                className="flex items-center gap-3 bg-white border border-slate-200 px-5 py-3 shadow-sm flex-shrink-0"
              >
                <BrandIcon brand={b.brand} size={30} />
                <span className="text-sm font-semibold text-slate-600 whitespace-nowrap">{b.name}</span>
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
          <section key={cap.id} id={cap.id} className={`py-14 border-b border-slate-200 ${isEven ? 'bg-white' : 'bg-slate-50'}`}>
            <div className="px-6 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
              <div className="grid lg:grid-cols-2 gap-14 items-center">
                <div className={!isEven ? 'lg:order-2' : ''}>
                  <div className={`w-11 h-11 ${cap.iconBg} border border-slate-200 flex items-center justify-center mb-5`}>
                    <Icon className={`w-6 h-6 ${cap.iconColor}`} />
                  </div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">{cap.eyebrow}</p>
                  <h2 className="text-[2rem] font-bold text-slate-900 mb-4 leading-snug">{cap.title}</h2>
                  <p className="text-base text-slate-600 leading-relaxed mb-6">{cap.body}</p>
                  <ul className="space-y-3">
                    {cap.bullets.map(b => (
                      <li key={b} className="flex items-start gap-3 text-base text-slate-700">
                        <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        {b}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-7">
                    <Link href="/demo" className="inline-flex items-center gap-1.5 text-base font-semibold text-slate-600 hover:text-slate-900 transition-colors">
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

      {/* ── Security & Trust ── */}
      <section id="security" className="py-14 bg-white border-b border-slate-200">
        <div className="px-6 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
          <div className="grid md:grid-cols-2 gap-14 items-start">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">Security & Compliance</p>
              <h2 className="text-[2rem] font-bold text-slate-900 mb-4 leading-snug">
                Enterprise-grade security controls, not bolted on after the fact
              </h2>
              <p className="text-base text-slate-600 leading-relaxed mb-8">
                Ventura was designed from the ground up for organizations where data security, access control,
                and compliance documentation are procurement requirements — not nice-to-haves.
              </p>
              <div className="space-y-5">
                {[
                  { icon: LockClosedIcon,  title: 'SOC 2 Type II certified',   body: 'Annual third-party audit. Controls documentation and penetration test results available under NDA.' },
                  { icon: ShieldCheckIcon, title: 'SAML 2.0 and SCIM 2.0',     body: 'Native integration with Okta, Azure AD, and Google Workspace. Automated provisioning and deprovisioning.' },
                  { icon: UsersIcon,       title: 'Role-based access control', body: 'Fine-grained permissions per user, role, and data source. Least-privilege default with explicit grant model.' },
                  { icon: ChartBarIcon,    title: 'Immutable AI audit trail',  body: 'Every inference, human approval, and system action is cryptographically logged with full provenance.' },
                ].map(item => {
                  const IIcon = item.icon
                  return (
                    <div key={item.title} className="flex gap-4 items-start">
                      <div className="w-10 h-10 bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
                        <IIcon className="w-5 h-5 text-slate-600" />
                      </div>
                      <div>
                        <p className="text-base font-semibold text-slate-800">{item.title}</p>
                        <p className="text-sm text-slate-500 mt-1 leading-relaxed">{item.body}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="bg-[#0f1923] border border-slate-700 p-6">
              <p className="text-slate-500 mb-4 text-[10px] font-mono uppercase tracking-wider">// AI decision log — structure</p>
              <div className="space-y-1.5 font-mono text-[12px] leading-relaxed">
                {[
                  { k: 'event',      v: '"anomaly.detected"',          c: 'text-green-400' },
                  { k: 'anomaly_id', v: '"ANO-xxx"',                   c: 'text-amber-300' },
                  { k: 'confidence', v: '0.97',                        c: 'text-purple-300' },
                  { k: 'risk_tier',  v: '"High"',                      c: 'text-orange-400' },
                  { k: 'action',     v: '"human_approval_required"',   c: 'text-amber-300' },
                  { k: 'actor',      v: '"finance@yourcompany.com"',   c: 'text-green-300' },
                  { k: 'immutable',  v: 'true',                        c: 'text-emerald-400' },
                  { k: 'log_id',     v: '"evt_xxxxxxxxxx"',            c: 'text-slate-400' },
                ].map(row => (
                  <div key={row.k} className="flex gap-3">
                    <span className="text-slate-500 select-none">{row.k}:</span>
                    <span className={row.c}>{row.v}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-700 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-slate-400 font-mono">tamper-evident · append-only · exportable</span>
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
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Get started</p>
              <h2 className="text-[2rem] font-bold text-white mb-4 leading-snug">
                Purpose-built for enterprise finance operations
              </h2>
              <p className="text-base text-slate-400 leading-relaxed max-w-lg">
                Connect your accounting system and Ventura will scan your transactions automatically.
                Most finance teams identify their first findings within hours of their first sync.
              </p>
            </div>
            <div className="flex flex-col gap-3 md:flex-shrink-0">
              <Link href="/contact" className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-100 text-slate-900 font-semibold px-7 py-3 text-base transition-colors">
                Talk to us
              </Link>
              <Link href="/contact" className="inline-flex items-center justify-center gap-2 bg-[#1a2640] text-slate-200 font-medium px-7 py-3 text-base border border-slate-700 hover:bg-[#1e3a6e] transition-colors">
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
    { title: 'Duplicate invoice — same vendor, same amount', type: 'Duplicate',      sev: 'HIGH',     sevCls: 'border-orange-200 bg-orange-50 text-orange-700' },
    { title: 'Statistical outlier — payment 4× vendor baseline', type: 'Outlier',   sev: 'CRITICAL', sevCls: 'border-red-200 bg-red-50 text-red-700' },
    { title: 'Round-number transaction above $10,000',         type: 'Round Number', sev: 'MEDIUM',   sevCls: 'border-amber-200 bg-amber-50 text-amber-700' },
  ]
  return (
    <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <p className="text-xs font-semibold text-slate-700">Anomaly Detection Results</p>
        <span className="text-[10px] text-slate-400 border border-slate-200 px-2 py-0.5">Example</span>
      </div>
      {rows.map((row, i) => (
        <div key={i} className={`px-4 py-3 flex items-start gap-3 ${i < rows.length - 1 ? 'border-b border-slate-100' : ''}`}>
          <span className={`text-[10px] font-semibold px-2 py-0.5 border flex-shrink-0 mt-0.5 ${row.sevCls}`}>{row.sev}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-800 leading-snug">{row.title}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{row.type}</p>
          </div>
        </div>
      ))}
      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200">
        <p className="text-[10px] text-slate-400">AI evidence chain and suggested actions available per finding</p>
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
    done:  'bg-green-50 border-green-200 text-green-700',
    stuck: 'bg-red-50 border-red-200 text-red-700',
    wait:  'bg-slate-100 border-slate-200 text-slate-500',
  }
  const statusLabel: Record<string, string> = { done: 'Done', stuck: 'Overdue', wait: 'Waiting' }

  return (
    <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-700">Invoice Approval Workflow</p>
        <span className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5">SLA breach</span>
      </div>
      {steps.map((s, i) => (
        <div key={s.step} className={`flex items-center gap-3 px-4 py-2.5 ${i < steps.length - 1 ? 'border-b border-slate-100' : ''}`}>
          <div className={`w-5 h-5 flex items-center justify-center flex-shrink-0 text-[9px] font-bold ${s.status === 'done' ? 'bg-green-500 text-white' : s.status === 'stuck' ? 'bg-red-100 text-red-600 border border-red-300' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>
            {i + 1}
          </div>
          <p className="text-xs text-slate-700 flex-1">{s.step}</p>
          <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
            <span className="text-[10px] text-slate-400">{s.actor}</span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 border ${statusStyle[s.status]}`}>{statusLabel[s.status]}</span>
          </div>
        </div>
      ))}
      <div className="px-4 py-2.5 bg-amber-50 border-t border-amber-200">
        <p className="text-[10px] text-amber-800 font-medium">Bottleneck detected at step 3 — SLA target: 48h, approval pending for 6 days</p>
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
    AUTO_APPROVED:  'bg-green-50 text-green-700 border-green-200',
    HUMAN_REQUIRED: 'bg-red-50 text-red-700 border-red-200',
    HUMAN_APPROVED: 'bg-green-50 text-green-700 border-green-200',
  }
  return (
    <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-700">AI Governance Log</p>
        <span className="text-[10px] text-slate-400 border border-slate-200 px-2 py-0.5">Example</span>
      </div>
      {events.map((e, i) => (
        <div key={i} className={`px-4 py-2.5 ${i < events.length - 1 ? 'border-b border-slate-100' : ''}`}>
          <div className="flex items-start gap-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-slate-800 leading-snug">{e.action}</p>
              <p className="text-[9px] text-slate-400 mt-1">Risk tier: {e.tier} · Confidence {e.conf}%</p>
            </div>
            <span className={`text-[9px] font-semibold px-1.5 py-0.5 border flex-shrink-0 ${typeCls[e.type]}`}>
              {e.type.replace('_', ' ')}
            </span>
          </div>
        </div>
      ))}
      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200">
        <p className="text-[10px] text-slate-400">Every AI action is logged · human approval gates enforced by policy</p>
      </div>
    </div>
  )
}
