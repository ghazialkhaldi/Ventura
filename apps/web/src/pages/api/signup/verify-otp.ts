import type { NextApiRequest, NextApiResponse } from 'next'
import { createHash, createHmac, timingSafeEqual } from 'crypto'

const CODE_REGEX  = /^\d{6}$/
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

  const { email: rawEmail, code: rawCode } = req.body || {}

  if (!rawEmail || typeof rawEmail !== 'string') return res.status(400).json({ error: 'Email is required' })
  const email = rawEmail.trim().toLowerCase()
  if (!EMAIL_REGEX.test(email)) return res.status(400).json({ error: 'Invalid email' })

  const code = typeof rawCode === 'string' ? rawCode.trim() : ''
  if (!CODE_REGEX.test(code)) return res.status(400).json({ error: 'Enter a valid 6-digit code' })

  // Read and validate the signed OTP cookie
  const raw = req.cookies['_su_otp']
  if (!raw) return res.status(400).json({ error: 'Session expired. Please start over.' })

  let parsed: { email: string; codeHash: string; expiresAt: number; sig: string }
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'))
  } catch {
    return res.status(400).json({ error: 'Invalid session. Please start over.' })
  }

  // Verify HMAC signature
  const payload     = `${parsed.email}|${parsed.codeHash}|${parsed.expiresAt}`
  const expectedSig = createHmac('sha256', signingSecret()).update(payload).digest('hex')
  const sigBuf      = Buffer.from(parsed.sig ?? '', 'hex')
  const expBuf      = Buffer.from(expectedSig, 'hex')
  const sigOk       = sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf)
  if (!sigOk) return res.status(400).json({ error: 'Invalid session. Please start over.' })

  if (parsed.email !== email) return res.status(400).json({ error: 'Email does not match. Please start over.' })
  if (Date.now() > parsed.expiresAt) return res.status(400).json({ error: 'Code expired. Please request a new one.' })

  // Verify code (timing-safe)
  const inputHash = createHash('sha256').update(code).digest('hex')
  const storedBuf = Buffer.from(parsed.codeHash, 'hex')
  const inputBuf  = Buffer.from(inputHash, 'hex')
  const codeOk    = storedBuf.length === inputBuf.length && timingSafeEqual(storedBuf, inputBuf)
  if (!codeOk) return res.status(400).json({ error: 'Incorrect code. Please try again.' })

  // Clear the OTP cookie
  res.setHeader('Set-Cookie', '_su_otp=; HttpOnly; SameSite=Lax; Path=/api/signup; Max-Age=0')

  res.json({ ok: true })
}
