import type { NextApiRequest, NextApiResponse } from 'next'
import { getWorkspace, canDecide } from '../../../lib/server/workspace'
import { decide } from '../../../lib/server/workspaceData'

// A reviewer's decision on a finding, recorded with who, what and when in an
// append-only log. Viewers cannot decide.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const ws = await getWorkspace(req, res)
  if (!ws) return res.status(401).json({ error: 'Not authenticated' })
  if (!canDecide(ws)) return res.status(403).json({ error: 'Your role can view findings but not decide them.' })
  const id = String(req.body?.id ?? '').slice(0, 80)
  const status = String(req.body?.status ?? '')
  const note = typeof req.body?.note === 'string' && req.body.note.trim() ? req.body.note.trim() : null
  try {
    const r = await decide(ws.tenantId, id, status, note, { id: ws.user.id, email: ws.user.email ?? null }, req.body?.reason)
    if (r === 'not_found') return res.status(404).json({ stored: false, error: 'Finding not found in the workspace' })
    res.json({ stored: r === 'stored' })
  } catch (e) {
    console.error('[findings/decide]', e)
    res.status(500).json({ error: 'Could not record the decision' })
  }
}
