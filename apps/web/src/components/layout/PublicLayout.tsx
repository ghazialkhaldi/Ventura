import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'

interface PublicLayoutProps {
  children: React.ReactNode
  title?: string
}

export default function PublicLayout({ children, title }: PublicLayoutProps) {
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    setLoggedIn(!!localStorage.getItem('sf_user'))
  }, [])

  return (
    <>
      <Head>
        <title>{title ? `${title} — Ventura` : 'Ventura — Financial Operations Intelligence'}</title>
      </Head>
      <div className="min-h-screen flex flex-col bg-white">

        {/* Top nav — logo + auth only */}
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200">
          <div className="h-16 px-6 sm:px-8 lg:px-12 xl:px-16 2xl:px-20 flex items-center justify-between">
            <Link href="/" className="no-underline">
              <span className="text-[1.75rem] font-black tracking-tight bg-gradient-to-r from-black via-slate-700 to-slate-400 bg-clip-text text-transparent">Ventura</span>
            </Link>

            <div className="flex items-center gap-5">
              <Link href="/demo" className="hidden sm:block text-base font-medium text-slate-500 hover:text-slate-900 transition-colors">
                Demo
              </Link>
              {!loggedIn && (
                <Link href="/login" className="text-base font-medium text-slate-600 hover:text-slate-900 transition-colors">
                  Sign in
                </Link>
              )}
              {loggedIn ? (
                <Link href="/dashboard" className="bg-emerald-700 hover:bg-emerald-800 text-white text-base font-semibold px-5 py-2.5 transition-colors">
                  Go to dashboard
                </Link>
              ) : (
                <Link href="/contact" className="bg-slate-900 hover:bg-slate-800 text-white text-base font-semibold px-5 py-2.5 transition-colors">
                  Get started
                </Link>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        {/* Footer */}
        <footer className="bg-slate-900 text-slate-400 py-10">
          <div className="px-6 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
            <div className="grid md:grid-cols-4 gap-8 mb-8">
              <div>
                <div className="mb-3">
                  <span className="text-sm font-black tracking-tight bg-gradient-to-r from-white via-slate-300 to-slate-500 bg-clip-text text-transparent">Ventura</span>
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
