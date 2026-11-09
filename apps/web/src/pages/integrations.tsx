import { useState, useEffect, useCallback } from 'react'
import AppLayout from '../components/layout/AppLayout'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import BrandIcon, { type BrandKey } from '../components/ui/BrandIcon'
import ConnectModal from '../components/ui/ConnectModal'
import { ingest } from '../lib/ingest'
import type { StoredTransaction } from '../lib/dataStore'
import { ReloadIcon, UploadIcon, ExclamationTriangleIcon, CheckIcon } from '@radix-ui/react-icons'

// Connected systems. Each one is connected by signing in to it directly and
// approving read-only access; Ventura never sees a password or asks for a
// developer key. Data arrives through the same checks as an uploaded file.

interface ConnectionView { id: string; accountName: string | null; status: string; lastSyncedAt: string | null; lastError: string | null; connectedBy: string | null }
interface ProviderView { id: 'plaid' | 'quickbooks' | 'xero' | 'gusto'; name: string; kind: 'oauth' | 'plaid'; available: boolean; missing: string[]; connections: ConnectionView[] }
interface Status { admin: boolean; storage: 'database' | 'browser'; providers: ProviderView[] }

const ABOUT: Record<ProviderView['id'], { brand: BrandKey; reads: string }> = {
  quickbooks: { brand: 'quickbooks', reads: 'Bills, expenses, cheques, card charges and supplier credits. Read-only.' },
  xero:       { brand: 'xero',       reads: 'Bills, spend money transactions and supplier credit notes. Read-only.' },
  plaid:      { brand: 'plaid',      reads: 'Posted transactions from business bank and card accounts, through Plaid. Read-only.' },
  gusto:      { brand: 'gusto',      reads: 'Processed payroll runs, as the total debited from the company. Read-only.' },
}

const ERRORS: Record<string, string> = {
  access_denied: 'Access was not approved, so nothing was connected.',
  invalid_state: 'The connection attempt expired or was opened in another tab. Try again.',
  token_exchange_failed: 'The system did not accept the connection. Try again, or check the app settings with your admin.',
  not_admin: 'Only the workspace admin can connect systems.',
  invalid_callback: 'The connection could not be completed. Try again.',
}

declare global {
  interface Window { Plaid?: { create: (o: Record<string, unknown>) => { open: () => void } } }
}

function loadPlaid(): Promise<void> {
  if (window.Plaid) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js'
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Plaid Link could not load.'))
    document.head.appendChild(s)
  })
}

const ago = (iso: string | null) => {
  if (!iso) return 'Not synced yet'
  const m = Math.round((Date.now() - Date.parse(iso)) / 60_000)
  return m < 1 ? 'Synced just now' : m < 60 ? `Synced ${m} min ago` : m < 1440 ? `Synced ${Math.round(m / 60)} h ago` : `Synced ${new Date(iso).toLocaleDateString()}`
}

export default function IntegrationsPage() {
  const [status,  setStatus]  = useState<Status | null>(null)
  const [busy,    setBusy]    = useState<string | null>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [upload,  setUpload]  = useState(false)

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/integrations/status')
      if (r.ok) setStatus(await r.json())
    } catch { /* offline */ }
  }, [])

  const sync = useCallback(async (p: ProviderView, c: ConnectionView) => {
    setBusy(c.id); setMessage(null)
    const all: StoredTransaction[] = []
    let cursor: string | null = null
    try {
      do {
        const r: Response = await fetch('/api/integrations/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ connectionId: c.id, cursor, months: 12 }) })
        const j = await r.json()
        if (!r.ok) throw new Error(j.error ?? 'Sync failed')
        all.push(...(j.transactions as StoredTransaction[]))
        cursor = j.cursor
        setMessage({ tone: 'ok', text: `Fetched ${all.length.toLocaleString()} transactions from ${c.accountName ?? p.name}…` })
      } while (cursor)
      const res = ingest({ sourceId: `${p.id}:${c.id.replace(/^meta:/, '')}`, label: c.accountName ?? p.name, transactions: all, actor: 'You' })
      setMessage({ tone: 'ok', text: `${c.accountName ?? p.name}: ${res.txCount.toLocaleString()} transactions checked, ${res.anomalyCount} finding${res.anomalyCount === 1 ? '' : 's'}${res.carried ? `, ${res.carried} earlier decisions kept` : ''}.` })
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Sync failed' })
    } finally {
      setBusy(null)
      void refresh()
    }
  }, [refresh])

  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const connected = q.get('connected'), error = q.get('error')
    if (connected || error) window.history.replaceState({}, '', '/integrations')
    if (error) setMessage({ tone: 'error', text: ERRORS[error] ?? `The connection did not complete (${error}).` })
    void (async () => {
      const r = await fetch('/api/integrations/status').catch(() => null)
      const s: Status | null = r?.ok ? await r.json() : null
      setStatus(s)
      // Fresh from connecting: fetch its data straight away.
      const p = s?.providers.find(x => x.id === connected)
      const c = p?.connections[p.connections.length - 1]
      if (p && c) void sync(p, c)
    })()
  }, [sync])

  async function connect(p: ProviderView) {
    setBusy(p.id); setMessage(null)
    try {
      if (p.kind === 'plaid') {
        const r = await fetch('/api/integrations/plaid/link-token', { method: 'POST' })
        const j = await r.json()
        if (!r.ok) throw new Error(j.error ?? 'Plaid is not available')
        await loadPlaid()
        window.Plaid!.create({
          token: j.link_token,
          onSuccess: async (publicToken: string, meta: { institution?: { name?: string } }) => {
            const x = await fetch('/api/integrations/plaid/exchange', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ public_token: publicToken, institution: meta?.institution?.name }) })
            const xj = await x.json()
            if (!x.ok) { setMessage({ tone: 'error', text: xj.error ?? 'Could not connect the account' }); setBusy(null); return }
            const r2 = await fetch('/api/integrations/status')
            const s: Status = await r2.json()
            setStatus(s)
            const pp = s.providers.find(v => v.id === 'plaid')!
            await sync(pp, pp.connections[pp.connections.length - 1])
          },
          onExit: () => setBusy(null),
        }).open()
        return
      }
      const r = await fetch('/api/oauth/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: p.id }) })
      const j = await r.json()
      if (!r.ok || !j.url) throw new Error(j.error ?? 'This connection is not set up yet')
      window.location.href = j.url
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Could not connect' })
      setBusy(null)
    }
  }

  async function disconnect(p: ProviderView, c: ConnectionView) {
    if (!window.confirm(`Disconnect ${c.accountName ?? p.name}? Ventura stops reading from it and deletes its access. Findings and decisions already recorded stay.`)) return
    setBusy(c.id)
    await fetch('/api/integrations/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ connectionId: c.id }) }).catch(() => null)
    setBusy(null)
    void refresh()
  }

  return (
    <AppLayout title="Integrations">
      {upload && <ConnectModal integrationId="csv" onClose={() => setUpload(false)} onConnected={() => undefined} />}

      <PageHeader
        title="Integrations"
        subtitle="Connect the systems Ventura reads spend from. You sign in to each one directly and approve read-only access; Ventura never sees your passwords."
        actions={<Button variant="secondary" size="sm" icon={<UploadIcon className="w-3.5 h-3.5" />} onClick={() => setUpload(true)}>Upload a file</Button>}
        className="mb-6"
      />

      {message && (
        <div role="status" className={`mb-5 flex items-start gap-2 rounded-lg border px-4 py-3 text-[13.5px] ${message.tone === 'error' ? 'border-critical-line bg-critical-bg text-critical-fg' : 'border-border bg-surface-raised text-text-secondary'}`}>
          {message.tone === 'error' ? <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0" /> : <CheckIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-positive-fg" />}
          {message.text}
        </div>
      )}

      {status?.storage === 'browser' && (
        <p className="mb-5 rounded-lg border border-dashed border-border-strong px-4 py-3 text-[13px] text-text-muted">
          Synced data and review decisions are kept in this browser until the workspace database is set up. Connections themselves are stored securely on the server.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {(status?.providers ?? []).map(p => {
          const about = ABOUT[p.id]
          return (
            <section key={p.id} className="flex flex-col rounded-xl border border-border bg-surface-raised p-5 shadow-card">
              <div className="flex items-center gap-3">
                <BrandIcon brand={about.brand} size={40} />
                <div className="min-w-0">
                  <h2 className="text-[15px] font-medium text-text-primary">{p.name}</h2>
                  <p className="text-[13px] text-text-muted">{about.reads}</p>
                </div>
              </div>

              <div className="mt-4 flex-1 space-y-2">
                {p.connections.map(c => (
                  <div key={c.id} className="rounded-lg border border-border-subtle bg-surface px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-medium text-text-primary">{c.accountName ?? 'Connected account'}</p>
                        <p className={`text-[12.5px] ${c.lastError ? 'text-critical-fg' : 'text-text-muted'}`}>{c.lastError ?? ago(c.lastSyncedAt)}</p>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-1.5">
                        <Button variant="secondary" size="sm" loading={busy === c.id} icon={<ReloadIcon className="h-3 w-3" />} onClick={() => sync(p, c)}>Sync now</Button>
                        {status?.admin && <Button variant="ghost" size="sm" onClick={() => disconnect(p, c)} disabled={busy === c.id}>Disconnect</Button>}
                      </div>
                    </div>
                  </div>
                ))}
                {!p.available && (
                  <p className="text-[13px] text-text-muted">
                    Not set up yet.{status?.admin && p.missing.length > 0 && <> Needs <span className="font-mono text-[12px]">{p.missing.join(', ')}</span> on the server.</>}
                  </p>
                )}
              </div>

              {p.available && (status?.admin
                ? <div className="mt-4 border-t border-border-subtle pt-4">
                    <Button variant={p.connections.length ? 'secondary' : 'primary'} size="sm" loading={busy === p.id} onClick={() => connect(p)}>
                      {p.connections.length ? (p.kind === 'plaid' ? 'Connect another bank' : 'Connect another company') : `Connect ${p.name.replace(/ \(.*\)$/, '')}`}
                    </Button>
                  </div>
                : !p.connections.length && <p className="mt-4 border-t border-border-subtle pt-4 text-[13px] text-text-muted">Ask your workspace admin to connect this.</p>)}
            </section>
          )
        })}
      </div>

      <section className="mt-6 rounded-xl border border-border bg-surface-raised p-5">
        <h2 className="text-[15px] font-medium text-text-primary">Everything else, by export</h2>
        <p className="mt-1 max-w-[70ch] text-[13.5px] leading-relaxed text-text-secondary">
          NetSuite, SAP, Sage, Expensify, Ramp, Brex, ADP and any other system: export a CSV or Excel file of payments, bills or card
          transactions and upload it. Ventura finds the header row and maps the columns itself, and runs the same checks.
        </p>
        <div className="mt-4"><Button variant="secondary" size="sm" icon={<UploadIcon className="w-3.5 h-3.5" />} onClick={() => setUpload(true)}>Upload a file</Button></div>
      </section>
    </AppLayout>
  )
}
