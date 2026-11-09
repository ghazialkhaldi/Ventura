// Server-only. Rate limits that hold across serverless instances.
//
// Counts live in the `rate_limit_events` table (migration 004) so every
// instance sees the same numbers. If the table is not there yet, or the
// database is unreachable, it falls back to counting in memory: that still
// slows a single instance down, but it is per instance, so run migration 004.
import { createHash } from 'crypto'
import { adminClient } from './workspace'
import { slide } from './limits'

export interface LimitResult { ok: boolean; retryAfterSec: number }

const memory = new Map<string, number[]>()

function inMemory(key: string, max: number, windowSec: number): LimitResult {
  const r = slide(memory.get(key) ?? [], Date.now(), windowSec * 1000, max)
  memory.set(key, r.hits)
  if (memory.size > 5000) {
    const floor = Date.now() - 24 * 3600_000
    for (const [k, v] of memory) if (v[v.length - 1] < floor) memory.delete(k)
  }
  return { ok: r.ok, retryAfterSec: r.retryAfterSec }
}

/** Never store raw emails or IPs as keys. */
export function limitKey(scope: string, id: string): string {
  return `${scope}:${createHash('sha256').update(id).digest('hex').slice(0, 32)}`
}

/**
 * Records one attempt for `key` and says whether it is within `max` attempts
 * per `windowSec`. The attempt is recorded first, so parallel requests cannot
 * share the same last slot.
 */
export async function rateLimit(key: string, max: number, windowSec: number): Promise<LimitResult> {
  const db = adminClient()
  if (db) {
    try {
      const ins = await db.from('rate_limit_events').insert({ key })
      if (!ins.error) {
        const since = new Date(Date.now() - windowSec * 1000).toISOString()
        const { data, error } = await db.from('rate_limit_events').select('created_at')
          .eq('key', key).gte('created_at', since).order('created_at', { ascending: true }).limit(max + 1)
        if (!error && data) {
          if (Math.random() < 0.02) void db.from('rate_limit_events').delete().lt('created_at', new Date(Date.now() - 86_400_000).toISOString())
          if (data.length <= max) return { ok: true, retryAfterSec: 0 }
          const oldest = new Date(data[0].created_at).getTime()
          return { ok: false, retryAfterSec: Math.max(1, Math.ceil((oldest + windowSec * 1000 - Date.now()) / 1000)) }
        }
      }
    } catch (e) {
      console.error('[rateLimit] database unavailable, counting in memory:', e)
    }
  }
  return inMemory(key, max, windowSec)
}

/** "Please wait 3 minutes", for an error message. */
export function waitText(sec: number): string {
  const m = Math.max(1, Math.ceil(sec / 60))
  return `${m} minute${m === 1 ? '' : 's'}`
}
