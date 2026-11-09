// The counting rule behind rate limits, kept apart from where the counts live
// (the database, or memory when it is unavailable) so it can be tested.

export interface Slide { hits: number[]; ok: boolean; retryAfterSec: number }

/**
 * Records one attempt at `now` and says whether it is within `max` attempts
 * per `windowMs`. The attempt is recorded BEFORE it is judged, so a burst of
 * parallel requests cannot each see room that the others are using up. Refused
 * attempts are recorded too: hammering a locked door keeps it locked.
 */
export function slide(hits: number[], now: number, windowMs: number, max: number): Slide {
  const live = hits.filter(t => t > now - windowMs)
  live.push(now)
  const ok = live.length <= max
  // The attempt that, once it ages out, brings the count back to `max`.
  const frees = live[live.length - 1 - max]
  return { hits: live, ok, retryAfterSec: ok ? 0 : Math.max(1, Math.ceil((frees + windowMs - now) / 1000)) }
}
