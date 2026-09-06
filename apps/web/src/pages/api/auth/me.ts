import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '../../../utils/supabase/server'

/**
 * Returns the account the SERVER can see for this request.
 *
 * The browser client reads the session from document.cookie, so if the auth
 * cookie is unreadable from JavaScript the client believes nobody is signed in
 * while the middleware still admits them to protected pages. That leaves the
 * app rendering with no profile: placeholder initials, no company, no data.
 * This endpoint lets the client recover the profile from the server's view of
 * the session instead of depending on cookie visibility.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient({ req, res })
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email) {
    // No readable session, yet Supabase cookies are present: they are stale or
    // corrupt, most likely chunks left over from an earlier bad write. Left
    // alone they keep decoding to nothing on every request, so expire them and
    // let the visitor sign in cleanly instead of getting stuck.
    const stale = Object.keys(req.cookies).filter(n => n.startsWith('sb-'))
    if (stale.length > 0) {
      res.setHeader('Set-Cookie', stale.map(n => `${n}=; Path=/; Max-Age=0; SameSite=Lax`))
    }
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const meta = (user.user_metadata || {}) as Record<string, unknown>
  const companyName = typeof meta._company_name === 'string' && meta._company_name.trim()
    ? meta._company_name
    : null

  res.status(200).json({
    email:     user.email,
    fullName:  typeof meta.full_name === 'string' ? meta.full_name : null,
    company:   companyName,
    isEmployee: meta.user_type === 'employee',
  })
}
