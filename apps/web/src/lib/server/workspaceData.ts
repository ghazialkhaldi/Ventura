// Server-only. Reads and writes a workspace's registers and findings in the
// migration-003 tables. Every function returns null when the tables do not
// exist yet, so callers can tell the browser to keep using its own copy.
import { adminClient, tableMissing } from './workspace'
import { CLOSE_REASON_LABELS, closeReasonFor } from '../dataStore'

// Migration 005 adds the close-reason columns. Until it has run, decisions still save.
const columnMissing = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === '42703' || e.code === 'PGRST204' || /column .* does not exist|could not find the .* column/i.test(e.message ?? ''))

export interface FindingIn {
  id: string; type: string; severity: string; confidence: number; status: string; title: string
  vendor?: string; amount?: number; category?: string; description?: string; reasoning?: string
  rowRefs: string[]; alsoMatched?: unknown; detectedAt?: string
}

export interface TxIn {
  id: string; rowIndex?: number; date?: string; vendor?: string; amount: number; direction?: string
  description?: string; category?: string; account?: string; period?: string
}

// The database returns at most 1,000 rows per request.
const PAGE = 1000

/** Every row of a query, page by page. A failed page throws: a partial list must never pass for the whole one. */
async function allRows<T>(page: (from: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from)
    if (error) throw error
    out.push(...((data ?? []) as T[]))
    if ((data ?? []).length < PAGE) return out
  }
}

/** Create or replace a source's register; returns its id. */
export async function upsertSource(tenantId: string, sourceKey: string, source: string, name: string, summary: unknown, mapping: unknown, actor: { id: string; email: string | null }): Promise<string | null> {
  const db = adminClient()
  if (!db) return null
  const { data, error } = await db.from('datasets').upsert({
    tenant_id: tenantId, source_key: sourceKey, source, name, summary, column_mapping: mapping ?? null,
    row_count: (summary as { totalTransactions?: number })?.totalTransactions ?? 0,
    created_by: actor.id, created_by_email: actor.email, created_at: new Date().toISOString(),
  }, { onConflict: 'tenant_id,source_key' }).select('id').single()
  if (tableMissing(error)) return null
  if (error) throw error
  await db.from('transactions').delete().eq('dataset_id', data.id)
  return data.id as string
}

async function ownsDataset(tenantId: string, datasetId: string): Promise<boolean> {
  const db = adminClient()!
  const { data } = await db.from('datasets').select('id').eq('id', datasetId).eq('tenant_id', tenantId).maybeSingle()
  return !!data
}

export async function insertTransactions(tenantId: string, datasetId: string, rows: TxIn[]): Promise<boolean> {
  const db = adminClient()
  if (!db || !(await ownsDataset(tenantId, datasetId))) return false
  const { error } = await db.from('transactions').upsert(rows.slice(0, 5000).map(r => ({
    tenant_id: tenantId, dataset_id: datasetId, row_ref: String(r.id).slice(0, 200), row_index: r.rowIndex ?? null,
    date: /^\d{4}-\d{2}-\d{2}$/.test(r.date ?? '') ? r.date : null,
    vendor: (r.vendor ?? '').slice(0, 300), amount: Number(r.amount) || 0, direction: r.direction === 'credit' ? 'credit' : 'debit',
    description: (r.description ?? '').slice(0, 500), category: (r.category ?? '').slice(0, 200), account: (r.account ?? '').slice(0, 200), period: (r.period ?? '').slice(0, 40),
  })), { onConflict: 'dataset_id,row_ref' })
  if (error) throw error
  return true
}

/**
 * Store a source's findings. New findings arrive as detected; findings the
 * server already holds keep the status and decision recorded there, which
 * is the record of truth for what reviewers decided.
 */
export async function upsertFindings(tenantId: string, datasetId: string, findings: FindingIn[]): Promise<boolean> {
  const db = adminClient()
  if (!db || !(await ownsDataset(tenantId, datasetId))) return false
  const ids = findings.map(f => f.id)
  const { data: existing } = await db.from('findings').select('id').eq('tenant_id', tenantId).in('id', ids.length ? ids : ['-'])
  const known = new Set((existing ?? []).map(r => r.id as string))
  const content = (f: FindingIn) => ({
    tenant_id: tenantId, id: f.id, dataset_id: datasetId, type: f.type, severity: f.severity, confidence: Math.round(f.confidence),
    title: f.title.slice(0, 300), vendor: (f.vendor ?? '').slice(0, 300), amount: f.amount ?? null, category: (f.category ?? '').slice(0, 200),
    description: (f.description ?? '').slice(0, 2000), reasoning: (f.reasoning ?? '').slice(0, 4000),
    row_refs: f.rowRefs.slice(0, 500), also_matched: f.alsoMatched ?? null, updated_at: new Date().toISOString(),
  })
  const fresh = findings.filter(f => !known.has(f.id)).map(f => ({ ...content(f), status: f.status || 'Open', detected_at: f.detectedAt ?? new Date().toISOString() }))
  if (fresh.length) {
    const { error } = await db.from('findings').insert(fresh)
    if (error) throw error
    await db.from('finding_events').insert(fresh.map(f => ({ tenant_id: tenantId, finding_id: f.id, action: 'raised', to_status: f.status, actor_email: 'Ventura' })))
  }
  for (const f of findings.filter(f => known.has(f.id))) {
    const { error } = await db.from('findings').update(content(f)).eq('tenant_id', tenantId).eq('id', f.id)
    if (error) throw error
  }
  return true
}

/**
 * What a new run means for the findings already held: those it no longer raises
 * are removed if nobody has touched them, and kept if a reviewer has, because
 * that decision is part of the record.
 */
export function reconcileFindings(held: { id: string; status: string }[], raised: Set<string>): { remove: string[]; keep: string[] } {
  const gone = held.filter(f => !raised.has(f.id))
  return { remove: gone.filter(f => f.status === 'Open').map(f => f.id), keep: gone.filter(f => f.status !== 'Open').map(f => f.id) }
}

/**
 * The last step of a save: settle findings the new run no longer raises and
 * mark the copy complete, which is what lets a browser replace its own copy
 * with this one.
 */
export async function finishSource(tenantId: string, datasetId: string, findingIds: string[]): Promise<boolean> {
  const db = adminClient()
  if (!db || !(await ownsDataset(tenantId, datasetId))) return false
  const held = await allRows<{ id: string; status: string }>(from => db.from('findings').select('id, status').eq('tenant_id', tenantId).eq('dataset_id', datasetId).order('id').range(from, from + PAGE - 1))
  const { remove, keep } = reconcileFindings(held, new Set(findingIds))
  for (let i = 0; i < remove.length; i += 200) {
    const { error } = await db.from('findings').delete().eq('tenant_id', tenantId).in('id', remove.slice(i, i + 200))
    if (error) throw error
  }
  // A kept finding's row ids are positions in the old file. In a changed file
  // they could point at different payments, and no evidence beats wrong evidence.
  for (let i = 0; i < keep.length; i += 200) {
    const { error } = await db.from('findings').update({ row_refs: [] }).eq('tenant_id', tenantId).in('id', keep.slice(i, i + 200))
    if (error) throw error
  }
  const { data, error } = await db.from('datasets').select('summary').eq('id', datasetId).single()
  if (error) throw error
  const { error: updateError } = await db.from('datasets').update({ summary: { ...(data.summary as object), complete: true } }).eq('id', datasetId)
  if (updateError) throw updateError
  return true
}

const STATUSES = ['Open', 'Under Review', 'Resolved', 'Dismissed']

/** A reviewer's decision: the finding's status, and an append-only event recording who, what and when. */
export async function decide(tenantId: string, findingId: string, status: string, note: string | null, actor: { id: string; email: string | null }, rawReason?: unknown): Promise<'stored' | 'not_found' | null> {
  const db = adminClient()
  if (!db || !STATUSES.includes(status)) return null
  const { data: f, error } = await db.from('findings').select('status').eq('tenant_id', tenantId).eq('id', findingId).maybeSingle()
  if (tableMissing(error)) return null
  if (!f) return 'not_found'
  const reason = closeReasonFor(status, rawReason)
  const now = new Date().toISOString()
  const decision = { status, decided_by: actor.id, decided_by_email: actor.email, decided_at: now, updated_at: now }
  const saveDecision = (row: object) => db.from('findings').update(row).eq('tenant_id', tenantId).eq('id', findingId)
  let saved = await saveDecision({ ...decision, close_reason: reason })
  if (columnMissing(saved.error)) saved = await saveDecision(decision)
  if (saved.error) throw saved.error

  const event = {
    tenant_id: tenantId, finding_id: findingId, actor_id: actor.id, actor_email: actor.email,
    action: note && f.status === status ? 'note_added' : 'status_changed', from_status: f.status, to_status: status, note: note?.slice(0, 2000) ?? null,
  }
  let logged = await db.from('finding_events').insert({ ...event, reason })
  if (columnMissing(logged.error)) {
    const label = reason ? CLOSE_REASON_LABELS[reason] : null
    logged = await db.from('finding_events').insert({ ...event, note: label ? (event.note ? `${label}: ${event.note}` : label) : event.note })
  }
  if (logged.error) throw logged.error
  return 'stored'
}

/** Everything a teammate's browser needs to show the workspace: sources, findings, and the rows they cite. */
export async function loadState(tenantId: string) {
  const db = adminClient()
  if (!db) return null
  const { data: sources, error } = await db.from('datasets').select('id, source_key, source, name, summary, column_mapping, created_at').eq('tenant_id', tenantId)
  if (tableMissing(error)) return null
  if (error) throw error
  const findings = await allRows<{ row_refs: string[] | null }>(from => db.from('findings').select('*').eq('tenant_id', tenantId).order('id').range(from, from + PAGE - 1))
  const cited = [...new Set(findings.flatMap(f => f.row_refs ?? []))]
  const evidence: unknown[] = []
  // Row ids are long and go in the URL, so ask for a modest number at a time.
  for (let i = 0; i < cited.length; i += 100) {
    const { data, error: rowsError } = await db.from('transactions').select('dataset_id, row_ref, row_index, date, vendor, amount, direction, description, category, account, period').eq('tenant_id', tenantId).in('row_ref', cited.slice(i, i + 100))
    if (rowsError) throw rowsError
    evidence.push(...(data ?? []))
  }
  return { sources: sources ?? [], findings, evidence }
}

export async function findingHistory(tenantId: string, findingId: string) {
  const db = adminClient()
  if (!db) return null
  const read = (columns: string) => db.from('finding_events').select(columns).eq('tenant_id', tenantId).eq('finding_id', findingId).order('created_at')
  const columns = 'actor_email, action, from_status, to_status, note, created_at'
  let result = await read(`${columns}, reason`)
  if (columnMissing(result.error)) result = await read(columns)
  if (tableMissing(result.error)) return null
  return result.data ?? []
}

export async function getSettings(tenantId: string) {
  const db = adminClient()
  if (!db) return null
  const { data, error } = await db.from('workspace_settings').select('approval_limit, detection_config').eq('tenant_id', tenantId).maybeSingle()
  if (tableMissing(error)) return null
  return { ...(data?.detection_config ?? {}), ...(data?.approval_limit ? { approvalLimit: Number(data.approval_limit) } : {}) }
}

export async function putSettings(tenantId: string, config: Record<string, unknown>, actorId: string) {
  const db = adminClient()
  if (!db) return null
  const { error } = await db.from('workspace_settings').upsert({
    tenant_id: tenantId, approval_limit: typeof config.approvalLimit === 'number' ? config.approvalLimit : null,
    detection_config: config, updated_by: actorId, updated_at: new Date().toISOString(),
  })
  if (tableMissing(error)) return null
  if (error) throw error
  return true
}
