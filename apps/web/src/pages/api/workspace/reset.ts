import type { NextApiRequest, NextApiResponse } from 'next'
import { getWorkspace, isAdmin, adminClient, tableMissing } from '../../../lib/server/workspace'
import { writeAuditEvent, clientIp } from '../../../lib/auditServer'

// Removes the workspace's registers, rows and findings. The append-only
// decision log is kept: it records what reviewers decided, which may still
// need to be shown to an auditor after the data itself is gone.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const ws = await getWorkspace(req, res)
  if (!ws) return res.status(401).json({ error: 'Not authenticated' })
  if (!isAdmin(ws)) return res.status(403).json({ error: 'Only the workspace admin can reset its data.' })
  const db = adminClient()
  if (!db) return res.json({ stored: false })
  const { error } = await db.from('findings').delete().eq('tenant_id', ws.tenantId)
  if (tableMissing(error)) return res.json({ stored: false })
  await db.from('datasets').delete().eq('tenant_id', ws.tenantId)
  void writeAuditEvent({ tenantId: ws.tenantId, actorId: ws.user.id, actorEmail: ws.user.email ?? null, event: 'Workspace data reset', severity: 'warning', ip: clientIp(req) })
  res.json({ stored: true })
}
