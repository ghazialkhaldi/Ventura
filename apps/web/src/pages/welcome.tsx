import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import AppLayout from '../components/layout/AppLayout'
import BrandIcon, { type BrandKey } from '../components/ui/BrandIcon'
import ConnectModal from '../components/ui/ConnectModal'
import { loadAllSourceDatasets } from '../lib/dataStore'
import { useRouter } from 'next/router'
import { useCurrentUser } from '../hooks/useCurrentUser'
import {
  CheckCircle, ArrowRight, Upload,
  GitMerge, BarChart2, Bell, ChevronRight, X,
} from 'lucide-react'

const SETUP_STEPS = [
  { id: 1, label: 'Account created',            done: true  },
  { id: 2, label: 'Connect a data source',       done: false, current: true  },
  { id: 3, label: 'Import or sync transactions', done: false },
  { id: 4, label: 'Map your fields',             done: false },
  { id: 5, label: 'Review first analysis',       done: false },
  { id: 6, label: 'Configure alert policies',    done: false },
]

interface Source {
  id: string
  brand: BrandKey
  name: string
  category: string
  desc: string
  popular: boolean
}

const SOURCES: Source[] = [
  { id: 'quickbooks', brand: 'quickbooks', name: 'QuickBooks Online', category: 'Accounting',    desc: 'Bills, expenses, card charges and supplier credits', popular: true  },
  { id: 'xero',       brand: 'xero',       name: 'Xero',              category: 'Accounting',    desc: 'Bills, spend transactions and credit notes',         popular: true  },
  { id: 'plaid',      brand: 'plaid',      name: 'Bank and card',     category: 'Banking',       desc: 'Posted transactions through Plaid',                  popular: true  },
  { id: 'gusto',      brand: 'gusto',      name: 'Gusto',             category: 'Payroll',       desc: 'Processed payroll runs',                             popular: false },
  { id: 'csv',        brand: 'csv',        name: 'CSV / Spreadsheet', category: 'Any system',    desc: 'Upload an export from NetSuite, SAP, Expensify or anything else', popular: false },
]

const GHOST_METRICS = [
  { label: 'YTD Spend',          wVal: 'w-20', wSub: 'w-24' },
  { label: 'Open Anomalies',     wVal: 'w-8',  wSub: 'w-16' },
  { label: 'Savings Identified', wVal: 'w-16', wSub: 'w-20' },
  { label: 'Pending Approvals',  wVal: 'w-6',  wSub: 'w-14' },
]

export default function WelcomePage() {
  const user = useCurrentUser()
  const companyDisplay = user?.company || 'Your Organization'

  const router = useRouter()
  const [activeModal, setActiveModal] = useState<string | null>(null)
  const [connected,   setConnected]   = useState<string[]>([])

  // A source counts as connected once data from it has been checked here.
  useEffect(() => {
    setConnected([...new Set(Object.keys(loadAllSourceDatasets()).map(k => (k.startsWith('upload') || k === 'csv' ? 'csv' : k.split(':')[0])))])
  }, [])

  function handleConnected(id: string) {
    setConnected(prev => prev.includes(id) ? prev : [...prev, id])
  }

  // Systems connect from Integrations, by signing in to them; files upload here.
  function open(id: string) {
    if (id === 'csv') setActiveModal('csv')
    else router.push('/integrations')
  }

  return (
    <AppLayout title="Getting Started">

      {activeModal && (
        <ConnectModal
          integrationId={activeModal}
          onClose={() => setActiveModal(null)}
          onConnected={(id) => { handleConnected(id); setActiveModal(null) }}
        />
      )}

      {/* ── Page header ── */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-[12px] font-medium text-text-muted mb-2">Setup &amp; Onboarding</p>
            <h1 className="text-2xl font-medium tracking-[-0.02em] text-text-primary mb-1.5">
              Welcome to Ventura{companyDisplay !== 'Your Organization' ? `, ${companyDisplay}` : ''}
            </h1>
            <p className="text-sm text-text-muted max-w-xl leading-relaxed">
              Start with an export from your accounting or banking system. Ventura reads it, maps the
              columns, and lists the findings for your team to review.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary border border-border rounded-md px-3 py-2 bg-surface-raised transition-colors"
          >
            Skip to dashboard
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Progress tracker */}
        <div className="mt-7">
          <div className="flex items-start gap-0 relative">
            {SETUP_STEPS.map((step, i) => (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center flex-1 relative z-10">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 text-xs font-medium transition-colors ${
                    step.done
                      ? 'bg-positive border-green-500 text-white'
                      : step.current
                      ? 'bg-surface-raised border-emerald-600 text-positive-fg'
                      : 'bg-surface-raised border-border-strong text-text-muted'
                  }`}>
                    {step.done ? <CheckCircle className="w-4 h-4" /> : <span>{step.id}</span>}
                  </div>
                  <p className={`text-[10px] mt-1.5 text-center max-w-[72px] leading-tight font-medium ${
                    step.done ? 'text-positive-fg' : step.current ? 'text-positive-fg' : 'text-text-muted'
                  }`}>
                    {step.label}
                  </p>
                </div>
                {i < SETUP_STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mt-3.5 mx-1 ${step.done ? 'bg-positive-bg' : 'bg-border'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid lg:grid-cols-[1fr_320px] gap-6">

        {/* Left: connect sources */}
        <div>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-medium">2</span>
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">Connect a data source</p>
              <p className="text-xs text-text-muted">Select your primary financial system to begin ingestion</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-5">
            {SOURCES.map(src => {
              const isConnected = connected.includes(src.id)
              return (
                <div
                  key={src.id}
                  className={`bg-surface-raised border rounded-lg p-4 flex flex-col gap-3 transition-all ${
                    isConnected ? 'border-green-200 ring-1 ring-green-200' : 'border-border hover:border-border-strong hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <BrandIcon brand={src.brand} size={36} />
                      <div>
                        <p className="text-xs font-medium text-text-secondary leading-snug">{src.name}</p>
                        <p className="text-[10px] text-text-muted mt-0.5">{src.category}</p>
                      </div>
                    </div>
                    {isConnected && (
                      <CheckCircle className="w-4 h-4 text-positive-fg flex-shrink-0 mt-0.5" />
                    )}
                  </div>
                  <p className="text-[11px] text-text-muted leading-snug">{src.desc}</p>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => !isConnected && open(src.id)}
                      disabled={isConnected}
                      className={`flex-1 text-xs font-medium py-2 rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                        isConnected
                          ? 'bg-green-50 text-green-700 border border-green-200 cursor-default'
                          : 'bg-accent-600 hover:bg-accent-700 text-white shadow-card'
                      }`}
                    >
                      {isConnected ? (
                        <><CheckCircle className="w-3.5 h-3.5" /> Connected</>
                      ) : (
                        <>{src.id === 'csv' ? 'Upload a file' : `Connect ${src.name.split(' ')[0]}`}</>
                      )}
                    </button>

                  </div>
                </div>
              )
            })}
          </div>

          {/* Success state */}
          {connected.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-5">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-positive-fg flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-800">
                    {connected.length === 1
                      ? `${SOURCES.find(s => s.id === connected[0])?.name} connected successfully`
                      : `${connected.length} sources connected`}
                  </p>
                  <p className="text-xs text-green-700 mt-0.5 leading-relaxed">
                    Initial data sync is in progress. Ventura will analyze your data and surface findings once
                    the first batch completes. You will receive an alert when results are ready.
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <Link href="/onboarding" className="inline-flex items-center gap-1.5 text-xs font-medium text-green-800 hover:text-green-900">
                      Continue to field mapping <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                    <span className="text-positive-fg">·</span>
                    <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 hover:text-green-900">
                      View dashboard <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Remaining steps */}
          <div className="bg-surface-raised border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-surface-raised border-b border-border">
              <p className="text-xs font-medium text-text-secondary">Remaining setup steps</p>
            </div>
            {[
              { icon: Upload,    step: 3, title: 'Import or sync transactions',   desc: 'Bulk CSV import or live feed from connected sources' },
              { icon: GitMerge,  step: 4, title: 'Map your fields',               desc: 'Match source columns to the Ventura data model' },
              { icon: BarChart2, step: 5, title: 'Review first analysis',         desc: 'Anomalies, savings, and workflow findings' },
              { icon: Bell,      step: 6, title: 'Configure alert policies',      desc: 'Notification rules, thresholds, and governance settings' },
            ].map((item, i, arr) => {
              const Icon = item.icon
              return (
                <div key={item.step} className={`flex items-start gap-3 px-4 py-3 ${i < arr.length - 1 ? 'border-b border-border-subtle' : ''}`}>
                  <div className="w-6 h-6 rounded-full bg-surface-overlay border border-border flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-text-muted">{item.step}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-text-secondary">{item.title}</p>
                    <p className="text-[11px] text-text-muted mt-0.5">{item.desc}</p>
                  </div>
                  <Icon className="w-4 h-4 text-text-muted flex-shrink-0 mt-0.5" />
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: preview of what's coming */}
        <div className="flex flex-col gap-4">
          <div className="bg-surface-raised border border-border rounded-lg p-4">
            <p className="text-xs font-medium text-text-secondary mb-1.5">What you&apos;ll see after connecting</p>
            <p className="text-[11px] text-text-muted leading-relaxed">
              Once your data syncs, your dashboard will show live spend metrics, anomaly findings,
              workflow status, and savings opportunities, refreshed on every sync cycle.
            </p>
          </div>

          {/* Ghost metric cards */}
          <div className="grid grid-cols-2 gap-2">
            {GHOST_METRICS.map(m => (
              <div key={m.label} className="bg-surface-raised border border-border rounded-lg p-3">
                <p className="text-[10px] text-text-muted mb-2 font-medium">{m.label}</p>
                <div className={`h-5 ${m.wVal} bg-surface-overlay rounded animate-pulse mb-1.5`} />
                <div className={`h-2.5 ${m.wSub} bg-surface-overlay rounded animate-pulse`} />
              </div>
            ))}
          </div>

          {/* Ghost anomaly list */}
          <div className="bg-surface-raised border border-border rounded-lg overflow-hidden">
            <div className="px-3 py-2.5 bg-surface-raised border-b border-border flex items-center gap-2 justify-between">
              <p className="text-[11px] font-semibold text-text-muted">Anomaly findings</p>
              <span className="text-[10px] text-text-muted italic">pending first sync</span>
            </div>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 border-b border-border-subtle last:border-0">
                <div className="w-14 h-3 bg-surface-overlay rounded animate-pulse flex-shrink-0" />
                <div className="flex-1 h-3 bg-surface-overlay rounded animate-pulse" />
                <div className="w-12 h-3 bg-surface-overlay rounded animate-pulse flex-shrink-0" />
              </div>
            ))}
          </div>

          {/* Ghost savings */}
          <div className="bg-surface-raised border border-border rounded-lg p-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold text-text-muted">Savings opportunities</p>
              <span className="text-[10px] text-text-muted italic">pending first sync</span>
            </div>
            {[1, 2].map(i => (
              <div key={i} className="flex items-center gap-2.5 py-2 border-b border-border-subtle last:border-0">
                <div className="flex-1">
                  <div className="h-2.5 bg-surface-overlay rounded animate-pulse mb-1.5" />
                  <div className="h-2 w-20 bg-surface-overlay rounded animate-pulse" />
                </div>
                <div className="w-14 h-4 bg-surface-overlay rounded animate-pulse flex-shrink-0" />
              </div>
            ))}
          </div>

          {/* Navigate to existing workspace */}
          <div className="bg-ink rounded-lg p-4">
            <p className="text-xs font-medium text-white mb-1.5">Returning user?</p>
            <p className="text-[11px] text-text-muted mb-3 leading-relaxed">
              If your data is already connected, navigate directly to your workspace to view
              current findings and workflows.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 bg-surface-raised text-text-primary text-xs font-medium px-4 py-2 rounded-md hover:bg-surface-hover transition-colors"
            >
              Open workspace <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
