// Server-only. Talks to each provider's API: tokens, refresh, and paged
// transaction fetches. Pages are bounded so one request stays well inside a
// serverless time and response limit; the client asks again with the cursor
// until there is none.
import type { StoredTransaction } from '../dataStore'
import { mapQuickBooks, mapXero, mapPlaid, mapGusto, type QbEntity, type QbTxn, type XeroDoc, type PlaidTxn, type PlaidAccount, type GustoPayroll } from '../integrations/mappers'
import { updateTokens, type Connection, type Provider } from './connectionStore'
import { hasEncryptionKey } from './crypto'

const env = (k: string) => process.env[k] ?? ''
const appUrl = () => env('NEXT_PUBLIC_APP_URL').replace(/\/$/, '')

export interface ProviderInfo {
  id: Provider
  name: string
  kind: 'oauth' | 'plaid'
  /** What is missing on the server before customers can connect, in plain words. */
  missing: string[]
}

export function providerInfo(): ProviderInfo[] {
  const base: string[] = []
  if (!hasEncryptionKey()) base.push('TOKEN_ENCRYPTION_KEY')
  if (!env('SUPABASE_SERVICE_ROLE_KEY')) base.push('SUPABASE_SERVICE_ROLE_KEY')
  const need = (...keys: string[]) => [...base, ...keys.filter(k => !env(k))]
  return [
    { id: 'plaid',      name: 'Bank and card accounts (Plaid)', kind: 'plaid', missing: need('PLAID_CLIENT_ID', 'PLAID_SECRET') },
    { id: 'quickbooks', name: 'QuickBooks Online',             kind: 'oauth', missing: need('QUICKBOOKS_CLIENT_ID', 'QUICKBOOKS_CLIENT_SECRET') },
    { id: 'xero',       name: 'Xero',                          kind: 'oauth', missing: need('XERO_CLIENT_ID', 'XERO_CLIENT_SECRET') },
    { id: 'gusto',      name: 'Gusto payroll',                 kind: 'oauth', missing: need('GUSTO_CLIENT_ID', 'GUSTO_CLIENT_SECRET') },
  ]
}

// ── OAuth settings ────────────────────────────────────────────────────────────

export interface OAuthSettings { authUrl: string; tokenUrl: string; clientId: string; clientSecret: string; redirectUri: string; scope: string; basicAuth: boolean; pkce: boolean }

export function oauthSettings(p: Provider): OAuthSettings | null {
  const redirect = (k: string, path: string) => env(k) || `${appUrl()}/api/oauth/callback/${path}`
  switch (p) {
    case 'quickbooks': return {
      authUrl: 'https://appcenter.intuit.com/connect/oauth2', tokenUrl: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
      clientId: env('QUICKBOOKS_CLIENT_ID'), clientSecret: env('QUICKBOOKS_CLIENT_SECRET'), redirectUri: redirect('QUICKBOOKS_REDIRECT_URI', 'quickbooks'),
      scope: 'com.intuit.quickbooks.accounting', basicAuth: true, pkce: false,
    }
    case 'xero': return {
      authUrl: 'https://login.xero.com/identity/connect/authorize', tokenUrl: 'https://identity.xero.com/connect/token',
      clientId: env('XERO_CLIENT_ID'), clientSecret: env('XERO_CLIENT_SECRET'), redirectUri: redirect('XERO_REDIRECT_URI', 'xero'),
      scope: 'openid profile email offline_access accounting.transactions.read accounting.settings.read', basicAuth: true, pkce: true,
    }
    case 'gusto': return {
      authUrl: `${gustoBase()}/oauth/authorize`, tokenUrl: `${gustoBase()}/oauth/token`,
      clientId: env('GUSTO_CLIENT_ID'), clientSecret: env('GUSTO_CLIENT_SECRET'), redirectUri: redirect('GUSTO_REDIRECT_URI', 'gusto'),
      scope: '', basicAuth: false, pkce: false,
    }
    default: return null
  }
}

export interface TokenSet { access_token: string; refresh_token?: string; expires_in?: number }

/** Exchange an authorisation code, or refresh, at a provider's token endpoint. */
export async function tokenRequest(s: OAuthSettings, params: Record<string, string>): Promise<TokenSet> {
  const body = new URLSearchParams(params)
  const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }
  if (s.basicAuth) headers.Authorization = `Basic ${Buffer.from(`${s.clientId}:${s.clientSecret}`).toString('base64')}`
  else { body.set('client_id', s.clientId); body.set('client_secret', s.clientSecret) }
  const r = await fetch(s.tokenUrl, { method: 'POST', headers, body })
  if (!r.ok) throw new Error(`Token request failed (${r.status}): ${(await r.text()).slice(0, 200)}`)
  return r.json()
}

const expiresAt = (t: TokenSet) => (t.expires_in ? new Date(Date.now() + t.expires_in * 1000 - 60_000).toISOString() : null)

/** A valid access token, refreshed first when it has expired. */
async function accessToken(c: Connection, force = false): Promise<string> {
  if (!c.accessToken) throw new Error('This connection has no stored token. Reconnect it.')
  const expired = c.expiresAt ? Date.parse(c.expiresAt) <= Date.now() : false
  if (!force && !expired) return c.accessToken
  const s = oauthSettings(c.provider)
  if (!s || !c.refreshToken) return c.accessToken
  const extra: Record<string, string> = c.provider === 'gusto' ? { redirect_uri: s.redirectUri } : {}
  const t = await tokenRequest(s, { grant_type: 'refresh_token', refresh_token: c.refreshToken, ...extra })
  c.accessToken = t.access_token
  c.refreshToken = t.refresh_token ?? c.refreshToken
  c.expiresAt = expiresAt(t)
  await updateTokens(c, t.access_token, t.refresh_token ?? null, c.expiresAt)
  return t.access_token
}

/** GET a provider URL with a bearer token, refreshing once on a 401. */
async function getJson<T>(c: Connection, url: string, headers: Record<string, string> = {}): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await accessToken(c, attempt === 1)
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...headers } })
    if (r.status === 401 && attempt === 0) continue
    if (!r.ok) throw new Error(`${c.provider} request failed (${r.status}): ${(await r.text()).slice(0, 200)}`)
    return r.json() as Promise<T>
  }
  throw new Error(`${c.provider} rejected the stored token. Reconnect it.`)
}

// ── Account details captured at connect time ─────────────────────────────────

export async function describeAccount(p: Provider, token: string, hint: string | null): Promise<{ id: string | null; name: string | null }> {
  try {
    if (p === 'quickbooks' && hint) {
      const r = await fetch(`${qbBase()}/v3/company/${hint}/companyinfo/${hint}?minorversion=75`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
      const j = r.ok ? await r.json() : null
      return { id: hint, name: j?.CompanyInfo?.CompanyName ?? null }
    }
    if (p === 'xero') {
      const r = await fetch('https://api.xero.com/connections', { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
      const list = r.ok ? ((await r.json()) as { tenantId: string; tenantName: string; tenantType: string }[]) : []
      const org = list.find(t => t.tenantType === 'ORGANISATION') ?? list[0]
      return { id: org?.tenantId ?? null, name: org?.tenantName ?? null }
    }
    if (p === 'gusto') {
      const r = await fetch(`${gustoBase()}/v1/token_info`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'X-Gusto-API-Version': '2024-04-01' } })
      const j = r.ok ? await r.json() : null
      return { id: j?.resource?.uuid ?? null, name: null }
    }
  } catch (e) { console.error(`[providers] describeAccount ${p}:`, e) }
  return { id: hint, name: null }
}

// ── Paged transaction fetches ────────────────────────────────────────────────

export interface SyncPage { transactions: StoredTransaction[]; cursor: string | null }

const qbBase = () => (env('QUICKBOOKS_ENVIRONMENT') === 'sandbox' ? 'https://sandbox-quickbooks.api.intuit.com' : 'https://quickbooks.api.intuit.com')
const gustoBase = () => (env('GUSTO_ENVIRONMENT') === 'demo' ? 'https://api.gusto-demo.com' : 'https://api.gusto.com')
const plaidBase = () => `https://${env('PLAID_ENV') || 'sandbox'}.plaid.com`

export async function fetchPage(c: Connection, cursor: string | null, since: string): Promise<SyncPage> {
  switch (c.provider) {
    case 'quickbooks': return quickbooksPage(c, cursor, since)
    case 'xero':       return xeroPage(c, cursor, since)
    case 'plaid':      return plaidPage(c, cursor, since)
    case 'gusto':      return gustoPage(c, since)
  }
}

const QB_ENTITIES: QbEntity[] = ['Purchase', 'Bill', 'VendorCredit']

async function quickbooksPage(c: Connection, cursor: string | null, since: string): Promise<SyncPage> {
  if (!c.accountId) throw new Error('This QuickBooks connection has no company id. Reconnect it.')
  let { e, p } = cursor ? JSON.parse(cursor) as { e: number; p: number } : { e: 0, p: 1 }
  const out: StoredTransaction[] = []
  for (let calls = 0; calls < 5 && e < QB_ENTITIES.length; calls++) {
    const entity = QB_ENTITIES[e]
    const q = `SELECT * FROM ${entity} WHERE TxnDate >= '${since}' STARTPOSITION ${p} MAXRESULTS 1000`
    const j = await getJson<{ QueryResponse?: Record<string, QbTxn[]> }>(c, `${qbBase()}/v3/company/${c.accountId}/query?query=${encodeURIComponent(q)}&minorversion=75`)
    const recs = j.QueryResponse?.[entity] ?? []
    out.push(...mapQuickBooks(entity, recs))
    if (recs.length < 1000) { e++; p = 1 } else p += 1000
  }
  return { transactions: out, cursor: e < QB_ENTITIES.length ? JSON.stringify({ e, p }) : null }
}

const XERO_KINDS = [
  { kind: 'bill' as const,   path: 'Invoices',         where: 'Type=="ACCPAY"',       key: 'Invoices' },
  { kind: 'credit' as const, path: 'CreditNotes',      where: 'Type=="ACCPAYCREDIT"', key: 'CreditNotes' },
  { kind: 'spend' as const,  path: 'BankTransactions', where: 'Type=="SPEND"',        key: 'BankTransactions' },
]

async function xeroPage(c: Connection, cursor: string | null, since: string): Promise<SyncPage> {
  if (!c.accountId) throw new Error('This Xero connection has no organisation. Reconnect it.')
  const headers = { 'xero-tenant-id': c.accountId }
  let { k, page } = cursor ? JSON.parse(cursor) as { k: number; page: number } : { k: 0, page: 1 }
  // Account codes become names when the connection may read them.
  let accounts: Record<string, string> = {}
  try {
    const j = await getJson<{ Accounts?: { Code?: string; Name?: string }[] }>(c, 'https://api.xero.com/api.xro/2.0/Accounts', headers)
    accounts = Object.fromEntries((j.Accounts ?? []).filter(a => a.Code).map(a => [a.Code!, a.Name ?? a.Code!]))
  } catch { /* names are a nicety */ }
  const [y, m, d] = since.split('-').map(Number)
  const out: StoredTransaction[] = []
  for (let calls = 0; calls < 8 && k < XERO_KINDS.length; calls++) {
    const x = XERO_KINDS[k]
    const where = encodeURIComponent(`${x.where} AND Date>=DateTime(${y},${m},${d})`)
    const j = await getJson<Record<string, XeroDoc[]>>(c, `https://api.xero.com/api.xro/2.0/${x.path}?where=${where}&page=${page}`, headers)
    const docs = j[x.key] ?? []
    out.push(...mapXero(x.kind, docs, accounts))
    if (docs.length < 100) { k++; page = 1 } else page++
  }
  return { transactions: out, cursor: k < XERO_KINDS.length ? JSON.stringify({ k, page }) : null }
}

async function plaidPage(c: Connection, cursor: string | null, since: string): Promise<SyncPage> {
  let next = cursor ?? ''
  const out: StoredTransaction[] = []
  for (let calls = 0; calls < 8; calls++) {
    const j = await plaidPost<{ added: PlaidTxn[]; modified: PlaidTxn[]; accounts: PlaidAccount[]; next_cursor: string; has_more: boolean }>('/transactions/sync', {
      access_token: c.accessToken, cursor: next || undefined, count: 500,
    })
    out.push(...mapPlaid([...j.added, ...j.modified], j.accounts ?? []).filter(t => !t.date || t.date >= since))
    next = j.next_cursor
    if (!j.has_more) return { transactions: out, cursor: null }
  }
  return { transactions: out, cursor: next }
}

async function gustoPage(c: Connection, since: string): Promise<SyncPage> {
  if (!c.accountId) throw new Error('This Gusto connection has no company. Reconnect it.')
  const today = new Date().toISOString().slice(0, 10)
  const j = await getJson<GustoPayroll[]>(c, `${gustoBase()}/v1/companies/${c.accountId}/payrolls?processing_statuses=processed&include=totals&start_date=${since}&end_date=${today}`, { 'X-Gusto-API-Version': '2024-04-01' })
  return { transactions: mapGusto(Array.isArray(j) ? j : []), cursor: null }
}

// ── Plaid ────────────────────────────────────────────────────────────────────

export async function plaidPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const r = await fetch(`${plaidBase()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: env('PLAID_CLIENT_ID'), secret: env('PLAID_SECRET'), ...body }),
  })
  const j = await r.json()
  if (!r.ok) {
    const code = j?.error_code as string | undefined
    if (code === 'PRODUCT_NOT_READY') throw new Error('The bank is still preparing transaction history. Try the sync again in a minute.')
    if (code === 'ITEM_LOGIN_REQUIRED') throw new Error('The bank needs you to sign in again. Reconnect this account.')
    throw new Error(j?.error_message ?? `Plaid request failed (${r.status})`)
  }
  return j as T
}

/** Revoke access at the provider when a connection is removed. Best effort. */
export async function revoke(c: Connection) {
  try {
    if (c.provider === 'plaid' && c.accessToken) await plaidPost('/item/remove', { access_token: c.accessToken })
    if (c.provider === 'quickbooks' && c.refreshToken) {
      const s = oauthSettings('quickbooks')!
      await fetch('https://developer.api.intuit.com/v2/oauth2/tokens/revoke', {
        method: 'POST',
        headers: { Authorization: `Basic ${Buffer.from(`${s.clientId}:${s.clientSecret}`).toString('base64')}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ token: c.refreshToken }),
      })
    }
    if (c.provider === 'xero' && c.refreshToken) {
      const s = oauthSettings('xero')!
      await fetch('https://identity.xero.com/connect/revocation', {
        method: 'POST',
        headers: { Authorization: `Basic ${Buffer.from(`${s.clientId}:${s.clientSecret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: c.refreshToken }),
      })
    }
  } catch (e) { console.error(`[providers] revoke ${c.provider}:`, e) }
}
