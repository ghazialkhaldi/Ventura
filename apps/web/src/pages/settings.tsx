import React, { useState, useEffect } from 'react'
import AppLayout from '../components/layout/AppLayout'
import PageHeader from '../components/ui/PageHeader'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import { Card, CardHeader, CardDivider } from '../components/ui/Card'
import { useCurrentUser, saveUser } from '../hooks/useCurrentUser'
import {
  Users, Shield, Building2, Settings, Plus, Edit,
  CheckCircle, XCircle, Lock, Key, RefreshCw, AlertTriangle,
  Eye, Mail,
} from 'lucide-react'

type SettingsTab = 'users' | 'roles' | 'security' | 'tenant'

const roles = [
  { name: 'Admin',           desc: 'Full access — manage users, settings, AI governance, all data',       users: 3,  color: 'bg-red-50 text-red-700 border-red-200' },
  { name: 'Finance Manager', desc: 'Approve anomalies, manage workflows, view all spend data',             users: 2,  color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { name: 'Finance Analyst', desc: 'View and comment on anomalies, read-only workflow access',             users: 4,  color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { name: 'Read-Only',       desc: 'View dashboards and reports. No approval or action capabilities.',     users: 3,  color: 'bg-slate-100 text-slate-600 border-slate-200' },
  { name: 'System',          desc: 'Ventura AI service account — non-human, cannot log in directly.',        users: 1,  color: 'bg-green-50 text-green-700 border-green-200' },
]

const statusColor: Record<string, string> = {
  Active:   'bg-green-50 text-green-700 border border-green-200',
  Inactive: 'bg-slate-100 text-slate-500 border border-slate-200',
  Pending:  'bg-amber-50 text-amber-700 border border-amber-200',
}

export default function SettingsPage() {
  const currentUser = useCurrentUser()
  const [activeTab, setActiveTab] = useState<SettingsTab>('users')
  const [tenantName, setTenantName] = useState('')
  const [timezone, setTimezone] = useState('America/New_York')
  const [plan] = useState('Enterprise')

  useEffect(() => {
    if (currentUser?.company) setTenantName(currentUser.company)
  }, [currentUser])

  const tabs: { id: SettingsTab; label: string; icon: React.ReactElement }[] = [
    { id: 'users',    label: 'Users',    icon: <Users className="w-3.5 h-3.5" />    },
    { id: 'roles',    label: 'Roles',    icon: <Shield className="w-3.5 h-3.5" />   },
    { id: 'security', label: 'Security', icon: <Lock className="w-3.5 h-3.5" />     },
    { id: 'tenant',   label: 'Tenant',   icon: <Building2 className="w-3.5 h-3.5" /> },
  ]

  return (
    <AppLayout title="Settings">
      <PageHeader
        title="Settings"
        subtitle="Users, roles, security, and tenant configuration"
        className="mb-6"
      />

      {/* Tabs */}
      <div className="flex items-center gap-0.5 mb-6 border-b border-slate-200">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Users ── */}
      {activeTab === 'users' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-600">1 user · 1 active</p>
            <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>
              Invite user
            </Button>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg shadow-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['User', 'Role', 'Status', 'MFA', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentUser && (
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-[10px] font-bold">
                            {(currentUser.name || currentUser.email).slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{currentUser.name || '—'}</p>
                          <p className="text-xs text-slate-500">{currentUser.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${roles.find(r => r.name === (currentUser.role || 'Admin'))?.color || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {currentUser.role || 'Admin'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColor['Active']}`}>
                        Active
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" icon={<Edit className="w-3.5 h-3.5" />} />
                        <Button variant="ghost" size="sm" icon={<Mail className="w-3.5 h-3.5" />} />
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Roles ── */}
      {activeTab === 'roles' && (
        <div className="space-y-3">
          {roles.map((role) => (
            <div key={role.name} className="bg-white border border-slate-200 rounded-lg p-4 shadow-card flex items-center gap-4">
              <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border w-36 text-center flex-shrink-0 ${role.color}`}>
                {role.name}
              </span>
              <p className="text-sm text-slate-600 flex-1">{role.desc}</p>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-slate-800">{role.users}</p>
                <p className="text-xs text-slate-400">users</p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button variant="ghost" size="sm" icon={<Eye className="w-3.5 h-3.5" />}>View</Button>
                <Button variant="ghost" size="sm" icon={<Edit className="w-3.5 h-3.5" />} />
              </div>
            </div>
          ))}
          <Button variant="secondary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} className="mt-2">
            Create custom role
          </Button>
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
                { label: 'Multi-Factor Authentication (MFA)',   value: 'Required for all users', status: 'on',  detail: 'TOTP + WebAuthn supported. Enforce enrollment per role.' },
                { label: 'SSO (Okta SAML 2.0)',                 value: 'Configurable',           status: 'on',  detail: 'Connect your Okta org to enable SAML 2.0 single sign-on.' },
                { label: 'Session timeout',                     value: '8 hours inactivity',     status: 'cfg', detail: 'Idle sessions are terminated. Configurable per role.' },
                { label: 'Password policy',                     value: 'Managed by IdP',         status: 'ok',  detail: 'Min 12 chars, complexity enforced at identity provider.' },
              ].map((item) => (
                <div key={item.label} className="flex items-start justify-between py-3 border-b border-slate-100 last:border-0 gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{item.detail}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-xs font-semibold ${item.status === 'on' || item.status === 'ok' ? 'text-green-700' : 'text-emerald-700'}`}>{item.value}</p>
                    <button className="text-xs text-emerald-600 hover:text-emerald-800 mt-0.5">Configure</button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Network Security" icon={<Lock className="w-4 h-4" />} />
            <CardDivider />
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-slate-800">IP allowlist</p>
                  <Button variant="secondary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>Add</Button>
                </div>
                <p className="text-xs text-slate-500 italic py-2">No IP rules configured. Add CIDR ranges to restrict access to specific networks.</p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="API Access" icon={<Key className="w-4 h-4" />} />
            <CardDivider />
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-slate-800">API Key — Production</p>
                  <p className="text-xs font-mono text-slate-400 mt-0.5">optm_live_••••••••••••••••••••••••••xY2q</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" icon={<Eye className="w-3.5 h-3.5" />} />
                  <Button variant="ghost" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} />
                </div>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 text-amber-500" />
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
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Organization name</label>
                <input
                  value={tenantName}
                  onChange={e => setTenantName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Timezone</label>
                <select
                  value={timezone}
                  onChange={e => setTimezone(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  <option value="America/Chicago">Central Time (CT)</option>
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    if (currentUser) saveUser({ ...currentUser, company: tenantName.trim() || currentUser.company })
                  }}
                >
                  Save changes
                </Button>
                <Button variant="secondary" size="md" onClick={() => setTenantName(currentUser?.company || '')}>Discard</Button>
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
                <div key={row.label} className="flex justify-between items-center text-sm py-1.5 border-b border-slate-100 last:border-0">
                  <span className="text-slate-500">{row.label}</span>
                  <span className={`font-semibold ${'highlight' in row && row.highlight ? 'text-emerald-700' : 'text-slate-800'}`}>{row.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" size="sm">Upgrade plan</Button>
              <Button variant="ghost" size="sm">Billing portal</Button>
            </div>
          </Card>
        </div>
      )}
    </AppLayout>
  )
}
