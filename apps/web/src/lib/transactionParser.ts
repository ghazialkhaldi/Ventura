import type { StoredTransaction, ColumnMapping } from './dataStore'

// ─── Column synonym tables ────────────────────────────────────────────────────

const DATE_SYN        = ['date','transaction date','trans date','txn date','posting date','invoice date','created','created at','post date','value date','settlement date','book date','entry date']
const VENDOR_SYN      = ['vendor','payee','merchant','supplier','name','company','counterpart','recipient','payor','payer','to','paid to','issued to','remit to']
const AMOUNT_SYN      = ['amount','value','total','net amount','transaction amount','sum','net','payment amount','original amount','gross amount','invoice amount','price']
const DEBIT_SYN       = ['debit','debit amount','withdrawal','outflow','expense','charge','dr','dr amount']
const CREDIT_SYN      = ['credit','credit amount','deposit','inflow','income','payment received','cr','cr amount','refund']
const DESCRIPTION_SYN = ['description','memo','notes','details','reference','narrative','particulars','remark','line description','note','memo line']
const CATEGORY_SYN    = ['category','type','account type','expense type','classification','class','cost center','department','budget code','gl category','subcategory','sub-category']
const PERIOD_SYN      = ['period','fiscal period','posting period','accounting period','gl period','period name','fiscal month','acct period']
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

export function detectColumns(headers: string[]): ColumnMapping {
  return {
    date:        matchCol(headers, DATE_SYN),
    vendor:      matchCol(headers, VENDOR_SYN),
    amount:      matchCol(headers, AMOUNT_SYN),
    debit:       matchCol(headers, DEBIT_SYN),
    credit:      matchCol(headers, CREDIT_SYN),
    description: matchCol(headers, DESCRIPTION_SYN),
    category:    matchCol(headers, CATEGORY_SYN),
    account:     matchCol(headers, ACCOUNT_SYN),
    period:      matchCol(headers, PERIOD_SYN),
  }
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
    // A value that only fits one reading wins over the column's habit.
    const dayFirst = a > 12 ? true : b > 12 ? false : order === 'dmy'
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

  // A single signed Amount column follows one of two conventions. AP and GL
  // exports show spend as positive and credit notes as negative; bank exports
  // show money out as negative and deposits as positive. Whichever sign most
  // rows carry is spend; the other is a credit, and is never counted as spend
  // or fed to the checks (a refund beside its charge is not a duplicate).
  let spendSign = 1
  if (mapping.amount) {
    let neg = 0, pos = 0
    for (const r of rows) { const v = parseAmount(r[mapping.amount] ?? ''); if (v < 0) neg++; else if (v > 0) pos++ }
    if (neg > pos) spendSign = -1
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

  const headers = rawHeaders.filter(Boolean)
  const rows: RawRow[] = []

  for (let r = headerIdx + 1; r < matrix.length; r++) {
    const cells = matrix[r] ?? []
    const row: RawRow = {}
    rawHeaders.forEach((h, ci) => {
      if (!h) return
      const cell = cells[ci]
      row[h] = cell instanceof Date
        ? `${cell.getFullYear()}-${String(cell.getMonth() + 1).padStart(2, '0')}-${String(cell.getDate()).padStart(2, '0')}`
        : String(cell ?? '').trim()
    })
    if (Object.values(row).some(v => v !== '')) rows.push(row)
  }

  return { rows, headers }
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

/** Looks like an identifier or a year rather than money. */
function looksLikeIdOrYear(header: string, rows: RawRow[], col: string): boolean {
  if (/\b(id|no|num|number|code|ref|reference|qty|quantity|count|year|fy)\b/.test(header.toLowerCase())) return true
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

  // An amount column should hold figures, and not be an id, count or year.
  const amountBad = m.amount && (numericRatio(rows, m.amount) < 0.5 || looksLikeIdOrYear(m.amount, rows, m.amount))
  if (amountBad) m.amount = null

  if (!m.amount && !m.debit && !m.credit) {
    const numeric = headers
      .filter(h => h !== m.vendor && h !== m.date)
      .filter(h => numericRatio(rows, h) >= 0.6)
      .filter(h => !looksLikeIdOrYear(h, rows, h))
    // Money columns tend to carry the larger magnitudes.
    const best = numeric
      .map(h => {
        const vals = sample(rows, h).filter(looksNumeric).map(v => Math.abs(parseAmount(v)))
        const mean = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0
        return { h, mean }
      })
      .sort((a, b) => b.mean - a.mean)[0]
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

  // Walk every sheet, not just the first. Workbooks frequently lead with a
  // cover, summary or notes tab and keep the ledger on a later one. Return the
  // first sheet that yields a usable vendor + amount mapping; otherwise keep
  // the richest sheet seen so the caller can still surface its columns.
  let fallback: { rows: RawRow[]; headers: string[] } = { rows: [], headers: [] }

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

    if (isUsable(headers)) return { rows, headers }
    if (rows.length > fallback.rows.length) fallback = { rows, headers }
  }

  return fallback
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

// ─── Unified file parser ──────────────────────────────────────────────────────

const EXCEL_EXTS = ['.xlsx', '.xls', '.xlsm', '.xlsb']
const CSV_EXTS   = ['.csv', '.tsv', '.txt']
const PDF_EXTS   = ['.pdf']

export async function parseFile(
  file: File,
): Promise<{ transactions: StoredTransaction[]; mapping: ColumnMapping; rowCount: number } | { error: string }> {
  const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase()

  let rows: RawRow[] = []
  let headers: string[] = []

  try {
    if (EXCEL_EXTS.includes(ext)) {
      ;({ rows, headers } = await parseExcel(file))
    } else if (CSV_EXTS.includes(ext) || ext === '') {
      ;({ rows, headers } = await parseCSV(file))
    } else if (PDF_EXTS.includes(ext)) {
      ;({ rows, headers } = await parsePDF(file))
    } else {
      return { error: `Unsupported file type: ${ext}` }
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

  return { transactions, mapping, rowCount: rows.length }
}
