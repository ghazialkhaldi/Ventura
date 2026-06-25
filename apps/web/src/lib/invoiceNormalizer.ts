import type { StoredTransaction, ColumnMapping } from './dataStore'
import { getTierForDate, type StorageTier } from './dataLayers'

export type InvoiceApprovalStatus = 'approved' | 'pending' | 'rejected' | 'unknown'
export type InvoicePaymentStatus  = 'paid' | 'unpaid' | 'overdue' | 'partial' | 'unknown'

export interface LineItem {
  description:   string
  quantity:      number
  unit_price:    number
  total:         number
  account_code?: string
}

export interface FieldMapping {
  canonical:    string        // canonical field name
  raw_column:   string | null // original CSV header
  sample_value: string        // example value from row 0
  mapped:       boolean       // was a raw column found?
  confidence:   number        // 0–1
  warning?:     string
}

export interface NormalizedInvoice {
  id:                       string
  import_batch:             string
  source_system:            string
  raw_invoice_payload:      Record<string, string>
  field_mappings:           FieldMapping[]

  // Canonical financial schema
  vendor_name:              string
  invoice_id:               string
  invoice_total:            number
  invoice_date:             string
  due_date:                 string
  payment_terms:            string
  currency:                 string
  department:               string
  cost_center:              string
  approval_status:          InvoiceApprovalStatus
  payment_status:           InvoicePaymentStatus
  line_items:               LineItem[]
  tax_amount:               number

  // Normalization metadata
  normalization_confidence: number   // 0–100
  normalization_warnings:   string[]
  duplicate_flag:           boolean
  duplicate_of?:            string
  review_required:          boolean
  normalized_at:            string

  // Data tier
  data_tier:                StorageTier
  fiscal_year:              number
}

export interface ImportBatch {
  id:              string
  created_at:      string
  source:          string
  file_name:       string
  total_records:   number
  normalized:      number
  review_required: number
  duplicates:      number
  avg_confidence:  number
  status:          'complete' | 'partial' | 'failed'
}

const BATCH_KEY   = 'sf_import_batches'
const INVOICE_KEY = 'sf_normalized_invoices'

// ─── Confidence scoring ───────────────────────────────────────────────────────

const REQUIRED: (keyof NormalizedInvoice)[] = ['vendor_name', 'invoice_total', 'invoice_date']
const WEIGHTED_OPTIONAL: Array<{ field: keyof NormalizedInvoice; weight: number }> = [
  { field: 'invoice_id',     weight: 2 },
  { field: 'due_date',       weight: 1 },
  { field: 'department',     weight: 2 },
  { field: 'cost_center',    weight: 1 },
  { field: 'payment_terms',  weight: 1 },
  { field: 'currency',       weight: 1 },
]

function computeConfidence(inv: NormalizedInvoice): number {
  let score = 0, total = 0

  for (const f of REQUIRED) {
    total += 4
    const v = inv[f]
    if (v !== undefined && v !== null && String(v) !== '' && String(v) !== '0' && v !== 'unknown') score += 4
  }

  for (const { field, weight } of WEIGHTED_OPTIONAL) {
    total += weight
    const v = inv[field]
    if (v !== undefined && v !== null && String(v) !== '' && v !== 'unknown') score += weight
  }

  return total > 0 ? Math.round((score / total) * 100) : 0
}

// ─── Due date inference ───────────────────────────────────────────────────────

function inferDueDate(invoiceDate: string, terms: string): string {
  if (!invoiceDate) return ''
  const d = new Date(invoiceDate)
  if (isNaN(d.getTime())) return ''
  const match = terms.toLowerCase().match(/net\s*(\d+)/)
  d.setDate(d.getDate() + (match ? parseInt(match[1]) : 30))
  return d.toISOString().split('T')[0]
}

// ─── Normalization ────────────────────────────────────────────────────────────

export function normalizeTransaction(
  tx: StoredTransaction,
  mapping: ColumnMapping,
  batchId: string,
  source = 'csv',
): NormalizedInvoice {
  const warnings: string[] = []

  if (!tx.vendor || tx.vendor.trim() === '')
    warnings.push('Vendor name is missing — counterparty cannot be identified')
  if (!tx.date)
    warnings.push('Invoice date is missing — aging and filing will be incorrect')
  if (tx.amount <= 0)
    warnings.push('Invoice total is zero or negative — verify source record')

  const paymentTerms = 'Net 30'
  const dueDate      = inferDueDate(tx.date, paymentTerms)

  const rawPayload: Record<string, string> = {}
  if (mapping.vendor)      rawPayload[mapping.vendor]      = tx.vendor
  if (mapping.amount)      rawPayload[mapping.amount]      = String(tx.amount)
  if (mapping.date)        rawPayload[mapping.date]        = tx.date
  if (mapping.category)    rawPayload[mapping.category]    = tx.category
  if (mapping.description) rawPayload[mapping.description] = tx.description
  if (mapping.account)     rawPayload[mapping.account]     = tx.account

  const fieldMappings: FieldMapping[] = [
    { canonical: 'vendor_name',   raw_column: mapping.vendor,                   sample_value: tx.vendor,        mapped: !!mapping.vendor,                   confidence: mapping.vendor ? 1.0 : 0 },
    { canonical: 'invoice_total', raw_column: mapping.amount ?? mapping.debit,  sample_value: String(tx.amount),mapped: !!(mapping.amount || mapping.debit), confidence: mapping.amount ? 1.0 : 0.7 },
    { canonical: 'invoice_date',  raw_column: mapping.date,                     sample_value: tx.date,          mapped: !!mapping.date,                     confidence: mapping.date ? 1.0 : 0 },
    { canonical: 'department',    raw_column: mapping.category,                 sample_value: tx.category,      mapped: !!mapping.category,                 confidence: mapping.category ? 0.9 : 0 },
    { canonical: 'description',   raw_column: mapping.description,              sample_value: tx.description,   mapped: !!mapping.description,              confidence: mapping.description ? 0.85 : 0 },
    { canonical: 'cost_center',   raw_column: mapping.account,                  sample_value: tx.account,       mapped: !!mapping.account,                  confidence: mapping.account ? 0.7 : 0 },
    { canonical: 'invoice_id',    raw_column: null, sample_value: tx.id,        mapped: false, confidence: 0.4, warning: 'No dedicated invoice ID column — using row ID' },
    { canonical: 'due_date',      raw_column: null, sample_value: dueDate,      mapped: false, confidence: 0.5, warning: 'Inferred from Net 30 default payment terms' },
    { canonical: 'payment_terms', raw_column: null, sample_value: paymentTerms, mapped: false, confidence: 0.3, warning: 'Defaulted to Net 30' },
    { canonical: 'currency',      raw_column: null, sample_value: 'USD',        mapped: false, confidence: 0.8, warning: 'Defaulted to USD — no currency column detected' },
    { canonical: 'tax_amount',    raw_column: null, sample_value: '0',          mapped: false, confidence: 0,   warning: 'No tax column detected' },
  ]

  const d   = tx.date ? new Date(tx.date) : new Date()
  const fy  = isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear()
  const inv: NormalizedInvoice = {
    id:                       `INV-${batchId}-${tx.id}`,
    import_batch:             batchId,
    source_system:            source,
    raw_invoice_payload:      rawPayload,
    field_mappings:           fieldMappings,

    vendor_name:              tx.vendor  || '',
    invoice_id:               tx.id,
    invoice_total:            tx.amount,
    invoice_date:             tx.date    || '',
    due_date:                 dueDate,
    payment_terms:            paymentTerms,
    currency:                 'USD',
    department:               tx.category    || '',
    cost_center:              tx.account     || '',
    approval_status:          'unknown',
    payment_status:           'unknown',
    line_items:               [{
      description:  tx.description || tx.vendor || 'Invoice',
      quantity:     1,
      unit_price:   tx.amount,
      total:        tx.amount,
    }],
    tax_amount:               0,

    normalization_confidence: 0,
    normalization_warnings:   warnings,
    duplicate_flag:           false,
    review_required:          false,
    normalized_at:            new Date().toISOString(),

    data_tier:                getTierForDate(tx.date),
    fiscal_year:              fy,
  }

  inv.normalization_confidence = computeConfidence(inv)
  inv.review_required = inv.normalization_confidence < 60 || warnings.length >= 2

  return inv
}

export function normalizeTransactions(
  txs: StoredTransaction[],
  mapping: ColumnMapping,
  batchId: string,
  source = 'csv',
): NormalizedInvoice[] {
  const invoices = txs.map(tx => normalizeTransaction(tx, mapping, batchId, source))
  return detectInvoiceDuplicates(invoices)
}

export function detectInvoiceDuplicates(invoices: NormalizedInvoice[]): NormalizedInvoice[] {
  const seen = new Map<string, string>()
  return invoices.map(inv => {
    const key = `${inv.vendor_name.toLowerCase()}|${inv.invoice_total.toFixed(2)}|${inv.invoice_date}`
    if (seen.has(key)) {
      const firstId = seen.get(key)!
      return {
        ...inv,
        duplicate_flag:           true,
        duplicate_of:             firstId,
        review_required:          true,
        normalization_warnings:   [...inv.normalization_warnings, `Possible duplicate of ${firstId}`],
      }
    }
    seen.set(key, inv.id)
    return inv
  })
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

export function loadImportBatches(): ImportBatch[] {
  if (typeof window === 'undefined') return []
  try {
    const s = localStorage.getItem(BATCH_KEY)
    return s ? (JSON.parse(s) as ImportBatch[]) : []
  } catch { return [] }
}

export function saveImportBatch(batch: ImportBatch, invoices: NormalizedInvoice[]): void {
  if (typeof window === 'undefined') return
  try {
    const batches = loadImportBatches()
    batches.unshift(batch)
    localStorage.setItem(BATCH_KEY, JSON.stringify(batches.slice(0, 50)))

    const existing   = loadNormalizedInvoices().filter(i => i.import_batch !== batch.id)
    const combined   = [...invoices, ...existing].slice(0, 5000)
    localStorage.setItem(INVOICE_KEY, JSON.stringify(combined))
  } catch {}
}

export function loadNormalizedInvoices(batchId?: string): NormalizedInvoice[] {
  if (typeof window === 'undefined') return []
  try {
    const s    = localStorage.getItem(INVOICE_KEY)
    const all  = s ? (JSON.parse(s) as NormalizedInvoice[]) : []
    return batchId ? all.filter(i => i.import_batch === batchId) : all
  } catch { return [] }
}

export function getReviewQueue(): NormalizedInvoice[] {
  return loadNormalizedInvoices().filter(i => i.review_required || i.duplicate_flag)
}

export function approveInvoice(id: string): void {
  if (typeof window === 'undefined') return
  try {
    const all = loadNormalizedInvoices()
    const updated = all.map(i =>
      i.id === id ? { ...i, review_required: false, approval_status: 'approved' as InvoiceApprovalStatus } : i
    )
    localStorage.setItem(INVOICE_KEY, JSON.stringify(updated))
  } catch {}
}

export function rejectInvoice(id: string): void {
  if (typeof window === 'undefined') return
  try {
    const all = loadNormalizedInvoices()
    const updated = all.map(i =>
      i.id === id ? { ...i, review_required: false, approval_status: 'rejected' as InvoiceApprovalStatus } : i
    )
    localStorage.setItem(INVOICE_KEY, JSON.stringify(updated))
  } catch {}
}

export function generateBatchId(): string {
  return `BATCH-${Date.now().toString(36).toUpperCase()}`
}
