import type { NextApiRequest, NextApiResponse } from 'next'
import { getWorkspace, isAdmin } from '../../../lib/server/workspace'
import { providerInfo } from '../../../lib/server/providers'
import { listConnections, databaseReady } from '../../../lib/server/connectionStore'

// What can be connected, what is connected, and where data is kept. Never
// returns tokens.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const ws = await getWorkspace(req, res)
  if (!ws) return res.status(401).json({ error: 'Not authenticated' })

  let connections: Awaited<ReturnType<typeof listConnections>> = []
  try { connections = await listConnections(ws.tenantId) } catch (e) { console.error('[integrations/status]', e) }

  res.json({
    admin: isAdmin(ws),
    storage: (await databaseReady()) ? 'database' : 'browser',
    providers: providerInfo().map(p => ({
      id: p.id, name: p.name, kind: p.kind, available: p.missing.length === 0,
      // Only admins are told which server settings are missing.
      missing: isAdmin(ws) ? p.missing : [],
      connections: connections.filter(c => c.provider === p.id).map(c => ({
        id: c.id, accountName: c.accountName, status: c.status, lastSyncedAt: c.lastSyncedAt, lastError: c.lastError, connectedBy: c.connectedByEmail,
      })),
    })),
  })
}
