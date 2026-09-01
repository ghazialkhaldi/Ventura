import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '../../../utils/supabase/server'
import { createAdminClient } from '../../../utils/supabase/admin'
import { resolveTenantId, type AuditEventRow } from '../../../lib/auditServer'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const supabase = createClient({ req, res })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return res.status(401).json({ error: 'Not authenticated' })

  const tenantId = resolveTenantId(user)

  let admin
  try { admin = createAdminClient() } catch { return res.json({ events: [] }) }

  const { data, error } = await admin
    .from('security_audit_log')
    .select('*')
    .eq('tenant_id', tenantId)
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
