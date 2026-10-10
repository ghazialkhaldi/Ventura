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
          className="fixed inset-0 bg-ink/30 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={clsx(
        'fixed inset-y-0 left-0 w-60 flex flex-col bg-sidebar-bg border-r border-sidebar-border z-30 transition-transform duration-300 ease-out-expo',
        'lg:translate-x-0',
        isOpen ? 'translate-x-0' : '-translate-x-full',
      )}>

        {/* Brand */}
        <div className="h-14 flex items-center px-5 flex-shrink-0">
          <div className="flex-1">
            <VenturaLogo variant="dark" height={15} />
          </div>
          <button
            onClick={onClose}
            className="lg:hidden -mr-1 rounded-md text-sidebar-muted hover:text-sidebar-text hover:bg-sidebar-hover p-1.5"
            aria-label="Close navigation"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Workspace label */}
        <div className="px-3 pb-1">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-ink text-[11px] font-semibold text-white">
              {companyName.charAt(0).toUpperCase()}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-medium text-text-primary truncate">{companyName}</p>
            </div>
            <BuildingOfficeIcon className="w-4 h-4 text-sidebar-muted flex-shrink-0" aria-hidden />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto sidebar-scroll px-3 pt-3 pb-4 space-y-5">
          {navSections.map((section) => (
            <div key={section.label}>
              <p className="px-2 mb-1 text-[12px] font-medium text-sidebar-muted">
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
                          'flex items-center gap-2.5 h-8 px-2 rounded-md text-[13.5px] font-medium',
                          active
                            ? 'bg-surface-raised text-text-primary shadow-card ring-1 ring-border'
                            : 'text-sidebar-text hover:text-text-primary hover:bg-sidebar-hover',
                        )}
                      >
                        <Icon className={clsx('w-4 h-4 flex-shrink-0', active ? 'text-accent-600' : 'text-sidebar-muted')} />
                        <span className="flex-1 truncate">{item.label}</span>
                        {!!item.badge && (
                          <span className="min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-medium text-text-secondary bg-sidebar-active tabular-nums inline-flex items-center justify-center">
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
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="w-7 h-7 rounded-full bg-accent-100 flex items-center justify-center flex-shrink-0">
              <span className="text-accent-800 text-[11px] font-semibold">{userInitials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-text-primary truncate">{displayName}</p>
              <p className="text-[12px] text-sidebar-muted capitalize">{user?.role ?? 'Admin'}</p>
            </div>
            <button
              onClick={handleSignOut}
              title="Sign out"
              aria-label="Sign out"
              className="rounded-md text-sidebar-muted hover:text-text-primary hover:bg-sidebar-hover p-1.5"
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
