import { useState, useEffect } from 'react'
import AppLayout from '../components/layout/AppLayout'
import DataEmptyState from '../components/ui/DataEmptyState'
import { useDataReady } from '../hooks/useDataReady'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { loadDataset } from '../lib/dataStore'
import type { Dataset, DetectedAnomaly } from '../lib/dataStore'
import {
  FileText, Download, Building2, Calendar, AlertTriangle,
  CheckCircle, Clock, TrendingUp, ShieldAlert,
} from 'lucide-react'

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtFull(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function fmtDate(iso: string) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) }
  catch { return iso }
}

function fmtShort(iso: string) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return iso }
}

function today() {
  return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#dc2626',
  HIGH:     '#ea580c',
  MEDIUM:   '#d97706',
  LOW:      '#64748b',
}

const SEV_BG: Record<string, string> = {
  CRITICAL: '#fef2f2',
  HIGH:     '#fff7ed',
  MEDIUM:   '#fffbeb',
  LOW:      '#f8fafc',
}

// ── PDF generation (print-based) ──────────────────────────────────────────────

function generatePDF(dataset: Dataset, company: string, includeAudit: boolean) {
  const open       = dataset.anomalies.filter(a => a.status !== 'Resolved' && a.status !== 'Dismissed')
  const critical   = open.filter(a => a.severity === 'CRITICAL')
  const high       = open.filter(a => a.severity === 'HIGH')
  const medium     = open.filter(a => a.severity === 'MEDIUM')
  const low        = open.filter(a => a.severity === 'LOW')
  const exposure   = open.reduce((s, a) => s + a.amount, 0)
  const duplicates = open.filter(a => a.type === 'duplicate')
  const savings    = duplicates.reduce((s, a) => s + a.amount, 0)

  const dateRange = dataset.dateRange.from
    ? `${fmtShort(dataset.dateRange.from)} – ${fmtShort(dataset.dateRange.to)}`
    : 'All dates'

  const topVendors   = dataset.topVendors.slice(0, 8)
  const topCategories = dataset.categoryBreakdown.slice(0, 6)
  const maxCat       = topCategories[0]?.total ?? 1

  const anomalyRows = [...open]
    .sort((a, b) => {
      const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
      return (order[a.severity] ?? 3) - (order[b.severity] ?? 3)
    })

  const auditRows = includeAudit ? dataset.auditLog.slice(0, 20) : []

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Financial Intelligence Report — ${company}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; font-size: 11px; line-height: 1.5; }
  @page { size: A4; margin: 20mm 18mm; }
  @media print { .no-print { display: none !important; } }

  /* Title page */
  .title-page { min-height: 100vh; display: flex; flex-direction: column; justify-content: space-between; padding: 60px 0 40px; page-break-after: always; }
  .brand { font-size: 28px; font-weight: 900; letter-spacing: -0.5px; color: #0f172a; }
  .brand span { color: #64748b; }
  .report-title { font-size: 32px; font-weight: 800; color: #0f172a; line-height: 1.1; margin: 60px 0 16px; }
  .report-subtitle { font-size: 15px; color: #475569; font-weight: 400; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 48px; }
  .meta-item label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; display: block; margin-bottom: 3px; }
  .meta-item value { font-size: 13px; font-weight: 600; color: #1e293b; }
  .title-footer { border-top: 1px solid #e2e8f0; padding-top: 20px; display: flex; justify-content: space-between; align-items: center; }
  .title-footer p { font-size: 9px; color: #94a3b8; }
  .confidential { font-size: 9px; font-weight: 700; color: #dc2626; text-transform: uppercase; letter-spacing: 0.1em; border: 1px solid #fca5a5; padding: 3px 8px; }

  /* Sections */
  .section { margin-bottom: 36px; page-break-inside: avoid; }
  .section-title { font-size: 14px; font-weight: 800; color: #0f172a; border-bottom: 2px solid #0f172a; padding-bottom: 6px; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.04em; }
  .section-subtitle { font-size: 10px; color: #64748b; margin-bottom: 14px; }
  .page-break { page-break-before: always; }

  /* Stat cards */
  .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
  .stat-card { border: 1px solid #e2e8f0; padding: 14px 16px; }
  .stat-card .label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 4px; }
  .stat-card .value { font-size: 22px; font-weight: 800; line-height: 1; color: #0f172a; }
  .stat-card .value.red { color: #dc2626; }
  .stat-card .value.orange { color: #ea580c; }
  .stat-card .value.green { color: #16a34a; }
  .stat-card .sub { font-size: 9px; color: #94a3b8; margin-top: 3px; }

  /* Summary bar */
  .sev-bar { display: flex; gap: 16px; margin-bottom: 20px; }
  .sev-item { display: flex; align-items: center; gap-6px; gap: 6px; }
  .sev-dot { width: 8px; height: 8px; border-radius: 0; flex-shrink: 0; }
  .sev-label { font-size: 10px; font-weight: 600; color: #334155; }
  .sev-count { font-size: 10px; color: #64748b; }

  /* Anomaly table */
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  thead tr { background: #0f172a; }
  thead th { text-align: left; padding: 8px 10px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #e2e8f0; }
  tbody tr { border-bottom: 1px solid #f1f5f9; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  tbody td { padding: 8px 10px; vertical-align: top; }
  .sev-badge { display: inline-block; padding: 2px 6px; font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; }
  .amount { font-weight: 700; font-variant-numeric: tabular-nums; }
  .conf { font-size: 9px; color: #64748b; }

  /* Category bars */
  .cat-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .cat-label { font-size: 10px; color: #334155; width: 160px; flex-shrink: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cat-bar-wrap { flex: 1; height: 10px; background: #f1f5f9; }
  .cat-bar { height: 100%; background: #0f172a; }
  .cat-amount { font-size: 10px; font-weight: 600; color: #0f172a; width: 70px; text-align: right; flex-shrink: 0; font-variant-numeric: tabular-nums; }

  /* Vendor table */
  .vendor-row { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-bottom: 1px solid #f1f5f9; }
  .vendor-name { font-size: 10px; color: #334155; font-weight: 500; }
  .vendor-meta { font-size: 9px; color: #94a3b8; margin-top: 1px; }
  .vendor-amount { font-size: 11px; font-weight: 700; color: #0f172a; font-variant-numeric: tabular-nums; }

  /* Audit log */
  .audit-row { display: flex; gap: 12px; padding: 6px 0; border-bottom: 1px solid #f8fafc; align-items: flex-start; }
  .audit-ts { font-size: 9px; color: #94a3b8; width: 130px; flex-shrink: 0; font-variant-numeric: tabular-nums; }
  .audit-event { font-size: 10px; color: #334155; flex: 1; }
  .audit-actor { font-size: 9px; color: #64748b; width: 100px; flex-shrink: 0; text-align: right; }

  /* Footer */
  .report-footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; }
  .report-footer p { font-size: 9px; color: #94a3b8; }
</style>
</head>
<body>

<!-- ── Title page ── -->
<div class="title-page">
  <div>
    <div class="brand">Ventura <span>Financial Intelligence</span></div>
  </div>
  <div>
    <div class="report-title">Financial Intelligence<br>Report</div>
    <div class="report-subtitle">Spend anomalies, risk exposure, and workflow findings</div>
    <div class="meta-grid">
      <div class="meta-item"><label>Organization</label><value>${company}</value></div>
      <div class="meta-item"><label>Report Generated</label><value>${today()}</value></div>
      <div class="meta-item"><label>Data Period</label><value>${dateRange}</value></div>
      <div class="meta-item"><label>Total Transactions Analyzed</label><value>${dataset.totalTransactions.toLocaleString()}</value></div>
      <div class="meta-item"><label>Total Spend Reviewed</label><value>${fmtFull(dataset.totalSpend)}</value></div>
      <div class="meta-item"><label>Anomalies Detected</label><value>${open.length}</value></div>
    </div>
  </div>
  <div class="title-footer">
    <p>Generated by Ventura Financial Intelligence · venturafinance.net</p>
    <div class="confidential">Confidential</div>
  </div>
</div>

<!-- ── Executive summary ── -->
<div class="section">
  <div class="section-title">Executive Summary</div>
  <div class="stat-grid">
    <div class="stat-card">
      <div class="label">Total Spend</div>
      <div class="value">${fmtFull(dataset.totalSpend)}</div>
      <div class="sub">${dateRange}</div>
    </div>
    <div class="stat-card">
      <div class="label">Open Risk Exposure</div>
      <div class="value red">${fmtFull(exposure)}</div>
      <div class="sub">Across ${open.length} open findings</div>
    </div>
    <div class="stat-card">
      <div class="label">Critical Findings</div>
      <div class="value orange">${critical.length}</div>
      <div class="sub">${high.length} High · ${medium.length} Medium · ${low.length} Low</div>
    </div>
    <div class="stat-card">
      <div class="label">Recoverable Amount</div>
      <div class="value green">${fmtFull(savings)}</div>
      <div class="sub">From ${duplicates.length} duplicate payment${duplicates.length !== 1 ? 's' : ''}</div>
    </div>
  </div>
  <div class="sev-bar">
    ${[
      { label: 'Critical', count: critical.length, color: '#dc2626' },
      { label: 'High',     count: high.length,     color: '#ea580c' },
      { label: 'Medium',   count: medium.length,   color: '#d97706' },
      { label: 'Low',      count: low.length,      color: '#64748b' },
    ].map(s => `<div class="sev-item"><div class="sev-dot" style="background:${s.color}"></div><span class="sev-label">${s.label}</span><span class="sev-count">${s.count}</span></div>`).join('')}
  </div>
  <p style="font-size:10px;color:#475569;line-height:1.6;">
    Ventura analyzed <strong>${dataset.totalTransactions.toLocaleString()} transactions</strong> across
    <strong>${dataset.uniqueVendors} vendors</strong> for the period ${dateRange}.
    The analysis detected <strong>${open.length} open anomal${open.length !== 1 ? 'ies' : 'y'}</strong>
    representing a total risk exposure of <strong>${fmtFull(exposure)}</strong>.
    ${savings > 0 ? `<strong>${fmtFull(savings)}</strong> is potentially recoverable from duplicate payment detections.` : ''}
    Immediate review is recommended for all Critical and High severity findings.
  </p>
</div>

<!-- ── Anomaly findings ── -->
<div class="section page-break">
  <div class="section-title">Anomaly Findings (${open.length} Open)</div>
  <div class="section-subtitle">Sorted by severity. All findings require review and resolution.</div>
  ${anomalyRows.length === 0 ? '<p style="color:#64748b;font-size:10px;">No open anomalies detected.</p>' : `
  <table>
    <thead>
      <tr>
        <th style="width:56px">Severity</th>
        <th style="width:60px">ID</th>
        <th>Finding</th>
        <th style="width:80px">Vendor</th>
        <th style="width:72px;text-align:right">Amount</th>
        <th style="width:48px;text-align:center">Conf.</th>
        <th style="width:64px">Status</th>
      </tr>
    </thead>
    <tbody>
      ${anomalyRows.map(a => `
        <tr>
          <td><span class="sev-badge" style="background:${SEV_BG[a.severity]};color:${SEV_COLOR[a.severity]};border:1px solid ${SEV_COLOR[a.severity]}40">${a.severity}</span></td>
          <td style="font-size:9px;font-family:monospace;color:#64748b">${a.id}</td>
          <td>
            <div style="font-weight:600;color:#0f172a;margin-bottom:2px">${a.title}</div>
            <div style="font-size:9px;color:#64748b">${a.type.replace(/_/g, ' ')} · ${a.category || '—'}</div>
            <div style="font-size:9px;color:#475569;margin-top:3px">${a.description.slice(0, 120)}${a.description.length > 120 ? '…' : ''}</div>
          </td>
          <td style="font-size:9px;color:#334155">${a.vendor || '—'}</td>
          <td class="amount" style="text-align:right;color:${SEV_COLOR[a.severity]}">${fmtFull(a.amount)}</td>
          <td style="text-align:center"><span class="conf">${a.confidence}%</span></td>
          <td style="font-size:9px;color:#475569">${a.status}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>`}
</div>

<!-- ── Spend by category ── -->
<div class="section page-break">
  <div class="section-title">Spend by Category</div>
  ${topCategories.map(c => `
    <div class="cat-row">
      <div class="cat-label" title="${c.category}">${c.category}</div>
      <div class="cat-bar-wrap"><div class="cat-bar" style="width:${Math.round((c.total / maxCat) * 100)}%"></div></div>
      <div class="cat-amount">${fmtFull(c.total)}</div>
    </div>
  `).join('')}
</div>

<!-- ── Top vendors ── -->
<div class="section">
  <div class="section-title">Top Vendors by Spend</div>
  ${topVendors.map((v, i) => {
    const hasAlert = anomalyRows.some(a => a.vendor === v.vendor)
    return `
    <div class="vendor-row">
      <div>
        <div class="vendor-name">${i + 1}. ${v.vendor}${hasAlert ? ' ⚠' : ''}</div>
        <div class="vendor-meta">${v.count} transaction${v.count !== 1 ? 's' : ''} · Avg ${fmtFull(v.avgAmount)} · ${v.category || 'Uncategorized'}</div>
      </div>
      <div class="vendor-amount">${fmtFull(v.total)}</div>
    </div>`
  }).join('')}
  <p style="font-size:9px;color:#94a3b8;margin-top:8px">⚠ Vendor has one or more open anomaly findings</p>
</div>

${includeAudit && auditRows.length > 0 ? `
<!-- ── Audit log ── -->
<div class="section page-break">
  <div class="section-title">Audit Log (Recent ${auditRows.length} Events)</div>
  ${auditRows.map(e => `
    <div class="audit-row">
      <div class="audit-ts">${fmtShort(e.ts)}</div>
      <div class="audit-event">${e.event}${e.detail ? ` — ${e.detail}` : ''}</div>
      <div class="audit-actor">${e.actor}</div>
    </div>
  `).join('')}
</div>` : ''}

<div class="report-footer">
  <p>Ventura Financial Intelligence · ${company} · Generated ${today()}</p>
  <p>Confidential — for internal use only</p>
</div>

</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 600)
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { isReady, mounted } = useDataReady()
  const user = useCurrentUser()
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [includeAudit, setIncludeAudit] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (isReady) setDataset(loadDataset())
  }, [isReady])

  if (mounted && !isReady) {
    return (
      <AppLayout title="Reports">
        <DataEmptyState
          title="No data to report"
          description="Upload your financial data on the Dashboard first. Once data is loaded, you can generate a professional PDF report with anomaly findings, spend breakdowns, and audit trail."
        />
      </AppLayout>
    )
  }

  if (!mounted || !dataset) return <AppLayout title="Reports"><div className="h-96" /></AppLayout>

  const company    = user?.company || 'Your Organization'
  const open       = dataset.anomalies.filter(a => a.status !== 'Resolved' && a.status !== 'Dismissed')
  const critical   = open.filter(a => a.severity === 'CRITICAL')
  const high       = open.filter(a => a.severity === 'HIGH')
  const exposure   = open.reduce((s, a) => s + a.amount, 0)
  const duplicates = open.filter(a => a.type === 'duplicate')
  const savings    = duplicates.reduce((s, a) => s + a.amount, 0)
  const dateRange  = dataset.dateRange.from
    ? `${fmtShort(dataset.dateRange.from)} – ${fmtShort(dataset.dateRange.to)}`
    : 'All dates'

  function handleGenerate() {
    if (!dataset) return
    setGenerating(true)
    setTimeout(() => {
      generatePDF(dataset, company, includeAudit)
      setGenerating(false)
    }, 100)
  }

  return (
    <AppLayout title="Reports">
      <div className="max-w-3xl">

        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-lg font-bold text-slate-900">Reports</h1>
          <p className="text-xs text-slate-500 mt-0.5">Generate a professional PDF report from your current data</p>
        </div>

        {/* Report card */}
        <div className="bg-white border border-slate-200">

          {/* Report preview header */}
          <div className="px-6 py-5 border-b border-slate-200 flex items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-slate-900 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Financial Intelligence Report</p>
                <p className="text-xs text-slate-500 mt-0.5">{company} · {dateRange}</p>
                <p className="text-xs text-slate-400 mt-0.5">Generated {today()}</p>
              </div>
            </div>
            <span className="text-[10px] font-semibold text-slate-500 border border-slate-200 bg-slate-50 px-2 py-1 uppercase tracking-wider flex-shrink-0">PDF</span>
          </div>

          {/* What's included */}
          <div className="px-6 py-5 border-b border-slate-200">
            <p className="text-xs font-semibold text-slate-700 mb-4">Report contents</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { icon: Building2,    label: 'Title page', desc: `${company} · ${today()}` },
                { icon: TrendingUp,   label: 'Executive summary', desc: `${fmtFull(dataset.totalSpend)} total spend · ${open.length} open findings` },
                { icon: AlertTriangle, label: 'Anomaly findings', desc: `${open.length} open · ${critical.length} critical · ${high.length} high` },
                { icon: ShieldAlert,  label: 'Risk exposure', desc: `${fmtFull(exposure)} total · ${fmtFull(savings)} recoverable` },
                { icon: TrendingUp,   label: 'Spend by category', desc: `${dataset.categoryBreakdown.length} categories` },
                { icon: Building2,    label: 'Top vendors', desc: `${Math.min(dataset.topVendors.length, 8)} vendors by total spend` },
              ].map(item => {
                const Icon = item.icon
                return (
                  <div key={item.label} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200">
                    <Icon className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{item.label}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{item.desc}</p>
                    </div>
                    <CheckCircle className="w-3.5 h-3.5 text-green-500 ml-auto flex-shrink-0" />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Options */}
          <div className="px-6 py-5 border-b border-slate-200">
            <p className="text-xs font-semibold text-slate-700 mb-3">Options</p>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeAudit}
                onChange={e => setIncludeAudit(e.target.checked)}
                className="w-4 h-4 accent-slate-900"
              />
              <div>
                <p className="text-xs font-medium text-slate-800">Include audit log</p>
                <p className="text-[10px] text-slate-400">Appends the last {Math.min(dataset.auditLog.length, 20)} audit events as a final section</p>
              </div>
            </label>
          </div>

          {/* Generate button */}
          <div className="px-6 py-5 flex items-center justify-between gap-4 bg-slate-50">
            <div>
              <p className="text-xs text-slate-500">Opens in a new window — use your browser's <span className="font-semibold">"Save as PDF"</span> option in the print dialog</p>
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold px-5 py-2.5 text-sm transition-colors disabled:opacity-50 flex-shrink-0"
            >
              {generating ? (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : <Download className="w-4 h-4" />}
              {generating ? 'Preparing…' : 'Generate PDF'}
            </button>
          </div>
        </div>

        {/* Quick stats recap */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Transactions',  value: dataset.totalTransactions.toLocaleString(), color: 'text-slate-900' },
            { label: 'Open findings', value: open.length.toString(),                     color: open.length > 0 ? 'text-red-700' : 'text-slate-900' },
            { label: 'Risk exposure', value: fmtFull(exposure),                          color: exposure > 0 ? 'text-orange-700' : 'text-slate-900' },
            { label: 'Recoverable',   value: fmtFull(savings),                           color: savings > 0 ? 'text-green-700' : 'text-slate-500' },
          ].map(s => (
            <div key={s.label} className="bg-white border border-slate-200 px-4 py-3">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{s.label}</p>
              <p className={`text-base font-bold ${s.color} font-variant-numeric tabular-nums`}>{s.value}</p>
            </div>
          ))}
        </div>

      </div>
    </AppLayout>
  )
}
