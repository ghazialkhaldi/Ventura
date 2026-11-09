import type { NextApiRequest, NextApiResponse } from 'next'
import { createAdminClient } from '../../../utils/supabase/admin'
import { getWorkspace, isAdmin } from '../../../lib/server/workspace'
import { belongsToTenant } from '../../../lib/server/tenancy'

// One team member's recent activity, for the workspace's admin only.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const ws = await getWorkspace(req, res)
  if (!ws) return res.status(401).json({ error: 'Not authenticated' })
  if (!isAdmin(ws)) return res.status(403).json({ error: 'Only the workspace admin can read team activity.' })

  const { userId } = req.query
  if (!userId || typeof userId !== 'string') return res.status(400).json({ error: 'userId is required' })

  let admin
  try { admin = createAdminClient() } catch { return res.status(503).json({ error: 'Not configured' }) }

  const { data: emp } = await admin.auth.admin.getUserById(userId)
  if (!emp?.user) return res.status(404).json({ error: 'User not found' })

  // The admin's own team list is theirs to write, so being named in it is not
  // enough. The person themselves must belong to this workspace, as recorded
  // by the server (lib/server/tenancy.ts).
  const members = ((ws.user.user_metadata ?? {})._team_members ?? []) as Array<{ user_id: string }>
  const listed  = members.some(m => m.user_id === userId)
  if (!belongsToTenant(emp.user, ws.tenantId, listed)) {
    return res.status(403).json({ error: 'User is not in your workspace' })
  }

  const empMeta = (emp.user.user_metadata || {}) as Record<string, unknown>
  const logs    = Array.isArray(empMeta._activity_log) ? empMeta._activity_log : []

  return res.json({ logs: logs.slice().reverse() })
}
