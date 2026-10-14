import { useState, useEffect } from 'react'
import AppLayout from '../components/layout/AppLayout'
import DataEmptyState from '../components/ui/DataEmptyState'
import { useDataReady } from '../hooks/useDataReady'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { loadDataset, isUndecided } from '../lib/dataStore'
import { computeRiskExposure } from '../lib/anomalyEngine'
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
  if (!iso) return 'N/A'
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return iso }
}

function today() {
  return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function todaySlug() {
  return new Date().toISOString().slice(0, 10)
}

// jsPDF's default Helvetica only covers latin-1. Replace characters outside that set.
function safe(s: string): string {
  return (s ?? '')
    .replace(/×/g, 'x')   // × multiplication sign -> x
    .replace(/✕/g, 'x')   // ✕ -> x
    .replace(/⚠/g, '(!)')  // ⚠ -> (!)
    .replace(/–/g, '-')   // en dash -> hyphen
    .replace(/—/g, '--')  // em dash -> --
    .replace(/[Ā-￿]/g, '?') // anything above latin-1 -> ?
}

// ── PDF generation ─────────────────────────────────────────────────────────────

async function generateAndDownload(dataset: Dataset, company: string, includeAudit: boolean) {
  const { jsPDF }              = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const W  = 210
  const H  = 297
  const ML = 16   // left margin
  const MR = 16   // right margin
  const CW = W - ML - MR  // content width = 178mm

  // ── Palette ──
  const NAVY    : [number,number,number] = [10, 18, 35]
  const NAVY2   : [number,number,number] = [18, 32, 56]   // slightly lighter navy for accents
  const SLATE800: [number,number,number] = [30, 41, 59]
  const SLATE600: [number,number,number] = [71, 85, 105]
  const SLATE400: [number,number,number] = [148, 163, 184]
  const SLATE200: [number,number,number] = [226, 232, 240]
  const SLATE100: [number,number,number] = [248, 250, 252]
  const WHITE   : [number,number,number] = [255, 255, 255]
  const RED     : [number,number,number] = [185, 28, 28]   // darker red — more print-safe
  const RED_BG  : [number,number,number] = [254, 242, 242]
  const ORANGE  : [number,number,number] = [194, 65, 12]
  const ORANGE_BG:[number,number,number] = [255, 247, 237]
  const AMBER   : [number,number,number] = [161, 98, 7]
  const AMBER_BG: [number,number,number] = [255, 251, 235]
  const GREEN   : [number,number,number] = [21, 128, 61]
  const ACCENT  : [number,number,number] = [37, 99, 235]   // blue accent for amounts

  const SEV_FG : Record<string,[number,number,number]> = {
    CRITICAL: WHITE,  HIGH: WHITE,  MEDIUM: [92, 51, 2],   LOW: [51, 65, 85],
  }
  const SEV_BG_CELL: Record<string,[number,number,number]> = {
    CRITICAL: RED,  HIGH: ORANGE,  MEDIUM: [217, 145, 10],  LOW: [203, 213, 225],
  }

  // ── Utilities ──
  function tc(c:[number,number,number]) { doc.setTextColor(c[0],c[1],c[2]) }
  function fc(c:[number,number,number]) { doc.setFillColor(c[0],c[1],c[2]) }
  function dc(c:[number,number,number]) { doc.setDrawColor(c[0],c[1],c[2]) }

  function rule(y:number, x1=ML, x2=W-MR, color=SLATE200, lw=0.2) {
    dc(color); doc.setLineWidth(lw); doc.line(x1,y,x2,y)
  }

  function sectionHead(label:string, y:number): number {
    // Left accent bar
    fc(NAVY); doc.rect(ML, y-3, 3, 5.5, 'F')
    doc.setFont('helvetica','bold'); doc.setFontSize(8.5)
    tc(NAVY)
    doc.text(label.toUpperCase(), ML+6, y+1)
    rule(y+3, ML+6, W-MR, SLATE200, 0.25)
    return y + 10
  }

  function footer(pageNum:number, totalPages?:number) {
    rule(H-11, ML, W-MR, SLATE200, 0.15)
    doc.setFont('helvetica','normal'); doc.setFontSize(7); tc(SLATE400)
    doc.text(safe(`Ventura Financial Intelligence  |  ${company}  |  ${today()}`), ML, H-7)
    doc.setFont('helvetica','bold'); doc.setFontSize(7); tc(RED)
    doc.text('CONFIDENTIAL', W/2, H-7, {align:'center'})
    doc.setFont('helvetica','normal'); tc(SLATE400)
    doc.text(`Page ${pageNum}${totalPages ? ` of ${totalPages}` : ''}`, W-MR, H-7, {align:'right'})
  }

  // ── Derived data ──
  const open      = dataset.anomalies.filter(isUndecided)
  const critical  = open.filter(a => a.severity === 'CRITICAL')
  const high      = open.filter(a => a.severity === 'HIGH')
  const medium    = open.filter(a => a.severity === 'MEDIUM')
  const low       = open.filter(a => a.severity === 'LOW')
  const exposure  = computeRiskExposure(open, dataset.sampleTransactions).exposure
  const dups      = open.filter(a => a.type === 'duplicate')
  const savings   = dups.reduce((s,a) => s + a.amount, 0)
  const dateRange = dataset.dateRange.from
    ? `${fmtShort(dataset.dateRange.from)} - ${fmtShort(dataset.dateRange.to)}`
    : 'All dates'

  const sorted = [...open].sort((a,b) => {
    const o:Record<string,number> = {CRITICAL:0,HIGH:1,MEDIUM:2,LOW:3}
    return (o[a.severity]??3)-(o[b.severity]??3)
  })
  const cats    = dataset.categoryBreakdown.slice(0,8)
  const vendors = dataset.topVendors.slice(0,10)
  const audits  = includeAudit ? dataset.auditLog.slice(0,25) : []

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 1 — TITLE
  // ══════════════════════════════════════════════════════════════════════════

  // Full-bleed dark header — taller to eliminate wasted space
  fc(NAVY); doc.rect(0, 0, W, 88, 'F')

  // Brand
  doc.setFont('helvetica','bold'); doc.setFontSize(24); tc(WHITE)
  doc.text('VENTURA', ML, 24)
  doc.setFont('helvetica','normal'); doc.setFontSize(9); tc(SLATE400)
  doc.text('Financial Intelligence', ML, 33)

  // Confidential badge — top right inside header
  dc(RED); doc.setLineWidth(0.4); doc.rect(W-MR-32, 17, 32, 7, 'D')
  doc.setFont('helvetica','bold'); doc.setFontSize(6.5); tc(RED)
  doc.text('CONFIDENTIAL', W-MR-16, 22.2, {align:'center'})

  // Tagline at bottom of dark band
  rule(76, ML, W-MR, NAVY2, 0.5)
  doc.setFont('helvetica','normal'); doc.setFontSize(8.5); tc(SLATE400)
  doc.text('Spend Anomaly Detection  |  Risk Exposure Analysis  |  Workflow Intelligence', ML, 83)

  // Report title block
  doc.setFont('helvetica','bold'); doc.setFontSize(32); tc(NAVY)
  doc.text('Financial Intelligence', ML, 112)
  doc.text('Report', ML, 126)

  doc.setFont('helvetica','normal'); doc.setFontSize(11); tc(SLATE600)
  doc.text('Spend anomalies, risk exposure, and workflow findings', ML, 136)
  rule(140, ML, W-MR, SLATE200, 0.3)

  // Metadata grid — 2 columns x 3 rows, starting at y=148
  const meta = [
    { label:'Organization',            value: safe(company) },
    { label:'Report Date',             value: today()       },
    { label:'Data Period',             value: safe(dateRange) },
    { label:'Transactions Analyzed',   value: dataset.totalTransactions.toLocaleString() },
    { label:'Total Spend Reviewed',    value: fmtFull(dataset.totalSpend) },
    { label:'Open Anomalies Detected', value: open.length.toString()      },
  ]

  let my = 150
  for (let i = 0; i < meta.length; i += 2) {
    // Row separator
    if (i > 0) rule(my - 5, ML, W-MR, SLATE200, 0.1)

    for (let col = 0; col < 2; col++) {
      const item = meta[i+col]
      if (!item) continue
      const cx = ML + col * 90

      doc.setFont('helvetica','bold'); doc.setFontSize(6.5); tc(SLATE400)
      doc.text(item.label.toUpperCase(), cx, my)

      doc.setFont('helvetica','bold'); doc.setFontSize(14); tc(NAVY)
      doc.text(item.value, cx, my+9)
    }
    my += 22
  }

  // Key risk callout box at bottom — fills space and draws attention
  const calloutY = 240
  fc(RED_BG); dc(RED); doc.setLineWidth(0.4)
  doc.rect(ML, calloutY, CW, 22, 'FD')
  // Left accent
  fc(RED); doc.rect(ML, calloutY, 4, 22, 'F')

  doc.setFont('helvetica','bold'); doc.setFontSize(7); tc(RED)
  doc.text('RISK SUMMARY', ML+8, calloutY+7)
  doc.setFont('helvetica','normal'); doc.setFontSize(9); tc(SLATE800)
  doc.text(
    safe(`${open.length} open anomalies detected  |  $${fmtFull(exposure).replace('$','')} total exposure  |  ${critical.length} Critical  |  ${high.length} High  |  ${medium.length} Medium`),
    ML+8, calloutY+15
  )

  // Bottom footer line
  rule(H-14, ML, W-MR, SLATE200, 0.2)
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5); tc(SLATE400)
  doc.text('Generated by Ventura Financial Intelligence  |  venturafinance.net', ML, H-9)
  doc.text('For internal use only', W-MR, H-9, {align:'right'})

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 2 — EXECUTIVE SUMMARY
  // ══════════════════════════════════════════════════════════════════════════
  doc.addPage(); let y = 18; footer(2)

  y = sectionHead('Executive Summary', y)

  // Stat cards — 4 across, with colored left accent bars
  const cards = [
    { label:'Total Spend',       value:fmtFull(dataset.totalSpend), sub:safe(dateRange),                                          accent:NAVY,   vcolor:NAVY    },
    { label:'Risk Exposure',     value:fmtFull(exposure),            sub:`${open.length} open finding${open.length!==1?'s':''}`,   accent:RED,    vcolor:RED     },
    { label:'Critical Findings', value:critical.length.toString(),   sub:`${high.length} High  ${medium.length} Med  ${low.length} Low`, accent:ORANGE, vcolor:ORANGE  },
    { label:'Recoverable',       value:fmtFull(savings),             sub:`${dups.length} duplicate${dups.length!==1?'s':''} found`, accent:GREEN,  vcolor:GREEN   },
  ]

  const cw  = (CW-9)/4
  const ch  = 38
  cards.forEach((card,i) => {
    const cx = ML + i*(cw+3)
    // Card background
    fc(WHITE); dc(SLATE200); doc.setLineWidth(0.25)
    doc.rect(cx, y, cw, ch, 'FD')
    // Colored top border
    fc(card.accent); doc.rect(cx, y, cw, 3, 'F')

    doc.setFont('helvetica','bold'); doc.setFontSize(6.5); tc(SLATE400)
    doc.text(card.label.toUpperCase(), cx+4, y+10)

    // Value — scale font if too wide
    doc.setFont('helvetica','bold'); tc(card.vcolor)
    let fs = 17
    doc.setFontSize(fs)
    while (doc.getStringUnitWidth(card.value)*fs/doc.internal.scaleFactor > cw-8 && fs > 9) {
      fs--; doc.setFontSize(fs)
    }
    doc.text(card.value, cx+4, y+24)

    doc.setFont('helvetica','normal'); doc.setFontSize(6.5); tc(SLATE400)
    doc.text(card.sub, cx+4, y+33)
  })
  y += ch + 10

  // Severity breakdown — pill-style with coloured squares
  const sevRow = [
    {label:'Critical', n:critical.length, bg:RED,    fg:WHITE},
    {label:'High',     n:high.length,     bg:ORANGE, fg:WHITE},
    {label:'Medium',   n:medium.length,   bg:AMBER,  fg:WHITE},
    {label:'Low',      n:low.length,      bg:[148,163,184] as [number,number,number], fg:WHITE},
  ]
  let sx = ML
  sevRow.forEach(s => {
    // Pill background
    fc(s.bg); doc.rect(sx, y, 38, 8, 'F')
    doc.setFont('helvetica','bold'); doc.setFontSize(8); tc(s.fg)
    doc.text(`${s.label}  ${s.n}`, sx+4, y+5.5)
    sx += 42
  })
  y += 16

  // Summary paragraph
  doc.setFont('helvetica','normal'); doc.setFontSize(9); tc(SLATE600)
  const summaryText = safe(
    `Ventura analyzed ${dataset.totalTransactions.toLocaleString()} transactions across ${dataset.uniqueVendors} unique vendors ` +
    `for the period ${dateRange}. The analysis detected ${open.length} open anomal${open.length!==1?'ies':'y'} ` +
    `representing a total risk exposure of ${fmtFull(exposure)}.` +
    (savings>0 ? ` ${fmtFull(savings)} is potentially recoverable from ${dups.length} duplicate payment detection${dups.length!==1?'s':''}.` : '') +
    ` All Critical and High severity findings require immediate review.`
  )
  const paraLines = doc.splitTextToSize(summaryText, CW)
  doc.text(paraLines, ML, y)
  y += paraLines.length * 5 + 10

  // Top findings preview on exec summary page — fills empty space
  if (sorted.length > 0) {
    y = sectionHead('Top Findings at a Glance', y)
    const preview = sorted.slice(0,4)
    preview.forEach((a, i) => {
      const rowY = y + i*14
      const sevBg = SEV_BG_CELL[a.severity] ?? [203,213,225]
      const sevFg = SEV_FG[a.severity] ?? SLATE800

      // Severity pill
      fc(sevBg); doc.rect(ML, rowY, 22, 9, 'F')
      doc.setFont('helvetica','bold'); doc.setFontSize(7); tc(sevFg)
      doc.text(a.severity.slice(0,4), ML+11, rowY+6, {align:'center'})

      // Finding title
      doc.setFont('helvetica','bold'); doc.setFontSize(8.5); tc(SLATE800)
      const title = safe(a.title.length > 62 ? a.title.slice(0,60)+'...' : a.title)
      doc.text(title, ML+26, rowY+4)

      // Vendor + amount right-aligned
      doc.setFont('helvetica','normal'); doc.setFontSize(7.5); tc(SLATE400)
      doc.text(safe(a.vendor), ML+26, rowY+9)
      doc.setFont('helvetica','bold'); doc.setFontSize(8.5); tc(a.severity==='CRITICAL'?RED:a.severity==='HIGH'?ORANGE:SLATE800)
      doc.text(fmtFull(a.amount), W-MR, rowY+6, {align:'right'})

      // Row divider
      if (i < preview.length-1) rule(rowY+12, ML, W-MR, SLATE200, 0.12)
    })
    if (sorted.length > 4) {
      const moreY = y + preview.length*14 + 2
      doc.setFont('helvetica','normal'); doc.setFontSize(7.5); tc(SLATE400)
      doc.text(`+ ${sorted.length-4} more finding${sorted.length-4!==1?'s':''} on the following pages`, ML, moreY)
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 3+ — ANOMALY FINDINGS TABLE
  // ══════════════════════════════════════════════════════════════════════════
  doc.addPage(); y = 18; footer(3)

  y = sectionHead(`Anomaly Findings  -  ${open.length} Open`, y)

  if (sorted.length === 0) {
    doc.setFont('helvetica','normal'); doc.setFontSize(9); tc(SLATE400)
    doc.text('No open anomalies detected in the current dataset.', ML, y+6)
  } else {
    autoTable(doc, {
      startY:   y,
      margin:   { left: ML, right: MR },
      tableWidth: CW,
      rowPageBreak: 'avoid',
      styles: {
        font:        'helvetica',
        fontSize:    8,
        cellPadding: { top:4, right:5, bottom:4, left:5 },
        textColor:   SLATE800,
        lineColor:   SLATE200,
        lineWidth:   0.15,
        overflow:    'linebreak',
        valign:      'middle',
      },
      headStyles: {
        fillColor:  NAVY,
        textColor:  WHITE,
        fontStyle:  'bold',
        fontSize:   7.5,
        cellPadding:{ top:5, right:5, bottom:5, left:5 },
        lineWidth:  0,
      },
      alternateRowStyles: { fillColor: SLATE100 },
      columnStyles: {
        0: { cellWidth: 24, halign:'center', fontStyle:'bold', fontSize:7 },
        1: { cellWidth: 22, fontSize:7, textColor:SLATE400 },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 32 },
        4: { cellWidth: 24, halign:'right', fontStyle:'bold' },
        5: { cellWidth: 14, halign:'center', textColor:SLATE400 },
        6: { cellWidth: 20, halign:'center' },
      },
      head: [['SEVERITY','ID','FINDING','VENDOR','AMOUNT','CONF.','STATUS']],
      body: sorted.map(a => {
        const descClean = safe(a.description).slice(0,110) + (a.description.length>110?'...':'')
        const typeLabel = safe(a.type.replace(/_/g,' '))
        return [
          a.severity,
          a.id,
          `${safe(a.title)}\n${typeLabel}  |  ${safe(a.category||'')}\n${descClean}`,
          safe(a.vendor||'Unknown'),
          fmtFull(a.amount),
          `${a.confidence}%`,
          a.status,
        ]
      }),
      didParseCell: (data) => {
        if (data.section !== 'body') return
        const row = sorted[data.row.index]
        if (!row) return

        // Severity cell — coloured background
        if (data.column.index === 0) {
          data.cell.styles.fillColor  = SEV_BG_CELL[row.severity] ?? [203,213,225]
          data.cell.styles.textColor  = SEV_FG[row.severity] ?? SLATE800
          data.cell.styles.fontStyle  = 'bold'
          data.cell.styles.fontSize   = 7.5
        }
        // Amount — colour by severity
        if (data.column.index === 4) {
          data.cell.styles.textColor = row.severity==='CRITICAL'?RED:row.severity==='HIGH'?ORANGE:NAVY
        }
        // Finding — make title line bold (we can't do per-line styling in autoTable,
        // but we can ensure decent readability via the separator)
      },
      didDrawCell: (data) => {
        // Draw a subtle left border on each body row matching severity colour
        if (data.section === 'body' && data.column.index === 0) {
          const row = sorted[data.row.index]
          if (!row) return
          const col = SEV_BG_CELL[row.severity] ?? NAVY
          fc(col)
          doc.rect(data.cell.x, data.cell.y, 1.5, data.cell.height, 'F')
        }
      },
      didDrawPage: (data) => {
        // Add footer on continuation pages
        if (data.pageNumber > 1) footer(2 + data.pageNumber)
      },
    })
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE N — SPEND BY CATEGORY + TOP VENDORS
  // ══════════════════════════════════════════════════════════════════════════
  doc.addPage()
  const catPage = (doc as any).internal.getCurrentPageInfo().pageNumber
  footer(catPage)
  y = 18
  y = sectionHead('Spend by Category', y)

  if (cats.length === 0) {
    doc.setFont('helvetica','normal'); doc.setFontSize(9); tc(SLATE400)
    doc.text('No category data available.', ML, y+6)
    y += 14
  } else {
    const maxCatVal = cats[0]?.total ?? 1
    const BAR_MAX   = CW - 58 - 26   // label=58, amount=26
    const BAR_H     = 5.5
    const ROW_H     = 10

    cats.forEach((cat, i) => {
      const ry = y + i * ROW_H
      const barW = Math.max(1, (cat.total/maxCatVal)*BAR_MAX)
      const pct  = Math.round((cat.total/maxCatVal)*100)

      // Label
      doc.setFont('helvetica','normal'); doc.setFontSize(8.5); tc(SLATE600)
      const lbl = safe(cat.category.length > 18 ? cat.category.slice(0,16)+'...' : cat.category)
      doc.text(lbl, ML, ry+4)

      // Bar track
      fc(SLATE200); doc.rect(ML+58, ry, BAR_MAX, BAR_H, 'F')

      // Bar fill — gradient feel: darker for larger bars
      const shade = Math.max(0, Math.min(255, 10 + Math.round((1-cat.total/maxCatVal)*40)))
      fc([shade, 35+Math.round((1-cat.total/maxCatVal)*20), 60+Math.round((1-cat.total/maxCatVal)*30)])
      doc.rect(ML+58, ry, barW, BAR_H, 'F')

      // Percentage inside bar (if wide enough)
      if (barW > 12) {
        doc.setFont('helvetica','bold'); doc.setFontSize(6); tc(WHITE)
        doc.text(`${pct}%`, ML+59, ry+4)
      }

      // Amount
      doc.setFont('helvetica','bold'); doc.setFontSize(8.5); tc(NAVY)
      doc.text(fmtFull(cat.total), W-MR, ry+4, {align:'right'})
    })
    y += cats.length * ROW_H + 12
  }

  // Vendors
  const vendorStartY = y > H - 90 ? (() => { doc.addPage(); footer(catPage+1); return 18 })() : y
  y = sectionHead('Top Vendors by Spend', vendorStartY)

  autoTable(doc, {
    startY:   y,
    margin:   { left: ML, right: MR },
    tableWidth: CW,
    rowPageBreak: 'avoid',
    styles: {
      font:        'helvetica',
      fontSize:    8,
      cellPadding: { top:3.5, right:5, bottom:3.5, left:5 },
      textColor:   SLATE800,
      lineColor:   SLATE200,
      lineWidth:   0.15,
      valign:      'middle',
    },
    headStyles: {
      fillColor:   NAVY,
      textColor:   WHITE,
      fontStyle:   'bold',
      fontSize:    7.5,
      cellPadding: { top:5, right:5, bottom:5, left:5 },
      lineWidth:   0,
    },
    alternateRowStyles: { fillColor: SLATE100 },
    columnStyles: {
      0: { cellWidth:10, halign:'center', fontStyle:'bold', textColor:SLATE400, fontSize:7.5 },
      1: { cellWidth:'auto' },
      2: { cellWidth:30 },
      3: { cellWidth:16, halign:'center', textColor:SLATE400 },
      4: { cellWidth:28, halign:'right', fontStyle:'bold' },
      5: { cellWidth:24, halign:'right', textColor:SLATE600 },
    },
    head: [['#','VENDOR','CATEGORY','TXNS','TOTAL SPEND','AVG. PAYMENT']],
    body: vendors.map((v,i) => {
      const hasAlert = sorted.some(a => a.vendor === v.vendor)
      return [
        (i+1).toString(),
        safe(v.vendor) + (hasAlert ? '  (!)' : ''),
        safe(v.category||'Uncategorized'),
        v.count.toString(),
        fmtFull(v.total),
        fmtFull(v.avgAmount),
      ]
    }),
    didParseCell: (data) => {
      if (data.section !== 'body') return
      const v = vendors[data.row.index]
      if (!v) return
      if (data.column.index === 1) {
        const hasAlert = sorted.some(a => a.vendor === v.vendor)
        if (hasAlert) data.cell.styles.textColor = ORANGE
      }
      if (data.column.index === 4) {
        data.cell.styles.textColor = NAVY
      }
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) footer(catPage+data.pageNumber)
    },
  })

  // Note below vendor table
  const afterVendors = (doc as any).lastAutoTable?.finalY ?? y
  if (afterVendors < H - 20) {
    doc.setFont('helvetica','normal'); doc.setFontSize(7); tc(SLATE400)
    doc.text('(!)  Vendor has one or more open anomaly findings', ML, afterVendors+8)
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE N — AUDIT LOG
  // ══════════════════════════════════════════════════════════════════════════
  if (includeAudit && audits.length > 0) {
    doc.addPage()
    const auditPageNum = (doc as any).internal.getCurrentPageInfo().pageNumber
    footer(auditPageNum)
    y = 18
    y = sectionHead(`Audit Log  -  Recent ${audits.length} Events`, y)

    autoTable(doc, {
      startY:   y,
      margin:   { left: ML, right: MR },
      tableWidth: CW,
      rowPageBreak: 'avoid',
      styles: {
        font:        'helvetica',
        fontSize:    8,
        cellPadding: { top:4, right:5, bottom:4, left:5 },
        textColor:   SLATE800,
        lineColor:   SLATE200,
        lineWidth:   0.15,
        overflow:    'linebreak',
        valign:      'top',
      },
      headStyles: {
        fillColor:   NAVY,
        textColor:   WHITE,
        fontStyle:   'bold',
        fontSize:    7.5,
        cellPadding: { top:5, right:5, bottom:5, left:5 },
        lineWidth:   0,
      },
      alternateRowStyles: { fillColor: SLATE100 },
      columnStyles: {
        0: { cellWidth:34, fontSize:7.5, textColor:SLATE400 },
        1: { cellWidth:'auto' },
        2: { cellWidth:28, textColor:SLATE600, halign:'right' },
      },
      head: [['TIMESTAMP','EVENT','ACTOR']],
      body: audits.map(e => [
        fmtShort(e.ts),
        safe(`${e.event}${e.detail ? '  -  '+e.detail : ''}`),
        safe(e.actor),
      ]),
    })
  }

  // ── Save ──
  const slug = company.replace(/[^a-zA-Z0-9]/g,'-').replace(/-+/g,'-').slice(0,30)
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

  useEffect(() => { if (isReady) setDataset(loadDataset()) }, [isReady])

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
  const open       = dataset.anomalies.filter(isUndecided)
  const critical   = open.filter(a => a.severity === 'CRITICAL')
  const high       = open.filter(a => a.severity === 'HIGH')
  const exposure   = computeRiskExposure(open, dataset.sampleTransactions).exposure
  const duplicates = open.filter(a => a.type === 'duplicate')
  const savings    = duplicates.reduce((s,a) => s + a.amount, 0)
  const dateRange  = dataset.dateRange.from
    ? `${fmtShort(dataset.dateRange.from)} - ${fmtShort(dataset.dateRange.to)}`
    : 'All dates'

  async function handleGenerate() {
    setGenerating(true); setError('')
    try { await generateAndDownload(dataset!, company, includeAudit) }
    catch (e) { console.error(e); setError('Failed to generate PDF. Please try again.') }
    finally { setGenerating(false) }
  }

  return (
    <AppLayout title="Reports">
      <div className="max-w-3xl">
        <div className="mb-8">
          <h1 className="text-lg font-medium tracking-[-0.015em] text-text-primary">Reports</h1>
          <p className="text-xs text-text-muted mt-0.5">Download a professional PDF report directly to your computer</p>
        </div>

        <div className="bg-surface-raised border border-border rounded-xl shadow-card">
          {/* Header */}
          <div className="px-6 py-5 border-b border-border flex items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-accent-500 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">Financial Intelligence Report</p>
                <p className="text-xs text-text-muted mt-0.5">{company} · {dateRange}</p>
                <p className="text-xs text-text-muted mt-0.5">Generated {today()}</p>
              </div>
            </div>
            <span className="text-[12px] font-medium text-text-muted border border-border bg-surface-overlay px-2 py-1 flex-shrink-0">PDF</span>
          </div>

          {/* Contents */}
          <div className="px-6 py-5 border-b border-border">
            <p className="text-xs font-medium text-text-secondary mb-4">Report contents</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { icon: Building2,     label: 'Title page',        desc: `${company} · ${today()} · risk summary callout` },
                { icon: TrendingUp,    label: 'Executive summary', desc: `Stat cards + top findings preview + severity breakdown` },
                { icon: AlertTriangle, label: 'Anomaly findings',  desc: `${open.length} open · ${critical.length} critical · ${high.length} high · colour-coded` },
                { icon: ShieldAlert,   label: 'Risk exposure',     desc: `${fmtFull(exposure)} total · ${fmtFull(savings)} recoverable` },
                { icon: TrendingUp,    label: 'Spend by category', desc: `${dataset.categoryBreakdown.length} categories with bar chart` },
                { icon: Building2,     label: 'Top vendors',       desc: `${Math.min(dataset.topVendors.length,10)} vendors · anomaly flags` },
              ].map(item => {
                const Icon = item.icon
                return (
                  <div key={item.label} className="flex items-center gap-3 p-3 bg-surface-sunken border border-border">
                    <Icon className="w-4 h-4 text-text-muted flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-text-secondary">{item.label}</p>
                      <p className="text-[10px] text-text-muted mt-0.5">{item.desc}</p>
                    </div>
                    <CheckCircle className="w-3.5 h-3.5 text-positive-fg ml-auto flex-shrink-0" />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Options */}
          <div className="px-6 py-5 border-b border-border">
            <p className="text-xs font-medium text-text-secondary mb-3">Options</p>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeAudit}
                onChange={e => setIncludeAudit(e.target.checked)}
                className="w-4 h-4 accent-accent-500"
              />
              <div>
                <p className="text-xs font-medium text-text-secondary">Include audit log</p>
                <p className="text-[10px] text-text-muted">Appends the last {Math.min(dataset.auditLog.length,25)} audit events as a final page</p>
              </div>
            </label>
          </div>

          {/* Download */}
          <div className="px-6 py-5 flex items-center justify-between gap-4 bg-surface-sunken">
            <div>
              {error
                ? <p className="text-xs text-critical-fg">{error}</p>
                : <p className="text-xs text-text-muted">Downloads directly to your computer as a PDF file</p>
              }
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center gap-2 bg-accent-600 hover:bg-accent-700 text-white font-medium px-5 py-2.5 text-sm transition-colors disabled:opacity-50 flex-shrink-0"
            >
              {generating ? (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : <Download className="w-4 h-4" />}
              {generating ? 'Generating...' : 'Download PDF'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label:'Transactions',  value:dataset.totalTransactions.toLocaleString(), color:'text-text-primary' },
            { label:'Open findings', value:open.length.toString(),                     color:open.length>0    ?'text-critical-fg'    :'text-text-primary' },
            { label:'Risk exposure', value:fmtFull(exposure),                          color:exposure>0       ?'text-high-fg' :'text-text-primary' },
            { label:'Recoverable',   value:fmtFull(savings),                           color:savings>0        ?'text-positive-fg'  :'text-text-muted' },
          ].map(s => (
            <div key={s.label} className="bg-surface-raised border border-border rounded-xl shadow-card px-4 py-3">
              <p className="text-[12px] font-medium text-text-muted mb-1">{s.label}</p>
              <p className={`text-base font-medium ${s.color} tabular-nums`}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}
