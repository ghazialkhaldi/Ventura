// One path from transactions to a reviewed source, whether they came from an
// uploaded file or a connected system: unique row ids, the workspace's
// detection settings, statistics, and findings that keep their identity and
// review status from one sync to the next.
import { runAnomalyDetection, flaggedRows } from './anomalyEngine'
import { summarizeTransactions, namespaceRows } from './datasetStats'
import { saveSourceDataset, keepEvidenceRows, loadSourceDataset, type StoredTransaction, type DetectedAnomaly, type AuditEntry, type Dataset, type ColumnMapping } from './dataStore'
import { getDetectionConfig } from './workspaceSettings'
import { pushSourceToServer } from './workspaceSync'

export interface IngestInput {
  sourceId:     string            // 'upload:<file>', 'quickbooks', 'plaid:<connection>' …
  label:        string            // shown in the audit log and source list
  transactions: StoredTransaction[]
  file?:        { name: string; size: number; rowCount: number }
  mapping?:     ColumnMapping
  actor?:       string
  /** Notes from reading the files (a file that failed, overlapping exports merged). */
  extraAudit?:  AuditEntry[]
}

export interface IngestResult { txCount: number; anomalyCount: number; carried: number }

/**
 * The start of a source's finding ids. The readable part alone would be "UPLOAD"
 * for every file, and the workspace keys findings by id across all its sources.
 */
function idPrefix(sourceId: string): string {
  let h = 2166136261
  for (let i = 0; i < sourceId.length; i++) h = Math.imul(h ^ sourceId.charCodeAt(i), 16777619)
  const readable = sourceId.split(':')[0].replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase() || 'SRC'
  return `${readable}${(h >>> 0).toString(36).toUpperCase()}`
}

const fingerprint = (f: Pick<DetectedAnomaly, 'type' | 'rowRefs'>) => `${f.type}|${[...flaggedRows(f)].sort().join(',')}`

/**
 * A finding raised again on the same payments by the same rule is the same
 * finding: it keeps its id and whatever a reviewer already decided about it.
 */
export function carryForward(fresh: DetectedAnomaly[], previous: DetectedAnomaly[], prefix: string): { findings: DetectedAnomaly[]; carried: number } {
  const before = new Map(previous.map(p => [fingerprint(p), p]))
  const taken = new Set<string>()
  let next = previous.reduce((m, p) => Math.max(m, Number(/(\d+)$/.exec(p.id)?.[1] ?? 0)), 0)
  let carried = 0
  const findings = fresh.map(f => {
    const old = before.get(fingerprint(f))
    if (old && !taken.has(old.id)) {
      taken.add(old.id)
      if (old.status !== 'Open') carried++
      return { ...f, id: old.id, status: old.status, detectedAt: old.detectedAt }
    }
    return { ...f, id: `ANO-${prefix}-${String(++next).padStart(3, '0')}` }
  })
  return { findings, carried }
}

export function ingest(input: IngestInput): IngestResult {
  const prefix = idPrefix(input.sourceId)
  const txs = namespaceRows(input.transactions, input.sourceId)
  const detected = runAnomalyDetection(txs, getDetectionConfig(), { idPrefix: prefix })
  const previous = loadSourceDataset(input.sourceId)?.anomalies ?? []
  const { findings, carried } = carryForward(detected, previous, prefix)
  const stats = summarizeTransactions(txs)
  const now = new Date().toISOString()

  const auditLog: AuditEntry[] = [
    {
      id: `AUD-${Date.now()}-in`, ts: now, actor: input.actor ?? 'User',
      event: input.file ? 'File Uploaded' : 'Source Synced',
      detail: `${input.label}: ${txs.length.toLocaleString()} transactions${input.file ? ` from ${input.file.rowCount.toLocaleString()} rows` : ''}`,
      severity: 'info', resource: input.label,
    },
    {
      id: `AUD-${Date.now()}-detect`, ts: now, actor: 'Ventura',
      event: 'Checks Complete',
      detail: `${findings.length} findings from ${txs.length.toLocaleString()} transactions (${findings.filter(a => a.severity === 'CRITICAL').length} critical, ${findings.filter(a => a.severity === 'HIGH').length} high)${carried ? `; ${carried} earlier decisions kept` : ''}`,
      severity: findings.some(a => a.severity === 'CRITICAL') ? 'critical' : findings.length ? 'warning' : 'info',
      resource: 'Detection',
    },
    ...(input.extraAudit ?? []),
  ]

  const dataset: Dataset = {
    uploadedAt: now,
    files: [{ name: input.file?.name ?? input.label, size: input.file?.size ?? 0, rowCount: input.file?.rowCount ?? txs.length, parsedAt: now }],
    columnMapping: input.mapping ?? { date: 'auto', vendor: 'auto', amount: 'auto', debit: null, credit: null, description: null, category: null, account: null },
    ...stats,
    anomalies: findings,
    auditLog,
    sampleTransactions: keepEvidenceRows(txs, findings),
  }
  saveSourceDataset(input.sourceId, dataset)
  void pushSourceToServer(input.sourceId, input.label, dataset, txs)
  return { txCount: txs.length, anomalyCount: findings.length, carried }
}
