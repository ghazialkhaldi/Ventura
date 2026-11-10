import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reconcileFindings } from '../../src/lib/server/workspaceData'

test('a re-run removes only findings nobody has touched', () => {
  const held = [
    { id: 'a', status: 'Open' }, { id: 'b', status: 'Resolved' }, { id: 'c', status: 'Dismissed' },
    { id: 'd', status: 'Under Review' }, { id: 'e', status: 'Open' },
  ]
  assert.deepEqual(reconcileFindings(held, new Set(['e'])), { remove: ['a'], keep: ['b', 'c', 'd'] })
})

test('findings the new run raises again are left alone, decided or not', () => {
  assert.deepEqual(reconcileFindings([{ id: 'a', status: 'Resolved' }, { id: 'b', status: 'Open' }], new Set(['a', 'b'])), { remove: [], keep: [] })
})
