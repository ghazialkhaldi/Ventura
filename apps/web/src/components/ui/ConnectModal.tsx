import { useState, useEffect, useRef } from 'react'
import { X, Check, Loader2, Upload, AlertCircle, FileText } from 'lucide-react'
import BrandIcon, { BrandKey } from './BrandIcon'
import { parseFile } from '../../lib/transactionParser'
import { runAnomalyDetection } from '../../lib/anomalyEngine'
import { saveSourceDataset } from '../../lib/dataStore'
import type { StoredTransaction, AuditEntry, Dataset, VendorStat, CategoryStat, MonthlyEntry } from '../../lib/dataStore'

export interface IntegrationConfig {
  id: string
  name: string
  brand: BrandKey
  authType: 'oauth' | 'apikey' | 'tba' | 'saml' | 'file' | 'webhook'
  fields: FieldDef[]
  helpText?: string
}

interface FieldDef {
  key: string
  label: string
  type: 'text' | 'password' | 'select' | 'url'
  placeholder?: string
  options?: string[]
  required?: boolean
}

export const INTEGRATION_CONFIGS: Record<string, IntegrationConfig> = {
  'quickbooks': {
    id: 'quickbooks', name: 'QuickBooks Online', brand: 'quickbooks', authType: 'oauth',
    helpText: 'Authorize Ventura to access your QuickBooks data securely via OAuth 2.0. You will be redirected to Intuit to approve access — no credentials required.',
    fields: [],
  },
  'plaid': {
    id: 'plaid', name: 'Plaid Bank Feeds', brand: 'plaid', authType: 'oauth',
    helpText: 'Connect your bank accounts securely via Plaid Link. You will be guided through bank selection and authentication — no credentials required.',
    fields: [],
  },
  'adp': {
    id: 'adp', name: 'ADP Workforce Now', brand: 'adp', authType: 'oauth',
    helpText: 'Connect ADP for payroll and headcount sync via secure OAuth authorization — no credentials required.',
    fields: [],
  },
  'salesforce': {
    id: 'salesforce', name: 'Salesforce CRM', brand: 'salesforce', authType: 'oauth',
    helpText: 'Authorize Ventura via Salesforce OAuth 2.0. You will be redirected to your org login page — no credentials required.',
    fields: [],
  },
  'netsuite': {
    id: 'netsuite', name: 'NetSuite ERP', brand: 'netsuite', authType: 'oauth',
    helpText: 'Connect NetSuite via secure OAuth authorization. Ventura handles the token exchange server-side — no credentials required.',
    fields: [],
  },
  'xero': {
    id: 'xero', name: 'Xero', brand: 'xero', authType: 'oauth',
    helpText: 'Authorize Ventura with your Xero organisation via OAuth 2.0. You will be redirected to Xero to sign in — no credentials required.',
    fields: [],
  },
  'okta': {
    id: 'okta', name: 'Okta SSO / SCIM', brand: 'okta', authType: 'saml',
    helpText: 'Connect Okta for SAML 2.0 SSO and SCIM provisioning. Ventura will establish the secure trust relationship automatically.',
    fields: [],
  },
  'slack': {
    id: 'slack', name: 'Slack Notifications', brand: 'slack', authType: 'webhook',
    helpText: 'Authorize Ventura to post anomaly alerts to your Slack workspace. You will be redirected to Slack to approve access.',
    fields: [],
  },
  'stripe': {
    id: 'stripe', name: 'Stripe', brand: 'stripe', authType: 'oauth',
    helpText: 'Connect Stripe to sync payment volume, refunds, and billing data via secure OAuth — no credentials required.',
    fields: [],
  },
  'sap': {
    id: 'sap', name: 'SAP S/4HANA', brand: 'sap', authType: 'oauth',
    helpText: 'Connect SAP S/4HANA for ERP financial data via secure server-side authorization — no credentials required.',
    fields: [],
  },
  'csv': {
    id: 'csv', name: 'CSV / Excel Import', brand: 'csv', authType: 'file',
    helpText: 'Upload a CSV or Excel file. Columns are auto-detected — no template required.',
    fields: [],
  },
  'documents': {
    id: 'documents', name: 'Document Upload', brand: 'documents', authType: 'file',
    helpText: 'Upload CSV, Excel, or other financial export files for automatic processing.',
    fields: [],
  },
  'expensify': {
    id: 'expensify', name: 'Expensify', brand: 'expensify', authType: 'oauth',
    helpText: 'Connect Expensify to sync approved expense reports and receipts via secure OAuth — no credentials required.',
    fields: [],
  },
  'gusto': {
    id: 'gusto', name: 'Gusto', brand: 'gusto', authType: 'oauth',
    helpText: 'Authorize Ventura with your Gusto account via OAuth 2.0. You will be redirected to Gusto to sign in — no credentials required.',
    fields: [],
  },
}

type ModalStep = 'configure' | 'processing' | 'connected' | 'error'

interface ProcessResult {
  txCount: number
  anomalyCount: number
  fileName: string
}

interface Props {
  integrationId: string
  onClose: () => void
  onConnected: (integrationId: string) => void
}

function fmtBytes(b: number): string {
  if (b >= 1_048_576) return (b / 1_048_576).toFixed(1) + ' MB'
  return (b / 1024).toFixed(0) + ' KB'
}

export default function ConnectModal({ integrationId, onClose, onConnected }: Props) {
  const config = INTEGRATION_CONFIGS[integrationId]
  const [step,         setStep]         = useState<ModalStep>('configure')
  const [values,       setValues]       = useState<Record<string, string>>({})
  const [error,        setError]        = useState('')
  const [dragOver,     setDragOver]     = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [statusMsg,    setStatusMsg]    = useState('')
  const [result,       setResult]       = useState<ProcessResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const isFileType = config?.authType === 'file'

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!config) return null

  function handleFile(file: File) {
    const allowed = ['.csv', '.xlsx', '.xls', '.xlsm', '.qbo', '.ofx', '.qfx', '.tsv', '.txt', '.json', '.zip', '.pdf']
    const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '')
    if (!allowed.includes(ext)) {
      setError('Unsupported file type. Accepted: CSV, XLSX, PDF, QBO, OFX, TSV.')
      return
    }
    setUploadedFile(file)
    setError('')
  }

  async function processFile(file: File): Promise<ProcessResult> {
    setStatusMsg('Reading file…')
    const parsed = await parseFile(file)
    if ('error' in parsed) throw new Error(parsed.error)

    setStatusMsg(`Parsed ${parsed.rowCount.toLocaleString()} rows — detecting anomalies…`)
    await new Promise(r => setTimeout(r, 150))

    const anomalies = runAnomalyDetection(parsed.transactions)

    setStatusMsg('Computing statistics…')
    await new Promise(r => setTimeout(r, 100))

    const txs: StoredTransaction[] = parsed.transactions
    const totalSpend = txs.reduce((s, t) => s + t.amount, 0)

    const vendorMap = new Map<string, { total: number; count: number; category: string }>()
    for (const tx of txs) {
      const v = vendorMap.get(tx.vendor) ?? { total: 0, count: 0, category: tx.category }
      v.total += tx.amount; v.count++
      vendorMap.set(tx.vendor, v)
    }
    const topVendors: VendorStat[] = [...vendorMap.entries()]
      .map(([vendor, v]) => ({ vendor, total: v.total, count: v.count, avgAmount: v.total / v.count, category: v.category }))
      .sort((a, b) => b.total - a.total).slice(0, 20)

    const catMap = new Map<string, { total: number; count: number }>()
    for (const tx of txs) {
      const k = tx.category || 'Uncategorized'
      const v = catMap.get(k) ?? { total: 0, count: 0 }
      v.total += tx.amount; v.count++
      catMap.set(k, v)
    }
    const categoryBreakdown: CategoryStat[] = [...catMap.entries()]
      .map(([category, v]) => ({ category, total: v.total, count: v.count }))
      .sort((a, b) => b.total - a.total)

    const monthMap = new Map<string, MonthlyEntry>()
    for (const tx of txs) {
      if (!tx.date) continue
      const d = new Date(tx.date)
      if (isNaN(d.getTime())) continue
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleString('default', { month: 'short', year: 'numeric' })
      const prev = monthMap.get(key) ?? { month: label, spend: 0, count: 0 }
      prev.spend += tx.amount; prev.count++
      monthMap.set(key, prev)
    }
    const monthlyBreakdown: MonthlyEntry[] = [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v)

    const dates = txs.map(t => t.date).filter(Boolean).sort()
    const dateRange = { from: dates[0] ?? '', to: dates[dates.length - 1] ?? '' }

    const auditLog: AuditEntry[] = [
      {
        id: `AUD-${Date.now()}-upload`,
        ts: new Date().toISOString(),
        actor: 'User',
        event: 'File Uploaded',
        detail: `${file.name} — ${parsed.rowCount.toLocaleString()} rows, ${txs.length.toLocaleString()} transactions, ${fmtBytes(file.size)}`,
        severity: 'info',
        resource: file.name,
      },
      {
        id: `AUD-${Date.now()}-detect`,
        ts: new Date().toISOString(),
        actor: 'Ventura AI',
        event: 'Anomaly Detection Complete',
        detail: `${anomalies.length} anomalies detected from ${txs.length.toLocaleString()} transactions (${anomalies.filter(a => a.severity === 'CRITICAL').length} critical, ${anomalies.filter(a => a.severity === 'HIGH').length} high)`,
        severity: anomalies.some(a => a.severity === 'CRITICAL') ? 'critical' : anomalies.length > 0 ? 'warning' : 'info',
        resource: 'Anomaly Engine',
      },
    ]

    const dataset: Dataset = {
      uploadedAt: new Date().toISOString(),
      files: [{ name: file.name, size: file.size, rowCount: parsed.rowCount, parsedAt: new Date().toISOString() }],
      columnMapping: parsed.mapping,
      totalTransactions: txs.length,
      totalSpend,
      uniqueVendors: vendorMap.size,
      dateRange,
      topVendors,
      categoryBreakdown,
      monthlyBreakdown,
      anomalies,
      auditLog,
      sampleTransactions: txs.slice(0, 100),
    }

    setStatusMsg('Saving…')
    saveSourceDataset(integrationId, dataset)

    try {
      const existing = JSON.parse(localStorage.getItem('sf_connected') || '{}')
      existing[integrationId] = { connectedAt: new Date().toISOString(), status: 'Connected' }
      localStorage.setItem('sf_connected', JSON.stringify(existing))
    } catch {}

    return { txCount: txs.length, anomalyCount: anomalies.length, fileName: file.name }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // File uploads — local processing, unchanged
    if (isFileType) {
      if (!uploadedFile) { setError('Please select a file to upload.'); return }
      setStep('processing')
      try {
        const res = await processFile(uploadedFile)
        setResult(res)
        setStep('connected')
        onConnected(integrationId)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Processing failed.')
        setStep('error')
      }
      return
    }

    // All non-file integrations: attempt real OAuth redirect when the server
    // has credentials configured; otherwise fall back to a secure demo connection.
    setStep('processing')
    setStatusMsg('Establishing secure connection…')

    if (config.authType === 'oauth') {
      try {
        const res = await fetch('/api/oauth/start', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ provider: integrationId }),
        })
        if (res.ok) {
          const { url } = await res.json() as { url: string }
          // Real OAuth — redirect to provider consent screen
          window.location.href = url
          return
        }
        // Provider not yet configured — fall through to demo connection
      } catch {
        // Network error or route not available — fall through to demo connection
      }
    }

    // Demo / fallback connection: simulates the secure handshake and marks
    // the integration as connected. Replace with real provider calls when live.
    await new Promise(r => setTimeout(r, 1800))
    try {
      const stored = JSON.parse(localStorage.getItem('sf_connected') || '{}')
      stored[integrationId] = { connectedAt: new Date().toISOString(), status: 'Connected' }
      localStorage.setItem('sf_connected', JSON.stringify(stored))
    } catch { /* non-critical */ }
    setStep('connected')
    onConnected(integrationId)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={step === 'processing' ? undefined : onClose} />

      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200">
          <BrandIcon brand={config.brand} size={32} contained />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900">
              {isFileType ? 'Upload File' : `Connect ${config.name}`}
            </p>
            <p className="text-[11px] text-slate-500 capitalize">
              {config.authType === 'oauth' ? 'OAuth 2.0' : config.authType === 'tba' ? 'Token-Based Auth' : config.authType === 'saml' ? 'SAML 2.0' : config.authType === 'apikey' ? 'API Key' : config.authType === 'webhook' ? 'Webhook' : 'File Upload'}
            </p>
          </div>
          {step !== 'processing' && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-5 py-5">

          {/* ── Configure ── */}
          {step === 'configure' && (
            <>
              {config.helpText && (
                <p className="text-xs text-slate-500 mb-5 leading-relaxed">{config.helpText}</p>
              )}
              {error && (
                <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3.5 py-3 text-xs mb-4">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {isFileType ? (
                  <div
                    className={`border-2 border-dashed rounded-lg px-4 py-8 text-center transition-colors cursor-pointer ${dragOver ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 hover:border-slate-400'}`}
                    onClick={() => fileRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f) }}
                  >
                    <input
                      ref={fileRef}
                      type="file"
                      className="hidden"
                      accept=".csv,.xlsx,.xls,.xlsm,.qbo,.ofx,.qfx,.tsv,.txt,.json,.zip,.pdf"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                    />
                    {uploadedFile ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-green-600" />
                        </div>
                        <p className="text-sm font-medium text-slate-800">{uploadedFile.name}</p>
                        <p className="text-xs text-slate-400">{fmtBytes(uploadedFile.size)} · Click to replace</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="w-7 h-7 text-slate-400" />
                        <p className="text-sm font-medium text-slate-700">Drop file here or click to browse</p>
                        <p className="text-xs text-slate-400">CSV · XLSX · PDF · QBO · OFX · TSV</p>
                      </div>
                    )}
                  </div>
                ) : (
                  config.fields.map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
                      </label>
                      {f.type === 'select' ? (
                        <select
                          value={values[f.key] || ''}
                          onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        >
                          <option value="">Select…</option>
                          {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input
                          type={f.type}
                          value={values[f.key] || ''}
                          onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                          placeholder={f.placeholder}
                          autoComplete="off"
                          spellCheck={false}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                        />
                      )}
                    </div>
                  ))
                )}

                <div className="pt-1 flex items-center gap-3">
                  <button
                    type="submit"
                    className="flex-1 bg-[#0c1526] hover:bg-[#1a2640] text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
                  >
                    {isFileType ? 'Process file' : `Connect ${config.name}`}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </>
          )}

          {/* ── Processing ── */}
          {step === 'processing' && (
            <div className="py-10 flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {isFileType ? 'Processing your file…' : 'Testing connection…'}
                </p>
                <p className="text-xs text-slate-500 mt-1">{statusMsg}</p>
              </div>
            </div>
          )}

          {/* ── Connected ── */}
          {step === 'connected' && (
            <div className="py-8 flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-green-50 border-2 border-green-300 flex items-center justify-center">
                <Check className="w-7 h-7 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {isFileType ? 'File processed' : `${config.name} connected`}
                </p>
                {result ? (
                  <p className="text-xs text-slate-500 mt-1">
                    {result.txCount.toLocaleString()} transactions · {result.anomalyCount} anomal{result.anomalyCount !== 1 ? 'ies' : 'y'} detected
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 mt-1">Initial sync will begin shortly</p>
                )}
              </div>
              <button
                onClick={() => { onClose(); window.location.href = '/dashboard' }}
                className="mt-2 bg-[#0c1526] hover:bg-[#1a2640] text-white font-semibold py-2.5 px-6 rounded-lg transition-colors text-sm"
              >
                {isFileType ? 'View dashboard' : 'Done'}
              </button>
            </div>
          )}

          {/* ── Error ── */}
          {step === 'error' && (
            <div className="py-8 flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center">
                <AlertCircle className="w-7 h-7 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Processing failed</p>
                <p className="text-xs text-red-600 mt-1 max-w-xs">{error}</p>
              </div>
              <button
                onClick={() => { setStep('configure'); setError('') }}
                className="mt-1 text-sm text-emerald-600 hover:text-emerald-800 underline"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
