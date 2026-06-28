import type { NextApiRequest, NextApiResponse } from 'next'
import { randomInt, createHash } from 'crypto'
import { createAdminClient } from '../../utils/supabase/admin'

const MAX_SENDS_PER_WINDOW = 3
const SEND_WINDOW_MS       = 10 * 60 * 1000
const CODE_TTL_MS          = 10 * 60 * 1000

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { email } = req.body
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email required' })
  }

  const supabase    = createAdminClient()
  const windowStart = new Date(Date.now() - SEND_WINDOW_MS).toISOString()

  // Rate limit: max 3 sends per 10 minutes per email
  const { count } = await supabase
    .from('mfa_challenges')
    .select('id', { count: 'exact', head: true })
    .eq('email', email)
    .gte('created_at', windowStart)

  if ((count ?? 0) >= MAX_SENDS_PER_WINDOW) {
    return res.status(429).json({ error: 'Too many codes requested. Please wait a few minutes before trying again.' })
  }

  // Invalidate all existing unused codes for this email
  await supabase
    .from('mfa_challenges')
    .update({ used: true })
    .eq('email', email)
    .eq('used', false)

  // Cryptographically secure 6-digit code (crypto.randomInt, not Math.random)
  const code      = randomInt(100000, 1000000).toString()
  const codeHash  = createHash('sha256').update(code).digest('hex')
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString()

  const { error: insertError } = await supabase
    .from('mfa_challenges')
    .insert({ email, code_hash: codeHash, expires_at: expiresAt })

  if (insertError) {
    console.error('mfa_challenges insert error:', insertError)
    return res.status(500).json({ error: 'Failed to create verification challenge' })
  }

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0c1526;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0c1526;min-height:100vh;padding:48px 0;">
    <tr><td align="center" style="padding:0 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">

        <!-- Logo -->
        <tr>
          <td style="padding:0 0 40px;">
            <p style="margin:0;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Ventura</p>
          </td>
        </tr>

        <!-- Main card -->
        <tr>
          <td style="background:#111d2e;border:1px solid #1e3048;border-radius:12px;overflow:hidden;">

            <!-- Top accent bar -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:linear-gradient(90deg,#10b981,#059669);height:3px;font-size:0;line-height:0;">&nbsp;</td>
              </tr>
            </table>

            <!-- Card body -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:40px 40px 32px;">

                  <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#10b981;text-transform:uppercase;letter-spacing:2px;">Identity verification</p>
                  <h1 style="margin:0 0 16px;font-size:26px;font-weight:700;color:#f0f6ff;line-height:1.2;letter-spacing:-0.5px;">Your sign-in code</h1>
                  <p style="margin:0 0 36px;font-size:14px;color:#7a93b0;line-height:1.7;">
                    Someone is signing in to Ventura as <strong style="color:#a8c0d8;">${email}</strong>. Use the code below to confirm it&rsquo;s you.
                  </p>

                  <!-- Code block -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:36px;">
                    <tr>
                      <td style="background:#0c1526;border:1px solid #1e3048;border-radius:10px;padding:28px 24px;text-align:center;">
                        <p style="margin:0 0 10px;font-size:11px;font-weight:600;color:#4a6580;text-transform:uppercase;letter-spacing:2px;">One-time code</p>
                        <p style="margin:0;font-size:44px;font-weight:700;letter-spacing:16px;color:#f0f6ff;font-family:'Courier New',Courier,monospace;padding-left:16px;">${code}</p>
                        <p style="margin:10px 0 0;font-size:12px;color:#4a6580;">Expires in 10 minutes</p>
                      </td>
                    </tr>
                  </table>

                  <!-- Divider -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                    <tr><td style="border-top:1px solid #1e3048;font-size:0;">&nbsp;</td></tr>
                  </table>

                  <p style="margin:0;font-size:13px;color:#4a6580;line-height:1.6;">
                    If you didn&rsquo;t try to sign in, ignore this email — your account is still secure.
                    Never share this code with anyone.
                  </p>

                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Footer -->
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
      subject: 'Your Ventura verification code',
      html,
    }),
  })

  if (!emailRes.ok) {
    // Roll back — no point keeping a code the user never received
    await supabase.from('mfa_challenges').update({ used: true }).eq('code_hash', codeHash)
    const err = await emailRes.text()
    console.error('Resend error:', err)
    return res.status(500).json({ error: 'Failed to send verification email. Please try again.' })
  }

  res.json({ ok: true })
}
