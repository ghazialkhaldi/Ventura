// All types and localStorage access for user-uploaded data.
// Nothing here is ever populated with mock/hardcoded values.

// Re-export shared enums from sub-modules so pages only need one import
export type { StorageTier, ArchiveStatus, TierSummary, TierConfig } from './dataLayers'
export type { TestingMode, DataClassification, MaskableField, MaskingProfile } from './dataMasking'
export type { NormalizedInvoice, ImportBatch, FieldMapping, LineItem } from './invoiceNormalizer'

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
export type AnomalyStatus = 'Open' | 'Under Review' | 'Resolved' | 'Dismissed'
// A finding still needs a decision while it is Open or Under Review. Every
// "open" count in the app uses this, so the sidebar, dashboard and lists agree.
export const isUndecided = (a: { status: AnomalyStatus }) => a.status === 'Open' || a.status === 'Under Review'
// Used by Badge.tsx for workflow/integration status color mapping.
export type WorkflowStatus = 'On Track' | 'Warning' | 'Bottleneck' | 'Critical'
export type IntegrationStatus = 'Connected' | 'Disconnected' | 'Degraded' | 'Pending' | 'Not connected'
export type AnomalyType =
  | 'duplicate'
  | 'outlier'
  | 'large_amount'
  | 'round_number'
  | 'high_frequency'
  | 'missing_vendor'
  | 'approval_avoidance'
  | 'category_mismatch'
  | 'period_mismatch'
  | 'new_vendor_risk'

export interface StoredTransaction {
  id: string
  date: string       // YYYY-MM-DD
  vendor: string
  amount: number     // always positive
  description: string
  category: string
  account: string
  rowIndex: number
  // 'debit' = money paid out (spend). 'credit' = money received (refund, rebate,
  // reversal, deposit). Only meaningful when the source file had separate
  // Debit/Credit columns — a single combined Amount column is always spend.
  // Absent on data saved before this field existed; treat as 'debit'.
  direction?: 'debit' | 'credit'
  // Accounting-period label from the source file (e.g. "Jan-26"), when present.
  period?: string
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
  // Other rules that fired on the same rows, merged into this finding so the
  // reviewer sees one finding per event with every signal behind it.
  alsoMatched?: { type: AnomalyType; title: string; detail: string }[]
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
  // Accounting-period label column (e.g. "Period", "Posting period"), when present.
  period?:     string | null
}

export interface UploadedFile {
  name: string
  size: number
  rowCount: number
  parsedAt: string
}

export interface MonthlyEntry {
  key?: string    // "2026-01", for ordering; absent on data saved before it existed
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
  // Credits (refunds, rebates, reversals) found in Debit/Credit-column sources.
  // Excluded from totalSpend and anomaly detection — tracked here so nothing
  // is silently dropped. Absent/0 on data saved before this field existed.
  totalCredits?: number
  creditCount?: number
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

/**
 * The rows kept on the device: the first `limit` for browsing, plus every row a
 * finding cites, so a finding's evidence never points at a row that was dropped.
 */
export function keepEvidenceRows(rows: StoredTransaction[], anomalies: DetectedAnomaly[], limit = 100): StoredTransaction[] {
  const cited = new Set(anomalies.flatMap(a => a.rowRefs))
  const head  = rows.slice(0, limit)
  const kept  = new Set(head.map(r => r.id))
  return [...head, ...rows.filter(r => cited.has(r.id) && !kept.has(r.id))]
}

const DS_KEY      = 'sf_dataset'
const READY_KEY   = 'sf_data_ready'
const SOURCES_KEY = 'sf_source_datasets'

// ── Per-source storage ────────────────────────────────────────────────────────

/** Sort key for a month entry: its "YYYY-MM" key, or one read from a "Sep 2026" label on older data. */
function monthOrder(m: MonthlyEntry): string {
  if (m.key) return m.key
  const [mon, y] = m.month.split(' ')
  const i = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(mon.slice(0, 3))
  return i >= 0 && y ? `${y}-${String(i + 1).padStart(2, '0')}` : m.month
}

function mergeSourceDatasets(sources: Dataset[]): Dataset {
  if (sources.length === 0) {
    return {
      uploadedAt: new Date().toISOString(),
      files: [],
      columnMapping: { date: null, vendor: null, amount: null, debit: null, credit: null, description: null, category: null, account: null },
      totalTransactions: 0,
      totalSpend: 0,
      uniqueVendors: 0,
      dateRange: { from: '', to: '' },
      topVendors: [],
      categoryBreakdown: [],
      monthlyBreakdown: [],
      anomalies: [],
      auditLog: [],
      sampleTransactions: [],
    }
  }

  const vendorMap = new Map<string, VendorStat>()
  for (const src of sources) {
    for (const v of src.topVendors) {
      const ex = vendorMap.get(v.vendor)
      if (ex) { ex.total += v.total; ex.count += v.count; ex.avgAmount = ex.total / ex.count }
      else vendorMap.set(v.vendor, { ...v })
    }
  }

  const catMap = new Map<string, CategoryStat>()
  for (const src of sources) {
    for (const c of src.categoryBreakdown) {
      const ex = catMap.get(c.category)
      if (ex) { ex.total += c.total; ex.count += c.count }
      else catMap.set(c.category, { ...c })
    }
  }

  const monthMap = new Map<string, MonthlyEntry>()
  for (const src of sources) {
    for (const m of src.monthlyBreakdown) {
      const ex = monthMap.get(m.month)
      if (ex) { ex.spend += m.spend; ex.count += m.count }
      else monthMap.set(m.month, { ...m })
    }
  }

  const allDates = sources.flatMap(s => [s.dateRange.from, s.dateRange.to]).filter(Boolean).sort()

  return {
    uploadedAt: new Date().toISOString(),
    files:              sources.flatMap(s => s.files),
    columnMapping:      sources[0].columnMapping,
    totalTransactions:  sources.reduce((n, s) => n + s.totalTransactions, 0),
    totalSpend:         sources.reduce((n, s) => n + s.totalSpend, 0),
    totalCredits:       sources.reduce((n, s) => n + (s.totalCredits ?? 0), 0),
    creditCount:        sources.reduce((n, s) => n + (s.creditCount ?? 0), 0),
    uniqueVendors:      vendorMap.size,
    dateRange:          { from: allDates[0] ?? '', to: allDates[allDates.length - 1] ?? '' },
    topVendors:         [...vendorMap.values()].sort((a, b) => b.total - a.total).slice(0, 20),
    categoryBreakdown:  [...catMap.values()].sort((a, b) => b.total - a.total),
    monthlyBreakdown:   [...monthMap.values()].sort((a, b) => monthOrder(a).localeCompare(monthOrder(b))),
    anomalies:          sources.flatMap(s => s.anomalies),
    auditLog:           sources.flatMap(s => s.auditLog).sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 500),
    sampleTransactions: keepEvidenceRows(sources.flatMap(s => s.sampleTransactions), sources.flatMap(s => s.anomalies)),
  }
}

function loadSourceMap(): Record<string, Dataset> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(SOURCES_KEY)
    return raw ? (JSON.parse(raw) as Record<string, Dataset>) : {}
  } catch { return {} }
}

/** One source's own dataset (an upload or a connection), as last saved on this device. */
export function loadSourceDataset(sourceId: string): Dataset | null {
  if (typeof window === 'undefined') return null
  return loadSourceMap()[sourceId] ?? null
}

/** Every source's own dataset on this device, keyed by source. */
export function loadAllSourceDatasets(): Record<string, Dataset> {
  if (typeof window === 'undefined') return {}
  return loadSourceMap()
}

/**
 * A reviewer's decision on this device: written to the source the finding
 * came from (the record every later merge is rebuilt from) and to the
 * merged view, so the next upload or sync can never undo it.
 */
export function setFindingStatus(id: string, status: AnomalyStatus): boolean {
  if (typeof window === 'undefined') return false
  try {
    const map = loadSourceMap()
    let found = false
    for (const ds of Object.values(map)) {
      const f = ds.anomalies.find(a => a.id === id)
      if (f) { f.status = status; found = true }
    }
    if (found) {
      localStorage.setItem(SOURCES_KEY, JSON.stringify(map))
      return saveDataset(mergeSourceDatasets(Object.values(map)))
    }
    const ds = loadDataset()
    const f = ds?.anomalies.find(a => a.id === id)
    if (!ds || !f) return false
    f.status = status
    return saveDataset(ds)
  } catch { return false }
}

/** Replace every source on this device at once (loading the workspace from the server). */
export function replaceSourceDatasets(map: Record<string, Dataset>): boolean {
  if (typeof window === 'undefined') return false
  try {
    localStorage.setItem(SOURCES_KEY, JSON.stringify(map))
    const all = Object.values(map)
    if (all.length === 0) { clearDataset(); return true }
    return saveDataset(mergeSourceDatasets(all))
  } catch { return false }
}

export function saveSourceDataset(sourceId: string, ds: Dataset): boolean {
  if (typeof window === 'undefined') return false
  try {
    const map = loadSourceMap()
    map[sourceId] = ds
    localStorage.setItem(SOURCES_KEY, JSON.stringify(map))
    return saveDataset(mergeSourceDatasets(Object.values(map)))
  } catch { return false }
}

export function removeSourceDataset(sourceId: string): void {
  if (typeof window === 'undefined') return
  try {
    const map = loadSourceMap()
    delete map[sourceId]
    localStorage.setItem(SOURCES_KEY, JSON.stringify(map))
    const remaining = Object.values(map)
    if (remaining.length === 0) {
      clearDataset()
    } else {
      saveDataset(mergeSourceDatasets(remaining))
    }
  } catch {}
}

export function getConnectedSourceIds(): string[] {
  return Object.keys(loadSourceMap())
}

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
    localStorage.removeItem(SOURCES_KEY)
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
