import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '../../../utils/supabase/server'
import { writeAuditEvent, resolveTenantId, clientIp } from '../../../lib/auditServer'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { name } = req.body || {}
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Organization name is required' })
  }
  const trimmed = name.trim().slice(0, 120)

  const supabase = createClient({ req, res })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return res.status(401).json({ error: 'Not authenticated' })

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
    tenantId: resolveTenantId(user), actorId: user.id, actorEmail: user.email ?? null,
    event: 'Organization name changed', detail: trimmed, severity: 'info', ip: clientIp(req),
  })

  res.json({ ok: true, name: trimmed })
}
