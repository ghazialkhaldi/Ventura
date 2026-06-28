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
          cookiesToSet.forEach(({ name, value, options }) => {
            const maxAge = options?.maxAge ?? 60 * 60 * 24 * 365
            const parts = [
              `${name}=${value}`,
              'Path=/',
              'HttpOnly',
              'SameSite=Lax',
              `Max-Age=${maxAge}`,
              ...(options?.secure ? ['Secure'] : []),
            ]
            context.res.setHeader('Set-Cookie', parts.join('; '))
          })
        },
      },
    }
  )
}
