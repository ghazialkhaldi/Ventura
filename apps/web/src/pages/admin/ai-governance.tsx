import Header from '../../components/Header'
import { useEffect, useState } from 'react'

export default function AIGovernance(){
  const [events, setEvents] = useState<any[]>([])
  useEffect(()=>{ (async ()=>{
    const token = localStorage.getItem('sf_token')
    const r = await fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000') + '/api/ai/governance', { headers: token? { 'Authorization':'Bearer '+token } : {} })
    const j = await r.json(); setEvents(j.ai_events || [])
  })() },[])
  return (
    <div>
      <Header />
      <main className="container">
        <h2 className="mt-6">AI Governance</h2>
        <div className="card mt-4">
          <table className="w-full">
            <thead><tr><th>Time</th><th>Task</th><th>Model</th><th>Confidence</th><th>Cost</th></tr></thead>
            <tbody>
              {events.map(e=> <tr key={e.id}><td>{new Date(e.created_at).toLocaleString()}</td><td>{e.task_type}</td><td>{e.model}</td><td>{e.confidence_score}</td><td>{e.cost_estimate}</td></tr>)}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
