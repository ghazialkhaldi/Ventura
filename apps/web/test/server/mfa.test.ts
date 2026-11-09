import { test } from 'node:test'
import assert from 'node:assert/strict'
import { claimsFromToken, mfaPassed, hasVerifiedTotp, withMfaSession } from '../../src/lib/server/mfa'

const jwt = (claims: Record<string, unknown>) =>
  ['x', Buffer.from(JSON.stringify(claims)).toString('base64url'), 'y'].join('.')

const user = (app: Record<string, unknown> = {}, factors: unknown[] = []) =>
  ({ app_metadata: app, factors } as never)

test('claims are read from the token, and garbage reads as nothing', () => {
  assert.deepEqual(claimsFromToken(jwt({ session_id: 's1', aal: 'aal1' })), { sessionId: 's1', aal: 'aal1' })
  assert.deepEqual(claimsFromToken(undefined), { sessionId: null, aal: null })
  assert.deepEqual(claimsFromToken('not-a-token'), { sessionId: null, aal: null })
  assert.deepEqual(claimsFromToken('a.%%%.c'), { sessionId: null, aal: null })
  assert.deepEqual(claimsFromToken(jwt({ session_id: 7, aal: {} })), { sessionId: null, aal: null })
})

test('a password-only session has not passed MFA', () => {
  assert.equal(mfaPassed(user(), { sessionId: 's1', aal: 'aal1' }), false)
})

test('an emailed code passes THIS session only', () => {
  const u = user({ mfa_sessions: ['s1'] })
  assert.equal(mfaPassed(u, { sessionId: 's1', aal: 'aal1' }), true)
  // Signing in again is a new session, and it must pass the code again.
  assert.equal(mfaPassed(u, { sessionId: 's2', aal: 'aal1' }), false)
  assert.equal(mfaPassed(u, { sessionId: null, aal: 'aal1' }), false)
})

test('an authenticator session passes at aal2', () => {
  assert.equal(mfaPassed(user(), { sessionId: 's1', aal: 'aal2' }), true)
})

test('an emailed code can never stand in for an enrolled authenticator', () => {
  const totp = [{ factor_type: 'totp', status: 'verified' }]
  assert.equal(hasVerifiedTotp(user({}, totp)), true)
  assert.equal(hasVerifiedTotp(user({}, [{ factor_type: 'totp', status: 'unverified' }])), false)
  assert.equal(mfaPassed(user({ mfa_sessions: ['s1'] }, totp), { sessionId: 's1', aal: 'aal1' }), false)
  assert.equal(mfaPassed(user({ mfa_sessions: ['s1'] }, totp), { sessionId: 's1', aal: 'aal2' }), true)
})

test('recording a session keeps the others, drops duplicates, caps the list, clears the challenge', () => {
  const a = withMfaSession({ tenant_id: 't', mfa_challenge: { mac: 'x' }, mfa_sessions: ['s1', 's2'] }, 's2')
  assert.deepEqual(a.mfa_sessions, ['s1', 's2'])
  assert.equal(a.mfa_challenge, null)
  assert.equal(a.tenant_id, 't')
  const many = Array.from({ length: 10 }, (_, i) => `old${i}`)
  const b = withMfaSession({ mfa_sessions: many }, 'new')
  assert.equal((b.mfa_sessions as string[]).length, 10)
  assert.equal((b.mfa_sessions as string[]).at(-1), 'new')
  assert.ok(!(b.mfa_sessions as string[]).includes('old0'))
  assert.deepEqual(withMfaSession(null, 's').mfa_sessions, ['s'])
})
