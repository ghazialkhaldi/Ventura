// Minimal client for signup/login/upload and listing uploads/audit
const api = {
  signup: '/api/signup',
  login: '/api/login',
  me: '/api/me',
  upload: '/api/upload',
  uploads: '/api/uploads',
  audit: '/api/audit'
};

function qs(sel){return document.querySelector(sel)}

function setToken(t){ localStorage.setItem('sf_token', t); }
function getToken(){ return localStorage.getItem('sf_token'); }

async function apiPost(url, body){
  const headers = { 'Content-Type':'application/json' };
  const token = getToken(); if (token) headers['Authorization'] = 'Bearer '+token;
  const res = await fetch(url, { method:'POST', headers, body: JSON.stringify(body) });
  return res.json();
}

async function apiGet(url){
  const headers = {};
  const token = getToken(); if (token) headers['Authorization'] = 'Bearer '+token;
  const res = await fetch(url, { headers });
  return res.json();
}

// UI actions
qs('#signupForm')?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const email = qs('#signupEmail').value; const password = qs('#signupPassword').value;
  const r = await apiPost(api.signup, { email, password });
  if (r.token) { setToken(r.token); alert('Signed up and logged in'); refreshUI(); } else alert(r.error||'Signup failed');
});

qs('#loginForm')?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const email = qs('#loginEmail').value; const password = qs('#loginPassword').value;
  const r = await apiPost(api.login, { email, password });
  if (r.token) { setToken(r.token); alert('Logged in'); refreshUI(); } else alert(r.error||'Login failed');
});

qs('#logoutBtn')?.addEventListener('click', (e)=>{ localStorage.removeItem('sf_token'); refreshUI(); });

qs('#uploadForm')?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const file = qs('#fileInput').files[0]; if (!file) return alert('Select a file');
  const fd = new FormData(); fd.append('file', file);
  const token = getToken();
  const res = await fetch(api.upload, { method:'POST', body: fd, headers: token ? { 'Authorization': 'Bearer '+token } : {} });
  const j = await res.json();
  if (j.id) { alert('Uploaded'); listUploads(); } else alert(j.error||'Upload failed');
});

async function listUploads(){
  const el = qs('#uploadsList'); if(!el) return;
  const r = await apiGet(api.uploads);
  el.innerHTML = '';
  (r.uploads||[]).forEach(u=>{
    const li = document.createElement('li');
    li.textContent = `${u.original_name} — ${new Date(u.created_at).toLocaleString()}`;
    el.appendChild(li);
  });
}

async function loadAudit(){
  const el = qs('#auditList'); if(!el) return;
  const r = await apiGet(api.audit);
  el.innerHTML = '';
  (r.audit||[]).forEach(a=>{
    const li = document.createElement('li');
    li.textContent = `${a.created_at} — ${a.action} — ${a.data || ''}`;
    el.appendChild(li);
  });
}

async function refreshUI(){
  const token = getToken();
  const me = token ? await apiGet(api.me) : null;
  const loggedIn = me && me.user;
  document.body.classList.toggle('logged-in', !!loggedIn);
  qs('#authPanel').style.display = loggedIn ? 'none' : 'block';
  qs('#userPanel').style.display = loggedIn ? 'block' : 'none';
  if (loggedIn) {
    qs('#who').textContent = me.user.email + ' ('+me.user.role+')';
    listUploads();
    if (me.user.role === 'admin') loadAudit(); else qs('#auditPanel').style.display='none';
  }
}

document.addEventListener('DOMContentLoaded', ()=>{
  refreshUI();
});
