import type { NextApiRequest, NextApiResponse } from 'next'
import { createHmac } from 'crypto'

const SECRET = process.env.MFA_SECRET ?? 'ventura-mfa-dev-secret'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'Email required' })

  const code = Math.floor(100000 + Math.random() * 900000).toString()
  const exp  = Date.now() + 10 * 60 * 1000
  const payload = `${email}|${code}|${exp}`
  const sig = createHmac('sha256', SECRET).update(payload).digest('base64url')
  const cookieVal = `${Buffer.from(payload).toString('base64url')}.${sig}`

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f4f6f9;padding:40px 0;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
    <div style="background:#0c1526;padding:28px 40px;">
      <p style="margin:0;font-size:18px;font-weight:700;color:#fff;">Ventura</p>
      <p style="margin:4px 0 0;font-size:12px;color:#8ea4c0;text-transform:uppercase;letter-spacing:1px;">Financial Operations</p>
    </div>
    <div style="padding:40px;">
      <h1 style="margin:0 0 24px;font-size:22px;font-weight:700;color:#0c1526;">Confirm your identity</h1>
      <p style="margin:0 0 28px;font-size:15px;color:#4b5563;line-height:1.6;">Use the code below to complete your sign-in. It expires in 10 minutes. Do not share it with anyone.</p>
      <div style="background:#f4f6f9;border:1px solid #e5e7eb;border-radius:6px;padding:24px;text-align:center;margin-bottom:32px;">
        <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">Your code</p>
        <p style="margin:0;font-size:36px;font-weight:700;letter-spacing:10px;color:#0c1526;">${code}</p>
      </div>
      <p style="margin:0;font-size:13px;color:#9ca3af;">Signing in as <strong style="color:#6b7280;">${email}</strong></p>
    </div>
    <div style="border-top:1px solid #f3f4f6;padding:20px 40px;">
      <p style="margin:0;font-size:12px;color:#d1d5db;">© 2026 Ventura Financial Intelligence, Inc.</p>
    </div>
  </div>
</div>`

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Ventura <support@venturafinance.net>',
      to:   email,
      subject: 'Your Ventura verification code',
      html,
    }),
  })

  if (!emailRes.ok) {
    const err = await emailRes.text()
    return res.status(500).json({ error: `Failed to send email: ${err}` })
  }

  res.setHeader('Set-Cookie', `mfa_token=${cookieVal}; HttpOnly; SameSite=Strict; Max-Age=600; Path=/`)
  res.json({ ok: true })
}
