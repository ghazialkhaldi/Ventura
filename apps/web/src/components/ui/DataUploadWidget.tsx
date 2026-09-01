import { useState, useRef } from 'react'
import Link from 'next/link'
import { Upload, FileText, X, CheckCircle, AlertCircle, Plug } from 'lucide-react'
import { parseFile } from '../../lib/transactionParser'
import { runAnomalyDetection } from '../../lib/anomalyEngine'
import { saveDataset } from '../../lib/dataStore'
import type { StoredTransaction, AuditEntry, Dataset, VendorStat, CategoryStat, MonthlyEntry } from '../../lib/dataStore'

interface FileEntry {
  file: File
  status: 'pending' | 'parsing' | 'done' | 'error'
  error?: string
  rowCount?: number
}

type Stage = 'idle' | 'staged' | 'processing' | 'done' | 'error'

const STEP_LABELS = [
  'Reading and parsing files…',
  'Detecting column types…',
  'Extracting transactions…',
  'Running anomaly detection…',
  'Computing statistics…',
  'Saving results…',
]

// Keep in sync with the extensions transactionParser.ts actually parses
// (EXCEL_EXTS / CSV_EXTS / PDF_EXTS). Do not advertise formats that aren't
// implemented — .qbo/.ofx/.qfx/.json/.zip previously appeared here and in the
// file picker but parseFile() rejects all of them with "Unsupported file type".
const ACCEPTED_EXTS = '.csv,.tsv,.txt,.xlsx,.xls,.xlsm,.xlsb,.pdf'

function fmtBytes(b: number): string {
  if (b >= 1_073_741_824) return (b / 1_073_741_824).toFixed(1) + ' GB'
  if (b >= 1_048_576)     return (b / 1_048_576).toFixed(1) + ' MB'
  if (b >= 1_024)         return (b / 1_024).toFixed(0) + ' KB'
  return b + ' B'
}

interface Props {
  onReady: () => void
}

export default function DataUploadWidget({ onReady }: Props) {
  const [entries,   setEntries]   = useState<FileEntry[]>([])
  const [stage,     setStage]     = useState<Stage>('idle')
  const [stepIdx,   setStepIdx]   = useState(0)
  const [progress,  setProgress]  = useState(0)
  const [dragOver,  setDragOver]  = useState(false)
  const [globalErr, setGlobalErr] = useState('')
  const [summary,   setSummary]   = useState<{ txCount: number; anomalyCount: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function addFiles(incoming: FileList | null) {
    if (!incoming) return
    setGlobalErr('')
    const next: FileEntry[] = []
    for (let i = 0; i < incoming.length; i++) {
      const f = incoming[i]
      next.push({ file: f, status: 'pending' })
    }
    setEntries(prev => {
      const names = new Set(prev.map(e => e.file.name))
      return [...prev, ...next.filter(e => !names.has(e.file.name))]
    })
    setStage('staged')
  }

  function removeFile(name: string) {
    const next = entries.filter(e => e.file.name !== name)
    setEntries(next)
    if (next.length === 0) setStage('idle')
  }

  async function handleProcess() {
    if (entries.length === 0) return
    setGlobalErr('')
    setStage('processing')
    setProgress(0)
    setStepIdx(0)

    const allTransactions: StoredTransaction[] = []
    const updatedEntries = [...entries]
    const auditLog: AuditEntry[] = []

    // Step 0–2: parse files
    for (let fi = 0; fi < updatedEntries.length; fi++) {
      const entry = updatedEntries[fi]
      setStepIdx(0)
      setProgress(Math.round((fi / updatedEntries.length) * 40))

      updatedEntries[fi] = { ...entry, status: 'parsing' }
      setEntries([...updatedEntries])

      const result = await parseFile(entry.file)

      if ('error' in result) {
        updatedEntries[fi] = { ...entry, status: 'error', error: result.error }
        setEntries([...updatedEntries])
        auditLog.push({
          id: `AUD-${Date.now()}-${fi}`,
          ts: new Date().toISOString(),
          actor: 'Ventura',
          event: 'Parse Error',
          detail: `Failed to parse ${entry.file.name}: ${result.error}`,
          severity: 'warning',
          resource: entry.file.name,
        })
        continue
      }

      updatedEntries[fi] = {
        ...entry,
        status: 'done',
        rowCount: result.rowCount,
      }
      setEntries([...updatedEntries])
      allTransactions.push(...result.transactions)

      auditLog.push({
        id: `AUD-${Date.now()}-${fi}`,
        ts: new Date().toISOString(),
        actor: 'Ventura',
        event: 'File Parsed',
        detail: `${entry.file.name} — ${result.rowCount.toLocaleString()} rows, ${result.transactions.length.toLocaleString()} transactions extracted`,
        severity: 'info',
        resource: entry.file.name,
      })
    }

    if (allTransactions.length === 0) {
      setGlobalErr('No transactions could be extracted. Make sure your file has columns for vendor/payee and amount.')
      setStage('error')
      return
    }

    // Split spend (debit) from credits (refunds/rebates/reversals) before any
    // aggregation — credits are not vendor spend and must not feed spend
    // totals, vendor/category/monthly stats, or spend-anomaly detection.
    const spendTransactions = allTransactions.filter(t => t.direction !== 'credit')
    const creditTransactions = allTransactions.filter(t => t.direction === 'credit')

    // Step 3: anomaly detection
    setStepIdx(3)
    setProgress(55)
    await new Promise(r => setTimeout(r, 200))
    const anomalies = runAnomalyDetection(spendTransactions)

    auditLog.unshift({
      id: `AUD-${Date.now()}-detect`,
      ts: new Date().toISOString(),
      actor: 'Ventura AI',
      event: 'Anomaly Detection Complete',
      detail: `Analyzed ${spendTransactions.length.toLocaleString()} transactions — ${anomalies.length} anomalies detected (${anomalies.filter(a => a.severity === 'CRITICAL').length} critical, ${anomalies.filter(a => a.severity === 'HIGH').length} high)`,
      severity: anomalies.some(a => a.severity === 'CRITICAL') ? 'critical' : anomalies.length > 0 ? 'warning' : 'info',
      resource: 'Anomaly Engine',
    })

    if (creditTransactions.length > 0) {
      auditLog.push({
        id: `AUD-${Date.now()}-credits`,
        ts: new Date().toISOString(),
        actor: 'Ventura',
        event: 'Credits Excluded From Spend',
        detail: `${creditTransactions.length.toLocaleString()} credit/refund row(s) totaling ${creditTransactions.reduce((s, t) => s + t.amount, 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} were identified via the Credit column and excluded from spend totals and anomaly detection.`,
        severity: 'info',
        resource: 'Anomaly Engine',
      })
    }

    // Step 4: statistics
    setStepIdx(4)
    setProgress(75)
    await new Promise(r => setTimeout(r, 150))

    const totalSpend   = spendTransactions.reduce((s, t) => s + t.amount, 0)
    const totalCredits = creditTransactions.reduce((s, t) => s + t.amount, 0)

    // Top vendors (spend only)
    const vendorMap = new Map<string, { total: number; count: number; category: string }>()
    for (const tx of spendTransactions) {
      const k = tx.vendor
      const v = vendorMap.get(k) ?? { total: 0, count: 0, category: tx.category }
      v.total += tx.amount
      v.count++
      vendorMap.set(k, v)
    }
    const topVendors: VendorStat[] = [...vendorMap.entries()]
      .map(([vendor, v]) => ({ vendor, total: v.total, count: v.count, avgAmount: v.total / v.count, category: v.category }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 20)

    // Category breakdown (spend only)
    const catMap = new Map<string, { total: number; count: number }>()
    for (const tx of spendTransactions) {
      const k = tx.category || 'Uncategorized'
      const v = catMap.get(k) ?? { total: 0, count: 0 }
      v.total += tx.amount
      v.count++
      catMap.set(k, v)
    }
    const categoryBreakdown: CategoryStat[] = [...catMap.entries()]
      .map(([category, v]) => ({ category, total: v.total, count: v.count }))
      .sort((a, b) => b.total - a.total)

    // Monthly breakdown (spend only)
    const monthMap = new Map<string, MonthlyEntry>()
    for (const tx of spendTransactions) {
      if (!tx.date) continue
      const d = new Date(tx.date)
      if (isNaN(d.getTime())) continue
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleString('default', { month: 'short', year: 'numeric' })
      const prev = monthMap.get(key) ?? { month: label, spend: 0, count: 0 }
      prev.spend += tx.amount
      prev.count++
      monthMap.set(key, prev)
    }
    const monthlyBreakdown: MonthlyEntry[] = [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v)

    // Date range (all ingested rows, spend and credit)
    const dates = allTransactions.map(t => t.date).filter(Boolean).sort()
    const dateRange = { from: dates[0] ?? '', to: dates[dates.length - 1] ?? '' }

    const uniqueVendors = vendorMap.size

    // Step 5: save
    setStepIdx(5)
    setProgress(90)

    const allFilesResult = updatedEntries.filter(e => e.status === 'done')
    const columnMapping = allTransactions.length > 0
      ? { date: 'auto', vendor: 'auto', amount: 'auto', debit: null, credit: null, description: null, category: null, account: null }
      : { date: null, vendor: null, amount: null, debit: null, credit: null, description: null, category: null, account: null }

    auditLog.unshift({
      id: `AUD-${Date.now()}-upload`,
      ts: new Date().toISOString(),
      actor: 'User',
      event: 'Data Uploaded',
      detail: `${allFilesResult.length} file(s) uploaded — ${allTransactions.length.toLocaleString()} total transactions, ${fmtBytes(entries.reduce((s, e) => s + e.file.size, 0))} total`,
      severity: 'info',
      resource: allFilesResult.map(e => e.file.name).join(', '),
    })

    const dataset: Dataset = {
      uploadedAt: new Date().toISOString(),
      files: allFilesResult.map(e => ({
        name:     e.file.name,
        size:     e.file.size,
        rowCount: e.rowCount ?? 0,
        parsedAt: new Date().toISOString(),
      })),
      columnMapping,
      totalTransactions: allTransactions.length,
      totalSpend,
      totalCredits,
      creditCount: creditTransactions.length,
      uniqueVendors,
      dateRange,
      topVendors,
      categoryBreakdown,
      monthlyBreakdown,
      anomalies,
      auditLog,
      sampleTransactions: allTransactions.slice(0, 100),
    }

    saveDataset(dataset)
    setProgress(100)
    setSummary({ txCount: spendTransactions.length, anomalyCount: anomalies.length })
    setStage('done')

    setTimeout(() => onReady(), 1200)
  }

  if (stage === 'done' && summary) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center mb-5">
          <CheckCircle className="w-8 h-8 text-emerald-400" />
        </div>
        <p className="text-lg font-semibold text-text-primary mb-1">Data processed</p>
        <p className="text-sm text-text-muted mb-4">
          {summary.txCount.toLocaleString()} transactions analyzed ·{' '}
          {summary.anomalyCount} anomali{summary.anomalyCount !== 1 ? 'es' : 'y'} detected
        </p>
        <p className="text-xs text-text-muted">Loading your workspace…</p>
      </div>
    )
  }

  const isProcessing = stage === 'processing'

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent-500 mb-4">
          <Upload className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-text-primary mb-2">Upload your financial data</h2>
        <p className="text-sm text-text-muted max-w-lg mx-auto leading-relaxed">
          Import GL exports, bank statements, payroll files, vendor data, or any transaction report.
          Ventura will parse your data, detect anomalies, and build your analytics — no manual setup required.
        </p>
      </div>

      {/* Drop zone */}
      {!isProcessing && (
        <div
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors mb-4 ${
            dragOver ? 'border-emerald-400 bg-emerald-500/10' : 'border-border-strong hover:border-accent-500/50 bg-surface-raised'
          }`}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault()
            setDragOver(false)
            addFiles(e.dataTransfer.files)
          }}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED_EXTS}
            className="hidden"
            onChange={e => { addFiles(e.target.files); if (inputRef.current) inputRef.current.value = '' }}
          />
          <Upload className="w-9 h-9 text-text-muted mx-auto mb-3" />
          <p className="text-sm font-semibold text-text-secondary mb-1">
            Drop files here or <span className="text-emerald-400 underline underline-offset-2">browse to upload</span>
          </p>
          <p className="text-xs text-text-muted mb-4">CSV · TSV · XLSX · XLS · PDF</p>
          <div className="inline-flex items-center gap-2 text-[11px] text-text-muted bg-surface-overlay border border-border rounded-full px-3 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
            Multiple files · Processed in your browser · Encrypted in transit
          </div>
        </div>
      )}

      {/* File list */}
      {entries.length > 0 && !isProcessing && (
        <div className="bg-surface-raised border border-border rounded-xl overflow-hidden mb-4">
          <div className="px-4 py-2.5 bg-surface-overlay border-b border-border flex items-center justify-between">
            <p className="text-xs font-semibold text-text-secondary">
              {entries.length} file{entries.length !== 1 ? 's' : ''} selected ·{' '}
              {fmtBytes(entries.reduce((s, e) => s + e.file.size, 0))} total
            </p>
            <button
              onClick={() => { setEntries([]); setStage('idle'); setGlobalErr('') }}
              className="text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              Clear all
            </button>
          </div>
          <div className="divide-y divide-border-subtle">
            {entries.map(e => (
              <div key={e.file.name} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-md bg-surface-overlay border border-border flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-text-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{e.file.name}</p>
                  <p className="text-xs text-text-muted">
                    {fmtBytes(e.file.size)}
                    {e.error && <span className="text-red-400 ml-2">— {e.error}</span>}
                  </p>
                </div>
                <button
                  onClick={() => removeFile(e.file.name)}
                  className="text-text-muted hover:text-red-400 transition-colors p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Processing progress */}
      {isProcessing && (
        <div className="bg-surface-raised border border-border rounded-xl p-8 mb-4">
          <div className="space-y-4">
            {entries.map(e => (
              <div key={e.file.name} className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  {e.status === 'done'
                    ? <CheckCircle className="w-4 h-4 text-emerald-400" />
                    : e.status === 'error'
                    ? <AlertCircle className="w-4 h-4 text-red-400" />
                    : e.status === 'parsing'
                    ? <svg className="animate-spin w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    : <div className="w-4 h-4 rounded-full border-2 border-border-strong" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{e.file.name}</p>
                  {e.rowCount != null && (
                    <p className="text-xs text-text-muted">{e.rowCount.toLocaleString()} rows</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-text-secondary">{STEP_LABELS[stepIdx] ?? 'Processing…'}</p>
              <span className="text-sm font-mono text-text-muted">{progress}%</span>
            </div>
            <div className="h-2 bg-surface-overlay rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {globalErr && (
        <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm mb-4">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Could not process files</p>
            <p className="text-red-400/80 text-xs mt-0.5">{globalErr}</p>
          </div>
        </div>
      )}

      {/* Actions */}
      {!isProcessing && stage !== 'done' && (
        <>
          <div className="flex items-center gap-3">
            <button
              onClick={handleProcess}
              disabled={entries.length === 0 || entries.every(e => e.status === 'error')}
              className="flex-1 bg-accent-500 hover:bg-accent-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {entries.length === 0
                ? 'Select files to process'
                : `Process ${entries.length} file${entries.length !== 1 ? 's' : ''}`}
            </button>
            <div className="text-text-muted text-sm font-medium select-none">or</div>
            <Link
              href="/integrations"
              className="flex items-center gap-2 border border-border-strong hover:border-border text-text-secondary font-semibold py-3 px-5 rounded-xl transition-colors text-sm bg-surface-raised"
            >
              <Plug className="w-4 h-4" />
              Connect integration
            </Link>
          </div>
          <p className="text-center text-xs text-text-muted mt-4 leading-relaxed">
            Supports QuickBooks, NetSuite, SAP, Xero, ADP, Gusto, Plaid, Stripe exports and any standard GL/ledger CSV.
            Column auto-detection handles most export formats without configuration.
          </p>
        </>
      )}
    </div>
  )
}
