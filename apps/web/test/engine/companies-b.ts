/**
 * Company profiles, part two: from a nonprofit to a 250,000-row enterprise.
 */
import { detectColumns, rowsToTransactions, type RawRow } from '../../src/lib/transactionParser'
import type { Scenario } from './fixtures'
import { Ledger, Names, rng, dayOf, monthly, monthlyVar, every, irregular, daily, installments, splitCoded } from './ledger'
import * as P from './plants'

const YEAR = { start: dayOf(2025, 10, 1), end: dayOf(2026, 9, 30) }

// 10 ────────────────────────────────────────────────────────────────────────
export function hospital(seed: number): Scenario {
  const L = new Ledger(rng(seed), { ...YEAR, periods: 'calendar', desc: 'invoice' })
  const N = new Names(L)
  const depts = ['ED', 'ICU', 'Surgery', 'Radiology', 'Lab', 'Pharmacy', 'Wards']
  const dept = () => L.pick(depts)
  irregular(L, 'Medline Industries', 260, () => L.pick([42.18, 86.4, 129.6, 245, 512.75, 1180, 2360]), 'Medical Supplies', { account: dept })
  irregular(L, 'Cardinal Health', 180, () => L.pick([64.2, 128.4, 388.9, 777.8, 1555.6]), 'Medical Supplies', { account: dept })
  const pharma = irregular(L, 'McKesson Pharma', 90, () => L.around(3800, 0.7), 'Pharmaceuticals', { account: () => 'Pharmacy' })
  for (const a of ['AMN Healthcare', 'Cross Country Nurses', 'Aya Staffing']) every(L, a, 7, () => L.around(68_000, 0.15), 'Agency Staffing', { offset: 1 })
  monthly(L, 'GE Healthcare Finance', 48_200, 'Equipment Lease', 1, { desc: 'MRI lease' })
  monthly(L, 'Siemens Healthineers', 31_750, 'Equipment Lease', 1, { desc: 'CT lease' })
  monthlyVar(L, 'Duke Energy', 240_000, 0.15, 'Utilities', 14)
  const services: string[][] = []
  for (let i = 0; i < 60; i++) services.push(irregular(L, N.company(), 1 + L.r() * 4, () => L.around(3500, 0.7), L.pick(['Contract Services', 'Maintenance', 'IT Services', 'Food Service'])))
  every(L, 'Workday Payroll', 14, () => L.around(6_200_000, 0.02), 'Payroll', { offset: 5 })
  P.dupInvoice(L, pharma, 4)
  P.dupInvoice(L, services[3], 20)
  P.splitUnderLimit(L, L.row(services[8][0]).vendor, L.row(services[8][0]).category)
  P.priceSpike(L, services[12], 8)
  P.wrongPeriod(L, pharma)
  P.miscode(L, pharma, 'Food Service')
  P.ghostVendor(L, N, 'Contract Services')
  P.newVendorBurst(L, N, 'IT Services', 3100)
  P.missingPayee(L, 2)
  return { name: 'Hospital', txs: L.txs, planted: L.planted }
}

// 11 ────────────────────────────────────────────────────────────────────────
export function nonprofit(seed: number): Scenario {
  const L = new Ledger(rng(seed), { ...YEAR, periods: 'fiscal7', desc: 'invoice' })
  const N = new Names(L)
  for (let i = 0; i < 14; i++) installments(L, N.company(), (2 + Math.floor(L.r() * 18)) * 10_000, 4, 91, YEAR.start + Math.floor(L.r() * 60), 'Grants', 'Grant tranche')
  for (let i = 0; i < 10; i++) L.add(L.wd(YEAR.start + Math.floor(L.r() * 350)), N.company(), (5 + Math.floor(L.r() * 20)) * 1000, 'Grants', { desc: 'Program grant' })
  monthly(L, 'Civic Center Offices', 7800, 'Rent', 1)
  every(L, 'Gusto Payroll', 14, () => L.around(61_000, 0.03), 'Payroll', { offset: 3 })
  const events = irregular(L, 'Grand Ballroom Events', 0.5, () => L.around(9000, 0.4), 'Events')
  const printing = irregular(L, 'Summit Print Co.', 2, () => L.around(1400, 0.4), 'Communications')
  for (const [v, a, d] of [['Salesforce Nonprofit', 980, 5], ['Mailchimp', 299, 9], ['QuickBooks', 85, 2], ['Zoom', 149.9, 12]] as const) monthly(L, v, a, 'Software', d)
  irregular(L, 'Staples', 3, () => L.around(160, 0.5), 'Office Supplies')
  P.dupInvoice(L, printing, 8)
  P.priceSpike(L, printing, 9)
  P.wrongPeriod(L, printing)
  P.ghostVendor(L, N, 'Consulting')
  P.missingPayee(L, 1)
  void events
  return { name: 'Nonprofit (grants, fiscal July)', txs: L.txs, planted: L.planted }
}

// 12 ────────────────────────────────────────────────────────────────────────
export function lawFirm(seed: number): Scenario {
  const L = new Ledger(rng(seed), { ...YEAR, periods: 'calendar', desc: 'invoice' })
  const N = new Names(L)
  const matter = () => `M-${2000 + Math.floor(L.r() * 140)}`
  const experts = Array.from({ length: 12 }, () => N.person())
  for (const e of experts) irregular(L, e, 0.5, () => L.pick([2500, 5000, 7500, 4000]), 'Expert Fees', { account: matter })
  irregular(L, 'County Clerk', 40, () => L.pick([45, 90, 350, 435]), 'Court Fees', { account: matter })
  const courier = irregular(L, 'Metro Legal Couriers', 60, () => L.around(58, 0.4), 'Disbursements', { account: matter })
  const deps = irregular(L, 'Esquire Deposition', 8, () => L.around(1850, 0.5), 'Disbursements', { account: matter })
  for (const p of Array.from({ length: 6 }, () => N.person())) monthly(L, p, (25 + Math.floor(L.r() * 20)) * 1000, 'Partner Draws', 15)
  monthly(L, 'Tower One Properties', 86_000, 'Rent', 1)
  for (const [v, a] of [['Westlaw', 6240], ['Clio', 1890], ['iManage', 3310]] as const) monthly(L, v, a, 'Software', 4)
  every(L, 'ADP Payroll', 14, () => L.around(410_000, 0.03), 'Payroll', { offset: 2 })
  P.dupInvoice(L, deps, 5)
  P.dupInvoice(L, courier, 1)
  irregular(L, 'Veritext Legal Solutions', 4, () => L.around(1600, 0.4), 'Disbursements', { account: matter })
  P.splitUnderLimit(L, 'Veritext Legal Solutions', 'Disbursements')
  P.priceSpike(L, deps, 10)
  P.miscode(L, deps, 'Partner Draws')
  P.ghostVendor(L, N, 'Expert Fees')
  P.newVendorBurst(L, N, 'Disbursements', 1700)
  return { name: 'Law firm', txs: L.txs, planted: L.planted }
}

// 13 ────────────────────────────────────────────────────────────────────────
export function ecommerce(seed: number): Scenario {
  const L = new Ledger(rng(seed), { ...YEAR, periods: 'none', desc: 'bank' })
  const N = new Names(L)
  daily(L, 'Meta Ads', 1, () => L.around(2400, 0.4), 'Advertising', { weekend: true })
  daily(L, 'Google Ads', 1, () => L.around(1600, 0.4), 'Advertising', { weekend: true })
  daily(L, 'Shopify Payments', 1, () => L.around(12_000, 0.4), 'Revenue', { weekend: true }).forEach(id => { L.row(id).direction = 'credit' })
  daily(L, 'Shopify Refunds', 0.8, () => L.around(90, 0.6), 'Refunds', { weekend: true, perDay: () => 1 + Math.floor(L.r() * 4) }).forEach(id => { L.row(id).direction = 'credit' })
  every(L, 'ShipBob', 7, () => L.around(18_000, 0.25), 'Fulfillment', { offset: 3 })
  const factory = N.company()
  for (let i = 0; i < 6; i++) {
    const total = (6 + Math.floor(L.r() * 10)) * 10_000
    const d = YEAR.start + i * 55 + Math.floor(L.r() * 10)
    L.add(L.wd(d), factory, total * 0.3, 'Inventory', { desc: 'PO deposit 30%' })
    L.add(L.wd(d + 45), factory, total * 0.7, 'Inventory', { desc: 'PO balance 70%' })
  }
  for (const [v, a, d] of [['Klaviyo', 2300, 3], ['Gorgias', 900, 7], ['Recharge', 499, 9], ['Triple Whale', 1290, 12]] as const) monthly(L, v, a, 'Software', d)
  every(L, 'Gusto Payroll', 14, () => L.around(96_000, 0.03), 'Payroll', { offset: 4 })
  const agency = irregular(L, 'Creative Fuel Studio', 1.5, () => L.around(6500, 0.4), 'Creative')
  P.dupSameDay(L, agency)
  P.priceSpike(L, agency, 8)
  P.ghostVendor(L, N, 'Creative')
  P.newVendorBurst(L, N, 'Creative', 3800)
  P.missingPayee(L, 1)
  const rows: RawRow[] = L.txs.map(t => {
    const [y, m, d] = t.date.split('-')
    return { Date: `${d}/${m}/${y}`, Payee: t.vendor, Description: t.description, Amount: (t.direction === 'credit' ? t.amount : -t.amount).toFixed(2) }
  })
  return { name: 'E-commerce brand (bank feed, day-first dates)', txs: rowsToTransactions(rows, detectColumns(['Date', 'Payee', 'Description', 'Amount'])), planted: L.planted }
}

// 14 ────────────────────────────────────────────────────────────────────────
export function propertyManager(seed: number): Scenario {
  const L = new Ledger(rng(seed), { ...YEAR, periods: 'calendar', desc: 'invoice' })
  const N = new Names(L)
  const props = Array.from({ length: 45 }, (_, i) => `PROP-${200 + i}`)
  for (const p of props) {
    monthly(L, 'Lakeside HOA', 385, 'HOA Dues', 1, { account: p })
    monthlyVar(L, 'City Water Utility', 260, 0.3, 'Utilities', 18, p)
    monthlyVar(L, 'PG&E', 410, 0.35, 'Utilities', 22, p)
    monthly(L, 'Evergreen Landscaping', 240, 'Landscaping', 12, { account: p })
  }
  const contractors: string[][] = []
  for (let i = 0; i < 25; i++) contractors.push(irregular(L, N.company(), 3, () => L.around(1200, 0.7), L.pick(['Repairs', 'Turnover', 'Plumbing', 'Electrical']), { account: () => L.pick(props) }))
  every(L, 'State Farm', 91, () => 84_300, 'Insurance', { offset: 30 })
  every(L, 'Gusto Payroll', 14, () => L.around(88_000, 0.03), 'Payroll', { offset: 3 })
  P.dupInvoice(L, contractors[2], 7)
  P.dupInvoice(L, contractors[9], 0)
  P.extraInCycle(L, L.byVendor.get('Lakeside HOA')!.filter(id => L.row(id).account === 'PROP-210'))
  P.splitUnderLimit(L, L.row(contractors[4][0]).vendor, 'Repairs')
  P.priceSpike(L, contractors[11], 9)
  P.miscode(L, L.byVendor.get('Evergreen Landscaping')!, 'Plumbing')
  P.ghostVendor(L, N, 'Repairs')
  P.newVendorBurst(L, N, 'Turnover', 2100)
  return { name: 'Property manager, 45 properties', txs: L.txs, planted: L.planted }
}

// 15 ────────────────────────────────────────────────────────────────────────
export function farm(seed: number): Scenario {
  const L = new Ledger(rng(seed), { ...YEAR, periods: 'none', desc: 'memo' })
  const N = new Names(L)
  // Seasonal by nature: spring inputs dwarf the rest of the year.
  const inputs: string[][] = []
  for (const v of ['Nutrien Ag Solutions', 'CHS Agronomy', 'Pioneer Seeds']) {
    const ids = irregular(L, v, 1.5, () => L.around(1800, 0.5), 'Crop Inputs')
    for (let k = 0; k < 4; k++) ids.push(L.add(L.wd(dayOf(2026, 3, 10) + k * 9 + Math.floor(L.r() * 4)), v, L.around(26_000, 0.3), 'Crop Inputs'))
    inputs.push(ids)
  }
  irregular(L, 'Farmers Co-op Fuel', 6, () => L.around(1400, 0.5), 'Fuel', { weekend: true })
  monthly(L, 'John Deere Financial', 8_960, 'Equipment', 15)
  const repairs = irregular(L, 'Valley Implement', 1.5, () => L.around(1300, 0.6), 'Repairs')
  every(L, 'Seasonal labor payroll', 14, () => L.around(18_000, 0.2), 'Payroll', { offset: 4 })
  monthlyVar(L, 'Rural Electric Co-op', 2400, 0.4, 'Utilities', 20)
  P.dupSameDay(L, repairs)
  P.priceSpike(L, repairs, 12)
  P.ghostVendor(L, N, 'Crop Inputs')
  P.missingPayee(L, 1)
  return { name: 'Farm (seasonal spring inputs)', txs: L.txs, planted: L.planted }
}

// 16 ────────────────────────────────────────────────────────────────────────
export function universityPCard(seed: number): Scenario {
  const L = new Ledger(rng(seed), { ...YEAR, periods: 'fiscal7', desc: 'memo' })
  const N = new Names(L)
  const depts = Array.from({ length: 30 }, (_, i) => `DEPT-${300 + i}`)
  const merchants = Array.from({ length: 400 }, () => N.company())
  for (const m of merchants) irregular(L, m, 0.3 + L.r() * 5, () => L.around(260, 0.9), L.pick(['Lab Supplies', 'Office Supplies', 'Travel', 'Meals', 'Equipment', 'Books']), { account: () => L.pick(depts) })
  for (const big of ['Fisher Scientific', 'VWR International', 'Amazon Business', 'Dell Technologies']) irregular(L, big, 120, () => L.around(420, 0.9), 'Lab Supplies', { account: () => L.pick(depts) })
  const fisher = L.byVendor.get('Fisher Scientific')!
  // Card limit is $5,000 here: a split purchase sits under that, not the $10,000 default.
  for (let k = 0; k < 2; k++) {
    const d0 = L.wd(YEAR.start + 100 + k * 120)
    const ids = [0, 1, 2].map(o => L.add(L.wd(d0 + o), 'Fisher Scientific', 4600 + L.r() * 390, 'Lab Supplies', { account: 'DEPT-312' }))
    L.plant('split under the $5,000 card limit', ['approval_avoidance'], ids)
  }
  P.dupSameDay(L, fisher)
  P.priceSpike(L, L.byVendor.get('Dell Technologies')!, 15)
  P.ghostVendor(L, N, 'Equipment')
  P.newVendorBurst(L, N, 'Lab Supplies', 1900)
  return { name: 'University P-card program', txs: L.txs, planted: L.planted }
}

// 17 ────────────────────────────────────────────────────────────────────────
export function enterprise(seed: number): Scenario {
  const L = new Ledger(rng(seed), { ...YEAR, periods: 'calendar', desc: 'invoice' })
  const N = new Names(L)
  const entities = ['US01', 'US02', 'UK01', 'DE01']
  const ent = () => L.pick(entities)
  const big: string[][] = []
  for (let i = 0; i < 40; i++) big.push(irregular(L, N.company(), 12 + L.r() * 30, () => L.around(18_000, 0.8), L.pick(['Raw Materials', 'Components', 'Logistics', 'IT Services', 'Professional Fees']), { account: ent }))
  const mid: string[][] = []
  for (let i = 0; i < 1200; i++) mid.push(irregular(L, N.company(), 0.5 + L.r() * 8, () => L.around(1400, 0.8), L.pick(['Office Supplies', 'Facilities', 'Marketing', 'Travel', 'Maintenance', 'IT Services', 'Freight', 'Meals', 'Training']), { account: ent }))
  for (let i = 0; i < 3000; i++) L.add(L.wd(YEAR.start + Math.floor(L.r() * 360)), N.company(), L.around(600, 1), L.pick(['Meals', 'Travel', 'Office Supplies', 'Training']), { account: ent() })
  for (let i = 0; i < 80; i++) monthly(L, N.company(), L.money(L.around(9000, 0.9)), L.pick(['Rent', 'Leases', 'Software', 'Facilities']), 1 + Math.floor(L.r() * 27), { account: ent() })
  for (const e of entities) every(L, 'Workday Payroll', 14, () => L.around(3_100_000, 0.02), 'Payroll', { account: e, offset: 5 })
  daily(L, 'Amex Corporate', 1, () => L.around(310, 0.8), 'Travel', { weekend: true, account: ent, perDay: () => 20 + Math.floor(L.r() * 30) })
  for (let i = 0; i < 120; i++) splitCoded(L, L.pick(['Deloitte', 'Accenture', 'McKinsey']), 20_000 + Math.floor(L.r() * 40) * 1000, YEAR.start + Math.floor(L.r() * 360), 'Professional Fees', [ent(), 'CORP'] as [string, string])
  P.dupInvoice(L, big[0], 6)
  P.dupInvoice(L, big[7], 18)
  P.dupInvoice(L, mid[40], 2)
  P.dupVendorVariant(L, big[3], L.row(big[3][0]).vendor.toUpperCase())
  P.extraInCycle(L, L.byVendor.get(L.row(L.txs.find(t => t.category === 'Rent')!.id).vendor)!)
  P.splitUnderLimit(L, L.row(mid[12][0]).vendor, L.row(mid[12][0]).category)
  P.splitUnderLimit(L, L.row(mid[300][0]).vendor, L.row(mid[300][0]).category)
  P.priceSpike(L, big[9], 7)
  P.priceSpike(L, mid.find(ids => ids.length >= 30)!, 12)
  P.wrongPeriod(L, big[2])
  P.miscode(L, mid.find(ids => ids.length >= 40)!, 'Raw Materials')
  P.ghostVendor(L, N, 'Professional Fees')
  P.ghostVendor(L, N, 'IT Services')
  P.newVendorBurst(L, N, 'IT Services', 2900)
  P.missingPayee(L, 4)
  return { name: 'Enterprise, multi-entity', txs: L.txs, planted: L.planted }
}
