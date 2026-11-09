import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runAnomalyDetection, computeRiskExposure, vendorKey, parsePeriodLabel, flaggedRows } from '../../src/lib/anomalyEngine'
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
