// The browser's copy of a workspace against the server's. What matters here is
// that an answer from the server can never cost the user data they still have.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

const store = new Map<string, string>()
const g = globalThis as unknown as Record<string, unknown>
g.window = {}
g.sessionStorage = { getItem: (k: string) => store.get(`s:${k}`) ?? null, setItem: (k: string, v: string) => { store.set(`s:${k}`, v) }, removeItem: (k: string) => { store.delete(`s:${k}`) } }
g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) }, removeItem: (k: string) => { store.delete(k) } }

import { hydrateFromServer } from '../../src/lib/workspaceSync'
import { ingest } from '../../src/lib/ingest'
import { clearUser } from '../../src/hooks/useCurrentUser'
import { closeReasonFor, setFindingStatus, loadDataset, loadAllSourceDatasets, saveSourceDataset, type Dataset, type StoredTransaction } from '../../src/lib/dataStore'

const row = (i: number, vendor = 'Acme Supplies', amount = 4200): StoredTransaction => ({
  id: `r${i}`, date: `2026-03-${String((i % 27) + 1).padStart(2, '0')}`, vendor, amount, description: 'Consulting', category: 'Services', account: '6100', rowIndex: i,
})
// Two payments of the same amount on the same day with the same invoice text: a finding every time.
const withDuplicate = (): StoredTransaction[] => [
  ...Array.from({ length: 30 }, (_, i) => row(i, `Vendor ${i % 6}`, 900 + i * 37)),
  { ...row(100, 'Harbor Freight Co', 18250), date: '2026-03-10', description: 'INV-7781' },
  { ...row(101, 'Harbor Freight Co', 18250), date: '2026-03-10', description: 'INV-7781' },
]

type Posted = { step: string; [k: string]: unknown }
interface FakeServer { sources: Record<string, unknown>[]; findings: Record<string, unknown>[]; evidence: unknown[]; failSteps: Set<string>; posted: Posted[]; stored: boolean; workspace: string }
let server: FakeServer

function respond(body: unknown, ok = true) { return { ok, json: async () => body } }

beforeEach(() => {
  store.clear()
  server = { sources: [], findings: [], evidence: [], failSteps: new Set(), posted: [], stored: true, workspace: 'company-a' }
  g.fetch = async (url: string, init?: { body?: string }) => {
    if (url === '/api/workspace/state') return respond(server.stored ? { stored: true, workspace: server.workspace, sources: server.sources, findings: server.findings, evidence: server.evidence } : { stored: false, workspace: server.workspace })
    const b = JSON.parse(init?.body ?? '{}') as Posted
    server.posted.push(b)
    if (server.failSteps.has(b.step)) return respond({ error: 'failed' }, false)
    if (b.step === 'register') {
      const key = b.sourceKey as string
      server.sources = server.sources.filter(s => s.source_key !== key)
      server.sources.push({ id: `ds-${key}`, source_key: key, name: b.name, summary: b.summary, column_mapping: null, created_at: new Date().toISOString() })
      return respond({ stored: true, datasetId: `ds-${key}` })
    }
    if (b.step === 'findings') {
      for (const f of b.findings as Record<string, unknown>[]) server.findings.push({ ...f, dataset_id: b.datasetId, row_refs: f.rowRefs, detected_at: f.detectedAt })
      return respond({ stored: true })
    }
    if (b.step === 'finish') {
      const s = server.sources.find(x => x.id === b.datasetId)!
      s.summary = { ...(s.summary as object), complete: true }
      return respond({ stored: true })
    }
    return respond({ stored: true })
  }
})

const settle = () => new Promise(r => setTimeout(r, 20))

test('a failed save to the server does not erase the data in this browser', async () => {
  server.failSteps.add('register')
  const r = ingest({ sourceId: 'upload:ledger.csv', label: 'ledger.csv', transactions: withDuplicate() })
  assert.ok(r.anomalyCount > 0)
  await settle()
  await hydrateFromServer()
  assert.equal(loadDataset()?.anomalies.length, r.anomalyCount)
  assert.equal(Object.keys(loadAllSourceDatasets()).length, 1)
})

test('a file still uploading is not replaced by its half-saved copy', async () => {
  server.failSteps.add('findings')
  const r = ingest({ sourceId: 'upload:ledger.csv', label: 'ledger.csv', transactions: withDuplicate() })
  await settle()
  assert.equal(server.sources.length, 1, 'the register reached the server')
  await hydrateFromServer()
  assert.equal(loadDataset()?.anomalies.length, r.anomalyCount)
})

test('two uploaded files never share a finding id', () => {
  ingest({ sourceId: 'upload:january.csv', label: 'january.csv', transactions: withDuplicate() })
  ingest({ sourceId: 'upload:february.csv', label: 'february.csv', transactions: withDuplicate() })
  const ids = loadDataset()!.anomalies.map(a => a.id)
  assert.ok(ids.length >= 2)
  assert.equal(new Set(ids).size, ids.length)
})

test('an empty server never clears a browser that has data', async () => {
  saveSourceDataset('upload:a.csv', { anomalies: [], files: [], topVendors: [], categoryBreakdown: [], monthlyBreakdown: [], auditLog: [], sampleTransactions: [], totalTransactions: 3, totalSpend: 9, uniqueVendors: 1, dateRange: { from: '', to: '' }, uploadedAt: '', columnMapping: {} } as unknown as Dataset)
  server.failSteps.add('register')
  await hydrateFromServer()
  assert.equal(loadDataset()?.totalTransactions, 3)
})

test('with no database yet, the browser keeps its own copy', async () => {
  server.stored = false
  const r = ingest({ sourceId: 'upload:ledger.csv', label: 'ledger.csv', transactions: withDuplicate() })
  await settle()
  assert.equal(await hydrateFromServer(), 'browser')
  assert.equal(loadDataset()?.anomalies.length, r.anomalyCount)
})

test('a finished upload loads from the server, with its decisions', async () => {
  const r = ingest({ sourceId: 'upload:ledger.csv', label: 'ledger.csv', transactions: withDuplicate() })
  await settle()
  assert.ok(server.posted.some(p => p.step === 'finish'), 'the upload was marked finished')
  server.findings[0].status = 'Resolved'
  assert.equal(await hydrateFromServer(), 'server')
  const ds = loadDataset()!
  assert.equal(ds.anomalies.length, r.anomalyCount)
  assert.equal(ds.anomalies.filter(a => a.status === 'Resolved').length, 1)
})

test('a file uploaded before uploads were marked finished is kept, and sent again', async () => {
  const r = ingest({ sourceId: 'upload:old.csv', label: 'old.csv', transactions: withDuplicate() })
  await settle()
  const src = server.sources[0]
  delete (src.summary as Record<string, unknown>).complete
  server.findings.length = 0
  server.failSteps.add('register')
  await hydrateFromServer()
  assert.equal(loadDataset()?.anomalies.length, r.anomalyCount)
})

test('a file uploaded while the server is being read survives it', async () => {
  server.stored = true
  const original = g.fetch as (u: string, i?: unknown) => Promise<unknown>
  g.fetch = async (u: string, i?: unknown) => {
    if (u === '/api/workspace/state') ingest({ sourceId: 'upload:new.csv', label: 'new.csv', transactions: withDuplicate() })
    return original(u, i)
  }
  await hydrateFromServer()
  g.fetch = original
  assert.ok(loadAllSourceDatasets()['upload:new.csv'])
})

test('a teammate is not shown an upload that is still in progress', async () => {
  server.sources.push({ id: 'ds-2', source_key: 'upload:p.csv', name: 'p.csv', summary: { totalTransactions: 5, complete: false }, column_mapping: null, created_at: new Date().toISOString() })
  await hydrateFromServer()
  assert.equal(loadDataset(), null)
})

test('a teammate sees a finished upload this browser has never held', async () => {
  server.sources.push({ id: 'ds-1', source_key: 'upload:t.csv', name: 't.csv', summary: { totalTransactions: 5, totalSpend: 10, topVendors: [], categoryBreakdown: [], monthlyBreakdown: [], dateRange: { from: '', to: '' }, uniqueVendors: 1, complete: true }, column_mapping: null, created_at: new Date().toISOString() })
  assert.equal(await hydrateFromServer(), 'server')
  assert.equal(loadDataset()?.totalTransactions, 5)
})

test('signing out removes the workspace from this browser', () => {
  ingest({ sourceId: 'upload:ledger.csv', label: 'ledger.csv', transactions: withDuplicate() })
  localStorage.setItem('sf_import_batches', '[1]')
  localStorage.setItem('sf_detection_config', '{}')
  clearUser()
  assert.equal(loadDataset(), null)
  assert.deepEqual(loadAllSourceDatasets(), {})
  assert.equal(localStorage.getItem('sf_import_batches'), null)
  assert.equal(localStorage.getItem('sf_detection_config'), null)
})

test('data left by another workspace is removed and never sent to the new one', async () => {
  ingest({ sourceId: 'upload:theirs.csv', label: 'theirs.csv', transactions: withDuplicate() })
  await settle()
  await hydrateFromServer() // this browser now belongs to company-a
  server.sources = []; server.findings = []; server.posted = []
  server.workspace = 'company-b'
  await hydrateFromServer()
  assert.equal(loadDataset(), null)
  assert.equal(server.posted.length, 0, 'nothing of company-a reached company-b')
})

test('the same workspace signing back in keeps its data', async () => {
  const r = ingest({ sourceId: 'upload:ours.csv', label: 'ours.csv', transactions: withDuplicate() })
  await settle()
  await hydrateFromServer()
  await hydrateFromServer()
  assert.equal(loadDataset()?.anomalies.length, r.anomalyCount)
})

test('with no database yet, another workspace still cannot see this data', async () => {
  server.stored = false
  ingest({ sourceId: 'upload:theirs.csv', label: 'theirs.csv', transactions: withDuplicate() })
  await settle()
  await hydrateFromServer()
  server.workspace = 'company-b'
  await hydrateFromServer()
  assert.equal(loadDataset(), null)
})

test('a close reason survives a sync and a re-upload of the same file', async () => {
  const input = { sourceId: 'upload:ledger.csv', label: 'ledger.csv', transactions: withDuplicate() }
  ingest(input)
  await settle()
  const id = loadDataset()!.anomalies[0].id
  assert.ok(setFindingStatus(id, 'Dismissed', 'false_alarm'))
  const onServer = server.findings.find(f => f.id === id)!
  onServer.status = 'Dismissed'; onServer.close_reason = 'false_alarm'
  await hydrateFromServer()
  assert.equal(loadDataset()!.anomalies.find(a => a.id === id)?.closeReason, 'false_alarm')
  ingest(input)
  const after = loadDataset()!.anomalies.find(a => a.id === id)
  assert.equal(after?.status, 'Dismissed')
  assert.equal(after?.closeReason, 'false_alarm')
})

test('sending a closed finding back for review clears its reason', () => {
  ingest({ sourceId: 'upload:ledger.csv', label: 'ledger.csv', transactions: withDuplicate() })
  const id = loadDataset()!.anomalies[0].id
  setFindingStatus(id, 'Resolved', 'real_issue')
  setFindingStatus(id, 'Under Review')
  assert.equal(loadDataset()!.anomalies[0].closeReason, undefined)
})

test('a close reason is recorded only for a recognised reason on a closing decision', () => {
  assert.equal(closeReasonFor('Dismissed', 'false_alarm'), 'false_alarm')
  assert.equal(closeReasonFor('Resolved', 'real_issue'), 'real_issue')
  assert.equal(closeReasonFor('Under Review', 'false_alarm'), null)
  assert.equal(closeReasonFor('Dismissed', 'made_up'), null)
  assert.equal(closeReasonFor('Dismissed', undefined), null)
  assert.equal(closeReasonFor('Dismissed', 'toString'), null)
})
