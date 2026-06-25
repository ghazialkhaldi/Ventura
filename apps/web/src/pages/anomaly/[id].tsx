import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Header from '../../components/Header'

export default function AnomalyDetail(){
  const router = useRouter();
  const { id } = router.query;
  const [anomaly, setAnomaly] = useState<any>(null);
  const [ai, setAi] = useState<any>(null);

  useEffect(()=>{ if (!id) return; (async ()=>{
    const token = localStorage.getItem('sf_token');
    const r = await fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000') + '/api/anomalies/' + id, { headers: token? { 'Authorization':'Bearer '+token } : {} });
    const j = await r.json(); setAnomaly(j.anomaly);
  })() },[id]);

  async function runAI(){
    const token = localStorage.getItem('sf_token');
    const r = await fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000') + '/api/ai/analyze/' + id, { method: 'POST', headers: token? { 'Authorization':'Bearer '+token } : {} });
    const j = await r.json(); setAi(j.output || j);
  }

  async function approve(){
    const token = localStorage.getItem('sf_token');
    const r = await fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000') + '/api/ai/approve/' + id, { method: 'POST', headers: token? { 'Authorization':'Bearer '+token } : {} });
    const j = await r.json(); if (j.ok) alert('Approved');
  }

  return (
    <div>
      <Header />
      <main className="container">
        <h2 className="mt-6">Anomaly detail</h2>
        {anomaly && (
          <div className="card mt-4">
            <h3>{anomaly.reason}</h3>
            <p className="text-slate-600">{anomaly.description}</p>
            <p className="mt-2">Score: {anomaly.score}</p>
            <div className="mt-4">
              <button className="primary mr-2" onClick={runAI}>Run AI explanation</button>
              <button className="secondary" onClick={approve}>Approve (admin)</button>
            </div>
          </div>
        )}

        {ai && (
          <div className="card mt-4">
            <h3>AI Explanation</h3>
            <p><strong>Summary:</strong> {ai.summary}</p>
            <p><strong>Risk level:</strong> {ai.risk_level}</p>
            <p><strong>Confidence:</strong> {ai.confidence_score}</p>
            <p><strong>Reasoning:</strong> {ai.reasoning_summary}</p>
            <p><strong>Evidence:</strong></p>
            <ul>{(ai.evidence_refs||[]).map((e:any,i:number)=> <li key={i}>{e}</li>)}</ul>
            <p><strong>Recommended actions:</strong></p>
            <ul>{(ai.recommended_actions||[]).map((a:any,i:number)=> <li key={i}>{a.label}</li>)}</ul>
          </div>
        )}
      </main>
    </div>
  )
}
