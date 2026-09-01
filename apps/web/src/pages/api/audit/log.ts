import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '../../../utils/supabase/server'
import { createAdminClient } from '../../../utils/supabase/admin'
import { writeAuditEvent, resolveTenantId, clientIp } from '../../../lib/auditServer'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const supabase = createClient({ req, res })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return res.status(401).json({ error: 'Not authenticated' })

  const { action, resource, detail } = req.body || {}
  if (!action || typeof action !== 'string') return res.status(400).json({ error: 'action is required' })

  // Real, append-only trail (see supabase/migrations/002_security_audit_log.sql).
  // This is the source of truth shown on /audit-logs; the fire-and-forget
  // write never blocks the response.
  void writeAuditEvent({
    tenantId:    resolveTenantId(user),
    actorId:     user.id,
    actorEmail:  user.email ?? null,
    event:       String(action),
    resource:    String(resource ?? ''),
    detail:      String(detail ?? ''),
    ip:          clientIp(req),
  })

  const entry = {
    action:   String(action).slice(0, 120),
    resource: String(resource ?? '').slice(0, 120),
    detail:   String(detail   ?? '').slice(0, 400),
    ts:       new Date().toISOString(),
  }

  let admin
  try { admin = createAdminClient() } catch { return res.json({ ok: true }) }

  // Legacy per-user activity mirror — kept only for /api/audit/my-log, which
  // still reads _activity_log. Not the audit-of-record; see writeAuditEvent
  // above for that.
  const meta    = (user.user_metadata || {}) as Record<string, unknown>
  const current = Array.isArray(meta._activity_log) ? (meta._activity_log as unknown[]) : []
  const updated = [...current, entry].slice(-100)

  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { ...meta, _activity_log: updated },
  })

  return res.json({ ok: true })
}
