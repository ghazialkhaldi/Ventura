import type { StoredTransaction, DetectedAnomaly, Severity } from './dataStore'
import { DEFAULT_DETECTION_CONFIG, type DetectionConfig } from './detectionConfig'

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

function median(nums: number[]): number {
  if (nums.length === 0) return 0
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/**
 * Median absolute deviation. Unlike standard deviation this is not dragged
 * upward by the very outliers it is meant to expose, which is why a global
 * mean/sd threshold on a register dominated by large routine payroll
 * remittances ends up sitting below every routine payment.
 */
function mad(nums: number[]): number {
  const med = median(nums)
  return median(nums.map(n => Math.abs(n - med)))
}

/** Parse YYYY-MM-DD without timezone drift. */
function parseLocalDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function isWeekend(iso: string): boolean {
  const d = parseLocalDate(iso)
  if (!d) return false
  const day = d.getDay()
  return day === 0 || day === 6
}

function byVendor(txs: StoredTransaction[]): Map<string, StoredTransaction[]> {
  const m = new Map<string, StoredTransaction[]>()
  for (const tx of txs) {
    const k = tx.vendor.trim().toLowerCase()
    if (!m.has(k)) m.set(k, [])
    m.get(k)!.push(tx)
  }
  for (const g of m.values()) g.sort((a, b) => a.date.localeCompare(b.date))
  return m
}

// ─── 1. Duplicate payments ────────────────────────────────────────────────────

/**
 * Same vendor and amount within 30 days.
 *
 * Only the LATER row of a pair is treated as the finding. The earlier payment
 * is the legitimate original and must not be raised as an anomaly in its own
 * right; it is carried as supporting evidence.
 */
function detectDuplicates(txs: StoredTransaction[]): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = []
  const buckets = new Map<string, StoredTransaction[]>()

  for (const tx of txs) {
    const key = `${tx.vendor.trim().toLowerCase()}|${tx.amount.toFixed(2)}`
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(tx)
  }

  for (const group of buckets.values()) {
    if (group.length < 2) continue
    const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date))

    // Pair each row with its immediate predecessor only. Chaining this way
    // emits one finding per suspected re-payment rather than one per
    // combination, which is what previously reported a single duplicate twice.
    for (let i = 1; i < sorted.length; i++) {
      const earlier = sorted[i - 1]
      const later   = sorted[i]
      const days    = daysBetween(earlier.date, later.date)
      if (days > 30) continue

      const isExact = days < 2
      anomalies.push({
        id:          nextId(),
        title:       `${isExact ? 'Duplicate' : 'Near-duplicate'} payment — ${later.vendor}`,
        type:        'duplicate',
        vendor:      later.vendor,
        amount:      later.amount,
        severity:    severity(isExact ? 'CRITICAL' : 'HIGH'),
        status:      'Open',
        confidence:  isExact ? 98 : 88,
        detectedAt:  new Date().toISOString(),
        description: `${fmtAmt(later.amount)} paid to ${later.vendor} on ${later.date} (row ${later.rowIndex + 2}) repeats an identical payment on ${earlier.date} (row ${earlier.rowIndex + 2}), ${isExact ? 'the same day' : `${Math.round(days)} days earlier`}.`,
        reasoning:   `Same vendor and same amount to the cent. The ${later.date} payment is flagged as the probable duplicate; the ${earlier.date} payment is treated as the legitimate original and is not raised separately.`,
        // Flagged row first, original second as evidence.
        rowRefs:     [later.id, earlier.id],
        category:    later.category || 'Uncategorized',
      })
    }
  }
  return anomalies
}

// ─── 2. Vendor-relative amount outlier ────────────────────────────────────────

/** Retained unchanged in behaviour: sigma above the vendor's own mean. */
function detectVendorOutliers(txs: StoredTransaction[], cfg: DetectionConfig): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = []

  for (const group of byVendor(txs).values()) {
    if (group.length < cfg.vendorMinHistory) continue
    const amounts = group.map(t => t.amount)
    const m  = mean(amounts)
    const sd = stdDev(amounts)
    if (sd < 1) continue

    for (const tx of group) {
      const z = (tx.amount - m) / sd
      if (z < cfg.vendorSigma) continue

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
        description: `${fmtAmt(tx.amount)} to ${tx.vendor} on ${tx.date} is ${z.toFixed(1)}σ above their own average of ${fmtAmt(m)} (row ${tx.rowIndex + 2}).`,
        reasoning:   `Across ${group.length} payments, ${tx.vendor} averages ${fmtAmt(m)} ±${fmtAmt(sd)}. This one deviates by ${z.toFixed(1)} standard deviations, past the ${cfg.vendorSigma}σ threshold. Measured against this vendor only, so a vendor that is routinely large does not trip it.`,
        rowRefs:     [tx.id],
        category:    tx.category || 'Uncategorized',
      })
    }
  }
  return anomalies
}

// ─── 3. Category-relative amount outlier ──────────────────────────────────────

/**
 * Replaces the global large-transaction threshold.
 *
 * A single register-wide cutoff is meaningless when one category dominates
 * spend: a threshold derived across everything lands below every routine
 * payroll remittance and buries the reviewer. Each category is instead scored
 * against its own median and MAD, so "large" means large *for that kind of
 * spend*.
 */
function detectCategoryOutliers(txs: StoredTransaction[], cfg: DetectionConfig): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = []
  const byCat = new Map<string, StoredTransaction[]>()

  for (const tx of txs) {
    const k = (tx.category || 'Uncategorized').trim().toLowerCase()
    if (!byCat.has(k)) byCat.set(k, [])
    byCat.get(k)!.push(tx)
  }

  for (const group of byCat.values()) {
    if (group.length < cfg.categoryMinRows) continue

    const amounts = group.map(t => t.amount)
    const med = median(amounts)
    let scale = mad(amounts)

    // MAD collapses to zero when more than half the rows share a value. Fall
    // back to mean absolute deviation, scaled to be comparable.
    if (scale === 0) {
      const meanAbs = mean(amounts.map(a => Math.abs(a - med)))
      scale = meanAbs * 1.2533
    }
    if (scale === 0) continue

    for (const tx of group) {
      // Positive tail only: unusually small spend is not the risk here.
      const z = (0.6745 * (tx.amount - med)) / scale
      if (z < cfg.categoryMadZ) continue

      const sev: Severity = z > cfg.categoryMadZ * 3 ? 'CRITICAL' : z > cfg.categoryMadZ * 2 ? 'HIGH' : 'MEDIUM'
      anomalies.push({
        id:          nextId(),
        title:       `Unusual amount for ${tx.category || 'Uncategorized'} — ${tx.vendor}`,
        type:        'large_amount',
        vendor:      tx.vendor,
        amount:      tx.amount,
        severity:    severity(sev),
        status:      'Open',
        confidence:  Math.min(97, Math.round(65 + z * 3)),
        detectedAt:  new Date().toISOString(),
        description: `${fmtAmt(tx.amount)} to ${tx.vendor} on ${tx.date} is far above the ${tx.category || 'Uncategorized'} norm of ${fmtAmt(med)} (row ${tx.rowIndex + 2}).`,
        reasoning:   `Within ${tx.category || 'Uncategorized'} (${group.length} rows) the median payment is ${fmtAmt(med)}. This row scores a modified z of ${z.toFixed(1)} against that category's own median absolute deviation, past the threshold of ${cfg.categoryMadZ}. Scoring per category prevents a high-value category such as payroll from setting the bar for every other kind of spend.`,
        rowRefs:     [tx.id],
        category:    tx.category || 'Uncategorized',
      })
    }
  }
  return anomalies
}

// ─── 4. Approval control proximity ────────────────────────────────────────────

/**
 * Repeated payments to one vendor sitting just beneath an approval limit.
 *
 * No single payment breaches the control, so no amount-based rule can see it.
 * The signature is the cluster: several payments to the same vendor, all in a
 * narrow band under the limit, inside a short window.
 */
function detectApprovalAvoidance(txs: StoredTransaction[], cfg: DetectionConfig): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = []
  const low  = cfg.approvalLimit * cfg.approvalBandLow
  const high = cfg.approvalLimit * cfg.approvalBandHigh

  for (const group of byVendor(txs).values()) {
    const inBand = group.filter(t => t.amount >= low && t.amount <= high)
    if (inBand.length < cfg.approvalMinCluster) continue

    // Largest cluster of in-band payments inside the rolling window.
    let best: StoredTransaction[] = []
    for (let i = 0; i < inBand.length; i++) {
      const window = inBand.filter(t => daysBetween(inBand[i].date, t.date) <= cfg.approvalWindowDays && t.date >= inBand[i].date)
      if (window.length > best.length) best = window
    }
    if (best.length < cfg.approvalMinCluster) continue

    const total  = best.reduce((s, t) => s + t.amount, 0)
    const vendor = best[0].vendor
    const spanDays = Math.round(daysBetween(best[0].date, best[best.length - 1].date))

    anomalies.push({
      id:          nextId(),
      title:       `Payments structured below approval limit — ${vendor}`,
      type:        'approval_avoidance',
      vendor,
      amount:      total,
      severity:    severity('CRITICAL'),
      status:      'Open',
      confidence:  94,
      detectedAt:  new Date().toISOString(),
      description: `${best.length} payments to ${vendor} totalling ${fmtAmt(total)} between ${best[0].date} and ${best[best.length - 1].date}, each between ${fmtAmt(low)} and ${fmtAmt(high)} and none individually breaching the ${fmtAmt(cfg.approvalLimit)} dual-approval limit.`,
      reasoning:   `Each payment clears the ${fmtAmt(cfg.approvalLimit)} control on its own, so no single-amount rule sees them, yet together they total ${fmtAmt(total)} across ${spanDays} day${spanDays === 1 ? '' : 's'}. Several payments to one vendor landing in the top ${Math.round((1 - cfg.approvalBandLow) * 100)}% beneath an approval limit within ${cfg.approvalWindowDays} days is the signature of deliberate structuring and should be confirmed against the underlying invoices before further payment.`,
      rowRefs:     best.map(t => t.id),
      category:    best[0].category || 'Uncategorized',
    })
  }
  return anomalies
}

// ─── 5. Velocity, scored against the vendor's own history ─────────────────────

/**
 * A fixed "N payments in M days" count cannot tell a benefits provider paid on
 * a dense but regular cadence from a brand-new vendor paid four times in four
 * days. Both the baseline and the weighting therefore come from the vendor's
 * own record: a burst from a vendor with no prior payments is treated as far
 * more significant than the same burst from an established one.
 */
function detectVelocity(txs: StoredTransaction[], cfg: DetectionConfig): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = []

  for (const group of byVendor(txs).values()) {
    if (group.length < 2) continue
    const W = cfg.velocityWindowDays

    // Densest window this vendor reached, and how many payments preceded it.
    let bestWindow: StoredTransaction[] = []
    let priorCount = 0
    for (let i = 0; i < group.length; i++) {
      const window = group.filter(t => t.date >= group[i].date && daysBetween(group[i].date, t.date) <= W)
      if (window.length > bestWindow.length) {
        bestWindow = window
        priorCount = group.filter(t => t.date < group[i].date).length
      }
    }
    if (bestWindow.length < 2) continue

    // The vendor's own busiest window excluding the one under examination.
    const windowIds = new Set(bestWindow.map(t => t.id))
    const rest = group.filter(t => !windowIds.has(t.id))
    let restMax = 0
    for (let i = 0; i < rest.length; i++) {
      const c = rest.filter(t => t.date >= rest[i].date && daysBetween(rest[i].date, t.date) <= W).length
      if (c > restMax) restMax = c
    }

    const isNewVendor = priorCount === 0
    const total  = bestWindow.reduce((s, t) => s + t.amount, 0)
    const vendor = bestWindow[0].vendor

    if (isNewVendor) {
      // No history at all before this burst.
      if (bestWindow.length < cfg.velocityNewVendorMinCount) continue
      anomalies.push({
        id:          nextId(),
        title:       `Burst of payments from a new vendor — ${vendor}`,
        type:        'high_frequency',
        vendor,
        amount:      total,
        severity:    severity('HIGH'),
        status:      'Open',
        confidence:  88,
        detectedAt:  new Date().toISOString(),
        description: `${bestWindow.length} payments to ${vendor} totalling ${fmtAmt(total)} within ${W} days, with no prior payment history to this vendor.`,
        reasoning:   `${vendor} has no payments before ${bestWindow[0].date}. A vendor appearing for the first time and immediately receiving ${bestWindow.length} payments inside ${W} days has no established cadence to justify the frequency, which is weighted far more heavily than the same burst from a vendor with a known rhythm.`,
        rowRefs:     bestWindow.map(t => t.id),
        category:    bestWindow[0].category || 'Uncategorized',
      })
    } else {
      // Established vendor: only flag a window well beyond its own norm.
      if (restMax === 0) continue
      if (bestWindow.length < restMax * cfg.velocityBurstMultiple) continue
      if (bestWindow.length - restMax < 2) continue
      anomalies.push({
        id:          nextId(),
        title:       `Payment frequency above this vendor's norm — ${vendor}`,
        type:        'high_frequency',
        vendor,
        amount:      total,
        severity:    severity('MEDIUM'),
        status:      'Open',
        confidence:  76,
        detectedAt:  new Date().toISOString(),
        description: `${bestWindow.length} payments to ${vendor} within ${W} days, against a usual peak of ${restMax} for this vendor.`,
        reasoning:   `${vendor} has ${group.length} payments on record and never exceeds ${restMax} inside a ${W}-day window elsewhere in the register. This window reaches ${bestWindow.length}, at least ${cfg.velocityBurstMultiple}× its own established peak. Measuring against the vendor's own cadence keeps routine high-frequency remittances from being reported.`,
        rowRefs:     bestWindow.map(t => t.id),
        category:    bestWindow[0].category || 'Uncategorized',
      })
    }
  }
  return anomalies
}

// ─── 6. Vendor to category consistency ────────────────────────────────────────

/** A vendor with an established coding pattern suddenly booked elsewhere. */
function detectCategoryMismatch(txs: StoredTransaction[], cfg: DetectionConfig): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = []

  for (const group of byVendor(txs).values()) {
    if (group.length <= cfg.categoryConsistencyMinHistory) continue

    const counts = new Map<string, number>()
    for (const t of group) {
      const c = (t.category || 'Uncategorized').trim()
      counts.set(c, (counts.get(c) ?? 0) + 1)
    }
    if (counts.size < 2) continue

    const [modal, modalCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
    // The pattern must actually be established, not a near-even split.
    if (modalCount < cfg.categoryConsistencyMinHistory) continue

    for (const tx of group) {
      const cat = (tx.category || 'Uncategorized').trim()
      if (cat === modal) continue
      anomalies.push({
        id:          nextId(),
        title:       `Category inconsistent with vendor history — ${tx.vendor}`,
        type:        'category_mismatch',
        vendor:      tx.vendor,
        amount:      tx.amount,
        severity:    severity('MEDIUM'),
        status:      'Open',
        confidence:  86,
        detectedAt:  new Date().toISOString(),
        description: `${fmtAmt(tx.amount)} to ${tx.vendor} on ${tx.date} is coded ${cat}, while ${modalCount} of this vendor's ${group.length} charges are coded ${modal} (row ${tx.rowIndex + 2}).`,
        reasoning:   `${tx.vendor} has an established coding pattern of ${modal} across ${modalCount} of ${group.length} transactions. A single departure to ${cat} points to a miscode, which distorts category reporting and can route spend past the wrong budget owner.`,
        rowRefs:     [tx.id],
        category:    cat,
      })
    }
  }
  return anomalies
}

// ─── 7. Period integrity ──────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

/** Parse period labels such as "Jan-26", "2026-01", "Jan 2026". */
export function parsePeriodLabel(label: string): { year: number; month: number } | null {
  const s = label.trim().toLowerCase()
  if (!s) return null

  let m = /^([a-z]{3})[a-z]*[\s\-/]+(\d{2}|\d{4})$/.exec(s)
  if (m && MONTHS[m[1]] !== undefined) {
    const yr = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2])
    return { year: yr, month: MONTHS[m[1]] }
  }
  m = /^(\d{4})[\s\-/](\d{1,2})$/.exec(s)
  if (m) return { year: Number(m[1]), month: Number(m[2]) - 1 }
  m = /^(\d{1,2})[\s\-/](\d{4})$/.exec(s)
  if (m) return { year: Number(m[2]), month: Number(m[1]) - 1 }
  return null
}

/**
 * A row whose transaction date falls outside the accounting period it is
 * labelled with posts to the wrong fiscal period. The reporting window must
 * never be widened to absorb such a row; it is reported as a defect.
 */
function detectPeriodMismatch(txs: StoredTransaction[]): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = []

  for (const tx of txs) {
    if (!tx.period || !tx.date) continue
    const p = parsePeriodLabel(tx.period)
    const d = parseLocalDate(tx.date)
    if (!p || !d) continue
    if (d.getFullYear() === p.year && d.getMonth() === p.month) continue

    const wrongYear = d.getFullYear() !== p.year
    anomalies.push({
      id:          nextId(),
      title:       `Transaction posted outside its stated period — ${tx.vendor}`,
      type:        'period_mismatch',
      vendor:      tx.vendor,
      amount:      tx.amount,
      severity:    severity(wrongYear ? 'HIGH' : 'MEDIUM'),
      status:      'Open',
      confidence:  96,
      detectedAt:  new Date().toISOString(),
      description: `${fmtAmt(tx.amount)} to ${tx.vendor} is dated ${tx.date} but labelled period ${tx.period} (row ${tx.rowIndex + 2}).`,
      reasoning:   wrongYear
        ? `The transaction date falls in ${d.getFullYear()} while the period label places it in ${p.year}, so the row posts to the wrong fiscal year. Year-end cut-off errors misstate both periods and must be corrected at source rather than absorbed by widening the reporting window.`
        : `The transaction date and the period label disagree on the month, so the row posts to the wrong accounting period.`,
      rowRefs:     [tx.id],
      category:    tx.category || 'Uncategorized',
    })
  }
  return anomalies
}

// ─── 8. New vendor composite risk ─────────────────────────────────────────────

/**
 * First appearance, sole appearance, a round amount, posting on a non-business
 * day and materiality are each weak on their own and were previously emitted
 * as separate low-confidence findings. Together they describe a specific
 * shape, so they are scored once and raised as a single finding.
 */
function detectNewVendorRisk(txs: StoredTransaction[], cfg: DetectionConfig): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = []

  for (const group of byVendor(txs).values()) {
    if (group.length !== 1) continue          // sole appearance in the register
    const tx = group[0]

    const signals: string[] = ['appears only once in the register']
    let score = 2

    const isRound = tx.amount >= cfg.roundNumberMin && tx.amount % 1_000 === 0
    if (isRound) { score += 2; signals.push(`a round ${fmtAmt(tx.amount)} with no cents`) }

    const weekend = isWeekend(tx.date)
    if (weekend) { score += 2; signals.push('posted on a non-business day') }

    const material = tx.amount >= cfg.approvalLimit
    if (material) { score += 2; signals.push(`at or above the ${fmtAmt(cfg.approvalLimit)} approval limit`) }

    if (score < cfg.newVendorScoreThreshold) continue

    const sev: Severity = score >= cfg.newVendorHighScore ? 'HIGH' : 'MEDIUM'
    anomalies.push({
      id:          nextId(),
      title:       `Unverified vendor, multiple risk signals — ${tx.vendor}`,
      type:        'new_vendor_risk',
      vendor:      tx.vendor,
      amount:      tx.amount,
      severity:    severity(sev),
      status:      'Open',
      confidence:  Math.min(95, 55 + score * 5),
      detectedAt:  new Date().toISOString(),
      description: `${fmtAmt(tx.amount)} to ${tx.vendor} on ${tx.date}: ${signals.join(', ')} (row ${tx.rowIndex + 2}).`,
      reasoning:   `Scored ${score} across ${signals.length} independent signals. None of these is conclusive alone, which is why they are combined rather than raised separately: a vendor with no other activity in the register, receiving a round material amount outside business hours, matches the profile of a payment that was never through normal procurement. Confirm the vendor exists in the master file and that the invoice is supported.`,
      rowRefs:     [tx.id],
      category:    tx.category || 'Uncategorized',
    })
  }
  return anomalies
}

// ─── 9. Round numbers (standalone) ────────────────────────────────────────────

/** Only for vendors with other activity; sole-appearance vendors are scored above. */
function detectRoundNumbers(txs: StoredTransaction[], cfg: DetectionConfig, coveredRows: Set<string>): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = []
  for (const tx of txs) {
    if (tx.amount < cfg.roundNumberMin) continue
    if (tx.amount % 1_000 !== 0) continue
    if (coveredRows.has(tx.id)) continue      // already carried by a stronger finding

    anomalies.push({
      id:          nextId(),
      title:       `Round-number payment — ${tx.vendor}`,
      type:        'round_number',
      vendor:      tx.vendor,
      amount:      tx.amount,
      severity:    severity('LOW'),
      status:      'Open',
      confidence:  62,
      detectedAt:  new Date().toISOString(),
      description: `${fmtAmt(tx.amount)} to ${tx.vendor} on ${tx.date} is a round amount above ${fmtAmt(cfg.roundNumberMin)} (row ${tx.rowIndex + 2}).`,
      reasoning:   `Round amounts with no cents can indicate an estimated or fabricated invoice. On its own this is weak evidence, so it is raised at low severity and below the exposure confidence floor.`,
      rowRefs:     [tx.id],
      category:    tx.category || 'Uncategorized',
    })
  }
  return anomalies
}

// ─── 10. Missing vendor ───────────────────────────────────────────────────────

function detectMissingVendor(txs: StoredTransaction[]): DetectedAnomaly[] {
  const blanks = txs.filter(t => !t.vendor || t.vendor.trim() === '' || t.vendor.trim().toLowerCase() === 'unknown')
  if (blanks.length === 0) return []

  const total = blanks.reduce((s, t) => s + t.amount, 0)
  return [{
    id:          nextId(),
    title:       `${blanks.length} transaction${blanks.length > 1 ? 's' : ''} with no vendor name`,
    type:        'missing_vendor',
    vendor:      '(blank)',
    amount:      total,
    severity:    severity(blanks.length > 10 ? 'HIGH' : 'MEDIUM'),
    status:      'Open',
    confidence:  99,
    detectedAt:  new Date().toISOString(),
    description: `${blanks.length} transactions have no vendor or payee name, totalling ${fmtAmt(total)}.`,
    reasoning:   `Every transaction must identify its counterparty. Missing names indicate data entry gaps, broken integration mappings, or deliberate obfuscation.`,
    rowRefs:     blanks.map(t => t.id),
    category:    'Data Quality',
  }]
}

// ─── Deduplication ────────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<Severity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }

/**
 * Collapse findings that describe the same event.
 *
 * Two findings covering an identical set of rows are the same observation
 * reported twice; only the strongest is kept. Findings whose rows are wholly
 * contained in a stronger, broader finding are likewise dropped, so a
 * structured-payment cluster is not also reported as four separate rows.
 */
function dedupe(findings: DetectedAnomaly[]): DetectedAnomaly[] {
  const rank = (a: DetectedAnomaly) => SEVERITY_ORDER[a.severity] * 1000 - a.confidence

  // Identical row sets.
  const bySignature = new Map<string, DetectedAnomaly>()
  for (const f of findings) {
    const sig = [...f.rowRefs].sort().join('|')
    const held = bySignature.get(sig)
    if (!held || rank(f) < rank(held)) bySignature.set(sig, f)
  }
  const unique = [...bySignature.values()].sort((a, b) => rank(a) - rank(b))

  // Single-row findings already covered by a stronger multi-row finding.
  const covered = new Set<string>()
  const kept: DetectedAnomaly[] = []
  for (const f of unique) {
    if (f.rowRefs.length === 1 && covered.has(f.rowRefs[0])) continue
    kept.push(f)
    if (f.rowRefs.length > 1) for (const r of f.rowRefs) covered.add(r)
  }
  return kept
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export function runAnomalyDetection(
  allTxs: StoredTransaction[],
  config: Partial<DetectionConfig> = {},
): DetectedAnomaly[] {
  idCounter = 0
  const cfg: DetectionConfig = { ...DEFAULT_DETECTION_CONFIG, ...config }

  // Credits (refunds, rebates, reversals) are not spend and must never reach
  // these checks: a refund landing beside its original charge is not a
  // duplicate payment, and inflows would skew every baseline.
  const txs = allTxs.filter(t => t.direction !== 'credit')

  // Run the strong, specific rules first so weaker generic ones can stand down
  // on rows already accounted for.
  const strong = [
    ...detectDuplicates(txs),
    ...detectApprovalAvoidance(txs, cfg),
    ...detectPeriodMismatch(txs),
    ...detectCategoryMismatch(txs, cfg),
    ...detectVelocity(txs, cfg),
    ...detectNewVendorRisk(txs, cfg),
    ...detectVendorOutliers(txs, cfg),
    ...detectCategoryOutliers(txs, cfg),
  ]

  const coveredRows = new Set(strong.flatMap(f => f.rowRefs))

  const results = [
    ...strong,
    ...detectRoundNumbers(txs, cfg, coveredRows),
    ...detectMissingVendor(txs),
  ]

  return dedupe(results)
}

/**
 * Amount genuinely at risk, rather than the sum of everything flagged.
 *
 * Counting every finding's amount double counts rows touched by more than one
 * rule and sweeps in low-confidence signals, which is how exposure ends up at
 * most of total spend and stops meaning anything. Each row is counted once,
 * and only from findings at or above the confidence floor.
 */
export function computeRiskExposure(
  findings: DetectedAnomaly[],
  txs: StoredTransaction[],
  config: Partial<DetectionConfig> = {},
): { exposure: number; countedRows: number; floor: number } {
  const cfg: DetectionConfig = { ...DEFAULT_DETECTION_CONFIG, ...config }
  const amountByRow = new Map(txs.map(t => [t.id, t.amount]))

  const rows = new Set<string>()
  for (const f of findings) {
    if (f.confidence < cfg.exposureConfidenceFloor) continue
    if (f.status === 'Resolved' || f.status === 'Dismissed') continue
    for (const r of f.rowRefs) if (amountByRow.has(r)) rows.add(r)
  }

  let exposure = 0
  for (const r of rows) exposure += amountByRow.get(r) ?? 0
  return { exposure, countedRows: rows.size, floor: cfg.exposureConfidenceFloor }
}
