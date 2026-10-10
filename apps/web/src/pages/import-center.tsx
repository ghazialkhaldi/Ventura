import { useState, useEffect, useRef } from 'react'
import AppLayout from '../components/layout/AppLayout'
import PageHeader from '../components/ui/PageHeader'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import { Card, CardHeader, CardDivider } from '../components/ui/Card'
import BrandIcon, { type BrandKey } from '../components/ui/BrandIcon'
import { parseFile } from '../lib/transactionParser'
import { runAnomalyDetection } from '../lib/anomalyEngine'
import { saveDataset, loadDataset } from '../lib/dataStore'
import {
  normalizeTransactions,
  detectInvoiceDuplicates,
  loadImportBatches,
  saveImportBatch,
  getReviewQueue,
  approveInvoice,
  rejectInvoice,
  generateBatchId,
  type NormalizedInvoice,
  type ImportBatch,
  type FieldMapping,
} from '../lib/invoiceNormalizer'
import {
  getTierForDate, tierLabel, tierColor, tierBg, tierDot,
} from '../lib/dataLayers'
import {
  Upload, FileText, CheckCircle, AlertCircle, Clock, RefreshCw,
  ChevronDown, ChevronRight, ChevronUp, Info, AlertTriangle,
  ArrowRight, Inbox, History, GitMerge, Shield, X, Eye,
} from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────────

type TabKey = 'import' | 'pipeline' | 'review' | 'history'

type SourceType = 'csv' | 'xlsx' | 'pdf' | 'quickbooks' | 'netsuite' | 'xero' | 'sap' | 'adp'

const SOURCE_OPTS: Array<{ id: SourceType; label: string; brand: BrandKey; accept: string; note: string }> = [
  { id: 'csv',        label: 'CSV / Excel',       brand: 'csv',        accept: '.csv,.tsv,.txt,.xlsx,.xls,.xlsm', note: 'Auto-detects columns' },
  { id: 'pdf',        label: 'PDF Invoice',        brand: 'documents',  accept: '.pdf',                            note: 'Text extraction + pattern match' },
  { id: 'quickbooks', label: 'QuickBooks Export',  brand: 'quickbooks', accept: '.csv,.xlsx,.iif',                 note: 'IIF, CSV, or Excel' },
  { id: 'netsuite',   label: 'NetSuite Export',    brand: 'netsuite',   accept: '.csv,.xlsx',                      note: 'GL, AP, or AR export' },
  { id: 'xero',       label: 'Xero Export',        brand: 'xero',       accept: '.csv,.xlsx',                      note: 'Transactions or invoices' },
  { id: 'sap',        label: 'SAP Export',         brand: 'sap',        accept: '.csv,.xlsx,.txt',                 note: 'FI/CO journal entries' },
  { id: 'adp',        label: 'ADP Payroll',        brand: 'adp',        accept: '.csv,.xlsx',                      note: 'Payroll journal export' },
]

interface PipelineStage {
  id:     string
  label:  string
  status: 'pending' | 'running' | 'done' | 'warn' | 'error'
  detail: string
}

const INITIAL_STAGES: PipelineStage[] = [
  { id: 'receive',    label: 'File Received',       status: 'pending', detail: 'Awaiting upload' },
  { id: 'extract',   label: 'Text Extraction',      status: 'pending', detail: '' },
  { id: 'detect',    label: 'Column Detection',     status: 'pending', detail: '' },
  { id: 'normalize', label: 'Schema Normalization', status: 'pending', detail: '' },
  { id: 'validate',  label: 'Validation',           status: 'pending', detail: '' },
  { id: 'dedup',     label: 'Duplicate Check',      status: 'pending', detail: '' },
  { id: 'engine',    label: 'Anomaly Engine',        status: 'pending', detail: '' },
]

function fmtBytes(b: number): string {
  if (b >= 1_048_576) return (b / 1_048_576).toFixed(1) + ' MB'
  return (b / 1024).toFixed(0) + ' KB'
}

function fmtCurrency(n: number): string {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return '$' + (n / 1_000).toFixed(0) + 'K'
  return '$' + n.toFixed(0)
}

function confidenceColor(c: number): string {
  if (c >= 80) return 'text-positive-fg'
  if (c >= 60) return 'text-medium-fg'
  return 'text-critical-fg'
}

function confidenceBg(c: number): string {
  if (c >= 80) return 'bg-positive'
  if (c >= 60) return 'bg-medium'
  return 'bg-critical'
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ImportCenterPage() {
  const [tab,            setTab]            = useState<TabKey>('import')
  const [source,         setSource]         = useState<SourceType>('csv')
  const [file,           setFile]           = useState<File | null>(null)
  const [dragOver,       setDragOver]       = useState(false)
  const [stage,          setStage]          = useState<'idle' | 'parsing' | 'done' | 'error'>('idle')
  const [errMsg,         setErrMsg]         = useState('')
  const [invoices,       setInvoices]       = useState<NormalizedInvoice[]>([])
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>(INITIAL_STAGES)
  const [expandedRow,    setExpandedRow]    = useState<string | null>(null)
  const [batches,        setBatches]        = useState<ImportBatch[]>([])
  const [reviewQueue,    setReviewQueue]    = useState<NormalizedInvoice[]>([])
  const [showRaw,        setShowRaw]        = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setBatches(loadImportBatches())
    setReviewQueue(getReviewQueue())
  }, [])

  const accepted = SOURCE_OPTS.find(s => s.id === source)?.accept ?? '.csv,.xlsx'

  function handleFile(f: File) {
    setFile(f)
    setStage('idle')
    setErrMsg('')
    setInvoices([])
    setPipelineStages(INITIAL_STAGES.map(s => ({ ...s, status: 'pending', detail: '' })))
  }

  function setStageStatus(id: string, status: PipelineStage['status'], detail: string) {
    setPipelineStages(prev => prev.map(s => s.id === id ? { ...s, status, detail } : s))
  }

  async function handleImport() {
    if (!file) return
    setStage('parsing')
    setErrMsg('')

    try {
      // Stage 1: receive
      setStageStatus('receive', 'done', `${file.name}: ${fmtBytes(file.size)}`)

      // Stage 2: extract
      setStageStatus('extract', 'running', 'Parsing file…')
      const parsed = await parseFile(file)
      if ('error' in parsed) throw new Error(parsed.error)
      setStageStatus('extract', 'done', `${parsed.rowCount.toLocaleString()} rows extracted`)

      // Stage 3: column detection
      setStageStatus('detect', 'running', 'Mapping columns…')
      await new Promise(r => setTimeout(r, 80))
      const mappedCount = Object.values(parsed.mapping).filter(Boolean).length
      setStageStatus('detect', mappedCount >= 3 ? 'done' : 'warn',
        `${mappedCount} of 8 canonical fields mapped`)

      // Stage 4: normalize
      setStageStatus('normalize', 'running', 'Applying canonical schema…')
      await new Promise(r => setTimeout(r, 120))
      const batchId = generateBatchId()
      const normalized = normalizeTransactions(
        parsed.transactions, parsed.mapping, batchId, source
      )
      setStageStatus('normalize', 'done', `${normalized.length.toLocaleString()} invoices normalized`)

      // Stage 5: validate
      setStageStatus('validate', 'running', 'Checking fields…')
      await new Promise(r => setTimeout(r, 80))
      const warnCount = normalized.filter(i => i.normalization_warnings.length > 0).length
      setStageStatus('validate', warnCount > 0 ? 'warn' : 'done',
        warnCount > 0 ? `${warnCount} records have validation warnings` : 'All records valid')

      // Stage 6: dedup
      setStageStatus('dedup', 'running', 'Scanning for duplicates…')
      await new Promise(r => setTimeout(r, 100))
      const dupCount = normalized.filter(i => i.duplicate_flag).length
      setStageStatus('dedup', dupCount > 0 ? 'warn' : 'done',
        dupCount > 0 ? `${dupCount} potential duplicates flagged` : 'No duplicates detected')

      // Stage 7: anomaly engine
      setStageStatus('engine', 'running', 'Running anomaly detection…')
      await new Promise(r => setTimeout(r, 150))
      const anomalies = runAnomalyDetection(parsed.transactions)
      setStageStatus('engine', 'done', `${anomalies.length} anomalies detected`)

      // Save to localStorage
      const reviewCount = normalized.filter(i => i.review_required || i.duplicate_flag).length
      const avgConf = normalized.reduce((s, i) => s + i.normalization_confidence, 0) / normalized.length

      const batch: ImportBatch = {
        id:              batchId,
        created_at:      new Date().toISOString(),
        source,
        file_name:       file.name,
        total_records:   parsed.rowCount,
        normalized:      normalized.length,
        review_required: reviewCount,
        duplicates:      dupCount,
        avg_confidence:  Math.round(avgConf),
        status:          warnCount === 0 && dupCount === 0 ? 'complete' : 'partial',
      }

      saveImportBatch(batch, normalized)

      // Update main dataset
      const existing = loadDataset()
      if (existing) {
        const updatedAnomalies = [...anomalies, ...existing.anomalies]
        const updatedDataset = {
          ...existing,
          anomalies: updatedAnomalies,
          pendingReviewCount: reviewCount,
          lastScanTime: new Date().toISOString(),
        }
        saveDataset(updatedDataset)
      }

      setInvoices(normalized)
      setBatches(loadImportBatches())
      setReviewQueue(getReviewQueue())
      setStage('done')
      setTab('pipeline')

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrMsg(msg)
      setStage('error')
      setPipelineStages(prev => {
        const runIdx = prev.findIndex(s => s.status === 'running')
        if (runIdx < 0) return prev
        return prev.map((s, i) => i === runIdx ? { ...s, status: 'error', detail: msg } : s)
      })
    }
  }

  function handleApprove(id: string) {
    approveInvoice(id)
    setReviewQueue(getReviewQueue())
  }

  function handleReject(id: string) {
    rejectInvoice(id)
    setReviewQueue(getReviewQueue())
  }

  const summary = invoices.length > 0 ? {
    total:      invoices.length,
    reviewed:   invoices.filter(i => i.review_required).length,
    dups:       invoices.filter(i => i.duplicate_flag).length,
    avgConf:    Math.round(invoices.reduce((s, i) => s + i.normalization_confidence, 0) / invoices.length),
  } : null

  return (
    <AppLayout title="Import Center">
      <PageHeader
        title="Import Center"
        subtitle="Ingest, normalize, and validate financial data from any source"
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">{batches.length} batch{batches.length !== 1 ? 'es' : ''} imported</span>
            {reviewQueue.length > 0 && (
              <span className="inline-flex items-center gap-1 bg-medium-bg border border-medium-line text-medium-fg text-xs font-medium px-2 py-0.5 rounded-full">
                <AlertCircle className="w-3 h-3" />
                {reviewQueue.length} pending review
              </span>
            )}
          </div>
        }
        className="mb-6"
      />

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 mb-6 border-b border-border">
        {([
          { key: 'import'   as TabKey, label: 'Import',       icon: Upload,    badge: undefined as number | undefined },
          { key: 'pipeline' as TabKey, label: 'Pipeline',     icon: GitMerge,  badge: undefined as number | undefined },
          { key: 'review'   as TabKey, label: 'Review Queue', icon: Inbox,     badge: reviewQueue.length },
          { key: 'history'  as TabKey, label: 'History',      icon: History,   badge: batches.length },
        ]).map(({ key, label, icon: Icon, badge }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === key
                ? 'border-accent-500 text-accent-700'
                : 'border-transparent text-text-muted hover:text-text-secondary'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {badge !== undefined && badge > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-positive-bg text-positive-fg text-[10px] font-bold">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════ TAB: IMPORT ══════════════ */}
      {tab === 'import' && (
        <div className="space-y-6">

          {/* Source selector */}
          <Card>
            <CardHeader title="Select Data Source" subtitle="Choose where your financial data is coming from" />
            <CardDivider />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
              {SOURCE_OPTS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => { setSource(opt.id); setFile(null); setInvoices([]); setStage('idle') }}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all text-center ${
                    source === opt.id
                      ? 'border-accent-500 bg-accent-50 shadow-sm'
                      : 'border-border hover:border-border-strong'
                  }`}
                >
                  <BrandIcon brand={opt.brand} size={32} />
                  <p className="text-xs font-medium text-text-secondary leading-snug">{opt.label}</p>
                  <p className="text-[10px] text-text-muted leading-tight">{opt.note}</p>
                </button>
              ))}
            </div>
          </Card>

          {/* File upload */}
          <Card>
            <CardHeader title="Upload File" subtitle={`Accepted formats: ${SOURCE_OPTS.find(s => s.id === source)?.accept ?? '.csv,.xlsx'}`} />
            <CardDivider />

            {!file ? (
              <div
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                  dragOver ? 'border-accent-400 bg-accent-50' : 'border-border-strong hover:border-text-muted'
                }`}
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f) }}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept={accepted}
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                />
                <Upload className="w-8 h-8 text-text-muted mx-auto mb-3" />
                <p className="text-sm font-medium text-text-secondary mb-1">Drop your file here or click to browse</p>
                <p className="text-xs text-text-muted">Supports {accepted.replace(/\./g, '').toUpperCase().split(',').join(' · ')}</p>
              </div>
            ) : (
              <div className="flex items-center gap-4 p-4 bg-surface-sunken rounded-lg border border-border">
                <FileText className="w-8 h-8 text-accent-700 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-secondary">{file.name}</p>
                  <p className="text-xs text-text-muted">{fmtBytes(file.size)} · {SOURCE_OPTS.find(s => s.id === source)?.label}</p>
                </div>
                <button onClick={() => { setFile(null); setInvoices([]); setStage('idle') }} className="text-text-muted hover:text-critical-fg transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {errMsg && (
              <div className="flex items-start gap-3 mt-4 bg-critical-bg border border-critical-line rounded-lg px-4 py-3">
                <AlertCircle className="w-4 h-4 text-critical-fg flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-critical-fg">Parsing failed</p>
                  <p className="text-xs text-critical-fg mt-0.5">{errMsg}</p>
                </div>
              </div>
            )}

            {file && stage !== 'done' && (
              <div className="mt-4">
                <button
                  onClick={handleImport}
                  disabled={stage === 'parsing'}
                  className="flex items-center gap-2 bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white shadow-card font-medium px-6 py-2.5 rounded-lg text-sm transition-colors"
                >
                  {stage === 'parsing'
                    ? <><RefreshCw className="w-4 h-4 animate-spin" /> Processing…</>
                    : <><ArrowRight className="w-4 h-4" /> Normalize &amp; Import</>}
                </button>
              </div>
            )}
          </Card>

          {/* Field mapping (shown after parse) */}
          {invoices.length > 0 && invoices[0] && (
            <Card>
              <CardHeader
                title="Field Mapping"
                subtitle="How your raw columns map to the canonical invoice schema"
                action={
                  summary && (
                    <span className={`text-sm font-medium ${confidenceColor(summary.avgConf)}`}>
                      {summary.avgConf}% avg confidence
                    </span>
                  )
                }
              />
              <CardDivider />

              {/* Confidence gauge */}
              {summary && (
                <div className="mb-5 p-4 bg-surface-sunken rounded-lg border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-text-secondary">Normalization Confidence</p>
                    <span className={`text-sm font-medium ${confidenceColor(summary.avgConf)}`}>{summary.avgConf}%</span>
                  </div>
                  <div className="h-2 bg-surface-overlay rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${confidenceBg(summary.avgConf)}`} style={{ width: `${summary.avgConf}%` }} />
                  </div>
                  <div className="flex items-center gap-6 mt-3 text-xs text-text-muted">
                    <span>{summary.total.toLocaleString()} records normalized</span>
                    {summary.reviewed > 0 && <span className="text-medium-fg">{summary.reviewed} need review</span>}
                    {summary.dups > 0 && <span className="text-critical-fg">{summary.dups} duplicates flagged</span>}
                  </div>
                </div>
              )}

              {/* Field mapping table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border-subtle">
                      <th className="text-left pb-2 pr-4 font-medium text-text-muted text-[12px]">Canonical Field</th>
                      <th className="text-left pb-2 pr-4 font-medium text-text-muted text-[12px]">Raw Column</th>
                      <th className="text-left pb-2 pr-4 font-medium text-text-muted text-[12px]">Sample Value</th>
                      <th className="text-left pb-2 font-medium text-text-muted text-[12px]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices[0].field_mappings.map((fm: FieldMapping) => (
                      <tr key={fm.canonical} className="border-b border-border-subtle last:border-0">
                        <td className="py-2 pr-4 font-mono text-text-secondary">{fm.canonical}</td>
                        <td className="py-2 pr-4 font-mono text-positive-fg">{fm.raw_column || <span className="text-text-muted">N/A</span>}</td>
                        <td className="py-2 pr-4 text-text-muted max-w-[180px] truncate" title={fm.sample_value}>
                          {fm.sample_value || <span className="text-text-muted">empty</span>}
                        </td>
                        <td className="py-2">
                          {fm.mapped ? (
                            <span className="inline-flex items-center gap-1 text-positive-fg font-medium">
                              <CheckCircle className="w-3 h-3" /> Mapped
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-medium-fg font-medium" title={fm.warning}>
                              <AlertCircle className="w-3 h-3" />
                              {fm.warning ? 'Inferred' : 'Not found'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ══════════════ TAB: PIPELINE ══════════════ */}
      {tab === 'pipeline' && (
        <Card>
          <CardHeader
            title="Ingestion Pipeline"
            subtitle="Real-time status of each normalization stage"
          />
          <CardDivider />
          <div className="space-y-2">
            {pipelineStages.map((s, idx) => {
              const icon = s.status === 'done'    ? <CheckCircle className="w-4 h-4 text-positive-fg" />
                         : s.status === 'warn'    ? <AlertCircle className="w-4 h-4 text-medium-fg" />
                         : s.status === 'error'   ? <AlertCircle className="w-4 h-4 text-critical-fg" />
                         : s.status === 'running' ? <RefreshCw className="w-4 h-4 text-positive-fg animate-spin" />
                         : <div className="w-4 h-4 rounded-full border-2 border-border-strong" />

              const bg = s.status === 'done'    ? 'bg-positive-bg border-positive-line'
                       : s.status === 'warn'    ? 'bg-medium-bg border-medium-line'
                       : s.status === 'error'   ? 'bg-critical-bg border-critical-line'
                       : s.status === 'running' ? 'bg-positive-bg border-positive-line'
                       : 'bg-surface-sunken border-border'

              return (
                <div key={s.id} className={`flex items-center gap-4 px-4 py-3 rounded-lg border ${bg}`}>
                  <div className="flex-shrink-0">{icon}</div>
                  <div className="w-5 h-5 rounded-full bg-surface-overlay flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-text-muted">{idx + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-secondary">{s.label}</p>
                    <p className="text-xs text-text-muted mt-0.5">{s.detail || (s.status === 'pending' ? 'Waiting…' : '')}</p>
                  </div>
                  <span className="text-xs font-medium capitalize text-text-muted">{s.status}</span>
                </div>
              )
            })}
          </div>

          {stage === 'done' && summary && (
            <div className="mt-6 p-4 bg-positive-bg border border-positive-line rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-positive-fg" />
                <div>
                  <p className="text-sm font-medium text-positive-fg">Import complete</p>
                  <p className="text-xs text-positive-fg mt-0.5">
                    {summary.total.toLocaleString()} invoices normalized · {summary.avgConf}% avg confidence
                    {summary.reviewed > 0 ? ` · ${summary.reviewed} pending review` : ''}
                  </p>
                </div>
                <button
                  onClick={() => setTab('review')}
                  className="ml-auto text-xs text-positive-fg font-medium flex items-center gap-1"
                >
                  Review queue <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ══════════════ TAB: REVIEW QUEUE ══════════════ */}
      {tab === 'review' && (
        <Card>
          <CardHeader
            title="Review Queue"
            subtitle="Invoices with low normalization confidence or potential duplicates"
            action={
              <span className="text-xs text-text-muted">{reviewQueue.length} item{reviewQueue.length !== 1 ? 's' : ''}</span>
            }
          />
          <CardDivider />

          {reviewQueue.length === 0 ? (
            <div className="py-16 flex flex-col items-center text-center">
              <CheckCircle className="w-10 h-10 text-positive-fg mb-3" />
              <p className="text-text-secondary font-medium">Review queue is empty</p>
              <p className="text-xs text-text-muted mt-1">All imported invoices passed confidence thresholds.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border-subtle">
                    {['Invoice', 'Vendor', 'Amount', 'Date', 'Confidence', 'Issues', 'Tier', 'Actions'].map(h => (
                      <th key={h} className="text-left pb-2.5 pr-3 font-medium text-text-muted text-[12px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reviewQueue.map(inv => {
                    const isExpanded = expandedRow === inv.id
                    const tier       = getTierForDate(inv.invoice_date)
                    return (
                      <>
                        <tr
                          key={inv.id}
                          className="border-b border-border-subtle hover:bg-surface-hover cursor-pointer"
                          onClick={() => setExpandedRow(isExpanded ? null : inv.id)}
                        >
                          <td className="py-2.5 pr-3 font-mono text-text-secondary">{inv.invoice_id.slice(0, 14)}…</td>
                          <td className="py-2.5 pr-3 font-medium text-text-secondary max-w-[140px] truncate">{inv.vendor_name || 'N/A'}</td>
                          <td className="py-2.5 pr-3 font-medium text-text-secondary">{fmtCurrency(inv.invoice_total)}</td>
                          <td className="py-2.5 pr-3 text-text-muted">{inv.invoice_date || 'N/A'}</td>
                          <td className="py-2.5 pr-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-surface-overlay rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${confidenceBg(inv.normalization_confidence)}`} style={{ width: `${inv.normalization_confidence}%` }} />
                              </div>
                              <span className={`font-medium ${confidenceColor(inv.normalization_confidence)}`}>{inv.normalization_confidence}%</span>
                            </div>
                          </td>
                          <td className="py-2.5 pr-3">
                            <div className="flex flex-wrap gap-1">
                              {inv.duplicate_flag && <span className="bg-critical-bg border border-critical-line text-critical-fg px-1.5 py-0.5 rounded text-[10px] font-semibold">Duplicate</span>}
                              {inv.normalization_warnings.length > 0 && <span className="bg-medium-bg border border-medium-line text-medium-fg px-1.5 py-0.5 rounded text-[10px] font-semibold">{inv.normalization_warnings.length} warning{inv.normalization_warnings.length !== 1 ? 's' : ''}</span>}
                            </div>
                          </td>
                          <td className="py-2.5 pr-3">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${tierBg(tier)} ${tierColor(tier)}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${tierDot(tier)}`} />
                              {tierLabel(tier)}
                            </span>
                          </td>
                          <td className="py-2.5">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={e => { e.stopPropagation(); handleApprove(inv.id) }}
                                className="bg-positive-bg hover:bg-positive-bg border border-positive-line text-positive-fg px-2.5 py-1 rounded text-[10px] font-semibold transition-colors"
                              >
                                Approve
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); handleReject(inv.id) }}
                                className="bg-critical-bg hover:bg-critical-bg border border-critical-line text-critical-fg px-2.5 py-1 rounded text-[10px] font-semibold transition-colors"
                              >
                                Reject
                              </button>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-text-muted" /> : <ChevronDown className="w-3.5 h-3.5 text-text-muted" />}
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr key={`${inv.id}-expanded`}>
                            <td colSpan={8} className="pb-3 px-1">
                              <div className="bg-surface-sunken border border-border rounded-lg p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                  <p className="text-[12.5px] font-medium text-text-secondary">Record Detail</p>
                                  <button
                                    onClick={() => setShowRaw(showRaw === inv.id ? null : inv.id)}
                                    className="text-xs text-accent-700 flex items-center gap-1"
                                  >
                                    <Eye className="w-3 h-3" />
                                    {showRaw === inv.id ? 'Normalized view' : 'Raw payload'}
                                  </button>
                                </div>

                                {showRaw === inv.id ? (
                                  <div className="font-mono text-[11px] text-text-secondary bg-surface-raised border border-border rounded p-3 overflow-x-auto">
                                    {Object.entries(inv.raw_invoice_payload).map(([k, v]) => (
                                      <div key={k} className="flex gap-4">
                                        <span className="text-accent-700 w-32 flex-shrink-0">{k}</span>
                                        <span>{v}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                    {[
                                      ['vendor_name', inv.vendor_name],
                                      ['invoice_total', fmtCurrency(inv.invoice_total)],
                                      ['invoice_date', inv.invoice_date],
                                      ['due_date', inv.due_date || 'N/A'],
                                      ['payment_terms', inv.payment_terms],
                                      ['currency', inv.currency],
                                      ['department', inv.department || 'N/A'],
                                      ['cost_center', inv.cost_center || 'N/A'],
                                      ['source_system', inv.source_system],
                                      ['fiscal_year', String(inv.fiscal_year)],
                                      ['data_tier', tierLabel(inv.data_tier)],
                                      ['approval_status', inv.approval_status],
                                    ].map(([k, v]) => (
                                      <div key={k}>
                                        <p className="text-[10px] text-text-muted font-mono">{k}</p>
                                        <p className="font-medium text-text-secondary">{v}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {inv.normalization_warnings.length > 0 && (
                                  <div className="space-y-1">
                                    <p className="text-[12px] font-medium text-text-muted">Warnings</p>
                                    {inv.normalization_warnings.map((w, i) => (
                                      <div key={i} className="flex items-start gap-2 text-xs text-medium-fg">
                                        <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                                        {w}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ══════════════ TAB: HISTORY ══════════════ */}
      {tab === 'history' && (
        <Card>
          <CardHeader
            title="Import History"
            subtitle="All previous import batches and their normalization results"
          />
          <CardDivider />

          {batches.length === 0 ? (
            <div className="py-16 flex flex-col items-center text-center">
              <History className="w-10 h-10 text-text-muted mb-3" />
              <p className="text-text-secondary font-medium">No imports yet</p>
              <p className="text-xs text-text-muted mt-1">Go to the Import tab to ingest your first file.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border-subtle">
                    {['Batch ID', 'File', 'Source', 'Records', 'Normalized', 'Avg Confidence', 'Review', 'Duplicates', 'Status', 'Date'].map(h => (
                      <th key={h} className="text-left pb-2.5 pr-4 font-medium text-text-muted text-[12px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {batches.map(b => (
                    <tr key={b.id} className="border-b border-border-subtle hover:bg-surface-hover">
                      <td className="py-2.5 pr-4 font-mono text-text-muted text-[10px]">{b.id}</td>
                      <td className="py-2.5 pr-4 text-text-secondary font-medium max-w-[140px] truncate">{b.file_name}</td>
                      <td className="py-2.5 pr-4 capitalize text-text-muted">{b.source}</td>
                      <td className="py-2.5 pr-4 font-medium text-text-secondary">{b.total_records.toLocaleString()}</td>
                      <td className="py-2.5 pr-4 text-text-secondary">{b.normalized.toLocaleString()}</td>
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-1.5 bg-surface-overlay rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${confidenceBg(b.avg_confidence)}`} style={{ width: `${b.avg_confidence}%` }} />
                          </div>
                          <span className={`font-medium ${confidenceColor(b.avg_confidence)}`}>{b.avg_confidence}%</span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-4">
                        {b.review_required > 0
                          ? <span className="text-medium-fg font-medium">{b.review_required}</span>
                          : <span className="text-text-muted">0</span>}
                      </td>
                      <td className="py-2.5 pr-4">
                        {b.duplicates > 0
                          ? <span className="text-critical-fg font-medium">{b.duplicates}</span>
                          : <span className="text-text-muted">0</span>}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          b.status === 'complete' ? 'bg-positive-bg border-positive-line text-positive-fg' :
                          b.status === 'partial'  ? 'bg-medium-bg border-medium-line text-medium-fg' :
                                                    'bg-critical-bg border-critical-line text-critical-fg'
                        }`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-text-muted">
                        {new Date(b.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </AppLayout>
  )
}
