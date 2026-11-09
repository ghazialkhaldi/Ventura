// Server-only. Reads and writes a workspace's registers and findings in the
// migration-003 tables. Every function returns null when the tables do not
// exist yet, so callers can tell the browser to keep using its own copy.
import { adminClient, tableMissing } from './workspace'

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
 * The last step of a save. Findings the new run no longer raises are removed
 * (their history stays in finding_events), and the copy is marked complete,
 * which is what lets a browser replace its own copy with this one.
 */
export async function finishSource(tenantId: string, datasetId: string, findingIds: string[]): Promise<boolean> {
  const db = adminClient()
  if (!db || !(await ownsDataset(tenantId, datasetId))) return false
  const keep = new Set(findingIds)
  const held = await allRows<{ id: string }>(from => db.from('findings').select('id').eq('tenant_id', tenantId).eq('dataset_id', datasetId).order('id').range(from, from + PAGE - 1))
  const stale = held.map(r => r.id).filter(id => !keep.has(id))
  for (let i = 0; i < stale.length; i += 200) {
    const { error } = await db.from('findings').delete().eq('tenant_id', tenantId).in('id', stale.slice(i, i + 200))
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
export async function decide(tenantId: string, findingId: string, status: string, note: string | null, actor: { id: string; email: string | null }): Promise<'stored' | 'not_found' | null> {
  const db = adminClient()
  if (!db || !STATUSES.includes(status)) return null
  const { data: f, error } = await db.from('findings').select('status').eq('tenant_id', tenantId).eq('id', findingId).maybeSingle()
  if (tableMissing(error)) return null
  if (!f) return 'not_found'
  const now = new Date().toISOString()
  await db.from('findings').update({ status, decided_by: actor.id, decided_by_email: actor.email, decided_at: now, updated_at: now }).eq('tenant_id', tenantId).eq('id', findingId)
  await db.from('finding_events').insert({
    tenant_id: tenantId, finding_id: findingId, actor_id: actor.id, actor_email: actor.email,
    action: note && f.status === status ? 'note_added' : 'status_changed', from_status: f.status, to_status: status, note: note?.slice(0, 2000) ?? null,
  })
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
  const { data, error } = await db.from('finding_events').select('actor_email, action, from_status, to_status, note, created_at').eq('tenant_id', tenantId).eq('finding_id', findingId).order('created_at')
  if (tableMissing(error)) return null
  return data ?? []
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
