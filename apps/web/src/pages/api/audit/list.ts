import type { NextApiRequest, NextApiResponse } from 'next'
import { createAdminClient } from '../../../utils/supabase/admin'
import { getWorkspace, isAdmin } from '../../../lib/server/workspace'
import type { AuditEventRow } from '../../../lib/auditServer'

// The workspace's security log. It names people and the addresses they signed
// in from, so only the workspace's admin reads it, and only their own.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const ws = await getWorkspace(req, res)
  if (!ws) return res.status(401).json({ error: 'Not authenticated' })
  if (!isAdmin(ws)) return res.status(403).json({ error: 'Only the workspace admin can read the security log.' })

  let admin
  try { admin = createAdminClient() } catch { return res.json({ events: [] }) }

  const { data, error } = await admin
    .from('security_audit_log')
    .select('*')
    .eq('tenant_id', ws.tenantId)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    // Most likely cause: the security_audit_log table hasn't been created
    // yet (supabase/migrations/002_security_audit_log.sql not run). Degrade
    // to an empty list rather than a 500 so the page still renders.
    console.error('[audit/list] query error:', error)
    return res.json({ events: [] as AuditEventRow[] })
  }

  res.json({ events: (data ?? []) as AuditEventRow[] })
}
