import { useState, useEffect, useRef } from 'react'
import { X, Check, Loader2, Upload, AlertCircle, FileText, Clock, ExternalLink } from 'lucide-react'
import BrandIcon, { BrandKey } from './BrandIcon'
import { parseFile } from '../../lib/transactionParser'
import { runAnomalyDetection } from '../../lib/anomalyEngine'
import { saveSourceDataset } from '../../lib/dataStore'
import type { StoredTransaction, AuditEntry, Dataset, VendorStat, CategoryStat, MonthlyEntry } from '../../lib/dataStore'

export interface IntegrationConfig {
  id: string
  name: string
  brand: BrandKey
  authType: 'apikey' | 'tba' | 'file' | 'webhook'
  fields: FieldDef[]
  instructions?: {
    steps: string[]
    note?: string
    link?: { label: string; url: string }
  }
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
  // ── QuickBooks ────────────────────────────────────────────────────────────────
  'quickbooks': {
    id: 'quickbooks', name: 'QuickBooks Online', brand: 'quickbooks', authType: 'apikey',
    instructions: {
      steps: [
        'Go to developer.intuit.com and sign in (or create a free developer account).',
        'Click "Create an App" → select "QuickBooks Online and Payments".',
        'Under Keys & OAuth → Production, copy your Client ID and Client Secret.',
        'To find your Company/Realm ID: log in to QuickBooks Online. It appears in the URL as ?realmId=XXXXXXXXX.',
      ],
      link: { label: 'Open Intuit Developer Portal', url: 'https://developer.intuit.com/app/developer/homepage' },
    },
    fields: [
      { key: 'client_id',     label: 'Client ID',        type: 'text',     placeholder: 'ABcd1234...', required: true },
      { key: 'client_secret', label: 'Client Secret',    type: 'password', placeholder: '••••••••••••', required: true },
      { key: 'company_id',    label: 'Company / Realm ID', type: 'text',   placeholder: '123456789', required: true },
    ],
  },

  // ── Salesforce ────────────────────────────────────────────────────────────────
  'salesforce': {
    id: 'salesforce', name: 'Salesforce CRM', brand: 'salesforce', authType: 'apikey',
    instructions: {
      steps: [
        'In Salesforce, go to Setup → App Manager → New Connected App.',
        'Enable OAuth Settings, add "api" and "refresh_token" scopes, and save.',
        'Copy the Consumer Key (Client ID) and Consumer Secret from the app settings.',
        'Your Instance URL is the base URL of your Salesforce org (e.g. https://yourorg.my.salesforce.com).',
      ],
      link: { label: 'Open Salesforce Setup', url: 'https://login.salesforce.com' },
    },
    fields: [
      { key: 'instance_url',  label: 'Instance URL',    type: 'url',      placeholder: 'https://yourorg.my.salesforce.com', required: true },
      { key: 'client_id',     label: 'Consumer Key',    type: 'text',     placeholder: '3MVG9...', required: true },
      { key: 'client_secret', label: 'Consumer Secret', type: 'password', placeholder: '••••••••••••', required: true },
    ],
  },

  // ── Xero ──────────────────────────────────────────────────────────────────────
  'xero': {
    id: 'xero', name: 'Xero', brand: 'xero', authType: 'apikey',
    instructions: {
      steps: [
        'Go to developer.xero.com → My Apps → New App.',
        'Select "Web App", fill in the details, and save.',
        'Copy your Client ID from the Configuration tab.',
        'Click "Generate a secret" to get your Client Secret. Copy it immediately, as it won\'t be shown again.',
      ],
      note: 'Client Secret is shown only once. Copy it immediately after generating.',
      link: { label: 'Open Xero Developer Portal', url: 'https://developer.xero.com/myapps' },
    },
    fields: [
      { key: 'client_id',     label: 'Client ID',     type: 'text',     placeholder: 'UUID-...', required: true },
      { key: 'client_secret', label: 'Client Secret', type: 'password', placeholder: '••••••••••••', required: true },
    ],
  },

  // ── Gusto ─────────────────────────────────────────────────────────────────────
  'gusto': {
    id: 'gusto', name: 'Gusto', brand: 'gusto', authType: 'apikey',
    instructions: {
      steps: [
        'Go to dev.gusto.com and sign in or create a developer account.',
        'Create a new application and fill in the required details.',
        'Copy your Client ID and Client Secret from the application settings.',
      ],
      link: { label: 'Open Gusto Developer Portal', url: 'https://dev.gusto.com' },
    },
    fields: [
      { key: 'client_id',     label: 'Client ID',     type: 'text',     placeholder: '...', required: true },
      { key: 'client_secret', label: 'Client Secret', type: 'password', placeholder: '••••••••••••', required: true },
    ],
  },

  // ── Plaid ─────────────────────────────────────────────────────────────────────
  'plaid': {
    id: 'plaid', name: 'Plaid Bank Feeds', brand: 'plaid', authType: 'apikey',
    instructions: {
      steps: [
        'Log in to your Plaid Dashboard at dashboard.plaid.com.',
        'Go to Team Settings → Keys in the left sidebar.',
        'Copy your Client ID (always visible) and Secret key for your environment (Development or Production).',
      ],
      link: { label: 'Open Plaid Dashboard → Keys', url: 'https://dashboard.plaid.com/team/keys' },
    },
    fields: [
      { key: 'client_id', label: 'Client ID',  type: 'text',     placeholder: '5f3a...', required: true },
      { key: 'api_key',   label: 'Secret Key', type: 'password', placeholder: '••••••••••••', required: true },
    ],
  },

  // ── ADP ───────────────────────────────────────────────────────────────────────
  'adp': {
    id: 'adp', name: 'ADP Workforce Now', brand: 'adp', authType: 'apikey',
    instructions: {
      steps: [
        'Log in to the ADP Developer Portal at developers.adp.com → My Apps.',
        'Open your application and copy the Client ID and Client Secret from the Credentials tab.',
        'Find your Company Code in ADP Workforce Now under Company → Company Settings.',
      ],
      link: { label: 'Open ADP Developer Portal', url: 'https://developers.adp.com' },
    },
    fields: [
      { key: 'client_id',    label: 'Client ID',     type: 'text',     placeholder: 'ADP-CLIENT-ID', required: true },
      { key: 'api_key',      label: 'Client Secret', type: 'password', placeholder: '••••••••••••',  required: true },
      { key: 'company_code', label: 'Company Code',  type: 'text',     placeholder: 'ABC12', required: true },
    ],
  },

  // ── Stripe ────────────────────────────────────────────────────────────────────
  'stripe': {
    id: 'stripe', name: 'Stripe', brand: 'stripe', authType: 'apikey',
    instructions: {
      steps: [
        'Log in to your Stripe Dashboard at dashboard.stripe.com.',
        'Click Developers → API keys in the left sidebar.',
        'Copy your Secret key (sk_live_... for production, sk_test_... for testing).',
        'For tighter security, create a Restricted Key with read-only access to Charges and Customers.',
      ],
      link: { label: 'Open Stripe → API keys', url: 'https://dashboard.stripe.com/apikeys' },
    },
    fields: [
      { key: 'api_key', label: 'Secret Key', type: 'password', placeholder: 'sk_live_••••••••', required: true },
    ],
  },

  // ── Expensify ─────────────────────────────────────────────────────────────────
  'expensify': {
    id: 'expensify', name: 'Expensify', brand: 'expensify', authType: 'apikey',
    instructions: {
      steps: [
        'Log in to Expensify at expensify.com.',
        'Go to Settings → Account → Integrations → API.',
        'Copy your partnerUserID and partnerUserSecret from that page.',
      ],
      link: { label: 'Open Expensify → API Settings', url: 'https://www.expensify.com/tools/integrations/' },
    },
    fields: [
      { key: 'partner_user_id', label: 'Partner User ID', type: 'text',     placeholder: 'user@yourco.com', required: true },
      { key: 'api_key',         label: 'Partner Secret',  type: 'password', placeholder: '••••••••••••',   required: true },
    ],
  },

  // ── SAP ───────────────────────────────────────────────────────────────────────
  'sap': {
    id: 'sap', name: 'SAP S/4HANA', brand: 'sap', authType: 'apikey',
    instructions: {
      steps: [
        'In SAP BTP Cockpit, go to your subaccount → Services → Service Marketplace.',
        'Open your S/4HANA Cloud API instance and create or download a Service Key.',
        'Extract the API Key and System URL from the downloaded Service Key JSON file.',
        'If you don\'t have BTP access, ask your SAP BASIS administrator for the API Key and System URL.',
      ],
    },
    fields: [
      { key: 'api_key',    label: 'API Key',    type: 'password', placeholder: '••••••••••••', required: true },
      { key: 'system_url', label: 'System URL', type: 'url',      placeholder: 'https://your-sap.example.com', required: true },
    ],
  },

  // ── NetSuite ──────────────────────────────────────────────────────────────────
  'netsuite': {
    id: 'netsuite', name: 'NetSuite ERP', brand: 'netsuite', authType: 'tba',
    instructions: {
      steps: [
        'In NetSuite, go to Setup → Integrations → Manage Integrations → New. Enable Token-Based Authentication and save.',
        'Immediately copy the Consumer Key and Consumer Secret shown on the confirmation screen; they won\'t appear again.',
        'Go to Setup → Users/Roles → Access Tokens → New. Select your integration and assign a role, then save.',
        'Immediately copy the Token ID and Token Secret shown; they won\'t appear again.',
        'Find your Account ID in Setup → Company → Company Information.',
      ],
      note: 'Consumer Key/Secret and Token ID/Secret are each shown only once at creation. Copy them before closing.',
    },
    fields: [
      { key: 'account_id',      label: 'Account ID',      type: 'text',     placeholder: '1234567', required: true },
      { key: 'consumer_key',    label: 'Consumer Key',    type: 'password', placeholder: '••••••••••••', required: true },
      { key: 'consumer_secret', label: 'Consumer Secret', type: 'password', placeholder: '••••••••••••', required: true },
      { key: 'token_id',        label: 'Token ID',        type: 'password', placeholder: '••••••••••••', required: true },
      { key: 'token_secret',    label: 'Token Secret',    type: 'password', placeholder: '••••••••••••', required: true },
    ],
  },

  // ── Slack ─────────────────────────────────────────────────────────────────────
  'slack': {
    id: 'slack', name: 'Slack Notifications', brand: 'slack', authType: 'webhook',
    instructions: {
      steps: [
        'Go to api.slack.com/apps → Create New App → From Scratch.',
        'Under "Add features", click Incoming Webhooks and toggle it ON.',
        'Click "Add New Webhook to Workspace" and select the channel for Ventura alerts.',
        'Copy the generated Webhook URL (starts with https://hooks.slack.com/services/...).',
      ],
      link: { label: 'Open Slack App settings', url: 'https://api.slack.com/apps' },
    },
    fields: [
      { key: 'webhook_url', label: 'Webhook URL', type: 'url', placeholder: 'https://hooks.slack.com/services/...', required: true },
    ],
  },

  // ── File upload ───────────────────────────────────────────────────────────────
  'csv': {
    id: 'csv', name: 'CSV / Excel Import', brand: 'csv', authType: 'file',
    fields: [],
  },
  'documents': {
    id: 'documents', name: 'Document Upload', brand: 'documents', authType: 'file',
    fields: [],
  },
}

type ModalStep = 'configure' | 'processing' | 'connected' | 'error' | 'unavailable'

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
  const isFileType = config?.authType === 'file'

  const [step,         setStep]         = useState<ModalStep>('configure')
  const [values,       setValues]       = useState<Record<string, string>>({})
  const [error,        setError]        = useState('')
  const [dragOver,     setDragOver]     = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [statusMsg,    setStatusMsg]    = useState('')
  const [result,       setResult]       = useState<ProcessResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

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

    setStatusMsg(`Parsed ${parsed.rowCount.toLocaleString()} rows, detecting anomalies…`)
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
        detail: `${file.name}: ${parsed.rowCount.toLocaleString()} rows, ${txs.length.toLocaleString()} transactions, ${fmtBytes(file.size)}`,
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

    // ── File upload ────────────────────────────────────────────────────────────
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

    // ── Credential providers — validate then save encrypted ───────────────────
    for (const f of config.fields) {
      if (f.required && !values[f.key]?.trim()) {
        setError(`${f.label} is required.`)
        return
      }
    }

    setStep('processing')
    setStatusMsg('Encrypting and saving credentials…')

    try {
      const res = await fetch('/api/connections/save', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ provider: integrationId, credentials: values }),
      })
      const body = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) throw new Error(body.error ?? 'Failed to save connection')

      try {
        const stored = JSON.parse(localStorage.getItem('sf_connected') || '{}')
        stored[integrationId] = { connectedAt: new Date().toISOString(), status: 'Connected' }
        localStorage.setItem('sf_connected', JSON.stringify(stored))
      } catch { /* non-critical */ }

      setStep('connected')
      onConnected(integrationId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed.')
      setStep('error')
    }
  }

  const authLabel = config.authType === 'tba' ? 'Token-Based Auth'
    : config.authType === 'webhook' ? 'Webhook'
    : config.authType === 'file'    ? 'File Upload'
    : 'API Key'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={step === 'processing' ? undefined : onClose} />

      <div className="relative bg-surface-raised rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border flex-shrink-0">
          <BrandIcon brand={config.brand} size={32} contained />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary">
              {isFileType ? 'Upload File' : `Connect ${config.name}`}
            </p>
            <p className="text-[11px] text-text-muted">{authLabel}</p>
          </div>
          {step !== 'processing' && (
            <button onClick={onClose} className="text-text-muted hover:text-text-secondary transition-colors p-1 rounded">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Scrollable body */}
        <div className="px-5 py-5 overflow-y-auto flex-1">

          {/* ── Configure ── */}
          {step === 'configure' && (
            <>
              {/* Instructions */}
              {config.instructions && (
                <div className="mb-5">
                  <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-3">
                    How to get your credentials
                  </p>
                  <ol className="space-y-2.5 mb-3">
                    {config.instructions.steps.map((s, i) => (
                      <li key={i} className="flex gap-2.5 text-xs text-text-secondary leading-relaxed">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent-500/10 border border-accent-500/30 text-accent-400 text-[10px] font-bold flex items-center justify-center mt-0.5">
                          {i + 1}
                        </span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>

                  {config.instructions.note && (
                    <div className="text-[11px] bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 mb-3 leading-relaxed">
                      <span className="font-semibold text-amber-400">Note: </span>
                      <span className="text-amber-300">{config.instructions.note}</span>
                    </div>
                  )}

                  {config.instructions.link && (
                    <a
                      href={config.instructions.link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-accent-400 hover:text-accent-300 transition-colors mb-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {config.instructions.link.label}
                    </a>
                  )}

                  <div className="border-t border-border-subtle mt-4 mb-5" />
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-3.5 py-3 text-xs mb-4">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {isFileType ? (
                  <div
                    className={`border-2 border-dashed rounded-lg px-4 py-8 text-center transition-colors cursor-pointer ${dragOver ? 'border-emerald-400 bg-emerald-500/10' : 'border-border-strong hover:border-accent-500/50'}`}
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
                        <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-emerald-400" />
                        </div>
                        <p className="text-sm font-medium text-text-primary">{uploadedFile.name}</p>
                        <p className="text-xs text-text-muted">{fmtBytes(uploadedFile.size)} · Click to replace</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="w-7 h-7 text-text-muted" />
                        <p className="text-sm font-medium text-text-secondary">Drop file here or click to browse</p>
                        <p className="text-xs text-text-muted">CSV · XLSX · PDF · QBO · OFX · TSV</p>
                      </div>
                    )}
                  </div>
                ) : (
                  config.fields.map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                        {f.label}{f.required && <span className="text-red-400 ml-0.5">*</span>}
                      </label>
                      {f.type === 'select' ? (
                        <select
                          value={values[f.key] || ''}
                          onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                          className="w-full border border-border-strong rounded-lg px-3 py-2.5 text-sm text-text-primary bg-surface-raised focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
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
                          className="w-full border border-border-strong rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted bg-surface-raised focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 font-mono"
                        />
                      )}
                    </div>
                  ))
                )}

                <div className="pt-1 flex items-center gap-3">
                  <button
                    type="submit"
                    className="flex-1 bg-accent-500 hover:bg-accent-600 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
                  >
                    {isFileType ? 'Process file' : 'Save & Connect'}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary border border-border-strong rounded-lg hover:bg-surface-hover transition-colors"
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
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  {isFileType ? 'Processing your file…' : 'Saving connection…'}
                </p>
                <p className="text-xs text-text-muted mt-1">{statusMsg}</p>
              </div>
            </div>
          )}

          {/* ── Connected ── */}
          {step === 'connected' && (
            <div className="py-8 flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center">
                <Check className="w-7 h-7 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  {isFileType ? 'File processed' : `${config.name} connected`}
                </p>
                {result ? (
                  <p className="text-xs text-text-muted mt-1">
                    {result.txCount.toLocaleString()} transactions · {result.anomalyCount} anomal{result.anomalyCount !== 1 ? 'ies' : 'y'} detected
                  </p>
                ) : (
                  <p className="text-xs text-text-muted mt-1">Credentials saved. Initial sync will begin shortly</p>
                )}
              </div>
              <button
                onClick={() => { onClose(); window.location.href = '/dashboard' }}
                className="mt-2 bg-accent-500 hover:bg-accent-600 text-white font-semibold py-2.5 px-6 rounded-lg transition-colors text-sm"
              >
                {isFileType ? 'View dashboard' : 'Done'}
              </button>
            </div>
          )}

          {/* ── Unavailable ── */}
          {step === 'unavailable' && (
            <div className="py-8 flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-surface-overlay border-2 border-border flex items-center justify-center">
                <Clock className="w-7 h-7 text-text-muted" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">{config.name} coming soon</p>
                <p className="text-xs text-text-muted mt-2 max-w-xs leading-relaxed">
                  Contact{' '}
                  <a href="mailto:support@venturafinance.net" className="text-accent-400 hover:underline">
                    support@venturafinance.net
                  </a>{' '}
                  to enable {config.name} access on your account.
                </p>
              </div>
              <button onClick={onClose} className="mt-1 bg-accent-500 hover:bg-accent-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors text-sm">
                Close
              </button>
            </div>
          )}

          {/* ── Error ── */}
          {step === 'error' && (
            <div className="py-8 flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center">
                <AlertCircle className="w-7 h-7 text-red-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">Connection failed</p>
                <p className="text-xs text-red-400 mt-1 max-w-xs">{error}</p>
              </div>
              <button
                onClick={() => { setStep('configure'); setError('') }}
                className="mt-1 text-sm text-accent-400 hover:text-accent-300 underline"
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
