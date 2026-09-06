/**
 * Set-Cookie handling for the server side Supabase client.
 *
 * Extracted so the behaviour can be tested directly. Three things have each
 * broken the session here, and all three are guarded below.
 */

export interface CookieToSet {
  name:     string
  value:    string
  options?: Record<string, unknown>
}

/** Minimal shape of the bits of a Node response we touch. */
export interface HeaderSink {
  getHeader(name: string): number | string | string[] | undefined
  setHeader(name: string, value: string | string[]): unknown
}

/**
 * Serialise one cookie, honouring the options Supabase supplies.
 *
 * Do NOT hardcode flags here. In particular HttpOnly must only be set when
 * Supabase asks for it: @supabase/ssr's browser client reads and writes the
 * auth cookie through document.cookie, so forcing HttpOnly blinds the browser
 * client, and because refresh tokens are single use the server and browser
 * then diverge and the session dies.
 */
export function serializeCookie({ name, value, options }: CookieToSet): string {
  const parts = [`${name}=${value}`, `Path=${(options?.path as string) ?? '/'}`]

  if (options?.domain)               parts.push(`Domain=${options.domain as string}`)
  if (options?.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge as number}`)
  if (options?.expires)              parts.push(`Expires=${new Date(options.expires as string | number | Date).toUTCString()}`)

  // sameSite may arrive as a boolean; a bare `SameSite=true` is not a valid
  // attribute and browsers drop the whole cookie.
  const ss = options?.sameSite
  parts.push(`SameSite=${typeof ss === 'string' ? ss : 'Lax'}`)

  if (options?.secure)   parts.push('Secure')
  if (options?.httpOnly) parts.push('HttpOnly')

  return parts.join('; ')
}

/**
 * Merge a batch of cookies into the response's Set-Cookie header.
 *
 * res.setHeader REPLACES rather than appends, and Supabase may call setAll
 * more than once per request. Writing each batch directly meant a later batch
 * silently discarded an earlier one.
 *
 * That is what produced "@supabase/ssr: chunked cookie decoded to invalid
 * JSON". A large session JWT is split across sb-<ref>-auth-token.0, .1, .2,
 * and when it shrinks Supabase emits a DELETION for the surplus chunk. If a
 * later write dropped that deletion the stale chunk survived in the browser,
 * and the next read concatenated fresh chunks with an old one, yielding
 * garbage and an absent session.
 *
 * Merging by cookie name keeps every instruction, with later writes winning
 * per name so deletions are never lost.
 */
export function appendCookies(res: HeaderSink, cookiesToSet: CookieToSet[]): void {
  const existing = res.getHeader('Set-Cookie')
  const prior: string[] = Array.isArray(existing)
    ? existing.map(String)
    : typeof existing === 'string' ? [existing] : []

  const byName = new Map<string, string>()
  for (const c of prior)        byName.set(c.split('=')[0].trim(), c)
  for (const c of cookiesToSet) byName.set(c.name, serializeCookie(c))

  if (byName.size > 0) res.setHeader('Set-Cookie', [...byName.values()])
}
