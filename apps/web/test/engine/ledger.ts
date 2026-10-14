/**
 * Building blocks for realistic company registers: a ledger that writes rows
 * the way a given company's export looks, vendor archetypes that spend the
 * way real vendors are paid, and plants that reproduce real fraud and error
 * patterns in that company's own data style.
 */
import type { StoredTransaction, AnomalyType } from '../../src/lib/dataStore'
import type { Planted } from './fixtures'

export const DAY = 86_400_000
export const dayOf = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d) / DAY
export const isoOf = (day: number) => new Date(day * DAY).toISOString().slice(0, 10)
export const dow = (day: number) => new Date(day * DAY).getUTCDay()
const pad = (n: number) => String(n).padStart(2, '0')
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function rng(seed: number) {
  let s = (seed * 2654435761) % 2147483647 || 7
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

export type PeriodStyle = 'calendar' | 'fiscal7' | '445' | 'none'
export type DescStyle   = 'invoice' | 'memo' | 'bank'

/** The 4-4-5 retail calendar: fiscal year from Sunday 2 Feb 2025, periods of 4, 4 and 5 weeks, labelled by their nominal month. */
function retailPeriod(day: number): string {
  const fyStart = dayOf(2025, 2, 2)
  let w = Math.floor((day - fyStart) / 7)
  let fy = 2025
  while (w >= 52) { w -= 52; fy++ }
  while (w < 0) { w += 52; fy-- }
  const lengths = [4, 4, 5, 4, 4, 5, 4, 4, 5, 4, 4, 5]
  let p = 0
  while (w >= lengths[p]) { w -= lengths[p]; p++ }
  const month = (1 + p) % 12            // P1 is nominally February
  const year = month === 0 ? fy + 1 : fy // January belongs to the next calendar year
  return `${MON[month]}-${String(year).slice(2)}`
}

export interface LedgerOpts { start: number; end: number; periods: PeriodStyle; desc: DescStyle }

export class Ledger {
  txs: StoredTransaction[] = []
  byVendor = new Map<string, string[]>()
  planted: Planted[] = []
  private inv = 10_000
  constructor(public r: () => number, public o: LedgerOpts) {}

  /** A business day: payment runs never post on weekends. */
  wd(day: number) { const d = dow(day); return d === 6 ? day + 2 : d === 0 ? day + 1 : day }
  pick<T>(xs: readonly T[]): T { return xs[Math.floor(this.r() * xs.length)] }
  money(x: number) { return Math.round(x * 100) / 100 }
  /** Log-normal around a base. */
  around(base: number, sigma: number) { return base * Math.exp(sigma * (this.r() + this.r() + this.r() - 1.5) * 1.6) }
  ref() { return `INV-${++this.inv}` }

  period(day: number): string | undefined {
    const d = new Date(day * DAY), m = d.getUTCMonth(), y = d.getUTCFullYear()
    if (this.o.periods === 'calendar') return `${MON[m]}-${String(y).slice(2)}`
    if (this.o.periods === 'fiscal7') return `${m >= 6 ? y + 1 : y}-${pad(((m + 6) % 12) + 1)}`
    if (this.o.periods === '445') return retailPeriod(day)
    return undefined
  }

  add(day: number, vendor: string, amount: number, category: string, o: { account?: string; desc?: string; ref?: string | null; period?: string; direction?: 'debit' | 'credit' } = {}): string {
    const id = `TX-${this.txs.length}`
    const ref = o.ref === null ? '' : (o.ref ?? this.ref())
    const description =
      this.o.desc === 'invoice' ? `${o.desc ?? category} ${ref}`.trim()
      : this.o.desc === 'memo' ? (o.desc ?? category)
      : vendor.toUpperCase().slice(0, 22)
    const period = o.period ?? this.period(day)
    this.txs.push({
      id, date: isoOf(day), vendor, amount: this.money(amount), description, category,
      account: o.account ?? '', rowIndex: this.txs.length, direction: o.direction ?? 'debit',
      ...(period ? { period } : {}),
    })
    const list = this.byVendor.get(vendor); if (list) list.push(id); else this.byVendor.set(vendor, [id])
    return id
  }

  row(id: string) { return this.txs[Number(id.slice(3))] }
  dayOfRow(id: string) { const t = this.row(id); return dayOf(+t.date.slice(0, 4), +t.date.slice(5, 7), +t.date.slice(8, 10)) }
  plant(key: string, types: AnomalyType[], rows: string[], required = true) { this.planted.push({ key, types, rows, required }) }
}

// ── Vendor archetypes ─────────────────────────────────────────────────────────

/** A fixed monthly charge on a day of the month (rent, leases, subscriptions), with an optional mid-year increase. */
export function monthly(L: Ledger, vendor: string, amount: number, cat: string, dom: number, o: { account?: string; raiseAfter?: number; raisePct?: number; desc?: string; weekend?: boolean; ref?: string | null } = {}) {
  const ids: string[] = []
  const s = new Date(L.o.start * DAY)
  for (let k = 0; ; k++) {
    const raw = dayOf(s.getUTCFullYear(), s.getUTCMonth() + 1 + k, dom)
    if (raw > L.o.end) break
    if (raw < L.o.start) continue
    const amt = o.raiseAfter !== undefined && raw >= o.raiseAfter ? amount * (1 + (o.raisePct ?? 0.03)) : amount
    ids.push(L.add(o.weekend ? raw : L.wd(raw), vendor, amt, cat, { account: o.account, desc: o.desc, ref: o.ref }))
  }
  return ids
}

/** A variable monthly bill (utilities, telecom). */
export function monthlyVar(L: Ledger, vendor: string, base: number, cv: number, cat: string, dom: number, account?: string) {
  const ids: string[] = []
  const s = new Date(L.o.start * DAY)
  for (let k = 0; ; k++) {
    const raw = dayOf(s.getUTCFullYear(), s.getUTCMonth() + 1 + k, dom) + Math.floor(L.r() * 5) - 2
    if (raw > L.o.end) break
    if (raw < L.o.start) continue
    ids.push(L.add(L.wd(raw), vendor, base * (1 - cv + 2 * cv * L.r()), cat, { account }))
  }
  return ids
}

/** Every `step` days from a start (weekly agency invoices, biweekly payroll), amount from a function. */
export function every(L: Ledger, vendor: string, step: number, amount: () => number, cat: string, o: { offset?: number; account?: string; weekend?: boolean; desc?: string } = {}) {
  const ids: string[] = []
  for (let d = L.o.start + (o.offset ?? Math.floor(L.r() * step)); d <= L.o.end; d += step) {
    ids.push(L.add(o.weekend ? d : L.wd(d), vendor, amount(), cat, { account: o.account, desc: o.desc }))
  }
  return ids
}

/** On given weekdays every week (a bakery's flour on Tuesday and Friday). */
export function onWeekdays(L: Ledger, vendor: string, days: number[], amount: () => number, cat: string, account?: string) {
  const ids: string[] = []
  for (let d = L.o.start; d <= L.o.end; d++) if (days.includes(dow(d))) ids.push(L.add(d, vendor, amount(), cat, { account }))
  return ids
}

/** Irregular purchases at a monthly rate (general suppliers), amounts from a function. */
export function irregular(L: Ledger, vendor: string, perMonth: number, amount: () => number, cat: string | (() => string), o: { weekend?: boolean; account?: () => string } = {}) {
  const ids: string[] = []
  const gap = 30 / perMonth
  for (let d = L.o.start + Math.floor(L.r() * gap); d <= L.o.end; d += Math.max(1, Math.round(gap * (0.2 + L.r() * 1.6)))) {
    ids.push(L.add(o.weekend ? d : L.wd(d), vendor, amount(), typeof cat === 'function' ? cat() : cat, { account: o.account?.() }))
  }
  return ids
}

/** Daily activity (fuel cards, ad platforms, card processors), on a share of days. */
export function daily(L: Ledger, vendor: string, prob: number, amount: () => number, cat: string, o: { weekend?: boolean; account?: () => string; perDay?: () => number } = {}) {
  const ids: string[] = []
  for (let d = L.o.start; d <= L.o.end; d++) {
    if (!o.weekend && (dow(d) === 0 || dow(d) === 6)) continue
    if (L.r() > prob) continue
    const n = o.perDay?.() ?? 1
    for (let i = 0; i < n; i++) ids.push(L.add(d, vendor, amount(), cat, { account: o.account?.() }))
  }
  return ids
}

/** Construction-style progress billing: round monthly draws on a contract, then a retention release. */
export function project(L: Ledger, vendor: string, contract: number, months: number, startDay: number, cat: string, account: string) {
  const ids: string[] = []
  const draw = Math.round((contract * 0.9) / months / 1000) * 1000
  for (let k = 0; k < months; k++) {
    const d = startDay + k * 30 + Math.floor(L.r() * 5)
    if (d > L.o.end) break
    ids.push(L.add(L.wd(d), vendor, draw, cat, { account, desc: `Progress billing ${k + 1}` }))
  }
  const release = startDay + months * 30 + 20
  if (release <= L.o.end) ids.push(L.add(L.wd(release), vendor, Math.round((contract * 0.1) / 1000) * 1000, cat, { account, desc: 'Retention release' }))
  return ids
}

/** Equal installments against one invoice (deposits, grant tranches): the same reference by design. */
export function installments(L: Ledger, vendor: string, total: number, n: number, gapDays: number, startDay: number, cat: string, label = 'Installment') {
  const ref = L.ref()
  const ids: string[] = []
  for (let k = 0; k < n; k++) {
    const d = L.wd(startDay + k * gapDays)
    if (d > L.o.end) break
    ids.push(L.add(d, vendor, total / n, cat, { ref, desc: `${label} ${k + 1} of ${n}` }))
  }
  return ids
}

/** One invoice coded across cost centres in a GL detail export: same reference, same day, equal halves. */
export function splitCoded(L: Ledger, vendor: string, amount: number, day: number, cat: string, accounts: [string, string]) {
  const ref = L.ref()
  return accounts.map(a => L.add(L.wd(day), vendor, amount / 2, cat, { ref, account: a, desc: 'Allocated' }))
}

// ── Names ─────────────────────────────────────────────────────────────────────

const FIRST = ['James', 'Maria', 'Wei', 'Aisha', 'Daniel', 'Sofia', 'Omar', 'Priya', 'Lucas', 'Hannah', 'Mateo', 'Grace', 'Yusuf', 'Chloe', 'Ivan', 'Leila', 'Noah', 'Emma', 'Ravi', 'Fatima', 'Ethan', 'Olivia', 'Kenji', 'Amara']
const LAST  = ['Okafor', 'Nguyen', 'Garcia', 'Smith', 'Haddad', 'Kowalski', 'Patel', 'Rossi', 'Kim', 'Johnson', 'Silva', 'Novak', 'Brown', 'Ali', 'Murphy', 'Chen', 'Lopez', 'Weber', 'Tanaka', 'Mensah']
const CO_A  = ['Apex', 'Birch', 'Cobalt', 'Delta', 'Ember', 'Falcon', 'Granite', 'Harbor', 'Iron', 'Juniper', 'Kestrel', 'Lumen', 'Meridian', 'Northgate', 'Orchid', 'Pinnacle', 'Quarry', 'Ridge', 'Summit', 'Tidal', 'Upland', 'Vantage', 'Willow', 'Yardley', 'Zephyr', 'Atlas', 'Beacon', 'Crescent', 'Drift', 'Evergreen', 'Fulton', 'Garnet', 'Hollis', 'Ironwood', 'Jasper', 'Keystone', 'Linden', 'Marlow', 'Newport', 'Oakley']
const CO_B  = ['Supply', 'Logistics', 'Services', 'Partners', 'Group', 'Labs', 'Systems', 'Works', 'Solutions', 'Holdings', 'Industries', 'Trading', 'Distribution', 'Electric', 'Mechanical', 'Staffing', 'Consulting', 'Media', 'Foods', 'Medical']
const CO_C  = ['Inc.', 'LLC', 'Co.', 'Ltd', 'Corp.', '', '', '']

export class Names {
  private used = new Set<string>()
  constructor(private L: Ledger) {}
  company(): string {
    for (let i = 0; i < 500; i++) {
      const base = `${this.L.pick(CO_A)} ${this.L.pick(CO_B)}`
      if (this.used.has(base)) continue
      this.used.add(base)
      return `${base} ${this.L.pick(CO_C)}`.trim()
    }
    const n = `${this.L.pick(CO_A)} ${this.L.pick(CO_B)} ${this.used.size}`
    this.used.add(n)
    return n
  }
  person(): string {
    for (let i = 0; i < 500; i++) {
      const n = `${this.L.pick(FIRST)} ${this.L.pick(LAST)}`
      if (!this.used.has(n)) { this.used.add(n); return n }
    }
    return `${this.L.pick(FIRST)} ${this.L.pick(LAST)} ${this.used.size}`
  }
}
