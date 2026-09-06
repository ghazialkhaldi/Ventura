import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '../../../utils/supabase/server'

/**
 * Server side sign out.
 *
 * The browser client cannot clear an HttpOnly cookie, so a purely client side
 * signOut() leaves the session alive on the server: the middleware keeps
 * admitting the user to protected pages while the browser sees no profile at
 * all, which strands them on a shell with no data and no way out. Clearing
 * from the server works regardless of the HttpOnly flag.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const supabase = createClient({ req, res })
    await supabase.auth.signOut()
  } catch {
    // Even if Supabase rejects the call (already expired, unreachable), still
    // expire the cookies below so the user is never left stuck.
  }

  // Belt and braces: explicitly expire every Supabase auth cookie on the
  // request, including chunked ones (sb-<ref>-auth-token.0, .1, ...) and any
  // written by older builds with flags the browser client can't undo.
  const expired = Object.keys(req.cookies)
    .filter(name => name.startsWith('sb-'))
    .map(name => `${name}=; Path=/; Max-Age=0; SameSite=Lax`)

  if (expired.length > 0) {
    const existing = res.getHeader('Set-Cookie')
    const prior = Array.isArray(existing)
      ? existing
      : typeof existing === 'string' ? [existing] : []
    res.setHeader('Set-Cookie', [...prior, ...expired])
  }

  res.status(200).json({ ok: true })
}
