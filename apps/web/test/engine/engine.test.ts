import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runAnomalyDetection, computeRiskExposure, vendorKey, parsePeriodLabel, flaggedRows, isMissingVendor, isRedactedPayee } from '../../src/lib/anomalyEngine'
import type { StoredTransaction } from '../../src/lib/dataStore'
import { SCENARIOS } from './fixtures'
import { randomRegister } from './random'
import { score } from './eval'
import { COMPANIES, runCompany } from './companies'

let n = 0
function tx(date: string, vendor: string, amount: number, extra: Partial<StoredTransaction> = {}): StoredTransaction {
  const i = n++
  return { id: `T${i}`, date, vendor, amount, description: extra.description ?? vendor, category: 'General', account: '', rowIndex: i, direction: 'debit', ...extra }
}
const types = (txs: StoredTransaction[]) => runAnomalyDetection(txs).map(f => f.type)

// ── The scored scenarios: the engine must keep its precision and recall ──────

for (const make of SCENARIOS) {
  test(`scenario: ${make().name}`, () => {
    const s = make()
    const r = score(s, runAnomalyDetection(s.txs))
    assert.equal(r.recall, 1, `missed: ${r.required.filter(c => !c.hit).map(c => c.p.key).join(', ')}`)
    assert.equal(r.fp.length, 0, `raised on routine spend: ${r.fp.map(f => f.title).join('; ')}`)
  })
}

test('randomised registers: recall at least 99%, precision at least 90%', () => {
  let found = 0, right = 0, req = 0, hit = 0
  for (let seed = 1; seed <= 16; seed++) {
    const s = randomRegister(seed)
    const r = score(s, runAnomalyDetection(s.txs))
    found += r.tp.length + r.fp.length; right += r.tp.length
    req += r.required.length; hit += r.required.filter(c => c.hit).length
  }
  // A 6x jump on a vendor with a dozen payments can sit inside its natural
  // range; a test demanding every one would demand noise elsewhere.
  assert.ok(hit / req >= 0.99, `recall ${hit}/${req}`)
  assert.ok(right / found >= 0.9, `precision ${(right / found * 100).toFixed(1)}%`)
})

test('seventeen realistic companies: precision at least 95%, recall at least 94%', () => {
  let found = 0, right = 0, req = 0, hit = 0
  for (const seed of [1, 2]) for (const make of COMPANIES) {
    const r = runCompany(make, seed)
    found += r.findings; right += r.correct; req += r.required; hit += r.caught
  }
  assert.ok(right / found >= 0.95, `precision ${(right / found * 100).toFixed(1)}%`)
  assert.ok(hit / req >= 0.94, `recall ${hit}/${req}`)
})

// ── Duplicates ───────────────────────────────────────────────────────────────

test('rent on the 1st, 28 to 31 days apart, is never a duplicate', () => {
  const rows = ['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01', '2026-06-01'].map(d => tx(d, 'Harbor Point', 12000))
  assert.deepEqual(types(rows), [])
})

test('a second payment inside a monthly cycle is a duplicate, and the next regular one is not', () => {
  const rows = ['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01'].map(d => tx(d, 'Harbor Point', 12000))
  const extra = tx('2026-03-09', 'Harbor Point', 12000)
  const found = runAnomalyDetection([...rows, extra])
  assert.equal(found.length, 1)
  assert.equal(found[0].type, 'duplicate')
  assert.deepEqual(flaggedRows(found[0]), [extra.id])
})

test('a shared invoice reference makes a duplicate even weeks apart', () => {
  const a = tx('2026-03-04', 'Corva Freight', 18420, { description: 'Linehaul INV-77812' })
  const b = tx('2026-03-18', 'Corva Freight', 18420, { description: 'Linehaul INV-77812' })
  const f = runAnomalyDetection([a, b])
  assert.equal(f[0]?.type, 'duplicate')
  assert.deepEqual(flaggedRows(f[0]), [b.id])
  assert.equal(f[0].severity, 'HIGH')
})

test('two invoice numbers on different days are two invoices', () => {
  const a = tx('2026-03-04', 'Fixed Price Co', 2500, { description: 'Job INV-1001' })
  const b = tx('2026-03-09', 'Fixed Price Co', 2500, { description: 'Job INV-1002' })
  assert.deepEqual(types([a, b]), [])
})

test('the same invoice under two spellings of one vendor is caught', () => {
  const a = tx('2026-07-07', 'Summit Print Co.', 2846.12, { description: 'Print INV-5531' })
  const b = tx('2026-07-10', 'SUMMIT PRINT COMPANY', 2846.12, { description: 'Print INV-5531' })
  assert.deepEqual(types([a, b]), ['duplicate'])
})

test('a refund beside its charge is not a duplicate', () => {
  const a = tx('2026-03-04', 'Staples', 1240)
  const b = tx('2026-03-06', 'Staples', 1240, { direction: 'credit' })
  assert.deepEqual(types([a, b]), [])
})

// ── Amounts ──────────────────────────────────────────────────────────────────

test('a vendor outlier is found with only five payments of history', () => {
  const hist = [2010, 1980, 2105, 1890, 2050].map((a, i) => tx(`2026-0${i + 1}-15`, 'Greenline', a))
  const big = tx('2026-07-15', 'Greenline', 14800)
  const f = runAnomalyDetection([...hist, big])
  assert.equal(f.length, 1)
  assert.equal(f[0].type, 'outlier')
  assert.deepEqual(f[0].rowRefs, [big.id])
})

test('a routinely large vendor never trips its category', () => {
  const rows = [
    ...Array.from({ length: 6 }, (_, i) => tx(`2026-0${i + 1}-05`, 'Northwind Cloud', 42000 + i * 300, { category: 'Software' })),
    ...['Slack', 'Zoom', 'Figma', 'Canva', 'Loom', 'Miro', 'Notion', 'JetBrains', 'Postman'].map((v, i) => tx(`2026-0${(i % 6) + 1}-12`, v, 100 + i * 80, { category: 'Software' })),
  ]
  assert.deepEqual(types(rows), [])
})

// ── Calendars and history ────────────────────────────────────────────────────

test('fiscal period labels are learned, not flagged on every row', () => {
  // A July fiscal year: April 2026 is period 10 of FY2026, labelled "2026-10".
  const months = [3, 4, 5, 6, 7, 8]
  const rows = months.flatMap(m => [1, 10, 20].map(d => {
    const date = `2026-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const fy = m >= 6 ? 2027 : 2026, p = ((m + 6) % 12) + 1
    return tx(date, `Vendor ${m}-${d}`, 100 + d, { period: `${fy}-${String(p).padStart(2, '0')}` })
  }))
  assert.deepEqual(types(rows).filter(t => t === 'period_mismatch'), [])
  const wrong = tx('2026-10-02', 'Halden', 900, { period: '2027-03' }) // dated October, labelled fiscal September
  const f = runAnomalyDetection([...rows, wrong])
  assert.ok(f.some(x => x.type === 'period_mismatch' && x.rowRefs.includes(wrong.id)))
})

test('a vendor paid once in a one-month export is not called new', () => {
  const rows = [
    tx('2026-09-01', 'Harbor Point Properties', 12000, { category: 'Rent' }),
    tx('2026-09-03', 'Keller & Moss LLP', 15000, { category: 'Professional Fees' }),
    ...Array.from({ length: 20 }, (_, i) => tx(`2026-09-${String(i + 5).padStart(2, '0')}`, `Supplier ${i}`, 120 + i, { category: 'Office Supplies' })),
  ]
  assert.deepEqual(types(rows), [])
  // With no categories at all, the largest bills are not compared with the stationery.
  assert.deepEqual(types(rows.map(r => ({ ...r, category: '' }))), [])
})

// ── Merging and exposure ─────────────────────────────────────────────────────

test('rules firing on one row merge into one finding that lists every signal', () => {
  const rows = Array.from({ length: 40 }, (_, i) => tx(`2026-0${(i % 6) + 1}-${String((i % 27) + 1).padStart(2, '0')}`, `Vendor ${i}`, 300 + i))
  for (const r of rows) r.period = `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'][Number(r.date.slice(5, 7)) - 1]}-26`
  const halden = tx('2026-07-04', 'Halden Software', 42000, { period: 'Jun-26' }) // a Saturday, round, material, new, wrong period
  const f = runAnomalyDetection([...rows, halden]).filter(x => x.rowRefs.includes(halden.id))
  assert.equal(f.length, 1)
  assert.ok((f[0].alsoMatched ?? []).length >= 1)
})

test('exposure counts a duplicate once, and nothing once it is decided', () => {
  const a = tx('2026-03-04', 'Corva', 18420, { description: 'INV-1001' })
  const b = tx('2026-03-04', 'Corva', 18420, { description: 'INV-1001' })
  const found = runAnomalyDetection([a, b])
  assert.equal(computeRiskExposure(found, [a, b]).exposure, 18420)
  found[0].status = 'Resolved'
  assert.equal(computeRiskExposure(found, [a, b]).exposure, 0)
})

test('finding ids carry their source prefix so merged sources never collide', () => {
  const f = runAnomalyDetection([tx('2026-03-04', 'X', 500), tx('2026-03-04', 'X', 500)], {}, { idPrefix: 'QB' })
  assert.match(f[0].id, /^ANO-QB-\d{3}$/)
})

// ── Identity and labels ──────────────────────────────────────────────────────

test('vendor keys fold spelling, case and legal suffixes', () => {
  assert.equal(vendorKey('Summit Print Co.'), vendorKey('SUMMIT PRINT COMPANY'))
  assert.equal(vendorKey('Keller & Moss LLP'), vendorKey('keller and moss'))
  assert.equal(vendorKey('The Atlas Group, Inc.'), 'atlas group')
  assert.notEqual(vendorKey('شركة الخليج'), '')
})

test('period labels parse in their common forms', () => {
  assert.deepEqual(parsePeriodLabel('Sep-26'), { year: 2026, month: 8 })
  assert.deepEqual(parsePeriodLabel('September 2026'), { year: 2026, month: 8 })
  assert.deepEqual(parsePeriodLabel('2026-09'), { year: 2026, month: 8 })
  assert.deepEqual(parsePeriodLabel('09/2026'), { year: 2026, month: 8 })
  assert.equal(parsePeriodLabel('2026-13'), null)
})

test('fiscal period labels parse, and adjustment periods have no month', () => {
  for (const l of ['FY26-P03', 'FY2026 P03', 'fy26 period 3', 'P03 FY26', 'Period 3 2026', '2026-P03', '003/2026', '2026/003']) {
    assert.deepEqual(parsePeriodLabel(l), { year: 2026, month: 2 }, l)
  }
  for (const l of ['FY26-P13', 'P13 FY26', '2026-P14', '013/2026', 'FY26-P00']) assert.equal(parsePeriodLabel(l), null, l)
})

test('a fiscal calendar is learned, one row outside it is reported, and period 13 is not', () => {
  const tx = (id: number, date: string, period: string): StoredTransaction => ({ id: `TX-${id}`, date, vendor: `Vendor ${id}`, amount: 1200 + id * 13.17, description: 'x', category: 'c', account: 'a', rowIndex: id, direction: 'debit', period })
  const txs: StoredTransaction[] = []
  for (let i = 0; i < 40; i++) txs.push(tx(i, `2026-0${1 + (i % 6)}-1${i % 9}`, `FY26-P${String(7 + (i % 6)).padStart(2, '0')}`))
  txs.push(tx(100, '2026-03-05', 'FY26-P06'))
  txs.push(tx(101, '2026-06-30', 'FY26-P13'))
  const flagged = runAnomalyDetection(txs).filter(f => f.type === 'period_mismatch')
  assert.deepEqual(flagged.flatMap(f => flaggedRows(f)), ['TX-100'])
})

// ── Real ledgers: invoice numbers, reversals, accruals, splits ───────────────

const L = (id: number, date: string, vendor: string, amount: number, extra: Partial<StoredTransaction> = {}): StoredTransaction =>
  ({ id: `TX-${id}`, date, vendor, amount, description: 'Parts', category: 'Parts', account: 'Yard', rowIndex: id, direction: 'debit', ...extra })
/** Enough ordinary history that a vendor is not new and has a rhythm of its own. */
const history = (vendor: string, around: number, n = 12) => Array.from({ length: n }, (_, i) =>
  L(9000 + i + vendor.length * 100, `2025-${String(1 + (i % 12)).padStart(2, '0')}-1${i % 7}`, vendor, around + i * 73.31, { invoice: `H-${vendor.length}${1000 + i}` }))
const dupes = (txs: StoredTransaction[]) => runAnomalyDetection(txs).filter(f => f.type === 'duplicate')

test('one invoice retyped without its prefix is the same invoice', () => {
  const f = dupes([...history('Stellar Pump', 9000), L(1, '2026-03-02', 'Stellar Pump', 12384.1, { invoice: 'SPS-48213' }), L(2, '2026-03-16', 'Stellar Pump', 12384.1, { invoice: 'SPS48213' }), L(3, '2026-03-27', 'Stellar Pump', 12384.1, { invoice: '48213' })])
  assert.deepEqual(f.flatMap(flaggedRows).sort(), ['TX-2', 'TX-3'])
})

test('an invoice re-keyed with digits swapped is caught', () => {
  const f = dupes([...history('Harbor Motors', 9000), L(1, '2026-04-02', 'Harbor Motors', 14582.4, { invoice: 'HM-77120' }), L(2, '2026-04-13', 'Harbor Motors', 14528.4, { invoice: 'HM-77120' })])
  assert.deepEqual(f.flatMap(flaggedRows), ['TX-2'])
})

test('a multi-line invoice re-entered as one line matches on its total', () => {
  const f = dupes([...history('Apex Paint', 20000), L(1, '2026-03-10', 'Apex Paint', 18000.25, { invoice: 'AP-55100', account: 'Yard' }), L(2, '2026-03-10', 'Apex Paint', 13000.5, { invoice: 'AP-55100', account: 'Dock' }), L(3, '2026-03-26', 'Apex Paint', 31000.75, { invoice: 'AP-55100R' })])
  assert.deepEqual(f.flatMap(flaggedRows), ['TX-3'])
})

test('partial payments of one invoice are not duplicates', () => {
  assert.equal(dupes([...history('Keel Co', 9000), L(1, '2026-03-02', 'Keel Co', 4000.1, { invoice: 'KC-90011' }), L(2, '2026-03-20', 'Keel Co', 6210.4, { invoice: 'KC-90011' })]).length, 0)
})

test('a void and reissue is one payment, however it is numbered', () => {
  assert.equal(dupes([...history('Scaffold Co', 15000), L(1, '2026-02-02', 'Scaffold Co', 15604.2, { invoice: 'SC-44120' }), L(2, '2026-02-10', 'Scaffold Co', 15604.2, { invoice: 'SC-44120', direction: 'credit' }), L(3, '2026-02-11', 'Scaffold Co', 15604.2, { invoice: 'SC-44120' })]).length, 0)
})

test('an accrual with its reversal is routine; without one it is expensed twice', () => {
  const accrual = L(1, '2026-03-31', 'Praxis Group', 140000.6, { description: 'Accrue Q3 advisory', source: 'journal' })
  const invoice = L(3, '2026-04-16', 'Praxis Group', 140000.6, { invoice: 'PG-81020', source: 'ap' })
  const reversal = L(2, '2026-04-01', 'Praxis Group', 140000.6, { description: 'Reverse accrual', source: 'journal', direction: 'credit' })
  const hist = history('Praxis Group', 42000)
  assert.equal(dupes([...hist, accrual, reversal, invoice]).length, 0)
  assert.deepEqual(dupes([...hist, accrual, invoice]).flatMap(flaggedRows), ['TX-3'])
})

test('journals and interest name no payee by design; real payments are each reported', () => {
  const f = runAnomalyDetection([
    L(1, '2026-01-31', '', 612000, { description: 'Monthly depreciation', source: 'journal' }),
    L(2, '2026-01-31', '', 48000, { description: 'Amortization of intangibles' }),
    L(3, '2026-01-21', '', 18240.55, { description: 'Misc. payment', source: 'ap' }),
    L(4, '2026-01-22', 'UNKNOWN VENDOR', 6480.2, { description: 'Shop supplies', source: 'ap' }),
  ]).filter(x => x.type === 'missing_vendor')
  assert.deepEqual(f.flatMap(flaggedRows).sort(), ['TX-3', 'TX-4'])
})

test('a batch held back at one period end is reported; a calendar that drifts every month is not', () => {
  const base = (i: number) => L(i, `2026-0${1 + (i % 6)}-1${i % 9}`, `Vendor ${i}`, 1500 + i * 11.3, { period: `FY26-P${String(7 + (i % 6)).padStart(2, '0')}` })
  const ledger = Array.from({ length: 60 }, (_, i) => base(i))
  const batch = [0, 1, 2, 3, 4].map(k => L(100 + k, '2026-04-02', `Held ${k}`, 7000 + k, { period: 'FY26-P09' }))
  assert.equal(runAnomalyDetection([...ledger, ...batch]).filter(x => x.type === 'period_mismatch').flatMap(flaggedRows).length, 5)
  const months = ['2026-02-02', '2026-03-02', '2026-04-02', '2026-05-02', '2026-06-02']
  const drift = months.map((d, k) => L(200 + k, d, `Drift ${k}`, 7000 + k, { period: `FY26-P${String(7 + k).padStart(2, '0')}` }))
  assert.equal(runAnomalyDetection([...ledger, ...drift]).filter(x => x.type === 'period_mismatch').length, 0)
})

test('a split is found under a limit nobody configured, in the money the limit is written in', () => {
  const eur = [19480.3, 19715.85, 19620.4]
  const hist = history('Hanse Stahl', 12000).map(t => ({ ...t, entity: '400', localAmount: t.amount / 1.17 }))
  const split = eur.map((e, k) => L(k + 1, `2025-11-0${4 + k}`, 'Hanse Stahl', Math.round(e * 117) / 100, { entity: '400', localAmount: e, invoice: `HS-7000${k}` }))
  const f = runAnomalyDetection([...hist, ...split]).filter(x => x.type === 'approval_avoidance')
  assert.equal(f.length, 1)
  assert.match(f[0].description, /own currency/)
})

test('a new vendor one letter from a real one is raised; a branch number and a different word are not', () => {
  const real = history('Pacific Marine Supply', 6000)
  const flagged = (name: string) => runAnomalyDetection([...real, ...history('Filler Vendor Inc', 3000), L(1, '2026-03-05', name, 8740.55, { invoice: 'X-1' })]).some(x => x.type === 'new_vendor_risk' && /almost like/.test(x.title))
  assert.equal(flagged('Pacifc Marine Supply'), true)
  assert.equal(flagged('Pacific Marine Services'), false)
  assert.equal(flagged('Pacific Marine Supply 2'), false)
})

test('one departure from a five-payment coding pattern is reported', () => {
  const coded = [0, 1, 2, 3, 4].map(k => L(k, `2025-0${k + 2}-18`, 'Ostermann Tools', 200000 + k * 9000.5, { category: 'CIP Machinery' }))
  const f = runAnomalyDetection([...coded, L(9, '2026-03-24', 'Ostermann Tools', 212450.7, { category: 'Repairs' })]).filter(x => x.type === 'category_mismatch')
  assert.deepEqual(f.flatMap(flaggedRows), ['TX-9'])
})

test('accents do not make a second vendor', () => assert.equal(vendorKey('MÜLLER Schiffstechnik GmbH'), vendorKey('Muller Schiffstechnik')))

test('a vendor first seen mid-register still gets the burst check once it has history', () => {
  const late = Array.from({ length: 10 }, (_, i) => L(i, `2025-${String(3 + i).padStart(2, '0')}-14`, 'Harmon CPAs', 3000 + i * 91.7, { invoice: `HC-${1000 + i}` }))
  const start = L(50, '2025-01-02', 'Some Other Vendor', 500)
  const week = Array.from({ length: 8 }, (_, i) => L(60 + i, `2025-07-0${1 + (i % 5)}`, 'Harmon CPAs', 2100 + i * 171.3, { invoice: `HC-${2000 + i}` }))
  assert.ok(runAnomalyDetection([start, ...late, ...week]).some(f => f.type === 'high_frequency'))
})

test('a steady vendor billing three times its norm is news; a volatile one is not', () => {
  const series = (spread: number) => Array.from({ length: 12 }, (_, i) => L(i, `2025-${String(1 + i).padStart(2, '0')}-1${i % 8}`, 'Contract Co', 14800 * (1 + spread * Math.sin(i * 2.3)), { invoice: `CC-${1000 + i}` }))
  const spike = L(99, '2025-08-05', 'Contract Co', 45880.4, { invoice: 'CC-9999' })
  const out = (txs: StoredTransaction[]) => runAnomalyDetection(txs).filter(f => f.type === 'outlier').length
  assert.equal(out([...series(0.04), spike]), 1)
  assert.equal(out([...series(0.9), spike]), 0)
})

test('same invoice with a freight line added on re-entry is a duplicate', () => {
  assert.equal(dupes([...history('Blue Rx', 30000), L(1, '2025-09-02', 'Blue Rx', 38000.5, { invoice: 'BR-71002' }), L(2, '2025-09-22', 'Blue Rx', 38456.51, { invoice: 'BR-71002' })]).length, 1)
})

test('lines of one invoice posted together are not duplicates of each other', () => {
  const lines = ['North', 'South', 'East'].map((l, k) => L(k + 1, '2025-02-20', 'NetGuard IT', 5120.4, { invoice: 'NG-32078', description: `Allocation ${l}` }))
  assert.equal(dupes([...history('NetGuard IT', 14000), ...lines]).length, 0)
})

test('placeholder payees are missing payees', () => {
  for (const n of ['Various', 'MISC', 'Sundry', 'Cash']) assert.equal(isMissingVendor(n), true, n)
  assert.equal(isMissingVendor('Various Marine Supply'), false)
})

test('leading zeros on an invoice number are padding', () => {
  assert.deepEqual(dupes([...history('Ostrom Structural', 20000), L(1, '2025-09-02', 'Ostrom Structural', 24601.2, { invoice: '4417' }), L(2, '2025-09-20', 'Ostrom Structural', 24601.2, { invoice: '0004417' })]).flatMap(flaggedRows), ['TX-2'])
})

// ── Published public-sector files ────────────────────────────────────────────

test('same day and amount with no invoice number is a question, not a Critical', () => {
  const f = dupes([...history('Peep Learning', 9000), L(1, '2025-06-18', 'Peep Learning', 12340.5, { description: '' }), L(2, '2025-06-18', 'Peep Learning', 12340.5, { description: '' })])
  assert.equal(f.length, 1)
  assert.notEqual(f[0].severity, 'CRITICAL')
})

test('many repeats from one vendor with no invoice numbers are one pattern, every row kept', () => {
  // Two same-day repeats and two a few days apart: too few of either to read as a habit.
  const pair = (k: number, d1: string, d2: string) => [L(k * 10, d1, 'Foster Care Co', 3000 + k * 211.3, { description: '' }), L(k * 10 + 1, d2, 'Foster Care Co', 3000 + k * 211.3, { description: '' })]
  const pairs = [...pair(1, '2025-02-15', '2025-02-15'), ...pair(2, '2025-04-15', '2025-04-15'), ...pair(3, '2025-06-05', '2025-06-11'), ...pair(4, '2025-08-05', '2025-08-12')]
  const f = dupes([...history('Foster Care Co', 900), ...pairs])
  assert.equal(f.length, 1)
  assert.equal(flaggedRows(f[0]).length, 4)
  assert.ok(f[0].confidence < 70, 'kept out of exposure until confirmed')
})

test('a posting reversed within the month is not raised as an unusual amount', () => {
  const big = L(1, '2025-12-31', 'Cleardata', 34537601, { description: 'Office' })
  const undo = L(2, '2025-12-31', 'Cleardata', 34531724.13, { description: 'Office', direction: 'credit' })
  const count = (txs: StoredTransaction[]) => runAnomalyDetection(txs).filter(x => x.type === 'outlier').length
  assert.equal(count([...history('Cleardata', 900), big]), 1)
  assert.equal(count([...history('Cleardata', 900), big, undo]), 0)
})

test('an unusual amount alone is never Critical', () => {
  const f = runAnomalyDetection([...history('Access UK', 2300), L(1, '2025-07-15', 'Access UK', 36000.4)]).filter(x => x.type === 'outlier')
  assert.equal(f.length, 1)
  assert.notEqual(f[0].severity, 'CRITICAL')
})

test('a stray early row does not make every vendor new', () => {
  const stray = L(1, '2023-12-28', 'Old Ledger Item', 500)
  const month = Array.from({ length: 600 }, (_, i) => L(10 + i, `2024-04-${String(1 + (i % 28)).padStart(2, '0')}`, `Vendor ${i % 40}`, 300 + i * 3.1))
  const burst = [1, 2, 3, 4].map(k => L(900 + k, `2024-04-0${k}`, 'Yunex Limited', 9000 + k * 13.7))
  assert.equal(runAnomalyDetection([stray, ...month, ...burst]).filter(x => /first week/.test(x.title)).length, 0)
})

test('a stack of lines on one or two days is a payment run, not a burst', () => {
  const base = Array.from({ length: 14 }, (_, i) => L(i, `2025-${String(1 + (i % 12)).padStart(2, '0')}-1${i % 8}`, 'Liquidlogic', 1000 + i * 37.1))
  const run = Array.from({ length: 12 }, (_, i) => L(50 + i, '2025-06-03', 'Liquidlogic', 900 + i * 13.3))
  assert.equal(runAnomalyDetection([...base, ...run]).filter(x => x.type === 'high_frequency').length, 0)
})

test('a redacted payee is neither a vendor nor a missing payee', () => {
  assert.equal(isRedactedPayee('REDACTED - Personal Information'), true)
  const f = runAnomalyDetection([0, 1, 2, 3].map(k => L(k, '2025-07-15', 'REDACTED - Personal Information', 233)))
  assert.equal(f.length, 0)
})

test('a vendor repeatedly just under a limit is one standing pattern', () => {
  const clusters = [1, 3, 5, 7].flatMap(m => [0, 1, 2].map(k => L(m * 10 + k, `2025-0${m}-0${2 + k}`, 'Ashcroft Services', 9700 + k * 41.3 + m)))
  const f = runAnomalyDetection([...history('Ashcroft Services', 4000), ...clusters]).filter(x => x.type === 'approval_avoidance')
  assert.equal(f.length, 1)
  assert.match(f[0].title, /Repeatedly/)
  assert.equal(f[0].rowRefs.length, 12)
})

test('findings are written in the workspace currency', () => {
  const f = runAnomalyDetection([...history('Access UK', 2300), L(1, '2025-07-15', 'Access UK', 36000.4)], { currency: 'GBP' }).filter(x => x.type === 'outlier')
  assert.match(f[0].description, /^£36\.0K/)
  const usd = runAnomalyDetection([...history('Access UK', 2300), L(1, '2025-07-15', 'Access UK', 36000.4)]).filter(x => x.type === 'outlier')
  assert.match(usd[0].description, /^\$36\.0K/)
})
