import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import Sidebar from './Sidebar'
import { hydrateFromServer } from '../../lib/workspaceSync'
import { refreshDetectionConfig } from '../../lib/workspaceSettings'
import { useCurrentUser, initials } from '../../hooks/useCurrentUser'
import { MagnifyingGlassIcon, ArrowLeftIcon, HamburgerMenuIcon as Bars3Icon, EyeOpenIcon as EyeIcon, Pencil2Icon as PencilSquareIcon } from '@radix-ui/react-icons'

interface AppLayoutProps {
  children: React.ReactNode
  title?: string
}

// Pages that are top-level nav destinations — no back button needed
const TOP_LEVEL = ['/dashboard', '/anomalies', '/workflows', '/integrations', '/audit-logs', '/settings', '/onboarding']

export default function AppLayout({ children, title }: AppLayoutProps) {
  const router = useRouter()
  const user = useCurrentUser()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [wsRole,      setWsRole]      = useState<string | null>(null)

  const isEmployee = user?.role === 'employee'

  // Employees: fetch their granted workspace role (viewer/analyst/editor)
  useEffect(() => {
    if (!isEmployee) return
    fetch('/api/team/get-role')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.role) setWsRole(d.role) })
      .catch(() => {})
  }, [isEmployee])

  // Employees: record each page visit so the admin's activity log stays complete
  useEffect(() => {
    if (!isEmployee) return
    fetch('/api/audit/log', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'page_view', resource: router.pathname, detail: `Viewed ${title || router.pathname}` }),
    }).catch(() => {})
  }, [isEmployee, router.pathname, title])

  const userInitials = user ? initials(user.name || user.email) : '??'
  const displayName  = user?.name  || user?.email || 'Your Account'
  const displayRole  = isEmployee
    ? `Employee${wsRole ? ` · ${wsRole.charAt(0).toUpperCase() + wsRole.slice(1)}` : ''}`
    : (user?.role || 'Admin')

  // Load the workspace from the server (when it keeps one) and the team's
  // detection settings. If the server's copy differs from this browser's,
  // the page remounts so everything on it reads the fresh data.
  const [dataVersion, setDataVersion] = useState(0)
  useEffect(() => {
    let last = 0
    try { last = Number(sessionStorage.getItem('sf_hydrated_at') || 0) } catch { /* ignore */ }
    if (Date.now() - last < 60_000) return
    try { sessionStorage.setItem('sf_hydrated_at', String(Date.now())) } catch { /* ignore */ }
    void (async () => {
      const before = localStorage.getItem('sf_dataset')
      const [from] = await Promise.all([hydrateFromServer(), refreshDetectionConfig()])
      if (from === 'server' && localStorage.getItem('sf_dataset') !== before) setDataVersion(v => v + 1)
    })()
  }, [])

  const showBack = !TOP_LEVEL.some(p => router.pathname === p)

  return (
    <>
      <Head>
        <title>{title ? `${title} · Ventura` : 'Ventura'}</title>
      </Head>
      <div className="min-h-screen flex bg-surface">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 flex flex-col lg:ml-60 min-h-screen min-w-0">
          {/* Top bar */}
          <header className="h-14 bg-surface-raised/95 backdrop-blur-sm border-b border-border flex items-center justify-between gap-3 px-4 xl:px-8 2xl:px-10 flex-shrink-0 sticky top-0 z-10">
            <div className="flex items-center gap-2 min-w-0">
              {/* Hamburger — mobile only */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-overlay flex-shrink-0 -ml-1"
                aria-label="Open navigation"
              >
                <Bars3Icon className="w-5 h-5" />
              </button>

              {showBack && (
                <button
                  onClick={() => router.back()}
                  className="hidden sm:flex items-center gap-1.5 h-8 px-2 rounded-md text-[13.5px] font-medium text-text-secondary hover:text-text-primary hover:bg-surface-overlay mr-1"
                  title="Go back"
                >
                  <ArrowLeftIcon className="w-4 h-4" />
                  Back
                </button>
              )}

              {/* Search — hidden on small mobile to avoid overflow */}
              <div className="hidden sm:flex items-center gap-2 h-8 rounded-md bg-surface-overlay border border-transparent focus-within:border-accent-400 focus-within:bg-surface-raised px-2.5 w-56 lg:w-72">
                <MagnifyingGlassIcon className="w-4 h-4 text-text-muted flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Search anomalies, vendors…"
                  aria-label="Search"
                  className="bg-transparent text-[13.5px] text-text-primary placeholder-text-muted outline-none w-full focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <div className="flex items-center gap-2.5 h-9 px-2 rounded-md">
                <div className="w-7 h-7 rounded-full bg-accent-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-accent-800 text-[11px] font-semibold">{userInitials}</span>
                </div>
                <div className="hidden sm:block">
                  <p className="text-[13px] font-medium text-text-primary leading-none">{displayName}</p>
                  <p className="text-[12px] text-text-muted mt-1 capitalize">{displayRole}</p>
                </div>
              </div>
            </div>
          </header>

          {/* Employee access banner */}
          {isEmployee && wsRole && (
            wsRole === 'editor' ? (
              <div className="flex items-center gap-2 bg-positive-bg border-b border-positive-line text-positive-fg px-4 sm:px-6 py-2 text-xs font-medium">
                <PencilSquareIcon className="w-3.5 h-3.5 flex-shrink-0" />
                Editor access: you can view and make changes in this workspace.
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-medium-bg border-b border-medium-line text-medium-fg px-4 sm:px-6 py-2 text-xs font-medium">
                <EyeIcon className="w-3.5 h-3.5 flex-shrink-0" />
                {wsRole === 'analyst'
                  ? 'Analyst access: you can view everything and comment on anomalies. Ask your admin for edit permission.'
                  : 'Read-only access: you can browse all tabs but not make changes. Ask your admin for edit permission.'}
              </div>
            )
          )}

          <main className="flex-1 p-4 sm:p-6 xl:p-8 2xl:p-10 overflow-auto">
            <div key={dataVersion} className="contents">{children}</div>
          </main>
        </div>
      </div>
    </>
  )
}
