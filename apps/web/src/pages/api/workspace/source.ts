import type { NextApiRequest, NextApiResponse } from 'next'
import { getWorkspace, canDecide } from '../../../lib/server/workspace'
import { upsertSource, insertTransactions, upsertFindings } from '../../../lib/server/workspaceData'

export const config = { api: { bodyParser: { sizeLimit: '4mb' } } }

// Saves one source to the workspace in steps the browser sends one after
// another: the register and its summary, its rows in chunks, then its
// findings. Replies { stored: false } until migration 003 has run.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const ws = await getWorkspace(req, res)
  if (!ws) return res.status(401).json({ error: 'Not authenticated' })
  if (!canDecide(ws)) return res.status(403).json({ error: 'Your role cannot add data.' })
  const b = req.body ?? {}
  try {
    if (b.step === 'register') {
      const id = await upsertSource(ws.tenantId, String(b.sourceKey).slice(0, 200), String(b.source ?? 'upload').slice(0, 40), String(b.name ?? b.sourceKey).slice(0, 300), b.summary ?? {}, b.mapping, { id: ws.user.id, email: ws.user.email ?? null })
      return res.json(id ? { stored: true, datasetId: id } : { stored: false })
    }
    if (b.step === 'rows') {
      const ok = await insertTransactions(ws.tenantId, String(b.datasetId), Array.isArray(b.rows) ? b.rows : [])
      return res.json({ stored: ok })
    }
    if (b.step === 'findings') {
      const ok = await upsertFindings(ws.tenantId, String(b.datasetId), Array.isArray(b.findings) ? b.findings : [])
      return res.json({ stored: ok })
    }
    res.status(400).json({ error: 'Unknown step' })
  } catch (e) {
    console.error('[workspace/source]', e)
    res.status(500).json({ error: 'Could not save to the workspace' })
  }
}
