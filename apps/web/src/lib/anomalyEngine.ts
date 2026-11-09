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

/** Probability of at least k events when lambda are expected (Poisson upper tail). */
function poissonTail(k: number, lambda: number): number {
  if (k <= 0) return 1
  let term = Math.exp(-lambda), cdf = term
  for (let i = 1; i < k; i++) { term *= lambda / i; cdf += term }
  return Math.max(0, 1 - cdf)
}

// ─── Vendor identity ──────────────────────────────────────────────────────────

const LEGAL_SUFFIXES = new Set([
  'inc', 'incorporated', 'llc', 'ltd', 'limited', 'co', 'company', 'corp', 'corporation',
  'plc', 'gmbh', 'pty', 'sa', 'ag', 'bv', 'nv', 'lp', 'llp', 'pllc', 'pc', 'srl', 'oy', 'ab',
])
const MISSING_NAMES = new Set(['', 'various', 'misc', 'miscellaneous', 'sundry', 'cash', 'one time vendor', 'unknown', 'unknown vendor', 'unknown payee', 'n a', 'na', 'none', 'tbd', 'no vendor', 'no payee', 'blank', 'null'])

/**
 * One key per real-world vendor. "Summit Print Co.", "Summit Print Company"
 * and "SUMMIT PRINT" are the same supplier; treating them as three is how the
 * same invoice gets paid twice without either payment looking repeated.
 */
export function vendorKey(name: string): string {
  const toks = (name || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/&/g, ' and ').split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  if (toks.length > 1 && toks[0] === 'the') toks.shift()
  while (toks.length > 1 && LEGAL_SUFFIXES.has(toks[toks.length - 1])) toks.pop()
  return toks.join(' ')
}

export function isMissingVendor(name: string): boolean {
  return MISSING_NAMES.has(vendorKey(name))
}

/**
 * Invoice-like references in a description: tokens that mix letters and
 * digits (INV-10423, PO88121), follow a "#" or "No.", or run to five or more
 * digits. A bare four-digit number is more often a year or a model number
 * ("Lift 1932") than an invoice, and treating it as one makes every monthly
 * rental of that machine look like the same invoice paid again.
 */
function refsOf(desc: string): Set<string> {
  const out = new Set<string>()
  const toks = (desc || '').split(/[\s,;|]+/)
  for (let i = 0; i < toks.length; i++) {
    const raw = toks[i]
    const t = raw.replace(/^[#(\[]+|[)\].:]+$/g, '')
    const digits = (t.match(/\d/g) ?? []).length
    if (digits < 3) continue
    if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(t) || /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(t)) continue
    if (/^[$£€]?\d{1,3}(,\d{3})*(\.\d{2})$/.test(t) || /^[$£€]?\d+\.\d{2}$/.test(t)) continue
    const lettered = /[a-z]/i.test(t)
    const labelled = raw.startsWith('#') || /^(no|nr|num|inv|invoice|ref|po|bill)\.?:?#?$/i.test(toks[i - 1] ?? '')
    if (!lettered && !labelled && digits < 5) continue
    out.add(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))
  }
  return out
}

/**
 * The keys of a real invoice number. Clerks retype these, and "SPS-48213",
 * "SPS48213" and "48213" all get past an ERP's duplicate check, so the digits
 * are a key of their own once there are enough of them to mean something.
 */
function invoiceRefs(invoice: string): Set<string> {
  const out = new Set<string>()
  // Leading zeros are padding: 0001234 and 1234 are one number.
  const canon = invoice.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/\d+/g, d => d.replace(/^0+/, '') || '0')
  if (canon) out.add(canon)
  const run = (invoice.match(/\d+/g) ?? []).map(d => d.replace(/^0+/, '')).sort((a, b) => b.length - a.length)[0] ?? ''
  if (run.length >= 5) out.add('#' + run)
  return out
}

/** Two figures made of the same digits but in another order: a keying slip. */
function transposed(a: number, b: number): boolean {
  if (cents(a) === cents(b)) return false
  const sort = (n: number) => String(cents(n)).split('').sort().join('')
  return sort(a) === sort(b)
}

/** Entries that are not payments to a vendor. */
const notPayment = (t: StoredTransaction) => t.source === 'journal' || t.source === 'payroll'

/**
 * The chance that a vendor's payments produce this exact amount, to the cent,
 * within `window` days by coincidence: how many of its payments fall in such
 * a window, times how likely any one of them is to land on this cent, judged
 * from how densely its amounts crowd around this one. A fuel card paid fifty
 * times a day repeats amounts by chance; a supplier invoicing twice a month
 * does not.
 */
function coincidence(v: Vendor, amount: number, window: number): number {
  let near = 1
  for (const r of v.rows) { const d = Math.abs(r.tx.amount - amount); if (d > 0 && d <= amount * 0.02) near++ }
  const perCent = near / (v.rows.length * Math.max(1, amount * 0.04 * 100))
  return v.perDay * (2 * window + 1) * perCent
}

/** Wording that marks one of several planned payments against the same invoice. */
const INSTALMENT = /\b(instal+ments?|deposits?|tranches?|progress|retention|retainage|milestones?|partial|balance|down ?payment|advance)\b|\b\d+\s*(of|\/)\s*\d+\b|\b\d{1,3}\s*%/i

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
  acct: string              // the unit it was paid for: cost centre, store, property, truck
  refs: Set<string>
  desc: string
  /** Its references come from a real invoice-number column, not a description. */
  invoiced: boolean
}

/**
 * A series: one vendor, one unit, one amount. Real companies pay a vendor
 * per store, per property, per truck or per cost centre, so the same amount
 * to the same vendor on the same day is often five stores' orders, not one
 * order paid five times. Rhythm and repetition are learned per series.
 */
interface Series {
  rows:     Row[]           // dated rows by date
  cadence:  Cadence | null  // its rhythm, learned from distinct payment dates
  sameDay:  number          // distinct dates with more than one payment: a batch or a price list
  nearby:   number          // repeats a few days apart: amounts this series simply repeats
}

interface Vendor {
  key:    string
  name:   string            // the most common spelling, for display
  rows:   Row[]             // dated rows by date, then undated
  series: Map<string, Series>
  /** Payments that belong to no recurring series: ad-hoc invoices. */
  adHoc:  number
  /** Distinct dates on which it was paid identical amounts more than once (any unit): a price list or a batch. */
  sameDayRepeats: number
  /** How often each exact amount recurs: a price it charges again and again. */
  priceCount: Map<number, number>
  /** Its most common description, which therefore says nothing about any one payment. */
  usualDesc: string
  /** Identical amounts repeated within two weeks, any unit: chance coincidences in a high-volume feed, or a habit. */
  nearRepeats: number
  /** Average payments per day over its active span: a daily feed rather than invoices. */
  perDay: number
  /** Lines of one invoice allocated across units (same reference, same day), and all but the first of each. */
  alloc: Set<string>
  allocExtra: Set<string>
}

interface Ctx {
  cfg:     DetectionConfig
  rows:    Row[]            // spend rows with a vendor
  vendors: Map<string, Vendor>
  start:   number           // first dated day in the register
  end:     number
  /** How this company pays: what is ordinary here is no signal here. */
  weekendShare: number      // share of payments posted on a weekend
  roundShare:   number      // share of material payments in round thousands
  counts: { weekend: number; dated: number; round: number; material: number }
  /** Whether a row counts toward the weekend rate: material, and not from a daily feed. */
  weekendBase: (r: Row) => boolean
  /** Credits by vendor: reversals, voids and credit memos that cancel a payment. */
  credits: Map<string, { day: number; amount: number }[]>
}

/** A credit for this payment, dated between two days: a void and reissue, or an accrual and its reversal. */
function reversedWithin(ctx: Ctx, r: Row, from: number, to: number): boolean {
  return (ctx.credits.get(r.key) ?? []).some(c => c.day >= from && c.day <= to && Math.abs(c.amount - r.tx.amount) <= r.tx.amount * 0.01)
}

const CADENCES = [1, 3.5, 7, 14, 15.2, 30.4, 91, 182, 365]

interface Cadence {
  days:   number
  /** Share of the series' gaps on the beat, leaving out early extras: 1 for rent on the 1st. */
  strict: number
}

/**
 * The rhythm of a series, if it keeps one: rent on the 1st (28 to 31 days),
 * bread on Tuesdays and Fridays (3 and 4 days), a daily order. Learned from
 * distinct dates, so several units paid together still read as one beat.
 * Payments that arrive at random almost never put 60% of their gaps within a
 * quarter of the median gap, so chance is not mistaken for a rhythm.
 */
function cadenceOf(all: number[], minCount: number, extraShare: number): Cadence | null {
  const days = [...new Set(all)].sort((a, b) => a - b)
  if (days.length < minCount) return null
  const gaps: number[] = []
  for (let i = 1; i < days.length; i++) gaps.push(days[i] - days[i - 1])
  const m = median(gaps)
  if (m < 1) return null
  const tol = Math.max(1, m * 0.25)
  const onBeat = (g: number) => Math.abs(g - m) <= tol
  if (gaps.filter(onBeat).length / gaps.length < 0.6) return null
  const named = CADENCES.find(c => Math.abs(m - c) <= c * 0.2) ?? m
  const regular = gaps.filter(g => g >= m * extraShare)
  return { days: named, strict: regular.length ? regular.filter(onBeat).length / regular.length : 0 }
}

const seriesKey = (r: Row) => `${cents(r.tx.amount)}|${r.acct}`

function buildContext(txs: StoredTransaction[], cfg: DetectionConfig, creditTxs: StoredTransaction[] = []): Ctx {
  const rows: Row[] = txs
    .filter(t => !isMissingVendor(t.vendor) && t.amount > 0)
    .map(tx => {
      // An invoice number, where the file has one, outranks anything in the
      // description: a PO number there is shared by every line against the PO.
      const invoice = (tx.invoice ?? '').trim()
      return { tx, day: dayNumber(tx.date), key: vendorKey(tx.vendor), acct: (tx.account || '').trim().toLowerCase(), refs: invoice ? invoiceRefs(invoice) : refsOf(tx.description), desc: descKey(tx.description, tx.vendor), invoiced: !!invoice }
    })
  const credits = new Map<string, { day: number; amount: number }[]>()
  for (const t of creditTxs) if (!isMissingVendor(t.vendor) && t.amount > 0) pushTo(credits, vendorKey(t.vendor), { day: dayNumber(t.date), amount: t.amount })

  const vendors = new Map<string, Vendor>()
  for (const r of rows) {
    let v = vendors.get(r.key)
    if (!v) vendors.set(r.key, v = { key: r.key, name: r.tx.vendor.trim(), rows: [], series: new Map(), adHoc: 0, sameDayRepeats: 0, priceCount: new Map(), usualDesc: '', nearRepeats: 0, perDay: 0, alloc: new Set(), allocExtra: new Set() })
    v.rows.push(r)
  }
  for (const v of vendors.values()) {
    v.rows.sort((a, b) => (Number.isFinite(a.day) ? a.day : Infinity) - (Number.isFinite(b.day) ? b.day : Infinity))
    const spellings = new Map<string, number>()
    for (const r of v.rows) spellings.set(r.tx.vendor.trim(), (spellings.get(r.tx.vendor.trim()) ?? 0) + 1)
    v.name = [...spellings.entries()].sort((a, b) => b[1] - a[1])[0][0]

    const descs = new Map<string, number>()
    const repeatDays = new Set<number>()
    const seenOnDay = new Set<string>()
    for (const r of v.rows) {
      v.priceCount.set(cents(r.tx.amount), (v.priceCount.get(cents(r.tx.amount)) ?? 0) + 1)
      descs.set(r.desc, (descs.get(r.desc) ?? 0) + 1)
      if (Number.isFinite(r.day)) {
        const k = `${r.day}|${cents(r.tx.amount)}`
        if (seenOnDay.has(k)) repeatDays.add(r.day); else seenOnDay.add(k)
      }
    }
    v.sameDayRepeats = repeatDays.size
    const lines = new Map<string, Row[]>()
    for (const r of v.rows) if (Number.isFinite(r.day)) for (const ref of r.refs) pushTo(lines, `${r.day}|${ref}`, r)
    for (const group of lines.values()) if (group.length > 1) group.forEach((r, i) => { v.alloc.add(r.tx.id); if (i) v.allocExtra.add(r.tx.id) })
    const byAmount = new Map<number, number[]>()
    for (const r of v.rows) if (Number.isFinite(r.day)) pushTo(byAmount, cents(r.tx.amount), r.day)
    for (const days of byAmount.values()) for (let i = 1; i < days.length; i++) { const g = days[i] - days[i - 1]; if (g > 0 && g <= 14) v.nearRepeats++ }
    const datedDays = v.rows.filter(r => Number.isFinite(r.day)).map(r => r.day)
    v.perDay = datedDays.length > 1 ? datedDays.length / (datedDays[datedDays.length - 1] - datedDays[0] + 1) : 0
    const [topDesc, topCount] = [...descs.entries()].sort((a, b) => b[1] - a[1])[0]
    v.usualDesc = topCount >= Math.max(3, v.rows.length * 0.5) ? topDesc : '\u0000'

    const grouped = new Map<string, Row[]>()
    for (const r of v.rows) if (Number.isFinite(r.day)) pushTo(grouped, seriesKey(r), r)
    for (const [k, list] of grouped) {
      let sameDay = 0, nearby = 0
      for (let i = 1; i < list.length; i++) {
        const d = list[i].day - list[i - 1].day
        if (d === 0 && (i === 1 || list[i - 1].day !== list[i - 2].day)) sameDay++
        else if (d > 0 && d <= 14) nearby++
      }
      const cadence = cadenceOf(list.map(r => r.day), cfg.recurringMinCount, cfg.recurringExtraShare)
      v.series.set(k, { rows: list, cadence, sameDay, nearby })
      if (!cadence) v.adHoc += list.length
    }
  }

  let start = Infinity, end = -Infinity, weekend = 0, dated = 0, material = 0, round = 0
  for (const r of rows) {
    const feed = (vendors.get(r.key)?.perDay ?? 0) >= 1 / 3 // ad platforms and card feeds charge every day
    if (Number.isFinite(r.day)) {
      if (r.day < start) start = r.day
      if (r.day > end) end = r.day
      // Judged on material payments: card swipes and fuel run all week, while a
      // company's real payments may still never post on a Saturday.
      if (r.tx.amount >= cfg.minExcess && !feed) { dated++; if (isWeekend(r.day)) weekend++ }
    }
    if (r.tx.amount >= cfg.roundNumberMin) { material++; if (isRoundThousand(r.tx.amount)) round++ }
  }
  return {
    cfg, rows, vendors, credits,
    start: Number.isFinite(start) ? start : NaN,
    end:   Number.isFinite(end) ? end : NaN,
    weekendShare: dated ? weekend / dated : 0,
    roundShare:   material ? round / material : 0,
    counts: { weekend, dated, round, material },
    weekendBase: (r: Row) => Number.isFinite(r.day) && r.tx.amount >= cfg.minExcess && (vendors.get(r.key)?.perDay ?? 0) < 1 / 3,
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
 * The same vendor paid the same amount twice, for the same unit.
 *
 * Judged on evidence, not on the calendar alone. A shared invoice reference
 * or the same day is strong, unless the series makes it ordinary: a vendor
 * that is paid several identical amounts on many days (a price list, a batch
 * of leases) or repeats amounts a few days apart (fixed-price deliveries)
 * needs a shared invoice number before a repeat means anything. A series
 * that keeps a rhythm (rent on the 1st, a weekly fee) is routine unless a
 * payment lands inside its cycle. Two different invoice numbers are two
 * invoices; equal instalments and an invoice split across cost centres share
 * a reference by design. Only the later row is the finding; the earlier one
 * is the original, carried as evidence.
 */
function detectDuplicates(ctx: Ctx): Draft[] {
  const { cfg } = ctx
  const out: Draft[] = []
  const refCount = new Map<string, number>()
  for (const r of ctx.rows) for (const ref of r.refs) refCount.set(`${r.key}|${ref}`, (refCount.get(`${r.key}|${ref}`) ?? 0) + 1)
  // A reference on three or more rows suggests planned instalments when all we
  // have is a number in a description. A real invoice number paid three times
  // in the same amount, with nothing saying instalment, is just paid three times.
  const planned = (a: Row, b: Row, ref: string) =>
    INSTALMENT.test(a.tx.description) || INSTALMENT.test(b.tx.description) || (!a.invoiced && !b.invoiced && (refCount.get(`${a.key}|${ref}`) ?? 0) >= 3)

  for (const v of ctx.vendors.values()) {
    for (const s of v.series.values()) {
      const dated = s.rows
      if (dated.length < 2) continue
      const cadence = s.cadence?.days ?? null
      // Identical amounts on one day, or a few days apart, that this vendor
      // pays as a matter of course: a batch of leases, a price list.
      const batchy  = s.sameDay >= 3 || v.sameDayRepeats >= 3
      const repeaty = s.nearby >= 3 || (v.priceCount.get(cents(dated[0].tx.amount)) ?? 0) >= 4 || v.nearRepeats >= 3

      // In a recurring series each payment is measured from the last one that
      // kept the rhythm, so an extra payment never makes the next regular one
      // look early.
      let anchor = dated[0]
      for (let i = 1; i < dated.length; i++) {
        const earlier = cadence ? anchor : dated[i - 1], later = dated[i]
        const d = later.day - earlier.day
        if (cadence && d >= cadence * cfg.recurringExtraShare) anchor = later
        if (d > cfg.duplicateWindowDays) continue
        if (reversedWithin(ctx, later, earlier.day, later.day)) continue // voided and reissued, or accrued and reversed

        const shared   = [...later.refs].filter(x => earlier.refs.has(x))
        // Lines of one invoice posted together, each describing its own share.
        if (d === 0 && shared.length && later.invoiced && earlier.invoiced && later.desc !== earlier.desc) continue
        const conflict = later.refs.size > 0 && earlier.refs.size > 0 && shared.length === 0
        // A description only counts when it says something: "Fuel" on every row of a fuel card says nothing.
        const sameDesc = !!later.desc && later.desc === earlier.desc && later.desc !== v.usualDesc
        const when     = d === 0 ? 'the same day' : `${plural(d, 'day')} earlier`

        let severity: Severity | null = null, confidence = 0, why = ''
        if (shared.length) {
          if (planned(earlier, later, shared[0])) continue
          severity = d <= 7 ? 'CRITICAL' : 'HIGH'
          confidence = d <= 7 ? 97 : 93
          why = `Both payments carry invoice reference ${shared[0]}: the same invoice was paid twice.`
        } else if (cadence && d < cadence * cfg.recurringExtraShare) {
          if (d === 0 && batchy) continue
          // An extra same-amount payment inside the cycle. A vendor that also
          // bills ad-hoc invoices (a freelancer on a retainer who invoices
          // projects too) may simply have sent another one; only a vendor paid
          // on the rhythm alone makes it plainly a second payment for the period.
          const adHoc = v.adHoc >= 2
          if (conflict && (adHoc || cadence < 28 || s.cadence!.strict < 0.8)) continue
          severity = conflict || adHoc ? 'MEDIUM' : 'HIGH'
          confidence = conflict || adHoc ? 74 : 90
          why = `${v.name} is paid ${fmtExact(later.tx.amount)} on a ${cadenceName(cadence)} rhythm${later.acct ? ` for ${later.tx.account}` : ''}. This payment lands ${plural(d, 'day')} after the last one, inside the cycle, so the period may have been paid twice.${conflict ? ' The invoice numbers differ, so confirm whether a second, separate charge was due.' : adHoc ? ' The vendor also bills ad-hoc invoices, so confirm this was not one of those.' : ''}`
        } else if (cadence) {
          continue // on the series' own rhythm: the next period's charge
        } else if (conflict) {
          // Two invoice numbers are two invoices. On one day, from a vendor paid
          // a handful of times rather than many times a day, still worth a look.
          if (d > 0 || batchy || v.perDay >= 1) continue
          severity = 'MEDIUM'; confidence = 70
          why = 'The invoice numbers differ, so these may be two separate invoices; two identical amounts to one vendor on one day is still worth confirming.'
        } else if (later.tx.source === 'card' && later.tx.amount < cfg.minExcess) {
          continue // two coffees at the same price are two coffees
        } else if (d === 0) {
          if (batchy || coincidence(v, later.tx.amount, 0) >= 0.001) continue
          severity = 'CRITICAL'; confidence = sameDesc || (!later.desc && !earlier.desc) ? 96 : 90
          why = `Same vendor, same amount to the cent, on the same day${later.acct ? `, for the same ${later.tx.account}` : ''}.`
        } else if (repeaty) {
          continue // this series repeats amounts a few days apart as a matter of course
        } else if (coincidence(v, later.tx.amount, 14) >= 0.001) {
          continue // at this vendor's volume and spread, an exact repeat within two weeks happens by chance
        } else if (d <= 14) {
          severity = sameDesc ? 'HIGH' : 'MEDIUM'; confidence = sameDesc ? 86 : 74
          why = `Same vendor and amount to the cent, ${plural(d, 'day')} apart${sameDesc ? ', with the same description' : ''}, and no rhythm or habit of repeating that would explain it.`
        } else if (d < 25 && sameDesc && !repeaty) {
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
    }

    // Without dates only a shared invoice reference is evidence enough.
    const undated = v.rows.filter(r => !Number.isFinite(r.day))
    for (const later of undated) {
      const match = v.rows.find(o => o !== later && seriesKey(o) === seriesKey(later) && [...o.refs].some(x => later.refs.has(x)) && (Number.isFinite(o.day) || v.rows.indexOf(o) < v.rows.indexOf(later)))
      if (!match) continue
      const ref = [...later.refs].find(x => match.refs.has(x))!
      if (planned(match, later, ref)) continue
      out.push(draft('duplicate', `Invoice paid twice — ${v.name}`, [later, match], {
        amount: later.tx.amount, severity: 'HIGH', confidence: 88, vendor: later.tx.vendor,
        description: `${fmtAmt(later.tx.amount)} paid to ${later.tx.vendor} (${rowLabel(later.tx)}) repeats invoice ${ref} (${rowLabel(match.tx)}). The row has no date.`,
        reasoning: `Both payments carry invoice reference ${ref} for the same amount. The flagged row has no transaction date, so confirm when it was paid.`,
      }))
    }
  }

  // The same invoice and amount paid under two different vendor records: a
  // duplicate vendor in the master file, or a payment redirected to a copy.
  const byRef = new Map<string, Row[]>()
  for (const r of ctx.rows) for (const ref of r.refs) pushTo(byRef, `${cents(r.tx.amount)}|${ref}`, r)
  for (const [k, group] of byRef) {
    if (group.length > 6) continue // a contract or account number on every bill, not an invoice
    const keys = new Set(group.map(r => r.key))
    if (keys.size < 2) continue
    const sorted = [...group].sort((a, b) => (a.day || 0) - (b.day || 0))
    const first = sorted[0]
    const later = sorted.find(r => r.key !== first.key)!
    if (Number.isFinite(first.day) && Number.isFinite(later.day) && later.day - first.day > cfg.duplicateWindowDays * 3) continue
    if (INSTALMENT.test(first.tx.description) || INSTALMENT.test(later.tx.description)) continue
    const ref = k.split('|')[1]
    out.push(draft('duplicate', `Same invoice paid to two vendor records — ${later.tx.vendor}`, [later, first], {
      amount: later.tx.amount, severity: 'HIGH', confidence: 88, vendor: later.tx.vendor,
      description: `Invoice ${ref} for ${fmtAmt(later.tx.amount)} was paid to ${first.tx.vendor} on ${first.tx.date || 'an undated row'} (${rowLabel(first.tx)}) and to ${later.tx.vendor} on ${later.tx.date || 'an undated row'} (${rowLabel(later.tx)}).`,
      reasoning: 'The same invoice reference and amount appear under two different vendor names. Either the vendor exists twice in the master file, which lets one invoice be paid twice, or a payment went to a look-alike record. Confirm which record is genuine.',
    }))
  }
  out.push(...detectInvoiceRepeats(ctx), ...detectAccruedAndInvoiced(ctx))
  return out
}

/**
 * One invoice number posted again on a later date.
 *
 * Lines posted together are one posting, so a multi-line invoice re-entered
 * later as a single line still matches on its total. The amounts must agree:
 * to within 2%, which allows for FX and a freight or tax line added on re-entry,
 * or by a transposition, which is the same invoice mis-keyed. Partial payments
 * of one invoice differ by far more, and are left alone.
 */
function detectInvoiceRepeats(ctx: Ctx): Draft[] {
  const { cfg } = ctx
  const out: Draft[] = []
  for (const v of ctx.vendors.values()) {
    const byInvoice = new Map<string, Row[]>()
    for (const r of v.rows) {
      if (!r.invoiced || !Number.isFinite(r.day)) continue
      const keys = [...r.refs]
      pushTo(byInvoice, keys.find(k => k.startsWith('#')) ?? keys[0], r)
    }
    for (const group of byInvoice.values()) {
      const byDay = new Map<number, Row[]>()
      for (const r of group) pushTo(byDay, r.day, r)
      if (byDay.size < 2) continue
      const postings = [...byDay.entries()].sort((a, b) => a[0] - b[0]).map(([day, rows]) => ({ day, rows, total: rows.reduce((t, r) => t + r.tx.amount, 0) }))
      for (let i = 1; i < postings.length; i++) {
        const later = postings[i]
        const earlier = postings.slice(0, i).reverse().find(e =>
          later.day - e.day <= cfg.duplicateWindowDays * 3 && (Math.abs(e.total - later.total) <= e.total * 0.02 || transposed(e.total, later.total)))
        if (!earlier || later.rows.some(r => INSTALMENT.test(r.tx.description)) || earlier.rows.some(r => INSTALMENT.test(r.tx.description))) continue
        if (reversedWithin(ctx, { ...later.rows[0], tx: { ...later.rows[0].tx, amount: later.total } }, earlier.day, later.day)) continue
        const d = later.day - earlier.day
        const slip = transposed(earlier.total, later.total)
        const ref = later.rows[0].tx.invoice!.trim()
        out.push(draft('duplicate', `${slip ? 'Invoice re-keyed with digits swapped' : 'Invoice posted twice'} — ${v.name}`, [...later.rows, ...earlier.rows], {
          amount: later.total, severity: d <= 7 ? 'CRITICAL' : 'HIGH', confidence: slip ? 88 : d <= 7 ? 97 : 93, vendor: later.rows[0].tx.vendor,
          description: `Invoice ${ref} for ${fmtAmt(later.total)} to ${later.rows[0].tx.vendor} on ${later.rows[0].tx.date} (${rowLabel(later.rows[0].tx)}) matches ${earlier.rows[0].tx.invoice} for ${fmtExact(earlier.total)} posted on ${earlier.rows[0].tx.date} (${rowLabel(earlier.rows[0].tx)}), ${plural(d, 'day')} earlier.`,
          reasoning: `${slip ? 'The two amounts use the same digits in a different order on the same invoice number, which is how a re-keyed invoice looks.' : 'The same invoice number was posted again for the same amount.'} Lines posted together are counted as one posting, so splitting or consolidating lines does not hide it. No void or credit cancels the first posting.`,
        }))
      }
    }
  }
  return out
}

/** An estimate booked by journal rather than an invoice from the vendor. */
const isAccrual = (r: Row) => /\baccru/i.test(r.tx.description) || (r.tx.source === 'journal' && !r.invoiced)

/**
 * An accrual that was never reversed, followed by the real invoice: the same
 * expense booked twice. Ordinary accruals reverse, usually the next day, and
 * that credit is the difference between this and routine month-end work.
 */
function detectAccruedAndInvoiced(ctx: Ctx): Draft[] {
  const out: Draft[] = []
  const HORIZON = 62 // invoices trail an accrual by up to two month-ends
  for (const v of ctx.vendors.values()) {
    for (const a of v.rows) {
      if (!Number.isFinite(a.day) || !isAccrual(a) || a.tx.amount < ctx.cfg.minExcess) continue
      const inv = v.rows.find(r => r !== a && Number.isFinite(r.day) && !isAccrual(r) && r.day > a.day && r.day - a.day <= HORIZON && Math.abs(r.tx.amount - a.tx.amount) <= a.tx.amount * 0.005)
      if (!inv || reversedWithin(ctx, a, a.day, inv.day + 35)) continue
      out.push(draft('duplicate', `Accrued and invoiced, never reversed — ${v.name}`, [inv, a], {
        amount: inv.tx.amount, severity: 'HIGH', confidence: 84, vendor: inv.tx.vendor,
        description: `${fmtAmt(inv.tx.amount)} from ${inv.tx.vendor} on ${inv.tx.date} (${rowLabel(inv.tx)}) matches an accrual booked on ${a.tx.date} (${rowLabel(a.tx)}) with no reversal in this register.`,
        reasoning: 'An accrual is an estimate, and is normally reversed when the invoice arrives. This one has no matching credit, so the expense appears to have been recorded twice. Confirm the accrual was released.',
      }))
    }
  }
  return out
}

const CYCLE_NAME: Record<number, string> = { 1: 'day', 3.5: 'half-week', 7: 'week', 14: 'two-week cycle', 15.2: 'half-month', 30.4: 'month', 91: 'quarter', 182: 'half-year', 365: 'year' }

function cadenceName(c: number): string {
  return ({ 1: 'daily', 3.5: 'twice-weekly', 7: 'weekly', 14: 'two-weekly', 15.2: 'twice-monthly', 30.4: 'monthly', 91: 'quarterly', 182: 'half-yearly', 365: 'yearly' } as Record<number, string>)[c] ?? `${Math.round(c)}-day`
}

// ─── 2. Vendor-relative amount outlier ────────────────────────────────────────

/**
 * Far above what this vendor is usually paid, and alone up there.
 *
 * Each payment is compared with the vendor's *other* payments, on a log
 * scale: their median, and the spread of their logarithms. Spend varies by
 * multiples, not by fixed amounts, so a vendor whose invoices routinely run
 * from $100 to $800 produces the occasional $1,500 with nothing wrong, while a
 * vendor that bills $3,150 every month does not produce $27,300. Including the
 * payment in its own baseline (a mean and standard deviation over all of
 * them) would hide it: below nine payments a single outlier can never reach
 * 2.5 standard deviations.
 *
 * The payment must also stand alone. A season of large orders (spring
 * fertiliser, a year-end stock-up) is a second regime, and a price the vendor
 * charges again and again is a price, not an anomaly.
 */
const ANNUAL = /\b(annual|yearly|renewal)\b/i

function detectVendorOutliers(ctx: Ctx): Draft[] {
  const { cfg } = ctx
  const out: Draft[] = []
  for (const v of ctx.vendors.values()) {
    const n = v.rows.length
    if (n < cfg.vendorMinHistory + 1) continue
    // Sorted once; each payment's baseline is the median of the others, read
    // off the sorted list by position rather than re-sorted per payment.
    const order = v.rows.map((_, i) => i).sort((a, b) => v.rows[a].tx.amount - v.rows[b].tx.amount)
    const sorted = order.map(i => v.rows[i].tx.amount)
    // Two robust estimates of the spread, the larger kept: a small sample can
    // understate either one, and an understated spread invents outliers.
    const logs = sorted.map(Math.log)
    // A handful of payments also understates spread on average, so it is
    // widened in proportion to the uncertainty of estimating it.
    const logSpread = Math.max(1.4826 * mad(logs), (quantile(logs, 0.9) - quantile(logs, 0.1)) / 2.563, 0.05) * (1 + 0.5 / Math.sqrt(n))
    const at = (k: number, skip: number) => sorted[k < skip ? k : k + 1]   // k-th of the others
    for (let pos = 0; pos < n; pos++) {
      const r = v.rows[order[pos]]
      const m = n - 1
      const med = m % 2 ? at((m - 1) / 2, pos) : (at(m / 2 - 1, pos) + at(m / 2, pos)) / 2
      if (med <= 0) continue
      const ratio  = r.tx.amount / med
      const z      = Math.log(ratio) / logSpread
      // A volatile vendor's own range can hide a large jump. Over enough
      // history, a payment several times anything it has ever been paid is
      // still news: the top of an honest spread rises in small steps.
      const prevMax = pos === n - 1 ? sorted[n - 2] : sorted[n - 1]
      const margin  = r.tx.amount / prevMax
      const beyond  = m >= cfg.vendorMaxMarginHistory && margin >= cfg.vendorMaxMargin && (z >= cfg.vendorLogZ - 0.5 || (margin >= 5 && m >= 20))
      // A contract's scheduled lump is expected to break a steady pattern.
      const steady = logSpread <= cfg.vendorSteadySpread && m >= cfg.vendorSteadyHistory && !INSTALMENT.test(r.tx.description) && !ANNUAL.test(r.tx.description)
      if (ratio < (steady ? cfg.vendorSteadyRatio : cfg.vendorRatio) || (z < cfg.vendorLogZ && !beyond) || r.tx.amount - med < cfg.minExcess) continue
      let peers = 0
      for (let k = n - 1; k >= 0 && sorted[k] >= r.tx.amount / 2; k--) if (k !== pos) peers++
      if (peers > 1) continue

      if (notPayment(r.tx)) continue
      // An annual renewal beside small monthly charges is worth one look, not an alarm.
      const annual = ANNUAL.test(r.tx.description)
      const severity: Severity = annual ? 'LOW' : ratio >= 8 && r.tx.amount >= cfg.approvalLimit ? 'CRITICAL' : ratio >= 5 ? 'HIGH' : 'MEDIUM'
      out.push(draft('outlier', `Unusual amount for this vendor — ${v.name}`, [r], {
        amount: r.tx.amount, severity,
        confidence: annual ? 62 : Math.min(96, 60 + 9 * Math.log2(ratio) + Math.min(8, m)),
        description: `${fmtAmt(r.tx.amount)} to ${r.tx.vendor} on ${r.tx.date || 'an undated row'} is ${ratio.toFixed(1)}× this vendor's usual ${fmtAmt(med)} (${rowLabel(r.tx)}).`,
        reasoning: `Across ${v.name}'s ${plural(m, 'other payment')}, the median is ${fmtAmt(med)}${peers ? ' and only one other comes within half of this one' : ' and none comes within half of this one'}. This one is ${ratio.toFixed(1)} times the median${r.tx.amount >= cfg.vendorMaxMargin * prevMax ? ` and ${(r.tx.amount / prevMax).toFixed(1)} times the largest other payment it has received` : ''}, far beyond the vendor's own spread. It is measured against this vendor only, so a vendor that is routinely large never trips it.`,
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
  // Card swipes and invoices are different worlds even in one account: a
  // catering invoice says nothing against $40 lunches. Each is compared with
  // its own kind when the file says which is which.
  const byCat = new Map<string, Row[]>()
  const kind = (r: Row) => (r.tx.source === 'card' ? '|card' : '')
  for (const r of ctx.rows) {
    const c = (r.tx.category || 'Uncategorized').trim().toLowerCase()
    pushTo(byCat, c + kind(r), r)
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
      if (notPayment(r.tx)) continue
      const stats = catStats.get(cat.toLowerCase() + kind(r))
      if (!stats) continue
      const own = stats.vendors.get(v.key) ?? 0
      const otherCount = stats.sorted.length - own
      const otherVendors = stats.vendors.size - (own ? 1 : 0)
      if (otherCount < cfg.categoryMinRows || otherVendors < cfg.categoryMinVendors) continue
      // The category's range without this vendor's own few payments.
      let pool = stats.sorted
      if (own) {
        pool = [...stats.sorted]
        for (const o of v.rows) if ((o.tx.category || '').trim().toLowerCase() === cat.toLowerCase() && kind(o) === kind(r)) {
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

const inSeries = (v: Vendor, r: Row) => !!v.series.get(seriesKey(r))?.cadence

/** One line of an invoice allocated across units: another line of the same vendor carries its reference on the same day. */
const allocation = (v: Vendor, r: Row) => v.alloc.has(r.tx.id)

/** Approval limits that commonly exist, tested for bunching when the configured one is not the company's. */
const CANDIDATE_LIMITS = [1_000, 2_000, 2_500, 3_000, 5_000, 7_500, 10_000, 15_000, 20_000, 25_000, 50_000, 100_000]

function binomialTail(k: number, n: number): number {
  // P(X >= k) for X ~ Binomial(n, 0.5)
  let p = 0, c = 1
  for (let i = 0; i <= n; i++) { if (i >= k) p += c; c = (c * (n - i)) / (i + 1) }
  return p / Math.pow(2, n)
}

/**
 * The limits to test: the configured one, plus any the data reveals. Where
 * people split purchases to stay under a limit, payments bunch just below it:
 * far more in the 10% under the line than in the 10% over it, or in the 10%
 * under that. A smooth spread of amounts never does that, so the bunching
 * locates a company's real limit (a $5,000 card limit, say) without being told.
 */
interface Limit { limit: number; inferred: boolean; candidate?: boolean }

/** How close under a common limit a cluster must sit before it counts without any company-wide evidence. */
const CANDIDATE_BAND = 0.95
/** Below this, a limit is not worth a controller's morning. */
const CANDIDATE_FLOOR = 5_000

function approvalLimits(ctx: Ctx): Limit[] {
  const { cfg } = ctx
  const out: Limit[] = [{ limit: cfg.approvalLimit, inferred: false }]
  const amounts: number[] = []
  for (const v of ctx.vendors.values()) for (const r of v.rows) if (!inSeries(v, r) && (v.priceCount.get(cents(r.tx.amount)) ?? 0) < 3) amounts.push(r.tx.amount)
  for (const T of CANDIDATE_LIMITS) {
    if (T === cfg.approvalLimit) continue
    let below = 0, above = 0, under = 0
    for (const a of amounts) {
      if (a >= T * 0.9 && a <= T) below++
      else if (a > T && a <= T * 1.1) above++
      else if (a >= T * 0.8 && a < T * 0.9) under++
    }
    if (below >= 6 && below >= 3 * (above + 1) && below >= 2 * (under + 1) && binomialTail(below, below + above) < 0.02) out.push({ limit: T, inferred: true })
    // Companies have more than one limit, and a single vendor hugging a common
    // one is evidence enough, held to a tighter band and a stricter test.
    else if (T >= CANDIDATE_FLOOR) out.push({ limit: T, inferred: true, candidate: true })
  }
  return out
}

interface Payee { v: Vendor; rows: Row[]; amt: (r: Row) => number; unit: string }

/**
 * Payments to one vendor clustered just beneath an approval limit.
 *
 * No single payment breaches the control, so no amount rule can see it. The
 * signature is the cluster: three or more inside a week, or two within a few
 * days. A fixed fee that simply recurs at that level is a rhythm, not a split;
 * and a vendor that is routinely paid just *over* the limit has nothing to
 * avoid, because its amounts are not bunched under the line.
 *
 * A vendor is judged across the whole group, so splitting between two legal
 * entities does not hide it, and again within each foreign entity in its own
 * currency, because that is the money its limits are written in.
 */
function detectApprovalAvoidance(ctx: Ctx): Draft[] {
  const limits = approvalLimits(ctx)
  const group: Payee[] = [...ctx.vendors.values()].map(v => ({ v, rows: v.rows, amt: r => r.tx.amount, unit: '' }))
  const out = scanForSplits(ctx, group, limits)

  const local = (r: Row) => r.tx.localAmount ?? r.tx.amount
  const foreign: Payee[] = []
  for (const v of ctx.vendors.values()) {
    const byEntity = new Map<string, Row[]>()
    for (const r of v.rows) if (r.tx.entity && r.tx.localAmount && Math.abs(r.tx.localAmount - r.tx.amount) > r.tx.amount * 0.001) pushTo(byEntity, r.tx.entity, r)
    for (const [entity, rows] of byEntity) foreign.push({ v, rows, amt: local, unit: ` in entity ${entity}'s own currency` })
  }
  if (foreign.length) out.push(...scanForSplits(ctx, foreign, CANDIDATE_LIMITS.filter(T => T >= CANDIDATE_FLOOR).map(limit => ({ limit, inferred: true, candidate: true }))))
  return out
}

function scanForSplits(ctx: Ctx, payees: Payee[], limits: Limit[]): Draft[] {
  const { cfg } = ctx
  const out: Draft[] = []

  for (const { limit, inferred, candidate } of limits) {
    const low = limit * (candidate ? CANDIDATE_BAND : cfg.approvalBandLow)
    const alpha = candidate ? 0.01 / CANDIDATE_LIMITS.length : 0.01 // every limit tried is another chance to be fooled
    for (const { v, rows, amt, unit } of payees) {
      const band = rows.filter(r => Number.isFinite(r.day) && amt(r) >= low && amt(r) <= limit && !inSeries(v, r) && !allocation(v, r) && (v.priceCount.get(cents(r.tx.amount)) ?? 0) < 3)
      if (band.length < 2) continue
      // A vendor paid just over the line as often as just under it has little
      // to avoid, which explains away anything short of three invoices landing
      // within a whisker of the limit in one week.
      const over  = rows.filter(r => amt(r) > limit && amt(r) <= limit * 1.25).length
      const routinelyOver = over >= 2 && over >= band.length
      const active = Math.max(1, band[band.length - 1].day - band[0].day + 1, (Number.isFinite(ctx.end - ctx.start) ? ctx.end - ctx.start + 1 : 1))
      let i = 0
      while (i < band.length) {
        let j = i
        while (j + 1 < band.length && band[j + 1].day - band[i].day <= cfg.approvalWindowDays) j++
        const cluster = band.slice(i, j + 1)
        const span = cluster[cluster.length - 1].day - cluster[0].day
        // How likely is a cluster this tight at the vendor's own rate of
        // payments this close to the line, over all the windows it could have
        // fallen in? A vendor paid in this range every week produces pairs by
        // chance; one paid there once a year does not produce three in a week.
        // Measured at the cluster's own distance from the limit: a vendor whose
        // invoices merely run near it rarely lands within a percent of it.
        const tightest = Math.min(...cluster.map(amt))
        const peers = band.filter(r => amt(r) >= tightest).length
        const rateOut = (peers - cluster.length) / active
        const chance  = poissonTail(cluster.length, rateOut * (span + 1)) * Math.max(1, active / (span + 1))
        // Routinely over the line excuses everything but three or more hugging it.
        const hugging = cluster.length >= 3 && tightest >= limit * 0.97
        if ((!routinelyOver || hugging) && (cluster.length >= 3 || (cluster.length === 2 && span <= cfg.approvalPairMaxDays)) && chance < alpha) {
          const total = cluster.reduce((s, r) => s + r.tx.amount, 0)
          const which = inferred ? `an apparent ${fmtAmt(limit)} limit` : `the ${fmtAmt(limit)} approval limit`
          const entities = new Set(cluster.map(r => r.tx.entity).filter(Boolean))
          const across = !unit && entities.size > 1 ? ` across ${entities.size} legal entities` : ''
          out.push(draft('approval_avoidance', `Payments split under ${inferred ? 'an apparent' : 'the'} approval limit — ${v.name}`, cluster, {
            amount: total, severity: cluster.length >= 3 ? 'CRITICAL' : 'HIGH', confidence: (cluster.length >= 3 ? 94 : 84) - (candidate ? 8 : inferred ? 4 : 0),
            description: `${cluster.length} payments to ${v.name}${across} totalling ${fmtAmt(total)} between ${cluster[0].tx.date} and ${cluster[cluster.length - 1].tx.date}, each between ${fmtAmt(low)} and ${fmtAmt(limit)}${unit}, none individually reaching ${which}.`,
            reasoning: `Each payment stays under ${which}${unit}, yet together they total ${fmtAmt(total)} across ${plural(span, 'day')}${across}. Several payments to one vendor landing just under a limit within a week is the classic signature of an invoice split to avoid a second approver. Check whether these are one purchase.`,
          }))
          i = j + 1
        } else i++
      }
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
    const rows = v.rows.filter(r => Number.isFinite(r.day) && !v.allocExtra.has(r.tx.id) && !notPayment(r.tx)) // an invoice's allocation lines are one payment
    if (rows.length < 2) continue
    const first = rows[0].day

    if (first - ctx.start >= cfg.newVendorGraceDays) {
      const burst = rows.filter(r => r.day - first < W)
      const restMax = densest(rows.slice(burst.length), W).count
      // Most vendors first seen mid-register are simply not burst at the start:
      // they fall through and are judged on their own rhythm like any other.
      const isBurst = burst.length >= cfg.velocityNewVendorMinCount && !(restMax && (burst.length < cfg.velocityBurstMultiple * restMax || burst.length - restMax < 2))
      if (isBurst) {
        const total = burst.reduce((s, r) => s + r.tx.amount, 0)
        out.push(draft('high_frequency', `New vendor paid ${burst.length} times in its first week — ${v.name}`, burst, {
          amount: total, severity: 'HIGH', confidence: 86,
          description: `${plural(burst.length, 'payment')} to ${v.name} totalling ${fmtAmt(total)} within ${plural(W, 'day')} of its first appearance on ${rows[0].tx.date}.`,
          reasoning: `${v.name} is not paid anywhere in the ${plural(first - ctx.start, 'day')} of this register before ${rows[0].tx.date}, then receives ${plural(burst.length, 'payment')} in ${plural(W, 'day')}${restMax ? `, against at most ${restMax} in any week since` : ''}. A new vendor has no established rhythm to justify that frequency. Confirm the vendor and that each invoice is distinct.`,
        }))
        continue
      }
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
    if (modalRows.length < cfg.categoryConsistencyMinHistory) continue
    const departures = coded.filter(r => r.tx.category.trim().toLowerCase() !== modalKey)
    // A single departure from an established pattern is the case this check
    // exists for, however short the history; the share guards against a vendor
    // genuinely split across categories.
    if (departures.length > 1 && modalRows.length / coded.length < cfg.categoryConsistencyShare) continue
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

/** A fiscal period number as a month slot. Above 12 is an adjustment period, which has no month. */
const fiscalSlot = (year: number, period: number) => (period >= 1 && period <= 12 ? { year, month: period - 1 } : null)
const fullYear = (y: string) => (y.length === 2 ? 2000 + Number(y) : Number(y))

/**
 * Parse period labels: "Jan-26", "January 2026", "2026-01", "01/2026", and the
 * fiscal forms ERPs use ("FY26-P01", "P01 FY26", "2026-P03", "Period 3 2026",
 * SAP's "003/2026"). A fiscal period is returned as if it were that month of
 * that year; the file's own calendar offset is learned from the data, so P01
 * of a year starting in July lines up without being told. Adjustment periods
 * such as P13 return null: they are not a month, and must not look like errors.
 */
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

  m = /^fy\s*-?(\d{2}|\d{4})[\s\-/.]*p(?:eriod|er)?\s*-?(\d{1,3})$/.exec(s)   // FY26-P01, FY2026 Period 1
  if (m) return fiscalSlot(fullYear(m[1]), Number(m[2]))
  m = /^p(?:eriod|er)?\s*-?(\d{1,3})[\s\-/.]+(?:fy\s*-?)?(\d{2}|\d{4})$/.exec(s)  // P01 FY26, Period 3 2026
  if (m) return fiscalSlot(fullYear(m[2]), Number(m[1]))
  m = /^(\d{4})[\s\-/.]*p(?:eriod|er)?\s*-?(\d{1,3})$/.exec(s)                 // 2026-P03
  if (m) return fiscalSlot(Number(m[1]), Number(m[2]))
  m = /^0(\d{2})[\s\-/.](\d{4})$/.exec(s)                                       // 003/2026
  if (m) return fiscalSlot(Number(m[2]), Number(m[1]))
  m = /^(\d{4})[\s\-/.]0(\d{2})$/.exec(s)                                       // 2026/003
  if (m) return fiscalSlot(Number(m[1]), Number(m[2]))
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

  let off = labelled.filter(x => x.p.year * 12 + x.p.month - x.d !== mode)

  // Retail 4-4-5 calendars and cut-off conventions move period ends a few days
  // off month ends. When the disagreements crowd within a week of a month
  // boundary, that is the file's calendar, not a run of errors: only rows
  // further out than that are reported.
  const daysOutside = (x: { t: StoredTransaction; p: { year: number; month: number } }) => {
    const idx = x.p.year * 12 + x.p.month - mode
    const first = Date.UTC(Math.floor(idx / 12), idx % 12, 1) / 86_400_000
    const last = Date.UTC(Math.floor(idx / 12), idx % 12 + 1, 0) / 86_400_000
    const d = dayNumber(x.t.date)
    return d < first ? first - d : d > last ? d - last : 0
  }
  // One boundary is an event, not a calendar: a batch held back at year end
  // crowds a single month end, and that is the error this check is for.
  const near = off.filter(x => daysOutside(x) <= 7)
  const boundaries = new Set(near.map(x => x.p.year * 12 + x.p.month))
  if (off.length >= 5 && near.length / off.length >= 0.8 && boundaries.size >= 4) off = off.filter(x => daysOutside(x) > 7)
  if (off.length === 0) return []
  const byTx = new Map(ctx.rows.map(r => [r.tx, r]))
  const rowOf = (t: StoredTransaction): Row => byTx.get(t) ?? { tx: t, day: dayNumber(t.date), key: vendorKey(t.vendor), acct: '', refs: new Set(), desc: '', invoiced: false }
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
    const crossesYear = Math.floor((x.d + mode) / 12) !== Math.floor((expected + mode) / 12) // in the file's own fiscal years
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

/** How surprising a feature is in this company: -log10 of how often it occurs, within sensible bounds. */
const surprise = (share: number, floor = 0.001) => -Math.log10(Math.min(1, Math.max(share, floor)))

/**
 * How often something happens in this company, leaving out the payment being
 * judged (it must never vouch for itself), estimated by empirical Bayes: a
 * general business rate worth twenty payments, overruled as the company's own
 * record grows. A one-month file leans on the general rate; a year of data
 * speaks for itself, and "none in a hundred" is never read as "never".
 */
const PRIOR_WEIGHT = 20
const PRIOR = { weekend: 0.03, round: 0.15, above: 0.1, band: 0.03 }
const rate = (count: number, n: number, self: boolean, prior: number) =>
  (count - (self ? 1 : 0) + PRIOR_WEIGHT * prior) / (n - (self ? 1 : 0) + PRIOR_WEIGHT)

/**
 * A payment to a vendor with no history, carrying features that are rare in
 * *this* company: first seen weeks into the register, a round sum, a weekend
 * posting, a size above or just under the approval limit.
 *
 * Each feature is scored by how surprising it is here, as -log10 of how often
 * it happens: a Saturday posting where one payment in a thousand is posted on
 * a weekend adds 3, a round sum where a third of large payments are round adds
 * less than half a point, and a new payee in a category where most payees are
 * new (grants, subcontractors) adds almost nothing. A payment is raised when
 * the combined surprise passes 4, roughly one in ten thousand were the
 * features independent: rare for an honest payment, ordinary for one that
 * never went through procurement.
 *
 * "New" needs evidence: the vendor must first appear weeks after the register
 * begins. A vendor paid once in a one-month export is just monthly.
 */
function detectNewVendorRisk(ctx: Ctx): Draft[] {
  const { cfg } = ctx
  const out: Draft[] = []
  const firstDay = (v: Vendor) => v.rows.find(r => Number.isFinite(r.day))?.day ?? NaN
  const catOf = (r: Row) => (r.tx.category || '').trim().toLowerCase()

  // How often each feature occurs in this company.
  let above = 0, band = 0
  for (const r of ctx.rows) {
    if (r.tx.amount > cfg.approvalLimit) above++
    else if (r.tx.amount >= cfg.approvalLimit * cfg.approvalBandLow) band++
  }
  const N = ctx.rows.length, K = ctx.counts
  const vendorsPerCat = new Map<string, number>(), newPerCat = new Map<string, number>()
  let newAll = 0
  for (const v of ctx.vendors.values()) {
    const c = catOf(v.rows[0])
    vendorsPerCat.set(c, (vendorsPerCat.get(c) ?? 0) + 1)
    if (firstDay(v) - ctx.start >= cfg.newVendorGraceDays) { newPerCat.set(c, (newPerCat.get(c) ?? 0) + 1); newAll++ }
  }
  // A category's rate of new payees, shrunk toward the company's: a category
  // holding one vendor says nothing about how ordinary new payees are there.
  const companyNew = newAll / Math.max(1, ctx.vendors.size)
  const newRate = (c: string) => ((newPerCat.get(c) ?? 0) + 5 * companyNew) / ((vendorsPerCat.get(c) ?? 0) + 5)

  for (const v of ctx.vendors.values()) {
    const rows = v.rows.filter(r => Number.isFinite(r.day))
    if (rows.length === 0 || rows.length > 2 || v.rows.length > 2) continue
    // Provably new: weeks of register before it with no payment to it.
    // Otherwise its history may sit before the export, and only the payment's
    // own features count.
    const provenNew = rows[0].day - ctx.start >= cfg.newVendorGraceDays
    if (!provenNew && v.rows.length > 1) continue
    const c = catOf(rows[0])
    const newShare = newRate(c)

    for (const r of rows) {
      const signals: { text: string; score: number }[] = []
      if (provenNew) {
        signals.push({ text: `first paid on ${rows[0].tx.date}, ${plural(rows[0].day - ctx.start, 'day')} into the register`, score: surprise(newShare, 0.05) })
        if (v.rows.length === 1) signals.push({ text: 'its only payment', score: 0.3 })
      } else {
        signals.push({ text: 'its only payment in the register', score: 0 })
      }
      const round = r.tx.amount >= cfg.roundNumberMin && isRoundThousand(r.tx.amount)
      if (round) signals.push({ text: `a round ${fmtAmt(r.tx.amount)}`, score: surprise(rate(K.round, K.material, true, PRIOR.round)) })
      if (isWeekend(r.day)) signals.push({ text: 'posted on a weekend', score: surprise(rate(K.weekend, K.dated, ctx.weekendBase(r), PRIOR.weekend)) })
      if (r.tx.amount > cfg.approvalLimit) signals.push({ text: `above the ${fmtAmt(cfg.approvalLimit)} approval limit`, score: surprise(rate(above, N, true, PRIOR.above)) })
      else if (r.tx.amount >= cfg.approvalLimit * cfg.approvalBandLow) signals.push({ text: `just under the ${fmtAmt(cfg.approvalLimit)} approval limit`, score: surprise(rate(band, N, true, PRIOR.band)) })
      const score = signals.reduce((t, x) => t + x.score, 0)
      if (score < cfg.newVendorSurprise) continue

      const shown = signals.filter(x => x.score >= 0.25 || !provenNew)
      out.push(draft('new_vendor_risk', `${provenNew ? 'New vendor' : 'One-off payment'}, several risk signals — ${v.name}`, [r], {
        amount: r.tx.amount, severity: score >= cfg.newVendorSurpriseHigh ? 'HIGH' : 'MEDIUM',
        confidence: Math.min(95, 60 + score * 6),
        description: `${fmtAmt(r.tx.amount)} to ${r.tx.vendor} on ${r.tx.date} (${rowLabel(r.tx)}): ${shown.map(x => x.text).join(', ')}.`,
        reasoning: `${provenNew ? `${v.name} has no earlier history in this register.` : `This register is too short to say whether ${v.name} is new.`} Its payment combines features that are rare in this company's own spend${shown.filter(x => x.score >= 1).length ? `, above all ${shown.filter(x => x.score >= 1).map(x => x.text.replace(/^a |^an /, '')).join(' and ')}` : ''}. None is conclusive alone, which is why they are scored together. Confirm the vendor exists in the master file, its bank details, and that the invoice is supported.`,
      }))
    }
  }
  return out
}

/**
 * One slip apart: a letter added, dropped or changed, or two neighbours
 * swapped. Two separate changes is usually a different word ("Media" and
 * "Medical", "Fulton" and "Falcon"), not a typo.
 */
function oneSlipApart(a: string, b: string): boolean {
  if (a === b || Math.abs(a.length - b.length) > 1) return false
  const [s, l] = a.length <= b.length ? [a, b] : [b, a]
  let i = 0
  while (i < s.length && s[i] === l[i]) i++
  if (s.length === l.length) {
    if (s.slice(i + 1) === l.slice(i + 1)) return true
    return s[i] === l[i + 1] && s[i + 1] === l[i] && s.slice(i + 2) === l.slice(i + 2)
  }
  return s.slice(i) === l.slice(i + 1)
}

/**
 * A new vendor spelled almost exactly like an established one: a typo-squat
 * set up to receive payments meant for a real supplier, or a duplicate master
 * record. A whole different word ("Supply" and "Services") is too far away to
 * trip this, which leaves genuinely different companies alone.
 */
function detectLookalikeVendors(ctx: Ctx): Draft[] {
  const { cfg } = ctx
  const out: Draft[] = []
  const first = (v: Vendor) => v.rows.find(r => Number.isFinite(r.day))?.day ?? NaN
  const known = [...ctx.vendors.values()].filter(v => v.rows.length >= cfg.vendorMinHistory + 1)
  for (const v of ctx.vendors.values()) {
    if (v.key.length < 8 || first(v) - ctx.start < cfg.newVendorGraceDays) continue
    // A difference in digits is a store or branch number, not a misspelling.
    const digits = (key: string) => key.replace(/\D/g, '')
    const twin = known.find(k => k !== v && first(k) < first(v) && digits(k.key) === digits(v.key) && oneSlipApart(v.key, k.key))
    if (!twin) continue
    const total = v.rows.reduce((t, r) => t + r.tx.amount, 0)
    out.push(draft('new_vendor_risk', `New vendor named almost like an existing one — ${v.name}`, v.rows, {
      amount: total, severity: 'HIGH', confidence: 88,
      description: `${v.name} first appears on ${v.rows[0].tx.date} and is paid ${fmtAmt(total)}. Its name is nearly identical to ${twin.name}, an established vendor.`,
      reasoning: `A new vendor record one character from a real supplier is how payments get redirected, and also how duplicate master records start. Compare its bank details and tax ID with ${twin.name}'s.`,
    }))
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
  if (ctx.roundShare >= 0.3) return [] // round sums are ordinary in this company's spend
  const out: Draft[] = []
  for (const v of ctx.vendors.values()) {
    if (v.rows.length < 5) continue
    const irregularAll = v.rows.filter(o => !isRoundHundred(o.tx.amount)).length
    for (const r of v.rows) {
      if (r.tx.amount < cfg.roundNumberMin || !isRoundThousand(r.tx.amount) || inSeries(v, r) || allocation(v, r) || notPayment(r.tx)) continue
      const others = v.rows.length - 1
      const irregular = irregularAll / others // this payment is round, so every irregular one is another
      if (irregular < cfg.roundOthersIrregularShare) continue
      out.push(draft('round_number', `Round amount, unusual for this vendor — ${v.name}`, [r], {
        amount: r.tx.amount, severity: 'LOW', confidence: 60,
        description: `${fmtAmt(r.tx.amount)} to ${r.tx.vendor} on ${r.tx.date || 'an undated row'} is a round amount, while ${Math.round(irregular * 100)}% of its other ${plural(others, 'payment')} are irregular figures (${rowLabel(r.tx)}).`,
        reasoning: 'A round figure from a vendor that otherwise bills computed amounts can mean an estimate, a deposit or an unsupported invoice. Weak on its own, so it is raised at low severity and kept out of risk exposure; check that an invoice supports it.',
      }))
    }
  }
  // Many vendors paid round sums on one day is a company-wide event (a bonus
  // run, a grant round), not a series of unsupported invoices.
  const perDay = new Map<string, number>()
  for (const f of out) { const d = ctx.rows.find(r => r.tx.id === f.rowRefs[0])?.tx.date ?? ''; perDay.set(d, (perDay.get(d) ?? 0) + 1) }
  return out.filter(f => (perDay.get(ctx.rows.find(r => r.tx.id === f.rowRefs[0])?.tx.date ?? '') ?? 0) < 5)
}

// ─── 10. Missing payee ────────────────────────────────────────────────────────

/** Bookkeeping entries that legitimately name no payee. */
const NON_CASH = /deprecia|amorti[sz]|accru|reclass|re-?measure|revaluation|write.?(off|down)|true.?up|\bfx\b|exchange (gain|loss)|interest|adjust|\baje\b|allocation/i
const noPayeeExpected = (t: StoredTransaction) =>
  notPayment(t) || NON_CASH.test(t.description) || NON_CASH.test(t.category) || NON_CASH.test(t.account)

function detectMissingVendor(txs: StoredTransaction[], cfg: DetectionConfig): Draft[] {
  const blanks = txs.filter(t => t.amount > 0 && isMissingVendor(t.vendor) && !noPayeeExpected(t))
  if (blanks.length === 0) return []
  const rows: Row[] = blanks.map(tx => ({ tx, day: dayNumber(tx.date), key: '', acct: '', refs: new Set(), desc: '', invoiced: false }))
  const reasoning = 'Every payment must identify who was paid. A blank payee means a data-entry gap, a broken export mapping, or a payment nobody wants traced. Identify the counterparty for each row.'

  // A few are each worth a reviewer's attention; a flood is one problem with the export.
  if (blanks.length <= cfg.missingPayeeGroupAbove) {
    return rows.map(r => draft('missing_vendor', `Payment with no payee — ${fmtAmt(r.tx.amount)}`, [r], {
      amount: r.tx.amount, severity: r.tx.amount >= cfg.approvalLimit ? 'HIGH' : 'MEDIUM', confidence: 97, vendor: '(no payee)', category: 'Data quality',
      description: `${fmtAmt(r.tx.amount)} on ${r.tx.date || 'an undated row'} (${rowLabel(r.tx)}) names ${r.tx.vendor.trim() ? `"${r.tx.vendor.trim()}" as its payee` : 'no vendor or payee'}.`,
      reasoning,
    }))
  }
  const total = blanks.reduce((s, t) => s + t.amount, 0)
  return [draft('missing_vendor', `${plural(blanks.length, 'payment')} with no payee`, rows, {
    amount: total, severity: blanks.length > 10 || total >= cfg.approvalLimit ? 'HIGH' : 'MEDIUM', confidence: 99,
    vendor: '(no payee)', category: 'Data quality',
    description: `${plural(blanks.length, 'payment')} totalling ${fmtAmt(total)} name no vendor or payee.`,
    reasoning,
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
  const ctx = buildContext(txs, cfg, allTxs.filter(t => t.direction === 'credit'))

  const drafts = merge([
    ...detectDuplicates(ctx),
    ...detectApprovalAvoidance(ctx),
    ...detectPeriodMismatch(ctx, txs),
    ...detectVendorOutliers(ctx),
    ...detectCategoryOutliers(ctx),
    ...detectVelocity(ctx),
    ...detectNewVendorRisk(ctx),
    ...detectLookalikeVendors(ctx),
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
