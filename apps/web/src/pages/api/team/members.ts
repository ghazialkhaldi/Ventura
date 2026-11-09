import type { NextApiRequest, NextApiResponse } from 'next'
import { getWorkspace, isAdmin } from '../../../lib/server/workspace'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const ws = await getWorkspace(req, res)
  if (!ws) return res.status(401).json({ error: 'Not authenticated' })

  // The team list and the invite code are the admin's. Anyone else gets an
  // empty answer, not an error, so screens that ask do not break.
  if (!isAdmin(ws)) return res.json({ members: [], inviteCode: null, inviteCreatedAt: null })

  const meta = (ws.user.user_metadata || {}) as Record<string, unknown>
  const members = (meta._team_members ?? []) as unknown[]
  const invite  = (meta._invite ?? {}) as { token?: string; created_at?: string }

  // Build invite code
  const encodedId = Buffer.from(ws.user.id).toString('base64')
  const inviteCode = invite.token ? `${encodedId}.${invite.token}` : null

  res.json({ members, inviteCode, inviteCreatedAt: invite.created_at ?? null })
}
