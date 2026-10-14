import { test } from 'node:test'
import assert from 'node:assert/strict'
import { summarizeTransactions, combineFiles, monthLabel } from '../../src/lib/datasetStats'
import type { StoredTransaction } from '../../src/lib/dataStore'

let n = 0
const tx = (date: string, vendor: string, amount: number, extra: Partial<StoredTransaction> = {}): StoredTransaction =>
  ({ id: `T${n++}`, date, vendor, amount, description: vendor, category: 'General', account: '', rowIndex: n, direction: 'debit', ...extra })

test('spend on the 1st is counted in its own month, in every time zone', () => {
  const s = summarizeTransactions([tx('2026-09-01', 'Rent', 12000), tx('2026-08-31', 'Power', 100)])
  assert.deepEqual(s.monthlyBreakdown.map(m => [m.key, m.month, m.spend]), [['2026-08', 'Aug 2026', 100], ['2026-09', 'Sep 2026', 12000]])
  assert.equal(monthLabel('2026-01'), 'Jan 2026')
})

test('credits are reported apart and never counted as spend', () => {
  const s = summarizeTransactions([tx('2026-09-01', 'A', 100), tx('2026-09-02', 'A', 40, { direction: 'credit' })])
  assert.equal(s.totalSpend, 100)
  assert.equal(s.totalCredits, 40)
  assert.equal(s.creditCount, 1)
})

test('vendors are grouped by identity and shown under their usual spelling', () => {
  const s = summarizeTransactions([tx('2026-09-01', 'Summit Print Co.', 100), tx('2026-09-02', 'Summit Print Co.', 100), tx('2026-09-03', 'SUMMIT PRINT COMPANY', 100), tx('2026-09-04', '', 50)])
  assert.equal(s.uniqueVendors, 1)
  assert.equal(s.topVendors[0].vendor, 'Summit Print Co.')
  assert.equal(s.topVendors[0].count, 3)
  assert.ok(s.topVendors.some(v => v.vendor === '(No payee)'))
})

test('overlapping exports count a payment once; repeats inside one file are kept', () => {
  const jul = [tx('2026-07-30', 'A', 100), tx('2026-07-31', 'B', 200), tx('2026-07-31', 'B', 200)]
  const aug = [tx('2026-07-31', 'B', 200), tx('2026-07-31', 'B', 200), tx('2026-08-02', 'C', 300)]
  const { transactions, overlap } = combineFiles([jul, aug])
  assert.equal(overlap, 2)
  assert.equal(transactions.length, 4)
  assert.equal(transactions.filter(t => t.vendor === 'B').length, 2)
  assert.equal(new Set(transactions.map(t => t.id)).size, transactions.length)
})
