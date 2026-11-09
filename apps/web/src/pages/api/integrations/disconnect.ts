import type { NextApiRequest, NextApiResponse } from 'next'
import { getWorkspace, isAdmin } from '../../../lib/server/workspace'
import { getConnection, deleteConnection } from '../../../lib/server/connectionStore'
import { revoke } from '../../../lib/server/providers'
import { writeAuditEvent, clientIp } from '../../../lib/auditServer'

// Revokes access at the provider, then deletes the stored tokens.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const ws = await getWorkspace(req, res)
  if (!ws) return res.status(401).json({ error: 'Not authenticated' })
  if (!isAdmin(ws)) return res.status(403).json({ error: 'Only the workspace admin can disconnect systems.' })
  const c = await getConnection(ws.tenantId, String(req.body?.connectionId ?? '')).catch(() => null)
  if (!c) return res.status(404).json({ error: 'Connection not found' })
  await revoke(c)
  await deleteConnection(c)
  void writeAuditEvent({ tenantId: ws.tenantId, actorId: ws.user.id, actorEmail: ws.user.email ?? null, event: 'Integration disconnected', resource: c.provider, severity: 'warning', ip: clientIp(req) })
  res.json({ ok: true })
}
