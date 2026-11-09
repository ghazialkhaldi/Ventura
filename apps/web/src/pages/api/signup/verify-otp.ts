import type { NextApiRequest, NextApiResponse } from 'next'
import { createAdminClient } from '../../../utils/supabase/admin'
import { createClient } from '../../../utils/supabase/server'
import { otpSecret, otpMac, macMatches, CODE_REGEX } from '../../../lib/server/otp'
import { rateLimit, limitKey } from '../../../lib/server/rateLimit'
import { claimsFromToken, withMfaSession } from '../../../lib/server/mfa'
import { clientIp } from '../../../lib/auditServer'

const EMAIL_REGEX = /^[^\s@<>"'&]{1,64}@[^\s@<>"'&]{1,255}\.[^\s@<>"'&]{2,}$/

// Checks the signup code, creates the account, and signs it in.
//
// The person has just proved they own the address, so THIS session counts as
// having passed the second factor and the server records that. The browser
// must not sign in again afterwards: a new sign-in is a new session, and it
// would have to pass the second factor again.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { email: rawEmail, code: rawCode, password, firstName, lastName } = req.body || {}

  if (!rawEmail || typeof rawEmail !== 'string') return res.status(400).json({ error: 'Email is required' })
  const email = rawEmail.trim().toLowerCase()
  if (!EMAIL_REGEX.test(email)) return res.status(400).json({ error: 'Invalid email' })

  const code = typeof rawCode === 'string' ? rawCode.trim() : ''
  if (!CODE_REGEX.test(code)) return res.status(400).json({ error: 'Enter a valid 6-digit code' })

  if (!password || typeof password !== 'string' || password.length < 8 || password.length > 200) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }

  const secret = otpSecret()
  if (!secret) return res.status(503).json({ error: 'Account creation is not configured on this server.' })

  // A hard ceiling on guesses, counted in the database. Five tries per address
  // every ten minutes against a million possible codes.
  const ip = clientIp(req) ?? 'unknown'
  const [byEmail, byIp] = await Promise.all([
    rateLimit(limitKey('signup-verify-email', email), 5, 600),
    rateLimit(limitKey('signup-verify-ip', ip), 30, 3600),
  ])
  if (!byEmail.ok || !byIp.ok) {
    return res.status(429).json({ error: 'Too many attempts. Please request a new code and try again shortly.' })
  }

  // Read and validate the signed cookie
  const raw = req.cookies['_su_otp']
  if (!raw) return res.status(400).json({ error: 'Session expired. Please start over.' })

  let parsed: { email?: unknown; expiresAt?: unknown; mac?: unknown }
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'))
  } catch {
    return res.status(400).json({ error: 'Invalid session. Please start over.' })
  }

  if (parsed.email !== email) return res.status(400).json({ error: 'Email does not match. Please start over.' })
  if (typeof parsed.expiresAt !== 'number') return res.status(400).json({ error: 'Invalid session. Please start over.' })
  if (Date.now() > parsed.expiresAt) return res.status(400).json({ error: 'Code expired. Please request a new one.' })

  // The code is part of what was signed, so a wrong code simply does not match.
  if (!macMatches(otpMac(secret, 'signup', email, code, parsed.expiresAt), parsed.mac)) {
    return res.status(400).json({ error: 'Incorrect code. Please try again.' })
  }

  // Clear the OTP cookie
  res.setHeader('Set-Cookie', '_su_otp=; HttpOnly; SameSite=Lax; Path=/api/signup; Max-Age=0')

  // Create the Supabase account via admin API — email_confirm:true is honest
  // here because the code above proved the person can read this inbox.
  let admin
  try { admin = createAdminClient() } catch {
    return res.status(503).json({ error: 'Account creation is not configured. Please ask your admin to set SUPABASE_SERVICE_ROLE_KEY.' })
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: typeof firstName === 'string' ? firstName.trim().slice(0, 80) : '',
      last_name:  typeof lastName  === 'string' ? lastName.trim().slice(0, 80)  : '',
      user_type:  'employee',
    },
  })

  if (createErr) {
    // Duplicate — account already exists
    if (createErr.message?.toLowerCase().includes('already') || (createErr as { status?: number }).status === 422) {
      return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' })
    }
    console.error('[signup/verify-otp] createUser error:', createErr)
    return res.status(500).json({ error: 'Failed to create account. Please try again.' })
  }

  if (!created?.user) return res.status(500).json({ error: 'Failed to create account. Please try again.' })

  // Sign the new account in here, on the server, and record this session as
  // verified. If anything in this part fails the account still exists and the
  // person is told to sign in, which takes them through the normal code step.
  let signedIn = false
  try {
    const supabase = createClient({ req, res })
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    const sessionId = claimsFromToken(data?.session?.access_token).sessionId
    if (!error && sessionId) {
      const { error: markErr } = await admin.auth.admin.updateUserById(created.user.id, {
        app_metadata: withMfaSession(created.user.app_metadata, sessionId),
      })
      signedIn = !markErr
    }
  } catch (e) {
    console.error('[signup/verify-otp] could not sign the new account in:', e)
  }

  res.json({ ok: true, signedIn })
}
