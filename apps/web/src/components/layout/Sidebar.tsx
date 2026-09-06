import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import clsx from 'clsx'
import { XMarkIcon } from '@heroicons/react/24/outline'
import VenturaLogo from '../VenturaLogo'
import {
  Squares2X2Icon,
  ExclamationTriangleIcon,
  ArrowsRightLeftIcon,
  BoltIcon,
  ScaleIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  BuildingOfficeIcon,
  EnvelopeIcon,
  DocumentArrowDownIcon,
} from '@heroicons/react/24/outline'
import { useCurrentUser, clearUser, initials } from '../../hooks/useCurrentUser'
import { loadDataset } from '../../lib/dataStore'
import { createClient } from '../../utils/supabase/client'

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const router = useRouter()
  const user = useCurrentUser()
  const [anomalyCount,  setAnomalyCount]  = useState(0)
  const [workflowCount, setWorkflowCount] = useState(0)

  // Close on route change (handles mobile nav taps)
  useEffect(() => {
    onClose?.()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.pathname])

  useEffect(() => {
    function refresh() {
      try {
        const isReady = localStorage.getItem('sf_data_ready') === 'true'
        if (!isReady) { setAnomalyCount(0); setWorkflowCount(0); return }
        const ds = loadDataset()
        if (!ds) return
        const open  = ds.anomalies.filter(a => a.status !== 'Resolved').length
        const types = new Set(ds.anomalies.filter(a => a.status !== 'Resolved').map(a => a.type)).size
        setAnomalyCount(open)
        setWorkflowCount(types)
      } catch {}
    }
    refresh()
    window.addEventListener('storage', refresh)
    return () => window.removeEventListener('storage', refresh)
  }, [])

  function isActive(href: string) {
    if (href === '/dashboard') return router.pathname === '/dashboard'
    return router.pathname.startsWith(href)
  }

  const isEmployee = user?.role === 'employee'

  async function handleSignOut() {
    // Server side first: the browser client cannot clear an HttpOnly cookie,
    // so a client-only signOut can leave the session alive on the server and
    // strand the user in the app with no profile and no way out.
    await fetch('/api/auth/signout', { method: 'POST' }).catch(() => {})
    const supabase = createClient()
    await supabase.auth.signOut().catch(() => {})
    clearUser()
    // Full page navigation rather than router.push: the middleware bounces
    // authenticated users off '/' to the dashboard, so this request has to
    // carry the cleared session cookie, not a cached client-side route.
    window.location.href = '/'
  }

  const userInitials = user ? initials(user.name || user.email) : '?'
  const displayName  = user?.name  || user?.email || 'Your Account'
  const companyName  = user?.company || 'Your Organization'

  const navSections = [
    // Employees get a link back to their own portal home
    ...(isEmployee ? [{
      label: 'Portal',
      items: [
        { href: '/employee-dashboard', icon: Squares2X2Icon, label: 'My Workspace' },
      ],
    }] : []),
    {
      label: 'Workspace',
      items: [
        { href: '/dashboard',  icon: Squares2X2Icon,          label: 'Dashboard' },
        { href: '/anomalies',  icon: ExclamationTriangleIcon, label: 'Anomalies',  badge: anomalyCount  > 0 ? anomalyCount  : 0 },
        { href: '/workflows',  icon: ArrowsRightLeftIcon,     label: 'Workflows',  badge: workflowCount > 0 ? workflowCount : 0 },
      ],
    },
    {
      label: 'Data',
      items: [
        { href: '/integrations', icon: BoltIcon, label: 'Integrations' },
      ],
    },
    {
      label: 'Governance',
      items: [
        { href: '/ai-governance', icon: ScaleIcon,             label: 'AI Governance' },
        { href: '/audit-logs',    icon: DocumentTextIcon,      label: 'Audit Logs'    },
        { href: '/reports',       icon: DocumentArrowDownIcon, label: 'Reports'       },
      ],
    },
    {
      label: 'Account',
      items: [
        // Settings is admin-only — employees are redirected by the middleware anyway
        ...(isEmployee ? [] : [{ href: '/settings', icon: Cog6ToothIcon, label: 'Settings' }]),
        { href: '/contact', icon: EnvelopeIcon, label: 'Contact Us' },
      ],
    },
  ]

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={clsx(
        'fixed inset-y-0 left-0 w-64 flex flex-col bg-sidebar-bg z-30 transition-transform duration-200',
        'lg:translate-x-0',
        isOpen ? 'translate-x-0' : '-translate-x-full',
      )}>

        {/* Brand */}
        <div className="h-14 flex items-center px-5 border-b border-sidebar-border flex-shrink-0">
          <div className="flex-1">
            <VenturaLogo variant="light" height={26} />
            <span className="block text-[10px] text-sidebar-muted mt-0.5">Financial Operations</span>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-sidebar-muted hover:text-sidebar-text p-1 transition-colors"
            aria-label="Close navigation"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Workspace label */}
        <div className="px-3 pt-3 pb-1">
          <div className="flex items-center gap-2.5 px-3 py-2 border border-sidebar-border">
            <BuildingOfficeIcon className="w-3.5 h-3.5 text-sidebar-muted flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-sidebar-text truncate">{companyName}</p>
              <p className="text-[10px] text-sidebar-muted">Enterprise</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto sidebar-scroll px-3 pt-3 pb-4 space-y-4">
          {navSections.map((section) => (
            <div key={section.label}>
              <p className="px-3 mb-1 text-[10px] font-semibold tracking-widest text-sidebar-muted uppercase">
                {section.label}
              </p>
              <ul className="space-y-px">
                {section.items.map((item) => {
                  const active = isActive(item.href)
                  const Icon   = item.icon
                  return (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        className={clsx(
                          'flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors',
                          active
                            ? 'bg-sidebar-active text-white border-l-2 border-accent-500 pl-[10px]'
                            : 'text-sidebar-text hover:text-white hover:bg-sidebar-hover',
                        )}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <span className="flex-1 truncate">{item.label}</span>
                        {!!item.badge && (
                          <span className="min-w-[18px] h-4 px-1 text-[10px] font-semibold text-sidebar-text bg-sidebar-border border border-border-strong inline-flex items-center justify-center">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-sidebar-border px-3 py-3">
          <div className="flex items-center gap-2.5 px-3 py-2">
            <div className="w-7 h-7 bg-sidebar-active border border-border-strong flex items-center justify-center flex-shrink-0">
              <span className="text-sidebar-text text-[10px] font-semibold">{userInitials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-sidebar-text truncate">{displayName}</p>
              <p className="text-[10px] text-sidebar-muted">{user?.role ?? 'Admin'}</p>
            </div>
            <button
              onClick={handleSignOut}
              title="Sign out"
              className="text-sidebar-muted hover:text-sidebar-text transition-colors p-1"
            >
              <ArrowRightOnRectangleIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
