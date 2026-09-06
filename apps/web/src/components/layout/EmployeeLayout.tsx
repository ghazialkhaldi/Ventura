import React, { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import clsx from 'clsx'
import {
  Squares2X2Icon,
  BoltIcon,
  Bars3Icon,
  XMarkIcon,
  BuildingOfficeIcon,
  ArrowRightOnRectangleIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  ArrowsRightLeftIcon,
  ScaleIcon,
  DocumentTextIcon,
  DocumentArrowDownIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline'
import VenturaLogo from '../VenturaLogo'
import { useCurrentUser, clearUser, initials } from '../../hooks/useCurrentUser'
import { createClient } from '../../utils/supabase/client'

interface EmployeeLayoutProps {
  children: React.ReactNode
  title?: string
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  viewer:  { label: 'Viewer',  color: 'bg-slate-400/10 text-slate-400 border-slate-400/25' },
  analyst: { label: 'Analyst', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30'  },
  editor:  { label: 'Editor',  color: 'bg-accent-500/10 text-accent-300 border-accent-500/30' },
  admin:   { label: 'Admin',   color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
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
    const supabase = createClient()
    await supabase.auth.signOut()
    clearUser()
    router.push('/employee-login')
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
      <div className="h-14 flex items-center justify-between px-5 border-b border-border flex-shrink-0">
        <VenturaLogo variant="light" height={22} />
        <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 text-text-muted hover:text-text-secondary">
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Company badge */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2.5 px-3 py-2.5 bg-surface-overlay border border-border rounded-lg">
          <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0">
            <BuildingOfficeIcon className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-text-primary truncate">{companyName || user?.company || 'Your Workspace'}</p>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${roleInfo.color}`}>
              {roleInfo.label}
            </span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-4 pt-2 pb-4 space-y-px">
        <p className="px-3 mb-1.5 text-[10px] font-semibold tracking-widest text-text-muted uppercase">Navigation</p>
        {navItems.map(item => {
          const active = isActive(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                active ? 'bg-accent-500 text-white' : 'text-text-secondary hover:text-text-primary hover:bg-surface-overlay',
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          )
        })}

        {/* Access level notice */}
        <div className="mt-4 mx-1 px-3 py-2.5 bg-surface-overlay border border-border rounded-lg">
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1 flex items-center gap-1">
            <LockClosedIcon className="w-3 h-3" />
            Access level
          </p>
          <p className="text-[11px] text-text-muted leading-relaxed">
            {role === 'editor'
              ? 'You can view and make changes across the workspace.'
              : role === 'analyst'
              ? 'You can view everything and comment on anomalies.'
              : 'Read-only: you can view all tabs but not make changes.'}
          </p>
        </div>
      </nav>

      {/* User footer */}
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-accent-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[10px] font-bold">{userInitials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-text-primary truncate">{displayName}</p>
            <p className="text-[10px] text-text-muted">Employee</p>
          </div>
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="text-text-muted hover:text-text-secondary transition-colors p-1"
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
          <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}
        <aside className={clsx(
          'fixed inset-y-0 left-0 w-60 flex flex-col bg-surface-raised border-r border-border z-30 transition-transform duration-200',
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
              <p className="text-sm font-semibold text-text-primary">{title || 'Employee Portal'}</p>
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
