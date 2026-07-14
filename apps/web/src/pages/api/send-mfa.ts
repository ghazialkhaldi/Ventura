import type { NextApiRequest, NextApiResponse } from 'next'
import { randomInt, createHash } from 'crypto'
import { createClient } from '../../utils/supabase/server'

const CODE_TTL_MS  = 10 * 60 * 1000
const MAX_SENDS    = 5
const WINDOW_MS    = 10 * 60 * 1000

const EMAIL_REGEX = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  // Strict type + format validation — reject anything that isn't a well-formed email string
  const raw = req.body?.email
  if (!raw || typeof raw !== 'string' || raw.length > 320) {
    return res.status(400).json({ error: 'Email required' })
  }
  const email = raw.trim().toLowerCase()
  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' })
  }

  const supabase = createClient({ req, res })

  // Confirm the caller has a live Supabase session (created by signInWithPassword)
  const { data: { user } } = await supabase.auth.getUser()
  // Compare normalized emails to prevent case-based session bypass
  if (!user || user.email?.toLowerCase() !== email) {
    return res.status(401).json({ error: 'Session not found. Please sign in again.' })
  }

  // Rate-limit: track send timestamps in metadata
  const meta       = (user.user_metadata || {}) as Record<string, unknown>
  const sendLog    = Array.isArray(meta._mfa_sends) ? (meta._mfa_sends as number[]) : []
  const windowStart = Date.now() - WINDOW_MS
  const recentSends = sendLog.filter((t: number) => t > windowStart)

  if (recentSends.length >= MAX_SENDS) {
    // Tell the user exactly how long until the oldest send falls out of the window
    const oldestRecent  = Math.min(...recentSends)
    const waitMs        = oldestRecent + WINDOW_MS - Date.now()
    const waitMin       = Math.max(1, Math.ceil(waitMs / 60000))
    return res.status(429).json({
      error: `Too many codes requested. Please wait ${waitMin} minute${waitMin === 1 ? '' : 's'} and try again.`,
    })
  }

  // Cryptographically secure code + SHA-256 hash (never store plaintext)
  const code      = randomInt(100000, 1000000).toString()
  const codeHash  = createHash('sha256').update(code).digest('hex')
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString()

  // Store hash + expiry + attempt counter in user metadata
  const { error: updateErr } = await supabase.auth.updateUser({
    data: {
      _mfa_hash:     codeHash,
      _mfa_exp:      expiresAt,
      _mfa_attempts: 0,
      _mfa_sends:    [...recentSends, Date.now()],
    },
  })

  if (updateErr) {
    console.error('updateUser error:', updateErr)
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
                    Someone is signing in to Ventura as <strong style="color:#a8c0d8;">${email}</strong>. Use the code below to confirm it&rsquo;s you.
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
    const err = await emailRes.text()
    console.error('Resend error:', err)
    // Clear the stored code so it can't be guessed
    await supabase.auth.updateUser({ data: { _mfa_hash: null, _mfa_exp: null } })
    return res.status(500).json({ error: 'Failed to send verification email. Please try again.' })
  }

  res.json({ ok: true })
}
