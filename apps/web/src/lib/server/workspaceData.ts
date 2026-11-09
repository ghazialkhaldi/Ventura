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
  const { data: findings } = await db.from('findings').select('*').eq('tenant_id', tenantId)
  const cited = [...new Set((findings ?? []).flatMap(f => (f.row_refs as string[]) ?? []))]
  const evidence: unknown[] = []
  for (let i = 0; i < cited.length; i += 500) {
    const { data } = await db.from('transactions').select('dataset_id, row_ref, row_index, date, vendor, amount, direction, description, category, account, period').eq('tenant_id', tenantId).in('row_ref', cited.slice(i, i + 500))
    evidence.push(...(data ?? []))
  }
  return { sources: sources ?? [], findings: findings ?? [], evidence }
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
