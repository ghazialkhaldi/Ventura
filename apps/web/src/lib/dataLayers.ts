import type { StoredTransaction } from './dataStore'

export type StorageTier   = 'hot' | 'warm' | 'cold'
export type ArchiveStatus = 'active' | 'archiving' | 'archived'

export interface TierConfig {
  hotCutoffYear:  number   // current year → hot
  warmCutoffYear: number   // down to this year → warm; older → cold
}

export interface TierBand {
  count:              number
  totalSpend:         number
  dateRange:          string
  estimatedQueryMs:   number
}

export interface TierSummary {
  hot:            TierBand
  warm:           TierBand
  cold:           TierBand
  fiscalYear:     number
  lastScannedAt:  string
  archiveStatus:  ArchiveStatus
  config:         TierConfig
}

const CONFIG_KEY = 'sf_tier_config'

export function getCurrentFiscalYear(): number {
  return new Date().getFullYear()
}

export function getDefaultTierConfig(): TierConfig {
  const fy = getCurrentFiscalYear()
  return { hotCutoffYear: fy, warmCutoffYear: fy - 3 }
}

export function loadTierConfig(): TierConfig {
  if (typeof window === 'undefined') return getDefaultTierConfig()
  try {
    const s = localStorage.getItem(CONFIG_KEY)
    return s ? (JSON.parse(s) as TierConfig) : getDefaultTierConfig()
  } catch { return getDefaultTierConfig() }
}

export function saveTierConfig(cfg: TierConfig): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)) } catch {}
}

export function getTierForDate(dateStr: string, cfg?: TierConfig): StorageTier {
  if (!dateStr) return 'cold'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return 'cold'
  const c  = cfg ?? getDefaultTierConfig()
  const yr = d.getFullYear()
  if (yr >= c.hotCutoffYear)  return 'hot'
  if (yr >= c.warmCutoffYear) return 'warm'
  return 'cold'
}

function dateRangeLabel(dates: string[]): string {
  if (dates.length === 0) return '—'
  const sorted = [...dates].sort()
  const from = new Date(sorted[0])
  const to   = new Date(sorted[sorted.length - 1])
  const fmt  = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  const a = fmt(from), b = fmt(to)
  return a === b ? a : `${a} – ${b}`
}

export function computeTierSummary(
  transactions: StoredTransaction[],
  cfg?: TierConfig,
): TierSummary {
  const c = cfg ?? loadTierConfig()
  const bands = {
    hot:  { count: 0, totalSpend: 0, dates: [] as string[] },
    warm: { count: 0, totalSpend: 0, dates: [] as string[] },
    cold: { count: 0, totalSpend: 0, dates: [] as string[] },
  }

  for (const tx of transactions) {
    const tier = getTierForDate(tx.date, c)
    bands[tier].count++
    bands[tier].totalSpend += tx.amount
    if (tx.date) bands[tier].dates.push(tx.date)
  }

  return {
    hot:  { count: bands.hot.count,  totalSpend: bands.hot.totalSpend,  dateRange: dateRangeLabel(bands.hot.dates),  estimatedQueryMs: 15  + Math.round(bands.hot.count  * 0.002) },
    warm: { count: bands.warm.count, totalSpend: bands.warm.totalSpend, dateRange: dateRangeLabel(bands.warm.dates), estimatedQueryMs: 200 + Math.round(bands.warm.count * 0.015) },
    cold: { count: bands.cold.count, totalSpend: bands.cold.totalSpend, dateRange: dateRangeLabel(bands.cold.dates), estimatedQueryMs: 2500 + Math.round(bands.cold.count * 0.12) },
    fiscalYear:    c.hotCutoffYear,
    lastScannedAt: new Date().toISOString(),
    archiveStatus: 'active',
    config: c,
  }
}

export function tierLabel(tier: StorageTier): string {
  return tier === 'hot' ? 'Hot Layer' : tier === 'warm' ? 'Warm Layer' : 'Cold Archive'
}

export function tierDescription(tier: StorageTier): string {
  return tier === 'hot'
    ? 'Current fiscal year — scanned first, highest query priority'
    : tier === 'warm'
    ? 'Recent historical — available for trend analysis'
    : 'Archive — low-frequency access, compliance and audit use'
}

export function tierColor(tier: StorageTier): string {
  return tier === 'hot' ? 'text-orange-700' : tier === 'warm' ? 'text-emerald-700' : 'text-slate-500'
}

export function tierBg(tier: StorageTier): string {
  return tier === 'hot' ? 'bg-orange-50 border-orange-200' : tier === 'warm' ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'
}

export function tierDot(tier: StorageTier): string {
  return tier === 'hot' ? 'bg-orange-500' : tier === 'warm' ? 'bg-emerald-500' : 'bg-slate-400'
}
