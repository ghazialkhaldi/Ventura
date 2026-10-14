import type { StoredTransaction, VendorStat, CategoryStat, MonthlyEntry } from './dataStore'
import { vendorKey, isMissingVendor } from './anomalyEngine'

// One summary of a register for every upload path, so the dashboard reads the
// same figures however the data arrived.

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-09" -> "Sep 2026", without a Date (whose time zone would move the 1st into the month before). */
export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return `${MON[m - 1]} ${y}`
}

export interface TransactionSummary {
  totalTransactions: number
  totalSpend:        number
  totalCredits:      number
  creditCount:       number
  uniqueVendors:     number
  dateRange:         { from: string; to: string }
  topVendors:        VendorStat[]
  categoryBreakdown: CategoryStat[]
  monthlyBreakdown:  MonthlyEntry[]
}

/**
 * Spend figures for a register. Credits (refunds, rebates, reversals) are
 * reported apart and never counted as spend. Vendors are grouped by identity,
 * not spelling, and shown under their most common spelling.
 */
export function summarizeTransactions(all: StoredTransaction[]): TransactionSummary {
  const spend   = all.filter(t => t.direction !== 'credit')
  const credits = all.filter(t => t.direction === 'credit')

  const vendors = new Map<string, { total: number; count: number; names: Map<string, number>; cats: Map<string, number> }>()
  for (const t of spend) {
    const k = isMissingVendor(t.vendor) ? '' : vendorKey(t.vendor)
    const v = vendors.get(k) ?? { total: 0, count: 0, names: new Map(), cats: new Map() }
    v.total += t.amount; v.count++
    const name = k ? t.vendor.trim() : '(No payee)'
    v.names.set(name, (v.names.get(name) ?? 0) + 1)
    if (t.category) v.cats.set(t.category, (v.cats.get(t.category) ?? 0) + 1)
    vendors.set(k, v)
  }
  const most = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
  const topVendors: VendorStat[] = [...vendors.values()]
    .map(v => ({ vendor: most(v.names), total: v.total, count: v.count, avgAmount: v.total / v.count, category: most(v.cats) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 20)

  const cats = new Map<string, CategoryStat>()
  for (const t of spend) {
    const k = t.category || 'Uncategorized'
    const c = cats.get(k) ?? { category: k, total: 0, count: 0 }
    c.total += t.amount; c.count++
    cats.set(k, c)
  }

  const months = new Map<string, MonthlyEntry>()
  for (const t of spend) {
    const key = /^\d{4}-\d{2}/.test(t.date) ? t.date.slice(0, 7) : ''
    if (!key) continue
    const e = months.get(key) ?? { key, month: monthLabel(key), spend: 0, count: 0 }
    e.spend += t.amount; e.count++
    months.set(key, e)
  }

  const dates = all.map(t => t.date).filter(d => /^\d{4}-\d{2}-\d{2}/.test(d)).sort()
  return {
    totalTransactions: all.length,
    totalSpend:        spend.reduce((s, t) => s + t.amount, 0),
    totalCredits:      credits.reduce((s, t) => s + t.amount, 0),
    creditCount:       credits.length,
    uniqueVendors:     [...vendors.keys()].filter(Boolean).length,
    dateRange:         { from: dates[0] ?? '', to: dates[dates.length - 1] ?? '' },
    topVendors,
    categoryBreakdown: [...cats.values()].sort((a, b) => b.total - a.total),
    monthlyBreakdown:  [...months.values()].sort((a, b) => a.key!.localeCompare(b.key!)),
  }
}

/** Give every row an id that is unique across files and sources, so a finding's evidence never points at another file's row. */
export function namespaceRows(txs: StoredTransaction[], prefix: string): StoredTransaction[] {
  return txs.map(t => ({ ...t, id: `${prefix}:${t.id}` }))
}

/**
 * Combine several parsed files into one register.
 *
 * Overlapping exports (July to September, then September to November) carry
 * the same payments twice. A row that already appeared in an earlier file,
 * same date, vendor, amount and direction, is the same record exported again,
 * not a second payment, so it is dropped and counted rather than reported as
 * a duplicate. Identical rows within one file are kept: that is exactly what
 * a duplicate payment looks like.
 */
export function combineFiles(files: StoredTransaction[][]): { transactions: StoredTransaction[]; overlap: number } {
  const known = new Map<string, number>()   // signature -> copies seen in earlier files
  const out: StoredTransaction[] = []
  let overlap = 0
  files.forEach((txs, fi) => {
    const here = new Map<string, number>()
    for (const t of txs) {
      const sig = `${t.date}|${vendorKey(t.vendor)}|${Math.round(t.amount * 100)}|${t.direction ?? 'debit'}`
      const n = here.get(sig) ?? 0
      here.set(sig, n + 1)
      if (t.date && n < (known.get(sig) ?? 0)) { overlap++; continue }
      out.push({ ...t, id: `F${fi + 1}:${t.id}` })
    }
    for (const [sig, c] of here) known.set(sig, Math.max(known.get(sig) ?? 0, c))
  })
  return { transactions: out, overlap }
}
