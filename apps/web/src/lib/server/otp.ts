// One-time codes sent by email, for sign-in and for signup.
//
// A code is stored only as a KEYED hash (HMAC with a server secret). An
// unkeyed hash of a six-digit number is no protection at all: there are only
// a million of them, so anyone who can read the hash can recover the code in
// well under a second. The signup cookie is readable by the person holding
// it, and `app_metadata` is readable by its own user, so both must hold
// something the holder cannot reverse.
import { createHmac, randomInt, timingSafeEqual } from 'crypto'

/**
 * The signing secret, or null when the server has none. Derived from a
 * secret that only the server holds, with a purpose label so it is never the
 * same key as anything else. There is deliberately no hardcoded fallback.
 */
export function otpSecret(env: Record<string, string | undefined> = process.env): Buffer | null {
  const base = env.TOKEN_ENCRYPTION_KEY || env.SUPABASE_SERVICE_ROLE_KEY
  if (!base) return null
  return createHmac('sha256', base).update('ventura:otp:v1').digest()
}

export const CODE_REGEX = /^\d{6}$/

export function newCode(): string {
  return randomInt(100000, 1000000).toString()
}

/** `purpose` and `subject` bind a code to one use: a signup email or a user id. */
export function otpMac(secret: Buffer, purpose: 'signup' | 'mfa', subject: string, code: string, expiresAt: number | string): string {
  return createHmac('sha256', secret).update([purpose, subject, code, String(expiresAt)].join('|')).digest('hex')
}

export function macMatches(a: unknown, b: unknown): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  if (!/^[0-9a-f]+$/i.test(a) || !/^[0-9a-f]+$/i.test(b)) return false
  const x = Buffer.from(a, 'hex')
  const y = Buffer.from(b, 'hex')
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y)
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}
