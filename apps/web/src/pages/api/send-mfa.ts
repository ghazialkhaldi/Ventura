import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession } from '../../lib/server/session'
import { hasVerifiedTotp } from '../../lib/server/mfa'
import { adminClient } from '../../lib/server/workspace'
import { otpSecret, otpMac, newCode, escapeHtml } from '../../lib/server/otp'
import { rateLimit, limitKey, waitText } from '../../lib/server/rateLimit'
import { clientIp } from '../../lib/auditServer'

const CODE_TTL_MS = 10 * 60 * 1000

// Sends the emailed sign-in code.
//
// The person is already signed in with their password; this is the second
// factor. The code's state lives in `app_metadata`, which only the server can
// write, never in `user_metadata`, which the user can edit from the browser
// (that would let them reset their own attempt counters or plant a code they
// know). The code is kept only as a keyed hash.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  // A live session made by signInWithPassword. The code goes to THAT account's
  // email, whatever the request body says.
  const session = await getSession(req, res)
  if (!session) return res.status(401).json({ error: 'Session not found. Please sign in again.' })
  const { user } = session
  const email = user.email?.toLowerCase()
  if (!email) return res.status(401).json({ error: 'Session not found. Please sign in again.' })

  if (hasVerifiedTotp(user)) {
    return res.status(400).json({ error: 'This account uses an authenticator app. Enter the code from the app.' })
  }

  // Fail fast and clearly if the server is not set up to send or sign codes.
  if (!process.env.RESEND_API_KEY) {
    return res.status(503).json({ error: 'Email verification is not configured on this server. Set RESEND_API_KEY.' })
  }
  const secret = otpSecret()
  const admin  = adminClient()
  if (!secret || !admin) {
    return res.status(503).json({ error: 'Email verification is not configured on this server.' })
  }

  // Per account and per address, counted in the database so every serverless
  // instance sees the same numbers.
  const ip = clientIp(req) ?? 'unknown'
  const [byUser, byIp] = await Promise.all([
    rateLimit(limitKey('mfa-send-user', user.id), 5, 600),
    rateLimit(limitKey('mfa-send-ip', ip), 20, 3600),
  ])
  if (!byUser.ok || !byIp.ok) {
    const wait = Math.max(byUser.retryAfterSec, byIp.retryAfterSec)
    return res.status(429).json({ error: `Too many codes requested. Please wait ${waitText(wait)} and try again.` })
  }

  const code      = newCode()
  const expiresAt = Date.now() + CODE_TTL_MS
  const app       = (user.app_metadata ?? {}) as Record<string, unknown>

  const { error: updateErr } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { ...app, mfa_challenge: { mac: otpMac(secret, 'mfa', user.id, code, expiresAt), exp: expiresAt, attempts: 0 } },
  })
  if (updateErr) {
    console.error('[send-mfa] could not store the challenge:', updateErr)
    return res.status(500).json({ error: 'Failed to create verification code. Please try again.' })
  }

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0c1526;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0c1526;min-height:100vh;padding:48px 0;">
    <tr><td align="center" style="padding:0 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
        <tr>
          <td style="padding:0 0 40px;">
            <img src="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://venturafinance.net'}/ventura-logo-white.png" alt="Ventura" height="28" style="display:block;height:28px;width:auto;" />
          </td>
        </tr>
        <tr>
          <td style="background:#111d2e;border:1px solid #1e3048;border-radius:12px;overflow:hidden;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:linear-gradient(90deg,#10b981,#059669);height:3px;font-size:0;line-height:0;">&nbsp;</td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:40px 40px 32px;">
                  <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#10b981;text-transform:uppercase;letter-spacing:2px;">Identity verification</p>
                  <h1 style="margin:0 0 16px;font-size:26px;font-weight:700;color:#f0f6ff;line-height:1.2;letter-spacing:-0.5px;">Your sign-in code</h1>
                  <p style="margin:0 0 36px;font-size:14px;color:#7a93b0;line-height:1.7;">
                    Someone is signing in to Ventura as <strong style="color:#a8c0d8;">${escapeHtml(email)}</strong>. Use the code below to confirm it&rsquo;s you.
                  </p>
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:36px;">
                    <tr>
                      <td style="background:#0c1526;border:1px solid #1e3048;border-radius:10px;padding:28px 24px;text-align:center;">
                        <p style="margin:0 0 10px;font-size:11px;font-weight:600;color:#4a6580;text-transform:uppercase;letter-spacing:2px;">One-time code</p>
                        <p style="margin:0;font-size:44px;font-weight:700;letter-spacing:16px;color:#f0f6ff;font-family:'Courier New',Courier,monospace;padding-left:16px;">${code}</p>
                        <p style="margin:10px 0 0;font-size:12px;color:#4a6580;">Expires in 10 minutes</p>
                      </td>
                    </tr>
                  </table>
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                    <tr><td style="border-top:1px solid #1e3048;font-size:0;">&nbsp;</td></tr>
                  </table>
                  <p style="margin:0;font-size:13px;color:#4a6580;line-height:1.6;">
                    If you didn&rsquo;t try to sign in, ignore this email &mdash; your account is still secure.
                    Never share this code with anyone.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 0 0;">
            <p style="margin:0;font-size:12px;color:#2a3d5a;">© 2026 Ventura Financial Intelligence, Inc. &nbsp;·&nbsp; All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    'Ventura <support@venturafinance.net>',
      to:      email,
      subject: 'Your Ventura sign-in code',
      html,
    }),
  })

  if (!emailRes.ok) {
    console.error('[send-mfa] Resend error:', await emailRes.text())
    // Clear the stored code so it can't be guessed
    await admin.auth.admin.updateUserById(user.id, { app_metadata: { ...app, mfa_challenge: null } })
    return res.status(500).json({ error: 'Failed to send verification email. Please try again.' })
  }

  res.json({ ok: true })
}
