import type { NextApiRequest, NextApiResponse } from 'next'
import { getWorkspace, isAdmin } from '../../../../lib/server/workspace'
import { plaidPost, providerInfo } from '../../../../lib/server/providers'

// A short-lived token that opens Plaid Link in the browser, where the
// customer chooses their bank and signs in with it directly. Ventura never
// sees their bank credentials.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  // Who is asking comes first: a signed-out caller must not learn which
  // server settings are missing.
  const ws = await getWorkspace(req, res)
  if (!ws) return res.status(401).json({ error: 'Not authenticated' })
  if (!isAdmin(ws)) return res.status(403).json({ error: 'Only the workspace admin can connect accounts.' })
  const info = providerInfo().find(p => p.id === 'plaid')!
  if (info.missing.length) return res.status(503).json({ not_configured: true, missing: info.missing })
  try {
    const j = await plaidPost<{ link_token: string }>('/link/token/create', {
      client_name: 'Ventura',
      user: { client_user_id: ws.tenantId },
      products: ['transactions'],
      transactions: { days_requested: 730 },
      country_codes: (process.env.PLAID_COUNTRY_CODES || 'US').split(',').map(s => s.trim()),
      language: 'en',
      ...(process.env.PLAID_REDIRECT_URI ? { redirect_uri: process.env.PLAID_REDIRECT_URI } : {}),
    })
    res.json({ link_token: j.link_token })
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : 'Could not start Plaid' })
  }
}
