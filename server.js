/* Minimal production static server for Railway. No dependencies.
   - Binds to process.env.PORT on 0.0.0.0
   - Serves this directory; "/" -> index.html, "/dir/" -> dir/index.html
   - Also resolves clean URLs ("/contact" -> contact.html) without changing
     the existing .html URLs
   - Blocks path traversal and dotfiles, returns 404.html for misses
   - GET /healthz -> 200 "ok" for Railway health checks */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.pdf': 'application/pdf', '.bin': 'application/octet-stream',
  '.mpd': 'text/plain; charset=utf-8', '.ldr': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json'
};
const SKIP = new Set(['server.js', 'package.json', 'package-lock.json', 'embed-fonts.py', 'railway.json', 'LICENSE']);

function send(res, status, body, type, extra) {
  const headers = Object.assign({ 'Content-Type': type, 'Content-Length': Buffer.byteLength(body), 'X-Content-Type-Options': 'nosniff' }, extra || {});
  res.writeHead(status, headers);
  res.end(body);
}

function streamFile(req, res, file, status) {
  const ext = path.extname(file).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const stat = fs.statSync(file);
  const immutable = /^\/(assets|projects)\//.test(req.url) && ext !== '.html';
  const headers = {
    'Content-Type': type,
    'Content-Length': stat.size,
    'Last-Modified': stat.mtime.toUTCString(),
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': ext === '.html' ? 'no-cache' : (immutable ? 'public, max-age=86400' : 'public, max-age=3600')
  };
  if (req.headers['if-modified-since'] && new Date(req.headers['if-modified-since']) >= new Date(Math.floor(stat.mtimeMs / 1000) * 1000)) {
    res.writeHead(304, headers); res.end(); return;
  }
  res.writeHead(status || 200, headers);
  if (req.method === 'HEAD') { res.end(); return; }
  fs.createReadStream(file).pipe(res);
}

function notFound(req, res) {
  const page = path.join(ROOT, '404.html');
  if (fs.existsSync(page)) { streamFile(req, res, page, 404); return; }
  send(res, 404, 'Not found', 'text/plain; charset=utf-8');
}

/* Short project URLs: rihaan.net/<name>/... serves projects/<folder>/...
   (the old /projects/<folder>/ URLs keep working). */
const PROJECT_ALIASES = {
  'landing-page': 'rihaan-landing-page',
  'tower-defence-2': 'tower-defence-2',
  'kathleen': 'kathleen',
  'recipe-finder': 'mama-recipe-finder',
  'brickforge': 'lego-brickforge',
  'translator': 'dadu-translator'
};

function resolve(urlPath) {
  const seg = urlPath.split('/')[1];
  if (Object.prototype.hasOwnProperty.call(PROJECT_ALIASES, seg)) {
    urlPath = '/projects/' + PROJECT_ALIASES[seg] + urlPath.slice(seg.length + 1);
  }
  let decoded;
  try { decoded = decodeURIComponent(urlPath); } catch (e) { return null; }
  if (decoded.includes('\0')) return null;
  const rel = path.posix.normalize(decoded).replace(/^(\.\.(\/|$))+/, '');
  if (rel.split('/').some((seg) => seg.startsWith('.') && seg !== '.' && seg !== '')) return null;
  const abs = path.join(ROOT, rel);
  if (!abs.startsWith(ROOT + path.sep) && abs !== ROOT) return null;
  if (SKIP.has(path.relative(ROOT, abs))) return null;

  const candidates = [];
  if (rel.endsWith('/') || rel === '') candidates.push(path.join(abs, 'index.html'));
  else {
    candidates.push(abs);
    if (!path.extname(abs)) { candidates.push(abs + '.html'); candidates.push(path.join(abs, 'index.html')); }
  }
  for (const c of candidates) {
    try { const st = fs.statSync(c); if (st.isFile()) return c; } catch (e) { /* next */ }
  }
  return null;
}

/* ---------------- Contact form -> email (server-side only) ----------------
   POST /api/contact  {name,email,company,topic,message,page}
   Relays through Resend's HTTPS API. The key lives only in the RESEND_API_KEY
   env var on Railway; it is never sent to the browser. Recipient defaults to
   CONTACT_TO. Sender must be a Resend-verified address (CONTACT_FROM). */
const CONTACT_TO = process.env.CONTACT_TO || 'swaruprihaan@gmail.com';
const CONTACT_FROM = process.env.CONTACT_FROM || 'Rihaan Contact <onboarding@resend.dev>';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const rateHits = new Map(); /* ip -> [timestamps] : 5 per 10 min */

function tooMany(ip) {
  const now = Date.now(); const win = 10 * 60 * 1000;
  const list = (rateHits.get(ip) || []).filter((t) => now - t < win);
  list.push(now); rateHits.set(ip, list);
  if (rateHits.size > 5000) rateHits.clear();
  return list.length > 5;
}
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function readJson(req, limit) {
  return new Promise((resolve, reject) => {
    let body = ''; let size = 0;
    req.on('data', (chunk) => { size += chunk.length; if (size > limit) { reject(new Error('too large')); req.destroy(); return; } body += chunk; });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch (e) { reject(new Error('bad json')); } });
    req.on('error', reject);
  });
}

async function handleContact(req, res) {
  const json = (status, obj) => send(res, status, JSON.stringify(obj), 'application/json; charset=utf-8', { 'Cache-Control': 'no-store' });
  if (!RESEND_API_KEY) { console.error('contact: RESEND_API_KEY not set'); json(503, { ok: false, error: 'Email is not configured yet.' }); return; }
  const ip = String(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if (tooMany(ip)) { json(429, { ok: false, error: 'Too many messages. Please try again later.' }); return; }
  let data;
  try { data = await readJson(req, 20 * 1024); } catch (e) { json(400, { ok: false, error: 'Invalid request.' }); return; }
  const name = String(data.name || '').trim().slice(0, 200);
  const email = String(data.email || '').trim().slice(0, 200);
  const company = String(data.company || '').trim().slice(0, 200);
  const topic = String(data.topic || '').trim().slice(0, 100);
  const message = String(data.message || '').trim().slice(0, 5000);
  const page = String(data.page || '').trim().slice(0, 500);
  if (data.website) { json(200, { ok: true }); return; } /* honeypot */
  if (!name || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { json(400, { ok: false, error: 'Please fill in your name, a valid email and a message.' }); return; }

  /* Hidden email draft: visitors only see the form; their answers fill the
     blanks in this template on the server. */
  const TOPICS = { project: 'a project', collab: 'working together', question: 'a question', other: 'something else' };
  const topicText = TOPICS[topic] || 'getting in touch';
  const firstName = name.split(/\s+/)[0];
  const intro = `Hi Rihaan,\n\nMy name is ${name}${company ? ` from ${company}` : ''}, and I'm reaching out about ${topicText}.`;
  const outro = `You can reply to me at ${email}.\n\nThanks,\n${name}`;
  const text = `${intro}\n\n${message}\n\n${outro}\n\n--\nSent from the contact form on ${page || 'rihaan.net'}`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#161616">`
    + `<p>Hi Rihaan,</p>`
    + `<p>My name is <b>${esc(name)}</b>${company ? ` from <b>${esc(company)}</b>` : ''}, and I'm reaching out about <b>${esc(topicText)}</b>.</p>`
    + `<p style="white-space:pre-wrap">${esc(message)}</p>`
    + `<p>You can reply to me at <a href="mailto:${esc(email)}">${esc(email)}</a>.</p>`
    + `<p>Thanks,<br>${esc(name)}</p>`
    + `<hr style="border:0;border-top:1px solid #ddd"><p style="font-size:12px;color:#888">Sent from the contact form on ${esc(page || 'rihaan.net')}</p></div>`;
  const payload = JSON.stringify({ from: CONTACT_FROM, to: [CONTACT_TO], reply_to: email, subject: `${firstName} reached out about ${topicText} (rihaan.net)`, text, html });
  try {
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' }, body: payload });
    if (!r.ok) { console.error('contact: resend', r.status, (await r.text()).slice(0, 300)); json(502, { ok: false, error: 'Could not send right now. Please try again shortly.' }); return; }
    json(200, { ok: true });
  } catch (err) { console.error('contact:', err.message); json(502, { ok: false, error: 'Could not send right now. Please try again shortly.' }); }
}

/* ---------------- Translator -> Anthropic (server-side key) ----------------
   POST /api/translate  {content: [...message content blocks], webFetch: bool}
   The key lives only in the ANTHROPIC_API_KEY env var on Railway. Model,
   max_tokens and tools are fixed here, so the endpoint can only be used the
   way the translator page uses it. The response is Anthropic's SSE stream,
   piped through unchanged. */
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const TRANSLATE_MODEL = process.env.TRANSLATE_MODEL || 'claude-sonnet-4-5';
const translateHits = new Map(); /* ip -> [timestamps] : 30 per hour */

function translateTooMany(ip) {
  const now = Date.now(); const win = 60 * 60 * 1000;
  const list = (translateHits.get(ip) || []).filter((t) => now - t < win);
  list.push(now); translateHits.set(ip, list);
  if (translateHits.size > 5000) translateHits.clear();
  return list.length > 30;
}

async function handleTranslate(req, res) {
  const json = (status, msg) => send(res, status, JSON.stringify({ ok: false, error: msg }), 'application/json; charset=utf-8', { 'Cache-Control': 'no-store' });
  if (!ANTHROPIC_API_KEY) { console.error('translate: ANTHROPIC_API_KEY not set'); json(503, 'The translator is not set up yet.'); return; }
  const origin = req.headers.origin;
  if (origin && !/^https?:\/\/(rihaan\.net|www\.rihaan\.net|localhost(:\d+)?|[a-z0-9-]+\.up\.railway\.app)$/i.test(origin)) { json(403, 'Not allowed.'); return; }
  const ip = String(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if (translateTooMany(ip)) { json(429, 'Too many translations. Please try again in a while.'); return; }
  let data;
  try { data = await readJson(req, 40 * 1024 * 1024); } catch (e) { json(400, e.message === 'too large' ? 'Those files are too big. Try fewer at once.' : 'Invalid request.'); return; }
  const content = data.content;
  if (!Array.isArray(content) || !content.length || content.length > 200 || !content.every((b) => b && ['text', 'image', 'document'].includes(b.type))) { json(400, 'Invalid request.'); return; }

  const body = { model: TRANSLATE_MODEL, max_tokens: 32000, stream: true, messages: [{ role: 'user', content }] };
  const headers = { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' };
  if (data.webFetch) {
    body.tools = [{ type: 'web_fetch_20250910', name: 'web_fetch', max_uses: 3, max_content_tokens: 60000 }];
    headers['anthropic-beta'] = 'web-fetch-2025-09-10';
  }
  const ctrl = new AbortController();
  res.on('close', () => { if (!res.writableFinished) ctrl.abort(); });
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal });
    if (!r.ok) {
      const t = await r.text();
      console.error('translate: anthropic', r.status, t.slice(0, 300));
      let msg = 'Translation failed (' + r.status + '). Please try again.';
      try { const m = JSON.parse(t).error.message; if (m && r.status < 500 && r.status !== 401 && r.status !== 403) msg = m; } catch (e) { /* keep generic */ }
      json(r.status === 429 || r.status === 529 ? 503 : 502, msg); return;
    }
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no', 'X-Content-Type-Options': 'nosniff' });
    const reader = r.body.getReader();
    for (;;) { const { done, value } = await reader.read(); if (done) break; res.write(Buffer.from(value)); }
    res.end();
  } catch (err) {
    if (ctrl.signal.aborted) return;
    console.error('translate:', err.message);
    if (!res.headersSent) json(502, 'Translation failed. Please try again.'); else res.end();
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/translate') {
    if (req.method === 'POST') { handleTranslate(req, res); return; }
    send(res, 405, 'Method not allowed', 'text/plain; charset=utf-8', { Allow: 'POST' }); return;
  }
  if (url.pathname === '/api/contact') {
    if (req.method === 'POST') { handleContact(req, res); return; }
    send(res, 405, 'Method not allowed', 'text/plain; charset=utf-8', { Allow: 'POST' }); return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { send(res, 405, 'Method not allowed', 'text/plain; charset=utf-8', { Allow: 'GET, HEAD' }); return; }
  if (url.pathname === '/healthz') { send(res, 200, 'ok', 'text/plain; charset=utf-8', { 'Cache-Control': 'no-store' }); return; }

  const file = resolve(url.pathname);
  if (!file) { notFound(req, res); return; }

  /* Directory requested without trailing slash: redirect so relative links resolve */
  if (path.basename(file) === 'index.html' && !url.pathname.endsWith('/') && !url.pathname.endsWith('.html')) {
    const target = url.pathname + '/' + url.search;
    res.writeHead(301, { Location: target, 'Cache-Control': 'no-cache' }); res.end(); return;
  }
  try { streamFile(req, res, file); }
  catch (err) { console.error(err); send(res, 500, 'Internal server error', 'text/plain; charset=utf-8'); }
});

server.listen(PORT, HOST, () => console.log(`rihaan.net static server listening on http://${HOST}:${PORT}`));

function shutdown() { server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
