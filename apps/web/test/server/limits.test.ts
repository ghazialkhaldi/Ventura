import { test } from 'node:test'
import assert from 'node:assert/strict'
import { slide } from '../../src/lib/server/limits'

const MIN = 60_000

test('attempts up to the limit pass, the next is refused', () => {
  let hits: number[] = []
  for (let i = 0; i < 3; i++) {
    const r = slide(hits, 1000 + i, 10 * MIN, 3)
    assert.equal(r.ok, true)
    hits = r.hits
  }
  const r = slide(hits, 1003, 10 * MIN, 3)
  assert.equal(r.ok, false)
  assert.ok(r.retryAfterSec > 0)
})

test('it says how long to wait, and the wait is true', () => {
  const hits = [0, 1 * MIN, 2 * MIN]
  const r = slide(hits, 3 * MIN, 10 * MIN, 3)
  assert.equal(r.ok, false)
  // Room opens when the first attempt (at 0) leaves the 10 minute window.
  assert.equal(r.retryAfterSec, 7 * 60)
})

test('old attempts age out', () => {
  const r = slide([0, 1, 2], 11 * MIN, 10 * MIN, 3)
  assert.equal(r.ok, true)
  assert.equal(r.hits.length, 1)
})

test('refused attempts count too, so hammering a locked door keeps it locked', () => {
  let hits = [0, 0, 0]
  for (let t = 1; t <= 5; t++) hits = slide(hits, t * MIN, 10 * MIN, 3).hits
  assert.equal(slide(hits, 6 * MIN, 10 * MIN, 3).ok, false)
})

test('a burst of simultaneous attempts cannot all squeeze through', () => {
  // Each attempt is recorded before it is judged, so however they interleave,
  // exactly `max` are let through.
  let hits: number[] = []
  let allowed = 0
  for (let i = 0; i < 50; i++) {
    const r = slide(hits, 5000, 10 * MIN, 5)
    hits = r.hits
    if (r.ok) allowed++
  }
  assert.equal(allowed, 5)
})
