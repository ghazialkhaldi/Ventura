import { useState, useEffect } from 'react'
import AppLayout from '../components/layout/AppLayout'
import DataEmptyState from '../components/ui/DataEmptyState'
import { useDataReady } from '../hooks/useDataReady'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { loadDataset } from '../lib/dataStore'
import type { Dataset } from '../lib/dataStore'
import {
  FileText, Download, Building2, AlertTriangle,
  CheckCircle, TrendingUp, ShieldAlert,
} from 'lucide-react'

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtFull(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function fmtShort(iso: string) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return iso }
}

function today() {
  return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function todaySlug() {
  return new Date().toISOString().slice(0, 10)
}

// ── PDF generation via jsPDF ───────────────────────────────────────────────────

async function generateAndDownload(dataset: Dataset, company: string, includeAudit: boolean) {
  const { jsPDF }          = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc  = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const W    = 210
  const H    = 297
  const L    = 18   // left margin
  const R    = 192  // right edge (W - 18)
  const CW   = R - L // content width = 174

  // ── Colours ──
  const NAVY    : [number,number,number] = [12, 21, 38]
  const SLATE700: [number,number,number] = [51, 65, 85]
  const SLATE500: [number,number,number] = [100, 116, 139]
  const SLATE400: [number,number,number] = [148, 163, 184]
  const SLATE200: [number,number,number] = [226, 232, 240]
  const SLATE100: [number,number,number] = [241, 245, 249]
  const WHITE   : [number,number,number] = [255, 255, 255]
  const RED     : [number,number,number] = [220, 38, 38]
  const ORANGE  : [number,number,number] = [234, 88, 12]
  const AMBER   : [number,number,number] = [217, 119, 6]
  const GREEN   : [number,number,number] = [22, 163, 74]

  const SEV_RGB: Record<string, [number,number,number]> = {
    CRITICAL: RED, HIGH: ORANGE, MEDIUM: AMBER, LOW: SLATE500,
  }

  // ── Derived data ──
  const open       = dataset.anomalies.filter(a => a.status !== 'Resolved' && a.status !== 'Dismissed')
  const critical   = open.filter(a => a.severity === 'CRITICAL')
  const high       = open.filter(a => a.severity === 'HIGH')
  const medium     = open.filter(a => a.severity === 'MEDIUM')
  const low        = open.filter(a => a.severity === 'LOW')
  const exposure   = open.reduce((s, a) => s + a.amount, 0)
  const duplicates = open.filter(a => a.type === 'duplicate')
  const savings    = duplicates.reduce((s, a) => s + a.amount, 0)
  const dateRange  = dataset.dateRange.from
    ? `${fmtShort(dataset.dateRange.from)} – ${fmtShort(dataset.dateRange.to)}`
    : 'All dates'

  const sortedAnomalies = [...open].sort((a, b) => {
    const o: Record<string,number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
    return (o[a.severity] ?? 3) - (o[b.severity] ?? 3)
  })

  const topVendors    = dataset.topVendors.slice(0, 10)
  const topCategories = dataset.categoryBreakdown.slice(0, 8)
  const auditRows     = includeAudit ? dataset.auditLog.slice(0, 25) : []

  // ── Utilities ──
  function setTc(c: [number,number,number]) { doc.setTextColor(c[0], c[1], c[2]) }
  function setFc(c: [number,number,number]) { doc.setFillColor(c[0], c[1], c[2]) }
  function setDc(c: [number,number,number]) { doc.setDrawColor(c[0], c[1], c[2]) }

  function hRule(y: number, color: [number,number,number] = SLATE200, w = 0.2) {
    setDc(color)
    doc.setLineWidth(w)
    doc.line(L, y, R, y)
  }

  function sectionTitle(label: string, y: number): number {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    setTc(NAVY)
    doc.text(label.toUpperCase(), L, y)
    hRule(y + 1.5, NAVY, 0.4)
    return y + 8
  }

  function pageFooter(pageNum: number) {
    hRule(H - 12, SLATE200)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    setTc(SLATE400)
    doc.text(`Ventura Financial Intelligence · ${company} · ${today()}`, L, H - 8)
    doc.text(`Page ${pageNum}`, R, H - 8, { align: 'right' })
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    setTc([220, 38, 38])
    doc.text('CONFIDENTIAL', W / 2, H - 8, { align: 'center' })
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PAGE 1 — Title page
  // ──────────────────────────────────────────────────────────────────────────

  // Full-bleed dark header band
  setFc(NAVY)
  doc.rect(0, 0, W, 48, 'F')

  // Brand name
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  setTc(WHITE)
  doc.text('VENTURA', L, 20)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  setTc(SLATE400)
  doc.text('Financial Intelligence', L, 29)

  // Confidential badge in header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  setTc([220, 38, 38])
  setDc([220, 38, 38])
  doc.setLineWidth(0.3)
  doc.rect(R - 34, 17, 34, 7, 'D')
  doc.text('CONFIDENTIAL', R - 17, 22, { align: 'center' })

  // Report title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(30)
  setTc(NAVY)
  doc.text('Financial Intelligence', L, 78)
  doc.text('Report', L, 92)

  // Subtitle line
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  setTc(SLATE500)
  doc.text('Spend anomalies, risk exposure, and workflow findings', L, 104)

  // Thin rule below subtitle
  hRule(110, SLATE200)

  // Metadata grid (2 columns × 3 rows)
  const metaItems = [
    { label: 'Organization',              value: company },
    { label: 'Report Date',               value: today() },
    { label: 'Data Period',               value: dateRange },
    { label: 'Transactions Analyzed',     value: dataset.totalTransactions.toLocaleString() },
    { label: 'Total Spend Reviewed',      value: fmtFull(dataset.totalSpend) },
    { label: 'Open Anomalies Detected',   value: open.length.toString() },
  ]

  let my = 122
  for (let i = 0; i < metaItems.length; i += 2) {
    const cols = [metaItems[i], metaItems[i + 1]].filter(Boolean)
    cols.forEach((item, ci) => {
      const cx = L + ci * 90
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.5)
      setTc(SLATE400)
      doc.text(item.label.toUpperCase(), cx, my)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      setTc(NAVY)
      doc.text(item.value, cx, my + 8)
    })
    // thin separator between rows
    if (i + 2 < metaItems.length) {
      hRule(my + 13, SLATE200, 0.1)
    }
    my += 20
  }

  // Bottom rule + footer
  hRule(H - 18, SLATE200)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  setTc(SLATE400)
  doc.text('Generated by Ventura Financial Intelligence · venturafinance.net', L, H - 13)
  doc.text('For internal use only', R, H - 13, { align: 'right' })

  // ──────────────────────────────────────────────────────────────────────────
  // PAGE 2 — Executive Summary
  // ──────────────────────────────────────────────────────────────────────────
  doc.addPage()
  let y = 20
  pageFooter(2)

  y = sectionTitle('Executive Summary', y)

  // 4 stat boxes
  const statBoxes = [
    { label: 'Total Spend',       value: fmtFull(dataset.totalSpend), sub: dateRange,                                             color: NAVY    },
    { label: 'Risk Exposure',     value: fmtFull(exposure),            sub: `${open.length} open finding${open.length !== 1 ? 's' : ''}`, color: RED     },
    { label: 'Critical Findings', value: critical.length.toString(),   sub: `${high.length} High · ${medium.length} Med · ${low.length} Low`, color: ORANGE  },
    { label: 'Recoverable',       value: fmtFull(savings),             sub: `${duplicates.length} duplicate${duplicates.length !== 1 ? 's' : ''} detected`, color: GREEN   },
  ]

  const bw = (CW - 9) / 4
  statBoxes.forEach((box, i) => {
    const bx = L + i * (bw + 3)
    const bh = 28
    setFc(SLATE100)
    setDc(SLATE200)
    doc.setLineWidth(0.25)
    doc.rect(bx, y, bw, bh, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    setTc(SLATE400)
    doc.text(box.label.toUpperCase(), bx + 4, y + 6)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    setTc(box.color)
    // Fit long dollar values
    const maxW = bw - 8
    let valStr = box.value
    doc.setFontSize(14)
    while (doc.getStringUnitWidth(valStr) * 14 / doc.internal.scaleFactor > maxW && valStr.length > 4) {
      valStr = valStr.slice(0, -1)
    }
    doc.text(valStr, bx + 4, y + 17)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    setTc(SLATE400)
    doc.text(box.sub, bx + 4, y + 24)
  })
  y += 36

  // Severity legend row
  const sevLegend = [
    { label: 'Critical', count: critical.length, color: RED    },
    { label: 'High',     count: high.length,     color: ORANGE },
    { label: 'Medium',   count: medium.length,   color: AMBER  },
    { label: 'Low',      count: low.length,      color: SLATE500 },
  ]
  let sx = L
  sevLegend.forEach(s => {
    setFc(s.color)
    doc.rect(sx, y, 3.5, 3.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    setTc(SLATE700)
    doc.text(`${s.label}  `, sx + 5.5, y + 3)
    doc.setFont('helvetica', 'normal')
    setTc(SLATE500)
    doc.text(s.count.toString(), sx + 5.5 + doc.getStringUnitWidth(`${s.label}  `) * 8 / doc.internal.scaleFactor, y + 3)
    sx += 44
  })
  y += 12

  // Summary paragraph
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  setTc(SLATE700)
  const para = `Ventura analyzed ${dataset.totalTransactions.toLocaleString()} transactions across ${dataset.uniqueVendors} unique vendors for the period ${dateRange}. The analysis detected ${open.length} open anomal${open.length !== 1 ? 'ies' : 'y'} representing a total risk exposure of ${fmtFull(exposure)}.${savings > 0 ? ` ${fmtFull(savings)} is potentially recoverable from ${duplicates.length} duplicate payment detection${duplicates.length !== 1 ? 's' : ''}.` : ''} All Critical and High severity findings require immediate review.`
  const paraLines = doc.splitTextToSize(para, CW)
  doc.text(paraLines, L, y)

  // ──────────────────────────────────────────────────────────────────────────
  // PAGE 3 — Anomaly Findings
  // ──────────────────────────────────────────────────────────────────────────
  doc.addPage()
  y = 20
  pageFooter(3)
  y = sectionTitle(`Anomaly Findings — ${open.length} Open`, y)

  if (sortedAnomalies.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    setTc(SLATE400)
    doc.text('No open anomalies detected in the current dataset.', L, y + 6)
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: L, right: W - R },
      tableWidth: CW,
      styles: {
        font: 'helvetica',
        fontSize: 7.5,
        cellPadding: { top: 3, right: 4, bottom: 3, left: 4 },
        textColor: SLATE700,
        lineColor: SLATE200,
        lineWidth: 0.15,
        overflow: 'linebreak',
        valign: 'top',
      },
      headStyles: {
        fillColor: NAVY,
        textColor: WHITE,
        fontStyle: 'bold',
        fontSize: 7,
        cellPadding: { top: 4, right: 4, bottom: 4, left: 4 },
      },
      alternateRowStyles: { fillColor: SLATE100 },
      columnStyles: {
        0: { cellWidth: 18, fontStyle: 'bold' },
        1: { cellWidth: 22, font: 'courier', fontSize: 7, textColor: SLATE500 },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 30 },
        4: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
        5: { cellWidth: 14, halign: 'center' },
        6: { cellWidth: 22 },
      },
      head: [['Severity', 'ID', 'Finding', 'Vendor', 'Amount', 'Conf.', 'Status']],
      body: sortedAnomalies.map(a => [
        a.severity,
        a.id,
        `${a.title}\n${a.type.replace(/_/g, ' ')} · ${a.category || '—'}\n${a.description.slice(0, 100)}${a.description.length > 100 ? '…' : ''}`,
        a.vendor || '—',
        fmtFull(a.amount),
        `${a.confidence}%`,
        a.status,
      ]),
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 0) {
          const sev = data.cell.raw as string
          const color = SEV_RGB[sev] ?? SLATE500
          data.cell.styles.textColor = color
        }
        if (data.section === 'body' && data.column.index === 4) {
          const rowSev = sortedAnomalies[data.row.index]?.severity
          data.cell.styles.textColor = SEV_RGB[rowSev] ?? SLATE700
        }
      },
      didDrawPage: (data) => {
        // Re-draw footer on continuation pages
        if (data.pageNumber > 1) {
          pageFooter(2 + data.pageNumber)
        }
      },
    })
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PAGE — Spend by Category + Top Vendors
  // ──────────────────────────────────────────────────────────────────────────
  doc.addPage()
  const catPage = (doc as any).internal.getCurrentPageInfo().pageNumber
  pageFooter(catPage)
  y = 20
  y = sectionTitle('Spend by Category', y)

  if (topCategories.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    setTc(SLATE400)
    doc.text('No category data available.', L, y + 6)
    y += 14
  } else {
    const maxVal = topCategories[0]?.total ?? 1
    const barMaxW = CW - 75   // space left for bar after label and amount
    topCategories.forEach((cat, i) => {
      const rowY = y + i * 11
      // Label
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      setTc(SLATE700)
      const labelStr = cat.category.length > 28 ? cat.category.slice(0, 26) + '…' : cat.category
      doc.text(labelStr, L, rowY + 3)

      // Bar track
      const barX = L + 58
      const barW = (cat.total / maxVal) * barMaxW
      setFc(SLATE200)
      doc.rect(barX, rowY, barMaxW, 5, 'F')
      setFc(NAVY)
      doc.rect(barX, rowY, barW, 5, 'F')

      // Amount
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      setTc(NAVY)
      doc.text(fmtFull(cat.total), R, rowY + 4, { align: 'right' })
    })
    y += topCategories.length * 11 + 10
  }

  // Top Vendors — auto table on same page if space, else new page
  const vendorStartY = (y > H - 80) ? (() => { doc.addPage(); pageFooter(catPage + 1); return 20 })() : y
  y = sectionTitle('Top Vendors by Spend', vendorStartY)

  autoTable(doc, {
    startY: y,
    margin: { left: L, right: W - R },
    tableWidth: CW,
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: { top: 3.5, right: 5, bottom: 3.5, left: 5 },
      textColor: SLATE700,
      lineColor: SLATE200,
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: NAVY,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 7,
      cellPadding: { top: 4, right: 5, bottom: 4, left: 5 },
    },
    alternateRowStyles: { fillColor: SLATE100 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 28 },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
      5: { cellWidth: 26, halign: 'right' },
    },
    head: [['#', 'Vendor', 'Category', 'Transactions', 'Total Spend', 'Avg. Payment']],
    body: topVendors.map((v, i) => {
      const hasAlert = sortedAnomalies.some(a => a.vendor === v.vendor)
      return [
        (i + 1).toString(),
        `${v.vendor}${hasAlert ? ' ⚠' : ''}`,
        v.category || 'Uncategorized',
        v.count.toString(),
        fmtFull(v.total),
        fmtFull(v.avgAmount),
      ]
    }),
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        const raw = data.cell.raw as string
        if (raw.includes('⚠')) data.cell.styles.textColor = ORANGE
      }
    },
    foot: [['', '⚠ Vendor has one or more open anomaly findings', '', '', '', '']],
    footStyles: { fontSize: 6.5, textColor: SLATE400, fillColor: WHITE, fontStyle: 'normal', lineWidth: 0 },
  })

  // ──────────────────────────────────────────────────────────────────────────
  // PAGE — Audit Log (optional)
  // ──────────────────────────────────────────────────────────────────────────
  if (includeAudit && auditRows.length > 0) {
    doc.addPage()
    const auditPageNum = (doc as any).internal.getCurrentPageInfo().pageNumber
    pageFooter(auditPageNum)
    y = 20
    y = sectionTitle(`Audit Log — Recent ${auditRows.length} Events`, y)

    autoTable(doc, {
      startY: y,
      margin: { left: L, right: W - R },
      tableWidth: CW,
      styles: {
        font: 'helvetica',
        fontSize: 7.5,
        cellPadding: { top: 3, right: 4, bottom: 3, left: 4 },
        textColor: SLATE700,
        lineColor: SLATE200,
        lineWidth: 0.15,
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: NAVY,
        textColor: WHITE,
        fontStyle: 'bold',
        fontSize: 7,
        cellPadding: { top: 4, right: 4, bottom: 4, left: 4 },
      },
      alternateRowStyles: { fillColor: SLATE100 },
      columnStyles: {
        0: { cellWidth: 30, textColor: SLATE400, fontSize: 7 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 28, textColor: SLATE500 },
      },
      head: [['Timestamp', 'Event', 'Actor']],
      body: auditRows.map(e => [
        fmtShort(e.ts),
        `${e.event}${e.detail ? ` — ${e.detail}` : ''}`,
        e.actor,
      ]),
    })
  }

  // ── Save ──
  const slug = company.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-')
  doc.save(`Ventura-Report-${slug}-${todaySlug()}.pdf`)
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { isReady, mounted } = useDataReady()
  const user = useCurrentUser()
  const [dataset,      setDataset]      = useState<Dataset | null>(null)
  const [includeAudit, setIncludeAudit] = useState(true)
  const [generating,   setGenerating]   = useState(false)
  const [error,        setError]        = useState('')

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

  async function handleGenerate() {
    setGenerating(true)
    setError('')
    try {
      await generateAndDownload(dataset!, company, includeAudit)
    } catch (e) {
      console.error(e)
      setError('Failed to generate PDF. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <AppLayout title="Reports">
      <div className="max-w-3xl">

        <div className="mb-8">
          <h1 className="text-lg font-bold text-slate-900">Reports</h1>
          <p className="text-xs text-slate-500 mt-0.5">Download a professional PDF report directly to your computer</p>
        </div>

        <div className="bg-white border border-slate-200">

          {/* Header */}
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

          {/* Contents */}
          <div className="px-6 py-5 border-b border-slate-200">
            <p className="text-xs font-semibold text-slate-700 mb-4">Report contents</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { icon: Building2,     label: 'Title page',         desc: `${company} · ${today()}` },
                { icon: TrendingUp,    label: 'Executive summary',  desc: `${fmtFull(dataset.totalSpend)} total spend · ${open.length} open findings` },
                { icon: AlertTriangle, label: 'Anomaly findings',   desc: `${open.length} open · ${critical.length} critical · ${high.length} high` },
                { icon: ShieldAlert,   label: 'Risk exposure',      desc: `${fmtFull(exposure)} total · ${fmtFull(savings)} recoverable` },
                { icon: TrendingUp,    label: 'Spend by category',  desc: `${dataset.categoryBreakdown.length} categories` },
                { icon: Building2,     label: 'Top vendors',        desc: `${Math.min(dataset.topVendors.length, 10)} vendors by total spend` },
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
                <p className="text-[10px] text-slate-400">Appends the last {Math.min(dataset.auditLog.length, 25)} audit events as a final page</p>
              </div>
            </label>
          </div>

          {/* Download button */}
          <div className="px-6 py-5 flex items-center justify-between gap-4 bg-slate-50">
            <div>
              {error
                ? <p className="text-xs text-red-600">{error}</p>
                : <p className="text-xs text-slate-500">Downloads directly to your computer as a PDF file</p>
              }
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
              {generating ? 'Generating…' : 'Download PDF'}
            </button>
          </div>

        </div>

        {/* Stats recap */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Transactions',  value: dataset.totalTransactions.toLocaleString(), color: 'text-slate-900'  },
            { label: 'Open findings', value: open.length.toString(),                     color: open.length > 0     ? 'text-red-700'    : 'text-slate-900' },
            { label: 'Risk exposure', value: fmtFull(exposure),                          color: exposure > 0        ? 'text-orange-700' : 'text-slate-900' },
            { label: 'Recoverable',   value: fmtFull(savings),                           color: savings > 0         ? 'text-green-700'  : 'text-slate-500' },
          ].map(s => (
            <div key={s.label} className="bg-white border border-slate-200 px-4 py-3">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{s.label}</p>
              <p className={`text-base font-bold ${s.color} tabular-nums`}>{s.value}</p>
            </div>
          ))}
        </div>

      </div>
    </AppLayout>
  )
}
