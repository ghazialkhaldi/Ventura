// Keeps this browser and the workspace on the server in step. Until
// migration 003 has run the server answers { stored: false } and the
// browser's copy is all there is; once it has, every source and decision is
// saved for the whole team, and any member's browser loads it.
import { bindBrowserToWorkspace, loadAllSourceDatasets, replaceSourceDatasets, type Dataset, type DetectedAnomaly, type StoredTransaction } from './dataStore'

async function post(url: string, body: unknown): Promise<{ stored?: boolean; datasetId?: string } | null> {
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return r.ok ? r.json() : null
  } catch { return null }
}

const sourceKind = (id: string) => (['plaid', 'quickbooks', 'xero', 'gusto'].find(p => id.startsWith(p)) ?? 'upload')

/** One step of a save, tried twice. Only a clear "stored" from the server counts. */
async function send(body: Record<string, unknown>): Promise<{ stored?: boolean; datasetId?: string } | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await post('/api/workspace/source', body)
    if (r?.stored) return r
    if (r) return null // the server answered and declined: trying again will not change that
  }
  return null
}

// Sources being saved right now. Their copy in this browser is the newest one,
// so loading from the server must leave them alone until the save has finished.
const saving = new Map<string, Promise<boolean>>()

async function sendSource(sourceId: string, label: string, ds: Dataset, rows: StoredTransaction[]): Promise<boolean> {
  const { anomalies, sampleTransactions, auditLog, files, uploadedAt, columnMapping, ...summary } = ds
  void auditLog; void files; void uploadedAt; void sampleTransactions
  // The server's copy is marked unfinished until the last step has landed.
  const reg = await send({ step: 'register', sourceKey: sourceId, source: sourceKind(sourceId), name: label, summary: { ...summary, complete: false }, mapping: columnMapping })
  if (!reg?.datasetId) return false
  for (let i = 0; i < rows.length; i += 2000) {
    if (!await send({ step: 'rows', datasetId: reg.datasetId, rows: rows.slice(i, i + 2000) })) return false
  }
  for (let i = 0; i < anomalies.length; i += 300) {
    if (!await send({ step: 'findings', datasetId: reg.datasetId, findings: anomalies.slice(i, i + 300) })) return false
  }
  return !!await send({ step: 'finish', datasetId: reg.datasetId, findingIds: anomalies.map(a => a.id) })
}

/** Save a source (its register, rows and findings) to the workspace. Saves of one source run one at a time. */
export function pushSourceToServer(sourceId: string, label: string, ds: Dataset, rows: StoredTransaction[]): Promise<boolean> {
  const run = (saving.get(sourceId) ?? Promise.resolve(false)).then(() => sendSource(sourceId, label, ds, rows)).catch(() => false)
  const tracked: Promise<boolean> = run.finally(() => { if (saving.get(sourceId) === tracked) saving.delete(sourceId) })
  saving.set(sourceId, tracked)
  return tracked
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
interface ServerSource { id: string; source_key: string; name: string; summary: Partial<Dataset> & { complete?: boolean }; column_mapping: Dataset['columnMapping'] | null; created_at: string }

interface ServerState { stored: boolean; workspace?: string; sources?: ServerSource[]; findings?: ServerFinding[]; evidence?: ServerRow[] }

async function fetchState(): Promise<ServerState | null> {
  try {
    const r = await fetch('/api/workspace/state')
    return r.ok ? await r.json() : null
  } catch { return null }
}

/**
 * Load the workspace from the server into this browser.
 *
 * The server's copy replaces this browser's only when the server holds all of
 * it. A source that never reached the server, or is only partly there, stays
 * as it is here and is sent again. The server's answer can only remove data
 * from this browser when it shows that data belongs to another workspace.
 *
 * Returns 'server' when the server answered, 'browser' when only this
 * browser's copy exists.
 */
export async function hydrateFromServer(): Promise<'server' | 'browser'> {
  let state = await fetchState()
  // Before anything is read or sent: another workspace's data must not be treated as this one's.
  if (state?.workspace) bindBrowserToWorkspace(state.workspace)
  if (!state?.stored) return 'browser'

  // A source saved before uploads were marked finished has no marker at all:
  // usable if it is all we have, but this browser's copy is the safer one.
  const finished = (src: ServerSource) => src.summary?.complete === true
  const held = new Set((state.sources ?? []).filter(finished).map(s => s.source_key))
  let sent = false
  for (const [key, ds] of Object.entries(loadAllSourceDatasets())) {
    if (held.has(key) || saving.has(key)) continue
    await pushSourceToServer(key, ds.files?.[0]?.name ?? key, ds, ds.sampleTransactions ?? [])
    sent = true
  }
  if (sent) {
    state = await fetchState()
    if (!state?.stored) return 'browser'
  }

  // Read after every wait above, so a file uploaded meanwhile is not lost.
  const local = loadAllSourceDatasets()
  const map: Record<string, Dataset> = { ...local }
  for (const src of state.sources ?? []) {
    const here = local[src.source_key]
    if (saving.has(src.source_key)) continue
    if (!finished(src) && (here || src.summary?.complete === false)) continue

    // Reviewer decisions come from the server. A few details the server does
    // not keep (which rows are the repeats, the browsing rows, this device's
    // log) stay as they were here.
    const flagged = new Map((here?.anomalies ?? []).map(a => [a.id, a.flaggedCount]))
    const findings = (state.findings ?? []).filter(f => f.dataset_id === src.id).map<DetectedAnomaly>(f => ({
      id: f.id, type: f.type, severity: f.severity, confidence: f.confidence, status: f.status, title: f.title,
      vendor: f.vendor ?? '', amount: Number(f.amount ?? 0), category: f.category ?? '', description: f.description ?? '',
      reasoning: f.reasoning ?? '', rowRefs: f.row_refs ?? [], detectedAt: f.detected_at,
      ...(f.also_matched ? { alsoMatched: f.also_matched } : {}),
      ...(flagged.get(f.id) !== undefined ? { flaggedCount: flagged.get(f.id) } : {}),
    }))
    const rows = (state.evidence ?? []).filter(r => r.dataset_id === src.id).map<StoredTransaction>(r => ({
      id: r.row_ref, rowIndex: r.row_index ?? 0, date: r.date ?? '', vendor: r.vendor, amount: Number(r.amount), direction: r.direction,
      description: r.description ?? '', category: r.category ?? '', account: r.account ?? '', ...(r.period ? { period: r.period } : {}),
    }))
    const hereRows = here?.sampleTransactions ?? []
    const known = new Set(hereRows.map(r => r.id))
    const { complete, ...summary } = src.summary
    void complete
    map[src.source_key] = {
      ...(summary as Dataset),
      uploadedAt: src.created_at,
      files: [{ name: src.name, size: 0, rowCount: (src.summary as Dataset).totalTransactions ?? 0, parsedAt: src.created_at }],
      columnMapping: src.column_mapping ?? { date: null, vendor: null, amount: null, debit: null, credit: null, description: null, category: null, account: null },
      anomalies: findings,
      auditLog: here?.auditLog ?? [],
      sampleTransactions: [...hereRows, ...rows.filter(r => !known.has(r.id))],
    }
  }
  if (Object.keys(map).length === 0) return 'server'
  replaceSourceDatasets(map)
  return 'server'
}
