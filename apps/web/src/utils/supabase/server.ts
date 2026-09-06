import { createServerClient } from '@supabase/ssr'
import type { GetServerSidePropsContext } from 'next'
import type { NextApiRequest, NextApiResponse } from 'next'

type PageContext = GetServerSidePropsContext
type ApiContext = { req: NextApiRequest; res: NextApiResponse }

export function createClient(context: PageContext | ApiContext) {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key!,
    {
      cookies: {
        getAll() {
          return Object.keys(context.req.cookies).map(name => ({
            name,
            value: context.req.cookies[name] ?? '',
          }))
        },
        setAll(cookiesToSet) {
          // Two things matter here, and getting either wrong kills the
          // session with a "Session not found" on the next request.
          //
          // 1. Build the whole array and call setHeader ONCE. Supabase often
          //    writes several cookies at a time (a refresh, or a session JWT
          //    chunked across cookies to stay under the ~4KB limit).
          //    res.setHeader called per cookie in a loop REPLACES the header
          //    each time rather than appending, so only the last cookie would
          //    survive and the rest were silently dropped.
          //
          // 2. Honour the options Supabase passes instead of hardcoding
          //    flags. In particular do NOT force HttpOnly: @supabase/ssr's
          //    browser client reads and writes the auth cookie through
          //    document.cookie, so it has to stay readable from JavaScript.
          //    Forcing HttpOnly here blinded the browser client the first
          //    time any API route refreshed the token, and because refresh
          //    tokens are single use, the server and browser then diverged
          //    and the session died. middleware.ts passes options through
          //    untouched; this needs to match it.
          const cookieStrings = cookiesToSet.map(({ name, value, options }) => {
            const parts = [`${name}=${value}`, `Path=${options?.path ?? '/'}`]
            if (options?.domain)                parts.push(`Domain=${options.domain}`)
            if (options?.maxAge !== undefined)  parts.push(`Max-Age=${options.maxAge}`)
            if (options?.expires)               parts.push(`Expires=${new Date(options.expires).toUTCString()}`)
            // sameSite may arrive as a boolean rather than a string; a bare
            // `SameSite=true` is not a valid attribute and browsers drop it.
            const ss = options?.sameSite
            parts.push(`SameSite=${typeof ss === 'string' ? ss : 'Lax'}`)
            if (options?.secure)                parts.push('Secure')
            if (options?.httpOnly)              parts.push('HttpOnly')
            return parts.join('; ')
          })
          if (cookieStrings.length > 0) {
            context.res.setHeader('Set-Cookie', cookieStrings)
          }
        },
      },
    }
  )
}
