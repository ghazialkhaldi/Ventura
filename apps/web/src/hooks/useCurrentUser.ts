import { useState, useEffect } from 'react'
import { forgetWorkspaceData } from '../lib/dataStore'

export interface CurrentUser {
  email: string
  name: string
  company: string
  role: string
}

export function useCurrentUser(): CurrentUser | null {
  const [user, setUser] = useState<CurrentUser | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('sf_user')
      if (raw) setUser(JSON.parse(raw))
    } catch {}
  }, [])

  return user
}

export function saveUser(user: CurrentUser): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('sf_user', JSON.stringify(user))
  }
}

export function clearUser(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('sf_user')
    localStorage.removeItem('sf_token')
    forgetWorkspaceData()
  }
}

/** Returns display initials (max 2 chars) from a name or email. */
export function initials(nameOrEmail: string): string {
  const parts = nameOrEmail
    .split('@')[0]
    .replace(/[._-]/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return parts[0]?.slice(0, 2).toUpperCase() ?? '??'
}
