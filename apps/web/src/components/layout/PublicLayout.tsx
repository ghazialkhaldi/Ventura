import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'
import VenturaLogo from '../VenturaLogo'
import { createClient } from '../../utils/supabase/client'

interface PublicLayoutProps {
  children: React.ReactNode
  title?: string
}

interface StoredUser {
  role?:    string
  company?: string
  email?:   string
}

export default function PublicLayout({ children, title }: PublicLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  // Resolved portal destination — only set once the real session is verified,
  // so the button never points somewhere the middleware will bounce it from.
  const [dest, setDest] = useState<{ href: string; label: string } | null>(null)

  useEffect(() => {
    let stored: StoredUser | null = null
    try { stored = JSON.parse(localStorage.getItem('sf_user') ?? 'null') } catch {}
    if (!stored) return

    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      // Stale localStorage with no real session — show logged-out state
      if (!session) {
        localStorage.removeItem('sf_user')
        return
      }
      if (stored?.role === 'employee') {
        try {
          const r = await fetch('/api/team/get-role')
          if (r.ok)                  setDest({ href: '/employee-dashboard', label: 'View dashboard' })
          else if (r.status === 404) setDest({ href: '/join', label: 'Join workspace' })
          else                       localStorage.removeItem('sf_user')
        } catch {
          setDest({ href: '/join', label: 'Join workspace' })
        }
      } else {
        setDest({ href: '/dashboard', label: 'View dashboard' })
      }
    })
  }, [])

  const loggedIn    = !!dest
  const portalHref  = dest?.href  ?? '/dashboard'
  const portalLabel = dest?.label ?? 'View dashboard'

  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  return (
    <>
      <Head>
        <title>{title ? `${title} · Ventura` : 'Ventura · Financial Operations Intelligence'}</title>
      </Head>
      <div className="min-h-screen flex flex-col bg-surface">

        {/* Top nav */}
        <header className="sticky top-0 z-50 bg-surface/95 backdrop-blur border-b border-border">
          <div className="h-16 px-4 sm:px-8 lg:px-12 xl:px-16 2xl:px-20 flex items-center justify-between">
            <Link href="/" className="no-underline" onClick={() => setDrawerOpen(false)}>
              <VenturaLogo variant="light" height={28} />
            </Link>

            {/* Desktop nav */}
            <div className="hidden sm:flex items-center gap-3">
              <Link href="/demo" className="text-sm font-medium text-text-muted hover:text-text-primary transition-colors">
                Demo
              </Link>
              {!loggedIn && (
                <>
                  <Link
                    href="/employee-login"
                    className="text-sm font-semibold text-emerald-400 hover:text-emerald-300 border border-emerald-500/50 hover:border-emerald-400 hover:bg-emerald-500/10 px-4 py-2 rounded-lg transition-colors"
                  >
                    Employee portal
                  </Link>
                  <Link
                    href="/login"
                    className="text-sm font-semibold text-text-secondary hover:text-text-primary border border-border-strong hover:border-border px-4 py-2 rounded-lg transition-colors"
                  >
                    Sign in
                  </Link>
                </>
              )}
              {/* Logged-in employees: show their portal link only, no sign-in links */}
              {loggedIn ? (
                <Link href={portalHref} className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
                  {portalLabel}
                </Link>
              ) : (
                <Link href="/contact" className="bg-accent-500 hover:bg-accent-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
                  Get started
                </Link>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              className="sm:hidden p-2 text-text-secondary hover:text-text-primary hover:bg-surface-overlay transition-colors"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
            >
              <Bars3Icon className="w-6 h-6" />
            </button>
          </div>
        </header>

        {/* Mobile drawer backdrop — below the drawer so it never eats taps on links */}
        {drawerOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-[60] sm:hidden"
            onClick={() => setDrawerOpen(false)}
          />
        )}

        {/* Mobile drawer */}
        <div className={`fixed top-0 right-0 h-full w-72 bg-surface-raised z-[70] flex flex-col shadow-2xl transition-transform duration-200 sm:hidden ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          {/* Drawer header */}
          <div className="h-16 flex items-center justify-between px-5 border-b border-border">
            <VenturaLogo variant="light" height={24} />
            <button
              onClick={() => setDrawerOpen(false)}
              className="p-2 text-text-muted hover:text-text-primary hover:bg-surface-overlay transition-colors"
              aria-label="Close menu"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer links */}
          <nav className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-2">
            <Link
              href="/demo"
              onClick={() => setDrawerOpen(false)}
              className="block px-4 py-3 rounded-lg text-sm font-medium text-text-secondary hover:bg-surface-overlay hover:text-text-primary transition-colors"
            >
              Demo
            </Link>

            {!loggedIn && (
              <>
                <Link
                  href="/employee-login"
                  onClick={() => setDrawerOpen(false)}
                  className="block px-4 py-3 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/30 rounded-lg transition-colors"
                >
                  Employee portal
                </Link>
                <Link
                  href="/login"
                  onClick={() => setDrawerOpen(false)}
                  className="block px-4 py-3 text-sm font-semibold text-text-secondary hover:bg-surface-overlay border border-border rounded-lg transition-colors"
                >
                  Sign in
                </Link>
              </>
            )}

            <div className="mt-2">
              {loggedIn ? (
                <Link
                  href={portalHref}
                  onClick={() => setDrawerOpen(false)}
                  className="block px-4 py-3 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors text-center"
                >
                  {portalLabel}
                </Link>
              ) : (
                <Link
                  href="/contact"
                  onClick={() => setDrawerOpen(false)}
                  className="block px-4 py-3 text-sm font-semibold text-white bg-accent-500 hover:bg-accent-600 rounded-lg transition-colors text-center"
                >
                  Get started
                </Link>
              )}
            </div>
          </nav>
        </div>

        <main className="flex-1">{children}</main>

        {/* Footer */}
        <footer className="bg-surface-sunken text-text-muted py-10 border-t border-border">
          <div className="px-6 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
            <div className="grid md:grid-cols-4 gap-8 mb-8">
              <div>
                <div className="mb-3">
                  <VenturaLogo variant="light" height={20} />
                </div>
                <p className="text-xs text-text-muted leading-relaxed">
                  Financial operations intelligence for enterprise finance teams.
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Product</p>
                <ul className="space-y-2 text-xs">
                  {[
                    { label: 'Anomaly Detection',     href: '/#anomaly'    },
                    { label: 'Workflow Intelligence', href: '/#workflow'   },
                    { label: 'AI Governance',         href: '/#governance' },
                    { label: 'Integrations',          href: '/demo'        },
                  ].map(({ label, href }) => (
                    <li key={label}><Link href={href} className="hover:text-text-primary transition-colors">{label}</Link></li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Company</p>
                <ul className="space-y-2 text-xs">
                  {[
                    { label: 'About',            href: '/about'    },
                    { label: 'Security',         href: '/security' },
                    { label: 'Privacy Policy',   href: '/privacy'  },
                    { label: 'Terms of Service', href: '/terms'    },
                  ].map(({ label, href }) => (
                    <li key={label}><Link href={href} className="hover:text-text-primary transition-colors">{label}</Link></li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Resources</p>
                <ul className="space-y-2 text-xs">
                  {[
                    { label: 'Documentation', href: '/docs'     },
                    { label: 'API Reference', href: '/docs#api' },
                    { label: 'Status',        href: '/status'   },
                    { label: 'Support',       href: '/contact'  },
                  ].map(({ label, href }) => (
                    <li key={label}><Link href={href} className="hover:text-text-primary transition-colors">{label}</Link></li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs">© 2026 Ventura Financial Intelligence, Inc. All rights reserved.</p>
              <div className="flex items-center gap-1 text-xs">
                <Link href="/status" className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 hover:border-emerald-500/50 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  All systems operational
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
