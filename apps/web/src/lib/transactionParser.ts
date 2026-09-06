import type { StoredTransaction, ColumnMapping } from './dataStore'

// ─── Column synonym tables ────────────────────────────────────────────────────

const DATE_SYN        = ['date','transaction date','trans date','txn date','posting date','invoice date','created','created at','post date','value date','settlement date','book date','entry date']
const VENDOR_SYN      = ['vendor','payee','merchant','supplier','name','company','counterpart','recipient','payor','payer','to','paid to','issued to','remit to']
const AMOUNT_SYN      = ['amount','value','total','net amount','transaction amount','sum','net','payment amount','original amount','gross amount','invoice amount','price']
const DEBIT_SYN       = ['debit','debit amount','withdrawal','outflow','expense','charge','dr','dr amount']
const CREDIT_SYN      = ['credit','credit amount','deposit','inflow','income','payment received','cr','cr amount','refund']
const DESCRIPTION_SYN = ['description','memo','notes','details','reference','narrative','particulars','remark','line description','note','memo line']
const CATEGORY_SYN    = ['category','type','account type','expense type','classification','class','cost center','department','budget code','gl category','subcategory','sub-category']
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
  }
}

// ─── Value parsers ────────────────────────────────────────────────────────────

function parseAmount(raw: string): number {
  if (!raw || !raw.trim()) return 0
  // Remove currency symbols, commas, spaces, quotes
  let s = raw.replace(/['"$£€¥₹,\s]/g, '')
  // Handle parentheses as negative: (1000) = -1000
  const negative = s.startsWith('(') && s.endsWith(')')
  s = s.replace(/[()]/g, '')
  const v = parseFloat(s)
  if (isNaN(v)) return 0
  return negative ? -v : v
}

function parseDate(raw: string): string {
  if (!raw || !raw.trim()) return ''
  const s = raw.trim()

  // Try native Date parsing first (handles ISO, most US formats)
  const d = new Date(s)
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0]
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/)
  if (dmy) {
    const day = dmy[1].padStart(2, '0')
    const mon = dmy[2].padStart(2, '0')
    const yr  = dmy[3].length === 2 ? '20' + dmy[3] : dmy[3]
    const attempt = new Date(`${yr}-${mon}-${day}`)
    if (!isNaN(attempt.getTime())) return attempt.toISOString().split('T')[0]
  }

  return s // return raw if we can't parse
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

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]

    // Amount: try combined amount, then debit/credit columns.
    // A combined "Amount" column is always treated as spend (direction: debit) —
    // that's the dominant convention for AP/invoice/vendor-payment exports.
    // Separate Debit/Credit columns have unambiguous semantics: Debit = money
    // paid out (spend), Credit = money received (refund/rebate/reversal). These
    // must NOT be merged — a credit is not vendor spend and must never be
    // counted toward spend totals or fed into spend-anomaly detection.
    let amount = 0
    let direction: 'debit' | 'credit' = 'debit'
    if (mapping.amount && row[mapping.amount]) {
      amount = Math.abs(parseAmount(row[mapping.amount]))
    } else {
      const debit  = mapping.debit  && row[mapping.debit]  ? parseAmount(row[mapping.debit])  : 0
      const credit = mapping.credit && row[mapping.credit] ? parseAmount(row[mapping.credit]) : 0
      if (Math.abs(debit) > 0) {
        amount = Math.abs(debit)
        direction = 'debit'
      } else if (Math.abs(credit) > 0) {
        amount = Math.abs(credit)
        direction = 'credit'
      }
    }

    // Skip rows with no meaningful amount
    if (amount === 0) continue

    const vendor = (mapping.vendor ? row[mapping.vendor] : '') || ''
    // Skip completely empty vendor rows
    if (!vendor.trim()) continue

    const date     = mapping.date        ? parseDate(row[mapping.date] || '') : ''
    const desc     = mapping.description ? (row[mapping.description] || '').trim() : vendor.trim()
    const category = mapping.category    ? (row[mapping.category]    || '').trim() : ''
    const account  = mapping.account     ? (row[mapping.account]     || '').trim() : ''

    txs.push({
      id:          `TX-${i}`,
      date:        date || new Date().toISOString().split('T')[0],
      vendor:      vendor.trim(),
      amount:      Math.abs(amount),
      description: desc,
      category,
      account,
      rowIndex:    i,
      direction,
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
        ? cell.toISOString().split('T')[0]
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
      .filter(h => h !== m.date && h !== m.category && h !== m.account)
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
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })

  // Walk every sheet, not just the first. Workbooks frequently lead with a
  // cover, summary or notes tab and keep the ledger on a later one. Return the
  // first sheet that yields a usable vendor + amount mapping; otherwise keep
  // the richest sheet seen so the caller can still surface its columns.
  let fallback: { rows: RawRow[]; headers: string[] } = { rows: [], headers: [] }

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    if (!ws) continue

    const matrix = (XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: '',
      blankrows: false,
    }) as unknown) as unknown[][]

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
