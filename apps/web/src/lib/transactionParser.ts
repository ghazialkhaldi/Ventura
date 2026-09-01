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

function matchCol(headers: string[], synonyms: string[]): string | null {
  const low = headers.map(h => h.toLowerCase().trim())
  // exact match first
  for (const syn of synonyms) {
    const i = low.indexOf(syn)
    if (i >= 0) return headers[i]
  }
  // substring match
  for (const syn of synonyms) {
    const i = low.findIndex(h => h.includes(syn))
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

// ─── CSV parser (PapaParse wrapper) ──────────────────────────────────────────

export async function parseCSV(file: File): Promise<{ rows: RawRow[]; headers: string[] }> {
  const Papa = (await import('papaparse')).default
  return new Promise((resolve, reject) => {
    Papa.parse<RawRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim(),
      complete: (result) => {
        resolve({
          rows:    result.data as RawRow[],
          headers: result.meta.fields ?? [],
        })
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

  // Use the first sheet
  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]

  const jsonRows = (XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: '',
    blankrows: false,
  }) as unknown) as unknown[][]

  if (jsonRows.length < 2) return { rows: [], headers: [] }

  // First row = headers
  const rawHeaders = (jsonRows[0] as string[]).map(h => String(h ?? '').trim())
  const headers = rawHeaders.filter(Boolean)

  const rows: RawRow[] = []
  for (let r = 1; r < jsonRows.length; r++) {
    const cells = jsonRows[r] as unknown[]
    const row: RawRow = {}
    rawHeaders.forEach((h, ci) => {
      if (h) {
        const cell = cells[ci]
        if (cell instanceof Date) {
          row[h] = cell.toISOString().split('T')[0]
        } else {
          row[h] = String(cell ?? '').trim()
        }
      }
    })
    // Skip completely empty rows
    if (Object.values(row).some(v => v !== '')) {
      rows.push(row)
    }
  }

  return { rows, headers }
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

  const mapping = detectColumns(headers)

  // Need at least a vendor and either amount or debit/credit
  const hasVendor = !!(mapping.vendor)
  const hasAmount = !!(mapping.amount || mapping.debit || mapping.credit)

  if (!hasVendor || !hasAmount) {
    // Try using the first numeric column as amount and first text column as vendor
    const numericCols = headers.filter(h => {
      const vals = rows.slice(0, 20).map(r => r[h]).filter(Boolean)
      return vals.some(v => !isNaN(parseFloat(v.replace(/[$,]/g, ''))))
    })
    const textCols = headers.filter(h => !numericCols.includes(h))

    if (!mapping.amount && numericCols.length > 0) mapping.amount = numericCols[0]
    if (!mapping.vendor && textCols.length > 0)    mapping.vendor = textCols[0]
  }

  const transactions = rowsToTransactions(rows, mapping)

  if (transactions.length === 0) {
    return { error: `Could not extract any transactions from ${file.name}. Check that columns include vendor/payee and amount.` }
  }

  return { transactions, mapping, rowCount: rows.length }
}
