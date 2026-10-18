// CodexSoto Live · votaciones en vivo, preguntas y registro para la conferencia "Agentes de IA 2026"
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const PLATFORM_URL = process.env.PLATFORM_URL || 'https://codexsoto.com';
const PRIVACY_URL = process.env.PRIVACY_URL || '';
const EVENT_NAME = process.env.EVENT_NAME || 'Agentes de IA 2026';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
// Debe coincidir con el número de <section class="slide"> en public/deck.html
const TOTAL_SLIDES = 49;

if (ADMIN_TOKEN.length < 12) {
  console.warn('[aviso] ADMIN_TOKEN no está definido o tiene menos de 12 caracteres: el panel de control y el modo presentador quedan deshabilitados.');
}

/* ---------- Datos ---------- */
const POLLS = {
  pills: ['blue', 'red'],
  realA: ['h', 'ai'], realB: ['h', 'ai'], realC: ['h', 'ai'], realD: ['h', 'ai'],
  next: ['cambiar', 'transformar', 'ayudar', 'automatizar', 'reemplazar', 'bailar'],
  reaction: ['👍', '🤔', '😮', '👏', '😴'],
  rate: ['1', '2', '3', '4', '5'],
  level: ['beginner', 'intermediate', 'advanced'],
};
const ACTIVITIES = ['lobby', 'pills', 'real', 'next', 'questions', 'register', 'reaction', 'rate', 'level', 'cloud', 'feedback'];
const INTERESTS = ['Agentes de IA', 'Desarrollo web', 'Ciencia de datos', 'Cursos y talleres', 'Proyectos para mi empresa'];

fs.mkdirSync(DATA_DIR, { recursive: true });
let db = { activity: 'lobby', votes: {}, reveal: {}, questions: [], registrations: [], currentSlide: 0, slideTitle: '', slideLevel: '', cloud: {}, feedback: [] };
try { db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) }; } catch { /* primer arranque */ }

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = DB_FILE + '.tmp';
    fs.writeFile(tmp, JSON.stringify(db), (err) => {
      if (err) return console.error('[db] no se pudo guardar', err);
      fs.rename(tmp, DB_FILE, (e) => e && console.error('[db] no se pudo renombrar', e));
    });
  }, 600);
}
function flushSync() { try { fs.writeFileSync(DB_FILE, JSON.stringify(db)); } catch (e) { console.error(e); } }
process.on('SIGTERM', () => { flushSync(); process.exit(0); });
process.on('SIGINT', () => { flushSync(); process.exit(0); });

function counts() {
  const out = {};
  for (const [poll, opts] of Object.entries(POLLS)) {
    const c = Object.fromEntries(opts.map((o) => [o, 0]));
    for (const v of Object.values(db.votes[poll] || {})) if (v in c) c[v]++;
    out[poll] = c;
  }
  return out;
}
function visibleQuestions() {
  return db.questions.filter((q) => !q.hidden)
    .sort((a, b) => (a.answered - b.answered) || (b.voters.length - a.voters.length) || (a.ts - b.ts))
    .slice(0, 60)
    .map((q) => ({ id: q.id, text: q.text, votes: q.voters.length, answered: q.answered }));
}
function cloudCounts() {
  const freq = {};
  for (const w of Object.values(db.cloud)) freq[w] = (freq[w] || 0) + 1;
  return Object.fromEntries(Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 40));
}
function publicState() {
  return {
    event: EVENT_NAME, activity: db.activity, counts: counts(), reveal: db.reveal,
    questions: visibleQuestions(), online: [...clients].filter((c) => c.role === 'aud').length,
    platformUrl: PLATFORM_URL, privacyUrl: PRIVACY_URL, interests: INTERESTS, currentSlide: db.currentSlide,
    slideTitle: db.slideTitle, slideLevel: db.slideLevel, cloud: cloudCounts(), totalSlides: TOTAL_SLIDES,
  };
}

/* ---------- Tiempo real (Server-Sent Events) ---------- */
const clients = new Set();
let bTimer = null;
function broadcast() {
  if (bTimer) return;
  bTimer = setTimeout(() => {
    bTimer = null;
    const msg = 'data: ' + JSON.stringify(publicState()) + '\n\n';
    for (const c of clients) c.res.write(msg);
  }, 150);
}
// Envía un comando inmediato (sin debounce) solo a la pantalla de la presentación, para control remoto paso a paso
function sendToDeck(cmd) {
  const msg = 'event: cmd\ndata: ' + JSON.stringify(cmd) + '\n\n';
  for (const c of clients) if (c.role === 'deck') c.res.write(msg);
}
setInterval(() => { for (const c of clients) c.res.write(': ping\n\n'); }, 20000);

/* ---------- App ---------- */
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  });
  next();
});

// Límite simple por IP para escrituras
const hits = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const key = req.ip + req.path.split('/').slice(0, 3).join('/');
    const now = Date.now();
    const h = hits.get(key);
    if (!h || now > h.reset) { hits.set(key, { n: 1, reset: now + windowMs }); return next(); }
    if (++h.n > max) return res.status(429).json({ error: 'Demasiadas solicitudes. Espera unos segundos.' });
    next();
  };
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (now > v.reset) hits.delete(k); }, 60000);

const CID = /^[A-Za-z0-9-]{8,64}$/;
const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

function requireAdmin(req, res, next) {
  const t = String(req.get('x-admin-token') || req.query.token || '');
  if (ADMIN_TOKEN.length < 12 || t.length !== ADMIN_TOKEN.length ||
      !crypto.timingSafeEqual(Buffer.from(t), Buffer.from(ADMIN_TOKEN))) {
    return res.status(401).json({ error: 'Token de administrador inválido.' });
  }
  next();
}

app.get('/healthz', (req, res) => res.json({ ok: true }));
app.get('/api/state', (req, res) => res.set('Cache-Control', 'no-store').json(publicState()));

app.get('/events', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  const c = { res, role: req.query.role === 'deck' ? 'deck' : 'aud' };
  clients.add(c);
  res.write('retry: 3000\n\n');
  res.write('data: ' + JSON.stringify(publicState()) + '\n\n');
  broadcast();
  req.on('close', () => { clients.delete(c); broadcast(); });
});

app.post('/api/vote', rateLimit(40, 60000), (req, res) => {
  const { cid, poll, option } = req.body || {};
  if (!CID.test(String(cid)) || !POLLS[poll] || !POLLS[poll].includes(option)) return res.status(400).json({ error: 'Voto inválido.' });
  if (db.reveal[poll]) return res.status(409).json({ error: 'La respuesta ya se reveló.' });
  (db.votes[poll] ||= {})[cid] = option;
  save(); broadcast();
  res.json({ ok: true });
});

const lastQuestion = new Map();
app.post('/api/questions', rateLimit(10, 60000), (req, res) => {
  const { cid } = req.body || {};
  const text = clean(req.body?.text, 240);
  if (!CID.test(String(cid))) return res.status(400).json({ error: 'Solicitud inválida.' });
  if (text.length < 5) return res.status(400).json({ error: 'Escribe una pregunta un poco más larga.' });
  if (Date.now() - (lastQuestion.get(cid) || 0) < 15000) return res.status(429).json({ error: 'Espera 15 segundos antes de enviar otra pregunta.' });
  if (db.questions.length >= 400) return res.status(429).json({ error: 'Se alcanzó el límite de preguntas.' });
  lastQuestion.set(cid, Date.now());
  db.questions.push({ id: crypto.randomUUID().slice(0, 8), text, cid, voters: [cid], hidden: false, answered: false, ts: Date.now() });
  save(); broadcast();
  res.json({ ok: true });
});

app.post('/api/questions/:id/vote', rateLimit(60, 60000), (req, res) => {
  const { cid } = req.body || {};
  const q = db.questions.find((x) => x.id === req.params.id);
  if (!q || !CID.test(String(cid))) return res.status(400).json({ error: 'Solicitud inválida.' });
  const i = q.voters.indexOf(cid);
  if (i >= 0) q.voters.splice(i, 1); else q.voters.push(cid);
  save(); broadcast();
  res.json({ ok: true, voted: i < 0 });
});

app.post('/api/cloud', rateLimit(30, 60000), (req, res) => {
  const { cid } = req.body || {};
  const word = clean(req.body?.word, 24).toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim();
  if (!CID.test(String(cid))) return res.status(400).json({ error: 'Solicitud inválida.' });
  if (word.length < 2) return res.status(400).json({ error: 'Escribe una palabra válida.' });
  db.cloud[cid] = word;
  save(); broadcast();
  res.json({ ok: true });
});

const lastFeedback = new Map();
app.post('/api/feedback', rateLimit(10, 60000), (req, res) => {
  const { cid } = req.body || {};
  const text = clean(req.body?.text, 400);
  if (!CID.test(String(cid))) return res.status(400).json({ error: 'Solicitud inválida.' });
  if (text.length < 5) return res.status(400).json({ error: 'Escribe un poco más, por favor.' });
  if (Date.now() - (lastFeedback.get(cid) || 0) < 15000) return res.status(429).json({ error: 'Espera unos segundos antes de enviar otro comentario.' });
  if (db.feedback.length >= 500) return res.status(429).json({ error: 'Se alcanzó el límite de comentarios.' });
  lastFeedback.set(cid, Date.now());
  db.feedback.push({ id: crypto.randomUUID().slice(0, 8), text, ts: Date.now() });
  save(); broadcast();
  res.json({ ok: true });
});

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
app.post('/api/register', rateLimit(6, 60000), (req, res) => {
  const b = req.body || {};
  const r = {
    name: clean(b.name, 100), email: clean(b.email, 160).toLowerCase(), phone: clean(b.phone, 20),
    institution: clean(b.institution, 120), career: clean(b.career, 120),
    interests: Array.isArray(b.interests) ? b.interests.filter((x) => INTERESTS.includes(x)).slice(0, INTERESTS.length) : [],
    consent: b.consent === true, news: b.news === true,
  };
  if (r.name.length < 3) return res.status(400).json({ error: 'Escribe tu nombre completo.' });
  if (!EMAIL.test(r.email)) return res.status(400).json({ error: 'Revisa tu correo electrónico.' });
  if (r.phone && !/^[+\d][\d\s-]{6,19}$/.test(r.phone)) return res.status(400).json({ error: 'Revisa tu teléfono o déjalo vacío.' });
  if (!r.consent) return res.status(400).json({ error: 'Necesitas aceptar el aviso de privacidad.' });
  const now = new Date().toISOString();
  const existing = db.registrations.find((x) => x.email === r.email);
  if (existing) Object.assign(existing, r, { updatedAt: now });
  else db.registrations.push({ ...r, createdAt: now, event: EVENT_NAME });
  save();
  res.json({ ok: true, platformUrl: PLATFORM_URL });
});

/* ---------- Administración ---------- */
app.get('/api/admin/state', requireAdmin, (req, res) => {
  res.json({ ...publicState(), allQuestions: db.questions.map(({ cid, voters, ...q }) => ({ ...q, votes: voters.length })), registrations: db.registrations.length, allFeedback: db.feedback.slice(-200).reverse() });
});
app.post('/api/admin/activity', requireAdmin, (req, res) => {
  const a = req.body?.activity;
  if (!ACTIVITIES.includes(a)) return res.status(400).json({ error: 'Actividad inválida.' });
  const title = typeof req.body?.title === 'string' ? clean(req.body.title, 160) : db.slideTitle;
  const level = typeof req.body?.level === 'string' ? clean(req.body.level, 80) : db.slideLevel;
  const slide = Number.isInteger(req.body?.slide) && req.body.slide >= 0 && req.body.slide < TOTAL_SLIDES ? req.body.slide : db.currentSlide;
  if (db.activity !== a || db.slideTitle !== title || db.slideLevel !== level || db.currentSlide !== slide) {
    db.activity = a; db.slideTitle = title; db.slideLevel = level; db.currentSlide = slide; save(); broadcast();
  }
  res.json({ ok: true });
});
app.post('/api/admin/reveal', requireAdmin, (req, res) => {
  const { poll, value } = req.body || {};
  if (!POLLS[poll]) return res.status(400).json({ error: 'Votación inválida.' });
  db.reveal[poll] = value === true; save(); broadcast();
  res.json({ ok: true });
});
app.post('/api/admin/questions/:id', requireAdmin, (req, res) => {
  const q = db.questions.find((x) => x.id === req.params.id);
  if (!q) return res.status(404).json({ error: 'No existe esa pregunta.' });
  if (typeof req.body?.hidden === 'boolean') q.hidden = req.body.hidden;
  if (typeof req.body?.answered === 'boolean') q.answered = req.body.answered;
  save(); broadcast();
  res.json({ ok: true });
});
app.post('/api/admin/reset', requireAdmin, (req, res) => {
  const scope = req.body?.scope;
  if (scope === 'votes' || scope === 'live') { db.votes = {}; db.reveal = {}; db.cloud = {}; }
  if (scope === 'questions' || scope === 'live') db.questions = [];
  if (scope === 'feedback') db.feedback = [];
  if (scope === 'live') db.activity = 'lobby';
  save(); broadcast();
  res.json({ ok: true });
});
app.post('/api/navigate', rateLimit(60, 60000), (req, res) => {
  const { command, slide } = req.body || {};
  let cmd;
  if (command === 'next' || command === 'prev') cmd = { action: command };
  else if (command === 'reset') cmd = { action: 'goto', slide: 0 };
  else if (command === 'goto' && Number.isInteger(slide) && slide >= 0 && slide < TOTAL_SLIDES) cmd = { action: 'goto', slide };
  else return res.status(400).json({ error: 'Comando inválido.' });
  if (![...clients].some((c) => c.role === 'deck')) return res.status(409).json({ error: 'La pantalla de la presentación no está conectada.' });
  sendToDeck(cmd);
  res.json({ ok: true });
});
app.get('/api/slide-state', requireAdmin, (req, res) => {
  res.json({ currentSlide: db.currentSlide });
});
app.get('/api/admin/registrations.csv', requireAdmin, (req, res) => {
  const cols = ['createdAt', 'name', 'email', 'phone', 'institution', 'career', 'interests', 'news', 'event'];
  const esc = (v) => { let s = Array.isArray(v) ? v.join('; ') : String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  const csv = '﻿' + [cols.join(','), ...db.registrations.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\r\n');
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="registros-codexsoto.csv"' }).send(csv);
});

/* ---------- Páginas ---------- */
const pub = path.join(__dirname, 'public');
app.get('/deck', (req, res) => res.sendFile(path.join(pub, 'deck.html')));
app.get('/deck-pln', (req, res) => res.sendFile(path.join(pub, 'deck-pln.html')));
app.get('/deck-n8n', (req, res) => res.sendFile(path.join(pub, 'deck-n8n.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(pub, 'admin.html')));
app.get('/presentacion', (req, res) => res.sendFile(path.join(pub, 'index.html')));
app.use(express.static(pub, { maxAge: '1h', index: 'index.html' }));

app.listen(PORT, () => console.log(`CodexSoto Live escuchando en :${PORT}`));
