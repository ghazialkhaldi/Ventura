import type { NextApiRequest, NextApiResponse } from 'next'
import { randomInt, createHash, createHmac } from 'crypto'

const CODE_TTL_S = 600 // 10 minutes
const EMAIL_REGEX = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/

function signingSecret() {
  return (
    process.env.TOKEN_ENCRYPTION_KEY?.slice(0, 32) ||
    process.env.RESEND_API_KEY?.slice(0, 32) ||
    'ventura-signup-dev-secret'
  )
}

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

  const code      = randomInt(100000, 1000000).toString()
  const codeHash  = createHash('sha256').update(code).digest('hex')
  const expiresAt = Date.now() + CODE_TTL_S * 1000

  // Sign the cookie payload to prevent client-side forgery
  const payload = `${email}|${codeHash}|${expiresAt}`
  const sig     = createHmac('sha256', signingSecret()).update(payload).digest('hex')
  const cookie  = Buffer.from(JSON.stringify({ email, codeHash, expiresAt, sig })).toString('base64')

  res.setHeader('Set-Cookie', `_su_otp=${cookie}; HttpOnly; SameSite=Lax; Path=/api/signup; Max-Age=${CODE_TTL_S}`)

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0c1526;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0c1526;min-height:100vh;padding:48px 0;">
    <tr><td align="center" style="padding:0 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
        <tr><td style="padding:0 0 40px;">
          <p style="margin:0;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Ventura</p>
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
                Use the code below to verify <strong style="color:#a8c0d8;">${email}</strong> and complete your Ventura account setup.
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
