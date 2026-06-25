import React, { useState } from 'react'
import Header from '../components/Header'
import { useRouter } from 'next/router'

export default function Signup(){
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const router = useRouter()

  async function submit(e: React.FormEvent){
    e.preventDefault()
    const res = await fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000') + '/api/signup', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, password }) })
    const j = await res.json()
    if (j.token){ localStorage.setItem('sf_token', j.token); if (j.user) localStorage.setItem('sf_user', JSON.stringify(j.user)); router.push('/dashboard') }
    else alert(j.error||'Signup failed')
  }

  return (
    <div>
      <Header />
      <main className="container">
        <div className="card mt-6">
          <h2>Create account</h2>
          <form onSubmit={submit} className="mt-4">
            <input className="w-full p-2 border rounded" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
            <input type="password" className="w-full p-2 border rounded mt-3" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} />
            <button className="primary mt-4 px-4 py-2 rounded">Create account</button>
          </form>
        </div>
      </main>
    </div>
  )
}
