/**
 * Company profiles, part one: from a single bakery to a 40-store retail chain.
 * Each spends the way that kind of business really spends and exports its
 * data the way its systems really do, then carries a set of planted problems.
 */
import { detectColumns, rowsToTransactions, type RawRow } from '../../src/lib/transactionParser'
import type { Scenario } from './fixtures'
import { Ledger, Names, rng, dayOf, isoOf, monthly, monthlyVar, every, onWeekdays, irregular, daily, project, installments, splitCoded } from './ledger'
import * as P from './plants'

const YEAR = { start: dayOf(2025, 10, 1), end: dayOf(2026, 9, 30) }

/** Send a bank-style ledger through the real parser: signed amounts, payee and description columns. */
function throughParser(L: Ledger): Scenario['txs'] {
  const rows: RawRow[] = L.txs.map(t => {
    const [y, m, d] = t.date.split('-')
    const signed = t.direction === 'credit' ? t.amount : -t.amount
    return { Date: `${m}/${d}/${y}`, Payee: t.vendor, Description: t.description, Amount: signed.toLocaleString('en-US', { minimumFractionDigits: 2 }) }
  })
  return rowsToTransactions(rows, detectColumns(['Date', 'Payee', 'Description', 'Amount']))
}

// 1 ─────────────────────────────────────────────────────────────────────────
export function bakery(seed: number): Scenario {
  const L = new Ledger(rng(seed), { ...YEAR, periods: 'none', desc: 'bank' })
  const N = new Names(L)
  const flour  = onWeekdays(L, 'Valley Flour Mill', [2, 5], () => L.around(240, 0.2), 'Ingredients')
  onWeekdays(L, 'Clover Dairy', [1, 3, 6], () => L.around(160, 0.25), 'Ingredients')
  every(L, 'Greenleaf Produce', 7, () => L.around(210, 0.3), 'Ingredients', { weekend: true })
  every(L, 'Ridgeback Coffee Roasters', 7, () => 412.8, 'Ingredients')
  const rent = monthly(L, 'Harbor Lane Properties', 6500, 'Rent', 1)
  monthlyVar(L, 'City Power & Light', 1450, 0.25, 'Utilities', 12)
  monthlyVar(L, 'Metro Water', 310, 0.2, 'Utilities', 18)
  every(L, 'Gusto Payroll', 14, () => L.around(10_200, 0.06), 'Payroll', { offset: 3 })
  const costco = irregular(L, 'Costco Wholesale', 6, () => L.around(260, 0.45), 'Supplies', { weekend: true })
  daily(L, 'Square Fees', 0.95, () => L.around(38, 0.3), 'Bank Fees', { weekend: true })
  monthly(L, 'Hartwell Insurance', 412.5, 'Insurance', 20)
  const repair = irregular(L, 'Coldline Refrigeration', 1, () => L.around(380, 0.35), 'Repairs')
  irregular(L, 'Meta Ads', 3, () => L.around(150, 0.4), 'Marketing', { weekend: true })
  daily(L, 'Square Deposit', 0.97, () => L.around(1900, 0.3), 'Revenue', { weekend: true }).forEach(id => { L.row(id).direction = 'credit' })
  P.dupSameDay(L, costco)
  P.dupSameDay(L, flour)
  P.extraInCycle(L, rent)
  P.priceSpike(L, repair, 9)
  P.ghostVendor(L, N, 'Supplies')
  P.missingPayee(L, 1)
  return { name: 'Bakery café (bank feed)', txs: throughParser(L), planted: L.planted }
}

// 2 ─────────────────────────────────────────────────────────────────────────
export function designAgency(seed: number): Scenario {
  const L = new Ledger(rng(seed), { ...YEAR, periods: 'none', desc: 'invoice' })
  const N = new Names(L)
  const freelancers = Array.from({ length: 8 }, () => N.person())
  for (const f of freelancers) {
    monthly(L, f, (3 + Math.floor(L.r() * 4)) * 1000, 'Contractors', 1 + Math.floor(L.r() * 4))
    irregular(L, f, 0.6, () => L.pick([1500, 2500, 1750, 3000]), 'Contractors')
  }
  for (const [v, a, d] of [['Adobe', 899.88, 3], ['Figma', 540, 7], ['Google Workspace', 432, 1], ['Slack Technologies', 350, 12], ['Notion Labs', 180, 15], ['Dropbox', 240, 9], ['Webflow', 96, 21]] as const) monthly(L, v, a, 'Software', d)
  const rent = monthly(L, 'Mercer Street Holdings', 14_500, 'Rent', 1)
  every(L, 'Hartwell Insurance', 91, () => 2340, 'Insurance', { offset: 10 })
  every(L, 'Gusto Payroll', 14, () => L.around(40_000, 0.03), 'Payroll', { offset: 4 })
  const amazon = irregular(L, 'Amazon Business', 4, () => L.around(190, 0.6), 'Office Supplies')
  irregular(L, 'Uber', 6, () => L.around(34, 0.35), 'Travel')
  for (let i = 0; i < 40; i++) L.add(L.wd(YEAR.start + Math.floor(L.r() * 360)), N.company(), L.around(120, 0.5), 'Meals')
  const printer = irregular(L, 'Brightline Print Studio', 1.5, () => L.around(1800, 0.5), 'Production')
  P.dupInvoice(L, printer, 6)
  P.dupInvoice(L, L.byVendor.get(freelancers[2])!, 12)
  P.extraInCycle(L, rent)
  P.splitUnderLimit(L, 'Brightline Print Studio', 'Production')
  P.ghostVendor(L, N, 'Consulting')
  P.miscode(L, L.byVendor.get('Adobe')!, 'Meals')
  P.priceSpike(L, amazon, 12)
  return { name: 'Design agency, 15 staff', txs: L.txs, planted: L.planted }
}

// 3 ─────────────────────────────────────────────────────────────────────────
export function dentalClinic(seed: number): Scenario {
  const L = new Ledger(rng(seed), { ...YEAR, periods: 'calendar', desc: 'memo' })
  const N = new Names(L)
  irregular(L, 'Crown Dental Lab', 20, () => L.pick([189, 245, 389, 420, 650]), 'Lab Fees')
  const schein = irregular(L, 'Henry Schein', 8, () => L.around(640, 0.5), 'Clinical Supplies')
  const patterson = irregular(L, 'Patterson Dental', 3, () => L.around(1100, 0.4), 'Clinical Supplies')
  monthly(L, 'Oakridge Medical Plaza', 9800, 'Rent', 1)
  const lease = monthly(L, 'Planmeca Financial', 2875.4, 'Equipment Lease', 15)
  every(L, 'ADP Payroll', 14, () => L.around(52_000, 0.04), 'Payroll', { offset: 2 })
  monthlyVar(L, 'City Power & Light', 1900, 0.2, 'Utilities', 12)
  monthly(L, 'Brightsmile Marketing', 3500, 'Marketing', 5)
  every(L, 'MedPro Malpractice', 91, () => 6840, 'Insurance', { offset: 25 })
  monthly(L, 'Stericycle', 289, 'Waste Disposal', 20)
  every(L, 'Cintas Uniforms', 7, () => 86.4, 'Uniforms')
  onWeekdays(L, 'Sparkle Cleaning Co.', [1, 4], () => 140, 'Cleaning')
  P.dupSameDay(L, schein)
  P.extraInCycle(L, lease)
  P.priceSpike(L, patterson, 11)
  P.wrongPeriod(L, schein)
  P.missingPayee(L, 2)
  P.ghostVendor(L, N, 'Clinical Supplies')
  return { name: 'Dental clinic', txs: L.txs, planted: L.planted }
}

// 4 ─────────────────────────────────────────────────────────────────────────
export function saasStartup(seed: number): Scenario {
  const L = new Ledger(rng(seed), { ...YEAR, periods: 'none', desc: 'invoice' })
  const N = new Names(L)
  monthlyVar(L, 'Amazon Web Services', 42_000, 0.1, 'Cloud', 3)
  monthlyVar(L, 'Google Cloud', 9_500, 0.15, 'Cloud', 4)
  daily(L, 'OpenAI', 0.9, () => L.around(160, 0.5), 'Cloud', { weekend: true })
  for (let i = 0; i < 12; i++) monthly(L, 'Deel', (4 + Math.floor(L.r() * 6)) * 1000, 'Contractors', 28, { desc: `Contractor ${N.person()}` })
  const recruiters = ['Talentbridge Search', 'Northstar Recruiting', 'HireRight Partners LLC']
  for (const r of recruiters) irregular(L, r, 0.4, () => L.pick([18_000, 22_500, 25_000, 30_000]), 'Recruiting')
  for (let i = 0; i < 25; i++) monthly(L, N.company(), L.money(L.around(450, 0.9)), 'Software', 1 + Math.floor(L.r() * 27))
  monthly(L, 'WeWork', 28_500, 'Rent', 1)
  every(L, 'Rippling Payroll', 14, () => L.around(420_000, 0.02), 'Payroll', { offset: 5 })
  const travel = irregular(L, 'Navan Travel', 12, () => L.around(640, 0.5), 'Travel')
  const legal = irregular(L, 'Cooley LLP', 1.2, () => L.around(14_000, 0.5), 'Legal')
  P.dupInvoice(L, legal, 9)
  P.dupInvoice(L, travel, 3)
  P.dupVendorVariant(L, L.byVendor.get('HireRight Partners LLC')!, 'Hire Right Partners')
  P.splitUnderLimit(L, 'Navan Travel', 'Travel')
  P.newVendorBurst(L, N, 'Software', 2200)
  P.ghostVendor(L, N, 'Consulting')
  P.priceSpike(L, L.byVendor.get('Google Cloud')!, 7)
  return { name: 'SaaS startup, 80 staff', txs: L.txs, planted: L.planted }
}

// 5 ─────────────────────────────────────────────────────────────────────────
export function construction(seed: number): Scenario {
  const L = new Ledger(rng(seed), { ...YEAR, periods: 'calendar', desc: 'invoice' })
  const N = new Names(L)
  for (let i = 0; i < 25; i++) {
    const sub = N.company()
    project(L, sub, 80_000 + L.r() * 800_000, 4 + Math.floor(L.r() * 7), YEAR.start + Math.floor(L.r() * 200), 'Subcontractors', `JOB-${100 + (i % 8)}`)
  }
  const materials: string[][] = []
  for (const v of ['Ferguson Supply', 'ABC Supply Co.', 'Builders FirstSource', 'Graybar Electric', 'Sherwin-Williams', 'Fastenal']) {
    materials.push(irregular(L, v, 8, () => L.around(4200, 0.8), 'Materials', { account: () => `JOB-${100 + Math.floor(L.r() * 8)}` }))
  }
  for (const [m, a] of [['Excavator 320', 6850], ['Loader 950', 5400], ['Lift 1932', 1290], ['Compactor', 2210]] as const) monthly(L, 'United Rentals', a, 'Equipment Rental', 6, { desc: `Rental ${m}` })
  daily(L, 'WEX Fleet Fuel', 0.9, () => L.around(240, 0.4), 'Fuel', { weekend: true, perDay: () => 2 + Math.floor(L.r() * 4) })
  installments(L, 'Caterpillar Financial', 186_000, 3, 30, YEAR.start + 95, 'Equipment', 'Deposit')
  every(L, 'Paychex', 7, () => L.around(185_000, 0.05), 'Payroll', { offset: 4 })
  monthly(L, 'Travelers Insurance', 18_400, 'Insurance', 10)
  irregular(L, 'City Permits Office', 2, () => L.pick([500, 1000, 2500, 750]), 'Permits')
  P.dupInvoice(L, materials[0], 11)
  P.dupInvoice(L, materials[3], 2)
  P.splitUnderLimit(L, 'Graybar Electric', 'Materials')
  P.priceSpike(L, materials[5], 10)
  P.wrongPeriod(L, materials[1])
  P.miscode(L, L.byVendor.get('WEX Fleet Fuel')!, 'Subcontractors')
  P.ghostVendor(L, N, 'Subcontractors')
  P.missingPayee(L, 1)
  return { name: 'Construction contractor', txs: L.txs, planted: L.planted }
}

// 6 ─────────────────────────────────────────────────────────────────────────
export function restaurantGroup(seed: number): Scenario {
  const L = new Ledger(rng(seed), { ...YEAR, periods: 'calendar', desc: 'invoice' })
  const N = new Names(L)
  const stores = ['Store 1', 'Store 2', 'Store 3', 'Store 4', 'Store 5']
  let sysco: string[] = [], repairs: string[] = []
  const rents: string[][] = []
  for (const s of stores) {
    sysco = sysco.concat(onWeekdays(L, 'Sysco', [1, 3, 5], () => L.around(2400, 0.3), 'Food Cost', s))
    onWeekdays(L, 'Fresh Farms Produce', [2, 6], () => L.around(640, 0.3), 'Food Cost', s)
    every(L, 'Southern Glazer’s', 7, () => L.around(1800, 0.35), 'Beverage', { account: s, offset: 2 })
    onWeekdays(L, 'Bluebird Bakery Supply', [0, 1, 2, 3, 4, 5, 6], () => 142.5, 'Food Cost', s)
    every(L, 'Aramark Linen', 7, () => 96, 'Linen', { account: s, offset: 1 })
    rents.push(monthly(L, `${N.company()}`, 9000 + Math.floor(L.r() * 9) * 1000, 'Rent', 1, { account: s }))
    monthlyVar(L, 'Metro Electric', 3200, 0.25, 'Utilities', 14, s)
    monthly(L, 'Toast POS', 189, 'Software', 5, { account: s })
    monthly(L, 'Orkin Pest Control', 145, 'Maintenance', 9, { account: s })
    repairs = repairs.concat(irregular(L, 'Hobart Service', 0.8, () => L.around(620, 0.4), 'Repairs', { account: () => s }))
  }
  every(L, 'ADP Payroll', 14, () => L.around(165_000, 0.04), 'Payroll', { offset: 3 })
  P.dupInvoice(L, sysco, 2)
  P.dupInvoice(L, sysco, 9)
  P.extraInCycle(L, rents[2])
  P.priceSpike(L, repairs, 12)
  P.ghostVendor(L, N, 'Maintenance')
  P.newVendorBurst(L, N, 'Food Cost', 1400)
  P.miscode(L, L.byVendor.get('Hobart Service')!, 'Food Cost')
  return { name: 'Restaurant group, 5 sites', txs: L.txs, planted: L.planted }
}

// 7 ─────────────────────────────────────────────────────────────────────────
export function manufacturer(seed: number): Scenario {
  const L = new Ledger(rng(seed), { ...YEAR, periods: 'fiscal7', desc: 'invoice' })
  const N = new Names(L)
  const raw: string[][] = []
  for (let i = 0; i < 8; i++) raw.push(irregular(L, N.company(), 6, () => L.around(42_000, 0.6), 'Raw Materials', { account: () => L.pick(['CC-100', 'CC-200', 'CC-300']) }))
  const freight: string[][] = []
  for (let i = 0; i < 12; i++) freight.push(irregular(L, N.company(), 9, () => L.around(1800, 0.5), 'Freight'))
  monthlyVar(L, 'Consolidated Edison', 68_000, 0.2, 'Utilities', 12)
  monthlyVar(L, 'National Grid Gas', 21_000, 0.35, 'Utilities', 16)
  const maint = irregular(L, 'Precision Millwrights', 3, () => L.around(5200, 0.5), 'Maintenance')
  irregular(L, 'Grainger', 30, () => L.pick([48.6, 112.4, 236.8, 89.95, 412, 1240.5, 18.75]), 'MRO')
  every(L, 'ADP Payroll', 14, () => L.around(980_000, 0.02), 'Payroll', { offset: 6 })
  monthly(L, 'Blue Cross Blue Shield', 214_000, 'Benefits', 1)
  every(L, 'Zurich Insurance', 91, () => 96_500, 'Insurance', { offset: 40 })
  monthly(L, 'Toyota Forklift Leasing', 12_340, 'Leases', 10)
  for (let i = 0; i < 40; i++) splitCoded(L, L.pick(['Kestrel Consulting', 'Ironwood Engineering', 'Marlow Testing Labs']), 8000 + Math.floor(L.r() * 30) * 500, YEAR.start + Math.floor(L.r() * 360), 'Professional Fees', ['CC-100', 'CC-200'])
  P.dupInvoice(L, raw[0], 13)
  P.dupInvoice(L, freight[4], 1)
  P.dupVendorVariant(L, raw[2], L.row(raw[2][0]).vendor.toUpperCase().replace(/ (INC\.|LLC|CO\.|LTD|CORP\.)$/, ''))
  P.splitUnderLimit(L, L.row(freight[7][0]).vendor, 'Freight')
  P.priceSpike(L, maint, 9)
  P.wrongPeriod(L, freight[2])
  P.miscode(L, freight[5], 'Raw Materials')
  P.ghostVendor(L, N, 'Consulting')
  P.missingPayee(L, 3)
  return { name: 'Manufacturer (GL detail, fiscal July)', txs: L.txs, planted: L.planted }
}

// 8 ─────────────────────────────────────────────────────────────────────────
export function logistics(seed: number): Scenario {
  const L = new Ledger(rng(seed), { ...YEAR, periods: 'none', desc: 'memo' })
  const N = new Names(L)
  const truck = () => `TRK-${100 + Math.floor(L.r() * 60)}`
  for (const v of ['Pilot Flying J', 'Love’s Travel Stops', 'TA Petro']) daily(L, v, 1, () => L.around(560, 0.35), 'Fuel', { weekend: true, account: truck, perDay: () => 8 + Math.floor(L.r() * 18) })
  daily(L, 'E-ZPass', 1, () => L.around(42, 0.6), 'Tolls', { weekend: true, account: truck, perDay: () => 5 + Math.floor(L.r() * 10) })
  for (let t = 0; t < 60; t++) monthly(L, 'Ryder Leasing', 2450, 'Truck Leases', 1, { account: `TRK-${100 + t}`, desc: 'Monthly lease' })
  const repairs = irregular(L, 'Rush Truck Centers', 14, () => L.around(1450, 0.6), 'Repairs', { account: truck })
  irregular(L, 'Goodyear Commercial Tire', 6, () => L.pick([489, 978, 1956, 512.4]), 'Tires', { account: truck })
  monthly(L, 'Great West Casualty', 61_200, 'Insurance', 15)
  every(L, 'Paychex', 7, () => L.around(212_000, 0.04), 'Payroll', { offset: 4 })
  monthly(L, 'Samsara', 2790, 'Software', 3)
  P.dupSameDay(L, repairs)
  P.priceSpike(L, L.byVendor.get('Goodyear Commercial Tire')!, 14)
  P.missingPayee(L, 2)
  P.ghostVendor(L, N, 'Repairs')
  P.newVendorBurst(L, N, 'Repairs', 2600)
  P.miscode(L, repairs, 'Fuel')
  return { name: 'Logistics fleet, 60 trucks', txs: L.txs, planted: L.planted }
}

// 9 ─────────────────────────────────────────────────────────────────────────
export function retailChain(seed: number): Scenario {
  const L = new Ledger(rng(seed), { ...YEAR, periods: '445', desc: 'invoice' })
  const N = new Names(L)
  const suppliers = Array.from({ length: 10 }, () => N.company())
  const rents: string[][] = []
  let inventory: string[] = []
  for (let s = 1; s <= 40; s++) {
    const store = `Store ${String(s).padStart(2, '0')}`
    rents.push(monthly(L, N.company(), 6000 + Math.floor(L.r() * 30) * 500, 'Rent', 1, { account: store }))
    monthlyVar(L, s % 2 ? 'Duke Energy' : 'Georgia Power', 2600, 0.3, 'Utilities', 10 + (s % 7), store)
    for (const v of suppliers.slice(0, 4 + (s % 4))) inventory = inventory.concat(every(L, v, 7, () => L.around(1900, 0.5), 'Inventory', { account: store, offset: s % 5 }))
    every(L, 'Spotless Commercial', 7, () => 210, 'Cleaning', { account: store, offset: 2 })
    monthly(L, 'ADT Security', 129, 'Security', 8, { account: store })
  }
  daily(L, 'Worldpay Fees', 1, () => L.around(85, 0.4), 'Bank Fees', { weekend: true, account: () => `Store ${String(1 + Math.floor(L.r() * 40)).padStart(2, '0')}`, perDay: () => 40 })
  every(L, 'Workday Payroll', 14, () => L.around(1_400_000, 0.02), 'Payroll', { offset: 5 })
  P.dupInvoice(L, inventory, 3)
  P.dupInvoice(L, inventory, 15)
  P.extraInCycle(L, rents[17])
  P.splitUnderLimit(L, suppliers[3], 'Inventory')
  P.priceSpike(L, L.byVendor.get('ADT Security')!.slice(0, 12), 40)
  P.wrongPeriod(L, inventory)
  P.miscode(L, L.byVendor.get('Spotless Commercial')!, 'Inventory')
  P.ghostVendor(L, N, 'Inventory')
  P.missingPayee(L, 2)
  P.newVendorBurst(L, N, 'Inventory', 2400)
  return { name: 'Retail chain, 40 stores (4-4-5)', txs: L.txs, planted: L.planted }
}
