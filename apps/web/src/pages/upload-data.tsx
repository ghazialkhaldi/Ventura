import { useState, useEffect } from 'react'
import AppLayout from '../components/layout/AppLayout'
import PageHeader from '../components/ui/PageHeader'
import BrandIcon, { type BrandKey } from '../components/ui/BrandIcon'
import ConnectModal from '../components/ui/ConnectModal'
import { CheckCircle, ArrowRight } from 'lucide-react'

interface SourceCard {
  id:          string
  name:        string
  brand:       BrandKey
  type:        string
  description: string
}

const SOURCE_CARDS: SourceCard[] = [
  { id: 'quickbooks', name: 'QuickBooks Online', brand: 'quickbooks', type: 'GL / Accounting',    description: 'Sync transactions, bills, and GL exports.' },
  { id: 'xero',       name: 'Xero',              brand: 'xero',       type: 'GL / Accounting',    description: 'GL data, bank reconciliation, and bills.' },
  { id: 'plaid',      name: 'Plaid',             brand: 'plaid',      type: 'Bank Feeds',         description: 'Live bank feeds from 12,000+ institutions.' },
  { id: 'netsuite',   name: 'NetSuite ERP',       brand: 'netsuite',   type: 'ERP',                description: 'Full GL, AP/AR, and multi-entity data.' },
  { id: 'sap',        name: 'SAP S/4HANA',        brand: 'sap',        type: 'Enterprise ERP',     description: 'GL, CO, and FI module data via OData.' },
  { id: 'adp',        name: 'ADP',               brand: 'adp',        type: 'Payroll',            description: 'Payroll runs, headcount, and W-2 data.' },
  { id: 'salesforce', name: 'Salesforce',         brand: 'salesforce', type: 'CRM',                description: 'Revenue pipeline, closed deals, AR aging.' },
  { id: 'stripe',     name: 'Stripe',             brand: 'stripe',     type: 'Payments',           description: 'Revenue, refunds, and dispute history.' },
  { id: 'expensify',  name: 'Expensify',          brand: 'expensify',  type: 'Expense Management', description: 'Approved expense reports and receipts.' },
  { id: 'gusto',      name: 'Gusto',              brand: 'gusto',      type: 'Payroll / HR',       description: 'Payroll journal entries and employee costs.' },
  { id: 'slack',      name: 'Slack',             brand: 'slack',      type: 'Notifications',      description: 'Anomaly alerts in your Slack channel.' },
]

export default function UploadDataPage() {
  const [activeModal,  setActiveModal]  = useState<string | null>(null)
  const [connectedIds, setConnectedIds] = useState<string[]>([])

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('sf_connected') || '{}')
      setConnectedIds(Object.keys(stored))
    } catch {}
  }, [])

  function handleConnected(id: string) {
    setConnectedIds(prev => prev.includes(id) ? prev : [...prev, id])
  }

  return (
    <AppLayout title="Integrations">

      {activeModal && (
        <ConnectModal
          integrationId={activeModal}
          onClose={() => setActiveModal(null)}
          onConnected={handleConnected}
        />
      )}

      <PageHeader
        title="Connect a Data Source"
        subtitle="Link your accounting, ERP, payroll, or banking systems. Ventura syncs and normalizes automatically"
        className="mb-8"
      />

      {/* ── Source cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 pb-12">
        {SOURCE_CARDS.map((src) => {
          const isConnected = connectedIds.includes(src.id)
          return (
            <button
              key={src.id}
              onClick={() => setActiveModal(src.id)}
              className="group text-left bg-surface-raised border border-border rounded-xl p-5 hover:border-accent-400 hover:shadow-md transition-all flex flex-col gap-3"
            >
              {/* Top row */}
              <div className="flex items-start justify-between">
                <BrandIcon brand={src.brand} size={40} />
                {isConnected && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-positive-fg bg-positive-bg border border-positive-line rounded-full px-2 py-0.5">
                    <CheckCircle className="w-2.5 h-2.5" />
                    Connected
                  </span>
                )}
              </div>

              {/* Name + type */}
              <div>
                <p className="text-sm font-medium text-text-primary group-hover:text-accent-800 transition-colors leading-snug">
                  {src.name}
                </p>
                <p className="text-[11px] text-text-muted mt-0.5">{src.type}</p>
              </div>

              {/* Description */}
              <p className="text-xs text-text-muted leading-relaxed">{src.description}</p>

              {/* CTA */}
              <div className="mt-auto">
                <span className={`inline-flex items-center gap-1 text-xs font-medium ${isConnected ? 'text-positive-fg' : 'text-accent-700 group-hover:text-accent-800'}`}>
                  {isConnected ? 'Reconfigure' : 'Connect'} <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </AppLayout>
  )
}
