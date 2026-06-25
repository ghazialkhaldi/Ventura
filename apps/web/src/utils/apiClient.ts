export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export async function postJson(path: string, body: any, token?: string){
  const res = await fetch(API_URL + path, { method: 'POST', headers: { 'Content-Type':'application/json', ...(token?{ 'Authorization': 'Bearer '+token }: {}) }, body: JSON.stringify(body) });
  return res.json();
}

export async function getJson(path: string, token?: string){
  const res = await fetch(API_URL + path, { headers: token? { 'Authorization': 'Bearer '+token } : {} });
  return res.json();
}
