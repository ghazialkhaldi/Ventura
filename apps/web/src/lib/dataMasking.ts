import type { StoredTransaction, Dataset, VendorStat } from './dataStore'

export type TestingMode      = 'live' | 'masked' | 'synthetic'
export type DataClassification = 'public' | 'internal' | 'confidential' | 'restricted'
export type MaskableField    = 'vendor' | 'amount' | 'account' | 'description' | 'category'

export interface MaskingProfile {
  id:                      string
  name:                    string
  masked_fields:           MaskableField[]
  testing_mode:            TestingMode
  data_classification:     DataClassification
  synthetic_dataset_flag:  boolean
  referential_masking_key: string
  created_at:              string
}

export const DEFAULT_MASKING_PROFILE: MaskingProfile = {
  id:                      'default',
  name:                    'Standard Financial Mask',
  masked_fields:           ['vendor', 'account'],
  testing_mode:            'live',
  data_classification:     'confidential',
  synthetic_dataset_flag:  false,
  referential_masking_key: 'Ventura-2026-key',
  created_at:              '2026-01-01T00:00:00Z',
}

const PROFILE_KEY      = 'sf_masking_profile'
const TESTING_MODE_KEY = 'sf_testing_mode'

// ─── Deterministic synthetic name generation ──────────────────────────────────

const PREFIXES = ['National', 'Premier', 'Allied', 'Consolidated', 'United', 'Pacific', 'Continental', 'Global', 'Meridian', 'Apex', 'Summit', 'Pinnacle', 'Vanguard', 'Sentinel', 'Nexus']
const SUFFIXES = ['Commerce Holdings', 'Financial Services', 'Capital Group', 'Systems Corp', 'Solutions Inc', 'Technologies LLC', 'Advisory Partners', 'Management Co', 'Enterprises Ltd', 'Group International']

// FNV-1a — small, dependency-free, deterministic. Used to fold the masking
// profile's referential_masking_key into the pseudonym seed so the key isn't
// just a display string: rotating it actually reshuffles the masked output,
// while keeping it fixed keeps the same vendor mapped to the same synthetic
// name run after run (the "referential" part of referential masking).
function hashKey(key: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function syntheticVendorName(seed: number, referentialKey: string): string {
  const salted = (seed + hashKey(referentialKey)) >>> 0
  return `${PREFIXES[salted % PREFIXES.length]} ${SUFFIXES[Math.floor(salted / PREFIXES.length) % SUFFIXES.length]}`
}

function maskAccount(account: string): string {
  if (!account || account.trim() === '') return '****'
  const trimmed = account.trim()
  if (trimmed.length <= 4) return '****'
  return '*'.repeat(Math.max(0, trimmed.length - 4)) + trimmed.slice(-4)
}

function buildVendorSeedMap(vendors: string[]): Map<string, number> {
  const map = new Map<string, number>()
  const sorted = [...new Set(vendors.map(v => v.toLowerCase()))].sort()
  sorted.forEach((v, i) => map.set(v, i))
  return map
}

// ─── Masking functions ────────────────────────────────────────────────────────

export function maskTransaction(
  tx: StoredTransaction,
  profile: MaskingProfile,
  seedMap: Map<string, number>,
): StoredTransaction {
  if (profile.testing_mode === 'live') return tx
  const m = { ...tx }

  if (profile.masked_fields.includes('vendor')) {
    const seed = seedMap.get(tx.vendor.toLowerCase()) ?? (tx.vendor.charCodeAt(0) % 100)
    m.vendor = syntheticVendorName(seed, profile.referential_masking_key)
  }
  if (profile.masked_fields.includes('amount')) {
    // Round to nearest $500 — preserves statistical distribution shape
    m.amount = Math.max(500, Math.round(tx.amount / 500) * 500)
  }
  if (profile.masked_fields.includes('account')) {
    m.account = maskAccount(tx.account)
  }
  if (profile.masked_fields.includes('description')) {
    m.description = `[MASKED — ${tx.category || 'Financial Transaction'}]`
  }
  if (profile.masked_fields.includes('category')) {
    m.category = 'Masked Category'
  }
  return m
}

export function maskDataset(dataset: Dataset, profile: MaskingProfile): Dataset {
  if (profile.testing_mode === 'live') return dataset
  const vendors  = dataset.sampleTransactions.map(t => t.vendor)
  const seedMap  = buildVendorSeedMap(vendors)
  const maskedTxs = dataset.sampleTransactions.map(tx => maskTransaction(tx, profile, seedMap))

  const maskedTopVendors: VendorStat[] = dataset.topVendors.map(v => {
    const seed = seedMap.get(v.vendor.toLowerCase()) ?? 0
    return {
      ...v,
      vendor: profile.masked_fields.includes('vendor') ? syntheticVendorName(seed, profile.referential_masking_key) : v.vendor,
      total:  profile.masked_fields.includes('amount') ? Math.round(v.total / 500) * 500 : v.total,
    }
  })

  return {
    ...dataset,
    sampleTransactions: maskedTxs,
    topVendors: maskedTopVendors,
  }
}

// ─── Synthetic data generation ────────────────────────────────────────────────

const SYNTHETIC_CATEGORIES = [
  'Software & SaaS', 'Cloud Infrastructure', 'Professional Services',
  'Marketing & Advertising', 'Travel & Expenses', 'Legal & Compliance',
  'Payroll Services', 'Office & Facilities',
]

const SYNTHETIC_VENDORS_BY_CAT: Record<string, string[]> = {
  'Software & SaaS':         ['Stratus Cloud Inc', 'Nexus Digital Platform', 'Apex Software Corp', 'Horizon Systems Ltd'],
  'Cloud Infrastructure':    ['Cirrus Computing LLC', 'Nimbus Infrastructure', 'Cumulus Systems Inc', 'Stratosphere Tech'],
  'Professional Services':   ['Pinnacle Advisory Group', 'Summit Strategy Partners', 'Meridian Consultants LLC'],
  'Marketing & Advertising': ['Beacon Media Group', 'Lighthouse Creative', 'Vantage Digital Partners', 'Signal Marketing Inc'],
  'Travel & Expenses':       ['National Travel Management', 'Allied Business Travel', 'Premier Expense Solutions'],
  'Legal & Compliance':      ['Sterling Law Associates', 'Cornerstone Counsel LLC', 'Meridian Legal Group'],
  'Payroll Services':        ['Pacific Payroll Corp', 'Continental HR Solutions', 'Allied Workforce Inc'],
  'Office & Facilities':     ['Premier Office Supply Co', 'National Business Products', 'United Facilities LLC'],
}

export function generateSyntheticTransactions(count: number): StoredTransaction[] {
  const txs: StoredTransaction[] = []
  const baseDate = new Date('2026-01-01')

  for (let i = 0; i < count; i++) {
    const catIdx  = i % SYNTHETIC_CATEGORIES.length
    const cat     = SYNTHETIC_CATEGORIES[catIdx]
    const vendors = SYNTHETIC_VENDORS_BY_CAT[cat] ?? SYNTHETIC_VENDORS_BY_CAT['Software & SaaS']
    const vendor  = vendors[Math.floor(i / SYNTHETIC_CATEGORIES.length) % vendors.length]
    const amount  = Math.round((500 + (i * 1337 + 4211) % 49500) / 100) * 100
    const days    = Math.floor(i * (180 / Math.max(count, 1)))
    const date    = new Date(baseDate.getTime() + days * 86_400_000)

    txs.push({
      id:          `SYN-${String(i + 1).padStart(4, '0')}`,
      date:        date.toISOString().split('T')[0],
      vendor,
      amount,
      description: `${cat} payment`,
      category:    cat,
      account:     `SYNTH-${(i % 5) + 1000}`,
      rowIndex:    i,
    })
  }
  return txs
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

export function loadMaskingProfile(): MaskingProfile {
  if (typeof window === 'undefined') return DEFAULT_MASKING_PROFILE
  try {
    const s = localStorage.getItem(PROFILE_KEY)
    return s ? (JSON.parse(s) as MaskingProfile) : DEFAULT_MASKING_PROFILE
  } catch { return DEFAULT_MASKING_PROFILE }
}

export function saveMaskingProfile(p: MaskingProfile): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)) } catch {}
}

export function getTestingMode(): TestingMode {
  if (typeof window === 'undefined') return 'live'
  try { return (localStorage.getItem(TESTING_MODE_KEY) as TestingMode) || 'live' } catch { return 'live' }
}

export function setTestingMode(mode: TestingMode): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(TESTING_MODE_KEY, mode) } catch {}
}

export function maskingModeLabel(mode: TestingMode): string {
  return mode === 'live' ? 'Live Data' : mode === 'masked' ? 'Masked Production Data' : 'Synthetic Test Data'
}

export function maskingModeColor(mode: TestingMode): string {
  return mode === 'live' ? 'text-green-700' : mode === 'masked' ? 'text-amber-700' : 'text-emerald-700'
}

export function maskingModeBg(mode: TestingMode): string {
  return mode === 'live' ? 'bg-green-50 border-green-200' : mode === 'masked' ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'
}

export function classificationLabel(c: DataClassification): string {
  return c === 'public' ? 'Public' : c === 'internal' ? 'Internal' : c === 'confidential' ? 'Confidential' : 'Restricted'
}
