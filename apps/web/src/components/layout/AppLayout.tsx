import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import {
  BellIcon,
  MagnifyingGlassIcon,
  QuestionMarkCircleIcon,
  ArrowLeftIcon,
  Bars3Icon,
  EyeIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline'
import Sidebar from './Sidebar'
import { useCurrentUser, initials } from '../../hooks/useCurrentUser'

interface AppLayoutProps {
  children: React.ReactNode
  title?: string
}

// Pages that are top-level nav destinations — no back button needed
const TOP_LEVEL = ['/dashboard', '/anomalies', '/workflows', '/integrations', '/ai-governance', '/audit-logs', '/settings', '/onboarding']

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

  const showBack = !TOP_LEVEL.some(p => router.pathname === p)

  return (
    <>
      <Head>
        <title>{title ? `${title} · Ventura` : 'Ventura · Financial Operations Intelligence'}</title>
      </Head>
      <div className="min-h-screen flex bg-surface">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 flex flex-col lg:ml-64 min-h-screen">
          {/* Top bar */}
          <header className="h-16 bg-surface-raised border-b border-border flex items-center justify-between px-4 xl:px-8 2xl:px-10 flex-shrink-0 sticky top-0 z-10">
            <div className="flex items-center gap-2 min-w-0">
              {/* Hamburger — mobile only */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-text-muted hover:text-text-secondary hover:bg-surface-overlay transition-colors flex-shrink-0 -ml-1"
                aria-label="Open navigation"
              >
                <Bars3Icon className="w-5 h-5" />
              </button>

              {showBack && (
                <button
                  onClick={() => router.back()}
                  className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-text-muted hover:text-text-primary transition-colors pr-3 border-r border-border mr-1"
                  title="Go back"
                >
                  <ArrowLeftIcon className="w-4 h-4" />
                  Back
                </button>
              )}

              {/* Search — hidden on small mobile to avoid overflow */}
              <div className="hidden sm:flex items-center gap-2 bg-surface-overlay border border-border px-3 py-1.5 w-52 lg:w-64">
                <MagnifyingGlassIcon className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Search anomalies, vendors…"
                  className="bg-transparent text-sm text-text-secondary placeholder-text-muted outline-none w-full"
                />
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <button className="relative p-2 text-text-muted hover:text-text-secondary hover:bg-surface-overlay transition-colors">
                <BellIcon className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
              </button>
              <button className="hidden sm:block p-2 text-text-muted hover:text-text-secondary hover:bg-surface-overlay transition-colors">
                <QuestionMarkCircleIcon className="w-4 h-4" />
              </button>
              <div className="w-px h-5 bg-border mx-1" />
              <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-surface-overlay cursor-pointer transition-colors">
                <div className="w-6 h-6 bg-sidebar-active border border-border-strong flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-[10px] font-bold">{userInitials}</span>
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-medium text-text-secondary leading-none">{displayName}</p>
                  <p className="text-[10px] text-text-muted mt-0.5">{displayRole}</p>
                </div>
              </div>
            </div>
          </header>

          {/* Employee access banner */}
          {isEmployee && wsRole && (
            wsRole === 'editor' ? (
              <div className="flex items-center gap-2 bg-emerald-500/10 border-b border-emerald-500/30 text-emerald-300 px-4 sm:px-6 py-2 text-xs font-medium">
                <PencilSquareIcon className="w-3.5 h-3.5 flex-shrink-0" />
                Editor access: you can view and make changes in this workspace.
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-amber-500/10 border-b border-amber-500/30 text-amber-300 px-4 sm:px-6 py-2 text-xs font-medium">
                <EyeIcon className="w-3.5 h-3.5 flex-shrink-0" />
                {wsRole === 'analyst'
                  ? 'Analyst access: you can view everything and comment on anomalies. Ask your admin for edit permission.'
                  : 'Read-only access: you can browse all tabs but not make changes. Ask your admin for edit permission.'}
              </div>
            )
          )}

          <main className="flex-1 p-4 sm:p-6 xl:p-8 2xl:p-10 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </>
  )
}
