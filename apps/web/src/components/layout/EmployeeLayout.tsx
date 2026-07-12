import React, { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import clsx from 'clsx'
import {
  Squares2X2Icon,
  BoltIcon,
  ClockIcon,
  Bars3Icon,
  XMarkIcon,
  BuildingOfficeIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline'
import VenturaLogo from '../VenturaLogo'
import { useCurrentUser, clearUser, initials } from '../../hooks/useCurrentUser'
import { createClient } from '../../utils/supabase/client'

interface EmployeeLayoutProps {
  children: React.ReactNode
  title?: string
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  viewer:  { label: 'Viewer',  color: 'bg-slate-100 text-slate-600 border-slate-200' },
  analyst: { label: 'Analyst', color: 'bg-amber-50 text-amber-700 border-amber-200'  },
  editor:  { label: 'Editor',  color: 'bg-blue-50 text-blue-700 border-blue-200'     },
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
    const supabase = createClient()
    await supabase.auth.signOut()
    clearUser()
    router.push('/employee-login')
  }

  const userInitials = user ? initials(user.name || user.email) : '?'
  const displayName  = user?.name || user?.email || 'Employee'
  const roleInfo     = ROLE_LABELS[role] ?? ROLE_LABELS.viewer

  const navItems = [
    { href: '/employee-dashboard', icon: Squares2X2Icon, label: 'Workspace' },
    { href: '/employee-dashboard/activity', icon: ClockIcon, label: 'My Activity' },
  ]

  function isActive(href: string) {
    if (href === '/employee-dashboard') return router.pathname === '/employee-dashboard'
    return router.pathname.startsWith(href)
  }

  const SidebarContent = () => (
    <>
      {/* Brand */}
      <div className="h-14 flex items-center justify-between px-5 border-b border-slate-200 flex-shrink-0">
        <VenturaLogo variant="dark" height={24} />
        <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 text-slate-400 hover:text-slate-700">
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Company badge */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg">
          <div className="w-7 h-7 rounded-full bg-emerald-700 flex items-center justify-center flex-shrink-0">
            <BuildingOfficeIcon className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-800 truncate">{companyName || user?.company || 'Your Workspace'}</p>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${roleInfo.color}`}>
              {roleInfo.label}
            </span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-4 pt-2 pb-4 space-y-px">
        <p className="px-3 mb-1.5 text-[10px] font-semibold tracking-widest text-slate-400 uppercase">Navigation</p>
        {navItems.map(item => {
          const active = isActive(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          )
        })}

        {(role === 'editor' || role === 'analyst') && (
          <Link
            href="/employee-dashboard/integrations"
            className={clsx(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              router.pathname.includes('integrations') ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
            )}
          >
            <BoltIcon className="w-4 h-4 flex-shrink-0" />
            Integrations
          </Link>
        )}
      </nav>

      {/* User footer */}
      <div className="border-t border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-slate-900 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[10px] font-bold">{userInitials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-800 truncate">{displayName}</p>
            <p className="text-[10px] text-slate-400">Employee</p>
          </div>
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="text-slate-400 hover:text-slate-700 transition-colors p-1"
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
        <title>{title ? `${title} — Ventura` : 'Ventura — Employee Portal'}</title>
      </Head>
      <div className="min-h-screen flex bg-slate-50">

        {/* Sidebar — desktop always visible, mobile as overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}
        <aside className={clsx(
          'fixed inset-y-0 left-0 w-60 flex flex-col bg-white border-r border-slate-200 z-30 transition-transform duration-200',
          'lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}>
          <SidebarContent />
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col lg:ml-60 min-h-screen">
          {/* Top bar */}
          <header className="h-14 bg-white border-b border-slate-200 flex items-center gap-3 px-4 sm:px-6 sticky top-0 z-10 flex-shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors -ml-1"
              aria-label="Open navigation"
            >
              <Bars3Icon className="w-5 h-5" />
            </button>
            <div>
              <p className="text-sm font-semibold text-slate-800">{title || 'Employee Portal'}</p>
              {companyName && (
                <p className="text-[10px] text-slate-400 leading-none mt-0.5">{companyName}</p>
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
