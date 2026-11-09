import type { NextApiRequest, NextApiResponse } from 'next'
import { randomBytes } from 'crypto'
import { getWorkspace, isAdmin } from '../../../lib/server/workspace'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const ws = await getWorkspace(req, res)
  if (!ws) return res.status(401).json({ error: 'Not authenticated' })
  if (!isAdmin(ws)) return res.status(403).json({ error: 'Only the workspace admin can create invites.' })
  const { user, supabase } = ws

  const token = randomBytes(16).toString('hex')
  const meta = user.user_metadata || {}

  const { error } = await supabase.auth.updateUser({
    data: { ...meta, _invite: { token, created_at: new Date().toISOString() } },
  })
  if (error) return res.status(500).json({ error: 'Failed to generate invite' })

  // Encode admin ID so employees can submit code without a DB lookup. The id
  // is not a secret and decides nothing: access comes from the server's own
  // record of who has joined, never from knowing it.
  const encodedId = Buffer.from(user.id).toString('base64')
  const code = `${encodedId}.${token}`

  res.json({ code })
}
