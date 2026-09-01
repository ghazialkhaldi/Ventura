import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '../../../utils/supabase/server'
import { createAdminClient } from '../../../utils/supabase/admin'
import { writeAuditEvent, resolveTenantId, clientIp } from '../../../lib/auditServer'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') return res.status(405).end()

  const supabase = createClient({ req, res })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return res.status(401).json({ error: 'Not authenticated' })

  const { userId, role } = req.body || {}
  if (!userId || !role) return res.status(400).json({ error: 'userId and role are required' })

  const validRoles = ['admin', 'editor', 'analyst', 'viewer']
  if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' })

  // Update admin's _team_members
  const meta    = (user.user_metadata || {}) as Record<string, unknown>
  const members = ((meta._team_members ?? []) as Array<{ user_id: string; role: string }>).map(m =>
    m.user_id === userId ? { ...m, role } : m
  )

  const { error } = await supabase.auth.updateUser({
    data: { ...meta, _team_members: members },
  })
  if (error) return res.status(500).json({ error: 'Failed to update role' })

  // Also update the employee's own _company.role so they get the live change
  try {
    const admin = createAdminClient()
    const { data: emp } = await admin.auth.admin.getUserById(userId)
    if (emp?.user) {
      const empMeta    = (emp.user.user_metadata || {}) as Record<string, unknown>
      const company    = (empMeta._company as Record<string, string> | undefined) ?? {}
      await admin.auth.admin.updateUserById(userId, {
        user_metadata: { ...empMeta, _company: { ...company, role } },
      })
    }
  } catch {
    // Non-fatal: admin client may not be available; employee will see role on next full reload
  }

  void writeAuditEvent({
    tenantId: resolveTenantId(user), actorId: user.id, actorEmail: user.email ?? null,
    event: 'Team member role changed', resource: userId, detail: `New role: ${role}`,
    severity: 'warning', ip: clientIp(req),
  })

  res.json({ ok: true })
}
