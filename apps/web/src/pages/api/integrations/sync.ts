import type { NextApiRequest, NextApiResponse } from 'next'
import { getWorkspace, canDecide } from '../../../lib/server/workspace'
import { getConnection, markSynced } from '../../../lib/server/connectionStore'
import { fetchPage } from '../../../lib/server/providers'
import { writeAuditEvent, clientIp } from '../../../lib/auditServer'

// One page of a connection's transactions. The client calls again with the
// returned cursor until it is null, then runs them through the same checks
// as an uploaded file.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const ws = await getWorkspace(req, res)
  if (!ws) return res.status(401).json({ error: 'Not authenticated' })
  if (!canDecide(ws)) return res.status(403).json({ error: 'Your role can view findings but not sync data.' })

  const id = String(req.body?.connectionId ?? '')
  const cursor = typeof req.body?.cursor === 'string' ? req.body.cursor : null
  const months = Math.min(24, Math.max(1, Number(req.body?.months) || 12))
  const since = new Date(Date.now() - months * 30.44 * 86_400_000).toISOString().slice(0, 10)

  const c = await getConnection(ws.tenantId, id).catch(() => null)
  if (!c) return res.status(404).json({ error: 'Connection not found' })

  try {
    const page = await fetchPage(c, cursor, since)
    if (!page.cursor) {
      await markSynced(c, null)
      void writeAuditEvent({ tenantId: ws.tenantId, actorId: ws.user.id, actorEmail: ws.user.email ?? null, event: 'Integration synced', resource: c.provider, severity: 'info', ip: clientIp(req) })
    }
    res.json({ provider: c.provider, accountName: c.accountName, transactions: page.transactions, cursor: page.cursor })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Sync failed'
    await markSynced(c, message).catch(() => undefined)
    res.status(502).json({ error: message })
  }
}
