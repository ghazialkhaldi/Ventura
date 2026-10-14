/**
 * Randomised registers, generated independently of the hand-built scenarios
 * so the engine is not only judged on data it was shaped against. Each seed
 * draws a different mix of vendors, amounts and cadences, then plants a known
 * set of problems at random places.
 */
import type { StoredTransaction } from '../../src/lib/dataStore'
import type { Planted, Scenario } from './fixtures'

function rng(seed: number) {
  let s = seed % 2147483647 || 1
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

const pad = (n: number) => String(n).padStart(2, '0')
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const START = Date.UTC(2025, 9, 1) / 86_400_000      // 1 Oct 2025
const END   = Date.UTC(2026, 8, 30) / 86_400_000     // 30 Sep 2026
const isoOf = (day: number) => new Date(day * 86_400_000).toISOString().slice(0, 10)
const periodOf = (day: number) => { const d = new Date(day * 86_400_000); return `${MON[d.getUTCMonth()]}-${String(d.getUTCFullYear()).slice(2)}` }
const dow = (day: number) => new Date(day * 86_400_000).getUTCDay()
const weekday = (day: number) => (dow(day) === 6 ? day + 2 : dow(day) === 0 ? day + 1 : day)

const WORDS = ['Apex', 'Birch', 'Cobalt', 'Delta', 'Ember', 'Falcon', 'Granite', 'Harbor', 'Iron', 'Juniper', 'Kestrel', 'Lumen', 'Meridian', 'Northgate', 'Orchid', 'Pinnacle', 'Quarry', 'Ridge', 'Summit', 'Tidal', 'Upland', 'Vantage', 'Willow', 'Yardley', 'Zephyr', 'Atlas', 'Beacon', 'Crescent', 'Drift', 'Evergreen']
const KINDS = ['Supply', 'Logistics', 'Services', 'Partners', 'Group', 'Labs', 'Systems', 'Works', 'Solutions', 'Holdings']
const SUFFIX = ['Inc.', 'LLC', 'Co.', 'Ltd', '', '', '']
const CATS = ['Office Supplies', 'Software', 'Facilities', 'Professional Fees', 'Marketing', 'Travel', 'Freight', 'IT Equipment', 'Contract Labor', 'Utilities', 'Insurance', 'Meals']

type Kind = 'monthlyFixed' | 'monthlyVar' | 'weekly' | 'biweekly' | 'irregular' | 'rare' | 'paymentRun' | 'perJob'

export function randomRegister(seed: number): Scenario {
  const r = rng(seed * 7919 + 13)
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)]
  const logn = (base: number, sigma: number) => base * Math.exp(sigma * (r() + r() + r() - 1.5) * 1.6)
  const money = (x: number) => Math.round(x * 100) / 100

  const txs: StoredTransaction[] = []
  let inv = 100000
  const used = new Set<string>()
  const add = (day: number, vendor: string, amount: number, category: string, refs: boolean, opts: { invoice?: string; period?: string } = {}) => {
    const id = `TX-${txs.length}`
    const invoice = opts.invoice ?? `INV-${++inv}`
    txs.push({
      id, date: isoOf(day), vendor, amount: money(amount), category, account: '', rowIndex: txs.length, direction: 'debit',
      description: refs ? `${category} ${invoice}` : vendor,
      period: opts.period ?? periodOf(day),
    })
    return id
  }
  const newName = () => {
    let n = ''
    do n = `${pick(WORDS)} ${pick(KINDS)} ${pick(SUFFIX)}`.trim(); while (used.has(n.split(' ').slice(0, 2).join(' ')))
    used.add(n.split(' ').slice(0, 2).join(' '))
    return n
  }

  interface V { name: string; kind: Kind; cat: string; alt?: string; refs: boolean; base: number; rows: string[] }
  const vendors: V[] = []
  const mix: [Kind, number][] = [['monthlyFixed', 14], ['monthlyVar', 14], ['weekly', 4], ['biweekly', 3], ['irregular', 34], ['rare', 15], ['paymentRun', 3], ['perJob', 3]]
  for (const [kind, n] of mix) for (let i = 0; i < n; i++) {
    const cat = pick(CATS)
    const base = kind === 'biweekly' ? 20000 + r() * 40000 : kind === 'weekly' ? 300 + r() * 6000 : kind === 'perJob' ? 2500 : logn(900, 1.1)
    vendors.push({ name: newName(), kind, cat, alt: r() < 0.12 ? pick(CATS.filter(c => c !== cat)) : undefined, refs: r() < 0.7, base: Math.min(base, 60000), rows: [] })
  }

  for (const v of vendors) {
    const catOf = () => (v.alt && r() < 0.4 ? v.alt : v.cat)
    if (v.kind === 'monthlyFixed') {
      const amt = r() < 0.4 ? Math.max(1000, Math.round(v.base / 1000) * 1000) : money(v.base)
      const dom = 1 + Math.floor(r() * 27)
      for (let m = 0; m < 12; m++) {
        const day = weekday(Date.UTC(2025, 9 + m, dom) / 86_400_000)
        if (day <= END) v.rows.push(add(day, v.name, amt, v.cat, v.refs))
      }
    } else if (v.kind === 'monthlyVar') {
      const dom = 3 + Math.floor(r() * 22)
      for (let m = 0; m < 12; m++) {
        const day = weekday(Date.UTC(2025, 9 + m, dom) / 86_400_000 + Math.floor(r() * 7) - 3)
        if (day <= END) v.rows.push(add(day, v.name, v.base * (0.85 + r() * 0.3), catOf(), v.refs))
      }
    } else if (v.kind === 'weekly') {
      for (let day = START + Math.floor(r() * 7); day <= END; day += 7) v.rows.push(add(day, v.name, v.base * (0.8 + r() * 0.4), v.cat, v.refs))
    } else if (v.kind === 'biweekly') {
      for (let day = START + Math.floor(r() * 14); day <= END; day += 14) v.rows.push(add(day, v.name, v.base * (0.97 + r() * 0.06), v.cat, v.refs))
    } else if (v.kind === 'irregular') {
      const gap = 3 + r() * 25
      for (let day = START + Math.floor(r() * gap); day <= END; day += Math.max(1, Math.round(gap * (0.3 + r() * 1.4)))) {
        v.rows.push(add(weekday(day), v.name, logn(v.base, 0.45), catOf(), v.refs))
      }
    } else if (v.kind === 'rare') {
      const n = 1 + Math.floor(r() * 3)
      for (let i = 0; i < n; i++) v.rows.push(add(weekday(START + Math.floor(r() * 360)), v.name, logn(v.base * 3, 0.6), v.cat, v.refs))
    } else if (v.kind === 'paymentRun') {
      for (let day = START + 4; day <= END; day += 14) {
        const k = 2 + Math.floor(r() * 3)
        for (let i = 0; i < k; i++) v.rows.push(add(weekday(day), v.name, logn(v.base, 0.5), v.cat, true))
      }
    } else if (v.kind === 'perJob') {
      for (let day = START + Math.floor(r() * 10); day <= END; day += 5 + Math.floor(r() * 16)) v.rows.push(add(weekday(day), v.name, 2500, v.cat, true))
    }
  }

  // ── Planted problems ──────────────────────────────────────────────────────
  const planted: Planted[] = []
  const rowOf = (id: string) => txs.find(t => t.id === id)!
  const dayOf = (id: string) => Date.UTC(+rowOf(id).date.slice(0, 4), +rowOf(id).date.slice(5, 7) - 1, +rowOf(id).date.slice(8, 10)) / 86_400_000
  const taken = new Set<V>()
  const choose = (ok: (v: V) => boolean) => { const c = vendors.filter(v => !taken.has(v) && ok(v)); const v = c[Math.floor(r() * c.length)]; if (v) taken.add(v); return v }

  // Four duplicates of an irregular vendor's payment, 0 to 20 days later.
  for (const gap of [0, 3, 9, 20]) {
    const v = choose(v => (v.kind === 'irregular' || v.kind === 'monthlyVar') && v.rows.length >= 4 && v.refs)
    if (!v) continue
    const src = rowOf(v.rows[Math.floor(r() * v.rows.length)])
    const day = dayOf(src.id) + gap
    if (day > END) continue
    const invoice = src.description.split(' ').pop()!
    planted.push({ key: `duplicate +${gap}d`, types: ['duplicate'], rows: [add(day, src.vendor, src.amount, src.category, true, { invoice })] })
  }
  // An extra payment inside a monthly fixed series.
  {
    const v = choose(v => v.kind === 'monthlyFixed' && v.rows.length >= 6)
    if (v) {
      const src = rowOf(v.rows[3])
      planted.push({ key: 'extra payment in a monthly series', types: ['duplicate'], rows: [add(dayOf(src.id) + 6 + Math.floor(r() * 6), src.vendor, src.amount, src.category, v.refs)] })
    }
  }
  // Split under the approval limit.
  {
    const v = choose(v => v.kind === 'irregular' && v.base < 4000)
    if (v) {
      const d0 = weekday(START + 120 + Math.floor(r() * 150))
      const rows = [0, 1, 3, 5].slice(0, 3 + Math.floor(r() * 2)).map(o => add(d0 + o, v.name, 9050 + r() * 900, v.cat, v.refs))
      planted.push({ key: 'split under approval limit', types: ['approval_avoidance'], rows })
    }
  }
  // Two vendor outliers.
  for (let i = 0; i < 2; i++) {
    const v = choose(v => (v.kind === 'irregular' || v.kind === 'monthlyVar') && v.rows.length >= 8)
    if (!v) continue
    const amounts = v.rows.map(id => rowOf(id).amount).sort((a, b) => a - b)
    const med = amounts[Math.floor(amounts.length / 2)]
    const amt = Math.max(med * (6 + r() * 9), med + 2500) + 0.37
    planted.push({ key: `vendor outlier ${i + 1}`, types: ['outlier', 'large_amount'], rows: [add(weekday(START + 30 + Math.floor(r() * 320)), v.name, amt, v.cat, v.refs)] })
  }
  // A coding change.
  {
    const v = choose(v => !v.alt && v.rows.length >= 15)
    if (v) {
      const t = rowOf(v.rows[Math.floor(r() * v.rows.length)])
      t.category = pick(CATS.filter(c => c !== v.cat))
      planted.push({ key: 'coding change', types: ['category_mismatch'], rows: [t.id] })
    }
  }
  // Posted to the previous month's period.
  {
    const v = choose(v => v.rows.length >= 3)
    if (v) {
      const t = rowOf(v.rows[v.rows.length - 2])
      const d = dayOf(t.id)
      t.period = periodOf(d - new Date(d * 86_400_000).getUTCDate() - 1)
      planted.push({ key: 'posted outside its period', types: ['period_mismatch'], rows: [t.id] })
    }
  }
  // A new vendor's round, material weekend payment.
  {
    let day = START + 150 + Math.floor(r() * 150)
    while (dow(day) !== 6) day++
    planted.push({ key: 'new vendor, several signals', types: ['new_vendor_risk'], rows: [add(day, newName(), (12 + Math.floor(r() * 30)) * 1000, pick(CATS), r() < 0.5)] })
  }
  // A new vendor paid four times in five days.
  {
    const name = newName(), cat = pick(CATS)
    const d0 = weekday(START + 120 + Math.floor(r() * 180))
    const rows = [0, 1, 3, 4].map(o => add(d0 + o, name, 600 + r() * 1800, cat, true))
    planted.push({ key: 'new vendor burst', types: ['high_frequency'], rows })
  }
  // A payment with no payee.
  planted.push({ key: 'missing payee', types: ['missing_vendor'], rows: [add(weekday(START + Math.floor(r() * 360)), '', 1000 + r() * 8000, 'Uncategorized', false)] })

  return { name: `Random register, seed ${seed}`, txs, planted }
}
