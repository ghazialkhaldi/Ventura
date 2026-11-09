import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'crypto'
import { otpSecret, otpMac, macMatches, newCode, escapeHtml, CODE_REGEX } from '../../src/lib/server/otp'

const secret = otpSecret({ TOKEN_ENCRYPTION_KEY: 'test-key-aaaaaaaaaaaaaaaaaaaaaaaaaaaa' })!

test('there is no hardcoded fallback secret', () => {
  assert.equal(otpSecret({}), null)
  assert.notEqual(otpSecret({ SUPABASE_SERVICE_ROLE_KEY: 'k' }), null)
  assert.notDeepEqual(otpSecret({ TOKEN_ENCRYPTION_KEY: 'a' }), otpSecret({ TOKEN_ENCRYPTION_KEY: 'b' }))
})

test('codes are six digits', () => {
  for (let i = 0; i < 200; i++) assert.match(newCode(), CODE_REGEX)
})

test('the right code matches and a wrong one does not', () => {
  const exp = Date.now() + 1000
  const mac = otpMac(secret, 'signup', 'a@b.co', '123456', exp)
  assert.equal(macMatches(otpMac(secret, 'signup', 'a@b.co', '123456', exp), mac), true)
  assert.equal(macMatches(otpMac(secret, 'signup', 'a@b.co', '123457', exp), mac), false)
})

test('a code is bound to its purpose, its person and its expiry', () => {
  const exp = 1000
  const mac = otpMac(secret, 'mfa', 'user-1', '123456', exp)
  assert.equal(macMatches(otpMac(secret, 'signup', 'user-1', '123456', exp), mac), false)
  assert.equal(macMatches(otpMac(secret, 'mfa', 'user-2', '123456', exp), mac), false)
  assert.equal(macMatches(otpMac(secret, 'mfa', 'user-1', '123456', exp + 1), mac), false)
})

test('the stored value cannot be reversed by trying every six-digit code', () => {
  // What the signup cookie used to hold was sha256(code). Anyone holding it
  // recovers the code in one pass over a million numbers. With a keyed hash the
  // same pass finds nothing.
  const exp = Date.now() + 1000
  const code = '482913'
  const old = createHash('sha256').update(code).digest('hex')
  const keyed = otpMac(secret, 'signup', 'a@b.co', code, exp)
  let foundOld: string | null = null, foundKeyed: string | null = null
  for (let n = 100000; n < 1000000; n++) {
    const c = String(n)
    if (!foundOld && createHash('sha256').update(c).digest('hex') === old) foundOld = c
    if (!foundKeyed && createHash('sha256').update(c).digest('hex') === keyed) foundKeyed = c
  }
  assert.equal(foundOld, code, 'the old scheme really was reversible')
  assert.equal(foundKeyed, null, 'the keyed scheme is not')
})

test('malformed values never match and never throw', () => {
  assert.equal(macMatches(undefined, 'aa'), false)
  assert.equal(macMatches('zz', 'zz'), false)
  assert.equal(macMatches('', ''), false)
  assert.equal(macMatches('aa', 'aabb'), false)
})

test('text going into an email is escaped', () => {
  assert.equal(escapeHtml(`<a href="x">&'</a>`), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;')
})
