// Turns each provider's API records into the same rows a spreadsheet upload
// produces, so every source runs through one engine. Pure functions: no I/O,
// tested against the providers' documented payloads in test/engine.
import type { StoredTransaction } from '../dataStore'

const money = (n: unknown) => Math.round(Math.abs(Number(n) || 0) * 100) / 100
const isoDay = (s: unknown) => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : '')

function row(id: string, i: number, f: Omit<StoredTransaction, 'id' | 'rowIndex'>): StoredTransaction {
  return { id, rowIndex: i, ...f, description: (f.description || f.vendor).trim().slice(0, 300) }
}

// ── QuickBooks Online ────────────────────────────────────────────────────────
// Purchases (cheques, card charges, cash), Bills (accounts payable) and Vendor
// Credits. Bill payments are left out: they settle a Bill already counted.

interface QbRef { name?: string; value?: string }
interface QbLine { Amount?: number; Description?: string; AccountBasedExpenseLineDetail?: { AccountRef?: QbRef }; ItemBasedExpenseLineDetail?: { ItemRef?: QbRef } }
export interface QbTxn {
  Id: string; TxnDate?: string; TotalAmt?: number; DocNumber?: string; PrivateNote?: string
  EntityRef?: QbRef; VendorRef?: QbRef; Line?: QbLine[]; Credit?: boolean; PaymentType?: string
  DepartmentRef?: QbRef; AccountRef?: QbRef
}
export type QbEntity = 'Purchase' | 'Bill' | 'VendorCredit'

export function mapQuickBooks(entity: QbEntity, records: QbTxn[], start = 0): StoredTransaction[] {
  return records.filter(r => money(r.TotalAmt) > 0).map((r, i) => {
    const line = (r.Line ?? []).find(l => l.AccountBasedExpenseLineDetail || l.ItemBasedExpenseLineDetail)
    const category = line?.AccountBasedExpenseLineDetail?.AccountRef?.name ?? line?.ItemBasedExpenseLineDetail?.ItemRef?.name ?? ''
    const credit = entity === 'VendorCredit' || (entity === 'Purchase' && r.Credit === true)
    const kind = entity === 'Bill' ? 'Bill' : entity === 'VendorCredit' ? 'Vendor credit' : r.PaymentType === 'CreditCard' ? 'Card charge' : r.PaymentType === 'Check' ? 'Cheque' : 'Expense'
    return row(`qb:${entity}:${r.Id}`, start + i, {
      date:        isoDay(r.TxnDate),
      vendor:      (r.EntityRef?.name ?? r.VendorRef?.name ?? '').trim(),
      amount:      money(r.TotalAmt),
      direction:   credit ? 'credit' : 'debit',
      description: [kind, r.DocNumber ? `#${r.DocNumber}` : '', r.PrivateNote ?? line?.Description ?? ''].filter(Boolean).join(' '),
      category,
      account:     r.DepartmentRef?.name ?? '',
    })
  })
}

// ── Xero ─────────────────────────────────────────────────────────────────────
// Bills (ACCPAY invoices), supplier credit notes (ACCPAYCREDIT) and spend
// bank transactions. Drafts, deleted and voided records are not spend.

/** Xero JSON dates arrive as "/Date(1712016000000+0000)/" or an ISO string. */
export function xeroDate(d: unknown): string {
  if (typeof d !== 'string') return ''
  const m = /\/Date\((-?\d+)/.exec(d)
  if (m) return new Date(Number(m[1])).toISOString().slice(0, 10)
  return isoDay(d)
}

interface XeroLine { AccountCode?: string; Description?: string; Tracking?: { Option?: string }[] }
export interface XeroDoc {
  InvoiceID?: string; CreditNoteID?: string; BankTransactionID?: string
  Type?: string; Status?: string; Date?: string; DateString?: string; Total?: number
  InvoiceNumber?: string; CreditNoteNumber?: string; Reference?: string
  Contact?: { Name?: string }; LineItems?: XeroLine[]
}
const XERO_SKIP = new Set(['DRAFT', 'DELETED', 'VOIDED', 'SUBMITTED'])

export function mapXero(kind: 'bill' | 'credit' | 'spend', docs: XeroDoc[], accounts: Record<string, string>, start = 0): StoredTransaction[] {
  return docs
    .filter(d => !XERO_SKIP.has((d.Status ?? '').toUpperCase()) && money(d.Total) > 0)
    .filter(d => kind !== 'spend' || (d.Type ?? '').toUpperCase().startsWith('SPEND'))
    .map((d, i) => {
      const line = d.LineItems?.[0]
      const number = d.InvoiceNumber ?? d.CreditNoteNumber
      return row(`xero:${kind}:${d.InvoiceID ?? d.CreditNoteID ?? d.BankTransactionID}`, start + i, {
        date:        xeroDate(d.DateString ?? d.Date),
        vendor:      (d.Contact?.Name ?? '').trim(),
        amount:      money(d.Total),
        direction:   kind === 'credit' ? 'credit' : 'debit',
        description: [kind === 'bill' ? 'Bill' : kind === 'credit' ? 'Credit note' : 'Spend', number ? `#${number}` : '', d.Reference ?? line?.Description ?? ''].filter(Boolean).join(' '),
        category:    (line?.AccountCode && accounts[line.AccountCode]) || line?.AccountCode || '',
        account:     line?.Tracking?.[0]?.Option ?? '',
      })
    })
}

// ── Plaid (bank and card feeds) ──────────────────────────────────────────────
// Plaid's sign convention: positive is money leaving the account. Pending
// transactions are skipped until they post.

export interface PlaidTxn {
  transaction_id: string; account_id: string; amount: number; date: string; authorized_date?: string | null
  name?: string; merchant_name?: string | null; pending?: boolean
  personal_finance_category?: { primary?: string; detailed?: string } | null; category?: string[] | null
}
export interface PlaidAccount { account_id: string; name?: string; mask?: string | null }

const titleCase = (s: string) => s.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

export function mapPlaid(txns: PlaidTxn[], accounts: PlaidAccount[], start = 0): StoredTransaction[] {
  const acct = new Map(accounts.map(a => [a.account_id, `${a.name ?? 'Account'}${a.mask ? ` ••${a.mask}` : ''}`]))
  return txns.filter(t => !t.pending && t.amount !== 0).map((t, i) => row(`plaid:${t.transaction_id}`, start + i, {
    date:        isoDay(t.date),
    vendor:      (t.merchant_name || t.name || '').trim(),
    amount:      money(t.amount),
    direction:   t.amount > 0 ? 'debit' : 'credit',
    description: t.name ?? '',
    category:    t.personal_finance_category?.primary ? titleCase(t.personal_finance_category.primary) : (t.category?.[0] ?? ''),
    account:     acct.get(t.account_id) ?? '',
  }))
}

// ── Gusto (payroll) ──────────────────────────────────────────────────────────
// Each processed payroll is one payment: the total debited from the company.

export interface GustoPayroll {
  payroll_uuid?: string; uuid?: string; check_date?: string; processed?: boolean
  totals?: { company_debit?: string | number; net_pay?: string | number }
}

export function mapGusto(payrolls: GustoPayroll[], start = 0): StoredTransaction[] {
  return payrolls.filter(p => p.processed !== false && money(p.totals?.company_debit ?? p.totals?.net_pay) > 0).map((p, i) => row(`gusto:${p.payroll_uuid ?? p.uuid}`, start + i, {
    date:        isoDay(p.check_date),
    vendor:      'Gusto Payroll',
    amount:      money(p.totals?.company_debit ?? p.totals?.net_pay),
    direction:   'debit',
    description: `Payroll ${p.check_date ?? ''}`.trim(),
    category:    'Payroll',
    account:     '',
  }))
}
