import React, { useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Card, CardHeader, CardDivider } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import {
  CheckCircle, Circle, Upload, Database, ArrowRight, FileText,
  RefreshCw, AlertCircle, Eye, Download, Settings, ChevronRight,
  Clock,
} from 'lucide-react'

type Tab = 'checklist' | 'csv' | 'mapping' | 'sync' | 'history'

const checklist = [
  { id: 'c1',  title: 'Connect accounting system',    done: false, detail: 'Link QuickBooks, NetSuite, Xero, or another GL system' },
  { id: 'c2',  title: 'Connect bank feeds',           done: false, detail: 'Connect bank accounts via Plaid or CSV import' },
  { id: 'c3',  title: 'Connect payroll provider',     done: false, detail: 'Link ADP, Gusto, or upload payroll exports' },
  { id: 'c4',  title: 'Configure SSO',                done: false, detail: 'Set up Okta, Azure AD, or Google Workspace SAML' },
  { id: 'c5',  title: 'Upload chart of accounts',     done: false, detail: 'Import your GL account structure for categorisation' },
  { id: 'c6',  title: 'Set spending categories',      done: false, detail: 'Map GL codes to spending categories' },
  { id: 'c7',  title: 'Import vendor master',         done: false, detail: 'Upload vendor list CSV for vendor matching' },
  { id: 'c8',  title: 'Configure approval workflows', done: false, detail: 'Set up approval workflows with SLA targets' },
  { id: 'c9',  title: 'Configure AI governance rules',done: false, detail: 'Set confidence thresholds and human-approval triggers' },
  { id: 'c10', title: 'Invite finance team members',  done: false, detail: 'Add team members and assign roles' },
]

const importHistory: { id: string; source: string; date: string; records: number; status: string; errors: number }[] = []

const fieldMappings = [
  { source: 'invoice_date',  target: 'transaction_date', status: 'mapped',   sample: '(from your data)' },
  { source: 'amount_usd',    target: 'amount',           status: 'mapped',   sample: '(from your data)' },
  { source: 'vendor_name',   target: 'vendor',           status: 'mapped',   sample: '(from your data)' },
  { source: 'gl_code',       target: 'gl_account',       status: 'mapped',   sample: '(from your data)' },
  { source: 'department_id', target: 'department',       status: 'review',   sample: '(from your data)' },
  { source: 'po_reference',  target: 'purchase_order',   status: 'unmapped', sample: '(from your data)' },
]

const doneCount = checklist.filter(c => c.done).length
const pctDone   = Math.round((doneCount / checklist.length) * 100)

export default function OnboardingPage() {
  const [activeTab, setActiveTab] = useState<Tab>('checklist')
  const [dragOver,  setDragOver]  = useState(false)

  const tabs: { id: Tab; label: string; icon: React.ReactElement }[] = [
    { id: 'checklist', label: 'Checklist',       icon: <CheckCircle className="w-3.5 h-3.5" /> },
    { id: 'csv',       label: 'CSV Upload',       icon: <Upload className="w-3.5 h-3.5" /> },
    { id: 'mapping',   label: 'Field Mapping',    icon: <Settings className="w-3.5 h-3.5" /> },
    { id: 'sync',      label: 'Sync Status',      icon: <RefreshCw className="w-3.5 h-3.5" /> },
    { id: 'history',   label: 'Import History',   icon: <Clock className="w-3.5 h-3.5" /> },
  ]

  return (
    <AppLayout title="Data Onboarding">
      <PageHeader
        title="Data Onboarding"
        subtitle="Connect sources, import data, and validate field mappings"
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">{doneCount}/{checklist.length} complete</span>
            <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pctDone}%` }} />
            </div>
          </div>
        }
        className="mb-6"
      />

      {/* Progress banner */}
      {pctDone < 100 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Setup {pctDone}% complete — {checklist.length - doneCount} steps remaining</p>
            <p className="text-xs text-amber-700 mt-0.5">Complete all steps to activate full anomaly detection and AI governance features.</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-0.5 mb-6 border-b border-slate-200">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Checklist ── */}
      {activeTab === 'checklist' && (
        <div className="space-y-3">
          {checklist.map((item, i) => (
            <div
              key={item.id}
              className={`flex items-start gap-4 p-4 rounded-lg border transition-colors ${
                item.done ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'
              }`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${item.done ? 'bg-green-500' : 'bg-white border-2 border-slate-300'}`}>
                {item.done && <CheckCircle className="w-4 h-4 text-white" />}
                {!item.done && <span className="text-xs font-bold text-slate-400">{i + 1}</span>}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-semibold ${item.done ? 'text-green-800' : 'text-slate-800'}`}>{item.title}</p>
                <p className={`text-xs mt-0.5 ${item.done ? 'text-green-700' : 'text-slate-500'}`}>{item.detail}</p>
              </div>
              {!item.done && (
                <Button variant="primary" size="sm" iconRight={<ArrowRight className="w-3.5 h-3.5" />}>
                  Set up
                </Button>
              )}
              {item.done && <Badge variant="green">Done</Badge>}
            </div>
          ))}
        </div>
      )}

      {/* ── CSV Upload ── */}
      {activeTab === 'csv' && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader title="Upload CSV File" subtitle="Transactions, vendors, or GL export" icon={<Upload className="w-4 h-4" />} />
            <CardDivider />
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false) }}
              className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center transition-colors cursor-pointer ${
                dragOver ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 hover:border-emerald-400 hover:bg-slate-50'
              }`}
            >
              <Upload className="w-8 h-8 text-slate-400 mb-3" />
              <p className="text-sm font-semibold text-slate-700 mb-1">Drag & drop your CSV here</p>
              <p className="text-xs text-slate-500 mb-4">Supports: GL exports, bank statements, vendor lists, AP ledger</p>
              <Button variant="secondary" size="sm">Browse files</Button>
            </div>
            <div className="mt-4">
              <p className="text-xs text-slate-500 font-semibold mb-2">Accepted formats</p>
              <div className="flex flex-wrap gap-2">
                {['QuickBooks export', 'NetSuite GL', 'Bank CSV', 'Custom (with mapping)'].map(f => (
                  <span key={f} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200">{f}</span>
                ))}
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" size="sm" icon={<Download className="w-3.5 h-3.5" />}>
                Download template
              </Button>
              <Button variant="ghost" size="sm" icon={<Eye className="w-3.5 h-3.5" />}>
                View requirements
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader title="Secure File Upload" subtitle="Invoices, receipts, and contracts" icon={<FileText className="w-4 h-4" />} />
            <CardDivider />
            <div className="border-2 border-dashed border-slate-300 hover:border-emerald-400 hover:bg-slate-50 rounded-xl p-10 flex flex-col items-center justify-center text-center transition-colors cursor-pointer">
              <FileText className="w-8 h-8 text-slate-400 mb-3" />
              <p className="text-sm font-semibold text-slate-700 mb-1">Upload documents</p>
              <p className="text-xs text-slate-500 mb-4">PDF invoices, receipts, and contracts are OCR-extracted and matched to transactions.</p>
              <Button variant="secondary" size="sm">Browse files</Button>
            </div>
            <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-xs text-slate-500">Documents are AES-256 encrypted at rest. OCR runs automatically after upload.</p>
            </div>
          </Card>
        </div>
      )}

      {/* ── Field mapping ── */}
      {activeTab === 'mapping' && (
        <Card>
          <CardHeader title="Field Mapping" subtitle="Source CSV fields → Ventura schema" icon={<Settings className="w-4 h-4" />} />
          <CardDivider />
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Source field', 'Target field', 'Sample value', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fieldMappings.map((row) => (
                <tr key={row.source} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs font-mono text-slate-700">{row.source}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">{row.target}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 font-mono">{row.sample}</td>
                  <td className="px-4 py-3">
                    {row.status === 'mapped'   && <Badge variant="green">Mapped</Badge>}
                    {row.status === 'review'   && <Badge variant="amber">Review</Badge>}
                    {row.status === 'unmapped' && <Badge variant="red">Unmapped</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="sm">Edit</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* ── Sync Status ── */}
      {activeTab === 'sync' && (
        <div className="bg-white border border-slate-200 rounded-lg p-10 flex flex-col items-center justify-center text-center">
          <RefreshCw className="w-8 h-8 text-slate-300 mb-3" />
          <p className="text-sm font-semibold text-slate-600 mb-1">No connected sources</p>
          <p className="text-xs text-slate-400">Connect an accounting system, bank feed, or payroll provider to see sync status here.</p>
        </div>
      )}

      {/* ── Import history ── */}
      {activeTab === 'history' && (
        <div className="bg-white border border-slate-200 rounded-lg shadow-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['ID', 'Source', 'Date / Time', 'Records', 'Errors', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {importHistory.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs font-mono text-slate-500">{row.id}</td>
                  <td className="px-4 py-3 text-sm text-slate-800">{row.source}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{row.date}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-800">{row.records.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold ${row.errors > 0 ? 'text-red-600' : 'text-slate-500'}`}>{row.errors}</span>
                  </td>
                  <td className="px-4 py-3">
                    {row.status === 'Success' ? <Badge variant="green">Success</Badge> : <Badge variant="red">Failed</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  )
}
