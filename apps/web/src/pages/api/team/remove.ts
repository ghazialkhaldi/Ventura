import type { NextApiRequest, NextApiResponse } from 'next'
import { createAdminClient } from '../../../utils/supabase/admin'
import { writeAuditEvent, clientIp } from '../../../lib/auditServer'
import { getWorkspace, isAdmin } from '../../../lib/server/workspace'
import { belongsToTenant } from '../../../lib/server/tenancy'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') return res.status(405).end()

  const ws = await getWorkspace(req, res)
  if (!ws) return res.status(401).json({ error: 'Not authenticated' })
  if (!isAdmin(ws)) return res.status(403).json({ error: 'Only the workspace admin can remove team members.' })
  const { user, supabase } = ws

  const userId = typeof req.body?.userId === 'string' ? req.body.userId : ''
  if (!userId) return res.status(400).json({ error: 'userId is required' })
  if (userId === user.id) return res.status(400).json({ error: 'You cannot remove yourself from your own workspace.' })

  const meta = (user.user_metadata || {}) as Record<string, unknown>
  const all = (meta._team_members ?? []) as Array<{ user_id: string }>
  const listed = all.some(m => m.user_id === userId)
  const members = all.filter(m => m.user_id !== userId)

  const { error } = await supabase.auth.updateUser({
    data: { ...meta, _team_members: members },
  })
  if (error) return res.status(500).json({ error: 'Failed to remove member' })

  // Revoke their access to this workspace's data, which is keyed on
  // app_metadata.tenant_id (see lib/server/workspace.ts). Only touch an
  // account that really belongs to THIS workspace.
  try {
    const admin = createAdminClient()
    const { data } = await admin.auth.admin.getUserById(userId)
    const target = data?.user
    if (target && belongsToTenant(target, ws.tenantId, listed)) {
      const app = (target.app_metadata ?? {}) as Record<string, unknown>
      const tmeta = (target.user_metadata ?? {}) as Record<string, unknown>
      await admin.auth.admin.updateUserById(userId, {
        app_metadata: { ...app, tenant_id: null },
        user_metadata: { ...tmeta, _company: null },
      })
    }
  } catch (e) {
    console.error('[team/remove] could not revoke workspace access:', e)
  }

  void writeAuditEvent({
    tenantId: ws.tenantId, actorId: user.id, actorEmail: user.email ?? null,
    event: 'Team member removed', resource: userId, severity: 'warning', ip: clientIp(req),
  })

  res.json({ ok: true })
}
