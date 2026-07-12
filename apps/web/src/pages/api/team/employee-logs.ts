import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '../../../utils/supabase/server'
import { createAdminClient } from '../../../utils/supabase/admin'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const supabase = createClient({ req, res })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return res.status(401).json({ error: 'Not authenticated' })

  const { userId } = req.query
  if (!userId || typeof userId !== 'string') return res.status(400).json({ error: 'userId is required' })

  // Only admins should call this — verify the requested user is in their _team_members
  const meta    = (user.user_metadata || {}) as Record<string, unknown>
  const members = (meta._team_members as Array<{ user_id: string }> | undefined) ?? []
  const isMember = members.some(m => m.user_id === userId)
  if (!isMember) return res.status(403).json({ error: 'User is not in your workspace' })

  let admin
  try { admin = createAdminClient() } catch { return res.status(503).json({ error: 'Not configured' }) }

  const { data: emp } = await admin.auth.admin.getUserById(userId)
  if (!emp?.user) return res.status(404).json({ error: 'User not found' })

  const empMeta = (emp.user.user_metadata || {}) as Record<string, unknown>
  const logs    = Array.isArray(empMeta._activity_log) ? empMeta._activity_log : []

  return res.json({ logs: logs.slice().reverse() })
}
