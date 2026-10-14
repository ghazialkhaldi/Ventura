import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseAmount, parseDate, inferDateOrder, excelSerialToISO, rowsToTransactions, type RawRow } from '../../src/lib/transactionParser'
import type { ColumnMapping } from '../../src/lib/dataStore'

const map = (m: Partial<ColumnMapping>): ColumnMapping => ({ date: null, vendor: null, amount: null, debit: null, credit: null, description: null, category: null, account: null, period: null, ...m })

// ── Amounts ──────────────────────────────────────────────────────────────────

test('amounts in US, European and accounting formats', () => {
  assert.equal(parseAmount('$1,234.56'), 1234.56)
  assert.equal(parseAmount('1.234,56'), 1234.56)
  assert.equal(parseAmount('1 234,56 €'), 1234.56)
  assert.equal(parseAmount('12,5'), 12.5)
  assert.equal(parseAmount('1,234'), 1234)
  assert.equal(parseAmount('1,234,567'), 1234567)
  assert.equal(parseAmount('(1,000.00)'), -1000)
  assert.equal(parseAmount('1,000.00-'), -1000)
  assert.equal(parseAmount('−250.00'), -250)
  assert.equal(parseAmount('1,234.00 CR'), -1234)
  assert.equal(parseAmount('1234CR'), -1234)
  assert.equal(parseAmount('1,234.00 DR'), 1234)
  assert.equal(parseAmount('USD 980.10'), 980.1)
  assert.equal(parseAmount('n/a'), 0)
  assert.equal(parseAmount(''), 0)
})

// ── Dates ────────────────────────────────────────────────────────────────────

test('dates parse from their parts, whatever the time zone', () => {
  assert.equal(parseDate('2026-09-04'), '2026-09-04')
  assert.equal(parseDate('2026-09-04T00:00:00Z'), '2026-09-04')
  assert.equal(parseDate('Jan 4, 2026'), '2026-01-04')
  assert.equal(parseDate('4 January 2026'), '2026-01-04')
  assert.equal(parseDate('04-Jan-26'), '2026-01-04')
  assert.equal(parseDate('September 1st, 2026'), '2026-09-01')
  assert.equal(parseDate('09/04/2026'), '2026-09-04')
  assert.equal(parseDate('09/04/2026', 'dmy'), '2026-04-09')
  assert.equal(parseDate('25/04/2026'), '2026-04-25')        // only fits day-first
  assert.equal(parseDate('2026-02-30'), '')                  // no such day
  assert.equal(parseDate('Stripe'), '')
  assert.equal(parseDate('100234'), '')
})

test('a column is read day-first when its values say so', () => {
  assert.equal(inferDateOrder(['03/04/2026', '25/04/2026', '30/05/2026']), 'dmy')
  assert.equal(inferDateOrder(['03/04/2026', '04/25/2026']), 'mdy')
})

test('Excel serials convert without a time zone', () => {
  assert.equal(excelSerialToISO(46266), '2026-09-01')
  assert.equal(excelSerialToISO(46266.75), '2026-09-01')
  assert.equal(excelSerialToISO(46023), '2026-01-01')
})

// ── Rows to transactions ─────────────────────────────────────────────────────

test('a signed AP column: positives are spend, the rare negative is a credit note', () => {
  const rows: RawRow[] = Array.from({ length: 20 }, (_, i) => ({ Date: `2026-03-${String(i + 1).padStart(2, '0')}`, Vendor: `V${i}`, Amount: `${100 + i}.00` }))
  rows.push({ Date: '2026-03-25', Vendor: 'V3', Amount: '-103.00' })
  const t = rowsToTransactions(rows, map({ date: 'Date', vendor: 'Vendor', amount: 'Amount' }))
  assert.equal(t.filter(x => x.direction === 'credit').length, 1)
  assert.equal(t[t.length - 1].direction, 'credit')
  assert.ok(t.every(x => x.amount > 0))
})

test('a bank feed with more deposits than payments still reads negatives as spend', () => {
  const rows: RawRow[] = [
    ...Array.from({ length: 6 }, (_, i) => ({ Date: `2026-03-0${i + 1}`, Payee: 'Shopify Payments', Amount: '12,000.00' })),
    ...Array.from({ length: 4 }, (_, i) => ({ Date: `2026-03-0${i + 1}`, Payee: 'Meta Ads', Amount: '-2,400.00' })),
  ]
  const t = rowsToTransactions(rows, map({ date: 'Date', vendor: 'Payee', amount: 'Amount' }))
  assert.deepEqual(t.filter(x => x.direction === 'debit').map(x => x.vendor), ['Meta Ads', 'Meta Ads', 'Meta Ads', 'Meta Ads'])
})

test('a bank export: money out is negative, so negatives are spend', () => {
  const rows: RawRow[] = [
    { Date: '2026-03-01', Payee: 'Staples', Amount: '-1,240.00' },
    { Date: '2026-03-02', Payee: 'Delta', Amount: '-880.00' },
    { Date: '2026-03-03', Payee: 'Customer deposit', Amount: '5,000.00' },
  ]
  const t = rowsToTransactions(rows, map({ date: 'Date', vendor: 'Payee', amount: 'Amount' }))
  assert.deepEqual(t.map(x => x.direction), ['debit', 'debit', 'credit'])
})

test('debit and credit columns, with a negative debit read as a reversal', () => {
  const rows: RawRow[] = [
    { Date: '2026-03-01', Vendor: 'A', Debit: '100.00', Credit: '' },
    { Date: '2026-03-02', Vendor: 'B', Debit: '', Credit: '40.00' },
    { Date: '2026-03-03', Vendor: 'C', Debit: '-25.00', Credit: '' },
  ]
  const t = rowsToTransactions(rows, map({ date: 'Date', vendor: 'Vendor', debit: 'Debit', credit: 'Credit' }))
  assert.deepEqual(t.map(x => x.direction), ['debit', 'credit', 'credit'])
})

test('total and subtotal lines are never counted as spend', () => {
  const rows: RawRow[] = [
    { Date: '2026-03-01', Vendor: 'Staples', Amount: '100.00' },
    { Date: '', Vendor: 'Total for Staples', Amount: '100.00' },
    { Date: 'Total', Vendor: '', Amount: '100.00' },
    { Date: '', Vendor: 'Grand Total', Amount: '100.00' },
  ]
  const t = rowsToTransactions(rows, map({ date: 'Date', vendor: 'Vendor', amount: 'Amount' }))
  assert.equal(t.length, 1)
})

test('a dated payment with no payee is kept so it can be reported; an undated blank line is not', () => {
  const rows: RawRow[] = [
    { Date: '2026-03-01', Vendor: '', Amount: '4,200.00' },
    { Date: '', Vendor: '', Amount: '4,200.00' },
  ]
  const t = rowsToTransactions(rows, map({ date: 'Date', vendor: 'Vendor', amount: 'Amount' }))
  assert.equal(t.length, 1)
  assert.equal(t[0].vendor, '')
})

test('an unreadable date stays empty instead of becoming today', () => {
  const t = rowsToTransactions([{ Date: 'TBD', Vendor: 'X', Amount: '10' }], map({ date: 'Date', vendor: 'Vendor', amount: 'Amount' }))
  assert.equal(t[0].date, '')
})
