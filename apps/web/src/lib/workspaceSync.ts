// Keeps this browser and the workspace on the server in step. Until
// migration 003 has run the server answers { stored: false } and the
// browser's copy is all there is; once it has, every source and decision is
// saved for the whole team, and any member's browser loads it.
import { loadAllSourceDatasets, replaceSourceDatasets, type Dataset, type DetectedAnomaly, type StoredTransaction } from './dataStore'

async function post(url: string, body: unknown): Promise<{ stored?: boolean; datasetId?: string } | null> {
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return r.ok ? r.json() : null
  } catch { return null }
}

const sourceKind = (id: string) => (['plaid', 'quickbooks', 'xero', 'gusto'].find(p => id.startsWith(p)) ?? 'upload')

/** Save a source (its register, rows and findings) to the workspace. Quietly does nothing without the tables. */
export async function pushSourceToServer(sourceId: string, label: string, ds: Dataset, rows: StoredTransaction[]): Promise<boolean> {
  const { anomalies, sampleTransactions, auditLog, files, uploadedAt, columnMapping, ...summary } = ds
  void auditLog; void files; void uploadedAt; void sampleTransactions
  const reg = await post('/api/workspace/source', { step: 'register', sourceKey: sourceId, source: sourceKind(sourceId), name: label, summary, mapping: columnMapping })
  if (!reg?.stored || !reg.datasetId) return false
  for (let i = 0; i < rows.length; i += 2000) {
    await post('/api/workspace/source', { step: 'rows', datasetId: reg.datasetId, rows: rows.slice(i, i + 2000) })
  }
  for (let i = 0; i < anomalies.length; i += 300) {
    await post('/api/workspace/source', { step: 'findings', datasetId: reg.datasetId, findings: anomalies.slice(i, i + 300) })
  }
  return true
}

/** Record a reviewer's decision for the team. Returns whether the server kept it. */
export async function recordDecision(id: string, status: DetectedAnomaly['status'], note?: string): Promise<boolean> {
  const r = await post('/api/findings/decide', { id, status, note })
  return !!r?.stored
}

interface ServerFinding {
  id: string; dataset_id: string | null; type: DetectedAnomaly['type']; severity: DetectedAnomaly['severity']; confidence: number
  status: DetectedAnomaly['status']; title: string; vendor: string | null; amount: number | string | null; category: string | null
  description: string | null; reasoning: string | null; row_refs: string[]; also_matched: DetectedAnomaly['alsoMatched'] | null; detected_at: string
}
interface ServerRow {
  dataset_id: string; row_ref: string; row_index: number | null; date: string | null; vendor: string; amount: number | string
  direction: 'debit' | 'credit'; description: string | null; category: string | null; account: string | null; period: string | null
}
interface ServerSource { id: string; source_key: string; name: string; summary: Partial<Dataset>; column_mapping: Dataset['columnMapping'] | null; created_at: string }

/**
 * Load the workspace from the server into this browser. Sources this browser
 * holds that the server lacks (added before the migration) are sent up first,
 * so nothing is lost. Returns 'server' when the workspace came from the
 * server, 'browser' when only this browser's copy exists.
 */
export async function hydrateFromServer(): Promise<'server' | 'browser'> {
  let state: { stored: boolean; sources?: ServerSource[]; findings?: ServerFinding[]; evidence?: ServerRow[] } | null = null
  try {
    const r = await fetch('/api/workspace/state')
    state = r.ok ? await r.json() : null
  } catch { return 'browser' }
  if (!state?.stored) return 'browser'

  const local = loadAllSourceDatasets()
  const onServer = new Set((state.sources ?? []).map(s => s.source_key))
  for (const [key, ds] of Object.entries(local)) {
    if (!onServer.has(key)) await pushSourceToServer(key, ds.files?.[0]?.name ?? key, ds, ds.sampleTransactions ?? [])
  }
  if (Object.keys(local).some(k => !onServer.has(k))) {
    try { state = await (await fetch('/api/workspace/state')).json() } catch { return 'browser' }
  }

  const map: Record<string, Dataset> = {}
  for (const src of state!.sources ?? []) {
    const findings = (state!.findings ?? []).filter(f => f.dataset_id === src.id).map<DetectedAnomaly>(f => ({
      id: f.id, type: f.type, severity: f.severity, confidence: f.confidence, status: f.status, title: f.title,
      vendor: f.vendor ?? '', amount: Number(f.amount ?? 0), category: f.category ?? '', description: f.description ?? '',
      reasoning: f.reasoning ?? '', rowRefs: f.row_refs ?? [], detectedAt: f.detected_at, ...(f.also_matched ? { alsoMatched: f.also_matched } : {}),
    }))
    const rows = (state!.evidence ?? []).filter(r => r.dataset_id === src.id).map<StoredTransaction>(r => ({
      id: r.row_ref, rowIndex: r.row_index ?? 0, date: r.date ?? '', vendor: r.vendor, amount: Number(r.amount), direction: r.direction,
      description: r.description ?? '', category: r.category ?? '', account: r.account ?? '', ...(r.period ? { period: r.period } : {}),
    }))
    map[src.source_key] = {
      ...(src.summary as Dataset),
      uploadedAt: src.created_at,
      files: [{ name: src.name, size: 0, rowCount: (src.summary as Dataset).totalTransactions ?? 0, parsedAt: src.created_at }],
      columnMapping: src.column_mapping ?? { date: null, vendor: null, amount: null, debit: null, credit: null, description: null, category: null, account: null },
      anomalies: findings,
      auditLog: [],
      sampleTransactions: rows,
    }
  }
  replaceSourceDatasets(map)
  if (Object.keys(map).length) try { localStorage.setItem('sf_data_ready', 'true') } catch { /* ignore */ }
  return 'server'
}
