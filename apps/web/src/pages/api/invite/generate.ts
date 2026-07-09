import type { NextApiRequest, NextApiResponse } from 'next'
import { randomBytes } from 'crypto'
import { createClient } from '../../../utils/supabase/server'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const supabase = createClient({ req, res })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return res.status(401).json({ error: 'Not authenticated' })

  const token = randomBytes(16).toString('hex')
  const meta = user.user_metadata || {}

  const { error } = await supabase.auth.updateUser({
    data: { ...meta, _invite: { token, created_at: new Date().toISOString() } },
  })
  if (error) return res.status(500).json({ error: 'Failed to generate invite' })

  // Encode admin ID so employees can submit code without a DB lookup
  const encodedId = Buffer.from(user.id).toString('base64')
  const code = `${encodedId}.${token}`

  res.json({ code })
}
