import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '../../../utils/supabase/server'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const supabase = createClient({ req, res })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return res.status(401).json({ error: 'Not authenticated' })

  const meta    = (user.user_metadata || {}) as Record<string, unknown>
  const company = meta._company as Record<string, string> | undefined
  if (!company?.admin_id) return res.status(404).json({ error: 'Not in a workspace' })

  return res.json({
    role:      company.role     ?? 'viewer',
    company:   company.company_name ?? '',
    adminId:   company.admin_id,
    joinedAt:  company.joined_at ?? null,
  })
}
