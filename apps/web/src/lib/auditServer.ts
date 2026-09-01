// Server-only. Writes to the real, append-only security_audit_log table
// (see supabase/migrations/002_security_audit_log.sql). Import this only
// from API routes — it uses the service-role key and must never reach the
// browser bundle.
import { createAdminClient } from '../utils/supabase/admin'

export type AuditSeverity = 'info' | 'warning' | 'critical'

export interface AuditWriteInput {
  tenantId: string
  actorId?: string | null
  actorEmail?: string | null
  event: string
  resource?: string
  detail?: string
  severity?: AuditSeverity
  ip?: string | null
}

export interface AuditEventRow {
  id: string
  tenant_id: string
  actor_id: string | null
  actor_email: string | null
  event: string
  resource: string | null
  detail: string | null
  severity: AuditSeverity
  ip_address: string | null
  created_at: string
}

/**
 * Appends one row to the real audit trail. Never throws — a logging failure
 * must not block the action being logged (approving an anomaly, joining a
 * workspace, etc.); it's reported to the server console instead so it's
 * still visible in deploy logs.
 */
export async function writeAuditEvent(input: AuditWriteInput): Promise<void> {
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('security_audit_log').insert({
      tenant_id:   input.tenantId,
      actor_id:    input.actorId ?? null,
      actor_email: input.actorEmail ?? null,
      event:       input.event.slice(0, 120),
      resource:    (input.resource ?? '').slice(0, 160) || null,
      detail:      (input.detail ?? '').slice(0, 500) || null,
      severity:    input.severity ?? 'info',
      ip_address:  input.ip ?? null,
    })
    if (error) console.error('[auditServer] insert failed:', error)
  } catch (e) {
    // Table not migrated yet, or SUPABASE_SERVICE_ROLE_KEY not configured —
    // degrade quietly rather than breaking the caller's real action.
    console.error('[auditServer] failed to write audit event:', e)
  }
}

/**
 * Resolves the tenant id for an authenticated user: admins are the root of
 * their own tenant; employees inherit the admin they joined via
 * `_company.admin_id` (set in api/invite/join.ts). Matches the tenancy
 * model the rest of the app already uses for team/invite/connections data.
 */
export function resolveTenantId(user: { id: string; user_metadata?: Record<string, unknown> | null }): string {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const company = meta._company as Record<string, string> | undefined
  return company?.admin_id || user.id
}

export function clientIp(req: { headers: Record<string, string | string[] | undefined> }): string | null {
  const fwd = req.headers['x-forwarded-for']
  if (typeof fwd === 'string' && fwd.trim()) return fwd.split(',')[0].trim()
  if (Array.isArray(fwd) && fwd.length) return fwd[0]
  return null
}
