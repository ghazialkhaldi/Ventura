import type { NextApiRequest, NextApiResponse } from 'next'
import { getWorkspace } from '../../../lib/server/workspace'
import { loadState } from '../../../lib/server/workspaceData'

// The workspace as the server holds it, for any member's browser.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const ws = await getWorkspace(req, res)
  if (!ws) return res.status(401).json({ error: 'Not authenticated' })
  try {
    const state = await loadState(ws.tenantId)
    res.json(state ? { stored: true, workspace: ws.tenantId, ...state } : { stored: false, workspace: ws.tenantId })
  } catch (e) {
    console.error('[workspace/state]', e)
    res.status(500).json({ error: 'Could not load the workspace' })
  }
}
