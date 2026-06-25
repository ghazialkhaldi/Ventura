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
  if (c >= 80) return 'text-green-700'
  if (c >= 60) return 'text-amber-700'
  return 'text-red-700'
}

function confidenceBg(c: number): string {
  if (c >= 80) return 'bg-green-500'
  if (c >= 60) return 'bg-amber-500'
  return 'bg-red-500'
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
      setStageStatus('receive', 'done', `${file.name} — ${fmtBytes(file.size)}`)

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
            <span className="text-xs text-slate-500">{batches.length} batch{batches.length !== 1 ? 'es' : ''} imported</span>
            {reviewQueue.length > 0 && (
              <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                <AlertCircle className="w-3 h-3" />
                {reviewQueue.length} pending review
              </span>
            )}
          </div>
        }
        className="mb-6"
      />

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 mb-6 border-b border-slate-200">
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
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {badge !== undefined && badge > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
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
                      ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <BrandIcon brand={opt.brand} size={32} />
                  <p className="text-xs font-semibold text-slate-800 leading-snug">{opt.label}</p>
                  <p className="text-[10px] text-slate-400 leading-tight">{opt.note}</p>
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
                  dragOver ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 hover:border-slate-400'
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
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-700 mb-1">Drop your file here or click to browse</p>
                <p className="text-xs text-slate-400">Supports {accepted.replace(/\./g, '').toUpperCase().split(',').join(' · ')}</p>
              </div>
            ) : (
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <FileText className="w-8 h-8 text-emerald-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{file.name}</p>
                  <p className="text-xs text-slate-500">{fmtBytes(file.size)} · {SOURCE_OPTS.find(s => s.id === source)?.label}</p>
                </div>
                <button onClick={() => { setFile(null); setInvoices([]); setStage('idle') }} className="text-slate-400 hover:text-red-500 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {errMsg && (
              <div className="flex items-start gap-3 mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-red-700">Parsing failed</p>
                  <p className="text-xs text-red-600 mt-0.5">{errMsg}</p>
                </div>
              </div>
            )}

            {file && stage !== 'done' && (
              <div className="mt-4">
                <button
                  onClick={handleImport}
                  disabled={stage === 'parsing'}
                  className="flex items-center gap-2 bg-[#0c1526] hover:bg-[#1a2640] disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors"
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
                    <span className={`text-sm font-bold ${confidenceColor(summary.avgConf)}`}>
                      {summary.avgConf}% avg confidence
                    </span>
                  )
                }
              />
              <CardDivider />

              {/* Confidence gauge */}
              {summary && (
                <div className="mb-5 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-slate-700">Normalization Confidence</p>
                    <span className={`text-sm font-bold ${confidenceColor(summary.avgConf)}`}>{summary.avgConf}%</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${confidenceBg(summary.avgConf)}`} style={{ width: `${summary.avgConf}%` }} />
                  </div>
                  <div className="flex items-center gap-6 mt-3 text-xs text-slate-500">
                    <span>{summary.total.toLocaleString()} records normalized</span>
                    {summary.reviewed > 0 && <span className="text-amber-600">{summary.reviewed} need review</span>}
                    {summary.dups > 0 && <span className="text-red-600">{summary.dups} duplicates flagged</span>}
                  </div>
                </div>
              )}

              {/* Field mapping table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left pb-2 pr-4 font-semibold text-slate-500 uppercase tracking-wide text-[10px]">Canonical Field</th>
                      <th className="text-left pb-2 pr-4 font-semibold text-slate-500 uppercase tracking-wide text-[10px]">Raw Column</th>
                      <th className="text-left pb-2 pr-4 font-semibold text-slate-500 uppercase tracking-wide text-[10px]">Sample Value</th>
                      <th className="text-left pb-2 font-semibold text-slate-500 uppercase tracking-wide text-[10px]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices[0].field_mappings.map((fm: FieldMapping) => (
                      <tr key={fm.canonical} className="border-b border-slate-50 last:border-0">
                        <td className="py-2 pr-4 font-mono text-slate-700">{fm.canonical}</td>
                        <td className="py-2 pr-4 font-mono text-emerald-700">{fm.raw_column || <span className="text-slate-400">—</span>}</td>
                        <td className="py-2 pr-4 text-slate-600 max-w-[180px] truncate" title={fm.sample_value}>
                          {fm.sample_value || <span className="text-slate-300">empty</span>}
                        </td>
                        <td className="py-2">
                          {fm.mapped ? (
                            <span className="inline-flex items-center gap-1 text-green-700 font-medium">
                              <CheckCircle className="w-3 h-3" /> Mapped
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-600 font-medium" title={fm.warning}>
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
              const icon = s.status === 'done'    ? <CheckCircle className="w-4 h-4 text-green-600" />
                         : s.status === 'warn'    ? <AlertCircle className="w-4 h-4 text-amber-600" />
                         : s.status === 'error'   ? <AlertCircle className="w-4 h-4 text-red-600" />
                         : s.status === 'running' ? <RefreshCw className="w-4 h-4 text-emerald-600 animate-spin" />
                         : <div className="w-4 h-4 rounded-full border-2 border-slate-300" />

              const bg = s.status === 'done'    ? 'bg-green-50 border-green-200'
                       : s.status === 'warn'    ? 'bg-amber-50 border-amber-200'
                       : s.status === 'error'   ? 'bg-red-50 border-red-200'
                       : s.status === 'running' ? 'bg-emerald-50 border-emerald-200'
                       : 'bg-slate-50 border-slate-200'

              return (
                <div key={s.id} className={`flex items-center gap-4 px-4 py-3 rounded-lg border ${bg}`}>
                  <div className="flex-shrink-0">{icon}</div>
                  <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-slate-600">{idx + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{s.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{s.detail || (s.status === 'pending' ? 'Waiting…' : '')}</p>
                  </div>
                  <span className="text-xs font-semibold capitalize text-slate-500">{s.status}</span>
                </div>
              )
            })}
          </div>

          {stage === 'done' && summary && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm font-semibold text-green-800">Import complete</p>
                  <p className="text-xs text-green-700 mt-0.5">
                    {summary.total.toLocaleString()} invoices normalized · {summary.avgConf}% avg confidence
                    {summary.reviewed > 0 ? ` · ${summary.reviewed} pending review` : ''}
                  </p>
                </div>
                <button
                  onClick={() => setTab('review')}
                  className="ml-auto text-xs text-green-700 font-semibold flex items-center gap-1"
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
              <span className="text-xs text-slate-500">{reviewQueue.length} item{reviewQueue.length !== 1 ? 's' : ''}</span>
            }
          />
          <CardDivider />

          {reviewQueue.length === 0 ? (
            <div className="py-16 flex flex-col items-center text-center">
              <CheckCircle className="w-10 h-10 text-green-400 mb-3" />
              <p className="text-slate-700 font-semibold">Review queue is empty</p>
              <p className="text-xs text-slate-400 mt-1">All imported invoices passed confidence thresholds.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Invoice', 'Vendor', 'Amount', 'Date', 'Confidence', 'Issues', 'Tier', 'Actions'].map(h => (
                      <th key={h} className="text-left pb-2.5 pr-3 font-semibold text-slate-500 uppercase tracking-wide text-[10px]">{h}</th>
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
                          className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer"
                          onClick={() => setExpandedRow(isExpanded ? null : inv.id)}
                        >
                          <td className="py-2.5 pr-3 font-mono text-slate-700">{inv.invoice_id.slice(0, 14)}…</td>
                          <td className="py-2.5 pr-3 font-medium text-slate-800 max-w-[140px] truncate">{inv.vendor_name || '—'}</td>
                          <td className="py-2.5 pr-3 font-semibold text-slate-700">{fmtCurrency(inv.invoice_total)}</td>
                          <td className="py-2.5 pr-3 text-slate-600">{inv.invoice_date || '—'}</td>
                          <td className="py-2.5 pr-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${confidenceBg(inv.normalization_confidence)}`} style={{ width: `${inv.normalization_confidence}%` }} />
                              </div>
                              <span className={`font-semibold ${confidenceColor(inv.normalization_confidence)}`}>{inv.normalization_confidence}%</span>
                            </div>
                          </td>
                          <td className="py-2.5 pr-3">
                            <div className="flex flex-wrap gap-1">
                              {inv.duplicate_flag && <span className="bg-red-50 border border-red-200 text-red-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">Duplicate</span>}
                              {inv.normalization_warnings.length > 0 && <span className="bg-amber-50 border border-amber-200 text-amber-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">{inv.normalization_warnings.length} warning{inv.normalization_warnings.length !== 1 ? 's' : ''}</span>}
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
                                className="bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 px-2.5 py-1 rounded text-[10px] font-semibold transition-colors"
                              >
                                Approve
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); handleReject(inv.id) }}
                                className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 px-2.5 py-1 rounded text-[10px] font-semibold transition-colors"
                              >
                                Reject
                              </button>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr key={`${inv.id}-expanded`}>
                            <td colSpan={8} className="pb-3 px-1">
                              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Record Detail</p>
                                  <button
                                    onClick={() => setShowRaw(showRaw === inv.id ? null : inv.id)}
                                    className="text-xs text-emerald-600 flex items-center gap-1"
                                  >
                                    <Eye className="w-3 h-3" />
                                    {showRaw === inv.id ? 'Normalized view' : 'Raw payload'}
                                  </button>
                                </div>

                                {showRaw === inv.id ? (
                                  <div className="font-mono text-[11px] text-slate-700 bg-white border border-slate-200 rounded p-3 overflow-x-auto">
                                    {Object.entries(inv.raw_invoice_payload).map(([k, v]) => (
                                      <div key={k} className="flex gap-4">
                                        <span className="text-emerald-600 w-32 flex-shrink-0">{k}</span>
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
                                      ['due_date', inv.due_date || '—'],
                                      ['payment_terms', inv.payment_terms],
                                      ['currency', inv.currency],
                                      ['department', inv.department || '—'],
                                      ['cost_center', inv.cost_center || '—'],
                                      ['source_system', inv.source_system],
                                      ['fiscal_year', String(inv.fiscal_year)],
                                      ['data_tier', tierLabel(inv.data_tier)],
                                      ['approval_status', inv.approval_status],
                                    ].map(([k, v]) => (
                                      <div key={k}>
                                        <p className="text-[10px] text-slate-400 font-mono">{k}</p>
                                        <p className="font-medium text-slate-800">{v}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {inv.normalization_warnings.length > 0 && (
                                  <div className="space-y-1">
                                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Warnings</p>
                                    {inv.normalization_warnings.map((w, i) => (
                                      <div key={i} className="flex items-start gap-2 text-xs text-amber-700">
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
              <History className="w-10 h-10 text-slate-300 mb-3" />
              <p className="text-slate-600 font-semibold">No imports yet</p>
              <p className="text-xs text-slate-400 mt-1">Go to the Import tab to ingest your first file.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Batch ID', 'File', 'Source', 'Records', 'Normalized', 'Avg Confidence', 'Review', 'Duplicates', 'Status', 'Date'].map(h => (
                      <th key={h} className="text-left pb-2.5 pr-4 font-semibold text-slate-500 uppercase tracking-wide text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {batches.map(b => (
                    <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-2.5 pr-4 font-mono text-slate-600 text-[10px]">{b.id}</td>
                      <td className="py-2.5 pr-4 text-slate-800 font-medium max-w-[140px] truncate">{b.file_name}</td>
                      <td className="py-2.5 pr-4 capitalize text-slate-600">{b.source}</td>
                      <td className="py-2.5 pr-4 font-semibold text-slate-700">{b.total_records.toLocaleString()}</td>
                      <td className="py-2.5 pr-4 text-slate-700">{b.normalized.toLocaleString()}</td>
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${confidenceBg(b.avg_confidence)}`} style={{ width: `${b.avg_confidence}%` }} />
                          </div>
                          <span className={`font-semibold ${confidenceColor(b.avg_confidence)}`}>{b.avg_confidence}%</span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-4">
                        {b.review_required > 0
                          ? <span className="text-amber-700 font-semibold">{b.review_required}</span>
                          : <span className="text-slate-400">0</span>}
                      </td>
                      <td className="py-2.5 pr-4">
                        {b.duplicates > 0
                          ? <span className="text-red-600 font-semibold">{b.duplicates}</span>
                          : <span className="text-slate-400">0</span>}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          b.status === 'complete' ? 'bg-green-50 border-green-200 text-green-700' :
                          b.status === 'partial'  ? 'bg-amber-50 border-amber-200 text-amber-700' :
                                                    'bg-red-50 border-red-200 text-red-700'
                        }`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-slate-500">
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
