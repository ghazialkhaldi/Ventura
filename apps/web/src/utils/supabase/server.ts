import { createServerClient } from '@supabase/ssr'
import type { GetServerSidePropsContext } from 'next'
import type { NextApiRequest, NextApiResponse } from 'next'
import { appendCookies } from './cookies'

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
          // See ./cookies.ts. Every rule there exists because breaking it
          // killed the session with a "Session not found" on the next request.
          appendCookies(context.res, cookiesToSet)
        },
      },
    }
  )
}
