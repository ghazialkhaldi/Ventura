import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '../../../utils/supabase/server'
import { createAdminClient } from '../../../utils/supabase/admin'

interface TeamMember {
  user_id: string
  email: string
  name: string
  role: string
  joined_at: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { code } = req.body || {}
  if (!code || typeof code !== 'string') return res.status(400).json({ error: 'code is required' })

  // Decode admin ID from invite code
  const parts = code.trim().split('.')
  if (parts.length !== 2) return res.status(400).json({ error: 'Invalid invite code format' })
  const [encodedId, token] = parts

  let adminId: string
  try {
    adminId = Buffer.from(encodedId, 'base64').toString('utf8')
  } catch {
    return res.status(400).json({ error: 'Invalid invite code' })
  }

  // Verify employee is authenticated
  const supabase = createClient({ req, res })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return res.status(401).json({ error: 'Not authenticated' })

  // Prevent admin joining their own workspace
  if (user.id === adminId) {
    return res.status(400).json({ error: 'You are the admin of this workspace' })
  }

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return res.status(503).json({ error: 'Invite join is not configured on this server.' })
  }

  // Validate invite token against admin's stored token
  const { data: adminData } = await admin.auth.admin.getUserById(adminId)
  if (!adminData?.user) return res.status(404).json({ error: 'Invite code not found' })

  const adminMeta = (adminData.user.user_metadata || {}) as Record<string, unknown>
  const invite = adminMeta._invite as { token?: string } | undefined
  if (invite?.token !== token) {
    return res.status(400).json({ error: 'This invite link has expired or been regenerated' })
  }

  // Derive company name
  const email = adminData.user.email || ''
  const domain = email.split('@')[1] || ''
  const raw = (adminMeta._company_name as string | undefined) ?? domain.split('.')[0]
  const companyName = raw.charAt(0).toUpperCase() + raw.slice(1)

  // Add employee to admin's _team_members (skip if already a member)
  const existing = ((adminMeta._team_members ?? []) as TeamMember[])
  const alreadyMember = existing.some(m => m.user_id === user.id)

  if (!alreadyMember) {
    const empMeta = user.user_metadata || {}
    const fullName = [empMeta.first_name, empMeta.last_name].filter(Boolean).join(' ') || user.email || user.id

    const newMember: TeamMember = {
      user_id:   user.id,
      email:     user.email ?? '',
      name:      fullName,
      role:      'viewer',
      joined_at: new Date().toISOString(),
    }

    const updatedMembers = [...existing, newMember]
    const { error: adminUpdateErr } = await admin.auth.admin.updateUserById(adminId, {
      user_metadata: { ...adminMeta, _team_members: updatedMembers },
    })
    if (adminUpdateErr) return res.status(500).json({ error: 'Failed to join workspace' })
  }

  // Store company reference in employee's own metadata
  const empMeta = user.user_metadata || {}
  await supabase.auth.updateUser({
    data: { ...empMeta, _company: { admin_id: adminId, company_name: companyName, role: 'viewer', joined_at: new Date().toISOString() } },
  })

  res.json({ ok: true, company: companyName })
}
