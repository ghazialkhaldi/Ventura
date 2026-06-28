import type { NextApiRequest, NextApiResponse } from 'next'
import { createHash, timingSafeEqual } from 'crypto'
import { createAdminClient } from '../../utils/supabase/admin'

const MAX_ATTEMPTS = 5

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { email, code } = req.body
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code required' })
  }

  const supabase = createAdminClient()

  // Fetch the most recent valid (unused, unexpired) challenge for this email
  const { data: challenge, error } = await supabase
    .from('mfa_challenges')
    .select('id, code_hash, attempts')
    .eq('email', email)
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !challenge) {
    return res.status(400).json({ error: 'No valid verification code found. Please request a new one.' })
  }

  if (challenge.attempts >= MAX_ATTEMPTS) {
    await supabase.from('mfa_challenges').update({ used: true }).eq('id', challenge.id)
    return res.status(400).json({ error: 'Too many incorrect attempts. Please request a new code.' })
  }

  // Increment attempt count before checking — prevents an attacker from racing
  // concurrent requests to exhaust the window before the counter catches up
  const newAttempts = challenge.attempts + 1
  await supabase
    .from('mfa_challenges')
    .update({ attempts: newAttempts })
    .eq('id', challenge.id)

  // Timing-safe SHA-256 comparison (hash lengths are always equal → no length leak)
  const inputHash    = createHash('sha256').update(code.toString()).digest('hex')
  const storedBuf    = Buffer.from(challenge.code_hash, 'hex')
  const inputBuf     = Buffer.from(inputHash, 'hex')
  const correct      = storedBuf.length === inputBuf.length && timingSafeEqual(storedBuf, inputBuf)

  if (!correct) {
    const remaining = MAX_ATTEMPTS - newAttempts
    if (remaining <= 0) {
      await supabase.from('mfa_challenges').update({ used: true }).eq('id', challenge.id)
      return res.status(400).json({ error: 'Too many incorrect attempts. Please request a new code.' })
    }
    return res.status(400).json({ error: `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` })
  }

  // Mark as used — single-use enforcement
  await supabase.from('mfa_challenges').update({ used: true }).eq('id', challenge.id)

  res.json({ ok: true })
}
