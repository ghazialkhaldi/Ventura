import type { StoredTransaction, DetectedAnomaly, Severity } from './dataStore'

let idCounter = 0
function nextId() { return `ANO-${String(++idCounter).padStart(3, '0')}` }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysBetween(a: string, b: string): number {
  const ms = Math.abs(new Date(a).getTime() - new Date(b).getTime())
  return ms / 86_400_000
}

function fmtAmt(n: number): string {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000)     return '$' + (n / 1_000).toFixed(1) + 'K'
  return '$' + n.toFixed(2)
}

function severity(level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'): Severity { return level }

function mean(nums: number[]): number { return nums.reduce((a, b) => a + b, 0) / nums.length }

function stdDev(nums: number[]): number {
  const m = mean(nums)
  return Math.sqrt(nums.map(n => (n - m) ** 2).reduce((a, b) => a + b, 0) / nums.length)
}

// ─── Detection algorithms ─────────────────────────────────────────────────────

/** 1. Exact and near-duplicates: same vendor + same amount within 30 days */
function detectDuplicates(txs: StoredTransaction[]): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = []
  const reported = new Set<string>()

  for (let i = 0; i < txs.length; i++) {
    for (let j = i + 1; j < txs.length; j++) {
      const a = txs[i], b = txs[j]
      if (a.vendor.toLowerCase() !== b.vendor.toLowerCase()) continue
      if (Math.abs(a.amount - b.amount) > 0.01) continue

      const days = daysBetween(a.date, b.date)
      if (days > 30) continue

      const key = [a.id, b.id].sort().join('|')
      if (reported.has(key)) continue
      reported.add(key)

      const isExact = days < 2
      anomalies.push({
        id:          nextId(),
        title:       `${isExact ? 'Duplicate' : 'Near-duplicate'} payment — ${a.vendor}`,
        type:        'duplicate',
        vendor:      a.vendor,
        amount:      a.amount,
        severity:    severity(isExact ? 'CRITICAL' : 'HIGH'),
        status:      'Open',
        confidence:  isExact ? 98 : 88,
        detectedAt:  new Date().toISOString(),
        description: `Two payments to ${a.vendor} for ${fmtAmt(a.amount)} ${isExact ? 'on the same day' : `within ${Math.round(days)} days`} (rows ${a.rowIndex + 2} and ${b.rowIndex + 2}).`,
        reasoning:   `Both transactions share the same vendor name and amount. ${isExact ? 'Same-day duplicates indicate a likely double-submission.' : `Payments ${Math.round(days)} days apart for identical amounts warrant review.`}`,
        rowRefs:     [a.id, b.id],
        category:    a.category || 'Uncategorized',
      })
    }
  }
  return anomalies
}

/** 2. Statistical outliers per vendor (z-score > 2.5) */
function detectOutliers(txs: StoredTransaction[]): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = []
  const byVendor = new Map<string, StoredTransaction[]>()

  for (const tx of txs) {
    const key = tx.vendor.toLowerCase()
    if (!byVendor.has(key)) byVendor.set(key, [])
    byVendor.get(key)!.push(tx)
  }

  for (const [, group] of byVendor) {
    if (group.length < 3) continue
    const amounts = group.map(t => t.amount)
    const m  = mean(amounts)
    const sd = stdDev(amounts)
    if (sd < 1) continue

    for (const tx of group) {
      const z = (tx.amount - m) / sd
      if (z < 2.5) continue

      const sev: Severity = z > 4 ? 'CRITICAL' : z > 3 ? 'HIGH' : 'MEDIUM'
      anomalies.push({
        id:          nextId(),
        title:       `Unusual amount — ${tx.vendor}`,
        type:        'outlier',
        vendor:      tx.vendor,
        amount:      tx.amount,
        severity:    sev,
        status:      'Open',
        confidence:  Math.min(99, Math.round(60 + z * 8)),
        detectedAt:  new Date().toISOString(),
        description: `${fmtAmt(tx.amount)} to ${tx.vendor} on ${tx.date} is ${z.toFixed(1)}σ above their average payment of ${fmtAmt(m)} (row ${tx.rowIndex + 2}).`,
        reasoning:   `Across ${group.length} transactions, ${tx.vendor}'s average payment is ${fmtAmt(m)} ±${fmtAmt(sd)}. This transaction deviates by ${z.toFixed(1)} standard deviations, which exceeds the 2.5σ alert threshold.`,
        rowRefs:     [tx.id],
        category:    tx.category || 'Uncategorized',
      })
    }
  }
  return anomalies
}

/** 3. Large single transactions (> $25K, or > 3× the median for the dataset) */
function detectLargeTransactions(txs: StoredTransaction[]): DetectedAnomaly[] {
  if (txs.length === 0) return []
  const anomalies: DetectedAnomaly[] = []
  const sorted = [...txs].sort((a, b) => a.amount - b.amount)
  const medianAmount = sorted[Math.floor(sorted.length / 2)].amount
  const threshold = Math.max(25_000, medianAmount * 5)

  for (const tx of txs) {
    if (tx.amount < threshold) continue
    anomalies.push({
      id:          nextId(),
      title:       `Large transaction — ${tx.vendor}`,
      type:        'large_amount',
      vendor:      tx.vendor,
      amount:      tx.amount,
      severity:    severity(tx.amount > threshold * 3 ? 'HIGH' : 'MEDIUM'),
      status:      'Open',
      confidence:  85,
      detectedAt:  new Date().toISOString(),
      description: `Payment of ${fmtAmt(tx.amount)} to ${tx.vendor} on ${tx.date} exceeds the large-transaction threshold of ${fmtAmt(threshold)} (row ${tx.rowIndex + 2}).`,
      reasoning:   `Dataset median payment is ${fmtAmt(medianAmount)}. This transaction is ${(tx.amount / medianAmount).toFixed(1)}× the median, triggering the large-transaction flag. Large transactions warrant CFO or Finance Director approval verification.`,
      rowRefs:     [tx.id],
      category:    tx.category || 'Uncategorized',
    })
  }
  return anomalies
}

/** 4. Suspicious round numbers > $5K (common fraud pattern) */
function detectRoundNumbers(txs: StoredTransaction[]): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = []
  for (const tx of txs) {
    if (tx.amount < 5_000) continue
    // Divisible by 1000 with no cents
    if (tx.amount % 1_000 !== 0) continue

    anomalies.push({
      id:          nextId(),
      title:       `Round-number transaction — ${tx.vendor}`,
      type:        'round_number',
      vendor:      tx.vendor,
      amount:      tx.amount,
      severity:    severity(tx.amount >= 50_000 ? 'HIGH' : 'MEDIUM'),
      status:      'Open',
      confidence:  70,
      detectedAt:  new Date().toISOString(),
      description: `${fmtAmt(tx.amount)} payment to ${tx.vendor} on ${tx.date} is a round number above $5,000 (row ${tx.rowIndex + 2}).`,
      reasoning:   `Round-number transactions above $5,000 with no cents are a recognized indicator of fabricated invoices or improper payments. While not conclusive alone, this warrants review alongside supporting documentation.`,
      rowRefs:     [tx.id],
      category:    tx.category || 'Uncategorized',
    })
  }
  return anomalies
}

/** 5. High-frequency vendor — 5+ transactions to same vendor in any 14-day window */
function detectHighFrequency(txs: StoredTransaction[]): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = []
  const byVendor = new Map<string, StoredTransaction[]>()

  for (const tx of txs) {
    const key = tx.vendor.toLowerCase()
    if (!byVendor.has(key)) byVendor.set(key, [])
    byVendor.get(key)!.push(tx)
  }

  for (const [, group] of byVendor) {
    if (group.length < 5) continue
    const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date))

    // Sliding 14-day window
    for (let i = 0; i < sorted.length; i++) {
      const window = sorted.filter(t => daysBetween(sorted[i].date, t.date) <= 14)
      if (window.length < 5) continue

      const total = window.reduce((s, t) => s + t.amount, 0)
      const vendor = sorted[i].vendor
      anomalies.push({
        id:          nextId(),
        title:       `High-frequency payments — ${vendor}`,
        type:        'high_frequency',
        vendor,
        amount:      total,
        severity:    severity(window.length >= 10 ? 'HIGH' : 'MEDIUM'),
        status:      'Open',
        confidence:  82,
        detectedAt:  new Date().toISOString(),
        description: `${window.length} payments to ${vendor} within 14 days, totaling ${fmtAmt(total)}.`,
        reasoning:   `${window.length} transactions to the same vendor within a 14-day window exceeds the high-frequency threshold. This pattern may indicate invoice splitting to stay below approval thresholds, or a system error resulting in repeated submissions.`,
        rowRefs:     window.map(t => t.id),
        category:    sorted[i].category || 'Uncategorized',
      })
      break // one alert per vendor
    }
  }
  return anomalies
}

/** 6. Missing vendor name */
function detectMissingVendor(txs: StoredTransaction[]): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = []
  const blanks = txs.filter(t => !t.vendor || t.vendor.trim() === '' || t.vendor.toLowerCase() === 'unknown')

  if (blanks.length === 0) return []

  anomalies.push({
    id:          nextId(),
    title:       `${blanks.length} transaction${blanks.length > 1 ? 's' : ''} with no vendor name`,
    type:        'missing_vendor',
    vendor:      '(blank)',
    amount:      blanks.reduce((s, t) => s + t.amount, 0),
    severity:    severity(blanks.length > 10 ? 'HIGH' : 'MEDIUM'),
    status:      'Open',
    confidence:  99,
    detectedAt:  new Date().toISOString(),
    description: `${blanks.length} transactions have no vendor or payee name, totaling ${(blanks.reduce((s, t) => s + t.amount, 0)).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}.`,
    reasoning:   `All financial transactions must identify the counterparty. Missing vendor names may indicate data entry errors, system integration gaps, or intentional obfuscation of spend.`,
    rowRefs:     blanks.map(t => t.id),
    category:    'Data Quality',
  })
  return anomalies
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export function runAnomalyDetection(txs: StoredTransaction[]): DetectedAnomaly[] {
  idCounter = 0 // reset counter for each run

  const results: DetectedAnomaly[] = [
    ...detectDuplicates(txs),
    ...detectOutliers(txs),
    ...detectLargeTransactions(txs),
    ...detectRoundNumbers(txs),
    ...detectHighFrequency(txs),
    ...detectMissingVendor(txs),
  ]

  // Sort: most severe first
  const order: Record<Severity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
  return results.sort((a, b) => order[a.severity] - order[b.severity])
}
