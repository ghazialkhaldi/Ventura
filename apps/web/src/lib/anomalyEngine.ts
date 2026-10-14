import type { StoredTransaction, DetectedAnomaly, Severity, AnomalyType } from './dataStore'
import { DEFAULT_DETECTION_CONFIG, type DetectionConfig } from './detectionConfig'

/**
 * The detection engine.
 *
 * Every rule judges a payment against the most specific evidence available:
 * its own invoice reference, its vendor's own history and rhythm, its
 * category's range, the file's own period calendar. Generic thresholds are
 * the last resort, not the first. Findings that describe the same event are
 * merged into one, carrying every rule that fired, so a reviewer sees one
 * finding per problem.
 *
 * The scenarios in test/engine measure precision and recall against routine
 * spend that is deliberately hard to leave alone.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtAmt(n: number): string {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000)     return '$' + (n / 1_000).toFixed(1) + 'K'
  return '$' + n.toFixed(2)
}

const fmtExact = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

function median(nums: number[]): number {
  if (nums.length === 0) return 0
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/**
 * Median absolute deviation. Unlike standard deviation it is not dragged
 * upward by the very outlier it is meant to expose.
 */
function mad(nums: number[]): number {
  const med = median(nums)
  return median(nums.map(n => Math.abs(n - med)))
}

function quantile(nums: number[], q: number): number {
  if (nums.length === 0) return 0
  const s = [...nums].sort((a, b) => a - b)
  const pos = (s.length - 1) * q
  const lo = Math.floor(pos), hi = Math.ceil(pos)
  return s[lo] + (s[hi] - s[lo]) * (pos - lo)
}

/** Whole days since the epoch for a YYYY-MM-DD date, free of time zones. NaN when undated. */
function dayNumber(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '')
  if (!m) return NaN
  return Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000)
}

function isWeekend(day: number): boolean {
  if (!Number.isFinite(day)) return false
  const dow = new Date(day * 86_400_000).getUTCDay()
  return dow === 0 || dow === 6
}

const cents = (n: number) => Math.round(n * 100)

/** Append to a grouped list in place. Rebuilding the array on every row is quadratic on busy vendors. */
function pushTo<K, V>(m: Map<K, V[]>, k: K, v: V) {
  const list = m.get(k)
  if (list) list.push(v); else m.set(k, [v])
}
const isRoundThousand = (n: number) => cents(n) % 100_000 === 0
const isRoundHundred  = (n: number) => cents(n) % 10_000 === 0
const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`
const rowLabel = (t: StoredTransaction) => `row ${t.rowIndex + 2}`

// ─── Vendor identity ──────────────────────────────────────────────────────────

const LEGAL_SUFFIXES = new Set([
  'inc', 'incorporated', 'llc', 'ltd', 'limited', 'co', 'company', 'corp', 'corporation',
  'plc', 'gmbh', 'pty', 'sa', 'ag', 'bv', 'nv', 'lp', 'llp', 'pllc', 'pc', 'srl', 'oy', 'ab',
])
const MISSING_NAMES = new Set(['', 'unknown', 'unknown vendor', 'unknown payee', 'n a', 'na', 'none', 'tbd', 'no vendor', 'no payee', 'blank', 'null'])

/**
 * One key per real-world vendor. "Summit Print Co.", "Summit Print Company"
 * and "SUMMIT PRINT" are the same supplier; treating them as three is how the
 * same invoice gets paid twice without either payment looking repeated.
 */
export function vendorKey(name: string): string {
  const toks = (name || '').toLowerCase().replace(/&/g, ' and ').split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  if (toks.length > 1 && toks[0] === 'the') toks.shift()
  while (toks.length > 1 && LEGAL_SUFFIXES.has(toks[toks.length - 1])) toks.pop()
  return toks.join(' ')
}

export function isMissingVendor(name: string): boolean {
  return MISSING_NAMES.has(vendorKey(name))
}

/** Invoice-like references in a description: tokens carrying four or more digits that are not dates or amounts. */
function refsOf(desc: string): Set<string> {
  const out = new Set<string>()
  for (const raw of (desc || '').split(/[\s,;|]+/)) {
    const t = raw.replace(/^[#(\[]+|[)\].:]+$/g, '')
    if ((t.match(/\d/g) ?? []).length < 4) continue
    if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(t) || /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(t)) continue
    if (/^[$£€]?\d{1,3}(,\d{3})*(\.\d{2})$/.test(t) || /^[$£€]?\d+\.\d{2}$/.test(t)) continue
    out.add(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))
  }
  return out
}

/** A description's words without its references, or '' when it says nothing beyond the vendor's name. */
function descKey(desc: string, vendor: string): string {
  const words = (desc || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w => w && !/\d/.test(w)).join(' ')
  return words === vendorKey(vendor) ? '' : words
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface Row {
  tx:   StoredTransaction
  day:  number              // NaN when undated
  key:  string              // vendor key
  refs: Set<string>
  desc: string
}

interface Vendor {
  key:  string
  name: string              // the most common spelling, for display
  rows: Row[]               // dated rows by date, then undated
  /** Same-amount series that recur on a cadence: amount in cents -> cadence in days, and how strictly it is kept. */
  recurring: Map<number, Cadence>
}

interface Ctx {
  cfg:     DetectionConfig
  rows:    Row[]            // spend rows with a vendor
  vendors: Map<string, Vendor>
  start:   number           // first dated day in the register
  end:     number
}

const CADENCES = [7, 14, 30.4, 91, 365]

interface Cadence {
  days:   number
  /** Share of the series' gaps on the beat, leaving out early extras: 1 for rent on the 1st. */
  strict: number
}

/**
 * The cadence of a same-amount series, if it has one. Rent on the 1st is
 * 28 to 31 days apart; that is a rhythm, not a run of duplicates.
 */
function cadenceOf(days: number[], minCount: number, extraShare: number): Cadence | null {
  if (days.length < minCount) return null
  const gaps: number[] = []
  for (let i = 1; i < days.length; i++) gaps.push(days[i] - days[i - 1])
  const m = median(gaps)
  const c = CADENCES.find(c => Math.abs(m - c) <= Math.max(2, c * 0.2))
  if (!c) return null
  const tol = Math.max(3, c * 0.2)
  const onBeat = (g: number) => Math.abs(g - c) <= tol
  if (gaps.filter(onBeat).length / gaps.length < 0.6) return null
  const regular = gaps.filter(g => g >= c * extraShare)
  return { days: c, strict: regular.length ? regular.filter(onBeat).length / regular.length : 0 }
}

function buildContext(txs: StoredTransaction[], cfg: DetectionConfig): Ctx {
  const rows: Row[] = txs
    .filter(t => !isMissingVendor(t.vendor) && t.amount > 0)
    .map(tx => ({ tx, day: dayNumber(tx.date), key: vendorKey(tx.vendor), refs: refsOf(tx.description), desc: descKey(tx.description, tx.vendor) }))

  const vendors = new Map<string, Vendor>()
  for (const r of rows) {
    let v = vendors.get(r.key)
    if (!v) vendors.set(r.key, v = { key: r.key, name: r.tx.vendor.trim(), rows: [], recurring: new Map() })
    v.rows.push(r)
  }
  for (const v of vendors.values()) {
    v.rows.sort((a, b) => (Number.isFinite(a.day) ? a.day : Infinity) - (Number.isFinite(b.day) ? b.day : Infinity))
    const spellings = new Map<string, number>()
    for (const r of v.rows) spellings.set(r.tx.vendor.trim(), (spellings.get(r.tx.vendor.trim()) ?? 0) + 1)
    v.name = [...spellings.entries()].sort((a, b) => b[1] - a[1])[0][0]
    const byAmount = new Map<number, number[]>()
    for (const r of v.rows) if (Number.isFinite(r.day)) pushTo(byAmount, cents(r.tx.amount), r.day)
    for (const [amt, days] of byAmount) {
      const c = cadenceOf(days, cfg.recurringMinCount, cfg.recurringExtraShare)
      if (c) v.recurring.set(amt, c)
    }
  }

  let start = Infinity, end = -Infinity
  for (const r of rows) if (Number.isFinite(r.day)) { if (r.day < start) start = r.day; if (r.day > end) end = r.day }
  return {
    cfg, rows, vendors,
    start: Number.isFinite(start) ? start : NaN,
    end:   Number.isFinite(end) ? end : NaN,
  }
}

// ─── Findings ─────────────────────────────────────────────────────────────────

type Draft = Omit<DetectedAnomaly, 'id' | 'status' | 'detectedAt'>

function draft(type: AnomalyType, title: string, rows: Row[], fields: { amount: number; severity: Severity; confidence: number; description: string; reasoning: string; vendor?: string; category?: string }): Draft {
  return {
    type, title,
    vendor:      fields.vendor ?? rows[0].tx.vendor,
    amount:      Math.round(fields.amount * 100) / 100,
    severity:    fields.severity,
    confidence:  Math.max(1, Math.min(99, Math.round(fields.confidence))),
    description: fields.description,
    reasoning:   fields.reasoning,
    rowRefs:     rows.map(r => r.tx.id),
    category:    fields.category ?? (rows[0].tx.category || 'Uncategorized'),
  }
}

const capSeverity = (s: Severity, cap: Severity): Severity => (SEVERITY_ORDER[s] < SEVERITY_ORDER[cap] ? cap : s)

// ─── 1. Duplicate payments ────────────────────────────────────────────────────

/**
 * The same vendor paid the same amount twice.
 *
 * Judged on evidence, not on the calendar alone: a shared invoice reference
 * or the same day is strong; a series that recurs on a cadence (rent on the
 * 1st, a weekly cleaning fee, a fixed subscription) is routine unless a
 * payment lands inside the cycle; two different invoice numbers are two
 * invoices. Only the later row is the finding; the earlier one is the
 * original, carried as evidence.
 */
function detectDuplicates(ctx: Ctx): Draft[] {
  const { cfg } = ctx
  const out: Draft[] = []

  for (const v of ctx.vendors.values()) {
    const buckets = new Map<number, Row[]>()
    for (const r of v.rows) pushTo(buckets, cents(r.tx.amount), r)

    for (const [amt, group] of buckets) {
      if (group.length < 2) continue
      const series  = v.recurring.get(amt) ?? null
      const cadence = series?.days ?? null
      const dated   = group.filter(r => Number.isFinite(r.day))
      const undated = group.filter(r => !Number.isFinite(r.day))

      // In a recurring series each payment is measured from the last one that
      // kept the rhythm, so an extra payment never makes the next regular one
      // look early.
      let anchor = dated[0]
      for (let i = 1; i < dated.length; i++) {
        const earlier = cadence ? anchor : dated[i - 1], later = dated[i]
        const d = later.day - earlier.day
        if (cadence && d >= cadence * cfg.recurringExtraShare) anchor = later
        if (d > cfg.duplicateWindowDays) continue

        const shared   = [...later.refs].filter(x => earlier.refs.has(x))
        const conflict = later.refs.size > 0 && earlier.refs.size > 0 && shared.length === 0
        const sameDesc = !!later.desc && later.desc === earlier.desc
        const when     = d === 0 ? 'the same day' : `${plural(d, 'day')} earlier`

        let severity: Severity | null = null, confidence = 0, why = ''
        if (shared.length) {
          severity = d <= 7 ? 'CRITICAL' : 'HIGH'
          confidence = d <= 7 ? 97 : 93
          why = `Both payments carry invoice reference ${shared[0]}: the same invoice was paid twice.`
        } else if (cadence && d < cadence * cfg.recurringExtraShare) {
          // A different invoice number usually means a separate charge. Only a
          // strictly kept monthly-or-longer rhythm (rent, a retainer, a
          // premium) makes a second one inside the cycle suspicious anyway.
          if (conflict && (cadence < 28 || series!.strict < 0.8)) continue
          severity = conflict ? 'MEDIUM' : 'HIGH'
          confidence = conflict ? 76 : 90
          why = `${v.name} is paid ${fmtExact(later.tx.amount)} on a ${cadenceName(cadence)} rhythm. This payment lands ${plural(d, 'day')} after the last one, inside the cycle, so the period was paid twice.${conflict ? ' The invoice numbers differ, so confirm whether a second, separate charge was due.' : ''}`
        } else if (cadence) {
          continue // on the vendor's own rhythm: the next period's charge
        } else if (conflict) {
          if (d > 0) continue // two invoice numbers, on different days: two invoices
          severity = 'MEDIUM'; confidence = 70
          why = 'The invoice numbers differ, so these may be two separate invoices; two identical amounts to one vendor on one day is still worth confirming.'
        } else if (d === 0) {
          severity = 'CRITICAL'; confidence = sameDesc || (!later.desc && !earlier.desc) ? 96 : 90
          why = 'Same vendor, same amount to the cent, on the same day.'
        } else if (d <= 14) {
          severity = sameDesc ? 'HIGH' : 'MEDIUM'; confidence = sameDesc ? 86 : 74
          why = `Same vendor and amount to the cent, ${plural(d, 'day')} apart${sameDesc ? ', with the same description' : ''}, and no recurring rhythm that would explain it.`
        } else if (d < 25 && sameDesc) {
          severity = 'MEDIUM'; confidence = 70
          why = `Same vendor, amount and description ${plural(d, 'day')} apart, with no recurring rhythm that would explain it.`
        } else {
          continue
        }

        // Small duplicates are real but rarely worth a controller's morning.
        if (later.tx.amount < 100) { severity = capSeverity(severity, 'LOW'); confidence -= 10 }

        const title = shared.length ? 'Invoice paid twice'
          : cadence ? `Paid twice in one ${CYCLE_NAME[cadence] ?? 'cycle'}`
          : d === 0 ? 'Duplicate payment' : 'Possible duplicate payment'
        out.push(draft('duplicate', `${title} — ${v.name}`, [later, earlier], {
          amount: later.tx.amount, severity, confidence, vendor: later.tx.vendor,
          description: `${fmtAmt(later.tx.amount)} paid to ${later.tx.vendor} on ${later.tx.date} (${rowLabel(later.tx)}) repeats ${shared.length ? `invoice ${shared[0]}, ` : 'a payment '}paid on ${earlier.tx.date} (${rowLabel(earlier.tx)}), ${when}.`,
          reasoning: `${why} The ${later.tx.date} payment is flagged as the probable duplicate; the ${earlier.tx.date} payment is treated as the original and is not raised.`,
        }))
      }

      // Without dates only a shared invoice reference is evidence enough.
      for (let i = 0; i < undated.length; i++) {
        const later = undated[i]
        const match = [...group].find(o => o !== later && [...o.refs].some(x => later.refs.has(x)) && (Number.isFinite(o.day) || group.indexOf(o) < group.indexOf(later)))
        if (!match) continue
        const ref = [...later.refs].find(x => match.refs.has(x))!
        out.push(draft('duplicate', `Possible duplicate payment — ${v.name}`, [later, match], {
          amount: later.tx.amount, severity: 'HIGH', confidence: 88, vendor: later.tx.vendor,
          description: `${fmtAmt(later.tx.amount)} paid to ${later.tx.vendor} (${rowLabel(later.tx)}) repeats invoice ${ref} (${rowLabel(match.tx)}). The row has no date.`,
          reasoning: `Both payments carry invoice reference ${ref} for the same amount. The flagged row has no transaction date, so confirm when it was paid.`,
        }))
      }
    }
  }

  // The same invoice and amount paid under two different vendor records: a
  // duplicate vendor in the master file, or a payment redirected to a copy.
  const byRef = new Map<string, Row[]>()
  for (const r of ctx.rows) for (const ref of r.refs) {
    const k = `${cents(r.tx.amount)}|${ref}`
    pushTo(byRef, k, r)
  }
  for (const [k, group] of byRef) {
    const keys = new Set(group.map(r => r.key))
    if (keys.size < 2) continue
    const sorted = [...group].sort((a, b) => (a.day || 0) - (b.day || 0))
    const first = sorted[0]
    const later = sorted.find(r => r.key !== first.key)!
    if (Number.isFinite(first.day) && Number.isFinite(later.day) && later.day - first.day > cfg.duplicateWindowDays * 3) continue
    const ref = k.split('|')[1]
    out.push(draft('duplicate', `Same invoice paid to two vendor records — ${later.tx.vendor}`, [later, first], {
      amount: later.tx.amount, severity: 'HIGH', confidence: 88, vendor: later.tx.vendor,
      description: `Invoice ${ref} for ${fmtAmt(later.tx.amount)} was paid to ${first.tx.vendor} on ${first.tx.date || 'an undated row'} (${rowLabel(first.tx)}) and to ${later.tx.vendor} on ${later.tx.date || 'an undated row'} (${rowLabel(later.tx)}).`,
      reasoning: 'The same invoice reference and amount appear under two different vendor names. Either the vendor exists twice in the master file, which lets one invoice be paid twice, or a payment went to a look-alike record. Confirm which record is genuine.',
    }))
  }
  return out
}

const CYCLE_NAME: Record<number, string> = { 7: 'week', 14: 'two-week cycle', 30.4: 'month', 91: 'quarter', 365: 'year' }

function cadenceName(c: number): string {
  return c === 7 ? 'weekly' : c === 14 ? 'two-weekly' : c === 91 ? 'quarterly' : c === 365 ? 'yearly' : 'monthly'
}

// ─── 2. Vendor-relative amount outlier ────────────────────────────────────────

/**
 * Far above what this vendor is usually paid.
 *
 * Each payment is compared with the vendor's *other* payments: their median
 * and median absolute deviation. Including the payment in its own baseline
 * (a mean and standard deviation over all of them) hides it: with fewer than
 * nine payments a single outlier can never reach 2.5 standard deviations.
 */
function detectVendorOutliers(ctx: Ctx): Draft[] {
  const { cfg } = ctx
  const out: Draft[] = []
  for (const v of ctx.vendors.values()) {
    const n = v.rows.length
    if (n < cfg.vendorMinHistory + 1) continue
    // Sorted once; each payment's baseline is the median of the others, read
    // off the sorted list by position rather than re-sorted per payment.
    const order = v.rows.map((r, i) => i).sort((a, b) => v.rows[a].tx.amount - v.rows[b].tx.amount)
    const sorted = order.map(i => v.rows[i].tx.amount)
    const spread = 1.4826 * mad(sorted)
    const at = (k: number, skip: number) => sorted[k < skip ? k : k + 1]   // k-th of the others
    for (let pos = 0; pos < n; pos++) {
      const r = v.rows[order[pos]]
      const m = n - 1
      const med = m % 2 ? at((m - 1) / 2, pos) : (at(m / 2 - 1, pos) + at(m / 2, pos)) / 2
      if (med <= 0) continue
      const scale  = Math.max(spread, 0.1 * med)
      const ratio  = r.tx.amount / med
      const z      = (r.tx.amount - med) / scale
      const excess = r.tx.amount - med
      if (ratio < cfg.vendorRatio || z < cfg.vendorRobustZ || excess < cfg.minExcess) continue

      const severity: Severity = ratio >= 8 && r.tx.amount >= cfg.approvalLimit ? 'CRITICAL' : ratio >= 5 ? 'HIGH' : 'MEDIUM'
      out.push(draft('outlier', `Unusual amount for this vendor — ${v.name}`, [r], {
        amount: r.tx.amount, severity,
        confidence: Math.min(96, 60 + 9 * Math.log2(ratio) + Math.min(8, m)),
        description: `${fmtAmt(r.tx.amount)} to ${r.tx.vendor} on ${r.tx.date || 'an undated row'} is ${ratio.toFixed(1)}× this vendor's usual ${fmtAmt(med)} (${rowLabel(r.tx)}).`,
        reasoning: `Across ${v.name}'s ${plural(m, 'other payment')}, the median is ${fmtAmt(med)}. This one is ${ratio.toFixed(1)} times that, far outside the vendor's own spread. It is measured against this vendor only, so a vendor that is routinely large never trips it.`,
      }))
    }
  }
  return out
}

// ─── 3. Category-relative amount outlier ──────────────────────────────────────

/**
 * Far above anything else in its category, from a vendor with too little
 * history to have a baseline of its own.
 *
 * Judged against the top of the category's range (the 95th percentile of
 * other vendors' payments), not its median. A category such as Software
 * legitimately holds a $50 tool and a $40,000 cloud bill; only a payment well
 * beyond the largest routine spend in it says anything.
 */
function detectCategoryOutliers(ctx: Ctx): Draft[] {
  const { cfg } = ctx
  const out: Draft[] = []
  const byCat = new Map<string, Row[]>()
  for (const r of ctx.rows) {
    const c = (r.tx.category || 'Uncategorized').trim().toLowerCase()
    pushTo(byCat, c, r)
  }
  // Each category sorted once, with its vendor count.
  const catStats = new Map<string, { sorted: number[]; vendors: Map<string, number> }>()
  for (const [c, rows] of byCat) {
    const vendors = new Map<string, number>()
    for (const r of rows) vendors.set(r.key, (vendors.get(r.key) ?? 0) + 1)
    catStats.set(c, { sorted: rows.map(r => r.tx.amount).sort((a, b) => a - b), vendors })
  }

  for (const v of ctx.vendors.values()) {
    if (v.rows.length > cfg.vendorMinHistory) continue // judged against its own history instead
    for (const r of v.rows) {
      const cat = (r.tx.category || '').trim()
      // Without a real category there is no like-for-like range: rent compared
      // with stationery says nothing.
      if (!cat || cat.toLowerCase() === 'uncategorized') continue
      const stats = catStats.get(cat.toLowerCase())
      if (!stats) continue
      const own = stats.vendors.get(v.key) ?? 0
      const otherCount = stats.sorted.length - own
      const otherVendors = stats.vendors.size - (own ? 1 : 0)
      if (otherCount < cfg.categoryMinRows || otherVendors < cfg.categoryMinVendors) continue
      // The category's range without this vendor's own few payments.
      let pool = stats.sorted
      if (own) {
        pool = [...stats.sorted]
        for (const o of v.rows) if ((o.tx.category || '').trim().toLowerCase() === cat.toLowerCase()) {
          const i = pool.lastIndexOf(o.tx.amount)
          if (i >= 0) pool.splice(i, 1)
        }
      }
      const top    = quantile(pool, 0.95)
      if (top <= 0) continue
      const ratio  = r.tx.amount / top
      if (ratio < cfg.categoryHighMultiple || r.tx.amount - top < cfg.minExcess) continue
      // A vendor whose every payment sits at this level is simply a large
      // vendor in this category; only a payment that also stands out from the
      // vendor's own other payments is news.
      let ownMax = 0
      for (const o of v.rows) if (o !== r && o.tx.amount > ownMax) ownMax = o.tx.amount
      if (ownMax && r.tx.amount < 2 * ownMax) continue

      const scope = cat
      out.push(draft('large_amount', `Far above its category — ${v.name}`, [r], {
        amount: r.tx.amount, severity: ratio >= 8 ? 'HIGH' : 'MEDIUM',
        confidence: Math.min(92, 64 + 8 * Math.log2(ratio)),
        description: `${fmtAmt(r.tx.amount)} to ${r.tx.vendor} on ${r.tx.date || 'an undated row'} is ${ratio.toFixed(1)}× the top of ${scope} spend (${rowLabel(r.tx)}).`,
        reasoning: `${v.name} has ${v.rows.length === 1 ? 'no other payments' : `only ${plural(v.rows.length - 1, 'other payment')}`} here, too few for a baseline of its own, so it is compared with ${scope}: ${plural(otherCount, 'payment')} to ${plural(otherVendors, 'other vendor')}, 95% of them at or below ${fmtAmt(top)}. This payment is ${ratio.toFixed(1)} times that.`,
      }))
    }
  }
  return out
}

// ─── 4. Approval control proximity ────────────────────────────────────────────

/**
 * Payments to one vendor clustered just beneath the approval limit.
 *
 * No single payment breaches the control, so no amount rule can see it. The
 * signature is the cluster: three or more inside a week, or two within a few
 * days. A fixed fee that simply recurs at that level is a rhythm, not a split.
 */
function detectApprovalAvoidance(ctx: Ctx): Draft[] {
  const { cfg } = ctx
  const out: Draft[] = []
  const low = cfg.approvalLimit * cfg.approvalBandLow

  for (const v of ctx.vendors.values()) {
    const band = v.rows.filter(r => Number.isFinite(r.day) && r.tx.amount >= low && r.tx.amount <= cfg.approvalLimit && !v.recurring.has(cents(r.tx.amount)))
    let i = 0
    while (i < band.length) {
      let j = i
      while (j + 1 < band.length && band[j + 1].day - band[i].day <= cfg.approvalWindowDays) j++
      const cluster = band.slice(i, j + 1)
      const span = cluster[cluster.length - 1].day - cluster[0].day
      if (cluster.length >= 3 || (cluster.length === 2 && span <= cfg.approvalPairMaxDays)) {
        const total = cluster.reduce((s, r) => s + r.tx.amount, 0)
        out.push(draft('approval_avoidance', `Payments split under the approval limit — ${v.name}`, cluster, {
          amount: total, severity: cluster.length >= 3 ? 'CRITICAL' : 'HIGH', confidence: cluster.length >= 3 ? 94 : 84,
          description: `${cluster.length} payments to ${v.name} totalling ${fmtAmt(total)} between ${cluster[0].tx.date} and ${cluster[cluster.length - 1].tx.date}, each between ${fmtAmt(low)} and ${fmtAmt(cfg.approvalLimit)}, none individually needing ${fmtAmt(cfg.approvalLimit)} approval.`,
          reasoning: `Each payment clears the ${fmtAmt(cfg.approvalLimit)} approval limit on its own, yet together they total ${fmtAmt(total)} across ${plural(span, 'day')}. Several payments to one vendor landing just under a limit within a week is the signature of an invoice split to avoid approval. Confirm them against the underlying invoices.`,
        }))
        i = j + 1
      } else i++
    }
  }
  return out
}

// ─── 5. Velocity, against the vendor's own rhythm ────────────────────────────

/** The densest run of payments inside a window of W days, by two pointers. */
function densest(rows: Row[], W: number): { from: number; to: number; count: number } {
  let best = { from: 0, to: -1, count: 0 }
  for (let i = 0, j = 0; i < rows.length; i++) {
    if (j < i) j = i
    while (j + 1 < rows.length && rows[j + 1].day - rows[i].day < W) j++
    if (j - i + 1 > best.count) best = { from: i, to: j, count: j - i + 1 }
  }
  return best
}

/**
 * More payments in a week than the vendor's own rhythm explains.
 *
 * The busiest week is compared with the vendor's busiest *other* week, not
 * with a model of chance. Taking each vendor's busiest week out of fifty-two
 * and testing it as if it were the only one finds bursts in pure noise; and a
 * Poisson model cannot tell a vendor paid like clockwork (where six in a week
 * is extraordinary) from one paid at random. The vendor's own record can.
 *
 * A vendor that first appears inside the register (weeks of coverage before
 * it in which it was never paid) and is immediately paid several times is
 * judged the same way against whatever follows.
 */
function detectVelocity(ctx: Ctx): Draft[] {
  const { cfg } = ctx
  const out: Draft[] = []
  const W = cfg.velocityWindowDays

  for (const v of ctx.vendors.values()) {
    const rows = v.rows.filter(r => Number.isFinite(r.day))
    if (rows.length < 2) continue
    const first = rows[0].day

    if (first - ctx.start >= cfg.newVendorGraceDays) {
      const burst = rows.filter(r => r.day - first < W)
      if (burst.length < cfg.velocityNewVendorMinCount) continue
      const restMax = densest(rows.slice(burst.length), W).count
      if (restMax && (burst.length < cfg.velocityBurstMultiple * restMax || burst.length - restMax < 2)) continue
      const total = burst.reduce((s, r) => s + r.tx.amount, 0)
      out.push(draft('high_frequency', `New vendor paid ${burst.length} times in its first week — ${v.name}`, burst, {
        amount: total, severity: 'HIGH', confidence: 86,
        description: `${plural(burst.length, 'payment')} to ${v.name} totalling ${fmtAmt(total)} within ${plural(W, 'day')} of its first appearance on ${rows[0].tx.date}.`,
        reasoning: `${v.name} is not paid anywhere in the ${plural(first - ctx.start, 'day')} of this register before ${rows[0].tx.date}, then receives ${plural(burst.length, 'payment')} in ${plural(W, 'day')}${restMax ? `, against at most ${restMax} in any week since` : ''}. A new vendor has no established rhythm to justify that frequency. Confirm the vendor and that each invoice is distinct.`,
      }))
      continue
    }

    const activeDays = rows[rows.length - 1].day - first + 1 - W
    if (activeDays < 4 * W) continue // too little history to know the vendor's rhythm
    const peak = densest(rows, W)
    const window = rows.slice(peak.from, peak.to + 1)
    const rest = [...rows.slice(0, peak.from), ...rows.slice(peak.to + 1)]
    const restMax = densest(rest, W).count
    const k = peak.count
    if (restMax === 0 || k < cfg.velocityBurstMultiple * restMax || k - restMax < cfg.velocityMinExcessCount) continue

    const total = window.reduce((s, r) => s + r.tx.amount, 0)
    out.push(draft('high_frequency', `Paid more often than usual — ${v.name}`, window, {
      amount: total, severity: k >= 3 * restMax ? 'HIGH' : 'MEDIUM', confidence: k >= 3 * restMax ? 85 : 78,
      description: `${plural(k, 'payment')} to ${v.name} totalling ${fmtAmt(total)} between ${window[0].tx.date} and ${window[k - 1].tx.date}, where its busiest other ${plural(W, 'day')} hold ${restMax}.`,
      reasoning: `Across ${plural(rows.length, 'payment')} to ${v.name}, no other ${W}-day stretch holds more than ${restMax}. This one holds ${k}. Measuring against the vendor's own rhythm keeps routine high-frequency vendors out of the queue and makes a sudden change in a steady one stand out.`,
    }))
  }
  return out
}

// ─── 6. Vendor to category consistency ────────────────────────────────────────

/**
 * A vendor with an established coding pattern suddenly booked elsewhere.
 * A vendor genuinely split across two categories is left alone: the usual
 * category must hold most of its payments and the departures must be rare.
 */
function detectCategoryMismatch(ctx: Ctx): Draft[] {
  const { cfg } = ctx
  const out: Draft[] = []
  for (const v of ctx.vendors.values()) {
    const coded = v.rows.filter(r => r.tx.category && r.tx.category.trim().toLowerCase() !== 'uncategorized')
    const counts = new Map<string, Row[]>()
    for (const r of coded) {
      const c = r.tx.category.trim().toLowerCase()
      pushTo(counts, c, r)
    }
    if (counts.size < 2) continue
    const [modalKey, modalRows] = [...counts.entries()].sort((a, b) => b[1].length - a[1].length)[0]
    if (modalRows.length < cfg.categoryConsistencyMinHistory || modalRows.length / coded.length < cfg.categoryConsistencyShare) continue
    const departures = coded.filter(r => r.tx.category.trim().toLowerCase() !== modalKey)
    if (departures.length > 2) continue
    const modal = modalRows[0].tx.category.trim()

    for (const r of departures) {
      out.push(draft('category_mismatch', `Coded differently from this vendor's history — ${v.name}`, [r], {
        amount: r.tx.amount, severity: 'MEDIUM', confidence: 72 + Math.min(20, modalRows.length),
        description: `${fmtAmt(r.tx.amount)} to ${r.tx.vendor} on ${r.tx.date || 'an undated row'} is coded ${r.tx.category.trim()}, while ${modalRows.length} of ${v.name}'s ${coded.length} payments are coded ${modal} (${rowLabel(r.tx)}).`,
        reasoning: `${v.name} is coded ${modal} on ${Math.round((modalRows.length / coded.length) * 100)}% of its payments. A rare departure to ${r.tx.category.trim()} usually means a miscode, which distorts category reporting and can route spend past the wrong budget owner.`,
        category: r.tx.category.trim(),
      }))
    }
  }
  return out
}

// ─── 7. Period integrity ──────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

/** Parse period labels such as "Jan-26", "January 2026", "2026-01", "01/2026". */
export function parsePeriodLabel(label: string): { year: number; month: number } | null {
  const s = label.trim().toLowerCase()
  if (!s) return null

  let m = /^([a-z]{3})[a-z]*\.?[\s\-/]+(\d{2}|\d{4})$/.exec(s)
  if (m && MONTHS[m[1]] !== undefined) {
    const yr = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2])
    return { year: yr, month: MONTHS[m[1]] }
  }
  m = /^(\d{4})[\s\-/.](\d{1,2})$/.exec(s)
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return { year: Number(m[1]), month: Number(m[2]) - 1 }
  m = /^(\d{1,2})[\s\-/.](\d{4})$/.exec(s)
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) return { year: Number(m[2]), month: Number(m[1]) - 1 }
  return null
}

const monthIndex = (iso: string) => {
  const m = /^(\d{4})-(\d{2})/.exec(iso)
  return m ? Number(m[1]) * 12 + Number(m[2]) - 1 : NaN
}
const monthName = (idx: number) => `${Object.keys(MONTHS)[idx % 12].replace(/^./, c => c.toUpperCase())} ${Math.floor(idx / 12)}`

/**
 * A row whose date falls outside the accounting period it is labelled with.
 *
 * The file's own calendar is learned first: when most rows agree on one
 * offset between label and date (a fiscal year that starts in July, say),
 * that offset is the rule and only rows that break it are reported. A row
 * dated after its period was recognised early; one dated before was posted
 * late and should have been accrued.
 */
function detectPeriodMismatch(ctx: Ctx, all: StoredTransaction[]): Draft[] {
  const { cfg } = ctx
  const labelled = all
    .filter(t => t.period && t.date)
    .map(t => ({ t, p: parsePeriodLabel(t.period!), d: monthIndex(t.date) }))
    .filter((x): x is { t: StoredTransaction; p: { year: number; month: number }; d: number } => !!x.p && Number.isFinite(x.d))
  if (labelled.length === 0) return []

  const offsets = new Map<number, number>()
  for (const x of labelled) {
    const o = x.p.year * 12 + x.p.month - x.d
    offsets.set(o, (offsets.get(o) ?? 0) + 1)
  }
  const [mode, modeCount] = [...offsets.entries()].sort((a, b) => b[1] - a[1])[0]
  if (modeCount / labelled.length < cfg.periodConsistencyShare) return [] // labels too inconsistent to trust

  const off = labelled.filter(x => x.p.year * 12 + x.p.month - x.d !== mode)
  const byTx = new Map(ctx.rows.map(r => [r.tx, r]))
  const rowOf = (t: StoredTransaction): Row => byTx.get(t) ?? { tx: t, day: dayNumber(t.date), key: vendorKey(t.vendor), refs: new Set(), desc: '' }
  const calendar = mode === 0 ? '' : ` In this file a period label sits ${plural(Math.abs(mode), 'month')} ${mode > 0 ? 'ahead of' : 'behind'} the calendar month, a fiscal calendar learned from ${Math.round((modeCount / labelled.length) * 100)}% of rows.`

  if (off.length > cfg.periodGroupAbove) {
    const total = off.reduce((s, x) => s + x.t.amount, 0)
    return [draft('period_mismatch', `${off.length} transactions posted outside their stated period`, off.map(x => rowOf(x.t)), {
      amount: total, severity: 'MEDIUM', confidence: 90, vendor: 'Several vendors',
      description: `${off.length} rows totalling ${fmtAmt(total)} are dated outside the accounting period they are labelled with.`,
      reasoning: `Each of these rows posts to a different period from the one its date belongs to, which misstates both periods. Correct them at source rather than widening the reporting window to absorb them.${calendar}`,
      category: 'Period integrity',
    })]
  }

  return off.map(x => {
    const expected = x.p.year * 12 + x.p.month - mode // calendar month the label stands for
    const diff = x.d - expected                       // >0: dated after its period
    const crossesYear = mode === 0 && Math.floor(x.d / 12) !== Math.floor(expected / 12)
    let severity: Severity, confidence: number, why: string
    if (diff > 0) {
      severity = crossesYear || diff >= 2 ? 'HIGH' : 'MEDIUM'; confidence = crossesYear ? 95 : 92
      why = `It is dated ${monthName(x.d)} but posted to the ${x.t.period} period, so it was recognised before it happened.${crossesYear ? ' It also crosses a year end, which misstates both years.' : ''}`
    } else if (diff === -1) {
      severity = 'LOW'; confidence = 64
      why = `It is dated ${monthName(x.d)} and posted to the following period, ${x.t.period}. Late invoices often land this way; confirm it was accrued in ${monthName(x.d)}.`
    } else {
      severity = crossesYear ? 'HIGH' : 'MEDIUM'; confidence = 88
      why = `It is dated ${monthName(x.d)} but posted to ${x.t.period}, ${plural(-diff, 'month')} later, so ${monthName(x.d)} is understated unless it was accrued.`
    }
    return draft('period_mismatch', `Posted outside its period — ${x.t.vendor || 'no payee'}`, [rowOf(x.t)], {
      amount: x.t.amount, severity, confidence,
      description: `${fmtAmt(x.t.amount)} to ${x.t.vendor || 'no payee'} is dated ${x.t.date} but labelled period ${x.t.period} (${rowLabel(x.t)}).`,
      reasoning: `${why} Correct it at source rather than widening the reporting window to absorb it.${calendar}`,
    })
  })
}

// ─── 8. New vendor, several signals ───────────────────────────────────────────

/**
 * A vendor first seen inside the register, carrying several weak signals at
 * once: round amount, a weekend posting, material size, or an amount just
 * under the approval limit. Each is weak alone; together they describe a
 * payment that may never have been through normal procurement.
 *
 * "New" needs evidence: the vendor must first appear weeks after the register
 * begins. A vendor paid once in a one-month export is just monthly.
 */
function detectNewVendorRisk(ctx: Ctx): Draft[] {
  const { cfg } = ctx
  const out: Draft[] = []
  for (const v of ctx.vendors.values()) {
    const rows = v.rows.filter(r => Number.isFinite(r.day))
    if (rows.length === 0 || rows.length > 2 || v.rows.length > 2) continue
    // Provably new: weeks of register before it with no payment to it. Otherwise
    // its history may sit before the export, and only the payment's own
    // signals count, so all three of round, weekend and material must agree.
    const provenNew = rows[0].day - ctx.start >= cfg.newVendorGraceDays
    if (!provenNew && v.rows.length > 1) continue

    for (const r of rows) {
      const signals: string[] = provenNew ? [`first paid on ${rows[0].tx.date}, ${plural(rows[0].day - ctx.start, 'day')} into the register`] : []
      let score = provenNew ? 2 : 0
      if (v.rows.length === 1 && provenNew) { score += 1; signals.push('its only payment') }
      if (!provenNew) signals.push('its only payment in the register')
      if (r.tx.amount >= cfg.roundNumberMin && isRoundThousand(r.tx.amount)) { score += 2; signals.push(`a round ${fmtAmt(r.tx.amount)}`) }
      if (isWeekend(r.day)) { score += 2; signals.push('posted on a weekend') }
      if (r.tx.amount > cfg.approvalLimit) { score += 2; signals.push(`above the ${fmtAmt(cfg.approvalLimit)} approval limit`) }
      else if (r.tx.amount >= cfg.approvalLimit * cfg.approvalBandLow) { score += 2; signals.push(`just under the ${fmtAmt(cfg.approvalLimit)} approval limit`) }
      if (score < cfg.newVendorScoreThreshold) continue

      out.push(draft('new_vendor_risk', `${provenNew ? 'New vendor' : 'One-off payment'}, several risk signals — ${v.name}`, [r], {
        amount: r.tx.amount, severity: score >= cfg.newVendorHighScore ? 'HIGH' : 'MEDIUM', confidence: provenNew ? 50 + score * 5 : 76,
        description: `${fmtAmt(r.tx.amount)} to ${r.tx.vendor} on ${r.tx.date} (${rowLabel(r.tx)}): ${signals.join(', ')}.`,
        reasoning: provenNew
          ? `${plural(signals.length, 'signal')} on one payment to a vendor with no earlier history in this register. None is conclusive alone, which is why they are scored together rather than raised separately. Confirm the vendor exists in the master file, its bank details, and that the invoice is supported.`
          : `This register is too short to say whether ${v.name} is new, but its only payment carries every weak signal at once: a round, material amount posted on a weekend. Confirm the vendor exists in the master file and that the invoice is supported.`,
      }))
    }
  }
  return out
}

// ─── 9. Round number, unusual for the vendor ──────────────────────────────────

/**
 * A round amount from a vendor that otherwise bills irregular figures: an
 * estimate or a fabricated invoice rather than a computed one. A vendor that
 * always bills round amounts (rent, a retainer) is left alone.
 */
function detectRoundNumbers(ctx: Ctx): Draft[] {
  const { cfg } = ctx
  const out: Draft[] = []
  for (const v of ctx.vendors.values()) {
    if (v.rows.length < 5) continue
    const irregularAll = v.rows.filter(o => !isRoundHundred(o.tx.amount)).length
    for (const r of v.rows) {
      if (r.tx.amount < cfg.roundNumberMin || !isRoundThousand(r.tx.amount) || v.recurring.has(cents(r.tx.amount))) continue
      const others = { length: v.rows.length - 1 }
      const irregular = irregularAll / others.length // this payment is round, so every irregular one is another
      if (irregular < cfg.roundOthersIrregularShare) continue
      out.push(draft('round_number', `Round amount, unusual for this vendor — ${v.name}`, [r], {
        amount: r.tx.amount, severity: 'LOW', confidence: 60,
        description: `${fmtAmt(r.tx.amount)} to ${r.tx.vendor} on ${r.tx.date || 'an undated row'} is a round amount, while ${Math.round(irregular * 100)}% of its other ${plural(others.length, 'payment')} are irregular figures (${rowLabel(r.tx)}).`,
        reasoning: 'A round figure from a vendor that otherwise bills computed amounts can mean an estimate, a deposit or an unsupported invoice. Weak on its own, so it is raised at low severity and kept out of risk exposure; check that an invoice supports it.',
      }))
    }
  }
  return out
}

// ─── 10. Missing payee ────────────────────────────────────────────────────────

function detectMissingVendor(txs: StoredTransaction[], cfg: DetectionConfig): Draft[] {
  const blanks = txs.filter(t => t.amount > 0 && isMissingVendor(t.vendor))
  if (blanks.length === 0) return []
  const total = blanks.reduce((s, t) => s + t.amount, 0)
  const rows: Row[] = blanks.map(tx => ({ tx, day: dayNumber(tx.date), key: '', refs: new Set(), desc: '' }))
  return [draft('missing_vendor', `${plural(blanks.length, 'payment')} with no payee`, rows, {
    amount: total, severity: blanks.length > 10 || total >= cfg.approvalLimit ? 'HIGH' : 'MEDIUM', confidence: 99,
    vendor: '(no payee)', category: 'Data quality',
    description: `${plural(blanks.length, 'payment')} totalling ${fmtAmt(total)} name no vendor or payee.`,
    reasoning: 'Every payment must identify who was paid. A blank payee means a data-entry gap, a broken export mapping, or a payment nobody wants traced. Identify the counterparty for each row.',
  })]
}

// ─── Merging ──────────────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<Severity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
const rank = (f: Draft) => SEVERITY_ORDER[f.severity] * 1000 - f.confidence

/** The rows a finding actually flags. A duplicate's later rows are its original, carried as evidence. */
export function flaggedRows(f: Pick<DetectedAnomaly, 'type' | 'rowRefs'>): string[] {
  return f.type === 'duplicate' ? f.rowRefs.slice(0, 1) : f.rowRefs
}

/**
 * One finding per event. When several rules fire on the same rows, the
 * strongest becomes the finding and the others are carried on it as further
 * signals, so a reviewer sees "posted outside its period" and "new vendor"
 * together on one payment rather than two findings that compete.
 */
function merge(drafts: Draft[]): Draft[] {
  const sorted = [...drafts].sort((a, b) => rank(a) - rank(b) || b.rowRefs.length - a.rowRefs.length)
  const kept: Draft[] = []
  const owner = new Map<string, Draft>()
  for (const f of sorted) {
    const rows = flaggedRows(f)
    const tally = new Map<Draft, number>()
    for (const r of rows) { const o = owner.get(r); if (o) tally.set(o, (tally.get(o) ?? 0) + 1) }
    const [best, n] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0]
    if (best && n / rows.length >= 0.8) {
      if (best.type !== f.type && !(best.alsoMatched ?? []).some(s => s.type === f.type)) {
        best.alsoMatched = [...(best.alsoMatched ?? []), { type: f.type, title: f.title.split(' — ')[0], detail: f.description }]
      }
      continue
    }
    kept.push(f)
    for (const r of rows) if (!owner.has(r)) owner.set(r, f)
  }
  // Independent checks agreeing on the same payment are stronger evidence than
  // any one of them: each adds confidence, and corroborated findings below
  // HIGH step up one level.
  for (const f of kept) {
    const n = (f.alsoMatched ?? []).length
    if (!n) continue
    f.confidence = Math.min(99, f.confidence + 3 * n)
    if (f.severity === 'MEDIUM') f.severity = 'HIGH'
    else if (f.severity === 'LOW') f.severity = 'MEDIUM'
  }
  return kept
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export interface DetectionOptions {
  /** Prefix for finding ids, so findings from separate sources never collide. */
  idPrefix?: string
}

export function runAnomalyDetection(
  allTxs: StoredTransaction[],
  config: Partial<DetectionConfig> = {},
  options: DetectionOptions = {},
): DetectedAnomaly[] {
  const cfg: DetectionConfig = { ...DEFAULT_DETECTION_CONFIG, ...config }

  // Credits (refunds, rebates, reversals) are not spend and must never reach
  // these checks: a refund beside its original charge is not a duplicate,
  // and inflows would skew every baseline.
  const txs = allTxs.filter(t => t.direction !== 'credit' && t.amount > 0)
  const ctx = buildContext(txs, cfg)

  const drafts = merge([
    ...detectDuplicates(ctx),
    ...detectApprovalAvoidance(ctx),
    ...detectPeriodMismatch(ctx, txs),
    ...detectVendorOutliers(ctx),
    ...detectCategoryOutliers(ctx),
    ...detectVelocity(ctx),
    ...detectNewVendorRisk(ctx),
    ...detectCategoryMismatch(ctx),
    ...detectRoundNumbers(ctx),
    ...detectMissingVendor(txs, cfg),
  ]).sort((a, b) => rank(a) - rank(b))

  const now = new Date().toISOString()
  const prefix = options.idPrefix ? `${options.idPrefix}-` : ''
  return drafts.map((d, i) => ({
    ...d,
    id:         `ANO-${prefix}${String(i + 1).padStart(3, '0')}`,
    status:     'Open',
    detectedAt: now,
  }))
}

// ─── Risk exposure ────────────────────────────────────────────────────────────

/** Findings that put money in question. Miscoding and period errors misstate reports; they do not lose money. */
const MONEY_AT_RISK = new Set<AnomalyType>(['duplicate', 'approval_avoidance', 'outlier', 'large_amount', 'high_frequency', 'new_vendor_risk', 'missing_vendor', 'round_number'])

/**
 * Amount genuinely at risk, rather than the sum of everything flagged.
 *
 * Counting every finding's amount double counts rows touched by more than one
 * rule and sweeps in low-confidence signals, which is how exposure ends up at
 * most of total spend and stops meaning anything. Only findings that put
 * money in question count, only at or above the confidence floor, only while
 * still undecided, and each flagged row once (a duplicate's original is not
 * at risk; its repeat is).
 */
export function computeRiskExposure(
  findings: DetectedAnomaly[],
  txs: StoredTransaction[] = [],
  config: Partial<DetectionConfig> = {},
): { exposure: number; countedRows: number; floor: number } {
  const cfg: DetectionConfig = { ...DEFAULT_DETECTION_CONFIG, ...config }
  const amountByRow = new Map(txs.map(t => [t.id, t.amount]))

  const rows = new Map<string, number>()
  for (const f of findings) {
    if (!MONEY_AT_RISK.has(f.type)) continue
    if (f.confidence < cfg.exposureConfidenceFloor) continue
    if (f.status === 'Resolved' || f.status === 'Dismissed') continue
    const flagged = flaggedRows(f)
    if (flagged.every(r => amountByRow.has(r))) for (const r of flagged) rows.set(r, amountByRow.get(r)!)
    else rows.set(`finding:${f.id}`, f.amount) // rows not kept on this device: fall back to the finding's own amount
  }
  let exposure = 0
  for (const a of rows.values()) exposure += a
  return { exposure, countedRows: rows.size, floor: cfg.exposureConfidenceFloor }
}
