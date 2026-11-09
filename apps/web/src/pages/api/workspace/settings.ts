import type { NextApiRequest, NextApiResponse } from 'next'
import { getWorkspace, isAdmin } from '../../../lib/server/workspace'
import { getSettings, putSettings } from '../../../lib/server/workspaceData'
import { writeAuditEvent, clientIp } from '../../../lib/auditServer'
import { CURRENCY_SYMBOLS } from '../../../lib/detectionConfig'

const ALLOWED = ['approvalLimit', 'minExcess', 'roundNumberMin'] as const

// Detection settings for the workspace. Admins change them; everyone's
// analysis uses them.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ws = await getWorkspace(req, res)
  if (!ws) return res.status(401).json({ error: 'Not authenticated' })
  if (req.method === 'GET') {
    const config = await getSettings(ws.tenantId).catch(() => null)
    return res.json(config ? { stored: true, config } : { stored: false })
  }
  if (req.method !== 'POST') return res.status(405).end()
  if (!isAdmin(ws)) return res.status(403).json({ error: 'Only the workspace admin can change detection settings.' })
  const config: Record<string, number | string> = {}
  for (const k of ALLOWED) {
    const v = Number(req.body?.[k])
    if (Number.isFinite(v) && v > 0 && v < 1e9) config[k] = v
  }
  if (typeof req.body?.currency === 'string' && CURRENCY_SYMBOLS[req.body.currency]) config.currency = req.body.currency
  const ok = await putSettings(ws.tenantId, config, ws.user.id).catch(() => null)
  if (ok) void writeAuditEvent({ tenantId: ws.tenantId, actorId: ws.user.id, actorEmail: ws.user.email ?? null, event: 'Detection settings changed', detail: JSON.stringify(config), severity: 'info', ip: clientIp(req) })
  res.json({ stored: !!ok, config })
}
