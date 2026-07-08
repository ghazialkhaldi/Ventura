import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import clsx from 'clsx'
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

export default function Sidebar() {
  const router = useRouter()
  const user = useCurrentUser()
  const [anomalyCount,  setAnomalyCount]  = useState(0)
  const [workflowCount, setWorkflowCount] = useState(0)

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

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    clearUser()
    router.push('/login')
  }

  const userInitials = user ? initials(user.name || user.email) : '?'
  const displayName  = user?.name  || user?.email || 'Your Account'
  const companyName  = user?.company || 'Your Organization'

  const navSections = [
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
        { href: '/settings', icon: Cog6ToothIcon, label: 'Settings'   },
        { href: '/contact',  icon: EnvelopeIcon, label: 'Contact Us' },
      ],
    },
  ]

  return (
    <aside className="fixed inset-y-0 left-0 w-64 flex flex-col bg-[#0c1526] z-30">

      {/* Brand */}
      <div className="h-14 flex items-center px-5 border-b border-[#1e2d47] flex-shrink-0">
        <div>
          <span className="text-base font-black tracking-tight bg-gradient-to-r from-white via-slate-300 to-slate-500 bg-clip-text text-transparent">Ventura</span>
          <span className="block text-[10px] text-[#4d6a8a] mt-0.5">Financial Operations</span>
        </div>
      </div>

      {/* Workspace label */}
      <div className="px-3 pt-3 pb-1">
        <div className="flex items-center gap-2.5 px-3 py-2 border border-[#1e2d47]">
          <BuildingOfficeIcon className="w-3.5 h-3.5 text-[#4d6a8a] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[#8ea4c0] truncate">{companyName}</p>
            <p className="text-[10px] text-[#4d6a8a]">Enterprise</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto sidebar-scroll px-3 pt-3 pb-4 space-y-4">
        {navSections.map((section) => (
          <div key={section.label}>
            <p className="px-3 mb-1 text-[10px] font-semibold tracking-widest text-[#4d6a8a] uppercase">
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
                          ? 'bg-[#1a2d44] text-white border-l-2 border-[#8ea4c0] pl-[10px]'
                          : 'text-[#8ea4c0] hover:text-slate-100 hover:bg-[#162036]',
                      )}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {!!item.badge && (
                        <span className="min-w-[18px] h-4 px-1 text-[10px] font-semibold text-[#8ea4c0] bg-[#1e2d47] border border-[#2a3d5a] inline-flex items-center justify-center">
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
      <div className="border-t border-[#1e2d47] px-3 py-3">
        <div className="flex items-center gap-2.5 px-3 py-2">
          <div className="w-7 h-7 bg-[#1a2d44] border border-[#2a3d5a] flex items-center justify-center flex-shrink-0">
            <span className="text-[#8ea4c0] text-[10px] font-semibold">{userInitials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[#8ea4c0] truncate">{displayName}</p>
            <p className="text-[10px] text-[#4d6a8a]">{user?.role ?? 'Admin'}</p>
          </div>
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="text-[#4d6a8a] hover:text-[#8ea4c0] transition-colors p-1"
          >
            <ArrowRightOnRectangleIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}
