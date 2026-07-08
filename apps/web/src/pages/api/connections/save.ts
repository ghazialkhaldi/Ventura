import type { NextApiRequest, NextApiResponse } from 'next'
import { createCipheriv, randomBytes } from 'crypto'
import { createClient } from '../../../utils/supabase/server'

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

  const record: Record<string, string> = {
    connected_at: new Date().toISOString(),
    storage_mode: hasEncryptionKey ? 'aes-256-gcm' : 'base64',
  }

  for (const [fieldKey, value] of Object.entries(credentials)) {
    if (typeof value !== 'string' || !value.trim()) continue

    if (hasEncryptionKey) {
      try {
        const enc = encryptValue(value.trim())
        record[`${fieldKey}_encrypted`] = enc.encrypted
        record[`${fieldKey}_iv`]        = enc.iv
        record[`${fieldKey}_tag`]       = enc.tag
      } catch (e) {
        console.error(`[connections/save] encryption failed for ${fieldKey}:`, e)
        return res.status(500).json({ error: 'Encryption failed. Contact your administrator.' })
      }
    } else {
      // TOKEN_ENCRYPTION_KEY not set — store base64-obfuscated as a fallback.
      // Set TOKEN_ENCRYPTION_KEY in your environment for AES-256-GCM encryption.
      console.warn(`[connections/save] TOKEN_ENCRYPTION_KEY not configured — ${fieldKey} stored as base64`)
      record[`${fieldKey}_b64`] = Buffer.from(value.trim()).toString('base64')
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

  res.json({ ok: true, encrypted: hasEncryptionKey })
}
