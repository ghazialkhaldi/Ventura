import type { NextApiRequest, NextApiResponse } from 'next'
import { randomBytes, createHash } from 'crypto'
import { createClient } from '../../../utils/supabase/server'

const PROVIDERS: Record<string, { authUrl: string; clientId: string; redirectUri: string; scope: string }> = {
  quickbooks: {
    authUrl:     'https://appcenter.intuit.com/connect/oauth2',
    clientId:    process.env.QUICKBOOKS_CLIENT_ID ?? '',
    redirectUri: process.env.QUICKBOOKS_REDIRECT_URI ?? `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/callback/quickbooks`,
    scope:       'com.intuit.quickbooks.accounting',
  },
  salesforce: {
    authUrl:     'https://login.salesforce.com/services/oauth2/authorize',
    clientId:    process.env.SALESFORCE_CLIENT_ID ?? '',
    redirectUri: process.env.SALESFORCE_REDIRECT_URI ?? `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/callback/salesforce`,
    scope:       'api refresh_token',
  },
  xero: {
    authUrl:     'https://login.xero.com/identity/connect/authorize',
    clientId:    process.env.XERO_CLIENT_ID ?? '',
    redirectUri: process.env.XERO_REDIRECT_URI ?? `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/callback/xero`,
    scope:       'openid profile email accounting.transactions accounting.reports.read offline_access',
  },
  gusto: {
    authUrl:     'https://api.gusto.com/oauth/authorize',
    clientId:    process.env.GUSTO_CLIENT_ID ?? '',
    redirectUri: process.env.GUSTO_REDIRECT_URI ?? `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/callback/gusto`,
    scope:       'public',
  },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { provider } = req.body || {}
  const cfg = PROVIDERS[provider as string]

  if (!cfg) return res.status(400).json({ error: `Unknown OAuth provider: ${provider}` })
  if (!cfg.clientId) {
    return res.status(503).json({ error: `${provider} OAuth is not configured on this server` })
  }

  const supabase = createClient({ req, res })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return res.status(401).json({ error: 'Not authenticated' })

  // PKCE — code_verifier is secret; code_challenge is its SHA-256 hash sent to provider
  const codeVerifier  = randomBytes(64).toString('base64url')
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
  const state         = randomBytes(32).toString('hex')

  // Store state + verifier in short-lived HttpOnly cookies (10 min)
  // These are read back in the callback route to validate the flow
  const cookieBase = 'HttpOnly; SameSite=Lax; Path=/; Max-Age=600'
  res.setHeader('Set-Cookie', [
    `oauth_state=${state}; ${cookieBase}`,
    `oauth_verifier=${codeVerifier}; ${cookieBase}`,
    `oauth_provider=${provider}; ${cookieBase}`,
  ])

  const params = new URLSearchParams({
    response_type:         'code',
    client_id:             cfg.clientId,
    redirect_uri:          cfg.redirectUri,
    scope:                 cfg.scope,
    state,
    code_challenge:        codeChallenge,
    code_challenge_method: 'S256',
  })

  res.json({ url: `${cfg.authUrl}?${params}` })
}
