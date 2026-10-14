/**
 * Synthetic AP registers with known answers.
 *
 * Each scenario mixes routine spend that is deliberately hard to leave alone
 * (rent on the 1st, fixed-price subscriptions, a round monthly retainer,
 * biweekly payroll, quarterly insurance just under the approval limit, a
 * courier paid several times a week, a cloud bill far larger than the rest of
 * its category) with planted problems whose flagged rows are recorded. The
 * evaluation then measures what the engine catches and what it raises that it
 * should not.
 */
import type { StoredTransaction, AnomalyType } from '../../src/lib/dataStore'

export interface Planted {
  key:       string
  /** Finding types that count as catching it. */
  types:     AnomalyType[]
  /** The flagged rows. A finding catches the plant when it flags one of them. */
  rows:      string[]
  /** Not every plant is visible in every window of data (a one-month file has no history). */
  required?: boolean
}

export interface Scenario {
  name:    string
  txs:     StoredTransaction[]
  planted: Planted[]
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function rng(seed: number) {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d)
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const calendarPeriod = (d: Date) => `${MON[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`
const cents = (r: () => number, lo: number, hi: number) => Math.round((lo + r() * (hi - lo)) * 100) / 100

class Register {
  txs: StoredTransaction[] = []
  private inv = 40000
  constructor(private period: (d: Date) => string = calendarPeriod) {}

  add(date: Date, vendor: string, amount: number, category: string, opts: { invoice?: string; desc?: string; period?: string; direction?: 'debit' | 'credit' } = {}): string {
    const id = `TX-${this.txs.length}`
    const invoice = opts.invoice ?? `INV-${++this.inv}`
    this.txs.push({
      id,
      date:        iso(date),
      vendor,
      amount,
      description: opts.desc ? `${opts.desc} ${invoice}` : `${category} ${invoice}`,
      category,
      account:     '',
      rowIndex:    this.txs.length,
      direction:   opts.direction ?? 'debit',
      period:      opts.period ?? this.period(date),
    })
    return id
  }
}

/** Every weekday-adjusted date of a month-day schedule between two dates. */
function monthly(from: Date, to: Date, day: number): Date[] {
  const out: Date[] = []
  for (let d = at(from.getFullYear(), from.getMonth() + 1, day); d <= to; d = at(d.getFullYear(), d.getMonth() + 2, day)) {
    if (d >= from) out.push(d)
  }
  return out
}
function every(from: Date, to: Date, days: number): Date[] {
  const out: Date[] = []
  for (let d = from; d <= to; d = addDays(d, days)) out.push(d)
  return out
}

// ── The register ────────────────────────────────────────────────────────────

/** Six months of routine AP spend, April to September 2026, with planted problems. */
export function sixMonthRegister(period?: (d: Date) => string): Scenario {
  const r = rng(20260930)
  const R = new Register(period)
  const from = at(2026, 4, 1), to = at(2026, 9, 30)
  const planted: Planted[] = []

  // Rent on the 1st: round, material, same amount, 28 to 31 days apart.
  for (const d of monthly(from, to, 1)) R.add(d, 'Harbor Point Properties', 12000, 'Rent', { desc: `Office rent ${MON[d.getMonth()]}` })
  // A round monthly retainer, plus two irregular project invoices.
  for (const d of monthly(from, to, 3)) R.add(d, 'Keller & Moss LLP', 15000, 'Professional Fees', { desc: 'Monthly retainer' })
  R.add(at(2026, 5, 21), 'Keller & Moss LLP', 4312.5, 'Professional Fees', { desc: 'Contract review' })
  R.add(at(2026, 8, 12), 'Keller & Moss LLP', 7880, 'Professional Fees', { desc: 'Due diligence support' })
  // Fixed-price subscriptions.
  for (const d of monthly(from, to, 12)) R.add(d, 'Slack Technologies', 1180, 'Software')
  for (const d of monthly(from, to, 18)) R.add(d, 'Zoom Video', 149.9, 'Software')
  for (const d of monthly(from, to, 20)) R.add(d, 'Figma', 675, 'Software')
  // A cloud bill far larger than everything else in Software, every month.
  for (const d of monthly(from, to, 5)) R.add(d, 'Northwind Cloud', cents(r, 41200, 44800), 'Software')
  // Small one-off software, so Software's median sits low.
  for (const [v, a, m, d] of [['JetBrains', 649, 4, 9], ['1Password', 287.88, 5, 2], ['Notion Labs', 96, 6, 14], ['Canva', 119.99, 7, 8], ['Loom', 180, 8, 22], ['Miro', 240, 9, 10], ['Postman', 588, 4, 27], ['Linear Orbit', 192, 6, 3]] as const) {
    R.add(at(2026, m, d), v, a, 'Software')
  }
  // An annual licence: one material, non-round payment on a weekday.
  R.add(at(2026, 6, 16), 'Atlassian', 28450, 'Software', { desc: 'Annual licence' })

  // Biweekly payroll and payroll tax.
  for (const d of every(at(2026, 4, 3), to, 14)) {
    R.add(d, 'Gusto Payroll', cents(r, 48000, 52500), 'Payroll')
    R.add(d, 'IRS EFTPS', cents(r, 14000, 16500), 'Payroll Taxes')
  }
  // Utilities with a variable bill.
  for (const d of monthly(from, to, 15)) R.add(addDays(d, Math.floor(r() * 4) - 2), 'City Power & Light', cents(r, 1800, 2600), 'Utilities')
  // Quarterly insurance inside the approval band, 91 days apart.
  R.add(at(2026, 4, 10), 'Hartwell Insurance', 9600, 'Insurance', { desc: 'Quarterly premium' })
  R.add(at(2026, 7, 10), 'Hartwell Insurance', 9600, 'Insurance', { desc: 'Quarterly premium' })
  // Weekly cleaning at a fixed price: the same amount every seven days.
  for (const d of every(at(2026, 4, 6), to, 7)) R.add(d, 'CleanCo Services', 480, 'Facilities', { desc: 'Weekly cleaning' })
  // Facilities management around $3,150 a month.
  const atlas: string[] = []
  for (const d of monthly(from, to, 22)) if (d < at(2026, 9, 1)) atlas.push(R.add(d, 'Atlas Facilities Co.', cents(r, 3000, 3350), 'Facilities'))
  R.add(at(2026, 9, 2), 'Atlas Facilities Co.', 3150, 'Facilities')
  // Landscaping, monthly around $2,000.
  for (const d of monthly(from, at(2026, 8, 31), 26)) R.add(d, 'Greenline Landscaping', cents(r, 1850, 2150), 'Facilities')
  // Weekly agency invoices that vary, below the approval band.
  for (const d of every(at(2026, 4, 6), to, 7)) R.add(d, 'Brightline Staffing', cents(r, 6000, 8500), 'Contract Labor')
  // A courier paid several times a week.
  for (let d = at(2026, 4, 1); d <= to; d = addDays(d, 1 + Math.floor(r() * 3))) R.add(d, 'FedEx', cents(r, 20, 400), 'Shipping')
  // Office supplies, irregular.
  for (let d = at(2026, 4, 4); d <= to; d = addDays(d, 5 + Math.floor(r() * 7))) R.add(d, 'Staples', cents(r, 40, 600), 'Office Supplies')
  // A vendor genuinely coded two ways.
  for (let d = at(2026, 4, 7); d <= to; d = addDays(d, 6 + Math.floor(r() * 8))) {
    R.add(d, 'Amazon Business', cents(r, 30, 800), r() < 0.7 ? 'Office Supplies' : 'IT Equipment')
  }
  // Travel.
  for (let d = at(2026, 4, 9); d <= to; d = addDays(d, 10 + Math.floor(r() * 10))) R.add(d, 'Delta Air Lines', cents(r, 300, 1500), 'Travel')
  for (let d = at(2026, 4, 14); d <= to; d = addDays(d, 20 + Math.floor(r() * 14))) R.add(d, 'Marriott', cents(r, 400, 1200), 'Travel')
  for (let d = at(2026, 4, 2); d <= to; d = addDays(d, 4 + Math.floor(r() * 6))) R.add(d, 'Uber', cents(r, 18, 90), 'Travel')
  // Fuel weekly.
  for (const d of every(at(2026, 4, 2), to, 7)) R.add(d, 'Shell', cents(r, 180, 420), 'Fuel')
  // Equipment, irregular amounts.
  for (const [m, d, a] of [[4, 21, 2344.18], [5, 28, 6120.4], [7, 15, 1189.99], [8, 25, 4410.75]] as const) R.add(at(2026, m, d), 'Dell Technologies', a, 'IT Equipment')
  // Freight, monthly-ish and irregular.
  for (const [m, d, a] of [[4, 16, 15240.1], [5, 14, 17110.55], [6, 18, 16380], [7, 16, 18990.25], [8, 13, 15875.6]] as const) R.add(at(2026, m, d), 'Corva Freight', a, 'Freight')
  // Printing.
  for (const [m, d, a] of [[4, 29, 1120.4], [6, 9, 1872.33], [8, 4, 990.1]] as const) R.add(at(2026, m, d), 'Summit Print Co.', a, 'Marketing')
  // Bank fees.
  for (const d of monthly(from, to, 28)) R.add(d, 'First Harbor Bank', 45, 'Bank Fees')
  // A first-time vendor that is perfectly ordinary: one weekday, non-round, small.
  R.add(at(2026, 8, 18), 'Brightwater Catering', 1384.6, 'Meals')

  // ── Planted problems ──────────────────────────────────────────────────────
  // A. Freight paid twice for the same invoice, 14 days apart.
  R.add(at(2026, 9, 4), 'Corva Freight', 18420, 'Freight', { invoice: 'INV-77812', desc: 'Linehaul Aug wk 4' })
  planted.push({ key: 'A duplicate, 14 days', types: ['duplicate'], rows: [R.add(at(2026, 9, 18), 'Corva Freight', 18420, 'Freight', { invoice: 'INV-77812', desc: 'Linehaul Aug wk 4' })] })
  // B. Paid twice the same day.
  R.add(at(2026, 8, 11), 'Pioneer Logistics', 7315.4, 'Freight', { invoice: 'INV-3391', desc: 'Drayage' })
  planted.push({ key: 'B duplicate, same day', types: ['duplicate'], rows: [R.add(at(2026, 8, 11), 'Pioneer Logistics', 7315.4, 'Freight', { invoice: 'INV-3391', desc: 'Drayage' })] })
  // C. The same invoice paid under two spellings of one vendor.
  R.add(at(2026, 7, 7), 'Summit Print Co.', 2846.12, 'Marketing', { invoice: 'INV-5531', desc: 'Trade show print' })
  planted.push({ key: 'C duplicate, vendor spelled two ways', types: ['duplicate'], rows: [R.add(at(2026, 7, 10), 'SUMMIT PRINT COMPANY', 2846.12, 'Marketing', { invoice: 'INV-5531', desc: 'Trade show print' })] })
  // D. Rent paid a second time inside the month.
  planted.push({ key: 'D rent paid twice in August', types: ['duplicate'], rows: [R.add(at(2026, 8, 9), 'Harbor Point Properties', 12000, 'Rent', { desc: 'Office rent Aug' })] })
  // E. Payments split under the $10,000 approval limit.
  R.add(at(2026, 5, 12), 'Vertex Contractors', 3200, 'Contract Labor')
  R.add(at(2026, 7, 2), 'Vertex Contractors', 4150.5, 'Contract Labor')
  const vertex = ([[8, 9850], [9, 9700], [11, 9950], [14, 9600]] as const).map(([d, a]) => R.add(at(2026, 9, d), 'Vertex Contractors', a, 'Contract Labor'))
  planted.push({ key: 'E split under approval limit', types: ['approval_avoidance'], rows: vertex })
  // F. Far above a vendor's own history (seven prior payments).
  planted.push({ key: 'F vendor outlier, long history', types: ['outlier', 'large_amount'], rows: [R.add(at(2026, 9, 24), 'Atlas Facilities Co.', 27300, 'Facilities')] })
  // G. Far above a vendor's own history (five prior payments).
  planted.push({ key: 'G vendor outlier, short history', types: ['outlier', 'large_amount'], rows: [R.add(at(2026, 9, 26), 'Greenline Landscaping', 14800, 'Facilities')] })
  // H. A supplies vendor suddenly coded to consulting.
  planted.push({ key: 'H coding change', types: ['category_mismatch'], rows: [R.add(at(2026, 8, 19), 'Staples', 312.44, 'Consulting')] })
  // I. Dated October, labelled September.
  planted.push({ key: 'I posted outside its period', types: ['period_mismatch'], rows: [R.add(at(2026, 10, 2), 'Halden Software', 42000, 'Software', { period: (period ?? calendarPeriod)(at(2026, 9, 15)) })] })
  // J. A first-time vendor: one round, material payment on a Saturday, late in the register.
  planted.push({ key: 'J new vendor, several signals', types: ['new_vendor_risk'], rows: [R.add(at(2026, 9, 26), 'Keystone Advisory LLC', 15000, 'Consulting')] })
  // K. A vendor that appears mid-register and is paid four times in five days.
  const quick = ([[14, 1240.18], [15, 980.55], [17, 1410.2], [18, 1105.32]] as const).map(([d, a]) => R.add(at(2026, 7, d), 'Quickline Supplies', a, 'Office Supplies'))
  planted.push({ key: 'K new vendor burst', types: ['high_frequency'], rows: quick })
  // L. Weekly fuel suddenly six times in seven days.
  const burst = [3, 4, 5, 6, 8].map(d => R.add(at(2026, 8, d), 'Shell', cents(r, 180, 420), 'Fuel'))
  planted.push({ key: 'L established vendor burst', types: ['high_frequency'], rows: burst })
  // M. Payments with no payee.
  const blanks = [R.add(at(2026, 6, 11), '', 4200, 'Uncategorized'), R.add(at(2026, 8, 27), '', 880, 'Uncategorized')]
  planted.push({ key: 'M missing payee', types: ['missing_vendor'], rows: blanks })
  // N. A round amount from a vendor that otherwise bills irregular figures.
  planted.push({ key: 'N round amount, unusual for vendor', types: ['round_number'], rows: [R.add(at(2026, 6, 30), 'Dell Technologies', 8000, 'IT Equipment')], required: false })
  // O. A charter far above anything else in Travel, from a vendor with almost no history.
  R.add(at(2026, 5, 6), 'Coastal Charter Co.', 640, 'Travel')
  planted.push({ key: 'O far above its category', types: ['large_amount', 'outlier'], rows: [R.add(at(2026, 8, 20), 'Coastal Charter Co.', 23900, 'Travel')] })

  return { name: 'Six months, calendar periods', txs: R.txs, planted }
}

/** Only September: most routine vendors appear once, and nobody has history. */
export function oneMonthRegister(): Scenario {
  const full = sixMonthRegister()
  const keep = (t: StoredTransaction) => t.date >= '2026-09-01' && t.date <= '2026-09-30'
  const txs = full.txs.filter(keep)
  const ids = new Set(txs.map(t => t.id))
  const planted = full.planted
    .filter(p => p.rows.some(r => ids.has(r)))
    .map(p => ({
      ...p,
      rows: p.rows.filter(r => ids.has(r)),
      // Needs history the month does not contain.
      required: !['F vendor outlier, long history', 'G vendor outlier, short history'].includes(p.key),
    }))
  return { name: 'One month (September only)', txs, planted }
}

/** The six-month register labelled with fiscal periods (year starting July), as many GL exports are. */
export function fiscalPeriodRegister(): Scenario {
  const fiscal = (d: Date) => {
    const fy = d.getMonth() >= 6 ? d.getFullYear() + 1 : d.getFullYear()
    const p = ((d.getMonth() + 6) % 12) + 1
    return `${fy}-${pad(p)}`
  }
  const s = sixMonthRegister(fiscal)
  return { ...s, name: 'Six months, fiscal-year period labels' }
}

export const SCENARIOS = [sixMonthRegister, oneMonthRegister, fiscalPeriodRegister]
