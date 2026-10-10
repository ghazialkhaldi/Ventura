import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import {
  ShieldCheckIcon,
  EyeIcon,
  PencilSquareIcon,
  ChartBarIcon,
  ClockIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  BuildingOfficeIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline'
import EmployeeLayout from '../components/layout/EmployeeLayout'
import { useCurrentUser } from '../hooks/useCurrentUser'

interface ActivityEntry {
  action: string
  resource: string
  detail: string
  ts: string
}

interface WorkspaceInfo {
  role: string
  company: string
  adminId: string
  joinedAt?: string
}

const ROLE_META: Record<string, { label: string; color: string; desc: string; permissions: string[] }> = {
  viewer: {
    label: 'Viewer',
    color: 'bg-surface-overlay text-text-muted border-border',
    desc:  'Read-only access to workspace data.',
    permissions: [
      'View workspace dashboard',
      'View connected integrations',
    ],
  },
  analyst: {
    label: 'Analyst',
    color: 'bg-medium-bg text-medium-fg border-medium-line',
    desc:  'Can view and comment on anomalies and reports.',
    permissions: [
      'View workspace dashboard',
      'View connected integrations',
      'Comment on anomalies',
      'View spend analytics',
    ],
  },
  editor: {
    label: 'Editor',
    color: 'bg-accent-50 text-accent-700 border-accent-200',
    desc:  'Can approve and manage anomalies and workflows.',
    permissions: [
      'View workspace dashboard',
      'View connected integrations',
      'Comment on anomalies',
      'Approve / reject anomalies',
      'Create and edit workflows',
      'View spend analytics',
    ],
  },
  admin: {
    label: 'Admin',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    desc:  'Full workspace access.',
    permissions: [
      'Full workspace access including settings and billing',
    ],
  },
}

function formatTs(ts: string) {
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(ts))
  } catch { return ts }
}

export default function EmployeeDashboard() {
  const router  = useRouter()
  const user    = useCurrentUser()
  const [ready,      setReady]      = useState(false)
  const [info,       setInfo]       = useState<WorkspaceInfo | null>(null)
  const [activity,   setActivity]   = useState<ActivityEntry[]>([])
  const [roleChanged, setRoleChanged] = useState(false)
  const prevRole = useRef<string | null>(null)

  // Verify workspace membership before showing anything — no dashboard flash
  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        const r = await fetch('/api/team/get-role')
        if (cancelled) return
        if (r.status === 401) { router.replace('/employee-login'); return }
        if (!r.ok)            { router.replace('/join'); return }
        const d = await r.json()
        const ws: WorkspaceInfo = { role: d.role ?? 'viewer', company: d.company ?? '', adminId: d.adminId ?? '', joinedAt: d.joinedAt }
        setInfo(ws)
        prevRole.current = ws.role
        setReady(true)
      } catch {
        if (!cancelled) router.replace('/join')
      }
    }
    check()

    fetch('/api/audit/my-log')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.logs)) setActivity(d.logs.slice().reverse()) })
      .catch(() => {})

    return () => { cancelled = true }
  }, [router])

  // Log this page view once
  useEffect(() => {
    fetch('/api/audit/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'page_view', resource: 'employee_dashboard', detail: 'Viewed employee dashboard' }),
    }).catch(() => {})
  }, [])

  // Poll for role changes every 30 seconds
  useEffect(() => {
    const id = setInterval(() => {
      fetch('/api/team/get-role')
        .then(r => r.json())
        .then(d => {
          if (!d.error && d.role && prevRole.current !== null && d.role !== prevRole.current) {
            prevRole.current = d.role
            setInfo(prev => prev ? { ...prev, role: d.role } : prev)
            setRoleChanged(true)
            setTimeout(() => setRoleChanged(false), 8000)
          }
        })
        .catch(() => {})
    }, 30000)
    return () => clearInterval(id)
  }, [])

  const roleMeta = ROLE_META[info?.role ?? 'viewer'] ?? ROLE_META.viewer

  // Blank screen with spinner until membership is confirmed — never flash the dashboard
  if (!ready) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <ArrowPathIcon className="w-6 h-6 text-text-muted animate-spin" />
      </div>
    )
  }

  return (
    <EmployeeLayout title="Workspace">
      {/* Role-changed banner */}
      {roleChanged && (
        <div className="mb-4 flex items-center gap-3 bg-positive-bg border border-positive-line text-positive-fg px-4 py-3 rounded-lg text-sm">
          <ArrowPathIcon className="w-4 h-4 flex-shrink-0" />
          Your permissions were updated. You now have <strong>{roleMeta.label}</strong> access.
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">

        {/* Workspace card */}
        <div className="bg-surface-raised border border-border rounded-xl p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-700 flex items-center justify-center flex-shrink-0">
              <BuildingOfficeIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[12.5px] text-text-muted font-medium">Workspace</p>
              <p className="text-base font-medium text-text-primary">{info?.company || user?.company || 'N/A'}</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between py-1.5 border-b border-border-subtle">
              <span className="text-text-muted text-xs">Your role</span>
              <span className={`text-xs font-medium px-2.5 py-1 border rounded-full ${roleMeta.color}`}>
                {roleMeta.label}
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-border-subtle">
              <span className="text-text-muted text-xs">Member since</span>
              <span className="text-xs text-text-secondary font-medium">
                {info?.joinedAt ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(info.joinedAt)) : 'N/A'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-text-muted text-xs">Status</span>
              <span className="flex items-center gap-1.5 text-xs text-positive-fg font-medium">
                <CheckCircleIcon className="w-3.5 h-3.5" />
                Active
              </span>
            </div>
          </div>
        </div>

        {/* Permissions card */}
        <div className="bg-surface-raised border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheckIcon className="w-4 h-4 text-text-muted" />
            <p className="text-[12.5px] font-medium text-text-muted">Your Permissions</p>
          </div>
          <p className="text-xs text-text-muted mb-4">{roleMeta.desc}</p>
          <ul className="space-y-2">
            {roleMeta.permissions.map(p => (
              <li key={p} className="flex items-center gap-2 text-sm text-text-secondary">
                <CheckCircleIcon className="w-4 h-4 text-positive-fg flex-shrink-0" />
                {p}
              </li>
            ))}
          </ul>

          {/* What they can't do */}
          {(info?.role === 'viewer' || info?.role === 'analyst') && (
            <div className="mt-4 pt-4 border-t border-border-subtle">
              <p className="text-xs text-text-muted mb-2 flex items-center gap-1.5">
                <LockClosedIcon className="w-3 h-3" />
                Requires editor or above
              </p>
              <ul className="space-y-1.5">
                {['Approve / reject anomalies', 'Create and edit workflows'].map(p => (
                  <li key={p} className="flex items-center gap-2 text-xs text-text-muted">
                    <LockClosedIcon className="w-3.5 h-3.5 flex-shrink-0" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Quick stats */}
        <div className="space-y-3">
          {[
            { icon: EyeIcon,          label: 'Access level',   value: roleMeta.label,                    color: 'text-text-secondary' },
            { icon: ChartBarIcon,     label: 'Data access',    value: info?.role === 'viewer' ? 'Read-only' : 'Read + Write', color: 'text-text-secondary' },
            { icon: PencilSquareIcon, label: 'Can create',     value: ['editor', 'admin'].includes(info?.role ?? '') ? 'Yes' : 'No', color: ['editor', 'admin'].includes(info?.role ?? '') ? 'text-positive-fg' : 'text-text-muted' },
          ].map(item => (
            <div key={item.label} className="bg-surface-raised border border-border rounded-xl p-4 flex items-center gap-3">
              <item.icon className="w-5 h-5 text-text-muted flex-shrink-0" />
              <div>
                <p className="text-[11px] text-text-muted">{item.label}</p>
                <p className={`text-sm font-medium ${item.color}`}>{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notice about workspace data */}
      <div className="mt-5 bg-accent-50 border border-accent-200 rounded-xl p-4 flex items-start gap-3">
        <ChartBarIcon className="w-5 h-5 text-accent-700 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-accent-700">Workspace data</p>
          <p className="text-xs text-accent-700 mt-0.5 leading-relaxed">
            Live anomaly and spend data will appear here once your admin connects and syncs their data source.
            Your role determines which actions you can take on that data.
          </p>
        </div>
      </div>

      {/* Activity log */}
      <div className="mt-5 bg-surface-raised border border-border rounded-xl">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border-subtle">
          <ClockIcon className="w-4 h-4 text-text-muted" />
          <p className="text-sm font-medium text-text-secondary">Your recent activity</p>
        </div>
        {activity.length === 0 ? (
          <p className="text-sm text-text-muted px-5 py-6 italic">No activity recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {activity.slice(0, 20).map((entry, i) => (
              <li key={i} className="px-5 py-3 flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-surface-overlay flex items-center justify-center flex-shrink-0 mt-0.5">
                  <ClockIcon className="w-3 h-3 text-text-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-secondary">{entry.detail || entry.action}</p>
                  {entry.resource && <p className="text-xs text-text-muted">{entry.resource}</p>}
                </div>
                <span className="text-[11px] text-text-muted flex-shrink-0">{formatTs(entry.ts)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </EmployeeLayout>
  )
}
