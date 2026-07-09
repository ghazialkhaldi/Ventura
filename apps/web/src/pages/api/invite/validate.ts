import type { NextApiRequest, NextApiResponse } from 'next'
import { createAdminClient } from '../../../utils/supabase/admin'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const { code } = req.query
  if (typeof code !== 'string') return res.status(400).json({ error: 'code is required' })

  const parts = code.trim().split('.')
  if (parts.length !== 2) return res.status(400).json({ error: 'Invalid invite code format' })

  const [encodedId, token] = parts
  let adminId: string
  try {
    adminId = Buffer.from(encodedId, 'base64').toString('utf8')
  } catch {
    return res.status(400).json({ error: 'Invalid invite code' })
  }

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return res.status(503).json({ error: 'Invite validation is not configured on this server.' })
  }

  const { data } = await admin.auth.admin.getUserById(adminId)
  if (!data?.user) return res.status(404).json({ error: 'Invite code not found' })

  const adminMeta = (data.user.user_metadata || {}) as Record<string, unknown>
  const invite = adminMeta._invite as { token?: string } | undefined
  if (invite?.token !== token) {
    return res.status(400).json({ error: 'This invite link has expired or been regenerated' })
  }

  const email = data.user.email || ''
  const domain = email.split('@')[1] || ''
  const raw = (adminMeta._company_name as string | undefined) ?? domain.split('.')[0]
  const companyName = raw.charAt(0).toUpperCase() + raw.slice(1)

  res.json({ valid: true, company: companyName, adminId })
}
