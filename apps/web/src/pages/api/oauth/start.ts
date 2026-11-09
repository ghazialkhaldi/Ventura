import type { NextApiRequest, NextApiResponse } from 'next'
import { randomBytes, createHash } from 'crypto'
import { getWorkspace, isAdmin } from '../../../lib/server/workspace'
import { oauthSettings, providerInfo } from '../../../lib/server/providers'
import type { Provider } from '../../../lib/server/connectionStore'

// Starts an OAuth connection with the app's own registered credentials. The
// customer only signs in to their accounting system and approves access;
// they never handle keys or secrets.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  // Who is asking comes first: a signed-out caller must not learn which
  // server settings are missing.
  const ws = await getWorkspace(req, res)
  if (!ws) return res.status(401).json({ error: 'Not authenticated' })
  if (!isAdmin(ws)) return res.status(403).json({ error: 'Only the workspace admin can connect systems.' })

  const provider = String(req.body?.provider ?? '') as Provider
  const s = oauthSettings(provider)
  if (!s) return res.status(400).json({ error: `Unknown provider: ${provider}` })
  const info = providerInfo().find(p => p.id === provider)
  if (info?.missing.length) return res.status(503).json({ not_configured: true, missing: info.missing })

  const state = randomBytes(32).toString('hex')
  const verifier = randomBytes(64).toString('base64url')
  const cookie = 'HttpOnly; Secure; SameSite=Lax; Path=/api/oauth; Max-Age=600'
  res.setHeader('Set-Cookie', [
    `oauth_state=${state}; ${cookie}`,
    `oauth_verifier=${verifier}; ${cookie}`,
    `oauth_provider=${provider}; ${cookie}`,
  ])

  const params = new URLSearchParams({ response_type: 'code', client_id: s.clientId, redirect_uri: s.redirectUri, state })
  if (s.scope) params.set('scope', s.scope)
  if (s.pkce) { params.set('code_challenge', createHash('sha256').update(verifier).digest('base64url')); params.set('code_challenge_method', 'S256') }
  res.json({ url: `${s.authUrl}?${params}` })
}
