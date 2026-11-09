// Server-only. Who is asking, and which workspace's data they may touch.
//
// A user's own `user_metadata` is editable by that user from the browser, so
// it can never decide which workspace's data they reach: anyone could write
// another company's admin id into `_company.admin_id`. Membership is read
// from `app_metadata.tenant_id`, which only the server can write (set when an
// invite is accepted), or else verified against the admin's team list before
// being trusted, then pinned into app_metadata for next time.
//
// EVERY route that reads or writes a workspace's data goes through here.
// Nothing else may work out a tenant from the user's own metadata.
import type { NextApiRequest, NextApiResponse } from 'next'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createAdminClient } from '../../utils/supabase/admin'
import { getSession } from './session'

export type WorkspaceRole = 'admin' | 'editor' | 'analyst' | 'viewer'

export interface Workspace {
  user:       User
  tenantId:   string
  role:       WorkspaceRole
  /** The workspace's display name, as its admin set it. */
  tenantName: string | null
  /** The client that read the session; reuse it to write to the user's own account. */
  supabase:   SupabaseClient
}

interface TeamMember { user_id: string; role?: string }

function nameOf(adminUser: User): string | null {
  const set = (adminUser.user_metadata ?? {})._company_name
  if (typeof set === 'string' && set.trim()) return set.trim()
  const domain = (adminUser.email ?? '').split('@')[1]?.split('.')[0]
  return domain ? domain.charAt(0).toUpperCase() + domain.slice(1) : null
}

/**
 * Works out the workspace for a user whose identity is already established.
 * Does NOT look at MFA: use `getWorkspace` for that.
 */
export async function resolveWorkspace(user: User, supabase: SupabaseClient): Promise<Workspace | null> {
  const app = (user.app_metadata ?? {}) as Record<string, unknown>
  const pinned = typeof app.tenant_id === 'string' ? app.tenant_id : null
  const claimed = ((user.user_metadata ?? {})._company as { admin_id?: string } | undefined)?.admin_id
  const tenantId = pinned ?? claimed ?? user.id

  if (tenantId === user.id) return { user, tenantId, role: 'admin', tenantName: nameOf(user), supabase }

  // A workspace other than the user's own: confirm the admin lists them.
  try {
    const admin = createAdminClient()
    const { data } = await admin.auth.admin.getUserById(tenantId)
    const owner = data?.user
    const members = ((owner?.user_metadata ?? {})._team_members ?? []) as TeamMember[]
    const me = members.find(m => m.user_id === user.id)
    if (!owner || !me) return { user, tenantId: user.id, role: 'admin', tenantName: nameOf(user), supabase } // not a member: only their own workspace
    if (!pinned) await admin.auth.admin.updateUserById(user.id, { app_metadata: { ...app, tenant_id: tenantId } })
    const role = (['editor', 'analyst', 'viewer'] as const).find(r => r === me.role) ?? 'viewer'
    return { user, tenantId, role, tenantName: nameOf(owner), supabase }
  } catch {
    return null // cannot verify membership: refuse rather than guess
  }
}

/**
 * The signed-in user's workspace, or null: signed out, MFA not passed in this
 * session, or membership could not be verified.
 */
export async function getWorkspace(req: NextApiRequest, res: NextApiResponse): Promise<Workspace | null> {
  const s = await getSession(req, res)
  if (!s || !s.mfa) return null
  return resolveWorkspace(s.user, s.supabase)
}

/** Reviewers who may change a finding's status. Viewers read only. */
export const canDecide = (w: Workspace) => w.role !== 'viewer'
/** Only the workspace's owner connects systems, manages the team and changes settings. */
export const isAdmin = (w: Workspace) => w.role === 'admin'

/** True when an error means the table has not been created yet (migration not run). */
export function tableMissing(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return error.code === '42P01' || error.code === 'PGRST205' || /relation .* does not exist|could not find the table/i.test(error.message ?? '')
}

/** The service-role client, or null when the server has no key configured. */
export function adminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) return null
  try { return createAdminClient() } catch { return null }
}
