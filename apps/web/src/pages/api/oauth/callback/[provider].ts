import type { NextApiRequest, NextApiResponse } from 'next'
import { getWorkspace, isAdmin } from '../../../../lib/server/workspace'
import { oauthSettings, tokenRequest, describeAccount } from '../../../../lib/server/providers'
import { saveConnection, type Provider } from '../../../../lib/server/connectionStore'
import { writeAuditEvent, clientIp } from '../../../../lib/auditServer'

// Completes an OAuth connection: checks the anti-forgery state, exchanges the
// one-time code, identifies the company that was connected (QuickBooks sends
// its realmId here; Xero and Gusto are asked), and stores the tokens sealed.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const provider = String(req.query.provider) as Provider
  const s = oauthSettings(provider)
  const { code, state, error: oauthError, realmId } = req.query
  const back = (q: string) => res.redirect(`/integrations?${q}`)

  const clear = 'HttpOnly; Secure; SameSite=Lax; Path=/api/oauth; Max-Age=0'
  res.setHeader('Set-Cookie', [`oauth_state=; ${clear}`, `oauth_verifier=; ${clear}`, `oauth_provider=; ${clear}`])

  if (oauthError) return back(`error=${encodeURIComponent(String(oauthError))}`)
  if (!code || !state || !s) return back('error=invalid_callback')
  if (!req.cookies.oauth_state || req.cookies.oauth_state !== String(state) || req.cookies.oauth_provider !== provider) return back('error=invalid_state')

  const ws = await getWorkspace(req, res)
  if (!ws) return res.redirect('/login?error=session_expired')
  if (!isAdmin(ws)) return back('error=not_admin')

  try {
    const tokens = await tokenRequest(s, {
      grant_type: 'authorization_code', code: String(code), redirect_uri: s.redirectUri,
      ...(s.pkce && req.cookies.oauth_verifier ? { code_verifier: req.cookies.oauth_verifier } : {}),
    })
    const account = await describeAccount(provider, tokens.access_token, realmId ? String(realmId) : null)
    await saveConnection({
      tenantId: ws.tenantId, provider, accountId: account.id, accountName: account.name,
      accessToken: tokens.access_token, refreshToken: tokens.refresh_token ?? null,
      expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000 - 60_000).toISOString() : null,
      connectedBy: ws.user.id, connectedByEmail: ws.user.email ?? null,
    })
    void writeAuditEvent({ tenantId: ws.tenantId, actorId: ws.user.id, actorEmail: ws.user.email ?? null, event: 'Integration connected', resource: `${provider}${account.name ? `: ${account.name}` : ''}`, severity: 'info', ip: clientIp(req) })
    return back(`connected=${provider}`)
  } catch (e) {
    console.error(`[oauth:${provider}]`, e)
    return back('error=token_exchange_failed')
  }
}
