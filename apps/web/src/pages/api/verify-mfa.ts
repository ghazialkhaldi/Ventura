import type { NextApiRequest, NextApiResponse } from 'next'
import { createHash, timingSafeEqual } from 'crypto'
import { createClient } from '../../utils/supabase/server'

const MAX_ATTEMPTS = 5

const EMAIL_REGEX = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/
const CODE_REGEX  = /^\d{6}$/

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  // Strict input validation — reject malformed inputs before touching any auth state
  const rawEmail = req.body?.email
  const rawCode  = req.body?.code

  if (!rawEmail || typeof rawEmail !== 'string' || rawEmail.length > 320) {
    return res.status(400).json({ error: 'Email and code required' })
  }
  const email = rawEmail.trim().toLowerCase()
  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'Email and code required' })
  }

  // Code must be exactly 6 digits — reject early to avoid wasting an attempt counter slot
  const code = typeof rawCode === 'string' ? rawCode.trim() : String(rawCode ?? '')
  if (!CODE_REGEX.test(code)) {
    return res.status(400).json({ error: 'Invalid verification code format' })
  }

  const supabase = createClient({ req, res })

  // Fetch live user state (includes metadata written by send-mfa)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email?.toLowerCase() !== email) {
    return res.status(401).json({ error: 'Session not found. Please sign in again.' })
  }

  const meta     = (user.user_metadata || {}) as Record<string, unknown>
  const hash     = meta._mfa_hash     as string | undefined
  const exp      = meta._mfa_exp      as string | undefined
  const attempts = (meta._mfa_attempts as number | undefined) ?? 0

  if (!hash || !exp) {
    return res.status(400).json({ error: 'No verification code found. Please request a new one.' })
  }

  if (Date.now() > new Date(exp).getTime()) {
    await supabase.auth.updateUser({ data: { _mfa_hash: null, _mfa_exp: null, _mfa_attempts: null } })
    return res.status(400).json({ error: 'Code expired. Please request a new one.' })
  }

  if (attempts >= MAX_ATTEMPTS) {
    await supabase.auth.updateUser({ data: { _mfa_hash: null, _mfa_exp: null, _mfa_attempts: null } })
    return res.status(400).json({ error: 'Too many incorrect attempts. Please request a new code.' })
  }

  // Increment attempt count before checking (prevents race-condition brute force)
  await supabase.auth.updateUser({ data: { _mfa_attempts: attempts + 1 } })

  // Timing-safe SHA-256 comparison
  const inputHash = createHash('sha256').update(code.toString()).digest('hex')
  const storedBuf = Buffer.from(hash, 'hex')
  const inputBuf  = Buffer.from(inputHash, 'hex')
  const correct   = storedBuf.length === inputBuf.length && timingSafeEqual(storedBuf, inputBuf)

  if (!correct) {
    const remaining = MAX_ATTEMPTS - (attempts + 1)
    if (remaining <= 0) {
      await supabase.auth.updateUser({ data: { _mfa_hash: null, _mfa_exp: null, _mfa_attempts: null } })
    }
    return res.status(400).json({
      error: remaining > 0
        ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
        : 'Too many incorrect attempts. Please request a new code.',
    })
  }

  // Single-use: clear the code immediately on success
  await supabase.auth.updateUser({ data: { _mfa_hash: null, _mfa_exp: null, _mfa_attempts: null } })

  res.json({ ok: true })
}
