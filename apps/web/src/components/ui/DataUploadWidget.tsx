import { useState, useRef } from 'react'
import Link from 'next/link'
import { Upload, FileText, X, CheckCircle, AlertCircle, Plug } from 'lucide-react'
import { parseFile } from '../../lib/transactionParser'
import { combineFiles } from '../../lib/datasetStats'
import { ingest } from '../../lib/ingest'
import type { StoredTransaction, AuditEntry } from '../../lib/dataStore'

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

    const parsedFiles: StoredTransaction[][] = []
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
      parsedFiles.push(result.transactions)

      auditLog.push({
        id: `AUD-${Date.now()}-${fi}`,
        ts: new Date().toISOString(),
        actor: 'Ventura',
        event: 'File Parsed',
        detail: `${entry.file.name}: ${result.rowCount.toLocaleString()} rows, ${result.transactions.length.toLocaleString()} transactions extracted`,
        severity: 'info',
        resource: entry.file.name,
      })
    }

    // One register: row ids made unique per file, and payments that an
    // overlapping export repeats counted once.
    const { transactions: allTransactions, overlap } = combineFiles(parsedFiles)
    if (overlap > 0) {
      auditLog.push({
        id: `AUD-${Date.now()}-overlap`,
        ts: new Date().toISOString(),
        actor: 'Ventura',
        event: 'Overlapping Exports Merged',
        detail: `${overlap.toLocaleString()} row(s) appeared in more than one file with the same date, payee, amount and direction, and were counted once.`,
        severity: 'info',
        resource: 'Upload',
      })
    }

    if (allTransactions.length === 0) {
      setGlobalErr('No transactions could be extracted. Make sure your file has columns for vendor/payee and amount.')
      setStage('error')
      return
    }

    // One pipeline for every source: the workspace's detection settings,
    // findings that keep their identity and decisions across uploads, and a
    // copy saved for the team once the workspace database exists.
    setStepIdx(3)
    setProgress(60)
    await new Promise(r => setTimeout(r, 50))
    const done = updatedEntries.filter(e => e.status === 'done')
    const label = done.map(e => e.file.name).join(', ')
    const result = ingest({
      sourceId: `upload:${label}`,
      label,
      transactions: allTransactions,
      file: { name: label, size: done.reduce((n, e) => n + e.file.size, 0), rowCount: done.reduce((n, e) => n + (e.rowCount ?? 0), 0) },
      extraAudit: auditLog,
    })
    setStepIdx(5)
    setProgress(100)
    setSummary({ txCount: result.txCount, anomalyCount: result.anomalyCount })
    setStage('done')

    setTimeout(() => onReady(), 1200)
  }

  if (stage === 'done' && summary) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-full bg-positive-bg border-2 border-positive-line flex items-center justify-center mb-5">
          <CheckCircle className="w-8 h-8 text-positive-fg" />
        </div>
        <p className="text-lg font-medium tracking-[-0.015em] text-text-primary mb-1">Data processed</p>
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
        <h2 className="text-2xl font-medium tracking-[-0.02em] text-text-primary mb-2">Upload your financial data</h2>
        <p className="text-sm text-text-muted max-w-lg mx-auto leading-relaxed">
          Import GL exports, bank statements, payroll files, vendor data, or any transaction report.
          Ventura will parse your data, detect anomalies, and build your analytics. No manual setup required.
        </p>
      </div>

      {/* Drop zone */}
      {!isProcessing && (
        <div
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors mb-4 ${
            dragOver ? 'border-positive bg-positive-bg' : 'border-border-strong hover:border-accent-200 bg-surface-raised'
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
          <p className="text-sm font-medium text-text-secondary mb-1">
            Drop files here or <span className="text-positive-fg underline underline-offset-2">browse to upload</span>
          </p>
          <p className="text-xs text-text-muted mb-4">CSV · TSV · XLSX · XLS · PDF</p>
          <div className="inline-flex items-center gap-2 text-[11px] text-text-muted bg-surface-overlay border border-border rounded-full px-3 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-positive flex-shrink-0" />
            Multiple files · Processed in your browser · Encrypted in transit
          </div>
        </div>
      )}

      {/* File list */}
      {entries.length > 0 && !isProcessing && (
        <div className="bg-surface-raised border border-border rounded-xl overflow-hidden mb-4">
          <div className="px-4 py-2.5 bg-surface-overlay border-b border-border flex items-center justify-between">
            <p className="text-xs font-medium text-text-secondary">
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
                    {e.error && <span className="text-critical-fg ml-2">: {e.error}</span>}
                  </p>
                </div>
                <button
                  onClick={() => removeFile(e.file.name)}
                  className="text-text-muted hover:text-critical-fg transition-colors p-1"
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
                    ? <CheckCircle className="w-4 h-4 text-positive-fg" />
                    : e.status === 'error'
                    ? <AlertCircle className="w-4 h-4 text-critical-fg" />
                    : e.status === 'parsing'
                    ? <svg className="animate-spin w-4 h-4 text-positive-fg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
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
                className="h-full bg-positive rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {globalErr && (
        <div className="flex items-start gap-2.5 bg-critical-bg border border-critical-line text-critical-fg rounded-lg px-4 py-3 text-sm mb-4">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Could not process files</p>
            <p className="text-critical-fg text-xs mt-0.5">{globalErr}</p>
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
              className="flex-1 bg-accent-600 hover:bg-accent-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {entries.length === 0
                ? 'Select files to process'
                : `Process ${entries.length} file${entries.length !== 1 ? 's' : ''}`}
            </button>
            <div className="text-text-muted text-sm font-medium select-none">or</div>
            <Link
              href="/integrations"
              className="flex items-center gap-2 border border-border-strong hover:border-border text-text-secondary font-medium py-3 px-5 rounded-xl transition-colors text-sm bg-surface-raised"
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
