import { useState, useEffect } from 'react'
import AppLayout from '../components/layout/AppLayout'
import PageHeader from '../components/ui/PageHeader'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import { Card, CardHeader, CardDivider } from '../components/ui/Card'
import BrandIcon, { type BrandKey } from '../components/ui/BrandIcon'
import ConnectModal, { INTEGRATION_CONFIGS } from '../components/ui/ConnectModal'
import { removeSourceDataset } from '../lib/dataStore'
import {
  Plug, RefreshCw, Settings, Plus, Database, Shield,
  Link, Clock, ChevronRight, Search, Loader2, Trash2,
} from 'lucide-react'

const BRAND_MAP: Record<string, BrandKey> = {
  'quickbooks':  'quickbooks',
  'plaid':       'plaid',
  'adp':         'adp',
  'salesforce':  'salesforce',
  'netsuite':    'netsuite',
  'xero':        'xero',
  'slack':       'slack',
  'csv':         'csv',
  'document':    'documents',
  'okta':        'okta',
  'stripe':      'stripe',
  'sap':         'sap',
  'expensify':   'expensify',
  'gusto':       'gusto',
}

function getBrand(intg: { id: string; name: string }): BrandKey {
  const id = intg.id.toLowerCase()
  for (const [key, val] of Object.entries(BRAND_MAP)) {
    if (id.includes(key) || intg.name.toLowerCase().includes(key)) return val
  }
  return 'generic'
}

function getIntegrationId(intg: { id: string; name: string }): string {
  const name = intg.name.toLowerCase()
  if (name.includes('quickbooks')) return 'quickbooks'
  if (name.includes('plaid'))      return 'plaid'
  if (name.includes('adp'))        return 'adp'
  if (name.includes('salesforce')) return 'salesforce'
  if (name.includes('netsuite'))   return 'netsuite'
  if (name.includes('xero'))       return 'xero'
  if (name.includes('okta'))       return 'okta'
  if (name.includes('slack'))      return 'slack'
  if (name.includes('stripe'))     return 'stripe'
  if (name.includes('sap'))        return 'sap'
  if (name.includes('csv'))        return 'csv'
  if (name.includes('document'))   return 'documents'
  if (name.includes('expensify'))  return 'expensify'
  if (name.includes('gusto'))      return 'gusto'
  return intg.id
}

interface IntegrationDef {
  id:          string
  name:        string
  type:        string
  description: string
  authMethod:  string
}

const INTEGRATION_CATALOG: IntegrationDef[] = [
  { id: 'quickbooks', name: 'QuickBooks Online', type: 'GL / Accounting',    description: 'Two-way sync of transactions, bills, invoices, and GL exports from QuickBooks Online.',                      authMethod: 'OAuth 2.0'        },
  { id: 'plaid',      name: 'Plaid',            type: 'Bank Feeds',         description: 'Direct bank feed connection via Plaid Link. Supports 12,000+ financial institutions.',                          authMethod: 'OAuth (Plaid Link)'},
  { id: 'adp',        name: 'ADP',              type: 'Payroll',            description: 'Payroll run data, employee headcount, and W-2 summaries from ADP Workforce Now.',                               authMethod: 'Token-Based Auth'  },
  { id: 'salesforce', name: 'Salesforce',       type: 'CRM',                description: 'Revenue pipeline, closed deals, and AR aging from Salesforce CRM.',                                             authMethod: 'OAuth 2.0'        },
  { id: 'netsuite',   name: 'NetSuite ERP',     type: 'ERP',                description: 'Full GL, AP/AR, and multi-entity consolidation from Oracle NetSuite.',                                           authMethod: 'Token-Based Auth'  },
  { id: 'okta',       name: 'Okta',             type: 'Identity Provider',  description: 'SSO and user lifecycle management. Automates provisioning and deprovisioning.',                                 authMethod: 'SAML 2.0'         },
  { id: 'csv',        name: 'File Upload',      type: 'File / CSV',        description: 'Upload CSV, XLSX, QBO, OFX, PDF, or ZIP files. Column auto-detection handles most export formats.',              authMethod: 'File Upload'       },
  { id: 'stripe',     name: 'Stripe',           type: 'Payments',           description: 'Revenue transactions, refunds, and dispute history from Stripe.',                                                authMethod: 'API Key'           },
  { id: 'xero',       name: 'Xero',             type: 'GL / Accounting',    description: 'Xero Accounting GL, bank reconciliations, and bills via the Xero API.',                                         authMethod: 'OAuth 2.0'        },
  { id: 'expensify',  name: 'Expensify',        type: 'Expense Management', description: 'Approved expense reports, receipts, and policy violations from Expensify.',                                     authMethod: 'API Key'           },
  { id: 'gusto',      name: 'Gusto',            type: 'Payroll / HR',       description: 'Payroll journal entries, employee costs, and benefits data from Gusto.',                                        authMethod: 'OAuth 2.0'        },
  { id: 'sap',        name: 'SAP S/4HANA',      type: 'Enterprise ERP',     description: 'Full SAP GL, CO, and FI module data via OData APIs.',                                                            authMethod: 'API Key'           },
]

const ADD_OPTIONS = [
  { id: 'quickbooks', name: 'QuickBooks',     brand: 'quickbooks' as BrandKey, desc: 'GL / Accounting'    },
  { id: 'plaid',      name: 'Plaid',          brand: 'plaid'      as BrandKey, desc: 'Bank feeds'         },
  { id: 'adp',        name: 'ADP',            brand: 'adp'        as BrandKey, desc: 'Payroll'            },
  { id: 'salesforce', name: 'Salesforce',     brand: 'salesforce' as BrandKey, desc: 'CRM / Revenue'      },
  { id: 'netsuite',   name: 'NetSuite ERP',   brand: 'netsuite'   as BrandKey, desc: 'Multi-entity GL'    },
  { id: 'xero',       name: 'Xero',           brand: 'xero'       as BrandKey, desc: 'Accounting'         },
  { id: 'okta',       name: 'Okta',           brand: 'okta'       as BrandKey, desc: 'SSO / SCIM'         },
  { id: 'stripe',     name: 'Stripe',         brand: 'stripe'     as BrandKey, desc: 'Payments'           },
  { id: 'expensify',  name: 'Expensify',      brand: 'expensify'  as BrandKey, desc: 'Expense management' },
  { id: 'gusto',      name: 'Gusto',          brand: 'gusto'      as BrandKey, desc: 'HR & payroll'       },
  { id: 'sap',        name: 'SAP S/4HANA',    brand: 'sap'        as BrandKey, desc: 'Enterprise ERP'     },
  { id: 'slack',      name: 'Slack',          brand: 'slack'      as BrandKey, desc: 'Alert notifications' },
  { id: 'csv',        name: 'CSV / Excel',    brand: 'csv'        as BrandKey, desc: 'File upload'        },
  { id: 'documents',  name: 'Doc Upload',     brand: 'documents'  as BrandKey, desc: 'PDF & image OCR'    },
]

export default function IntegrationsPage() {
  const [processingCard, setProcessingCard] = useState<string | null>(null)
  const [activeModal,    setActiveModal]    = useState<string | null>(null)
  const [showAddPanel,   setShowAddPanel]   = useState(false)
  const [addSearch,      setAddSearch]      = useState('')
  const [newlyConnected, setNewlyConnected] = useState<string[]>([])

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('sf_connected') || '{}')
      const params          = new URLSearchParams(window.location.search)
      const oauthConnected  = params.get('connected')
      const oauthError      = params.get('error')

      if (oauthConnected) {
        // OAuth callback returned — mark as connected and clean the URL
        stored[oauthConnected] = { connectedAt: new Date().toISOString(), status: 'Connected' }
        localStorage.setItem('sf_connected', JSON.stringify(stored))
        window.history.replaceState({}, '', '/integrations')
      }

      if (oauthError) {
        console.error('[OAuth] connection error:', oauthError)
        window.history.replaceState({}, '', '/integrations')
      }

      setNewlyConnected(Object.keys(stored))
    } catch {}
  }, [])

  async function handleRefresh(id: string) {
    if (INTEGRATION_CONFIGS[id]?.authType === 'file') {
      setActiveModal(id)
      return
    }
    setProcessingCard(id)
    await new Promise(r => setTimeout(r, 2000))
    setProcessingCard(null)
  }

  function handleConnected(id: string) {
    try {
      const stored = JSON.parse(localStorage.getItem('sf_connected') || '{}')
      if (!stored[id]) {
        stored[id] = { connectedAt: new Date().toISOString(), status: 'Connected' }
        localStorage.setItem('sf_connected', JSON.stringify(stored))
      }
    } catch {}
    setNewlyConnected(prev => prev.includes(id) ? prev : [...prev, id])
  }

  function handleDisconnect(id: string) {
    // Remove only this source's data — other connected sources keep their data
    removeSourceDataset(id)
    try {
      const stored = JSON.parse(localStorage.getItem('sf_connected') || '{}')
      delete stored[id]
      localStorage.setItem('sf_connected', JSON.stringify(stored))
    } catch {}
    setNewlyConnected(prev => prev.filter(s => s !== id))
  }

  const connectedCount = newlyConnected.length

  const filteredAddOptions = ADD_OPTIONS.filter(o =>
    addSearch === '' || o.name.toLowerCase().includes(addSearch.toLowerCase()) || o.desc.toLowerCase().includes(addSearch.toLowerCase())
  )

  return (
    <AppLayout title="Integrations">

      {activeModal && (
        <ConnectModal
          integrationId={activeModal}
          onClose={() => setActiveModal(null)}
          onConnected={(id) => { handleConnected(id) }}
        />
      )}

      <PageHeader
        title="Integrations"
        subtitle="Connected data sources and identity providers"
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setShowAddPanel(p => !p)}
          >
            Add integration
          </Button>
        }
        className="mb-6"
      />

      {/* Add integration panel */}
      {showAddPanel && (
        <div className="mb-6 bg-surface-raised border border-border rounded-lg shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <p className="text-sm font-semibold text-text-primary">Add a new integration</p>
            <button onClick={() => setShowAddPanel(false)} className="text-text-muted hover:text-text-secondary text-xs">Close</button>
          </div>
          <div className="px-5 py-4">
            <div className="flex items-center gap-2 bg-surface-sunken border border-border rounded-md px-3 py-2 mb-4 max-w-xs">
              <Search className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
              <input
                type="text"
                placeholder="Search integrations…"
                value={addSearch}
                onChange={e => setAddSearch(e.target.value)}
                className="bg-transparent text-sm text-text-secondary placeholder-text-muted outline-none w-full"
              />
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {filteredAddOptions.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => { setShowAddPanel(false); setActiveModal(opt.id) }}
                  className="flex flex-col items-center gap-2 p-3 rounded-lg border border-border hover:border-accent-400 hover:shadow-sm transition-all text-center group"
                >
                  <BrandIcon brand={opt.brand} size={36} />
                  <p className="text-xs font-semibold text-text-secondary group-hover:text-accent-400 transition-colors leading-snug">{opt.name}</p>
                  <p className="text-[10px] text-text-muted">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Connected sources', value: `${connectedCount} / ${INTEGRATION_CATALOG.length}`, icon: Plug,     color: 'text-emerald-400',  bg: 'bg-emerald-500/10',  border: 'border-emerald-500/30'  },
          { label: 'Available sources',  value: INTEGRATION_CATALOG.length,                          icon: Database, color: 'text-emerald-400',   bg: 'bg-emerald-500/10',   border: 'border-emerald-500/30'   },
          { label: 'File upload',        value: 'Supported',                                          icon: Shield,   color: 'text-text-secondary',  bg: 'bg-surface-raised',  border: 'border-border'  },
        ].map((s) => {
          const Icon = s.icon
          return (
            <div key={s.label} className={`${s.bg} border ${s.border} rounded-lg px-4 py-3 flex items-center gap-3`}>
              <Icon className={`w-5 h-5 ${s.color} flex-shrink-0`} />
              <div>
                <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-text-muted">{s.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Integration cards */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
        {INTEGRATION_CATALOG.map((intg) => {
          const brand      = getBrand(intg)
          const modalId    = getIntegrationId(intg)
          const isInConfig = !!INTEGRATION_CONFIGS[modalId]
          const isConnected = newlyConnected.includes(modalId)
          const status = isConnected ? 'Connected' : 'Not connected'
          return (
            <div key={intg.id} className="bg-surface-raised border border-border rounded-lg p-5 flex flex-col min-h-[220px]">
              {processingCard === modalId ? (
                <div className="flex flex-col items-center justify-center flex-1 gap-3 py-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-text-primary">Refreshing…</p>
                    <p className="text-xs text-text-muted mt-0.5">Syncing latest records from {intg.name}</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <BrandIcon brand={brand} size={40} />
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{intg.name}</p>
                        <p className="text-xs text-text-muted">{intg.type}</p>
                      </div>
                    </div>
                    <Badge variant="integration" value={status} dot>{status}</Badge>
                  </div>

                  <p className="text-xs text-text-muted leading-relaxed mb-4 flex-1">{intg.description}</p>

                  <div className="space-y-1.5 mb-4">
                    {[
                      { label: 'Auth method', value: intg.authMethod },
                      { label: 'Records',     value: isConnected ? 'Synced' : 'N/A' },
                    ].map((row) => (
                      <div key={row.label} className="flex justify-between text-xs">
                        <span className="text-text-muted">{row.label}</span>
                        <span className="text-text-secondary font-medium">{row.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-border-subtle">
                    {isConnected ? (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<RefreshCw className="w-3 h-3" />}
                          onClick={() => handleRefresh(modalId)}
                          className="flex-1"
                        >
                          Refresh
                        </Button>
                        <button
                          onClick={() => handleDisconnect(modalId)}
                          className="flex items-center gap-1 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2.5 py-1.5 rounded-md transition-colors border border-transparent hover:border-red-500/30"
                        >
                          <Trash2 className="w-3 h-3" />
                          Reset
                        </button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<RefreshCw className="w-3 h-3" />}
                          onClick={() => handleRefresh(intg.id)}
                          className="flex-1"
                        >
                          Sync now
                        </Button>
                        {isInConfig && (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Settings className="w-3.5 h-3.5" />}
                            onClick={() => setActiveModal(modalId)}
                          >
                            Configure
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" icon={<ChevronRight className="w-3.5 h-3.5" />} />
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* SSO / Identity section */}
      <Card>
        <CardHeader
          title="Identity & Access Management"
          subtitle="SSO and SCIM provisioning"
          icon={<Shield className="w-4 h-4" />}
          action={<Badge variant="green">Active</Badge>}
        />
        <CardDivider />
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              title:       'SAML 2.0 SSO',
              status:      'Connected',
              provider:    'Okta',
              brand:       'okta' as BrandKey,
              description: 'Single sign-on via Okta SAML 2.0. Session management and MFA enforced at the identity provider.',
              icon:        Shield,
            },
            {
              title:       'SCIM 2.0 Provisioning',
              status:      'Active',
              provider:    'Okta',
              brand:       'okta' as BrandKey,
              description: 'Automatic user creation, attribute sync, and deprovisioning on offboard events from Okta.',
              icon:        RefreshCw,
            },
            {
              title:       'Directory Sync',
              status:      'Active',
              provider:    'Okta',
              brand:       'okta' as BrandKey,
              description: 'Groups and roles synced from Okta on a configurable schedule. Map directory groups to Ventura roles.',
              icon:        Link,
            },
          ].map((item) => {
            const Icon = item.icon
            return (
              <div key={item.title} className="bg-surface-sunken border border-border rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <BrandIcon brand={item.brand} size={28} />
                    <div>
                      <p className="text-sm font-semibold text-text-secondary">{item.title}</p>
                      <p className="text-xs text-text-muted">via {item.provider}</p>
                    </div>
                  </div>
                  <Badge variant="green">{item.status}</Badge>
                </div>
                <p className="text-xs text-text-muted leading-relaxed mb-3">{item.description}</p>
                <button
                  onClick={() => setActiveModal('okta')}
                  className="text-xs text-accent-400 hover:text-accent-300 font-medium flex items-center gap-1 transition-colors"
                >
                  Configure <Settings className="w-3 h-3" />
                </button>
              </div>
            )
          })}
        </div>
      </Card>
    </AppLayout>
  )
}
