// Whether a given user really belongs to a given workspace.
//
// An admin's team list lives in the admin's own `user_metadata`, which the
// admin can write freely, so being named in it proves nothing about the person
// named. Membership is real only when the PERSON side agrees, and the person
// side must be something only the server can write.
import type { User } from '@supabase/supabase-js'

/**
 * `listed` is whether the workspace admin's own team list names `target`.
 *
 * - Pinned by the server (`app_metadata.tenant_id`, written when an invite is
 *   accepted): that decides, listed or not.
 * - Not pinned yet (joined before pinning existed): the member must both be
 *   listed AND say the same workspace themselves. An admin cannot make that
 *   true for someone who never joined.
 */
export function belongsToTenant(target: Pick<User, 'app_metadata' | 'user_metadata'>, tenantId: string, listed: boolean): boolean {
  const pinned = (target.app_metadata ?? {}).tenant_id
  if (typeof pinned === 'string') return pinned === tenantId
  const company = (target.user_metadata ?? {})._company as { admin_id?: unknown } | undefined
  return listed && company?.admin_id === tenantId
}
