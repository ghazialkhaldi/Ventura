/**
 * Real fraud and error patterns, planted into a company's own register in
 * its own style. Each records the rows a reviewer should be shown.
 */
import { Ledger, Names, dow } from './ledger'

type Ids = string[]

const amounts = (L: Ledger, ids: Ids) => ids.map(id => L.row(id).amount)
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }

/** The same invoice paid again some days later (needs invoice references in the export). */
export function dupInvoice(L: Ledger, ids: Ids, gap: number) {
  const src = L.row(L.pick(ids.slice(0, Math.max(1, ids.length - 2))))
  const ref = src.description.split(' ').pop()!
  const id = L.add(L.wd(L.dayOfRow(src.id) + gap), src.vendor, src.amount, src.category, { ref, account: src.account, desc: src.description.replace(` ${ref}`, '') })
  L.plant(`invoice paid twice (+${gap}d)`, ['duplicate'], [id])
}

/** An identical payment the same day (bank feeds carry no invoice numbers). */
export function dupSameDay(L: Ledger, ids: Ids) {
  const src = L.row(L.pick(ids))
  const id = L.add(L.dayOfRow(src.id), src.vendor, src.amount, src.category, { ref: null, account: src.account, desc: src.description })
  L.plant('paid twice the same day', ['duplicate'], [id])
}

/** The same invoice paid to a second spelling of the vendor (a duplicate vendor record). */
export function dupVendorVariant(L: Ledger, ids: Ids, variant: string) {
  const src = L.row(L.pick(ids))
  const ref = src.description.split(' ').pop()!
  const id = L.add(L.wd(L.dayOfRow(src.id) + 2 + Math.floor(L.r() * 6)), variant, src.amount, src.category, { ref, account: src.account, desc: src.description.replace(` ${ref}`, '') })
  L.plant('same invoice to a duplicate vendor record', ['duplicate'], [id])
}

/** A recurring charge paid a second time inside its cycle. */
export function extraInCycle(L: Ledger, ids: Ids) {
  const src = L.row(ids[Math.min(ids.length - 2, 3 + Math.floor(L.r() * Math.max(1, ids.length - 5)))])
  const id = L.add(L.wd(L.dayOfRow(src.id) + 5 + Math.floor(L.r() * 7)), src.vendor, src.amount, src.category, { account: src.account, desc: src.description.replace(/ INV-\d+$/, '') })
  L.plant('recurring charge paid twice in one cycle', ['duplicate'], [id])
}

/** An invoice split into payments just under the approval limit within a week. */
export function splitUnderLimit(L: Ledger, vendor: string, cat: string, limit = 10_000) {
  const d0 = L.wd(L.o.start + 60 + Math.floor(L.r() * Math.max(30, L.o.end - L.o.start - 90)))
  const offsets = L.r() < 0.5 ? [0, 1, 3] : [0, 1, 2, 4]
  const ids = offsets.map(o => L.add(L.wd(d0 + o), vendor, limit * (0.905 + L.r() * 0.09), cat))
  L.plant('split under the approval limit', ['approval_avoidance'], ids)
}

/** A shell vendor: first seen mid-register, one round material payment on a weekend. */
export function ghostVendor(L: Ledger, names: Names, cat: string) {
  let d = L.o.start + 60 + Math.floor(L.r() * Math.max(30, L.o.end - L.o.start - 90))
  while (dow(d) !== 6) d++
  if (d > L.o.end) d -= 7
  const id = L.add(d, names.company(), (12 + Math.floor(L.r() * 38)) * 1000, cat, { desc: 'Advisory services' })
  L.plant('shell vendor, round weekend payment', ['new_vendor_risk', 'large_amount'], [id])
}

/** A new vendor paid four times in five days (kickback or fictitious invoices). */
export function newVendorBurst(L: Ledger, names: Names, cat: string, base: number) {
  const v = names.company()
  const d0 = L.wd(L.o.start + 60 + Math.floor(L.r() * Math.max(30, L.o.end - L.o.start - 90)))
  const ids = [0, 1, 3, 4].map(o => L.add(L.wd(d0 + o), v, base * (0.7 + L.r() * 0.6), cat))
  L.plant('new vendor paid four times in a week', ['high_frequency'], ids)
}

/** A vendor overbilling: one invoice many times its usual size. */
export function priceSpike(L: Ledger, ids: Ids, factor: number) {
  const src = L.row(L.pick(ids))
  const med = median(amounts(L, ids))
  const id = L.add(L.wd(L.dayOfRow(src.id) + 9), src.vendor, Math.max(med * factor, med + 2500) + 0.37, src.category, { account: src.account })
  L.plant(`invoice ${factor}× the vendor's usual`, ['outlier', 'large_amount'], [id])
}

/** A steady vendor's payment booked to the wrong account. */
export function miscode(L: Ledger, ids: Ids, wrong: string) {
  const t = L.row(L.pick(ids.slice(2)))
  t.category = wrong
  L.plant('coded to the wrong category', ['category_mismatch'], [t.id])
}

/** A payment labelled with the previous period: posted into a period before it happened. */
export function wrongPeriod(L: Ledger, ids: Ids) {
  const t = L.row(L.pick(ids.slice(1)))
  const d = L.dayOfRow(t.id)
  const shifted = L.period(d - 40)
  if (!shifted || shifted === t.period) return
  t.period = shifted
  L.plant('posted to an earlier period', ['period_mismatch'], [t.id])
}

/** Payments with no payee. */
export function missingPayee(L: Ledger, n: number) {
  const ids: string[] = []
  for (let i = 0; i < n; i++) ids.push(L.add(L.wd(L.o.start + Math.floor(L.r() * (L.o.end - L.o.start))), '', 800 + L.r() * 9000, 'Uncategorized', { desc: 'Wire transfer' }))
  L.plant('payments with no payee', ['missing_vendor'], ids)
}

/** A one-off vendor paid far above anything else in a small-ticket category. */
export function oneOffInSmallCategory(L: Ledger, names: Names, cat: string, catTop: number) {
  const v = names.company()
  L.add(L.wd(L.o.start + 20 + Math.floor(L.r() * 60)), v, catTop * 0.4, cat)
  const id = L.add(L.wd(L.o.end - 20 - Math.floor(L.r() * 60)), v, catTop * (12 + L.r() * 8) + 0.5, cat)
  L.plant('far above anything in its category', ['large_amount', 'outlier'], [id])
}
