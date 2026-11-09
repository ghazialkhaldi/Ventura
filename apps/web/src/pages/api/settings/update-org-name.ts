import type { NextApiRequest, NextApiResponse } from 'next'
import { writeAuditEvent, clientIp } from '../../../lib/auditServer'
import { getWorkspace, isAdmin } from '../../../lib/server/workspace'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { name } = req.body || {}
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Organization name is required' })
  }
  const trimmed = name.trim().slice(0, 120)

  const ws = await getWorkspace(req, res)
  if (!ws) return res.status(401).json({ error: 'Not authenticated' })
  if (!isAdmin(ws)) return res.status(403).json({ error: 'Only the workspace admin can rename the organization.' })
  const { user, supabase } = ws

  // _company_name is what api/invite/join.ts and api/invite/validate.ts
  // actually read when deciding what company name to show an employee
  // joining this workspace — previously nothing ever wrote it, so those
  // routes always fell back to deriving a name from the admin's email
  // domain regardless of what was typed into Settings.
  const meta = (user.user_metadata || {}) as Record<string, unknown>
  const { error } = await supabase.auth.updateUser({
    data: { ...meta, _company_name: trimmed },
  })
  if (error) return res.status(500).json({ error: 'Failed to update organization name' })

  void writeAuditEvent({
    tenantId: ws.tenantId, actorId: user.id, actorEmail: user.email ?? null,
    event: 'Organization name changed', detail: trimmed, severity: 'info', ip: clientIp(req),
  })

  res.json({ ok: true, name: trimmed })
}
