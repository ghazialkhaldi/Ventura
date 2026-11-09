import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { parseAmount, parseDate, inferDateOrder, excelSerialToISO, rowsToTransactions, parseFile, detectColumns, detectCurrency, type RawRow } from '../../src/lib/transactionParser'
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

// ── Real close packages ──────────────────────────────────────────────────────

function workbook(sheets: Record<string, unknown[][]>): File {
  const wb = XLSX.utils.book_new()
  for (const [name, aoa] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name)
  return new File([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], 'close.xlsx')
}

const LEDGER = [
  ['Company', 'General Ledger Detail'],
  ['Line ID', 'Posting Date', 'Fiscal Period', 'Account Name', 'Cost Center', 'Vendor No.', 'Vendor Name', 'Description', 'Txn Amount (Local)', 'Debit (USD)', 'Credit (USD)'],
  ['L1', '2026-01-05', 'FY26-P07', 'Marine Components', 110, 'V-1', 'Ballard Propulsion', 'Parts', '10.000,00', 11000, ''],
  ['L2', '06.01.2026', 'FY26-P07', 'Freight In', 210, 'V-2', 'Puget Freight', 'Haul', '2.000,00', 2200, ''],
  ['L3', '07.01.2026', 'FY26-P07', 'Freight In', 210, 'V-2', 'Puget Freight', 'Credit', '-100,00', '', 110],
  ['Total', '', '', '', '', '', '', '', '', 13200, 110],
]

test('a trial balance line is data, not a header, and the ledger tab wins', async () => {
  const r = await parseFile(workbook({
    'Trial Balance': [['Acct', 'Account', 'Total'], [4900, 'Intercompany fee income', -6478733.9], [5010, 'Raw Materials', 10419164.7]],
    'AP Aging': [['Vendor Name', 'Current', 'Total Due'], ...Array.from({ length: 30 }, (_, i) => [`Vendor ${i}`, 100, 100])],
    'GL Detail': LEDGER,
  }))
  assert.ok(!('error' in r), JSON.stringify(r))
  if ('error' in r) return
  assert.equal(r.transactions.length, 3)
  assert.equal(r.transactions[0].vendor, 'Ballard Propulsion')
})

test('the vendor is its name, and a number is used only when there is no name', () => {
  assert.equal(detectColumns(['Vendor No.', 'Vendor Name', 'Amount']).vendor, 'Vendor Name')
  assert.equal(detectColumns(['Supplier ID', 'Supplier', 'Amount']).vendor, 'Supplier')
  assert.equal(detectColumns(['Vendor No.', 'Amount']).vendor, 'Vendor No.')
})

test('debit and credit in the reporting currency beat a mixed-currency amount', async () => {
  const r = await parseFile(workbook({ 'GL Detail': LEDGER }))
  if ('error' in r) return assert.fail(r.error)
  assert.equal(r.mapping.amount, null)
  assert.deepEqual(r.transactions.map(t => [t.amount, t.direction]), [[11000, 'debit'], [2200, 'debit'], [110, 'credit']])
})

test('column headings repeated through a paginated report are not data', async () => {
  const [title, head, ...data] = LEDGER
  const r = await parseFile(workbook({ 'GL Detail': [title, head, data[0], ['Entity 400'], head, data[1], head, data[2], head, data[3]] }))
  if ('error' in r) return assert.fail(r.error)
  assert.equal(r.rowCount, 5)
  assert.equal(r.mapping.amount, null, 'a sparse credit column broken up by headings is still money')
  assert.equal(r.transactions.length, 3)
})

test('invoice, source, entity and local amount come through from a GL export', async () => {
  const r = await parseFile(workbook({ 'GL Detail': [['Posting Date', 'Source', 'Entity', 'Vendor No.', 'Vendor Name', 'Invoice No.', 'Invoice Date', 'Txn Amount (Local)', 'Debit (USD)', 'Credit (USD)'], ['2026-01-05', 'AP', 400, 'V-1', 'Hanse', 'H-1001', '2026-01-02', '19.480,30', 22800, ''], ['2026-01-06', 'GL', 100, '', '', '', '', 500, 500, '']] }))
  if ('error' in r) return assert.fail(r.error)
  assert.equal(r.mapping.invoice, 'Invoice No.')
  assert.deepEqual([r.transactions[0].invoice, r.transactions[0].source, r.transactions[0].entity, r.transactions[0].localAmount], ['H-1001', 'ap', '400', 19480.3])
  assert.equal(r.transactions[1].source, 'journal')
})

test('a NetSuite Type column is the source, and the account becomes the category', async () => {
  const r = await parseFile(workbook({ S: [['Date', 'Type', 'Document Number', 'Name', 'Memo', 'Account', 'Department', 'Amount'], ['2026-01-05', 'Bill', 'D-1', 'Acme', 'Parts', '6100 Medical Supplies', 'Surgery', 900], ['2026-01-06', 'Journal', 'J-1', '', 'Depreciation', '7100 Depreciation', 'Admin', 450]] }))
  if ('error' in r) return assert.fail(r.error)
  assert.equal(r.mapping.source, 'Type')
  assert.equal(r.mapping.category, 'Account')
  assert.equal(r.mapping.account, 'Department')
  assert.deepEqual([r.transactions[0].source, r.transactions[0].category], ['ap', '6100 Medical Supplies'])
})

test('a Type column of spending categories is still the category', async () => {
  const r = await parseFile(workbook({ S: [['Date', 'Type', 'Name', 'Account', 'Amount'], ['2026-01-05', 'Software', 'Acme', 'Main', 900], ['2026-01-06', 'Rent', 'Bolt', 'Main', 450]] }))
  if ('error' in r) return assert.fail(r.error)
  assert.equal(r.mapping.category, 'Type')
  assert.equal(r.mapping.source ?? null, null)
})

test('a QuickBooks detail report: section rows become the account, Num the invoice', async () => {
  const r = await parseFile(workbook({ S: [
    ['Larkfield Architects'], ['Transaction Detail by Account'], [],
    ['', 'Date', 'Transaction Type', 'Num', 'Name', 'Memo/Description', 'Split', 'Amount', 'Balance'],
    ['Legal'],
    ['', '2025-09-08', 'Bill', '1042', 'Harlow Brandt', 'Filing', 'A/P', '1,200.00', '1,200.00'],
    ['', '2025-09-30', 'Journal Entry', 'JE1', '', 'Monthly depreciation', 'A/P', '300.00', '1,500.00'],
    ['Total for Legal', '', '', '', '', '', '', '$1,500.00', ''],
    ['Rent'],
    ['', '2025-10-01', 'Bill', '77', 'Marlowe', 'Office rent', 'A/P', '4,000.00', '4,000.00'],
    ['TOTAL', '', '', '', '', '', '', '$5,500.00', ''],
  ] }))
  if ('error' in r) return assert.fail(r.error)
  assert.equal(r.transactions.length, 3)
  assert.deepEqual(r.transactions.map(t => [t.category, t.invoice, t.source]), [['Legal', '1042', 'ap'], ['Legal', 'JE1', 'journal'], ['Rent', '77', 'ap']])
  assert.equal(r.transactions[0].amount, 1200, 'the running balance is never the amount')
})

test('a check number is not an invoice number', async () => {
  const r = await parseFile(workbook({ S: [['Date', 'Transaction Type', 'Num', 'Name', 'Amount'], ['2025-09-08', 'Bill', '1042', 'Acme', 900], ['2025-09-10', 'Check', '5521', 'Acme', 900]] }))
  if ('error' in r) return assert.fail(r.error)
  assert.deepEqual(r.transactions.map(t => t.invoice), ['1042', undefined])
})

test('an amount column stays when "debit" and "credit" are not money', async () => {
  const r = await parseFile(workbook({ S: [['Date', 'Vendor', 'Amount', 'Debit Account', 'Credit Account'], ['2026-01-05', 'Acme', 900, 6010, 2000], ['2026-01-06', 'Bolt', 450, 6010, 2000]] }))
  if ('error' in r) return assert.fail(r.error)
  assert.equal(r.mapping.amount, 'Amount')
  assert.equal(r.transactions[0].amount, 900)
})

test('the account name is the category when the alternative is a cost center', async () => {
  const r = await parseFile(workbook({ 'GL Detail': LEDGER }))
  if ('error' in r) return assert.fail(r.error)
  assert.equal(r.mapping.category, 'Account Name')
  assert.equal(r.transactions[1].category, 'Freight In')
})

test('dotted dates are day-first even in a column of month-first dates', () => {
  assert.equal(parseDate('01.07.2025', 'mdy'), '2025-07-01')
  assert.equal(parseDate('12.03.2026', 'mdy'), '2026-03-12')
  assert.equal(parseDate('01/07/2025', 'mdy'), '2025-01-07')
})

// ── Published public-sector files ────────────────────────────────────────────

test('corrections that are many lines but little money do not make a ledger a bank statement', () => {
  const rows: RawRow[] = [
    ...Array.from({ length: 88 }, (_, i) => ({ Date: '2026-02-10', Vendor: `V${i}`, Amount: '6,000.00' })),
    ...Array.from({ length: 12 }, (_, i) => ({ Date: '2026-02-11', Vendor: `V${i}`, Amount: '-3,000.00' })),
  ]
  const t = rowsToTransactions(rows, map({ date: 'Date', vendor: 'Vendor', amount: 'Amount' }))
  assert.equal(t.filter(x => x.direction === 'credit').length, 12)
})

test('money flowing both ways in real amounts is still a bank statement', () => {
  const rows: RawRow[] = [
    ...Array.from({ length: 85 }, (_, i) => ({ Date: '2026-02-10', Payee: 'Till deposit', Amount: '100.00' })),
    ...Array.from({ length: 15 }, (_, i) => ({ Date: '2026-02-11', Payee: `Supplier ${i}`, Amount: '-300.00' })),
  ]
  const t = rowsToTransactions(rows, map({ date: 'Date', vendor: 'Payee', amount: 'Amount' }))
  assert.equal(t.filter(x => x.direction === 'debit').length, 15)
})

test('an open-data export: the money column is found and identifiers are not', async () => {
  const r = await parseFile(workbook({ S: [
    ['fiscal_year', 'vendor', 'purchase_order', 'voucher', 'vouchers_paid', 'vouchers_pending', 'contract_number', 'department', 'data_as_of'],
    ['2025', 'Acme', '000087004201', '0330508501', '3200.54', '0', '1000008932', 'Health', '2025-02-10'],
    ['2025', 'Bolt', '000087004401', '0329082301', '19229.67', '0', '1000008933', 'Health', '2025-02-03'],
  ] }))
  if ('error' in r) return assert.fail(r.error)
  assert.equal(r.mapping.amount, 'vouchers_paid')
  assert.equal(r.transactions[1].amount, 19229.67)
  assert.equal(r.mapping.invoice, 'voucher')
})

test('a UK ledger: the service area is the unit, and a short list of descriptions is the category', async () => {
  const uk = await parseFile(workbook({ S: [['Service Area', 'Expenditure Category', 'Supplier Name', 'Pay Date', 'Amount'], ['Parks', 'Grounds', 'Acme', '2026-01-05', 900]] }))
  if ('error' in uk) return assert.fail(uk.error)
  assert.equal(uk.mapping.account, 'Service Area')
  const kinds = ['Care', 'Fuel', 'Rent', 'Legal', 'Pensions', 'Travel']
  const rows = Array.from({ length: 300 }, (_, i) => ['2026-01-05', `V${i}`, 100 + i, kinds[i % 6]])
  const b = await parseFile(workbook({ S: [['Pay Date', 'Name', 'amount', 'Description 1'], ...rows] }))
  if ('error' in b) return assert.fail(b.error)
  assert.equal(b.mapping.category, 'Description 1')
})

test('currency comes from what the file states, and silence stays silent', () => {
  const m = (amount: string) => map({ amount })
  assert.equal(detectCurrency([{ 'Amount (GBP)': '10' }], ['Amount (GBP)'], m('Amount (GBP)')), 'GBP')
  assert.equal(detectCurrency([{ Amount: '£1,200.00' }, { Amount: '£5.00' }], ['Amount'], m('Amount')), 'GBP')
  assert.equal(detectCurrency([{ Amount: '10', Curr: 'EUR' }], ['Amount', 'Curr'], m('Amount')), 'EUR')
  assert.equal(detectCurrency([{ Amount: '10', Curr: 'EUR' }, { Amount: '10', Curr: 'USD' }], ['Amount', 'Curr'], m('Amount')), undefined)
  assert.equal(detectCurrency([{ Amount: '$10.00' }], ['Amount'], m('Amount')), undefined)
})
