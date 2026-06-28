import type { NextApiRequest, NextApiResponse } from 'next'
import { createHmac, timingSafeEqual } from 'crypto'

const SECRET = process.env.MFA_SECRET ?? 'ventura-mfa-dev-secret'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { email, code } = req.body
  const cookie = req.cookies.mfa_token

  if (!cookie) return res.status(400).json({ error: 'No pending verification' })

  try {
    const [b64, sig]  = cookie.split('.')
    const payload     = Buffer.from(b64, 'base64url').toString()
    const expectedSig = createHmac('sha256', SECRET).update(payload).digest('base64url')

    const sBuf = Buffer.from(sig)
    const eBuf = Buffer.from(expectedSig)
    if (sBuf.length !== eBuf.length || !timingSafeEqual(sBuf, eBuf)) {
      return res.status(400).json({ error: 'Invalid code' })
    }

    const [storedEmail, storedCode, expStr] = payload.split('|')
    if (storedEmail !== email || storedCode !== code) {
      return res.status(400).json({ error: 'Invalid code' })
    }
    if (Date.now() > parseInt(expStr)) {
      return res.status(400).json({ error: 'Code expired' })
    }

    res.setHeader('Set-Cookie', 'mfa_token=; HttpOnly; Max-Age=0; Path=/')
    res.json({ ok: true })
  } catch {
    res.status(400).json({ error: 'Invalid code' })
  }
}
