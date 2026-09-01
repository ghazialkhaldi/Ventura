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
          // Supabase often needs to set more than one cookie in a single
          // response (session refresh, or a session JWT chunked across
          // multiple cookies to stay under the ~4KB per-cookie limit).
          // res.setHeader('Set-Cookie', ...) called once per cookie inside a
          // loop REPLACES the header each time instead of appending — only
          // the last cookie in the batch would ever reach the browser, and
          // every earlier one was silently dropped. That corrupts the
          // session on the very first server-side refresh, which is exactly
          // what caused "Session not found" right after a successful
          // sign-in. Node's setHeader accepts an array of values for a
          // single header name and emits one Set-Cookie line per entry —
          // build the full array first, then set it once.
          const cookieStrings = cookiesToSet.map(({ name, value, options }) => {
            const maxAge = options?.maxAge ?? 60 * 60 * 24 * 365
            const parts = [
              `${name}=${value}`,
              'Path=/',
              'HttpOnly',
              'SameSite=Lax',
              `Max-Age=${maxAge}`,
              ...(options?.secure ? ['Secure'] : []),
            ]
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
