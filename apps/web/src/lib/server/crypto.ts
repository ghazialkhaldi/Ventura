// Server-only. AES-256-GCM for integration tokens, keyed by TOKEN_ENCRYPTION_KEY
// (64 hex characters). Nothing is ever stored when the key is missing.
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

export interface Sealed { enc: string; iv: string; tag: string }

function key(): Buffer {
  const k = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY ?? '', 'hex')
  if (k.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
  return k
}

export const hasEncryptionKey = () => Buffer.from(process.env.TOKEN_ENCRYPTION_KEY ?? '', 'hex').length === 32

export function seal(plain: string): Sealed {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return { enc: enc.toString('base64'), iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex') }
}

export function open(s: Sealed): string {
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(s.iv, 'hex'))
  decipher.setAuthTag(Buffer.from(s.tag, 'hex'))
  return Buffer.concat([decipher.update(Buffer.from(s.enc, 'base64')), decipher.final()]).toString('utf8')
}
