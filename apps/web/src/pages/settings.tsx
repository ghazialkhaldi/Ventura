import React, { useState, useEffect, useRef } from 'react'
import AppLayout from '../components/layout/AppLayout'
import DetectionSettings from '../components/settings/DetectionSettings'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Card, CardHeader, CardDivider } from '../components/ui/Card'
import { useCurrentUser, saveUser } from '../hooks/useCurrentUser'
import { clearDataset } from '../lib/dataStore'
import {
  Users, Shield, Building2, Settings, Plus, Edit, CheckCircle, Key, RefreshCw, AlertTriangle, Eye, Database, Trash2, AlertCircle, Loader2, ChevronDown, Clock, X, ArrowLeft,
} from 'lucide-react'

type SettingsTab = 'users' | 'roles' | 'security' | 'tenant' | 'detection' | 'data'
type ResetStep   = 'idle' | 'confirm' | 'sending' | 'verify' | 'verifying' | 'done' | 'error'
type InviteState = 'idle' | 'loading' | 'ready'

interface TeamMember {
  user_id:   string
  email:     string
  name:      string
  role:      string
  joined_at: string
}

interface ActivityEntry {
  action:   string
  resource: string
  detail:   string
  ts:       string
}

const ROLE_COLORS: Record<string, string> = {
  admin:   'bg-purple-50 text-purple-700 border-purple-200',
  editor:  'bg-accent-50 text-accent-700 border-accent-200',
  analyst: 'bg-medium-bg text-medium-fg border-medium-line',
  viewer:  'bg-surface-overlay text-text-muted border-border',
}

// The three roles you can assign to a team member, matching the options in
// the Users tab role dropdown.
const roles = [
  {
    name: 'Editor', desc: 'View everything and make changes across the workspace',
    color: 'bg-accent-50 text-accent-700 border-accent-200',
    permissions: ['View all dashboards, anomalies and reports', 'Change anomaly status and resolve findings', 'Edit workflows', 'Upload and import data'],
  },
  {
    name: 'Analyst', desc: 'View everything and comment on anomalies',
    color: 'bg-medium-bg text-medium-fg border-medium-line',
    permissions: ['View all dashboards, anomalies and reports', 'Comment on anomalies', 'Cannot change anomaly status or edit workflows'],
  },
  {
    name: 'Viewer', desc: 'Read only access to dashboards and reports',
    color: 'bg-surface-overlay text-text-muted border-border',
    permissions: ['View all dashboards, anomalies and reports', 'View integration status', 'Cannot make changes of any kind'],
  },
]

const statusColor: Record<string, string> = {
  Active:   'bg-positive-bg text-positive-fg border border-positive-line',
  Inactive: 'bg-surface-overlay text-text-muted border border-border',
  Pending:  'bg-medium-bg text-medium-fg border border-medium-line',
}

export default function SettingsPage() {
  const currentUser = useCurrentUser()
  const [activeTab,   setActiveTab]   = useState<SettingsTab>('users')
  const [tenantName,  setTenantName]  = useState('')
  const [timezone,    setTimezone]    = useState('America/New_York')
  const [plan]                        = useState('Enterprise')
  const [savingOrgName, setSavingOrgName] = useState(false)
  const [orgNameSaved,  setOrgNameSaved]  = useState(false)
  const [orgNameError,  setOrgNameError]  = useState('')

  // Team members
  const [members,      setMembers]      = useState<TeamMember[]>([])
  const [membersLoaded, setMembersLoaded] = useState(false)

  // Employee logs panel
  const [logsEmployee, setLogsEmployee] = useState<TeamMember | null>(null)
  const [logs,         setLogs]         = useState<ActivityEntry[]>([])
  const [logsLoading,  setLogsLoading]  = useState(false)

  // Role change state
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)

  // Roles tab — expandable permission details
  const [expandedRole, setExpandedRole] = useState<string | null>(null)

  // Security tab — API key display
  const [apiKey,        setApiKey]        = useState('optm_live_4kd92mfh37sla09xnvb128fhxY2q')
  const [apiKeyVisible, setApiKeyVisible] = useState(false)

  function generateApiKey() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let body = ''
    for (let i = 0; i < 28; i++) body += chars[Math.floor(Math.random() * chars.length)]
    return `optm_live_${body}`
  }

  // Invite modal state
  const [inviteOpen,   setInviteOpen]   = useState(false)
  const [inviteState,  setInviteState]  = useState<InviteState>('idle')
  const [inviteCode,   setInviteCode]   = useState<string | null>(null)
  const [inviteError,  setInviteError]  = useState('')
  const [inviteCopied, setInviteCopied] = useState<'code' | 'link' | null>(null)

  async function openInviteModal() {
    setInviteOpen(true)
    setInviteError('')
    setInviteState('loading')
    try {
      const res  = await fetch('/api/invite/generate', { method: 'POST' })
      const body = await res.json() as { code?: string; error?: string }
      if (!res.ok) throw new Error(body.error ?? 'Failed to generate invite')
      setInviteCode(body.code ?? null)
      setInviteState('ready')
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : 'Failed to generate invite link')
      setInviteState('idle')
    }
  }

  function copyInvite(type: 'code' | 'link') {
    if (!inviteCode) return
    const text = type === 'code'
      ? inviteCode
      : `${typeof window !== 'undefined' ? window.location.origin : ''}/join?code=${inviteCode}`
    navigator.clipboard.writeText(text).then(() => {
      setInviteCopied(type)
      setTimeout(() => setInviteCopied(null), 2000)
    })
  }

  // ── Reset data flow ──────────────────────────────────────────────────────────
  const [resetStep,  setResetStep]  = useState<ResetStep>('idle')
  const [resetCode,  setResetCode]  = useState('')
  const [resetError, setResetError] = useState('')
  const codeRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (currentUser?.company) setTenantName(currentUser.company)
  }, [currentUser])

  // Load team members once when "users" tab is active
  useEffect(() => {
    if (activeTab !== 'users' || membersLoaded) return
    fetch('/api/team/members')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.members)) setMembers(d.members)
        setMembersLoaded(true)
      })
      .catch(() => setMembersLoaded(true))
  }, [activeTab, membersLoaded])

  async function updateMemberRole(member: TeamMember, newRole: string) {
    setUpdatingRole(member.user_id)
    try {
      const res = await fetch('/api/team/update-role', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId: member.user_id, role: newRole }),
      })
      if (res.ok) {
        setMembers(prev => prev.map(m => m.user_id === member.user_id ? { ...m, role: newRole } : m))
      }
    } catch {}
    setUpdatingRole(null)
  }

  const [removing, setRemoving] = useState<string | null>(null)

  async function removeMember(member: TeamMember) {
    if (!window.confirm(`Remove ${member.name || member.email} from the workspace? They will need a new invite code to rejoin.`)) return
    setRemoving(member.user_id)
    try {
      const res = await fetch('/api/team/remove', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId: member.user_id }),
      })
      if (res.ok) setMembers(prev => prev.filter(m => m.user_id !== member.user_id))
    } catch {}
    setRemoving(null)
  }

  async function openEmployeeLogs(member: TeamMember) {
    setLogsEmployee(member)
    setLogs([])
    setLogsLoading(true)
    try {
      const res = await fetch(`/api/team/employee-logs?userId=${member.user_id}`)
      const d   = await res.json()
      if (Array.isArray(d.logs)) setLogs(d.logs)
    } catch {}
    setLogsLoading(false)
  }

  function formatTs(ts: string) {
    try {
      return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(ts))
    } catch { return ts }
  }

  // Auto-focus first code box when verify step opens
  useEffect(() => {
    if (resetStep === 'verify') {
      setTimeout(() => codeRefs.current[0]?.focus(), 80)
    }
  }, [resetStep])

  async function sendResetCode() {
    setResetStep('sending')
    setResetError('')
    try {
      const res  = await fetch('/api/send-mfa', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: currentUser?.email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send code')
      setResetCode('')
      setResetStep('verify')
    } catch (e) {
      setResetError(e instanceof Error ? e.message : 'Failed to send verification code')
      setResetStep('error')
    }
  }

  async function verifyAndReset() {
    if (resetCode.length !== 6) return
    setResetStep('verifying')
    setResetError('')
    try {
      const res  = await fetch('/api/verify-mfa', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: currentUser?.email, code: resetCode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Incorrect code')
      clearDataset()
      await fetch('/api/workspace/reset', { method: 'POST' }).catch(() => null)
      setResetStep('done')
    } catch (e) {
      setResetError(e instanceof Error ? e.message : 'Verification failed')
      setResetCode('')
      setResetStep('verify')
      setTimeout(() => codeRefs.current[0]?.focus(), 80)
    }
  }

  function handleCodeDigit(i: number, val: string) {
    const digits = val.replace(/\D/g, '').slice(-1)
    const chars  = resetCode.split('')
    chars[i]     = digits
    const next   = chars.join('').slice(0, 6)
    setResetCode(next)
    if (digits && i < 5) codeRefs.current[i + 1]?.focus()
    if (next.length === 6) {
      // Small delay so the last digit renders before submit
      setTimeout(() => {
        const syntheticCode = next
        setResetStep('verifying')
        setResetError('')
        fetch('/api/verify-mfa', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ email: currentUser?.email, code: syntheticCode }),
        })
          .then(r => r.json().then(d => ({ ok: r.ok, d })))
          .then(({ ok, d }) => {
            if (!ok) throw new Error(d.error || 'Incorrect code')
            clearDataset()
            void fetch('/api/workspace/reset', { method: 'POST' }).catch(() => null)
            setResetStep('done')
          })
          .catch(e => {
            setResetError(e instanceof Error ? e.message : 'Verification failed')
            setResetCode('')
            setResetStep('verify')
            setTimeout(() => codeRefs.current[0]?.focus(), 80)
          })
      }, 80)
    }
  }

  function handleCodeKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !resetCode[i] && i > 0) {
      const chars = resetCode.split('')
      chars[i - 1] = ''
      setResetCode(chars.join(''))
      codeRefs.current[i - 1]?.focus()
    }
  }

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'users',    label: 'Users'    },
    { id: 'roles',    label: 'Roles'    },
    { id: 'security', label: 'Security' },
    { id: 'tenant',   label: 'Tenant'   },
    { id: 'detection', label: 'Detection' },
    { id: 'data',     label: 'Data'     },
  ]

  return (
    <AppLayout title="Settings">
      <PageHeader
        title="Settings"
        subtitle="Users, roles, security, and tenant configuration"
        className="mb-6"
      />

      {/* Tabs */}
      <div className="flex items-center gap-0.5 mb-6 border-b border-border">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id ? 'border-accent-500 text-accent-700' : 'border-transparent text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Invite modal ── */}
      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => setInviteOpen(false)} />
          <div className="relative bg-surface-raised rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <p className="text-sm font-medium text-text-primary">Invite team member</p>
                <p className="text-xs text-text-muted mt-0.5">Share this link with employees to join your workspace</p>
              </div>
              <button onClick={() => setInviteOpen(false)} aria-label="Close" className="text-text-muted hover:text-text-primary hover:bg-surface-overlay p-1.5 rounded-md">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-5 space-y-4">
              {inviteState === 'loading' && (
                <div className="flex items-center gap-3 py-4">
                  <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
                  <p className="text-sm text-text-muted">Generating invite link…</p>
                </div>
              )}
              {inviteError && (
                <div className="flex items-start gap-2 bg-critical-bg border border-critical-line text-critical-fg rounded-lg px-3 py-2.5 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{inviteError}</span>
                </div>
              )}
              {inviteState === 'ready' && inviteCode && (
                <>
                  <div>
                    <p className="text-[12.5px] font-medium text-text-muted mb-2">Invite code</p>
                    <div className="flex items-center gap-2 bg-surface-hover border border-border rounded-lg px-3 py-2.5">
                      <code className="text-xs text-text-secondary font-mono flex-1 truncate">{inviteCode}</code>
                      <button
                        onClick={() => copyInvite('code')}
                        className="flex-shrink-0 text-xs font-medium text-text-muted hover:text-text-secondary flex items-center gap-1 transition-colors"
                      >
                        {inviteCopied === 'code' ? <><CheckCircle className="w-3.5 h-3.5 text-positive-fg" /> Copied</> : 'Copy'}
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-[12.5px] font-medium text-text-muted mb-2">Invite link</p>
                    <div className="flex items-center gap-2 bg-surface-hover border border-border rounded-lg px-3 py-2.5">
                      <span className="text-xs text-text-muted flex-1 truncate font-mono">
                        {typeof window !== 'undefined' ? window.location.origin : ''}/join?code={inviteCode}
                      </span>
                      <button
                        onClick={() => copyInvite('link')}
                        className="flex-shrink-0 text-xs font-medium text-text-muted hover:text-text-secondary flex items-center gap-1 transition-colors"
                      >
                        {inviteCopied === 'link' ? <><CheckCircle className="w-3.5 h-3.5 text-positive-fg" /> Copied</> : 'Copy'}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Anyone with this link can join your workspace as a Viewer. You can change their role from the dashboard.
                    Regenerating the link invalidates the previous one.
                  </p>
                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={openInviteModal}
                      className="flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text-secondary transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" /> Regenerate link
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Users ── */}
      {activeTab === 'users' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-text-secondary">
              {1 + members.length} user{1 + members.length !== 1 ? 's' : ''} · {1 + members.length} active
            </p>
            <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={openInviteModal}>
              Invite user
            </Button>
          </div>

          <div className="bg-surface-raised border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-overlay border-b border-border">
                  {['User', 'Role', 'Joined', 'Logs', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[12.5px] font-medium text-text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {/* Admin (current user) */}
                {currentUser && (
                  <tr className="hover:bg-surface-hover transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-[10px] font-bold">
                            {(currentUser.name || currentUser.email).slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-text-primary">{currentUser.name || 'N/A'}</p>
                          <p className="text-xs text-text-muted">{currentUser.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-accent-50 text-accent-700 border-accent-200">
                        Admin
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs text-text-muted">Workspace owner</span>
                    </td>
                    <td className="px-4 py-3.5" />
                    <td className="px-4 py-3.5" />
                  </tr>
                )}

                {/* Team members */}
                {!membersLoaded && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center">
                      <Loader2 className="w-4 h-4 text-text-muted animate-spin inline-block" />
                    </td>
                  </tr>
                )}
                {membersLoaded && members.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-xs text-text-muted italic">
                      No team members yet. Share an invite link to add employees.
                    </td>
                  </tr>
                )}
                {members.map(member => (
                  <tr key={member.user_id} className="hover:bg-surface-hover transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-surface-overlay flex items-center justify-center flex-shrink-0">
                          <span className="text-text-secondary text-[10px] font-bold">
                            {(member.name || member.email).slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-text-primary">{member.name || 'N/A'}</p>
                          <p className="text-xs text-text-muted">{member.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="relative inline-block">
                        <select
                          value={member.role}
                          onChange={e => updateMemberRole(member, e.target.value)}
                          disabled={updatingRole === member.user_id}
                          className={`text-xs font-medium px-2.5 py-1 pr-6 border rounded-full appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent-500 ${ROLE_COLORS[member.role] ?? ROLE_COLORS.viewer}`}
                        >
                          <option value="viewer">Viewer</option>
                          <option value="analyst">Analyst</option>
                          <option value="editor">Editor</option>
                        </select>
                        <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                        {updatingRole === member.user_id && (
                          <Loader2 className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 animate-spin" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs text-text-muted">
                        {member.joined_at ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(member.joined_at)) : 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => openEmployeeLogs(member)}
                        className="flex items-center gap-1 text-xs text-accent-700 hover:text-accent-800 font-medium transition-colors"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        View logs
                      </button>
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => removeMember(member)}
                        disabled={removing === member.user_id}
                        title="Remove from workspace"
                        className="p-1.5 text-critical-fg hover:text-critical-fg hover:bg-critical-bg rounded disabled:opacity-40 transition-colors"
                      >
                        {removing === member.user_id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Employee logs slide-in panel */}
          {logsEmployee && (
            <div className="fixed inset-0 z-50 flex">
              <div className="absolute inset-0 bg-black/40" onClick={() => setLogsEmployee(null)} />
              <div className="relative ml-auto w-full max-w-md bg-surface-raised h-full flex flex-col shadow-2xl">
                {/* Panel header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{logsEmployee.name || logsEmployee.email}</p>
                    <p className="text-xs text-text-muted mt-0.5">Activity log · {logsEmployee.email}</p>
                  </div>
                  <button onClick={() => setLogsEmployee(null)} className="p-1.5 text-text-muted hover:text-text-secondary hover:bg-surface-overlay rounded transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Role badge */}
                <div className="px-5 py-3 border-b border-border-subtle flex items-center gap-2">
                  <span className="text-[11px] text-text-muted">Current role:</span>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 border rounded-full ${ROLE_COLORS[logsEmployee.role] ?? ROLE_COLORS.viewer}`}>
                    {logsEmployee.role.charAt(0).toUpperCase() + logsEmployee.role.slice(1)}
                  </span>
                </div>

                {/* Logs */}
                <div className="flex-1 overflow-y-auto px-5 py-4">
                  {logsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
                    </div>
                  ) : logs.length === 0 ? (
                    <div className="text-center py-12">
                      <Clock className="w-8 h-8 text-text-muted mx-auto mb-3" />
                      <p className="text-sm text-text-muted">No activity recorded yet.</p>
                      <p className="text-xs text-text-muted mt-1">Actions will appear here once the employee interacts with the workspace.</p>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {logs.map((entry, i) => (
                        <li key={i} className="flex items-start gap-3 py-2 border-b border-border-subtle last:border-0">
                          <div className="w-6 h-6 rounded-full bg-surface-overlay flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Clock className="w-3 h-3 text-text-muted" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-text-secondary">{entry.detail || entry.action}</p>
                            {entry.resource && <p className="text-xs text-text-muted mt-0.5">{entry.resource}</p>}
                          </div>
                          <span className="text-[11px] text-text-muted flex-shrink-0 mt-0.5">{formatTs(entry.ts)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Roles ── */}
      {activeTab === 'roles' && (
        <div className="space-y-3">
          {roles.map((role) => (
            <div key={role.name} className="bg-surface-raised border border-border rounded-lg overflow-hidden">
              <div className="p-4 flex items-center gap-4">
                <span className={`text-xs font-medium px-3 py-1.5 rounded-full border w-36 text-center flex-shrink-0 ${role.color}`}>
                  {role.name}
                </span>
                <p className="text-sm text-text-secondary flex-1">{role.desc}</p>
                <Button
                  variant="ghost" size="sm" icon={<Eye className="w-3.5 h-3.5" />}
                  onClick={() => setExpandedRole(prev => prev === role.name ? null : role.name)}
                >
                  {expandedRole === role.name ? 'Hide' : 'View'}
                </Button>
              </div>
              {expandedRole === role.name && (
                <div className="px-4 pb-4 pt-1 border-t border-border-subtle bg-surface-hover/50">
                  <p className="text-[12px] font-medium text-text-muted mt-3 mb-2">Permissions</p>
                  <ul className="space-y-1.5">
                    {role.permissions.map(p => (
                      <li key={p} className="flex items-center gap-2 text-sm text-text-secondary">
                        <CheckCircle className="w-3.5 h-3.5 text-positive-fg flex-shrink-0" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
          <p className="text-xs text-text-muted mt-3">
            Need a custom role for your organization?{' '}
            <a href="/contact" className="text-accent-700 hover:text-accent-800 font-medium">Contact us</a>. Custom roles are available on Enterprise plans.
          </p>
        </div>
      )}

      {/* ── Security ── */}
      {activeTab === 'security' && (
        <div className="space-y-6 max-w-3xl">
          <Card>
            <CardHeader title="Authentication" icon={<Shield className="w-4 h-4" />} />
            <CardDivider />
            <div className="space-y-4">
              {[
                { label: 'Multifactor authentication',  value: 'Required for all users', status: 'on',  detail: 'A verification code is emailed on every sign in, for admins and employees.' },
                { label: 'Session timeout',             value: '8 hours inactivity',     status: 'cfg', detail: 'Idle sessions are ended automatically.' },
                { label: 'Password policy',             value: 'Enforced at sign up',    status: 'ok',  detail: 'Minimum 8 characters, with an uppercase letter and a special character.' },
              ].map((item) => (
                <div key={item.label} className="flex items-start justify-between py-3 border-b border-border-subtle last:border-0 gap-4">
                  <div>
                    <p className="text-sm font-medium text-text-secondary">{item.label}</p>
                    <p className="text-xs text-text-muted mt-0.5">{item.detail}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-xs font-medium ${item.status === 'on' || item.status === 'ok' ? 'text-positive-fg' : 'text-positive-fg'}`}>{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="API Access" icon={<Key className="w-4 h-4" />} />
            <CardDivider />
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-surface-hover border border-border rounded-lg gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-secondary">API Key: Production</p>
                  <p className="text-xs font-mono text-text-muted mt-0.5 truncate">
                    {apiKeyVisible ? apiKey : `${apiKey.slice(0, 10)}${'•'.repeat(26)}${apiKey.slice(-4)}`}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    variant="ghost" size="sm" icon={<Eye className="w-3.5 h-3.5" />}
                    onClick={() => setApiKeyVisible(v => !v)}
                  />
                  <Button
                    variant="ghost" size="sm"
                    icon={<RefreshCw className="w-3.5 h-3.5" />}
                    onClick={() => {
                      if (window.confirm('Regenerate the production API key? The current key will stop working immediately.')) {
                        setApiKey(generateApiKey())
                        setApiKeyVisible(true)
                      }
                    }}
                  />
                </div>
              </div>
              <p className="text-xs text-text-muted flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 text-medium-fg" />
                API keys grant full read/write access. Never share or commit to version control.
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* ── Tenant ── */}
      {activeTab === 'tenant' && (
        <div className="space-y-6 max-w-3xl">
          <Card>
            <CardHeader title="Organization Details" icon={<Building2 className="w-4 h-4" />} />
            <CardDivider />
            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-text-primary mb-1.5">Organization name</label>
                <input
                  value={tenantName}
                  onChange={e => setTenantName(e.target.value)}
                  className="w-full bg-surface border border-border-strong rounded-lg px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-500/30 focus:border-accent-500 focus-visible:ring-offset-0"
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-text-primary mb-1.5">Timezone</label>
                <select
                  value={timezone}
                  onChange={e => setTimezone(e.target.value)}
                  className="w-full bg-surface border border-border-strong rounded-lg px-3.5 py-2.5 text-sm text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-500"
                >
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  <option value="America/Chicago">Central Time (CT)</option>
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Button
                  variant="primary"
                  size="md"
                  disabled={savingOrgName || !tenantName.trim()}
                  onClick={async () => {
                    setSavingOrgName(true)
                    setOrgNameError('')
                    setOrgNameSaved(false)
                    try {
                      const res = await fetch('/api/settings/update-org-name', {
                        method:  'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body:    JSON.stringify({ name: tenantName.trim() }),
                      })
                      if (!res.ok) {
                        const body = await res.json().catch(() => ({}))
                        setOrgNameError(body.error || 'Failed to save organization name.')
                        return
                      }
                      // Also update the local display cache so this admin's
                      // own session reflects the new name immediately.
                      if (currentUser) saveUser({ ...currentUser, company: tenantName.trim() })
                      setOrgNameSaved(true)
                      setTimeout(() => setOrgNameSaved(false), 3000)
                    } catch {
                      setOrgNameError('Failed to save organization name. Please try again.')
                    } finally {
                      setSavingOrgName(false)
                    }
                  }}
                >
                  {savingOrgName ? 'Saving…' : 'Save changes'}
                </Button>
                <Button variant="secondary" size="md" onClick={() => { setTenantName(currentUser?.company || ''); setOrgNameError('') }}>Discard</Button>
                {orgNameSaved && <span className="text-xs font-medium text-positive-fg">Saved. Your team will see this the next time they load the app.</span>}
                {orgNameError && <span className="text-xs font-medium text-critical-fg">{orgNameError}</span>}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Subscription" icon={<Settings className="w-4 h-4" />} />
            <CardDivider />
            <div className="space-y-3">
              {[
                { label: 'Plan', value: `${plan} Plan`, highlight: true },
              ].map((row) => (
                <div key={row.label} className="flex justify-between items-center text-sm py-1.5 border-b border-border-subtle last:border-0">
                  <span className="text-text-muted">{row.label}</span>
                  <span className={`font-medium ${'highlight' in row && row.highlight ? 'text-positive-fg' : 'text-text-secondary'}`}>{row.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <p className="text-xs text-text-muted">
                You're on the highest tier. Questions about billing?{' '}
                <a href="/contact" className="text-accent-700 hover:text-accent-800 font-medium">Contact us</a>
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* ── Data ── */}
      {activeTab === 'detection' && <DetectionSettings isAdmin={currentUser?.role !== 'employee'} />}

      {activeTab === 'data' && (
        <div className="max-w-xl space-y-6">

          {/* ── Idle ── */}
          {resetStep === 'idle' && (
            <Card>
              <CardHeader title="Data Management" icon={<Database className="w-4 h-4" />} />
              <CardDivider />
              <div className="space-y-4">
                <p className="text-sm text-text-secondary leading-relaxed">
                  Reset all uploaded data and connected source contributions from your workspace.
                  This removes every file you have uploaded and all computed metrics derived from them.
                  Your account and settings are not affected.
                </p>
                <div className="bg-critical-bg border border-critical-line rounded-lg p-4 flex gap-3">
                  <AlertCircle className="w-4 h-4 text-critical-fg flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-critical-fg">
                    This action is permanent. All uploaded data, anomaly results, and spend metrics will be erased.
                    You will need to re-upload your files to restore them.
                  </p>
                </div>
                <button
                  onClick={() => setResetStep('confirm')}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Reset all data
                </button>
              </div>
            </Card>
          )}

          {/* ── Confirm ── */}
          {resetStep === 'confirm' && (
            <Card>
              <CardHeader title="Confirm data reset" icon={<AlertCircle className="w-4 h-4 text-critical-fg" />} />
              <CardDivider />
              <div className="space-y-5">
                <p className="text-sm text-text-secondary leading-relaxed">
                  Are you sure you want to permanently delete all uploaded data?
                  This cannot be undone. A verification code will be sent to{' '}
                  <span className="font-medium text-text-primary">{currentUser?.email}</span>{' '}
                  to confirm.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={sendResetCode}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
                  >
                    Yes, send verification code
                  </button>
                  <button
                    onClick={() => setResetStep('idle')}
                    className="text-sm font-medium text-text-secondary hover:text-text-primary px-4 py-2.5 rounded-lg border border-border hover:bg-surface-hover transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </Card>
          )}

          {/* ── Sending ── */}
          {resetStep === 'sending' && (
            <Card>
              <CardHeader title="Sending verification code…" icon={<Loader2 className="w-4 h-4 animate-spin text-text-muted" />} />
              <CardDivider />
              <p className="text-sm text-text-muted py-2">
                Sending a 6-digit code to <span className="font-medium text-text-secondary">{currentUser?.email}</span>
              </p>
            </Card>
          )}

          {/* ── Verify ── */}
          {(resetStep === 'verify' || resetStep === 'verifying') && (
            <Card>
              <CardHeader title="Enter verification code" icon={<Shield className="w-4 h-4" />} />
              <CardDivider />
              <div className="space-y-5">
                <p className="text-sm text-text-secondary">
                  Enter the 6-digit code sent to <span className="font-medium text-text-primary">{currentUser?.email}</span>.
                  The code expires in 10 minutes.
                </p>

                {/* 6-digit input boxes */}
                <div className="flex gap-2.5">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <input
                      key={i}
                      ref={el => { codeRefs.current[i] = el }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={resetCode[i] ?? ''}
                      onChange={e => handleCodeDigit(i, e.target.value)}
                      onKeyDown={e => handleCodeKeyDown(i, e)}
                      disabled={resetStep === 'verifying'}
                      className="w-11 h-14 text-center text-xl font-medium tracking-[-0.02em] border border-border-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-critical disabled:opacity-50 text-text-primary"
                    />
                  ))}
                </div>

                {resetError && (
                  <p className="text-sm text-critical-fg flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    {resetError}
                  </p>
                )}

                {resetStep === 'verifying' && (
                  <p className="text-sm text-text-muted flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verifying…
                  </p>
                )}

                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={verifyAndReset}
                    disabled={resetCode.length !== 6 || resetStep === 'verifying'}
                    className="bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
                  >
                    Confirm reset
                  </button>
                  <button
                    onClick={() => { setResetStep('idle'); setResetCode(''); setResetError('') }}
                    className="text-sm text-text-muted hover:text-text-secondary transition-colors"
                  >
                    Cancel
                  </button>
                </div>

                <button
                  onClick={sendResetCode}
                  disabled={resetStep === 'verifying'}
                  className="text-xs text-text-muted hover:text-text-secondary transition-colors"
                >
                  Didn't receive a code? Resend
                </button>
              </div>
            </Card>
          )}

          {/* ── Done ── */}
          {resetStep === 'done' && (
            <Card>
              <CardHeader title="Data reset complete" icon={<CheckCircle className="w-4 h-4 text-positive-fg" />} />
              <CardDivider />
              <div className="space-y-4">
                <p className="text-sm text-text-secondary">
                  All uploaded data has been permanently removed from your workspace.
                  Connect a new data source or upload a file to get started again.
                </p>
                <button
                  onClick={() => { setResetStep('idle'); setResetCode(''); setResetError('') }}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-text-primary"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to data settings
                </button>
              </div>
            </Card>
          )}

          {/* ── Error ── */}
          {resetStep === 'error' && (
            <Card>
              <CardHeader title="Could not send code" icon={<AlertCircle className="w-4 h-4 text-critical-fg" />} />
              <CardDivider />
              <div className="space-y-4">
                {resetError && <p className="text-sm text-critical-fg">{resetError}</p>}
                <div className="flex gap-3">
                  <button
                    onClick={sendResetCode}
                    className="text-sm font-medium text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition-colors"
                  >
                    Try again
                  </button>
                  <button
                    onClick={() => { setResetStep('idle'); setResetError('') }}
                    className="text-sm text-text-muted hover:text-text-secondary transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </Card>
          )}

        </div>
      )}
    </AppLayout>
  )
}
