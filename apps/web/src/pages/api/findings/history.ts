import type { NextApiRequest, NextApiResponse } from 'next'
import { getWorkspace } from '../../../lib/server/workspace'
import { findingHistory } from '../../../lib/server/workspaceData'

// The recorded decisions on one finding, oldest first.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const ws = await getWorkspace(req, res)
  if (!ws) return res.status(401).json({ error: 'Not authenticated' })
  const events = await findingHistory(ws.tenantId, String(req.query.id ?? '')).catch(() => null)
  res.json(events ? { stored: true, events } : { stored: false, events: [] })
}
