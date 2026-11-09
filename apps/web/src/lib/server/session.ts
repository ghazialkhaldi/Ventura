// Server-only. Who is signed in, and have they passed their second factor.
import type { NextApiRequest, NextApiResponse } from 'next'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createClient } from '../../utils/supabase/server'
import { claimsFromToken, mfaPassed, type SessionClaims } from './mfa'

export interface ApiSession {
  user:     User
  claims:   SessionClaims
  /** The second factor has been passed in THIS session. */
  mfa:      boolean
  /**
   * The client that read the session. Reuse it for any write to the user's own
   * account in the same request: a second client would start from the same
   * single-use refresh token and can kill the session.
   */
  supabase: SupabaseClient
}

/** The signed-in user, whether or not MFA has been passed. Null if signed out. */
export async function getSession(req: NextApiRequest, res: NextApiResponse): Promise<ApiSession | null> {
  const supabase = createClient({ req, res })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  // getUser() has just validated the token with Supabase; this only reads its
  // claims (the session id and the assurance level).
  const { data: { session } } = await supabase.auth.getSession()
  const claims = claimsFromToken(session?.access_token)
  return { user, claims, mfa: mfaPassed(user, claims), supabase }
}

/**
 * For routes that act as the signed-in user: replies 401 and returns null
 * unless they are signed in AND have passed MFA.
 */
export async function requireSession(req: NextApiRequest, res: NextApiResponse): Promise<ApiSession | null> {
  const s = await getSession(req, res)
  if (!s || !s.mfa) {
    res.status(401).json({ error: 'Not authenticated' })
    return null
  }
  return s
}
