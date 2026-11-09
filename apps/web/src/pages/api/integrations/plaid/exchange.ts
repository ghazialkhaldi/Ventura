import type { NextApiRequest, NextApiResponse } from 'next'
import { getWorkspace, isAdmin } from '../../../../lib/server/workspace'
import { plaidPost } from '../../../../lib/server/providers'
import { saveConnection } from '../../../../lib/server/connectionStore'
import { writeAuditEvent, clientIp } from '../../../../lib/auditServer'

// After Plaid Link succeeds, swap its one-time public token for the item's
// access token and keep it sealed on the server.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const ws = await getWorkspace(req, res)
  if (!ws) return res.status(401).json({ error: 'Not authenticated' })
  if (!isAdmin(ws)) return res.status(403).json({ error: 'Only the workspace admin can connect accounts.' })
  const publicToken = String(req.body?.public_token ?? '')
  const institution = typeof req.body?.institution === 'string' ? req.body.institution.slice(0, 120) : null
  if (!publicToken) return res.status(400).json({ error: 'public_token is required' })
  try {
    const j = await plaidPost<{ access_token: string; item_id: string }>('/item/public_token/exchange', { public_token: publicToken })
    await saveConnection({
      tenantId: ws.tenantId, provider: 'plaid', accountId: j.item_id, accountName: institution,
      accessToken: j.access_token, connectedBy: ws.user.id, connectedByEmail: ws.user.email ?? null,
    })
    void writeAuditEvent({ tenantId: ws.tenantId, actorId: ws.user.id, actorEmail: ws.user.email ?? null, event: 'Integration connected', resource: `plaid${institution ? `: ${institution}` : ''}`, severity: 'info', ip: clientIp(req) })
    res.json({ ok: true })
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : 'Could not connect the account' })
  }
}
