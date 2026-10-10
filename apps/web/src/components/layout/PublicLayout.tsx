import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import VenturaLogo from '../VenturaLogo'
import { SkyBackdrop } from '../marketing/Sky'
import { createClient } from '../../utils/supabase/client'
import { HamburgerMenuIcon as Bars3Icon, Cross2Icon as XMarkIcon } from '@radix-ui/react-icons'

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
  // The bar takes on the surface beneath it: over the open sky it is clear
  // with a white mark, over a paper sheet it is frosted paper. Sky regions
  // mark themselves with data-field.
  const [overField, setOverField] = useState(true)
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 4)
      const hh = document.querySelector('header')?.getBoundingClientRect().height ?? 64
      const el = document.elementFromPoint(window.innerWidth / 2, hh + 2)
      setOverField(!!el?.closest('[data-field]'))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const close   = () => setDrawerOpen(false)
  const onField = overField

  return (
    <>
      <Head>
        <title>{title ? `${title} · Ventura` : 'Ventura · Spend review for month-end close'}</title>
      </Head>
      <div className="relative isolate min-h-screen flex flex-col">
        <SkyBackdrop />

        {/* Over the dawn sky the bar is clear with a white mark, and turns to night
            glass once the sky's own content scrolls beneath it; over paper it is
            frosted white. Sky regions mark themselves with data-field. */}
        <header className={`sticky top-0 z-50 border-b transition-colors duration-200 ${
          !onField ? 'bg-surface-raised/85 backdrop-blur-md border-border/70'
          : scrolled ? 'bg-sky-night/45 backdrop-blur-lg border-white/10'
          : 'bg-transparent border-transparent'}`}>
          <div className="max-w-page mx-auto h-16 lg:h-20 px-5 sm:px-8 flex items-center gap-10">
            <Link href="/" className="shrink-0 py-2" onClick={close} aria-label="Ventura home">
              <VenturaLogo variant={onField ? 'light' : 'dark'} height={20} />
            </Link>

            <nav className="hidden md:flex items-center gap-1" aria-label="Main">
              {NAV_LINKS.map(l => (
                <Link key={l.href} href={l.href} className={`px-3.5 py-2 rounded-md text-[15px] ${onField ? 'text-white/90 hover:text-white hover:bg-white/10' : 'text-text-secondary hover:text-text-primary hover:bg-surface-overlay'}`}>
                  {l.label}
                </Link>
              ))}
            </nav>

            <div className="hidden md:flex items-center gap-1 ml-auto">
              {loggedIn ? (
                <Link href={portalHref} className={`inline-flex items-center h-11 px-5 rounded-md text-[15px] font-medium ${onField ? 'bg-white text-accent-800 hover:bg-accent-50' : 'bg-accent-600 hover:bg-accent-700 text-white'}`}>
                  {portalLabel}
                </Link>
              ) : (
                <>
                  <Link href="/login" className={`px-3.5 py-2 rounded-md text-[15px] ${onField ? 'text-white/90 hover:text-white hover:bg-white/10' : 'text-text-secondary hover:text-text-primary hover:bg-surface-overlay'}`}>
                    Sign in
                  </Link>
                  <Link href="/demo" className={`ml-3 inline-flex items-center h-11 px-5 rounded-full text-[15px] font-medium ${onField ? 'bg-white text-accent-800 hover:bg-accent-50' : 'bg-accent-600 hover:bg-accent-700 text-white'}`}>
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

        <main className="relative flex-1">{children}</main>

        {/* The footer sits on the day sky the page has scrolled into, not on a slab of paper. */}
        <footer className="relative border-t border-sky-night/10">
          <div className="max-w-page mx-auto px-5 sm:px-8 pt-14 pb-10">
            <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
              <div className="col-span-2 lg:col-span-1">
                <VenturaLogo variant="dark" height={15} />
                <p className="mt-4 text-[14px] text-sky-indigo max-w-[16rem] leading-relaxed">
                  Spend review for month-end close. Every finding traced to its rows, and a person decides.
                </p>
              </div>
              {FOOTER_COLUMNS.map(col => (
                <div key={col.heading}>
                  <p className="text-[13px] font-medium text-sky-night">{col.heading}</p>
                  <ul className="mt-4 space-y-3">
                    {col.links.map(l => (
                      <li key={l.label}>
                        <Link href={l.href} className="text-[14px] text-sky-indigo hover:text-sky-night hover:underline underline-offset-4">{l.label}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-14 pt-6 border-t border-sky-night/10 text-[13px] text-sky-indigo">
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
