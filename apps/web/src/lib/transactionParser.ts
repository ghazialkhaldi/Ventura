import type { StoredTransaction, ColumnMapping, EntrySource } from './dataStore'

// ─── Column synonym tables ────────────────────────────────────────────────────

const DATE_SYN        = ['date','transaction date','trans date','txn date','posting date','invoice date','created','created at','post date','value date','settlement date','book date','entry date']
const VENDOR_SYN      = ['vendor','payee','merchant','supplier','name','company','counterpart','recipient','payor','payer','to','paid to','issued to','remit to']
const AMOUNT_SYN      = ['amount','value','total','net amount','transaction amount','sum','net','payment amount','original amount','gross amount','invoice amount','price']
const DEBIT_SYN       = ['debit','debit amount','withdrawal','outflow','expense','charge','dr','dr amount']
const CREDIT_SYN      = ['credit','credit amount','deposit','inflow','income','payment received','cr','cr amount','refund']
const DESCRIPTION_SYN = ['description','memo','notes','details','reference','narrative','particulars','remark','line description','note','memo line']
const CATEGORY_SYN    = ['category','type','account type','expense type','expenditure category','classification','class','cost center','cost centre','department','budget code','gl category','subcategory','sub-category']
const PERIOD_SYN      = ['period','fiscal period','posting period','accounting period','gl period','period name','fiscal month','acct period']
const INVOICE_SYN     = ['invoice no','invoice number','invoice #','invoice','inv no','inv number','invoice id','vendor invoice','bill no','bill number','document number','doc no','voucher','voucher no','voucher number']
const SOURCE_SYN      = ['source','source code','journal source','source type','transaction type','txn type','document type','doc type','journal type','entry type','module']
const ENTITY_SYN      = ['entity','legal entity','entity code','company code','company','subsidiary','business unit','operating unit','branch']
const UNIT_SYN        = ['cost center','cost centre','service area','department','dept','location','class','store','site','property','division','directorate']
const ACCOUNT_SYN     = ['account','account name','account number','gl account','ledger account','account code','cost account','chart of accounts','gl code','account id']

// ─── Column detection ─────────────────────────────────────────────────────────

/** Split a header into lowercase word tokens: "Net Amount (USD)" -> [net, amount, usd] */
function tokenize(header: string): string[] {
  return header.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
}

/**
 * Match a column by synonym, from strictest to loosest.
 *
 * Naive substring matching is actively dangerous with short synonyms and was
 * the cause of vendors showing up as numbers: "to" (a vendor synonym) matches
 * "Total", so vendor bound to a numeric column. "cr" matches "Description",
 * "dr" matches "Address". Short synonyms are therefore only ever honoured as
 * whole words, and loose substring matching is reserved for synonyms long
 * enough to be unambiguous.
 */
function matchCol(headers: string[], synonyms: string[]): string | null {
  const norm = headers.map(h => h.toLowerCase().trim())
  const toks = headers.map(tokenize)

  // 1. Exact header match.
  for (const syn of synonyms) {
    const i = norm.indexOf(syn)
    if (i >= 0) return headers[i]
  }

  // 2. Whole-word match. A single-word synonym must equal one of the header's
  //    tokens; a multi-word synonym must appear as a consecutive run of them.
  for (const syn of synonyms) {
    const synToks = tokenize(syn)
    if (synToks.length === 0) continue
    const i = toks.findIndex(t => {
      if (synToks.length === 1) return t.includes(synToks[0])
      for (let s = 0; s + synToks.length <= t.length; s++) {
        if (synToks.every((st, k) => t[s + k] === st)) return true
      }
      return false
    })
    if (i >= 0) return headers[i]
  }

  // 3. Loose substring, only for synonyms long enough to be safe.
  for (const syn of synonyms) {
    if (syn.length < 5) continue
    const i = norm.findIndex(h => h.includes(syn))
    if (i >= 0) return headers[i]
  }

  return null
}

/** A header naming an identifier: "Vendor No.", "Supplier ID", "Payee #". */
const ID_HEADER = /(^|[\s_.-])(no|nbr|num|number|id|code|ref|acct)($|[\s_.-])|#/i

export function detectColumns(headers: string[]): ColumnMapping {
  return {
    date:        matchCol(headers, DATE_SYN),
    // ERP exports list the vendor's number before its name. Take the name, and
    // settle for the number only when the file has nothing else.
    vendor:      matchCol(headers.filter(h => !ID_HEADER.test(h)), VENDOR_SYN) ?? matchCol(headers, VENDOR_SYN),
    amount:      matchCol(headers, AMOUNT_SYN),
    debit:       matchCol(headers, DEBIT_SYN),
    credit:      matchCol(headers, CREDIT_SYN),
    description: matchCol(headers, DESCRIPTION_SYN),
    category:    matchCol(headers, CATEGORY_SYN),
    account:     matchCol(headers, ACCOUNT_SYN),
    period:      matchCol(headers, PERIOD_SYN),
    // "Invoice Date" and "Invoice Amount" are not the invoice number.
    // QuickBooks calls it just "Num".
    invoice:     matchCol(headers.filter(h => !/date|amount|amt|total|due|status|type/i.test(h)), INVOICE_SYN) ?? (headers.find(h => /^num\.?$/i.test(h.trim())) ?? null),
    source:      matchCol(headers, SOURCE_SYN),
    entity:      otherThan(matchCol(headers, ENTITY_SYN), matchCol(headers.filter(h => !ID_HEADER.test(h)), VENDOR_SYN)),
  }
}

/** A column already used as something else cannot also be this one. */
const otherThan = (col: string | null, taken: string | null) => (col === taken ? null : col)

/** The kind of entry, from whatever an ERP calls it. Unrecognised values say nothing. */
export function classifySource(raw: string): EntrySource | undefined {
  const s = raw.toLowerCase()
  if (!s) return undefined
  if (/\b(pr|payroll|paycheck|paye?)\b/.test(s)) return 'payroll'
  if (/\b(cc|card|cards|amex|pcard|p-card|expense report|expenses?|t&e)\b/.test(s)) return 'card'
  if (/\b(gl|gj|je|jnl|journal|manual|adj|adjustment|accrual)\b/.test(s)) return 'journal'
  if (/\b(ap|a\/p|payables?|bill|bills|invoice|vendor|purchase)\b/.test(s)) return 'ap'
  return undefined
}

// ─── Value parsers ────────────────────────────────────────────────────────────

/**
 * A signed amount from an export cell.
 *
 * Handles currency symbols, thousands separators, "(1,000)" and "1,000-" for
 * negatives, a Unicode minus, "CR"/"DR" markers, and European formats such as
 * "1.234,56" or "1 234,56", where the comma is the decimal point. Reading
 * those as US figures turns 1.234,56 into 1.23456.
 */
export function parseAmount(raw: string): number {
  if (!raw || !raw.trim()) return 0
  let s = raw.trim().replace(/[\u2212\u2013]/g, '-')
  let negative = false
  const cr = /(?<=[\d\s).]|^)(cr|credit)\.?$/i.test(s)
  s = s.replace(/\s*(?<=[\d\s).]|^)(cr|dr|credit|debit)\.?$/i, '').trim()
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1) }
  if (/-\s*$/.test(s)) { negative = true; s = s.replace(/-\s*$/, '') }
  s = s.replace(/['"$£€¥₹\s]|[A-Z]{3}$|^[A-Z]{3}/g, '')
  if (s.startsWith('-')) { negative = !negative; s = s.slice(1) }
  if (s.startsWith('+')) s = s.slice(1)
  // Decimal comma: "1.234,56", "1234,56", "12,5" (but not "1,234" or "1,234,567").
  if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(s) || /^\d+,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.')
  else s = s.replace(/,/g, '')
  if (!/^\d*\.?\d+$/.test(s)) return 0
  const v = parseFloat(s)
  if (!Number.isFinite(v)) return 0
  return (negative || cr) ? -v : v
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 }

function isoParts(y: number, m: number, d: number): string {
  if (y < 100) y += 2000
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return ''
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Day-first or month-first, decided once per column from values that only fit one reading. */
export type DateOrder = 'dmy' | 'mdy'

export function inferDateOrder(values: string[]): DateOrder {
  let dmy = 0, mdy = 0
  for (const v of values) {
    const m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/.exec(v.trim())
    if (!m) continue
    if (Number(m[1]) > 12) dmy++
    else if (Number(m[2]) > 12) mdy++
  }
  return dmy > mdy ? 'dmy' : 'mdy'
}

/**
 * A YYYY-MM-DD date, or '' when the value is not a date.
 *
 * Parsed from its parts, never through the Date constructor's local-time
 * rules: "Jan 4, 2026" read as local midnight and printed as UTC is 3 January
 * anywhere east of Greenwich.
 */
export function parseDate(raw: string, order: DateOrder = 'mdy'): string {
  const s = (raw || '').trim()
  if (!s) return ''
  let m = /^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?:$|[T\s])/.exec(s)
  if (m) return isoParts(+m[1], +m[2], +m[3])
  m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})(?:$|[T\s])/.exec(s)
  if (m) {
    const [a, b] = [+m[1], +m[2]]
    // A value that only fits one reading wins over the column's habit. Dots
    // mean day-first (01.07.2025 is 1 July) whatever the rest of the column
    // does: consolidated exports mix regional formats in a single column.
    const dayFirst = a > 12 ? true : b > 12 ? false : s.includes('.') || order === 'dmy'
    return dayFirst ? isoParts(+m[3], b, a) : isoParts(+m[3], a, b)
  }
  // "4 Jan 2026", "04-Jan-26", "4 January, 2026"
  m = /^(\d{1,2})[\s\-/.]+([a-z]{3,9})\.?,?[\s\-/.]+(\d{2}|\d{4})$/i.exec(s)
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()]) return isoParts(+m[3], MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1])
  // "Jan 4, 2026", "January 4 2026"
  m = /^([a-z]{3,9})\.?[\s\-/.]+(\d{1,2})(?:st|nd|rd|th)?,?[\s\-/.]+(\d{2}|\d{4})$/i.exec(s)
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()]) return isoParts(+m[3], MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2])
  return ''
}

/** An Excel date serial as YYYY-MM-DD, by arithmetic alone so no time zone can move it. */
export function excelSerialToISO(serial: number): string {
  if (!Number.isFinite(serial) || serial < 1) return ''
  return new Date(Math.round((serial - 25569) * 86_400_000)).toISOString().slice(0, 10)
}

/** Subtotal and total lines that report exports put between and after the transactions. */
function isTotalRow(...cells: string[]): boolean {
  return cells.some(c => /^\s*(grand\s+|sub-?)?totals?\b/i.test(c || ''))
}

// ─── Row → Transaction ────────────────────────────────────────────────────────

export interface RawRow {
  [key: string]: string
}

export function rowsToTransactions(
  rows: RawRow[],
  mapping: ColumnMapping,
): StoredTransaction[] {
  const txs: StoredTransaction[] = []
  const order = mapping.date ? inferDateOrder(rows.slice(0, 500).map(r => r[mapping.date!] ?? '')) : 'mdy'

  // A single signed Amount column follows one of two conventions. AP, GL and
  // card exports show spend as positive and the odd credit note or refund as
  // negative; bank exports show money out as negative and deposits as
  // positive. Credit notes are rare, so a column where negatives are rare is
  // the first kind. Where both signs are common it is a bank statement, and
  // negative is spend even when deposits outnumber payments (an online shop
  // paid out daily). The other sign is a credit, never counted as spend or fed
  // to the checks.
  let spendSign = 1
  if (mapping.amount) {
    let neg = 0, pos = 0, negValue = 0, posValue = 0
    for (const r of rows) {
      const v = parseAmount(r[mapping.amount] ?? '')
      if (v < 0) { neg++; negValue -= v } else if (v > 0) { pos++; posValue += v }
    }
    // Counting lines is not enough: a council's month of payments can be 12%
    // negative lines (corrections, recharges) and still only 7% of the value. A
    // bank statement has real money flowing both ways.
    const negShare = neg / Math.max(1, neg + pos)
    if (negShare >= 0.2 || (negShare >= 0.1 && negValue / Math.max(1, posValue) >= 0.25)) spendSign = -1
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const cell = (col: string | null | undefined) => (col ? (row[col] ?? '') : '').trim()

    let amount = 0
    let direction: 'debit' | 'credit' = 'debit'
    if (mapping.amount && cell(mapping.amount)) {
      const v = parseAmount(cell(mapping.amount))
      amount = Math.abs(v)
      direction = Math.sign(v) === spendSign ? 'debit' : 'credit'
    } else {
      // Separate Debit/Credit columns: debit is money out, credit is money back.
      // A negative debit is a reversal, so it is a credit too.
      const debit  = parseAmount(cell(mapping.debit))
      const credit = parseAmount(cell(mapping.credit))
      if (debit !== 0) { amount = Math.abs(debit); direction = debit > 0 ? 'debit' : 'credit' }
      else if (credit !== 0) { amount = Math.abs(credit); direction = credit > 0 ? 'credit' : 'debit' }
    }
    if (amount === 0) continue

    const vendor  = cell(mapping.vendor)
    const rawDate = cell(mapping.date)
    const desc    = cell(mapping.description)
    if (isTotalRow(vendor, rawDate, desc)) continue

    const date = rawDate ? parseDate(rawDate, order) : ''
    // A payment with no payee is kept, so it can be reported, but only when it
    // is clearly a transaction (it has a date); otherwise it is a report's
    // subtotal or a stray line, and counting it would double the spend.
    if (!vendor && !date) continue

    const category = cell(mapping.category)
    const account  = cell(mapping.account)
    const period   = cell(mapping.period)
    const kind     = cell(mapping.source)
    // On a check or wire, QuickBooks' "Num" holds the check number. That says
    // nothing about which invoice it paid.
    const invoice  = /check|cheque|\bpayment\b|\bach\b|\bwire\b|\beft\b/i.test(kind) ? '' : cell(mapping.invoice)
    const source   = classifySource(kind)
    const entity   = cell(mapping.entity)
    const local    = mapping.localAmount ? Math.abs(parseAmount(cell(mapping.localAmount))) : 0

    txs.push({
      id:          `TX-${i}`,
      date,
      vendor,
      amount,
      description: desc || vendor,
      category,
      account,
      rowIndex:    i,
      direction,
      ...(period ? { period } : {}),
      ...(invoice ? { invoice } : {}),
      ...(source ? { source } : {}),
      ...(entity ? { entity } : {}),
      ...(local ? { localAmount: local } : {}),
    })
  }

  return txs
}

// ─── Header row detection ─────────────────────────────────────────────────────

/**
 * Real exports rarely put the header on the first line. Accounting systems and
 * hand-built workbooks routinely lead with a company name, a report title, a
 * date-generated stamp, then the actual header. Taking row 0 blindly makes the
 * header something like ["Northwest Co"], so no vendor or amount column is
 * found and every row is discarded.
 *
 * Score each candidate row by how much it looks like a header, and prefer one
 * that yields both a vendor and an amount.
 */
function scoreHeaderRow(cells: unknown[]): number {
  const headers = cells.map(c => String(c ?? '').trim()).filter(Boolean)
  if (headers.length < 2) return -1

  // Figures and dates are data. Without this, a trial balance line such as
  // "4900 | Intercompany fee income | -6478733.90" passes for a header, because
  // its one text cell happens to contain both "company" and "income".
  const dataCells = headers.filter(h => looksNumeric(h) || /^\d{4}-\d{2}-\d{2}/.test(h)).length
  if (dataCells / headers.length > 1 / 3) return -1

  const m = detectColumns(headers)
  let score = 0
  if (m.vendor)                            score += 3
  if (m.amount || m.debit || m.credit)     score += 3
  if (m.date)                              score += 2
  if (m.description)                       score += 1
  if (m.category)                          score += 1
  if (m.account)                           score += 1

  // Header cells are labels, not figures. A row of numbers is data, not a header.
  const labelish = headers.filter(h => isNaN(parseFloat(h.replace(/[$,]/g, '')))).length
  score += Math.min(labelish, 4) * 0.25

  return score
}

/** Index of the most header-like row within the first `maxScan` rows. */
function pickHeaderRow(rows: unknown[][], maxScan = 15): number {
  let bestIdx = 0
  let bestScore = -1
  const limit = Math.min(rows.length, maxScan)
  for (let i = 0; i < limit; i++) {
    const s = scoreHeaderRow(rows[i] ?? [])
    if (s > bestScore) { bestScore = s; bestIdx = i }
  }
  // Only override the default when the winner actually carries both a vendor
  // and an amount (3 + 3); otherwise fall back to the conventional first row.
  return bestScore >= 6 ? bestIdx : 0
}

/** The column an unnamed, section-headed first column becomes. */
const SECTION = 'Account'

/** A row holding only a label in its first cell. */
function isSectionRow(cells: unknown[]): boolean {
  const first = String(cells[0] ?? '').trim()
  return !!first && !/^total\b/i.test(first) && cells.slice(1).every(c => String(c ?? '').trim() === '')
}

/**
 * Build row objects from a matrix given the header row index. Repeated header
 * names are suffixed so later columns don't silently overwrite earlier ones.
 */
function buildRows(matrix: unknown[][], headerIdx: number): { rows: RawRow[]; headers: string[] } {
  const seen = new Map<string, number>()
  const rawHeaders = (matrix[headerIdx] ?? []).map(h => {
    const base = String(h ?? '').trim()
    if (!base) return ''
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    return n === 0 ? base : `${base} (${n + 1})`
  })

  // QuickBooks' detail report has no account column. It leaves its first column
  // unnamed and heads each block of rows with the account name there, so the
  // account has to be carried down onto the rows beneath it.
  const sectioned = rawHeaders[0] === '' && !rawHeaders.includes(SECTION) && matrix.slice(headerIdx + 1).some(isSectionRow)
  if (sectioned) rawHeaders[0] = SECTION
  let section = ''

  const headers = rawHeaders.filter(Boolean)
  const rows: RawRow[] = []
  const headerText = (matrix[headerIdx] ?? []).map(h => String(h ?? '').trim())

  for (let r = headerIdx + 1; r < matrix.length; r++) {
    const cells = matrix[r] ?? []
    // Paginated reports repeat their column headings throughout the data.
    const repeats = headerText.filter((h, ci) => h && String(cells[ci] ?? '').trim() === h).length
    if (headers.length > 0 && repeats / headers.length >= 0.5) continue
    if (sectioned && isSectionRow(cells)) { section = String(cells[0]).trim(); continue }
    const row: RawRow = {}
    rawHeaders.forEach((h, ci) => {
      if (!h) return
      if (sectioned && ci === 0) { row[h] = /^total\b/i.test(String(cells[0] ?? '').trim()) ? '' : section; return }
      const cell = cells[ci]
      row[h] = cell instanceof Date
        ? `${cell.getFullYear()}-${String(cell.getMonth() + 1).padStart(2, '0')}-${String(cell.getDate()).padStart(2, '0')}`
        : String(cell ?? '').trim()
    })
    if (Object.values(row).some(v => v !== '')) rows.push(row)
  }

  return { rows, headers }
}

/**
 * How much a sheet looks like a ledger: its dated payments to a named party
 * first, so a long undated summary never beats a real register.
 */
function ledgerScore(rows: RawRow[], headers: string[]): number {
  const txs = rowsToTransactions(rows, validateMapping(rows, headers, detectColumns(headers)))
  return txs.filter(t => t.date && t.vendor).length * 1_000_000 + txs.length
}

/** True when a header set gives us enough to build transactions. */
function isUsable(headers: string[]): boolean {
  const m = detectColumns(headers)
  return !!m.vendor && !!(m.amount || m.debit || m.credit)
}

// ─── Mapping validation ───────────────────────────────────────────────────────

function sample(rows: RawRow[], col: string, n = 40): string[] {
  return rows.slice(0, n).map(r => (r[col] ?? '').trim()).filter(Boolean)
}

function looksNumeric(v: string): boolean {
  const s = v.replace(/[$£€¥₹,\s()]/g, '')
  return s !== '' && !isNaN(Number(s))
}

/** Share of sampled values in a column that parse as numbers. */
function numericRatio(rows: RawRow[], col: string): number {
  const vals = sample(rows, col)
  if (vals.length === 0) return 0
  return vals.filter(looksNumeric).length / vals.length
}

/**
 * Whether a value actually looks like a date.
 *
 * Deliberately does not use parseDate: that returns the raw input when it
 * cannot parse, so "Stripe" comes back as "Stripe" rather than empty. Nor does
 * it trust `new Date` alone, which reads "100234" as the year 100234 and would
 * make an invoice-number column look like dates.
 */
function looksLikeDate(v: string): boolean {
  const s = v.trim()
  if (!s) return false
  if (/^-?\d+(\.\d+)?$/.test(s)) return false            // bare number, not a date
  if (/^\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}/.test(s)) return true   // 2026-01-04
  if (/^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}$/.test(s)) return true // 04/01/2026
  // Textual forms such as "4 Jan 2026" or "Jan 4, 2026".
  if (/[a-z]{3}/i.test(s) && /\d/.test(s) && !isNaN(new Date(s).getTime())) return true
  return false
}

/** Share of sampled values in a column that look like dates. */
function dateRatio(rows: RawRow[], col: string): number {
  const vals = sample(rows, col)
  if (vals.length === 0) return 0
  return vals.filter(looksLikeDate).length / vals.length
}

/** A column of money, judged on every value and not on what its header says. */
function moneyColumn(rows: RawRow[], col: string, mayBeEmpty = false): boolean {
  if (/\b(account|acct)\b/i.test(col)) return false // "Debit Account" holds account codes
  const vals = rows.map(r => (r[col] ?? '').trim()).filter(Boolean)
  if (vals.length === 0) return mayBeEmpty
  return vals.filter(looksNumeric).length / vals.length >= 0.9
}

const MONEY_HEADER = /amount|paid|payment|spend|expenditure|cost|charge|price|value|total|\bnet\b|gross/i

/** Long whole numbers, or numbers padded with zeros: a voucher or PO number, not money. */
function idValues(rows: RawRow[], col: string): boolean {
  const vals = sample(rows, col).filter(looksNumeric)
  if (vals.length === 0) return false
  return vals.every(v => /^\d+$/.test(v) && (v.length >= 7 || v.startsWith('0')))
}

/** Looks like an identifier or a year rather than money. */
function looksLikeIdOrYear(header: string, rows: RawRow[], col: string): boolean {
  if (/\b(id|no|num|number|code|ref|reference|qty|quantity|count|year|fy)\b/.test(header.toLowerCase().replace(/_/g, ' '))) return true
  const vals = sample(rows, col).filter(looksNumeric).map(v => Math.abs(parseAmount(v)))
  if (vals.length === 0) return false
  const allWholeSmall = vals.every(v => Number.isInteger(v) && v > 1900 && v < 2200)
  return allWholeSmall
}

/**
 * Header names alone are not trustworthy. Confirm the chosen columns against
 * the data and repair them if they disagree, which is what turns a
 * mis-detected header into vendors rendered as numbers and a total of a
 * couple of dollars.
 */
function validateMapping(rows: RawRow[], headers: string[], mapping: ColumnMapping): ColumnMapping {
  const m = { ...mapping }

  // A period label is never the transaction date or the payee.
  if (m.period && (m.period === m.date || m.period === m.vendor)) m.period = null

  // If the header names gave us no date column, recover it from the data so
  // it is not later mistaken for the vendor.
  if (!m.date) {
    const dateCol = headers.find(h => h !== m.vendor && dateRatio(rows, h) > 0.7)
    if (dateCol) m.date = dateCol
  }

  // A vendor column should hold names: not figures, and not dates.
  if (m.vendor && numericRatio(rows, m.vendor) > 0.5)  m.vendor = null
  if (m.vendor && dateRatio(rows, m.vendor) > 0.7)     m.vendor = null
  if (!m.vendor) {
    const textCols = headers
      .filter(h => numericRatio(rows, h) < 0.3 && sample(rows, h).length > 0)
      .filter(h => dateRatio(rows, h) <= 0.7)
      .filter(h => h !== m.date && h !== m.category && h !== m.account && h !== m.period)
    // Prefer the column with the most distinct values: vendors vary, labels repeat.
    const best = textCols
      .map(h => ({ h, distinct: new Set(sample(rows, h).map(v => v.toLowerCase())).size }))
      .sort((a, b) => b.distinct - a.distinct)[0]
    m.vendor = best?.h ?? null
  }

  // NetSuite and QuickBooks put "Bill", "Journal" and "Check" in a column called
  // Type. That says what kind of entry a row is, not what the money bought.
  if (m.category && (!m.source || m.source === m.category) && /^(transaction\s*)?type$/i.test(m.category)) {
    const vals = sample(rows, m.category, 200)
    if (vals.length && vals.filter(v => classifySource(v)).length / vals.length >= 0.5) {
      m.source = m.category
      m.category = m.account && numericRatio(rows, m.account) < 0.5 ? m.account : null
      m.account = matchCol(headers.filter(h => h !== m.category && h !== m.source), UNIT_SYN) ?? m.account
    }
  }
  if (m.source && m.source === m.category) m.category = null
  // With no category column, the account name is the next best thing.
  if (!m.category && m.account && numericRatio(rows, m.account) < 0.5) m.category = m.account

  // A "description" drawn from a short list is a classification in all but name.
  if (!m.category && m.description) {
    const vals = rows.map(r => (r[m.description!] ?? '').trim()).filter(Boolean)
    const distinct = new Set(vals.map(v => v.toLowerCase())).size
    if (vals.length >= 200 && distinct >= 5 && distinct / vals.length <= 0.05) m.category = m.description
  }

  // The unit a payment was for keeps identical amounts for two services apart.
  if (!m.account || m.account === m.category) {
    const unit = matchCol(headers.filter(h => h !== m.category && h !== m.vendor && h !== m.source), UNIT_SYN)
    if (unit) m.account = unit
  }

  // A category is what the money was spent on. Where the file has an account
  // name, that is a better answer than who spent it, and the checks compare
  // like with like only when it is used.
  // The cost center is not lost: it is the unit a payment was made for, which
  // is what the account slot means to the checks.
  if (m.category && m.account && /cost\s*cent|department|dept|division/i.test(m.category) && numericRatio(rows, m.account) < 0.5) {
    ;[m.category, m.account] = [m.account, m.category]
  }

  // With separate debit and credit columns the direction of each row is
  // explicit, and a consolidated export's "Txn Amount" beside them is in each
  // entity's own currency, so summing it adds dollars to euros.
  if (m.amount && m.debit && m.credit && m.debit !== m.credit && moneyColumn(rows, m.debit) && moneyColumn(rows, m.credit, true)) {
    m.localAmount = m.amount // not summed, but approval limits are set in this money
    m.amount = null
  }

  // An amount column should hold figures, and not be an id, count or year.
  const amountBad = m.amount && (numericRatio(rows, m.amount) < 0.5 || looksLikeIdOrYear(m.amount, rows, m.amount))
  if (amountBad) m.amount = null

  if (!m.amount && !m.debit && !m.credit) {
    const numeric = headers
      .filter(h => h !== m.vendor && h !== m.date)
      .filter(h => numericRatio(rows, h) >= 0.6)
      .filter(h => !looksLikeIdOrYear(h, rows, h) && !idValues(rows, h))
    // A header that names money wins outright: identifiers can be far larger
    // than any payment. Failing that, money columns carry the larger magnitudes.
    const best = numeric
      .map(h => {
        const vals = sample(rows, h).filter(looksNumeric).map(v => Math.abs(parseAmount(v)))
        const mean = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0
        return { h, mean, money: MONEY_HEADER.test(h) }
      })
      .sort((a, b) => Number(b.money) - Number(a.money) || b.mean - a.mean)[0]
    if (best) m.amount = best.h
  }

  return m
}

// ─── CSV parser (PapaParse wrapper) ──────────────────────────────────────────

export async function parseCSV(file: File): Promise<{ rows: RawRow[]; headers: string[] }> {
  const Papa = (await import('papaparse')).default
  // Parsed as a matrix rather than with header:true, so the header row can be
  // located rather than assumed to be the first line.
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      header: false,
      skipEmptyLines: true,
      complete: (result) => {
        const matrix = (result.data as unknown[][]).filter(r => Array.isArray(r))
        if (matrix.length === 0) return resolve({ rows: [], headers: [] })
        resolve(buildRows(matrix, pickHeaderRow(matrix)))
      },
      error: (err: Error) => reject(err),
    })
  })
}

// ─── Excel parser (SheetJS wrapper) ──────────────────────────────────────────

export async function parseExcel(file: File): Promise<{ rows: RawRow[]; headers: string[] }> {
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  // Dates are read as serial numbers with their number format, then converted
  // by arithmetic. SheetJS's own Date objects carry the local zone's historical
  // offset and land on the previous day east of Greenwich.
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false, cellNF: true })

  // Walk every sheet. Workbooks lead with covers, summaries and agings, and an
  // AP aging has a vendor and a total just as a ledger does, so the first tab
  // that looks usable is often the wrong one. Keep the tab that yields the most
  // real transactions; if none is usable, keep the richest sheet seen so the
  // caller can still surface its columns.
  let fallback: { rows: RawRow[]; headers: string[] } = { rows: [], headers: [] }
  let best: { rows: RawRow[]; headers: string[]; score: number } | null = null

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    if (!ws) continue

    const matrix: unknown[][] = []
    if (!ws['!ref']) continue
    const range = XLSX.utils.decode_range(ws['!ref'])
    for (let r = range.s.r; r <= range.e.r; r++) {
      const line: unknown[] = []
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })]
        if (!cell || cell.v === undefined || cell.v === null) line.push('')
        else if (cell.t === 'n' && cell.z && XLSX.SSF.is_date(String(cell.z))) line.push(excelSerialToISO(Number(cell.v)))
        else if (cell.t === 'd' && cell.v instanceof Date) line.push(cell.v.toISOString().slice(0, 10))
        else line.push(cell.v)
      }
      if (line.some(v => v !== '')) matrix.push(line)
    }

    if (matrix.length < 2) continue

    const { rows, headers } = buildRows(matrix, pickHeaderRow(matrix))
    if (headers.length === 0 || rows.length === 0) continue

    if (isUsable(headers)) {
      const score = ledgerScore(rows, headers)
      if (!best || score > best.score) best = { rows, headers, score }
    } else if (rows.length > fallback.rows.length) {
      fallback = { rows, headers }
    }
  }

  return best ? { rows: best.rows, headers: best.headers } : fallback
}

// ─── PDF parser (pdfjs-dist) ──────────────────────────────────────────────────

// Patterns for financial data extraction from unstructured PDF text
const DATE_RE    = /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})\b/
const AMOUNT_RE  = /\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\b/
const WORDS_RE   = /[A-Z][A-Za-z\s&\.,'-]{3,40}/g

async function extractPDFText(file: File): Promise<string[][]> {
  // Dynamically import pdfjs-dist to avoid SSR issues
  const pdfjs = await import('pdfjs-dist')
  // Use locally-bundled worker (public/pdf.worker.min.mjs) — no CDN dependency
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
  const pageLines: string[][] = []

  for (let p = 1; p <= pdf.numPages; p++) {
    const page  = await pdf.getPage(p)
    const content = await page.getTextContent()
    // Group text items by approximate y-position (line)
    const lineMap = new Map<number, string[]>()
    for (const item of content.items) {
      if (!('str' in item)) continue
      const y = Math.round((item as { transform: number[] }).transform[5] / 10) * 10
      if (!lineMap.has(y)) lineMap.set(y, [])
      lineMap.get(y)!.push((item as { str: string }).str)
    }
    const lines = [...lineMap.entries()]
      .sort(([a], [b]) => b - a)
      .map(([, parts]) => parts.join(' ').trim())
      .filter(l => l.length > 0)
    pageLines.push(lines)
  }
  return pageLines
}

async function parsePDF(file: File): Promise<{ rows: RawRow[]; headers: string[] }> {
  const pageLines = await extractPDFText(file)
  const rows: RawRow[] = []
  const allLines = pageLines.flat()

  for (const line of allLines) {
    // A transaction line must have both a date and an amount
    const dateMatch   = DATE_RE.exec(line)
    const amountMatch = AMOUNT_RE.exec(line)
    if (!dateMatch || !amountMatch) continue

    // Extract potential vendor name: the longest capitalized phrase that isn't a date/amount
    const clean = line.replace(dateMatch[0], '').replace(amountMatch[0], '').trim()
    const names  = clean.match(WORDS_RE) ?? []
    const vendor = names.sort((a, b) => b.length - a.length)[0]?.trim() || 'Unknown Vendor'

    // Clean amount
    const amt = amountMatch[1].replace(/,/g, '')

    rows.push({
      Date:        dateMatch[1],
      Vendor:      vendor,
      Amount:      amt,
      Description: clean.replace(vendor, '').trim() || vendor,
    })
  }

  return {
    rows,
    headers: ['Date', 'Vendor', 'Amount', 'Description'],
  }
}

// ─── OFX / QFX / QBO (bank and card downloads) ─────────────────────────────────

/**
 * Bank and card downloads in Open Financial Exchange format, which Quicken
 * (.qfx) and QuickBooks (.qbo) files also use. Version 1 is SGML, where leaf
 * fields have no closing tag; version 2 is XML. Both are read the same way:
 * each <STMTTRN> block is one transaction. Amounts are from the account
 * holder's side, so negative is money out (spend) and positive money in.
 */
export function parseOFXText(text: string): StoredTransaction[] {
  const field = (block: string, tag: string) => {
    const m = new RegExp(`<${tag}>([^<\r\n]*)`, 'i').exec(block)
    return m ? m[1].trim() : ''
  }
  const account = field(text, 'ACCTID').replace(/^.*(\d{4})$/, '••$1')
  const out: StoredTransaction[] = []
  const blocks = text.split(/<STMTTRN>/i).slice(1)
  blocks.forEach((raw, i) => {
    const block = raw.split(/<\/STMTTRN>/i)[0]
    const amt = parseAmount(field(block, 'TRNAMT'))
    if (!amt) return
    const posted = field(block, 'DTPOSTED')
    const date = /^\d{8}/.test(posted) ? `${posted.slice(0, 4)}-${posted.slice(4, 6)}-${posted.slice(6, 8)}` : ''
    const name = field(block, 'NAME') || field(block, 'PAYEE')
    const memo = field(block, 'MEMO')
    const check = field(block, 'CHECKNUM')
    out.push({
      id: `TX-${i}`, rowIndex: i, date,
      vendor: name,
      amount: Math.abs(amt),
      direction: amt < 0 ? 'debit' : 'credit',
      description: [name, memo && memo !== name ? memo : '', check ? `#${check}` : ''].filter(Boolean).join(' '),
      category: '',
      account,
    })
  })
  return out
}

// ─── Unified file parser ──────────────────────────────────────────────────────

const EXCEL_EXTS = ['.xlsx', '.xls', '.xlsm', '.xlsb']
const CSV_EXTS   = ['.csv', '.tsv', '.txt']
const PDF_EXTS   = ['.pdf']
const OFX_EXTS   = ['.ofx', '.qfx', '.qbo']

const CURRENCY_CODES = ['USD', 'GBP', 'EUR', 'CAD', 'AUD']
const CURRENCY_MARKS: [RegExp, string][] = [[/£/, 'GBP'], [/€/, 'EUR']]

/**
 * The currency a file states, if it states one: in the money column's header,
 * in its cells, or in a currency column that holds a single value. Most exports
 * do not say, and a dollar sign alone is too ambiguous to count.
 */
export function detectCurrency(rows: RawRow[], headers: string[], mapping: ColumnMapping): string | undefined {
  const money = mapping.amount ?? mapping.debit
  if (money) {
    const code = CURRENCY_CODES.find(c => new RegExp(`\\b${c}\\b`, 'i').test(money))
    if (code) return code
    const mark = CURRENCY_MARKS.find(([re]) => re.test(money))
    if (mark) return mark[1]
    const cells = sample(rows, money, 200)
    for (const [re, c] of CURRENCY_MARKS) if (cells.length && cells.filter(v => re.test(v)).length / cells.length >= 0.5) return c
  }
  const col = headers.find(h => /^(curr|currency|ccy)(\s*code)?$/i.test(h.trim()))
  if (col) {
    const vals = sample(rows, col, 500).map(v => v.toUpperCase())
    const top = CURRENCY_CODES.find(c => vals.length && vals.filter(v => v === c).length / vals.length >= 0.95)
    if (top) return top
  }
  return undefined
}

export async function parseFile(
  file: File,
): Promise<{ transactions: StoredTransaction[]; mapping: ColumnMapping; rowCount: number; currency?: string } | { error: string }> {
  const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase()

  let rows: RawRow[] = []
  let headers: string[] = []

  if (OFX_EXTS.includes(ext)) {
    try {
      const transactions = parseOFXText(await file.text())
      if (transactions.length === 0) return { error: `No transactions found in ${file.name}. Check that it is a bank or card statement download.` }
      return { transactions, mapping: { date: 'DTPOSTED', vendor: 'NAME', amount: 'TRNAMT', debit: null, credit: null, description: 'MEMO', category: null, account: 'ACCTID' }, rowCount: transactions.length }
    } catch (e: unknown) {
      return { error: `Failed to read ${file.name}: ${e instanceof Error ? e.message : String(e)}` }
    }
  }

  try {
    if (EXCEL_EXTS.includes(ext)) {
      ;({ rows, headers } = await parseExcel(file))
    } else if (CSV_EXTS.includes(ext) || ext === '') {
      ;({ rows, headers } = await parseCSV(file))
    } else if (PDF_EXTS.includes(ext)) {
      ;({ rows, headers } = await parsePDF(file))
    } else {
      return { error: `${ext} files cannot be read. Upload a CSV, Excel, PDF, or OFX/QFX/QBO bank download.` }
    }
  } catch (e: unknown) {
    return { error: `Failed to parse ${file.name}: ${e instanceof Error ? e.message : String(e)}` }
  }

  if (rows.length === 0) {
    return { error: `No data rows found in ${file.name}` }
  }

  // Detect from the header names, then confirm each choice against the actual
  // column contents. Names alone mislead: a header called "Total" can end up
  // bound to vendor, which renders vendors as numbers and collapses the spend
  // total. Validation repairs those picks from the data.
  const mapping = validateMapping(rows, headers, detectColumns(headers))

  const transactions = rowsToTransactions(rows, mapping)

  if (transactions.length === 0) {
    return { error: `Could not extract any transactions from ${file.name}. Check that columns include vendor/payee and amount.` }
  }

  return { transactions, mapping, rowCount: rows.length, currency: detectCurrency(rows, headers, mapping) }
}
