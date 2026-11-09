import type { NextApiRequest, NextApiResponse } from 'next'
import { requireSession } from '../../../lib/server/session'

// The signed-in person's own recent activity. Only ever their own.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const s = await requireSession(req, res)
  if (!s) return

  const meta = (s.user.user_metadata || {}) as Record<string, unknown>
  const logs = Array.isArray(meta._activity_log) ? meta._activity_log : []

  return res.json({ logs })
}
