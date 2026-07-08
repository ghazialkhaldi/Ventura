import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '../../../utils/supabase/server'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const supabase = createClient({ req, res })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return res.status(401).json({ error: 'Not authenticated' })

  const meta        = (user.user_metadata || {}) as Record<string, unknown>
  const connections = (meta._connections as Record<string, Record<string, string>>) || {}

  // Return only safe metadata — never encrypted blobs or raw credential values
  const result = Object.entries(connections).map(([provider, data]) => ({
    provider,
    connected_at: data.connected_at ?? null,
    expires_at:   data.expires_at   ?? null,
  }))

  res.json({ connections: result })
}
