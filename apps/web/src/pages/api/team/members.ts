import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '../../../utils/supabase/server'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const supabase = createClient({ req, res })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return res.status(401).json({ error: 'Not authenticated' })

  const meta = (user.user_metadata || {}) as Record<string, unknown>
  const members = (meta._team_members ?? []) as unknown[]
  const invite  = (meta._invite ?? {}) as { token?: string; created_at?: string }

  // Build invite code
  const encodedId = Buffer.from(user.id).toString('base64')
  const inviteCode = invite.token ? `${encodedId}.${invite.token}` : null

  res.json({ members, inviteCode, inviteCreatedAt: invite.created_at ?? null })
}
