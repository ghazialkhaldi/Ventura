import React, { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import clsx from 'clsx'
import VenturaLogo from '../VenturaLogo'
import { useCurrentUser, clearUser, initials } from '../../hooks/useCurrentUser'
import { createClient } from '../../utils/supabase/client'
import { DashboardIcon as Squares2X2Icon, LightningBoltIcon as BoltIcon, HamburgerMenuIcon as Bars3Icon, Cross2Icon as XMarkIcon, HomeIcon as BuildingOfficeIcon, ExitIcon as ArrowRightOnRectangleIcon, BarChartIcon as ChartBarIcon, ExclamationTriangleIcon, LoopIcon as ArrowsRightLeftIcon, MixerHorizontalIcon as ScaleIcon, FileTextIcon as DocumentTextIcon, DownloadIcon as DocumentArrowDownIcon, LockClosedIcon } from '@radix-ui/react-icons'

interface EmployeeLayoutProps {
  children: React.ReactNode
  title?: string
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  viewer:  { label: 'Viewer',  color: 'bg-surface-overlay text-text-muted border-border' },
  analyst: { label: 'Analyst', color: 'bg-medium-bg text-medium-fg border-medium-line'  },
  editor:  { label: 'Editor',  color: 'bg-accent-50 text-accent-700 border-accent-200' },
  admin:   { label: 'Admin',   color: 'bg-purple-50 text-purple-700 border-purple-200' },
}

export default function EmployeeLayout({ children, title }: EmployeeLayoutProps) {
  const router = useRouter()
  const user = useCurrentUser()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [role,        setRole]        = useState('viewer')

  useEffect(() => {
    fetch('/api/team/get-role')
      .then(r => r.json())
      .then(d => {
        if (d.role)    setRole(d.role)
        if (d.company) setCompanyName(d.company)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

  async function handleSignOut() {
    // Server side first: the browser client cannot clear an HttpOnly cookie,
    // so a client-only signOut can leave the session alive on the server and
    // strand the user in the app with no profile and no way out.
    await fetch('/api/auth/signout', { method: 'POST' }).catch(() => {})
    const supabase = createClient()
    await supabase.auth.signOut().catch(() => {})
    clearUser()
    // Full page navigation rather than router.push, so the request to '/'
    // carries the cleared session cookie past the middleware.
    window.location.href = '/'
  }

  const userInitials = user ? initials(user.name || user.email) : '?'
  const displayName  = user?.name || user?.email || 'Employee'
  const roleInfo     = ROLE_LABELS[role] ?? ROLE_LABELS.viewer

  const navItems = [
    { href: '/employee-dashboard', icon: Squares2X2Icon,          label: 'My Workspace'  },
    { href: '/dashboard',          icon: ChartBarIcon,            label: 'Dashboard'     },
    { href: '/anomalies',          icon: ExclamationTriangleIcon, label: 'Anomalies'     },
    { href: '/workflows',          icon: ArrowsRightLeftIcon,     label: 'Workflows'     },
    { href: '/integrations',       icon: BoltIcon,                label: 'Integrations'  },
    { href: '/ai-governance',      icon: ScaleIcon,               label: 'AI Governance' },
    { href: '/audit-logs',         icon: DocumentTextIcon,        label: 'Audit Logs'    },
    { href: '/reports',            icon: DocumentArrowDownIcon,   label: 'Reports'       },
  ]

  function isActive(href: string) {
    if (href === '/employee-dashboard') return router.pathname === '/employee-dashboard'
    return router.pathname.startsWith(href)
  }

  const SidebarContent = () => (
    <>
      {/* Brand */}
      <div className="h-14 flex items-center justify-between px-5 flex-shrink-0">
        <VenturaLogo variant="light" height={15} />
        <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 rounded-md text-white/70 hover:text-white hover:bg-white/10" aria-label="Close navigation">
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Company badge */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
          <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center flex-shrink-0">
            <BuildingOfficeIcon className="w-4 h-4 text-sky-night" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-white truncate">{companyName || user?.company || 'Your Workspace'}</p>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${roleInfo.color}`}>
              {roleInfo.label}
            </span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-4 pt-2 pb-4 space-y-px">
        <p className="px-2 mb-1 text-[12px] font-medium text-white/55">Navigation</p>
        {navItems.map(item => {
          const active = isActive(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-2.5 h-8 px-2 rounded-md text-[13.5px] font-medium',
                active ? 'bg-white text-sky-night shadow-card' : 'text-white/80 hover:text-white hover:bg-white/10',
              )}
            >
              <Icon className={clsx('w-4 h-4 flex-shrink-0', active ? 'text-accent-600' : 'text-white/60')} />
              {item.label}
            </Link>
          )
        })}

        {/* Access level notice */}
        <div className="mt-4 mx-1 px-3 py-2.5 bg-white/10 rounded-lg">
          <p className="text-[12px] font-medium text-white/80 mb-1 flex items-center gap-1">
            <LockClosedIcon className="w-3 h-3" />
            Access level
          </p>
          <p className="text-[12px] text-white/70 leading-relaxed">
            {role === 'editor'
              ? 'You can view and make changes across the workspace.'
              : role === 'analyst'
              ? 'You can view everything and comment on anomalies.'
              : 'Read-only: you can view all tabs but not make changes.'}
          </p>
        </div>
      </nav>

      {/* User footer */}
      <div className="border-t border-white/10 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[11px] font-semibold">{userInitials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{displayName}</p>
            <p className="text-[12px] text-white/60">Employee</p>
          </div>
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="rounded-md text-white/60 hover:text-white hover:bg-white/10 p-1.5"
            aria-label="Sign out"
          >
            <ArrowRightOnRectangleIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  )

  return (
    <>
      <Head>
        <title>{title ? `${title} · Ventura` : 'Ventura · Employee Portal'}</title>
      </Head>
      <div className="min-h-screen flex bg-surface">

        {/* Sidebar — desktop always visible, mobile as overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-ink/30 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}
        <aside style={{ backgroundImage: 'linear-gradient(to bottom, #12133a 0%, #1c1d52 42%, #2e2a6c 78%, #3f3484 100%)' }} className={clsx(
          'fixed inset-y-0 left-0 w-60 flex flex-col text-white z-30 transition-transform duration-300 ease-out-expo',
          'lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}>
          <SidebarContent />
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col lg:ml-60 min-h-screen">
          {/* Top bar */}
          <header className="h-14 bg-surface-raised border-b border-border flex items-center gap-3 px-4 sm:px-6 sticky top-0 z-10 flex-shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-text-muted hover:text-text-primary hover:bg-surface-overlay transition-colors -ml-1"
              aria-label="Open navigation"
            >
              <Bars3Icon className="w-5 h-5" />
            </button>
            <div>
              <p className="text-sm font-medium text-text-primary">{title || 'Employee Portal'}</p>
              {companyName && (
                <p className="text-[10px] text-text-muted leading-none mt-0.5">{companyName}</p>
              )}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className={`text-[11px] font-semibold px-2 py-0.5 border rounded-full hidden sm:inline-block ${roleInfo.color}`}>
                {roleInfo.label}
              </span>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </>
  )
}
