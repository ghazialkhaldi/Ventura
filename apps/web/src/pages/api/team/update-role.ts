import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '../../../utils/supabase/server'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') return res.status(405).end()

  const supabase = createClient({ req, res })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return res.status(401).json({ error: 'Not authenticated' })

  const { userId, role } = req.body || {}
  if (!userId || !role) return res.status(400).json({ error: 'userId and role are required' })

  const validRoles = ['admin', 'editor', 'analyst', 'viewer']
  if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' })

  const meta = (user.user_metadata || {}) as Record<string, unknown>
  const members = ((meta._team_members ?? []) as Array<{ user_id: string; role: string }>).map(m =>
    m.user_id === userId ? { ...m, role } : m
  )

  const { error } = await supabase.auth.updateUser({
    data: { ...meta, _team_members: members },
  })
  if (error) return res.status(500).json({ error: 'Failed to update role' })

  res.json({ ok: true })
}
