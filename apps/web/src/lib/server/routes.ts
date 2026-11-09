// Which pages are public, and which need a signed-in session that has passed
// its second factor. The middleware reads these lists, and a test checks that
// EVERY page under src/pages appears in one of them, so a new page cannot be
// added without deciding which kind it is.
//
// Matching is by whole path segment: '/audit' does NOT cover '/audit-logs'.
// That exact mismatch once left half the app open to anyone.

/** Pages that need a signed-in session that has passed MFA. */
export const PROTECTED_PATHS = [
  '/dashboard',
  '/settings',
  '/anomalies',
  '/anomaly',
  '/workflows',
  '/integrations',
  '/audit-logs',
  '/reports',
  '/uploads',
  '/import-center',
  '/upload-data',
  '/onboarding',
  '/welcome',
]

/** Pages only employees use. */
export const EMPLOYEE_PATHS = ['/employee-dashboard']

/**
 * Pages anyone may open. Each one either holds no private data or does its own
 * checking (the sign-in pages, and /join, which an invited employee reaches
 * while still finishing signing in).
 */
export const PUBLIC_PATHS = [
  '/', '/about', '/contact', '/demo', '/docs', '/privacy', '/terms', '/security',
  '/login', '/signup', '/forgot-password', '/employee-login', '/join',
  '/404', '/500',
]

const within = (list: string[], pathname: string) =>
  list.some(p => pathname === p || pathname.startsWith(p + '/'))

export const isProtected    = (pathname: string) => within(PROTECTED_PATHS, pathname)
export const isEmployeePage = (pathname: string) => within(EMPLOYEE_PATHS, pathname)
export const isPublicPage   = (pathname: string) => PUBLIC_PATHS.includes(pathname)
