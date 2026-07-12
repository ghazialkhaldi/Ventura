import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that require an authenticated Supabase session (admin)
const PROTECTED_PATHS = [
  '/dashboard',
  '/settings',
  '/anomalies',
  '/workflows',
  '/integrations',
  '/governance',
  '/audit',
]

// Routes only employees can access
const EMPLOYEE_PATHS = ['/employee-dashboard']

// Routes that should redirect authenticated users away (e.g. login)
const AUTH_PATHS = ['/login', '/signup', '/']

function isProtected(pathname: string): boolean {
  return PROTECTED_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
}

function isEmployeePage(pathname: string): boolean {
  return EMPLOYEE_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
}

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

  // Content Security Policy
  h.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",   // unsafe-inline needed for Next.js inline scripts
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.resend.com",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join('; ')
  )

  // Cross-origin isolation
  h.set('Cross-Origin-Opener-Policy', 'same-origin')
  h.set('Cross-Origin-Embedder-Policy', 'require-corp')
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

  // Route protection: unauthenticated users can't access protected paths
  if ((isProtected(pathname) || isEmployeePage(pathname)) && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = isEmployeePage(pathname) ? '/employee-login' : '/login'
    loginUrl.searchParams.set('next', pathname)
    return applySecurityHeaders(NextResponse.redirect(loginUrl))
  }

  if (user) {
    const meta    = (user.user_metadata || {}) as Record<string, unknown>
    const isEmp   = meta.user_type === 'employee'
    const company = meta._company as Record<string, string> | undefined

    // Employee trying to access admin routes → redirect to their portal
    if (isEmp && isProtected(pathname)) {
      const dest = request.nextUrl.clone()
      dest.pathname = company?.admin_id ? '/employee-dashboard' : '/join'
      dest.search   = ''
      return applySecurityHeaders(NextResponse.redirect(dest))
    }

    // Employee without a workspace trying to access employee pages → /join
    if (isEmp && isEmployeePage(pathname) && !company?.admin_id) {
      const joinUrl = request.nextUrl.clone()
      joinUrl.pathname = '/join'
      joinUrl.search   = ''
      return applySecurityHeaders(NextResponse.redirect(joinUrl))
    }

    // Non-employee trying to access employee pages → their dashboard
    if (!isEmp && isEmployeePage(pathname)) {
      const dest = request.nextUrl.clone()
      dest.pathname = '/dashboard'
      dest.search   = ''
      return applySecurityHeaders(NextResponse.redirect(dest))
    }

    // Redirect authenticated admin users away from auth/landing pages to dashboard
    if (isAuthPage(pathname) && !isEmp) {
      const dashboardUrl = request.nextUrl.clone()
      dashboardUrl.pathname = '/dashboard'
      dashboardUrl.search   = ''
      return applySecurityHeaders(NextResponse.redirect(dashboardUrl))
    }
  }

  return applySecurityHeaders(supabaseResponse)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
