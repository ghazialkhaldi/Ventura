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

  // The header gains its hairline only once content scrolls beneath it
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const close   = () => setDrawerOpen(false)
  const onField = !scrolled

  return (
    <>
      <Head>
        <title>{title ? `${title} · Ventura` : 'Ventura · Spend review for month-end close'}</title>
      </Head>
      <div className="min-h-screen flex flex-col bg-surface-raised">

        {/* Every marketing page opens on the ultramarine field; the bar sits on
            it until content scrolls beneath, then turns white. */}
        <header className={`sticky top-0 z-50 border-b transition-colors duration-200 ${scrolled ? 'bg-surface-raised border-border' : 'bg-field border-transparent'}`}>
          <div className="max-w-page mx-auto h-16 px-5 sm:px-8 flex items-center gap-8">
            <Link href="/" className="shrink-0 py-2" onClick={close} aria-label="Ventura home">
              <VenturaLogo variant={scrolled ? 'dark' : 'light'} height={17} />
            </Link>

            <nav className="hidden md:flex items-center gap-1" aria-label="Main">
              {NAV_LINKS.map(l => (
                <Link key={l.href} href={l.href} className={`px-3 py-2 rounded-md text-[14px] ${onField ? 'text-white/85 hover:text-white hover:bg-white/10' : 'text-text-secondary hover:text-text-primary hover:bg-surface-overlay'}`}>
                  {l.label}
                </Link>
              ))}
            </nav>

            <div className="hidden md:flex items-center gap-1 ml-auto">
              {loggedIn ? (
                <Link href={portalHref} className={`inline-flex items-center h-9 px-4 rounded-md text-[14px] font-medium ${onField ? 'bg-white text-accent-800 hover:bg-accent-50' : 'bg-accent-600 hover:bg-accent-700 text-white'}`}>
                  {portalLabel}
                </Link>
              ) : (
                <>
                  <Link href="/login" className={`px-3 py-2 rounded-md text-[14px] ${onField ? 'text-white/85 hover:text-white hover:bg-white/10' : 'text-text-secondary hover:text-text-primary hover:bg-surface-overlay'}`}>
                    Sign in
                  </Link>
                  <Link href="/demo" className={`ml-2 inline-flex items-center h-9 px-4 rounded-md text-[14px] font-medium ${onField ? 'bg-white text-accent-800 hover:bg-accent-50' : 'bg-accent-600 hover:bg-accent-700 text-white'}`}>
                    Walk through the demo
                  </Link>
                </>
              )}
            </div>

            <button
              className={`md:hidden ml-auto -mr-2 p-2 rounded-md ${onField ? 'text-white hover:bg-white/10' : 'text-text-secondary hover:text-text-primary hover:bg-surface-overlay'}`}
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              aria-expanded={drawerOpen}
            >
              <Bars3Icon className="w-6 h-6" />
            </button>
          </div>
        </header>

        {/* Mobile drawer backdrop — below the drawer so it never eats taps on links */}
        {drawerOpen && (
          <div className="fixed inset-0 bg-ink/30 z-[60] md:hidden" onClick={close} />
        )}

        <div
          className={`fixed top-0 right-0 h-full w-[300px] max-w-[85vw] bg-surface-raised z-[70] flex flex-col transition-[transform,visibility] duration-300 ease-out-expo md:hidden ${drawerOpen ? 'translate-x-0 shadow-pop visible' : 'translate-x-full invisible'}`}
          aria-hidden={!drawerOpen}
        >
          <div className="h-16 flex items-center justify-between px-5 border-b border-border">
            <VenturaLogo variant="dark" height={15} />
            <button onClick={close} className="-mr-2 p-2 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-overlay" aria-label="Close menu">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col" aria-label="Mobile">
            {NAV_LINKS.map(l => (
              <Link key={l.href} href={l.href} onClick={close} className="px-3 py-3 rounded-md text-[15px] text-text-primary hover:bg-surface-overlay">
                {l.label}
              </Link>
            ))}
            {!loggedIn && (
              <>
                <div className="my-3 border-t border-border" />
                <Link href="/login" onClick={close} className="px-3 py-3 rounded-md text-[15px] text-text-primary hover:bg-surface-overlay">Sign in</Link>
              </>
            )}
          </nav>
          <div className="p-5 border-t border-border">
            <Link
              href={loggedIn ? portalHref : '/demo'}
              onClick={close}
              className="flex items-center justify-center h-11 rounded-md bg-accent-600 hover:bg-accent-700 text-white text-[15px] font-medium"
            >
              {loggedIn ? portalLabel : 'Walk through the demo'}
            </Link>
          </div>
        </div>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-border bg-surface-raised">
          <div className="max-w-page mx-auto px-5 sm:px-8 pt-14 pb-10">
            <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
              <div className="col-span-2 lg:col-span-1">
                <VenturaLogo variant="dark" height={15} />
                <p className="mt-4 text-[14px] text-text-muted max-w-[16rem] leading-relaxed">
                  Spend review for month-end close. Every finding traced to its rows, and a person decides.
                </p>
              </div>
              {FOOTER_COLUMNS.map(col => (
                <div key={col.heading}>
                  <p className="text-[13px] font-medium text-text-primary">{col.heading}</p>
                  <ul className="mt-4 space-y-3">
                    {col.links.map(l => (
                      <li key={l.label}>
                        <Link href={l.href} className="text-[14px] text-text-muted hover:text-text-primary">{l.label}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-14 pt-6 border-t border-border text-[13px] text-text-muted">
              © 2026 Ventura Financial Intelligence, Inc.
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}

const NAV_LINKS = [
  { label: 'Product',  href: '/#product'  },
  { label: 'Security', href: '/security'  },
  { label: 'Contact',  href: '/contact'   },
]

const FOOTER_COLUMNS = [
  {
    heading: 'Product',
    links: [
      { label: 'Demo',             href: '/demo'      },
      { label: 'What it catches',  href: '/#product'  },
      { label: 'How it works',     href: '/#how'      },
      { label: 'Security',         href: '/security'  },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About',            href: '/about'    },
      { label: 'Contact',          href: '/contact'  },
      { label: 'Privacy policy',   href: '/privacy'  },
      { label: 'Terms of service', href: '/terms'    },
    ],
  },
  {
    heading: 'Account',
    links: [
      { label: 'Sign in',          href: '/login'          },
      { label: 'Employee portal',  href: '/employee-login' },
      { label: 'Documentation',    href: '/docs'           },
      { label: 'Status',           href: '/status'         },
    ],
  },
]
