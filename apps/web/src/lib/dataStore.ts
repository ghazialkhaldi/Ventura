// All types and localStorage access for user-uploaded data.
// Nothing here is ever populated with mock/hardcoded values.

// Re-export shared enums from sub-modules so pages only need one import
export type { StorageTier, ArchiveStatus, TierSummary, TierConfig } from './dataLayers'
export type { TestingMode, DataClassification, MaskableField, MaskingProfile } from './dataMasking'
export type { NormalizedInvoice, ImportBatch, FieldMapping, LineItem } from './invoiceNormalizer'

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
export type AnomalyStatus = 'Open' | 'Under Review' | 'Resolved' | 'Dismissed'
export type AnomalyType =
  | 'duplicate'
  | 'outlier'
  | 'large_amount'
  | 'round_number'
  | 'high_frequency'
  | 'missing_vendor'

export interface StoredTransaction {
  id: string
  date: string       // YYYY-MM-DD
  vendor: string
  amount: number     // always positive
  description: string
  category: string
  account: string
  rowIndex: number
}

export interface DetectedAnomaly {
  id: string
  title: string
  type: AnomalyType
  vendor: string
  amount: number
  severity: Severity
  status: AnomalyStatus
  confidence: number        // 0–100
  detectedAt: string        // ISO
  description: string
  reasoning: string
  rowRefs: string[]         // transaction IDs involved
  category: string
  // Data architecture metadata (optional — populated when tier engine runs)
  dataTier?: 'hot' | 'warm' | 'cold'
  normalizationConfidence?: number
  sourceSystem?: string
  isMasked?: boolean
}

export interface AuditEntry {
  id: string
  ts: string
  actor: string
  event: string
  detail: string
  severity: 'info' | 'warning' | 'critical'
  resource: string
}

export interface VendorStat {
  vendor: string
  total: number
  count: number
  avgAmount: number
  category: string
}

export interface CategoryStat {
  category: string
  total: number
  count: number
}

export interface ColumnMapping {
  date:        string | null
  vendor:      string | null
  amount:      string | null
  debit:       string | null
  credit:      string | null
  description: string | null
  category:    string | null
  account:     string | null
}

export interface UploadedFile {
  name: string
  size: number
  rowCount: number
  parsedAt: string
}

export interface MonthlyEntry {
  month: string   // e.g. "Jan 2026"
  spend: number
  count: number
}

export interface Dataset {
  uploadedAt: string
  files: UploadedFile[]
  columnMapping: ColumnMapping
  totalTransactions: number
  totalSpend: number
  uniqueVendors: number
  dateRange: { from: string; to: string }
  topVendors: VendorStat[]
  categoryBreakdown: CategoryStat[]
  monthlyBreakdown: MonthlyEntry[]
  anomalies: DetectedAnomaly[]
  auditLog: AuditEntry[]
  sampleTransactions: StoredTransaction[]
  // Data architecture extensions (optional — populated after first upload)
  tierSummary?: import('./dataLayers').TierSummary
  testingMode?: import('./dataMasking').TestingMode
  lastScanTime?: string
  pendingReviewCount?: number
}

const DS_KEY   = 'sf_dataset'
const READY_KEY = 'sf_data_ready'

export function saveDataset(ds: Dataset): boolean {
  try {
    localStorage.setItem(DS_KEY, JSON.stringify(ds))
    localStorage.setItem(READY_KEY, 'true')
    return true
  } catch {
    // Storage quota — save without sample transactions
    try {
      localStorage.setItem(DS_KEY, JSON.stringify({ ...ds, sampleTransactions: [] }))
      localStorage.setItem(READY_KEY, 'true')
      return true
    } catch {
      return false
    }
  }
}

export function loadDataset(): Dataset | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(DS_KEY)
    return raw ? (JSON.parse(raw) as Dataset) : null
  } catch {
    return null
  }
}

export function clearDataset(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(DS_KEY)
    localStorage.removeItem(READY_KEY)
    localStorage.removeItem('sf_connected')
  } catch {}
}

export function appendAuditEntry(entry: Omit<AuditEntry, 'id' | 'ts'>): void {
  if (typeof window === 'undefined') return
  try {
    const ds = loadDataset()
    if (!ds) return
    const newEntry: AuditEntry = {
      id: `AUD-${Date.now()}`,
      ts: new Date().toISOString(),
      ...entry,
    }
    ds.auditLog = [newEntry, ...ds.auditLog].slice(0, 500)
    saveDataset(ds)
  } catch {}
}
