import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '../../../utils/supabase/server'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') return res.status(405).end()

  const supabase = createClient({ req, res })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return res.status(401).json({ error: 'Not authenticated' })

  const { userId } = req.body || {}
  if (!userId) return res.status(400).json({ error: 'userId is required' })

  const meta = (user.user_metadata || {}) as Record<string, unknown>
  const members = ((meta._team_members ?? []) as Array<{ user_id: string }>)
    .filter(m => m.user_id !== userId)

  const { error } = await supabase.auth.updateUser({
    data: { ...meta, _team_members: members },
  })
  if (error) return res.status(500).json({ error: 'Failed to remove member' })

  res.json({ ok: true })
}
