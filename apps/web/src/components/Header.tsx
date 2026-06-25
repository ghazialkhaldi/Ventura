import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function Header(){
  const [user, setUser] = useState<{email:string}|null>(null)
  useEffect(()=>{
    const t = localStorage.getItem('sf_token')
    if (!t) return setUser(null)
    const p = localStorage.getItem('sf_user')
    if (p) setUser(JSON.parse(p))
  },[])

  return (
    <header className="header">
      <div className="container flex items-center justify-between">
        <div className="brand">SecureFlow</div>
        <nav className="flex gap-4 items-center">
          <Link href="/">Home</Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/uploads">Uploads</Link>
          {user ? <span className="text-sm">{user.email}</span> : <Link href="/login">Sign in</Link>}
        </nav>
      </div>
    </header>
  )
}
