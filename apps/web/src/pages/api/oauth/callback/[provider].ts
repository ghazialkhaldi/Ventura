import type { NextApiRequest, NextApiResponse } from 'next'
import { createCipheriv, randomBytes } from 'crypto'
import { createClient } from '../../../../utils/supabase/server'

const PROVIDERS: Record<string, {
  tokenUrl: string
  clientId: string
  clientSecret: string
  redirectUri: string
}> = {
  quickbooks: {
    tokenUrl:     'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
    clientId:     process.env.QUICKBOOKS_CLIENT_ID ?? '',
    clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET ?? '',
    redirectUri:  process.env.QUICKBOOKS_REDIRECT_URI ?? `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/callback/quickbooks`,
  },
  salesforce: {
    tokenUrl:     'https://login.salesforce.com/services/oauth2/token',
    clientId:     process.env.SALESFORCE_CLIENT_ID ?? '',
    clientSecret: process.env.SALESFORCE_CLIENT_SECRET ?? '',
    redirectUri:  process.env.SALESFORCE_REDIRECT_URI ?? `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/callback/salesforce`,
  },
  xero: {
    tokenUrl:     'https://identity.xero.com/connect/token',
    clientId:     process.env.XERO_CLIENT_ID ?? '',
    clientSecret: process.env.XERO_CLIENT_SECRET ?? '',
    redirectUri:  process.env.XERO_REDIRECT_URI ?? `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/callback/xero`,
  },
  gusto: {
    tokenUrl:     'https://api.gusto.com/oauth/token',
    clientId:     process.env.GUSTO_CLIENT_ID ?? '',
    clientSecret: process.env.GUSTO_CLIENT_SECRET ?? '',
    redirectUri:  process.env.GUSTO_REDIRECT_URI ?? `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/callback/gusto`,
  },
}

function encryptValue(plain: string): { encrypted: string; iv: string; tag: string } {
  const rawKey = process.env.TOKEN_ENCRYPTION_KEY ?? ''
  const key    = Buffer.from(rawKey, 'hex')
  if (key.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
  const iv     = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const enc    = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return {
    encrypted: enc.toString('base64'),
    iv:        iv.toString('hex'),
    tag:       cipher.getAuthTag().toString('hex'),
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const provider = req.query.provider as string
  const cfg      = PROVIDERS[provider]
  const { code, state, error: oauthError } = req.query

  // Provider sent an error (user denied, etc.)
  if (oauthError) {
    return res.redirect(`/integrations?error=${encodeURIComponent(String(oauthError))}`)
  }

  if (!code || !state || !cfg) {
    return res.redirect('/integrations?error=invalid_callback')
  }

  // Validate anti-CSRF state and read PKCE verifier from cookies
  const cookieState    = req.cookies.oauth_state
  const codeVerifier   = req.cookies.oauth_verifier
  const cookieProvider = req.cookies.oauth_provider

  if (!cookieState || cookieState !== String(state) || cookieProvider !== provider) {
    return res.redirect('/integrations?error=invalid_state')
  }

  // Consume the OAuth cookies immediately — they are single-use
  const clearCookie = 'HttpOnly; SameSite=Lax; Path=/; Max-Age=0'
  res.setHeader('Set-Cookie', [
    `oauth_state=; ${clearCookie}`,
    `oauth_verifier=; ${clearCookie}`,
    `oauth_provider=; ${clearCookie}`,
  ])

  // Require an active Supabase session (the user must be logged in)
  const supabase = createClient({ req, res })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return res.redirect('/login?error=session_expired')

  // Exchange the one-time code for access + refresh tokens
  const tokenRes = await fetch(cfg.tokenUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      grant_type:   'authorization_code',
      code:         String(code),
      redirect_uri: cfg.redirectUri,
      client_id:    cfg.clientId,
      client_secret: cfg.clientSecret,
      ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
    }),
  })

  if (!tokenRes.ok) {
    console.error(`[oauth:${provider}] token exchange failed:`, await tokenRes.text())
    return res.redirect('/integrations?error=token_exchange_failed')
  }

  const tokens = await tokenRes.json()

  // Build the stored record — encrypt tokens if a key is configured
  const record: Record<string, string> = {
    connected_at: new Date().toISOString(),
  }

  if (process.env.TOKEN_ENCRYPTION_KEY) {
    try {
      const enc = encryptValue(tokens.access_token)
      record.encrypted = enc.encrypted
      record.iv        = enc.iv
      record.tag       = enc.tag

      if (tokens.refresh_token) {
        const encR         = encryptValue(tokens.refresh_token)
        record.refresh_encrypted = encR.encrypted
        record.refresh_iv        = encR.iv
        record.refresh_tag       = encR.tag
      }
      if (tokens.expires_in) {
        record.expires_at = new Date(Date.now() + Number(tokens.expires_in) * 1000).toISOString()
      }
    } catch (e) {
      console.error('[oauth] encryption error:', e)
      return res.redirect('/integrations?error=encryption_failed')
    }
  } else {
    // No encryption key — warn loudly; do not store raw tokens
    console.warn('[oauth] TOKEN_ENCRYPTION_KEY not set — tokens NOT stored. Set this env var for production.')
    return res.redirect(`/integrations?error=encryption_not_configured`)
  }

  // Persist in Supabase user metadata under _connections.{provider}
  const meta        = (user.user_metadata || {}) as Record<string, unknown>
  const connections = ((meta._connections ?? {}) as Record<string, unknown>)
  connections[provider] = record

  const { error: updateErr } = await supabase.auth.updateUser({
    data: { ...meta, _connections: connections },
  })

  if (updateErr) {
    console.error('[oauth] metadata update failed:', updateErr)
    return res.redirect('/integrations?error=storage_failed')
  }

  res.redirect(`/integrations?connected=${provider}`)
}
