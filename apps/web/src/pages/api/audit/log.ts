import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '../../../utils/supabase/server'
import { createAdminClient } from '../../../utils/supabase/admin'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const supabase = createClient({ req, res })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return res.status(401).json({ error: 'Not authenticated' })

  const { action, resource, detail } = req.body || {}
  if (!action || typeof action !== 'string') return res.status(400).json({ error: 'action is required' })

  const entry = {
    action:   String(action).slice(0, 120),
    resource: String(resource ?? '').slice(0, 120),
    detail:   String(detail   ?? '').slice(0, 400),
    ts:       new Date().toISOString(),
  }

  let admin
  try { admin = createAdminClient() } catch { return res.json({ ok: true }) }

  const meta    = (user.user_metadata || {}) as Record<string, unknown>
  const current = Array.isArray(meta._activity_log) ? (meta._activity_log as unknown[]) : []
  // Keep last 100 entries
  const updated = [...current, entry].slice(-100)

  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { ...meta, _activity_log: updated },
  })

  return res.json({ ok: true })
}
