import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import clsx from 'clsx'
import VenturaLogo from '../VenturaLogo'
import { useCurrentUser, clearUser, initials } from '../../hooks/useCurrentUser'
import { loadDataset } from '../../lib/dataStore'
import { createClient } from '../../utils/supabase/client'
import { Cross2Icon as XMarkIcon, DashboardIcon as Squares2X2Icon, ExclamationTriangleIcon, LoopIcon as ArrowsRightLeftIcon, LightningBoltIcon as BoltIcon, MixerHorizontalIcon as ScaleIcon, FileTextIcon as DocumentTextIcon, GearIcon as Cog6ToothIcon, ExitIcon as ArrowRightOnRectangleIcon, HomeIcon as BuildingOfficeIcon, EnvelopeClosedIcon as EnvelopeIcon, DownloadIcon as DocumentArrowDownIcon } from '@radix-ui/react-icons'

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const router = useRouter()
  const user = useCurrentUser()
  const [anomalyCount,  setAnomalyCount]  = useState(0)
  const [workflowCount, setWorkflowCount] = useState(0)
  const [close, setClose] = useState<{ decided: number; total: number }>({ decided: 0, total: 0 })

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
        setClose({
          decided: ds.anomalies.filter(a => a.status === 'Resolved' || a.status === 'Dismissed').length,
          total:   ds.anomalies.length,
        })
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

      {/* The rail is the dawn sky: the one place the brand's world enters the app. */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 w-60 flex flex-col text-white z-30 transition-transform duration-300 ease-out-expo',
          'lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        style={{ backgroundImage: 'linear-gradient(to bottom, #12133a 0%, #1c1d52 42%, #2e2a6c 78%, #3f3484 100%)' }}
      >
        <div className="h-14 flex items-center px-5 flex-shrink-0">
          <div className="flex-1">
            <VenturaLogo variant="light" height={15} />
          </div>
          <button
            onClick={onClose}
            className="lg:hidden -mr-1 rounded-md text-white/70 hover:text-white hover:bg-white/10 p-1.5"
            aria-label="Close navigation"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="px-3 pb-1">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-white text-[11px] font-semibold text-sky-night">
              {companyName.charAt(0).toUpperCase()}
            </span>
            <p className="flex-1 min-w-0 text-[13.5px] font-medium text-white truncate">{companyName}</p>
            <BuildingOfficeIcon className="w-4 h-4 text-white/50 flex-shrink-0" aria-hidden />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto sidebar-scroll px-3 pt-3 pb-4 space-y-5">
          {navSections.map((section) => (
            <div key={section.label}>
              <p className="px-2 mb-1 text-[12px] font-medium text-white/55">{section.label}</p>
              <ul className="space-y-px">
                {section.items.map((item) => {
                  const active = isActive(item.href)
                  const Icon   = item.icon
                  return (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={clsx(
                          'flex items-center gap-2.5 h-8 px-2 rounded-md text-[13.5px] font-medium',
                          active ? 'bg-white text-sky-night shadow-card' : 'text-white/80 hover:text-white hover:bg-white/10',
                        )}
                      >
                        <Icon className={clsx('w-4 h-4 flex-shrink-0', active ? 'text-accent-600' : 'text-white/60')} />
                        <span className="flex-1 truncate">{item.label}</span>
                        {!!item.badge && (
                          <span className={clsx('min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-medium tabular-nums inline-flex items-center justify-center',
                            active ? 'bg-accent-50 text-accent-700' : 'bg-white/15 text-white')}>
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

        <CloseHorizon decided={close.decided} total={close.total} />

        <div className="border-t border-white/10 px-3 py-3">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-[11px] font-semibold">{userInitials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-white truncate">{displayName}</p>
              <p className="text-[12px] text-white/60 capitalize">{user?.role ?? 'Admin'}</p>
            </div>
            <button
              onClick={handleSignOut}
              title="Sign out"
              aria-label="Sign out"
              className="rounded-md text-white/60 hover:text-white hover:bg-white/10 p-1.5"
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

/**
 * The app's signature: the period's close as a sunrise. The sun sits below the
 * horizon while findings are open and climbs as they are resolved or dismissed;
 * at the last decision it is fully up.
 */
function CloseHorizon({ decided, total }: { decided: number; total: number }) {
  if (!total) return null
  const p = decided / total
  return (
    <Link href="/anomalies" className="group relative mx-3 mb-3 block h-[72px] overflow-hidden rounded-lg ring-1 ring-white/10" aria-label={`Close progress: ${decided} of ${total} findings decided`}>
      <span aria-hidden className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(to bottom, #2e2a6c 0%, #6b4c9a 55%, #c4718f 78%, #f39a7c 100%)' }} />
      <span aria-hidden className="absolute left-1/2 h-16 w-16 -translate-x-1/2 rounded-full transition-[top] duration-700 ease-out-expo"
        style={{ top: `${78 - p * 58}%`, background: 'radial-gradient(closest-side, rgb(255 244 220), rgb(255 214 170 / 0.75) 40%, transparent)' }} />
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-[22%]" style={{ background: 'linear-gradient(to bottom, #b0708f, #4b3f8f)' }} />
      <span className="absolute left-2.5 top-2 text-[11.5px] font-medium text-white">Close</span>
      <span className="absolute right-2.5 top-2 text-[11.5px] text-white/85 tabular-nums">{decided} of {total} decided</span>
    </Link>
  )
}

