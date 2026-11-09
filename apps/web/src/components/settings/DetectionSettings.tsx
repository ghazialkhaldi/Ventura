import { useEffect, useState } from 'react'
import { DEFAULT_DETECTION_CONFIG } from '../../lib/detectionConfig'
import { getDetectionConfig, setDetectionConfig, refreshDetectionConfig } from '../../lib/workspaceSettings'

// The few detection settings that differ between companies. Everything else
// calibrates itself from the company's own data.
const FIELDS = [
  { key: 'approvalLimit' as const, label: 'Approval limit', help: 'Payments at or above this need a second approver. Payments split to stay just under it are flagged. Ventura also finds other limits from how payments bunch.' },
  { key: 'minExcess' as const, label: 'Smallest amount worth a finding', help: 'An amount check only raises a payment that is at least this much above what was expected.' },
  { key: 'roundNumberMin' as const, label: 'Round amounts from', help: 'Round thousands at or above this count as a signal where round amounts are unusual for you.' },
]

export default function DetectionSettings({ isAdmin }: { isAdmin: boolean }) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'local' | 'error'>('idle')

  useEffect(() => {
    const fill = (cfg: Record<string, unknown>) => setValues(Object.fromEntries(FIELDS.map(f => [f.key, String(cfg[f.key] ?? DEFAULT_DETECTION_CONFIG[f.key])])))
    fill(getDetectionConfig())
    void refreshDetectionConfig().then(fill)
  }, [])

  async function save() {
    const cfg: Record<string, number> = {}
    for (const f of FIELDS) {
      const v = Number(String(values[f.key] ?? '').replace(/[$,\s]/g, ''))
      if (Number.isFinite(v) && v > 0) cfg[f.key] = v
    }
    setState('saving')
    setDetectionConfig(cfg)
    try {
      const r = await fetch('/api/workspace/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) })
      const j = await r.json()
      setState(!r.ok ? 'error' : j.stored ? 'saved' : 'local')
    } catch { setState('local') }
  }

  return (
    <div className="max-w-xl rounded-xl border border-border bg-surface-raised p-6 shadow-card">
      <h2 className="text-[15px] font-medium text-text-primary">Detection</h2>
      <p className="mt-1 text-[13.5px] text-text-muted">Changes apply to the next upload or sync.</p>
      <div className="mt-5 space-y-5">
        {FIELDS.map(f => (
          <label key={f.key} className="block">
            <span className="text-[13px] font-medium text-text-primary">{f.label}</span>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-[14px] text-text-muted">$</span>
              <input
                inputMode="decimal" disabled={!isAdmin}
                value={values[f.key] ?? ''}
                onChange={e => { setValues(v => ({ ...v, [f.key]: e.target.value })); setState('idle') }}
                className="h-10 w-40 rounded-md border border-border-strong bg-surface-raised px-3 text-[14.5px] tabular-nums text-text-primary focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30 disabled:opacity-60"
              />
            </div>
            <span className="mt-1.5 block text-[12.5px] leading-relaxed text-text-muted">{f.help}</span>
          </label>
        ))}
      </div>
      {isAdmin ? (
        <div className="mt-6 flex items-center gap-3">
          <button onClick={save} disabled={state === 'saving'} className="h-10 rounded-md bg-accent-600 px-4 text-[14px] font-medium text-white hover:bg-accent-700 disabled:opacity-60">Save</button>
          <span role="status" className="text-[13px] text-text-muted">
            {state === 'saved' ? 'Saved for the whole workspace.' : state === 'local' ? 'Saved on this device. It will apply to the workspace once its database is set up.' : state === 'error' ? 'Could not save. Try again.' : ''}
          </span>
        </div>
      ) : <p className="mt-6 text-[13px] text-text-muted">Only the workspace admin can change these.</p>}
    </div>
  )
}
