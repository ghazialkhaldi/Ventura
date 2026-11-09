import { test } from 'node:test'
import assert from 'node:assert/strict'
import { belongsToTenant } from '../../src/lib/server/tenancy'

const person = (app: Record<string, unknown>, user: Record<string, unknown>) => ({ app_metadata: app, user_metadata: user } as never)

test('a server-pinned membership decides, listed or not', () => {
  assert.equal(belongsToTenant(person({ tenant_id: 'A' }, {}), 'A', false), true)
  assert.equal(belongsToTenant(person({ tenant_id: 'A' }, {}), 'B', true), false)
})

test('a server pin beats whatever the person wrote about themselves', () => {
  const p = person({ tenant_id: 'A' }, { _company: { admin_id: 'B' } })
  assert.equal(belongsToTenant(p, 'B', true), false)
})

test('an admin cannot claim a stranger by listing them', () => {
  // The admin's list is theirs to write. The stranger never joined, so they
  // have no pin and no claim.
  assert.equal(belongsToTenant(person({}, {}), 'ADMIN', true), false)
})

test('an unpinned older member counts only when both sides agree', () => {
  const joined = person({}, { _company: { admin_id: 'ADMIN' } })
  assert.equal(belongsToTenant(joined, 'ADMIN', true), true)
  assert.equal(belongsToTenant(joined, 'ADMIN', false), false)
  assert.equal(belongsToTenant(joined, 'OTHER', true), false)
})

test('missing metadata never throws', () => {
  assert.equal(belongsToTenant({ app_metadata: undefined, user_metadata: undefined } as never, 'A', true), false)
})
