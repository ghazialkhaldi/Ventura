import type { NextApiRequest, NextApiResponse } from 'next'
import { getWorkspace } from '../../../lib/server/workspace'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const ws = await getWorkspace(req, res)
  if (!ws) return res.status(401).json({ error: 'Not authenticated' })

  // Not a member of anyone else's workspace.
  if (ws.tenantId === ws.user.id) return res.status(404).json({ error: 'Not in a workspace' })

  // What the server has verified, never the person's own editable copy.
  const own = ((ws.user.user_metadata ?? {})._company ?? {}) as Record<string, string>
  return res.json({
    role:      ws.role,
    company:   ws.tenantName ?? '',
    adminId:   ws.tenantId,
    joinedAt:  own.joined_at ?? null,
  })
}
