import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that require an authenticated Supabase session
const PROTECTED_PATHS = [
  '/dashboard',
  '/settings',
  '/anomalies',
  '/workflows',
  '/integrations',
  '/governance',
  '/audit',
]

// Routes that should redirect authenticated users away (e.g. login)
const AUTH_PATHS = ['/login', '/signup', '/']

function isProtected(pathname: string): boolean {
  return PROTECTED_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
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
  if (isProtected(pathname) && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', pathname)
    const redirect = NextResponse.redirect(loginUrl)
    return applySecurityHeaders(redirect)
  }

  // Redirect authenticated users away from auth/landing pages to dashboard
  if (isAuthPage(pathname) && user) {
    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = '/dashboard'
    dashboardUrl.search = ''
    const redirect = NextResponse.redirect(dashboardUrl)
    return applySecurityHeaders(redirect)
  }

  return applySecurityHeaders(supabaseResponse)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
