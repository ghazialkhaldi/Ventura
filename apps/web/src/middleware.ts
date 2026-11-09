import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { claimsFromToken, mfaPassed } from './lib/server/mfa'
import { isProtected, isEmployeePage } from './lib/server/routes'

// Routes that should redirect authenticated users away (e.g. login)
const AUTH_PATHS = ['/login', '/signup', '/']

function isAuthPage(pathname: string): boolean {
  return AUTH_PATHS.includes(pathname)
}

function applySecurityHeaders(response: NextResponse): NextResponse {
  const h = response.headers

  // Prevent clickjacking
  h.set('X-Frame-Options', 'DENY')

  // Disable MIME sniffing
  h.set('X-Content-Type-Options', 'nosniff')

  // Force HTTPS for 2 years (only meaningful in production)
  h.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')

  // Referrer policy — don't leak full URL cross-origin
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Disable dangerous browser features
  h.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=()'
  )

  // Content Security Policy. `next dev` evaluates its bundles with eval() and is
  // served over plain http, so local development needs 'unsafe-eval' and must
  // not upgrade requests; production keeps the strict policy.
  const isDev = process.env.NODE_ENV === 'development'
  h.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      isDev
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.plaid.com"
        : "script-src 'self' 'unsafe-inline' https://cdn.plaid.com",   // unsafe-inline needed for Next.js inline scripts; Plaid Link
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.resend.com https://vitals.vercel-insights.com https://*.plaid.com",
      // Plaid Link runs in its own frame; the customer signs in to their bank there, never on Ventura.
      "frame-src https://cdn.plaid.com",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      ...(isDev ? [] : ["upgrade-insecure-requests"]),
    ].join('; ')
  )

  // Cross-origin isolation — no COEP require-corp: it blocks Google Fonts
  // and other cross-origin resources that don't send CORP headers
  // allow-popups: banks that sign in through Plaid's OAuth flow open a popup.
  h.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups')
  h.set('Cross-Origin-Resource-Policy', 'same-origin')

  // Remove server fingerprinting headers
  h.delete('X-Powered-By')
  h.delete('Server')

  return response
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — IMPORTANT: do not remove, required for SSR auth
  const { data: { user } } = await supabase.auth.getUser()

  // Signing in with a password gives a complete session at once, so a session
  // is only "signed in" here once the SERVER has recorded that it passed its
  // second factor (lib/server/mfa.ts). A password alone is not enough.
  let mfaOk = false
  if (user) {
    const { data: { session } } = await supabase.auth.getSession()
    mfaOk = mfaPassed(user, claimsFromToken(session?.access_token))
  }

  // Redirects MUST carry any refreshed session cookies from supabaseResponse.
  // Supabase refresh tokens are single-use: if getUser() rotated the token and
  // we redirect without the new cookies, the browser keeps dead tokens and the
  // session is permanently lost ("Session not found").
  function redirectTo(pathnameDest: string, opts?: { next?: string }) {
    const url = request.nextUrl.clone()
    url.pathname = pathnameDest
    url.search   = ''
    if (opts?.next) url.searchParams.set('next', opts.next)
    const redirect = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach(c => redirect.cookies.set(c))
    return applySecurityHeaders(redirect)
  }

  // Route protection: unauthenticated users can't access protected paths
  if ((isProtected(pathname) || isEmployeePage(pathname)) && (!user || !mfaOk)) {
    return redirectTo(isEmployeePage(pathname) ? '/employee-login' : '/login', { next: pathname })
  }

  // A half signed-in user (password, no code yet) is left on the sign-in pages
  // to finish, not bounced to the dashboard, which would send them straight back.
  if (user && mfaOk) {
    const meta    = (user.user_metadata || {}) as Record<string, unknown>
    const company = meta._company as Record<string, string> | undefined
    // Older employee accounts lack the user_type tag — having a _company
    // record also marks them as an employee.
    const isEmp   = meta.user_type === 'employee' || !!company?.admin_id

    // Employees without a workspace can't access any workspace tabs → /join.
    // Joined employees may browse workspace tabs (read-only enforced in-app),
    // but /settings stays admin-only.
    if (isEmp && isProtected(pathname)) {
      const joined      = !!company?.admin_id
      const isSettings  = pathname === '/settings' || pathname.startsWith('/settings/')
      if (!joined || isSettings) {
        return redirectTo(joined ? '/employee-dashboard' : '/join')
      }
    }

    // Employee without a workspace trying to access employee pages → /join
    if (isEmp && isEmployeePage(pathname) && !company?.admin_id) {
      return redirectTo('/join')
    }

    // Non-employee trying to access employee pages → their dashboard
    if (!isEmp && isEmployeePage(pathname)) {
      return redirectTo('/dashboard')
    }

    // Redirect authenticated admin users away from auth/landing pages to dashboard
    if (isAuthPage(pathname) && !isEmp) {
      return redirectTo('/dashboard')
    }
  }

  return applySecurityHeaders(supabaseResponse)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
