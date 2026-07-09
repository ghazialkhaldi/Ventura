import type { NextApiRequest, NextApiResponse } from 'next'
import { createAdminClient } from '../../../utils/supabase/admin'

const EMAIL_REGEX = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/
const PW_UPPER    = /[A-Z]/
const PW_SPECIAL  = /[^A-Za-z0-9]/

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { email: rawEmail, password, firstName, lastName } = req.body || {}

  if (!rawEmail || typeof rawEmail !== 'string') return res.status(400).json({ error: 'Email is required' })
  const email = rawEmail.trim().toLowerCase()
  if (!EMAIL_REGEX.test(email)) return res.status(400).json({ error: 'Invalid email address' })

  if (!password || typeof password !== 'string' || password.length < 8 || !PW_UPPER.test(password) || !PW_SPECIAL.test(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters with one uppercase letter and one special character.' })
  }

  const first = typeof firstName === 'string' ? firstName.trim() : ''
  const last  = typeof lastName  === 'string' ? lastName.trim()  : ''
  if (!first) return res.status(400).json({ error: 'First name is required' })
  if (!last)  return res.status(400).json({ error: 'Last name is required' })

  let admin
  try { admin = createAdminClient() } catch {
    return res.status(503).json({ error: 'Account service not configured.' })
  }

  // Check for duplicate
  const { data: list } = await admin.auth.admin.listUsers()
  if (list?.users?.some(u => u.email?.toLowerCase() === email)) {
    return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' })
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: first, last_name: last },
  })

  if (createErr || !created?.user) {
    console.error('[signup/create] createUser error:', createErr)
    return res.status(500).json({ error: 'Failed to create account. Please try again.' })
  }

  res.json({ ok: true })
}
