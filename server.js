const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
// Simple JSON file store to avoid native build requirements on Windows
const DB_FILE = path.join(__dirname, 'data.json');

function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    const initial = { users: [], uploads: [], audit_logs: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveDB(dbObj) {
  fs.writeFileSync(DB_FILE, JSON.stringify(dbObj, null, 2));
}
const cors = require('cors');

const PORT = process.env.PORT || 4000;
const SITE_DIR = path.join(__dirname, 'site');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const SECRET = process.env.SECRET_KEY || 'dev-secret-change-me';

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

let db = loadDB();

// Ensure array keys exist
db.users = db.users || [];
db.uploads = db.uploads || [];
db.audit_logs = db.audit_logs || [];
saveDB(db);

// Seed an admin user if none exist
if (db.users.length === 0) {
  const adminPassword = 'adminpass';
  const hashed = bcrypt.hashSync(adminPassword, 10);
  const admin = { id: Date.now(), email: 'admin@secureflow.local', password: hashed, role: 'admin', created_at: new Date().toISOString() };
  db.users.push(admin);
  saveDB(db);
  createAudit(admin.id, 'seed_admin', JSON.stringify({ email: admin.email }));
  console.log('Seeded admin user: admin@secureflow.local (password: adminpass) — change ASAP');
}

// Seed demo anomalies if none exist
if ((db.anomalies || []).length === 0) {
  db = loadDB();
  db.anomalies = db.anomalies || [];
  db.anomalies.push({ id: 1, tenant_id: 1, score: 0.87, reason: 'Duplicate vendor payments detected', description: 'Possible duplicate invoice numbers for vendor Acme Corp', created_at: new Date().toISOString(), status: 'open' });
  db.anomalies.push({ id: 2, tenant_id: 1, score: 0.65, reason: 'Sudden vendor spike', description: 'Vendor XYZ increased spend by 4x month-over-month', created_at: new Date().toISOString(), status: 'open' });
  saveDB(db);
}

// ----- Rule engine and AI mock layer -----
function ruleEngineForAnomaly(anomaly) {
  // deterministic checks
  const reasons = [];
  if (/duplicate/i.test(anomaly.reason || '') || /duplicate/i.test(anomaly.description || '')) reasons.push('duplicate_check');
  if ((anomaly.score || 0) > 0.9) reasons.push('high_score');
  if ((anomaly.score || 0) > 0.75) reasons.push('elevated_score');
  if (/spike|increase|surge/i.test(anomaly.reason || '') || /spike|increase|surge/i.test(anomaly.description || '')) reasons.push('vendor_spike');
  return { rulesMatched: reasons, resolvedByRules: reasons.length > 0 };
}

// Simple in-memory cache for AI outputs
const aiCache = new Map();

// Mock model implementations to simulate structured AI outputs and cost
async function smallModel(context) {
  // cheap classification/extraction
  return {
    summary: `Brief: ${context.anomaly.reason}`,
    risk_level: context.anomaly.score > 0.8 ? 'high' : 'medium',
    confidence_score: Math.max(0.5, Math.min(0.95, context.anomaly.score)),
    reasoning_summary: 'Extracted key signals and tags from anomaly.',
    evidence_refs: ['invoices.csv:rows:12-15'],
    recommended_actions: [],
    approval_required: false,
    model_tier: 'small',
    cost_estimate: 0.001
  };
}

async function mediumModel(context) {
  return {
    summary: `Analysis: ${context.anomaly.reason} — likely cause and next steps.`,
    risk_level: context.anomaly.score > 0.85 ? 'high' : 'medium',
    confidence_score: Math.max(0.6, Math.min(0.98, context.anomaly.score + 0.05)),
    reasoning_summary: 'Correlated vendor transactions with recent approvals and thresholds.',
    evidence_refs: ['payments_db:txn_ids:345-349', 'vendor_registry:XYZ'],
    recommended_actions: [ { id: 'investigate', label: 'Investigate vendor payments' }, { id: 'hold-payments', label: 'Hold related payments (requires approval)' } ],
    approval_required: true,
    model_tier: 'medium',
    cost_estimate: 0.01
  };
}

async function largeModel(context) {
  return {
    summary: `Deep analysis: ${context.anomaly.reason}`,
    risk_level: 'high',
    confidence_score: 0.92,
    reasoning_summary: 'Synthesis from multiple systems and policy checks; suggests policy changes to avoid recurrence.',
    evidence_refs: ['payments_db', 'erp:purchase_orders', 'approval_chain:missing_steps'],
    recommended_actions: [ { id: 'proposal_policy', label: 'Propose approval policy change' } ],
    approval_required: true,
    model_tier: 'large',
    cost_estimate: 0.12
  };
}

async function modelRouter(taskType, context) {
  // Determine if rules can answer first
  const ruleResult = ruleEngineForAnomaly(context.anomaly || {});
  if (ruleResult.resolvedByRules && taskType === 'explain') {
    // small response from rules
    return { from: 'rules', output: { summary: `Rule based: ${ruleResult.rulesMatched.join(', ')}`, reasoning_summary: 'Deterministic checks matched.', model_tier: 'none', cost_estimate: 0 } };
  }

  // Route by task complexity and anomaly score
  const score = context.anomaly?.score || 0;
  if (taskType === 'explain') {
    if (score < 0.6) return { from: 'model', output: await smallModel(context) };
    if (score < 0.9) return { from: 'model', output: await mediumModel(context) };
    return { from: 'model', output: await largeModel(context) };
  }
  // default to medium
  return { from: 'model', output: await mediumModel(context) };
}

function recordAIEvent(userId, tenantId, taskType, modelInfo, inputScope, output) {
  db = loadDB();
  db.ai_events = db.ai_events || [];
  const ev = {
    id: Date.now(), user_id: userId || null, tenant_id: tenantId || null,
    task_type: taskType, model: modelInfo?.model_tier || modelInfo?.from || 'unknown', model_source: modelInfo?.from || 'model', prompt_template: modelInfo?.template || null,
    input_scope: inputScope || null, output_summary: output?.summary || null, confidence_score: output?.confidence_score || null,
    approval_required: output?.approval_required || false, cost_estimate: output?.cost_estimate || 0, created_at: new Date().toISOString()
  };
  db.ai_events.unshift(ev);
  saveDB(db);
  createAudit(userId, 'ai_event', JSON.stringify({ taskType, model: ev.model, id: ev.id }));
  return ev;
}

// ----- API: anomalies and AI endpoints -----
app.get('/api/anomalies', authMiddleware, (req, res) => {
  db = loadDB();
  const list = (db.anomalies || []).map(a => ({ id: a.id, score: a.score, reason: a.reason, created_at: a.created_at, status: a.status }));
  res.json({ anomalies: list });
});

app.get('/api/anomalies/:id', authMiddleware, (req, res) => {
  const id = Number(req.params.id);
  db = loadDB();
  const a = (db.anomalies || []).find(x => x.id === id);
  if (!a) return res.status(404).json({ error: 'not found' });
  res.json({ anomaly: a });
});

app.post('/api/ai/analyze/:id', authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  db = loadDB();
  const anomaly = (db.anomalies || []).find(x => x.id === id);
  if (!anomaly) return res.status(404).json({ error: 'not found' });
  const cacheKey = `anomaly:${id}:explain`;
  if (aiCache.has(cacheKey)) {
    const cached = aiCache.get(cacheKey);
    recordAIEvent(req.user?.id, null, 'explain', { from: 'cache' }, { anomalyId: id }, cached);
    return res.json({ from: 'cache', output: cached });
  }

  // Route task
  const context = { anomaly };
  const routed = await modelRouter('explain', context);
  const output = routed.output;
  aiCache.set(cacheKey, output);
  recordAIEvent(req.user?.id, null, 'explain', routed, { anomalyId: id }, output);
  res.json({ from: routed.from, output });
});

app.post('/api/ai/approve/:id', authMiddleware, (req, res) => {
  const id = Number(req.params.id);
  db = loadDB();
  const anomaly = (db.anomalies || []).find(x => x.id === id);
  if (!anomaly) return res.status(404).json({ error: 'not found' });
  // require admin or reviewer
  if (req.user.role !== 'admin' && req.user.role !== 'reviewer') return res.status(403).json({ error: 'forbidden' });
  anomaly.status = 'approved';
  saveDB(db);
  createAudit(req.user.id, 'ai_approve', JSON.stringify({ anomalyId: id }));
  res.json({ ok: true });
});

app.get('/api/ai/governance', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  db = loadDB();
  res.json({ ai_events: db.ai_events || [] });
});

const app = express();
app.use(cors());
app.use(express.json());

// Serve static assets
app.use('/', express.static(SITE_DIR));

// Multer for uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.\-]/g, '_'))
});
const upload = multer({ storage });

// Helpers
function createAudit(userId, action, data) {
  db = loadDB();
  db.audit_logs.unshift({ id: Date.now(), user_id: userId || null, action, data: data || null, created_at: new Date().toISOString() });
  saveDB(db);
}

function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, SECRET, { expiresIn: '8h' });
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Auth endpoints
app.post('/api/signup', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const hashed = await bcrypt.hash(password, 10);
  db = loadDB();
  if (db.users.find(u => u.email === email)) return res.status(400).json({ error: 'Email already registered' });
  const id = Date.now();
  const user = { id, email, password: hashed, role: 'member', created_at: new Date().toISOString() };
  db.users.push(user);
  saveDB(db);
  createAudit(user.id, 'signup', JSON.stringify({ email }));
  return res.json({ token: generateToken({ id: user.id, email: user.email, role: user.role }), user: { id: user.id, email: user.email, role: user.role } });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  db = loadDB();
  const row = db.users.find(u => u.email === email);
  if (!row) return res.status(400).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, row.password);
  if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
  const user = { id: row.id, email: row.email, role: row.role };
  createAudit(user.id, 'login', null);
  res.json({ token: generateToken(user), user });
});

app.get('/api/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

app.post('/api/upload', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file required' });
  db = loadDB();
  const id = Date.now();
  db.uploads.unshift({ id, user_id: req.user.id, filename: req.file.filename, original_name: req.file.originalname, created_at: new Date().toISOString() });
  saveDB(db);
  createAudit(req.user.id, 'upload', JSON.stringify({ filename: req.file.filename, original: req.file.originalname }));
  res.json({ id, filename: req.file.filename, original: req.file.originalname });
});

app.get('/api/uploads', authMiddleware, (req, res) => {
  db = loadDB();
  const rows = db.uploads.filter(u => u.user_id === req.user.id).map(({ id, filename, original_name, created_at }) => ({ id, filename, original_name, created_at }));
  res.json({ uploads: rows });
});

app.get('/api/audit', authMiddleware, (req, res) => {
  // only admin allowed
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  db = loadDB();
  const rows = db.audit_logs.slice(0, 200);
  res.json({ audit: rows });
});

// Fallback to index
app.get('*', (req, res) => {
  res.sendFile(path.join(SITE_DIR, 'index.html'));
});

app.listen(PORT, () => console.log(`SecureFlow server running on http://localhost:${PORT}`));
