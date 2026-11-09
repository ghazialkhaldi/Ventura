import type { NextApiRequest, NextApiResponse } from 'next'
import { otpSecret, otpMac, newCode, escapeHtml } from '../../../lib/server/otp'
import { rateLimit, limitKey, waitText } from '../../../lib/server/rateLimit'
import { clientIp } from '../../../lib/auditServer'

const CODE_TTL_S = 600 // 10 minutes
// No angle brackets, quotes or ampersands: this address goes into an email.
const EMAIL_REGEX = /^[^\s@<>"'&]{1,64}@[^\s@<>"'&]{1,255}\.[^\s@<>"'&]{2,}$/

// Sends the signup verification code.
//
// The cookie carries a KEYED hash of the code, not a plain one. A plain
// SHA-256 of a six-digit number can be reversed in well under a second by
// whoever holds it, and the holder here is the person asking for the code, so
// that would have made the email check meaningless. Without the server's key
// the cookie tells them nothing.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const raw = req.body?.email
  if (!raw || typeof raw !== 'string' || raw.length > 320) {
    return res.status(400).json({ error: 'Email is required' })
  }
  const email = raw.trim().toLowerCase()
  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' })
  }

  if (!process.env.RESEND_API_KEY) {
    return res.status(503).json({ error: 'Email service is not configured on this server.' })
  }
  const secret = otpSecret()
  if (!secret) return res.status(503).json({ error: 'Email service is not configured on this server.' })

  // This endpoint sends mail from our domain to any address it is given, so it
  // is limited per address (so nobody can flood one inbox) and per caller (so
  // nobody can use it to flood many).
  const ip = clientIp(req) ?? 'unknown'
  const [byEmail, byIp] = await Promise.all([
    rateLimit(limitKey('signup-send-email', email), 3, 600),
    rateLimit(limitKey('signup-send-ip', ip), 10, 3600),
  ])
  if (!byEmail.ok || !byIp.ok) {
    const wait = Math.max(byEmail.retryAfterSec, byIp.retryAfterSec)
    return res.status(429).json({ error: `Too many codes requested. Please wait ${waitText(wait)} and try again.` })
  }

  const code      = newCode()
  const expiresAt = Date.now() + CODE_TTL_S * 1000
  const mac       = otpMac(secret, 'signup', email, code, expiresAt)
  const cookie    = Buffer.from(JSON.stringify({ email, expiresAt, mac })).toString('base64')

  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader('Set-Cookie', `_su_otp=${cookie}; HttpOnly; SameSite=Lax; Path=/api/signup; Max-Age=${CODE_TTL_S}${secure}`)

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0c1526;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0c1526;min-height:100vh;padding:48px 0;">
    <tr><td align="center" style="padding:0 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
        <tr><td style="padding:0 0 40px;">
          <img src="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://venturafinance.net'}/ventura-logo-white.png" alt="Ventura" height="28" style="display:block;height:28px;width:auto;" />
        </td></tr>
        <tr><td style="background:#111d2e;border:1px solid #1e3048;border-radius:12px;overflow:hidden;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="background:linear-gradient(90deg,#10b981,#059669);height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#10b981;text-transform:uppercase;letter-spacing:2px;">Account verification</p>
              <h1 style="margin:0 0 16px;font-size:26px;font-weight:700;color:#f0f6ff;line-height:1.2;letter-spacing:-0.5px;">Verify your email</h1>
              <p style="margin:0 0 36px;font-size:14px;color:#7a93b0;line-height:1.7;">
                Use the code below to verify <strong style="color:#a8c0d8;">${escapeHtml(email)}</strong> and complete your Ventura account setup.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:36px;">
                <tr><td style="background:#0c1526;border:1px solid #1e3048;border-radius:10px;padding:28px 24px;text-align:center;">
                  <p style="margin:0 0 10px;font-size:11px;font-weight:600;color:#4a6580;text-transform:uppercase;letter-spacing:2px;">Verification code</p>
                  <p style="margin:0;font-size:44px;font-weight:700;letter-spacing:16px;color:#f0f6ff;font-family:'Courier New',Courier,monospace;padding-left:16px;">${code}</p>
                  <p style="margin:10px 0 0;font-size:12px;color:#4a6580;">Expires in 10 minutes</p>
                </td></tr>
              </table>
              <p style="margin:0;font-size:13px;color:#4a6580;line-height:1.6;">
                If you didn&rsquo;t create a Ventura account, you can safely ignore this email.
              </p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:28px 0 0;">
          <p style="margin:0;font-size:12px;color:#2a3d5a;">© 2026 Ventura Financial Intelligence, Inc.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const emailRes = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      from:    'Ventura <support@venturafinance.net>',
      to:      email,
      subject: 'Verify your Ventura account',
      html,
    }),
  })

  if (!emailRes.ok) {
    const errText = await emailRes.text()
    console.error('[signup/send-otp] Resend error:', errText)
    return res.status(500).json({ error: 'Failed to send verification email. Please try again.' })
  }

  res.json({ ok: true })
}
