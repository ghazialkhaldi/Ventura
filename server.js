'use strict';

const express     = require('express');
const path        = require('path');
const fs          = require('fs');
const crypto      = require('crypto');
const multer      = require('multer');
const bcrypt      = require('bcryptjs');
const jwt         = require('jsonwebtoken');
const cors        = require('cors');
const helmet      = require('helmet');
const rateLimit   = require('express-rate-limit');

// ── 0. Fail-fast on missing secrets ──────────────────────────────────────────
if (!process.env.SECRET_KEY) {
  console.error('FATAL: SECRET_KEY environment variable is not set. Refusing to start.');
  process.exit(1);
}

const PORT       = process.env.PORT       || 4000;
const SECRET     = process.env.SECRET_KEY;
const SITE_DIR   = path.join(__dirname, 'site');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const DB_FILE    = path.join(__dirname, 'data.json');

// ── 1. Constants ──────────────────────────────────────────────────────────────
const BCRYPT_ROUNDS    = 12;
const TOKEN_TTL        = '8h';
const MAX_BODY_BYTES   = 1 * 1024 * 1024;         // 1 MB JSON body
const MAX_FILE_BYTES   = 10 * 1024 * 1024;        // 10 MB uploads
const MAX_LOGIN_FAILS  = 5;
const LOCKOUT_MS       = 15 * 60 * 1000;          // 15 minutes
const ALLOWED_MIME     = new Set([
  'text/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/pdf',
]);
const ALLOWED_EXT      = new Set(['.csv', '.xlsx', '.xls', '.pdf', '.txt']);

// Allowed CORS origins — comma-separated list in env
const ALLOWED_ORIGINS  = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

// ── 2. Simple JSON file store ─────────────────────────────────────────────────
function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    const initial = { users: [], uploads: [], audit_logs: [], login_attempts: {} };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
  }
  const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  raw.login_attempts = raw.login_attempts || {};
  return raw;
}

function saveDB(dbObj) {
  fs.writeFileSync(DB_FILE, JSON.stringify(dbObj, null, 2));
}

let db = loadDB();
db.users          = db.users          || [];
db.uploads        = db.uploads        || [];
db.audit_logs     = db.audit_logs     || [];
db.login_attempts = db.login_attempts || {};
saveDB(db);

// ── 3. Helpers ────────────────────────────────────────────────────────────────
function createAudit(userId, action, data, ip) {
  db = loadDB();
  db.audit_logs.unshift({
    id:         Date.now(),
    user_id:    userId || null,
    action,
    data:       data || null,
    ip_address: ip   || null,
    created_at: new Date().toISOString(),
  });
  saveDB(db);
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    SECRET,
    { expiresIn: TOKEN_TTL, algorithm: 'HS256' }
  );
}

function getClientIP(req) {
  return (
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

// Password must be ≥12 chars, with uppercase, lowercase, digit, and special char
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d]).{12,}$/;

function validatePassword(pw) {
  if (!pw || typeof pw !== 'string') return 'Password is required.';
  if (!PASSWORD_REGEX.test(pw)) {
    return 'Password must be at least 12 characters and include uppercase, lowercase, a number, and a special character.';
  }
  return null;
}

// Basic email format check (RFC 5321 simple version)
function validateEmail(email) {
  if (!email || typeof email !== 'string') return 'Email is required.';
  const trimmed = email.trim().toLowerCase();
  if (!/^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(trimmed)) return 'Invalid email address.';
  return null;
}

// Account lockout helpers
function isLockedOut(email) {
  db = loadDB();
  const rec = db.login_attempts[email];
  if (!rec) return false;
  if (rec.locked_until && Date.now() < rec.locked_until) return true;
  // Auto-expire old lockout
  if (rec.locked_until && Date.now() >= rec.locked_until) {
    delete db.login_attempts[email];
    saveDB(db);
  }
  return false;
}

function recordFailedLogin(email) {
  db = loadDB();
  const rec = db.login_attempts[email] || { count: 0 };
  rec.count += 1;
  rec.last_failed = Date.now();
  if (rec.count >= MAX_LOGIN_FAILS) {
    rec.locked_until = Date.now() + LOCKOUT_MS;
  }
  db.login_attempts[email] = rec;
  saveDB(db);
  return rec;
}

function clearLoginAttempts(email) {
  db = loadDB();
  delete db.login_attempts[email];
  saveDB(db);
}

// ── 4. Express app setup ──────────────────────────────────────────────────────
const app = express();

// Trust the first proxy (needed for correct IP behind Vercel/Nginx)
app.set('trust proxy', 1);

// Security headers via Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'"],
      styleSrc:       ["'self'", "'unsafe-inline'"],
      imgSrc:         ["'self'", 'data:'],
      connectSrc:     ["'self'"],
      fontSrc:        ["'self'"],
      objectSrc:      ["'none'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy:   { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  dnsPrefetchControl:        { allow: false },
  frameguard:                { action: 'deny' },
  hsts:                      { maxAge: 31536000, includeSubDomains: true, preload: true },
  noSniff:                   true,
  referrerPolicy:            { policy: 'strict-origin-when-cross-origin' },
  xssFilter:                 true,
}));

// CORS — only allow configured origins
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (server-to-server, curl in dev)
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods:          ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders:   ['Content-Type', 'Authorization'],
  credentials:      true,
  optionsSuccessStatus: 200,
}));

// Body size limits — prevent oversized JSON payloads
app.use(express.json({ limit: MAX_BODY_BYTES }));
app.use(express.urlencoded({ extended: false, limit: MAX_BODY_BYTES }));

// ── 5. Rate limiters ──────────────────────────────────────────────────────────

// Global rate limit — 120 req / 1 min per IP
const globalLimiter = rateLimit({
  windowMs:         60 * 1000,
  max:              120,
  standardHeaders:  true,
  legacyHeaders:    false,
  message:          { error: 'Too many requests. Please slow down.' },
});
app.use(globalLimiter);

// Auth endpoints — tighter: 10 req / 15 min per IP
const authLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              10,
  standardHeaders:  true,
  legacyHeaders:    false,
  message:          { error: 'Too many authentication attempts. Please try again later.' },
  skipSuccessfulRequests: true,
});

// File upload — 20 req / 10 min per IP
const uploadLimiter = rateLimit({
  windowMs:         10 * 60 * 1000,
  max:              20,
  standardHeaders:  true,
  legacyHeaders:    false,
  message:          { error: 'Too many upload requests. Please try again later.' },
});

// ── 6. Auth middleware ────────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, SECRET, { algorithms: ['HS256'] });
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ── 7. Static file serving ────────────────────────────────────────────────────
app.use('/', express.static(SITE_DIR));

// ── 8. Multer — secure file upload ───────────────────────────────────────────
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename:    (req, file, cb) => {
    const ext    = path.extname(file.originalname).toLowerCase();
    const safe   = crypto.randomBytes(16).toString('hex');
    cb(null, `${Date.now()}-${safe}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  const ext  = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype;
  if (!ALLOWED_EXT.has(ext) || !ALLOWED_MIME.has(mime)) {
    return cb(new Error(`File type not allowed: ${mime} / ${ext}`), false);
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
});

// ── 9. Auth endpoints ─────────────────────────────────────────────────────────
app.post('/api/signup', authLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  const ip = getClientIP(req);

  const emailErr = validateEmail(email);
  if (emailErr) return res.status(400).json({ error: emailErr });

  const pwErr = validatePassword(password);
  if (pwErr) return res.status(400).json({ error: pwErr });

  const normalizedEmail = email.trim().toLowerCase();
  db = loadDB();

  if (db.users.find(u => u.email === normalizedEmail)) {
    // Constant-time response to prevent email enumeration
    await bcrypt.hash(password, BCRYPT_ROUNDS);
    return res.status(400).json({ error: 'Email already registered' });
  }

  const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const id     = Date.now();
  const user   = { id, email: normalizedEmail, password: hashed, role: 'member', created_at: new Date().toISOString() };
  db.users.push(user);
  saveDB(db);
  createAudit(id, 'signup', JSON.stringify({ email: normalizedEmail }), ip);

  return res.status(201).json({
    token: generateToken({ id, email: normalizedEmail, role: 'member' }),
    user:  { id, email: normalizedEmail, role: 'member' },
  });
});

app.post('/api/login', authLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  const ip = getClientIP(req);

  const emailErr = validateEmail(email);
  if (emailErr) return res.status(400).json({ error: 'Invalid credentials' });

  const normalizedEmail = email.trim().toLowerCase();

  // Check lockout before touching DB
  if (isLockedOut(normalizedEmail)) {
    createAudit(null, 'login_locked', JSON.stringify({ email: normalizedEmail }), ip);
    return res.status(429).json({ error: 'Account temporarily locked. Please try again in 15 minutes.' });
  }

  db = loadDB();
  const row = db.users.find(u => u.email === normalizedEmail);

  // Always run bcrypt to prevent timing-based user enumeration
  const compareTarget = row ? row.password : '$2a$12$invalidhashpaddingtoconstanttime';
  const ok = await bcrypt.compare(password || '', compareTarget);

  if (!row || !ok) {
    const rec = recordFailedLogin(normalizedEmail);
    createAudit(null, 'login_failed', JSON.stringify({ email: normalizedEmail, attempts: rec.count }), ip);
    const remaining = Math.max(0, MAX_LOGIN_FAILS - rec.count);
    if (remaining === 0) {
      return res.status(429).json({ error: 'Account temporarily locked after too many failed attempts. Please try again in 15 minutes.' });
    }
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  clearLoginAttempts(normalizedEmail);
  const user = { id: row.id, email: row.email, role: row.role };
  createAudit(user.id, 'login', null, ip);
  res.json({ token: generateToken(user), user });
});

app.get('/api/me', authMiddleware, (req, res) => {
  res.json({ user: { id: req.user.id, email: req.user.email, role: req.user.role } });
});

// ── 10. Upload endpoint ───────────────────────────────────────────────────────
app.post('/api/upload', authMiddleware, uploadLimiter, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: `File exceeds maximum size of ${MAX_FILE_BYTES / 1024 / 1024} MB.` });
      }
      return res.status(400).json({ error: err.message || 'Upload failed.' });
    }
    if (!req.file) return res.status(400).json({ error: 'File required.' });

    const ip = getClientIP(req);
    db = loadDB();
    const id = Date.now();
    db.uploads = db.uploads || [];
    db.uploads.unshift({
      id,
      user_id:       req.user.id,
      filename:      req.file.filename,
      original_name: req.file.originalname,
      created_at:    new Date().toISOString(),
    });
    saveDB(db);
    createAudit(req.user.id, 'upload', JSON.stringify({ filename: req.file.filename, original: req.file.originalname }), ip);
    res.json({ id, filename: req.file.filename, original: req.file.originalname });
  });
});

app.get('/api/uploads', authMiddleware, (req, res) => {
  db = loadDB();
  const rows = (db.uploads || [])
    .filter(u => u.user_id === req.user.id)
    .map(({ id, filename, original_name, created_at }) => ({ id, filename, original_name, created_at }));
  res.json({ uploads: rows });
});

// ── 11. Anomalies & AI endpoints ──────────────────────────────────────────────
function ruleEngineForAnomaly(anomaly) {
  const reasons = [];
  if (/duplicate/i.test(anomaly.reason || '') || /duplicate/i.test(anomaly.description || '')) reasons.push('duplicate_check');
  if ((anomaly.score || 0) > 0.9)  reasons.push('high_score');
  if ((anomaly.score || 0) > 0.75) reasons.push('elevated_score');
  if (/spike|increase|surge/i.test(anomaly.reason || '') || /spike|increase|surge/i.test(anomaly.description || '')) reasons.push('vendor_spike');
  return { rulesMatched: reasons, resolvedByRules: reasons.length > 0 };
}

const aiCache = new Map();

async function smallModel(context) {
  return {
    summary:             `Brief: ${context.anomaly.reason}`,
    risk_level:          context.anomaly.score > 0.8 ? 'high' : 'medium',
    confidence_score:    Math.max(0.5, Math.min(0.95, context.anomaly.score)),
    reasoning_summary:   'Extracted key signals and tags from anomaly.',
    evidence_refs:       ['invoices.csv:rows:12-15'],
    recommended_actions: [],
    approval_required:   false,
    model_tier:          'small',
    cost_estimate:       0.001,
  };
}

async function mediumModel(context) {
  return {
    summary:             `Analysis: ${context.anomaly.reason} — likely cause and next steps.`,
    risk_level:          context.anomaly.score > 0.85 ? 'high' : 'medium',
    confidence_score:    Math.max(0.6, Math.min(0.98, context.anomaly.score + 0.05)),
    reasoning_summary:   'Correlated vendor transactions with recent approvals and thresholds.',
    evidence_refs:       ['payments_db:txn_ids:345-349', 'vendor_registry:XYZ'],
    recommended_actions: [
      { id: 'investigate',   label: 'Investigate vendor payments' },
      { id: 'hold-payments', label: 'Hold related payments (requires approval)' },
    ],
    approval_required: true,
    model_tier:        'medium',
    cost_estimate:     0.01,
  };
}

async function largeModel(context) {
  return {
    summary:             `Deep analysis: ${context.anomaly.reason}`,
    risk_level:          'high',
    confidence_score:    0.92,
    reasoning_summary:   'Synthesis from multiple systems and policy checks; suggests policy changes to avoid recurrence.',
    evidence_refs:       ['payments_db', 'erp:purchase_orders', 'approval_chain:missing_steps'],
    recommended_actions: [{ id: 'proposal_policy', label: 'Propose approval policy change' }],
    approval_required:   true,
    model_tier:          'large',
    cost_estimate:       0.12,
  };
}

async function modelRouter(taskType, context) {
  const ruleResult = ruleEngineForAnomaly(context.anomaly || {});
  if (ruleResult.resolvedByRules && taskType === 'explain') {
    return { from: 'rules', output: { summary: `Rule based: ${ruleResult.rulesMatched.join(', ')}`, reasoning_summary: 'Deterministic checks matched.', model_tier: 'none', cost_estimate: 0 } };
  }
  const score = context.anomaly?.score || 0;
  if (taskType === 'explain') {
    if (score < 0.6) return { from: 'model', output: await smallModel(context) };
    if (score < 0.9) return { from: 'model', output: await mediumModel(context) };
    return { from: 'model', output: await largeModel(context) };
  }
  return { from: 'model', output: await mediumModel(context) };
}

function recordAIEvent(userId, tenantId, taskType, modelInfo, inputScope, output) {
  db = loadDB();
  db.ai_events = db.ai_events || [];
  const ev = {
    id:               Date.now(),
    user_id:          userId    || null,
    tenant_id:        tenantId  || null,
    task_type:        taskType,
    model:            modelInfo?.model_tier || modelInfo?.from || 'unknown',
    model_source:     modelInfo?.from       || 'model',
    prompt_template:  modelInfo?.template   || null,
    input_scope:      inputScope            || null,
    output_summary:   output?.summary       || null,
    confidence_score: output?.confidence_score || null,
    approval_required: output?.approval_required || false,
    cost_estimate:    output?.cost_estimate  || 0,
    created_at:       new Date().toISOString(),
  };
  db.ai_events.unshift(ev);
  saveDB(db);
  createAudit(userId, 'ai_event', JSON.stringify({ taskType, model: ev.model, id: ev.id }));
  return ev;
}

app.get('/api/anomalies', authMiddleware, (req, res) => {
  db = loadDB();
  const list = (db.anomalies || []).map(a => ({ id: a.id, score: a.score, reason: a.reason, created_at: a.created_at, status: a.status }));
  res.json({ anomalies: list });
});

app.get('/api/anomalies/:id', authMiddleware, (req, res) => {
  const raw = req.params.id;
  // Only allow numeric IDs
  if (!/^\d{1,20}$/.test(raw)) return res.status(400).json({ error: 'Invalid ID' });
  const id = Number(raw);
  db = loadDB();
  const a = (db.anomalies || []).find(x => x.id === id);
  if (!a) return res.status(404).json({ error: 'Not found' });
  res.json({ anomaly: a });
});

app.post('/api/ai/analyze/:id', authMiddleware, async (req, res) => {
  const raw = req.params.id;
  if (!/^\d{1,20}$/.test(raw)) return res.status(400).json({ error: 'Invalid ID' });
  const id = Number(raw);
  db = loadDB();
  const anomaly = (db.anomalies || []).find(x => x.id === id);
  if (!anomaly) return res.status(404).json({ error: 'Not found' });
  const cacheKey = `anomaly:${id}:explain`;
  if (aiCache.has(cacheKey)) {
    const cached = aiCache.get(cacheKey);
    recordAIEvent(req.user?.id, null, 'explain', { from: 'cache' }, { anomalyId: id }, cached);
    return res.json({ from: 'cache', output: cached });
  }
  const routed = await modelRouter('explain', { anomaly });
  const output = routed.output;
  aiCache.set(cacheKey, output);
  recordAIEvent(req.user?.id, null, 'explain', routed, { anomalyId: id }, output);
  res.json({ from: routed.from, output });
});

app.post('/api/ai/approve/:id', authMiddleware, (req, res) => {
  const raw = req.params.id;
  if (!/^\d{1,20}$/.test(raw)) return res.status(400).json({ error: 'Invalid ID' });
  const id = Number(raw);
  db = loadDB();
  const anomaly = (db.anomalies || []).find(x => x.id === id);
  if (!anomaly) return res.status(404).json({ error: 'Not found' });
  if (req.user.role !== 'admin' && req.user.role !== 'reviewer') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  anomaly.status = 'approved';
  saveDB(db);
  createAudit(req.user.id, 'ai_approve', JSON.stringify({ anomalyId: id }), getClientIP(req));
  res.json({ ok: true });
});

app.get('/api/ai/governance', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  db = loadDB();
  res.json({ ai_events: db.ai_events || [] });
});

// ── 12. Audit log endpoint ─────────────────────────────────────────────────────
app.get('/api/audit', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  db = loadDB();
  res.json({ audit: db.audit_logs.slice(0, 200) });
});

// ── 13. Error handling ────────────────────────────────────────────────────────
// Catch unhandled route errors (e.g. from CORS rejection)
app.use((err, req, res, _next) => {
  if (err.message && err.message.startsWith('CORS:')) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  console.error('[server error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Fallback: serve SPA index (must be last)
app.get('*', (req, res) => {
  const indexPath = path.join(SITE_DIR, 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  res.status(404).json({ error: 'Not found' });
});

// ── 14. Start ─────────────────────────────────────────────────────────────────
app.listen(PORT, () => console.log(`Ventura server listening on http://localhost:${PORT}`));
