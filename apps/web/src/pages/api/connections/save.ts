import type { NextApiRequest, NextApiResponse } from 'next'
import { createCipheriv, randomBytes } from 'crypto'
import { createClient } from '../../../utils/supabase/server'
import { writeAuditEvent, resolveTenantId, clientIp } from '../../../lib/auditServer'

function encryptValue(plain: string): { encrypted: string; iv: string; tag: string } {
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, 'hex')
  const iv  = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return {
    encrypted: enc.toString('base64'),
    iv:        iv.toString('hex'),
    tag:       cipher.getAuthTag().toString('hex'),
  }
}

const hasEncryptionKey = (() => {
  const raw = process.env.TOKEN_ENCRYPTION_KEY ?? ''
  return Buffer.from(raw, 'hex').length === 32
})()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { provider, credentials } = req.body || {}

  if (!provider || typeof provider !== 'string') {
    return res.status(400).json({ error: 'provider is required' })
  }
  if (!credentials || typeof credentials !== 'object' || Array.isArray(credentials)) {
    return res.status(400).json({ error: 'credentials must be an object' })
  }

  const supabase = createClient({ req, res })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return res.status(401).json({ error: 'Not authenticated' })

  // Fail closed. Base64 is encoding, not encryption — it's trivially
  // reversible by anyone who can read the stored record, so silently
  // "falling back" to it for vendor API keys and OAuth client secrets was a
  // real vulnerability, not a degraded convenience. Refuse to store
  // integration credentials at all rather than store them unprotected.
  if (!hasEncryptionKey) {
    console.error('[connections/save] TOKEN_ENCRYPTION_KEY is not configured — refusing to store credentials in plaintext-equivalent form.')
    return res.status(503).json({ error: 'Integration credential storage is not configured. Ask your administrator to set TOKEN_ENCRYPTION_KEY.' })
  }

  const record: Record<string, string> = {
    connected_at: new Date().toISOString(),
    storage_mode: 'aes-256-gcm',
  }

  for (const [fieldKey, value] of Object.entries(credentials)) {
    if (typeof value !== 'string' || !value.trim()) continue

    try {
      const enc = encryptValue(value.trim())
      record[`${fieldKey}_encrypted`] = enc.encrypted
      record[`${fieldKey}_iv`]        = enc.iv
      record[`${fieldKey}_tag`]       = enc.tag
    } catch (e) {
      console.error(`[connections/save] encryption failed for ${fieldKey}:`, e)
      return res.status(500).json({ error: 'Encryption failed. Contact your administrator.' })
    }
  }

  const meta        = (user.user_metadata || {}) as Record<string, unknown>
  const connections = ((meta._connections ?? {}) as Record<string, unknown>)
  connections[provider] = record

  const { error: updateErr } = await supabase.auth.updateUser({
    data: { ...meta, _connections: connections },
  })

  if (updateErr) {
    console.error('[connections/save] metadata update error:', updateErr)
    return res.status(500).json({ error: 'Failed to save connection. Please try again.' })
  }

  void writeAuditEvent({
    tenantId: resolveTenantId(user), actorId: user.id, actorEmail: user.email ?? null,
    event: 'Integration connected', resource: provider, severity: 'info', ip: clientIp(req),
  })

  res.json({ ok: true, encrypted: true })
}
