import { useState, useEffect } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import PageHeader from '../../components/ui/PageHeader'
import { Card, CardHeader, CardDivider } from '../../components/ui/Card'
import {
  loadTierConfig, saveTierConfig, computeTierSummary, getDefaultTierConfig,
  tierLabel, tierColor, tierBg, tierDot, tierDescription,
  type TierConfig, type TierSummary,
} from '../../lib/dataLayers'
import {
  loadMaskingProfile, saveMaskingProfile, getTestingMode, setTestingMode,
  DEFAULT_MASKING_PROFILE, maskingModeLabel, maskingModeColor, maskingModeBg,
  type MaskingProfile, type TestingMode, type MaskableField, type DataClassification,
} from '../../lib/dataMasking'
import { loadDataset } from '../../lib/dataStore'
import {
  Database, Shield, GitMerge, Archive, Save, RefreshCw,
  CheckCircle, AlertCircle, Info, Lock, Eye, EyeOff, Zap,
  Thermometer, Snowflake, Flame, ChevronRight,
} from 'lucide-react'

// ─── Helpers ───────────────────────────────────────────────────────────────────

const MASKABLE_FIELDS: Array<{ key: MaskableField; label: string; description: string }> = [
  { key: 'vendor',      label: 'Vendor Name',   description: 'Replace with synthetic names' },
  { key: 'amount',      label: 'Amount',         description: 'Round to nearest $1K' },
  { key: 'account',     label: 'Account',        description: 'Replace with masked code' },
  { key: 'description', label: 'Description',    description: 'Replace with generic text' },
  { key: 'category',    label: 'Category',       description: 'Keep as-is (not sensitive)' },
]

const CLASSIFICATIONS: Array<{ key: DataClassification; label: string; color: string }> = [
  { key: 'public',       label: 'Public',       color: 'text-green-700'  },
  { key: 'internal',     label: 'Internal',     color: 'text-emerald-700'   },
  { key: 'confidential', label: 'Confidential', color: 'text-amber-700'  },
  { key: 'restricted',   label: 'Restricted',   color: 'text-red-700'    },
]

function fmtCurrency(n: number): string {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return '$' + (n / 1_000).toFixed(0) + 'K'
  return '$' + n.toFixed(0)
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function DataSettingsPage() {
  const [tierConfig,    setTierConfig]    = useState<TierConfig>(getDefaultTierConfig())
  const [tierSummary,   setTierSummary]   = useState<TierSummary | null>(null)
  const [testingMode,   setTestingModeState] = useState<TestingMode>('live')
  const [profile,       setProfile]       = useState<MaskingProfile>(DEFAULT_MASKING_PROFILE)
  const [savedMsg,      setSavedMsg]      = useState('')
  const [hasData,       setHasData]       = useState(false)

  useEffect(() => {
    setTierConfig(loadTierConfig())
    setTestingModeState(getTestingMode())
    setProfile(loadMaskingProfile())

    const ds = loadDataset()
    if (ds?.sampleTransactions?.length) {
      setHasData(true)
      setTierSummary(computeTierSummary(ds.sampleTransactions, loadTierConfig()))
    }
  }, [])

  function refreshTierSummary(cfg: TierConfig) {
    const ds = loadDataset()
    if (ds?.sampleTransactions?.length) {
      setTierSummary(computeTierSummary(ds.sampleTransactions, cfg))
    }
  }

  function handleSaveTiers() {
    saveTierConfig(tierConfig)
    refreshTierSummary(tierConfig)
    flash('Storage tier configuration saved')
  }

  function handleSaveMasking() {
    saveMaskingProfile(profile)
    setTestingMode(testingMode)
    flash('Data masking settings saved')
  }

  function flash(msg: string) {
    setSavedMsg(msg)
    setTimeout(() => setSavedMsg(''), 3000)
  }

  function toggleMaskField(field: MaskableField) {
    setProfile(prev => {
      const fields = prev.masked_fields.includes(field)
        ? prev.masked_fields.filter(f => f !== field)
        : [...prev.masked_fields, field]
      return { ...prev, masked_fields: fields }
    })
  }

  const TIERS = ['hot', 'warm', 'cold'] as const

  return (
    <AppLayout title="Data Architecture Settings">
      <PageHeader
        title="Data Architecture"
        subtitle="Storage tiers, masking profiles, normalization rules, and retention policies"
        className="mb-6"
      />

      {savedMsg && (
        <div className="flex items-center gap-3 mb-6 bg-green-50 border border-green-200 text-green-800 text-sm font-medium px-4 py-3 rounded-lg">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          {savedMsg}
        </div>
      )}

      <div className="space-y-6">

        {/* ══ STORAGE LAYER ARCHITECTURE ══ */}
        <Card>
          <CardHeader
            title="Storage Layer Architecture"
            subtitle="Classify transactions into Hot, Warm, and Cold storage tiers by fiscal year"
            icon={<Database className="w-4 h-4" />}
          />
          <CardDivider />

          {/* Tier diagram */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {TIERS.map(tier => {
              const band = tierSummary ? tierSummary[tier] : null
              const Icon = tier === 'hot' ? Flame : tier === 'warm' ? Thermometer : Snowflake
              return (
                <div key={tier} className={`rounded-xl border p-4 ${tierBg(tier)}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className={`w-4 h-4 ${tierColor(tier)}`} />
                    <span className={`text-sm font-bold ${tierColor(tier)}`}>{tierLabel(tier)}</span>
                    <span className={`w-2 h-2 rounded-full ${tierDot(tier)} ml-auto`} />
                  </div>
                  <p className="text-[11px] text-slate-600 mb-3 leading-snug">{tierDescription(tier)}</p>
                  {band ? (
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Records</span>
                        <span className="font-semibold text-slate-800">{band.count.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Spend</span>
                        <span className="font-semibold text-slate-800">{fmtCurrency(band.totalSpend)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Query</span>
                        <span className="font-semibold text-slate-800">~{band.estimatedQueryMs}ms</span>
                      </div>
                      {band.dateRange && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Range</span>
                          <span className="font-semibold text-slate-800 text-[10px]">{band.dateRange}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No data yet</p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Tier config controls */}
          <div className="grid grid-cols-2 gap-6 mb-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Hot Tier Cut-off Year
              </label>
              <p className="text-[11px] text-slate-500 mb-2">Transactions on or after this year are classified as Hot</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={tierConfig.hotCutoffYear}
                  min={2000}
                  max={2030}
                  onChange={e => setTierConfig(prev => ({ ...prev, hotCutoffYear: Number(e.target.value) }))}
                  className="w-28 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-xs text-slate-500">Current fiscal year: 2026</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Warm Tier Cut-off Year
              </label>
              <p className="text-[11px] text-slate-500 mb-2">Transactions between warm and hot cut-off are Warm</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={tierConfig.warmCutoffYear}
                  min={2000}
                  max={2030}
                  onChange={e => setTierConfig(prev => ({ ...prev, warmCutoffYear: Number(e.target.value) }))}
                  className="w-28 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-xs text-slate-500">Older transactions → Cold</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveTiers}
              className="flex items-center gap-2 bg-[#0c1526] hover:bg-[#1a2640] text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              Save Tier Config
            </button>
            {!hasData && (
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                Upload data to see real tier distribution
              </p>
            )}
          </div>
        </Card>

        {/* ══ TESTING MODE & DATA MASKING ══ */}
        <Card>
          <CardHeader
            title="Testing Mode & Data Safety"
            subtitle="Control whether live, masked, or synthetic data is used in the current session"
            icon={<Shield className="w-4 h-4" />}
          />
          <CardDivider />

          {/* Mode toggle */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {(['live', 'masked', 'synthetic'] as TestingMode[]).map(mode => {
              const isActive = testingMode === mode
              const Icon = mode === 'live' ? Zap : mode === 'masked' ? EyeOff : RefreshCw
              const desc = mode === 'live'
                ? 'Real production data — all fields shown as-is'
                : mode === 'masked'
                ? 'Vendor names and sensitive fields replaced with synthetic equivalents'
                : 'Fully generated dataset — no real data used anywhere'

              return (
                <button
                  key={mode}
                  onClick={() => setTestingModeState(mode)}
                  className={`flex flex-col items-start gap-2 p-4 rounded-xl border-2 transition-all text-left ${
                    isActive
                      ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 w-full">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-600' : 'text-slate-500'}`} />
                    <span className={`text-sm font-semibold ${isActive ? 'text-emerald-800' : 'text-slate-700'}`}>
                      {maskingModeLabel(mode)}
                    </span>
                    {isActive && (
                      <span className="ml-auto w-2 h-2 rounded-full bg-emerald-500" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">{desc}</p>
                </button>
              )
            })}
          </div>

          {/* Masking field config (shown when masked mode selected) */}
          {testingMode === 'masked' && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs font-semibold text-amber-800 mb-3 flex items-center gap-2">
                <EyeOff className="w-3.5 h-3.5" />
                Fields to mask in Masked Mode
              </p>
              <div className="space-y-2">
                {MASKABLE_FIELDS.map(f => (
                  <label key={f.key} className="flex items-center gap-3 cursor-pointer group">
                    <div
                      onClick={() => toggleMaskField(f.key)}
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        profile.masked_fields.includes(f.key)
                          ? 'bg-amber-600 border-amber-600'
                          : 'border-slate-300 bg-white group-hover:border-amber-400'
                      }`}
                    >
                      {profile.masked_fields.includes(f.key) && (
                        <CheckCircle className="w-2.5 h-2.5 text-white" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{f.label}</p>
                      <p className="text-[10px] text-slate-500">{f.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Data classification */}
          <div className="mb-6">
            <label className="block text-xs font-semibold text-slate-700 mb-2">Data Classification Level</label>
            <div className="flex items-center gap-2 flex-wrap">
              {CLASSIFICATIONS.map(c => (
                <button
                  key={c.key}
                  onClick={() => setProfile(prev => ({ ...prev, data_classification: c.key }))}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                    profile.data_classification === c.key
                      ? 'bg-slate-800 border-slate-800 text-white'
                      : 'border-slate-200 text-slate-600 hover:border-slate-400'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Referential integrity note */}
          <div className="flex items-start gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg mb-5">
            <Info className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-emerald-800">Referential Masking Enabled</p>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                Masked vendor names are deterministic — the same vendor always maps to the same synthetic name within a session, preserving aggregations and frequency analysis.
              </p>
            </div>
          </div>

          <button
            onClick={handleSaveMasking}
            className="flex items-center gap-2 bg-[#0c1526] hover:bg-[#1a2640] text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            Save Masking Settings
          </button>
        </Card>

        {/* ══ NORMALIZATION RULES ══ */}
        <Card>
          <CardHeader
            title="Normalization Rules"
            subtitle="Confidence thresholds and required fields for invoice normalization"
            icon={<GitMerge className="w-4 h-4" />}
          />
          <CardDivider />

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Review Threshold</label>
              <p className="text-[11px] text-slate-500 mb-2">Invoices below this confidence score are sent to the review queue</p>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  defaultValue={60}
                  className="w-40"
                />
                <span className="text-sm font-bold text-slate-700">60%</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Required Fields</label>
              <p className="text-[11px] text-slate-500 mb-2">Fields that must map for an invoice to pass validation</p>
              <div className="flex flex-wrap gap-2">
                {['vendor_name', 'invoice_total', 'invoice_date'].map(f => (
                  <span key={f} className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold px-2.5 py-1 rounded-full">
                    <CheckCircle className="w-3 h-3" />
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
            <p className="text-[11px] text-slate-600 font-semibold mb-2">Confidence Scoring Weights</p>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3 text-[11px]">
              {[
                { field: 'vendor_name', weight: 4, required: true },
                { field: 'invoice_total', weight: 4, required: true },
                { field: 'invoice_date', weight: 4, required: true },
                { field: 'invoice_id', weight: 2, required: false },
                { field: 'department', weight: 2, required: false },
                { field: 'due_date', weight: 1, required: false },
                { field: 'cost_center', weight: 1, required: false },
                { field: 'payment_terms', weight: 1, required: false },
                { field: 'currency', weight: 1, required: false },
              ].map(({ field, weight, required }) => (
                <div key={field} className="flex items-center gap-1.5">
                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold flex-shrink-0 ${
                    required ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                  }`}>{weight}×</span>
                  <span className="text-slate-600 truncate">{field}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* ══ ARCHIVE & RETENTION ══ */}
        <Card>
          <CardHeader
            title="Archive & Retention"
            subtitle="Automatic archiving policies for cold-tier data"
            icon={<Archive className="w-4 h-4" />}
          />
          <CardDivider />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            {[
              { title: 'Hot → Warm',     rule: 'After 1 fiscal year', icon: Thermometer, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
              { title: 'Warm → Cold',    rule: 'After 3 fiscal years', icon: Snowflake,   color: 'text-emerald-600',  bg: 'bg-emerald-50 border-emerald-200'   },
              { title: 'Cold → Archive', rule: 'After 7 years',        icon: Archive,     color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200'  },
            ].map(({ title, rule, icon: Icon, color, bg }) => (
              <div key={title} className={`rounded-lg border p-4 ${bg}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <p className="text-xs font-semibold text-slate-800">{title}</p>
                </div>
                <p className="text-xs text-slate-600">{rule}</p>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <Lock className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-slate-700">Compliance Hold</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Data under active litigation or audit hold is excluded from automatic archiving regardless of age.
              </p>
            </div>
          </div>
        </Card>

      </div>
    </AppLayout>
  )
}
