import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'
import VenturaLogo from '../VenturaLogo'

interface PublicLayoutProps {
  children: React.ReactNode
  title?: string
}

export default function PublicLayout({ children, title }: PublicLayoutProps) {
  const [loggedIn,     setLoggedIn]     = useState(false)
  const [drawerOpen,   setDrawerOpen]   = useState(false)

  useEffect(() => {
    setLoggedIn(!!localStorage.getItem('sf_user'))
  }, [])

  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  return (
    <>
      <Head>
        <title>{title ? `${title} — Ventura` : 'Ventura — Financial Operations Intelligence'}</title>
      </Head>
      <div className="min-h-screen flex flex-col bg-white">

        {/* Top nav */}
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200">
          <div className="h-16 px-4 sm:px-8 lg:px-12 xl:px-16 2xl:px-20 flex items-center justify-between">
            <Link href="/" className="no-underline" onClick={() => setDrawerOpen(false)}>
              <VenturaLogo variant="dark" height={32} />
            </Link>

            {/* Desktop nav */}
            <div className="hidden sm:flex items-center gap-3">
              <Link href="/demo" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
                Demo
              </Link>
              {!loggedIn && (
                <>
                  <Link
                    href="/employee-login"
                    className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 border border-emerald-600 hover:border-emerald-700 hover:bg-emerald-50 px-4 py-2 transition-colors"
                  >
                    Employee portal
                  </Link>
                  <Link
                    href="/login"
                    className="text-sm font-semibold text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-400 px-4 py-2 transition-colors"
                  >
                    Sign in
                  </Link>
                </>
              )}
              {loggedIn ? (
                <Link href="/dashboard" className="bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold px-5 py-2.5 transition-colors">
                  View dashboard
                </Link>
              ) : (
                <Link href="/contact" className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-5 py-2.5 transition-colors">
                  Get started
                </Link>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              className="sm:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
            >
              <Bars3Icon className="w-6 h-6" />
            </button>
          </div>
        </header>

        {/* Mobile drawer backdrop */}
        {drawerOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-50 sm:hidden"
            onClick={() => setDrawerOpen(false)}
          />
        )}

        {/* Mobile drawer */}
        <div className={`fixed top-0 right-0 h-full w-72 bg-white z-50 flex flex-col shadow-2xl transition-transform duration-200 sm:hidden ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          {/* Drawer header */}
          <div className="h-16 flex items-center justify-between px-5 border-b border-slate-200">
            <VenturaLogo variant="dark" height={28} />
            <button
              onClick={() => setDrawerOpen(false)}
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
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
              className="block px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              Demo
            </Link>

            {!loggedIn && (
              <>
                <Link
                  href="/employee-login"
                  onClick={() => setDrawerOpen(false)}
                  className="block px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 border border-emerald-200 transition-colors"
                >
                  Employee portal
                </Link>
                <Link
                  href="/login"
                  onClick={() => setDrawerOpen(false)}
                  className="block px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 border border-slate-200 transition-colors"
                >
                  Sign in
                </Link>
              </>
            )}

            <div className="mt-2">
              {loggedIn ? (
                <Link
                  href="/dashboard"
                  onClick={() => setDrawerOpen(false)}
                  className="block px-4 py-3 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 transition-colors text-center"
                >
                  View dashboard
                </Link>
              ) : (
                <Link
                  href="/contact"
                  onClick={() => setDrawerOpen(false)}
                  className="block px-4 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-colors text-center"
                >
                  Get started
                </Link>
              )}
            </div>
          </nav>
        </div>

        <main className="flex-1">{children}</main>

        {/* Footer */}
        <footer className="bg-slate-900 text-slate-400 py-10">
          <div className="px-6 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
            <div className="grid md:grid-cols-4 gap-8 mb-8">
              <div>
                <div className="mb-3">
                  <VenturaLogo variant="light" height={22} />
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Financial operations intelligence for enterprise finance teams.
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">Product</p>
                <ul className="space-y-2 text-xs">
                  {['Anomaly Detection', 'Workflow Intelligence', 'AI Governance', 'Integrations'].map((l) => (
                    <li key={l}><Link href="#" title="Coming soon" className="hover:text-slate-200 transition-colors">{l}</Link></li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">Company</p>
                <ul className="space-y-2 text-xs">
                  {[
                    { label: 'About',            href: '#'        },
                    { label: 'Security',         href: '#'        },
                    { label: 'Privacy Policy',   href: '/privacy' },
                    { label: 'Terms of Service', href: '#'        },
                  ].map(({ label, href }) => (
                    <li key={label}><Link href={href} title={href === '#' ? 'Coming soon' : undefined} className="hover:text-slate-200 transition-colors">{label}</Link></li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">Resources</p>
                <ul className="space-y-2 text-xs">
                  {['Documentation', 'API Reference', 'Status', 'Support'].map((l) => (
                    <li key={l}><Link href="#" title="Coming soon" className="hover:text-slate-200 transition-colors">{l}</Link></li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs">© 2026 Ventura Financial Intelligence, Inc. All rights reserved.</p>
              <div className="flex items-center gap-1 text-xs">
                <span className="inline-flex items-center gap-1.5 bg-green-900/40 text-green-400 border border-green-800/50 px-2 py-0.5 text-[10px] font-medium">
                  <span className="w-1.5 h-1.5 bg-green-400 animate-pulse" />
                  All systems operational
                </span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
