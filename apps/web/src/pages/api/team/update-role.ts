import type { NextApiRequest, NextApiResponse } from 'next'
import { createAdminClient } from '../../../utils/supabase/admin'
import { writeAuditEvent, clientIp } from '../../../lib/auditServer'
import { getWorkspace, isAdmin } from '../../../lib/server/workspace'
import { belongsToTenant } from '../../../lib/server/tenancy'

// 'admin' is not assignable: the workspace's admin is its owner. Team members
// are viewers, analysts or editors.
const ASSIGNABLE = ['editor', 'analyst', 'viewer']

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') return res.status(405).end()

  const ws = await getWorkspace(req, res)
  if (!ws) return res.status(401).json({ error: 'Not authenticated' })
  if (!isAdmin(ws)) return res.status(403).json({ error: 'Only the workspace admin can change roles.' })
  const { user, supabase } = ws

  const userId = typeof req.body?.userId === 'string' ? req.body.userId : ''
  const role   = typeof req.body?.role === 'string' ? req.body.role : ''
  if (!userId || !role) return res.status(400).json({ error: 'userId and role are required' })
  if (!ASSIGNABLE.includes(role)) return res.status(400).json({ error: 'Invalid role' })

  const meta = (user.user_metadata || {}) as Record<string, unknown>
  const all  = (meta._team_members ?? []) as Array<{ user_id: string; role: string }>
  if (!all.some(m => m.user_id === userId)) return res.status(404).json({ error: 'That person is not on your team.' })

  // The other person must agree: being named in a team list proves nothing,
  // because an admin can write anything into their own list.
  let admin
  try { admin = createAdminClient() } catch { return res.status(503).json({ error: 'Not configured' }) }
  const { data: emp } = await admin.auth.admin.getUserById(userId)
  if (!emp?.user || !belongsToTenant(emp.user, ws.tenantId, true)) {
    return res.status(404).json({ error: 'That person is not on your team.' })
  }

  const members = all.map(m => (m.user_id === userId ? { ...m, role } : m))
  const { error } = await supabase.auth.updateUser({
    data: { ...meta, _team_members: members },
  })
  if (error) return res.status(500).json({ error: 'Failed to update role' })

  // The member's own copy is only what their screens show. What they may DO is
  // decided on the server from the list above (lib/server/workspace.ts).
  try {
    const empMeta = (emp.user.user_metadata || {}) as Record<string, unknown>
    const company = (empMeta._company as Record<string, string> | undefined) ?? {}
    await admin.auth.admin.updateUserById(userId, {
      user_metadata: { ...empMeta, _company: { ...company, role } },
    })
  } catch {
    // Non-fatal: the member sees the new role on their next full reload.
  }

  void writeAuditEvent({
    tenantId: ws.tenantId, actorId: user.id, actorEmail: user.email ?? null,
    event: 'Team member role changed', resource: userId, detail: `New role: ${role}`,
    severity: 'warning', ip: clientIp(req),
  })

  res.json({ ok: true })
}
