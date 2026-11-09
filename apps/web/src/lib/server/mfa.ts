// Whether THIS session has passed its second factor.
//
// Signing in with a password happens in the browser against Supabase, and it
// hands back a complete session straight away. So "the user typed a code
// afterwards" proves nothing unless the server remembers it. It remembers it
// here, in two ways only the server can write:
//
//   - TOTP (authenticator app): Supabase raises the session's `aal` claim to
//     "aal2" when the factor is verified.
//   - Emailed code: /api/verify-mfa adds the session's id to
//     `app_metadata.mfa_sessions`. app_metadata cannot be edited by the user,
//     and a new sign-in is a new session id, so it needs a new code.
//
// Pure and dependency free, so the middleware (edge) and the API routes share
// one definition and the tests can run it directly.
import type { User } from '@supabase/supabase-js'

export interface SessionClaims { sessionId: string | null; aal: string | null }

/** How many signed-in sessions per account remember their MFA pass. */
const KEEP_SESSIONS = 10

/**
 * Reads the claims of an access token WITHOUT verifying it. Only call this
 * on a token that `supabase.auth.getUser()` has just accepted.
 */
export function claimsFromToken(token: string | null | undefined): SessionClaims {
  const none: SessionClaims = { sessionId: null, aal: null }
  const part = token?.split('.')[1]
  if (!part) return none
  try {
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=')
    const claims = JSON.parse(atob(b64)) as Record<string, unknown>
    return {
      sessionId: typeof claims.session_id === 'string' ? claims.session_id : null,
      aal:       typeof claims.aal === 'string' ? claims.aal : null,
    }
  } catch {
    return none
  }
}

/** True when the account has an authenticator app enrolled and confirmed. */
export function hasVerifiedTotp(user: Pick<User, 'factors'>): boolean {
  return (user.factors ?? []).some(f => f.factor_type === 'totp' && f.status === 'verified')
}

/** The second factor has been passed in this session. */
export function mfaPassed(user: Pick<User, 'factors' | 'app_metadata'>, claims: SessionClaims): boolean {
  if (claims.aal === 'aal2') return true
  // Someone who enrolled an authenticator must use it: an emailed code must
  // not be a way around it.
  if (hasVerifiedTotp(user)) return false
  const passed = (user.app_metadata ?? {}).mfa_sessions
  return !!claims.sessionId && Array.isArray(passed) && passed.includes(claims.sessionId)
}

/** app_metadata with this session recorded as having passed MFA. */
export function withMfaSession(app: Record<string, unknown> | null | undefined, sessionId: string): Record<string, unknown> {
  const prior = Array.isArray(app?.mfa_sessions) ? (app!.mfa_sessions as unknown[]).filter((s): s is string => typeof s === 'string') : []
  return {
    ...(app ?? {}),
    mfa_sessions: [...prior.filter(s => s !== sessionId), sessionId].slice(-KEEP_SESSIONS),
    mfa_challenge: null,
  }
}
