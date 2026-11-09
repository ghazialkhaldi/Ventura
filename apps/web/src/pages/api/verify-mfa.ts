import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession } from '../../lib/server/session'
import { hasVerifiedTotp, withMfaSession } from '../../lib/server/mfa'
import { adminClient, resolveWorkspace } from '../../lib/server/workspace'
import { otpSecret, otpMac, macMatches, CODE_REGEX } from '../../lib/server/otp'
import { rateLimit, limitKey } from '../../lib/server/rateLimit'
import { writeAuditEvent, clientIp } from '../../lib/auditServer'

const MAX_ATTEMPTS = 5

interface Challenge { mac?: string; exp?: number; attempts?: number }

// Checks the emailed sign-in code and, if it is right, records on the SERVER
// that this session has passed its second factor. Every protected page and API
// route refuses a session that has not (see lib/server/mfa.ts), so skipping
// this step in the browser gets nobody anywhere.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  // The code is exactly six digits. Reject anything else before it can use up
  // an attempt.
  const rawCode = req.body?.code
  const code = typeof rawCode === 'string' ? rawCode.trim() : String(rawCode ?? '')
  if (!CODE_REGEX.test(code)) return res.status(400).json({ error: 'Invalid verification code format' })

  const session = await getSession(req, res)
  if (!session) return res.status(401).json({ error: 'Session not found. Please sign in again.' })
  const { user, claims } = session

  if (hasVerifiedTotp(user)) {
    return res.status(400).json({ error: 'This account uses an authenticator app. Enter the code from the app.' })
  }
  if (!claims.sessionId) return res.status(401).json({ error: 'Session not found. Please sign in again.' })

  const secret = otpSecret()
  const admin  = adminClient()
  if (!secret || !admin) return res.status(503).json({ error: 'Email verification is not configured on this server.' })

  // A hard ceiling on guesses that does not depend on the counter below, which
  // parallel requests could read at the same time. Counted in the database.
  const limit = await rateLimit(limitKey('mfa-verify-user', user.id), 10, 600)
  if (!limit.ok) return res.status(429).json({ error: 'Too many attempts. Please request a new code and try again shortly.' })

  const app       = (user.app_metadata ?? {}) as Record<string, unknown>
  const challenge = (app.mfa_challenge ?? null) as Challenge | null
  if (!challenge?.mac || !challenge.exp) {
    return res.status(400).json({ error: 'No verification code found. Please request a new one.' })
  }

  const clear = () => admin.auth.admin.updateUserById(user.id, { app_metadata: { ...app, mfa_challenge: null } })

  if (Date.now() > challenge.exp) {
    await clear()
    return res.status(400).json({ error: 'Code expired. Please request a new one.' })
  }

  const attempts = challenge.attempts ?? 0
  if (attempts >= MAX_ATTEMPTS) {
    await clear()
    return res.status(400).json({ error: 'Too many incorrect attempts. Please request a new code.' })
  }

  const ws = await resolveWorkspace(user, session.supabase)
  const tenantId = ws?.tenantId ?? user.id

  if (!macMatches(otpMac(secret, 'mfa', user.id, code, challenge.exp), challenge.mac)) {
    const remaining = MAX_ATTEMPTS - (attempts + 1)
    if (remaining <= 0) {
      await clear()
      void writeAuditEvent({
        tenantId, actorId: user.id, actorEmail: user.email ?? null,
        event: 'MFA verification locked out', detail: `${MAX_ATTEMPTS} incorrect codes entered`,
        severity: 'warning', ip: clientIp(req),
      })
    } else {
      await admin.auth.admin.updateUserById(user.id, { app_metadata: { ...app, mfa_challenge: { ...challenge, attempts: attempts + 1 } } })
    }
    return res.status(400).json({
      error: remaining > 0
        ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
        : 'Too many incorrect attempts. Please request a new code.',
    })
  }

  // Single use: the code is cleared and THIS session is marked as verified.
  const { error } = await admin.auth.admin.updateUserById(user.id, { app_metadata: withMfaSession(app, claims.sessionId) })
  if (error) {
    console.error('[verify-mfa] could not record the verified session:', error)
    return res.status(500).json({ error: 'Could not complete verification. Please try again.' })
  }

  void writeAuditEvent({
    tenantId, actorId: user.id, actorEmail: user.email ?? null,
    event: 'MFA verification succeeded', resource: 'Login', severity: 'info', ip: clientIp(req),
  })

  res.json({ ok: true })
}
