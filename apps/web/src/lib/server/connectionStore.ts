// Server-only. Where a workspace's integration connections live.
//
// The home is the integration_connections table (migration 003), one row per
// connected system per workspace, tokens sealed with AES-256-GCM, reachable
// only through the service-role key. Until that migration has run, tokens are
// kept where they always were, sealed in the admin's auth metadata, so
// connecting still works; they move across automatically on the next save.
import { adminClient, tableMissing } from './workspace'
import { seal, open, type Sealed } from './crypto'

export type Provider = 'plaid' | 'quickbooks' | 'xero' | 'gusto'

export interface Connection {
  id:                 string            // row id, or `meta:<provider>` before the migration
  tenantId:           string
  provider:           Provider
  status:             'connected' | 'error' | 'revoked'
  accountId:          string | null     // realmId, Xero tenant, Plaid item, Gusto company
  accountName:        string | null
  accessToken:        string | null
  refreshToken:       string | null
  expiresAt:          string | null
  lastSyncedAt:       string | null
  lastError:          string | null
  connectedByEmail:   string | null
  storage:            'database' | 'metadata'
}

export interface ConnectionInput {
  tenantId: string
  provider: Provider
  accountId: string | null
  accountName?: string | null
  accessToken: string
  refreshToken?: string | null
  expiresAt?: string | null
  connectedBy?: string | null
  connectedByEmail?: string | null
}

type Row = Record<string, string | null>
const sealedOf = (r: Row, k: string): Sealed | null => (r[`${k}_enc`] && r[`${k}_iv`] && r[`${k}_tag`] ? { enc: r[`${k}_enc`]!, iv: r[`${k}_iv`]!, tag: r[`${k}_tag`]! } : null)
const openOr = (s: Sealed | null) => { try { return s ? open(s) : null } catch { return null } }

function fromRow(r: Row): Connection {
  return {
    id: r.id!, tenantId: r.tenant_id!, provider: r.provider as Provider, status: (r.status as Connection['status']) ?? 'connected',
    accountId: r.external_account_id, accountName: r.external_account_name,
    accessToken: openOr(sealedOf(r, 'access_token')), refreshToken: openOr(sealedOf(r, 'refresh_token')),
    expiresAt: r.expires_at, lastSyncedAt: r.last_synced_at, lastError: r.last_error,
    connectedByEmail: r.connected_by_email, storage: 'database',
  }
}

// ── Fallback: the admin's auth metadata (the layout used before migration 003) ──

interface MetaRecord {
  connected_at?: string; account_id?: string; account_name?: string; expires_at?: string; last_synced_at?: string
  encrypted?: string; iv?: string; tag?: string; refresh_encrypted?: string; refresh_iv?: string; refresh_tag?: string
}

async function metaConnections(tenantId: string): Promise<Connection[]> {
  const admin = adminClient()
  if (!admin) return []
  const { data } = await admin.auth.admin.getUserById(tenantId)
  const all = ((data?.user?.user_metadata ?? {})._connections ?? {}) as Record<string, MetaRecord>
  return Object.entries(all)
    .filter(([p, r]) => ['plaid', 'quickbooks', 'xero', 'gusto'].includes(p) && r.encrypted)
    .map(([p, r]) => ({
      id: `meta:${p}`, tenantId, provider: p as Provider, status: 'connected' as const,
      accountId: r.account_id ?? null, accountName: r.account_name ?? null,
      accessToken: openOr(r.encrypted && r.iv && r.tag ? { enc: r.encrypted, iv: r.iv, tag: r.tag } : null),
      refreshToken: openOr(r.refresh_encrypted && r.refresh_iv && r.refresh_tag ? { enc: r.refresh_encrypted, iv: r.refresh_iv, tag: r.refresh_tag } : null),
      expiresAt: r.expires_at ?? null, lastSyncedAt: r.last_synced_at ?? null, lastError: null, connectedByEmail: null, storage: 'metadata' as const,
    }))
}

async function writeMeta(tenantId: string, provider: Provider, rec: MetaRecord | null) {
  const admin = adminClient()
  if (!admin) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  const { data } = await admin.auth.admin.getUserById(tenantId)
  const meta = (data?.user?.user_metadata ?? {}) as Record<string, unknown>
  const all = { ...((meta._connections ?? {}) as Record<string, MetaRecord>) }
  if (rec) all[provider] = rec; else delete all[provider]
  const { error } = await admin.auth.admin.updateUserById(tenantId, { user_metadata: { ...meta, _connections: all } })
  if (error) throw error
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function listConnections(tenantId: string): Promise<Connection[]> {
  const admin = adminClient()
  if (!admin) return []
  const { data, error } = await admin.from('integration_connections').select('*').eq('tenant_id', tenantId).neq('status', 'revoked')
  if (tableMissing(error)) return metaConnections(tenantId)
  if (error) throw error
  const rows = (data ?? []).map(r => fromRow(r as Row))
  // Anything still in metadata from before the migration is shown too, and moved on its next save.
  const legacy = (await metaConnections(tenantId)).filter(m => !rows.some(r => r.provider === m.provider))
  return [...rows, ...legacy]
}

export async function getConnection(tenantId: string, id: string): Promise<Connection | null> {
  return (await listConnections(tenantId)).find(c => c.id === id) ?? null
}

export async function saveConnection(input: ConnectionInput): Promise<void> {
  const admin = adminClient()
  if (!admin) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  const a = seal(input.accessToken)
  const r = input.refreshToken ? seal(input.refreshToken) : null
  const row = {
    tenant_id: input.tenantId, provider: input.provider, status: 'connected',
    external_account_id: input.accountId ?? '', external_account_name: input.accountName ?? null,
    access_token_enc: a.enc, access_token_iv: a.iv, access_token_tag: a.tag,
    refresh_token_enc: r?.enc ?? null, refresh_token_iv: r?.iv ?? null, refresh_token_tag: r?.tag ?? null,
    expires_at: input.expiresAt ?? null, last_error: null,
    connected_by: input.connectedBy ?? null, connected_by_email: input.connectedByEmail ?? null,
    updated_at: new Date().toISOString(),
  }
  const { error } = await admin.from('integration_connections').upsert(row, { onConflict: 'tenant_id,provider,external_account_id' })
  if (tableMissing(error)) {
    return writeMeta(input.tenantId, input.provider, {
      connected_at: new Date().toISOString(), account_id: input.accountId ?? undefined, account_name: input.accountName ?? undefined,
      encrypted: a.enc, iv: a.iv, tag: a.tag, refresh_encrypted: r?.enc, refresh_iv: r?.iv, refresh_tag: r?.tag, expires_at: input.expiresAt ?? undefined,
    })
  }
  if (error) throw error
  // Moved into the table: drop any copy left in metadata.
  await writeMeta(input.tenantId, input.provider, null).catch(() => undefined)
}

/** Store refreshed tokens after a provider rotates them (QuickBooks rotates the refresh token every time). */
export async function updateTokens(c: Connection, accessToken: string, refreshToken: string | null, expiresAt: string | null) {
  if (c.storage === 'metadata') {
    return saveConnection({ tenantId: c.tenantId, provider: c.provider, accountId: c.accountId, accountName: c.accountName, accessToken, refreshToken: refreshToken ?? c.refreshToken, expiresAt })
  }
  const admin = adminClient()!
  const a = seal(accessToken)
  const r = refreshToken ? seal(refreshToken) : null
  await admin.from('integration_connections').update({
    access_token_enc: a.enc, access_token_iv: a.iv, access_token_tag: a.tag,
    ...(r ? { refresh_token_enc: r.enc, refresh_token_iv: r.iv, refresh_token_tag: r.tag } : {}),
    expires_at: expiresAt, updated_at: new Date().toISOString(),
  }).eq('id', c.id)
}

export async function markSynced(c: Connection, error: string | null) {
  if (c.storage === 'metadata') return
  const admin = adminClient()!
  await admin.from('integration_connections').update({
    ...(error ? { status: 'error', last_error: error.slice(0, 500) } : { status: 'connected', last_error: null, last_synced_at: new Date().toISOString() }),
    updated_at: new Date().toISOString(),
  }).eq('id', c.id)
}

export async function deleteConnection(c: Connection) {
  if (c.storage === 'metadata') return writeMeta(c.tenantId, c.provider, null)
  const admin = adminClient()!
  await admin.from('integration_connections').delete().eq('id', c.id)
}

/** Whether migration 003 has run, so the app can say where data is kept. */
export async function databaseReady(): Promise<boolean> {
  const admin = adminClient()
  if (!admin) return false
  const { error } = await admin.from('integration_connections').select('id').limit(1)
  return !error
}
