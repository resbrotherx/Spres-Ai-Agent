#!/usr/bin/env node
/*
 * Tiny mock of the Brainbox FastAPI backend for previewing the web SDK.
 * Node built-ins only. Also serves the sdk-web folder as static files.
 *
 *   node examples/mock-server.js            -> http://localhost:8787/examples/floating.html
 *   node examples/mock-server.js --port 9000
 *   node examples/mock-server.js --static-only --port 8788   (static files only, to test CORS)
 *
 * Keywords in a question trigger special behaviour:
 *   "fail"    -> 500 error           "invalid" -> 422 validation error
 *   "auth"    -> 401 error           "slow"    -> answers after 6 seconds
 *   "code"    -> answer with a code block, "table" -> answer with a table
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const PORT = Number(argValue('--port', process.env.PORT || 8787));
const STATIC_ONLY = args.includes('--static-only');
const ROOT = path.resolve(__dirname, '..');
const DELAY = Number(argValue('--delay', 900));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.md': 'text/plain; charset=utf-8'
};

/* ---------------- in-memory data ---------------- */

const sessions = new Map(); // id -> { session_id, title, created_at, user_id, messages: [] }
let messageId = 1;

function iso(msAgo) {
  return new Date(Date.now() - msAgo).toISOString().replace('Z', ''); // naive UTC, like FastAPI
}

function addSession(title, msAgo, userId, pairs) {
  const id = crypto.randomUUID();
  const s = { session_id: id, title, created_at: iso(msAgo), user_id: userId || null, messages: [] };
  (pairs || []).forEach(([q, a], i) => {
    s.messages.push({ id: messageId++, role: 'user', content: q, created_at: iso(msAgo - i * 60000) });
    s.messages.push({ id: messageId++, role: 'assistant', content: a, created_at: iso(msAgo - i * 60000 - 4000) });
  });
  sessions.set(id, s);
  return s;
}

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
addSession('Billing cycle questions', 2 * HOUR, null, [['When is my bill generated?', 'Bills are generated on the **1st of every month** and emailed within 24 hours.']]);
addSession('Reset my password', DAY + 2 * HOUR, null, [['How do I reset my password?', '1. Open **Settings**\n2. Click *Security*\n3. Choose **Reset password**']]);
addSession('Meter reading upload', 3 * DAY, null, [['Can I upload a meter photo?', 'Yes - use the paperclip button to attach a photo of your meter.']]);
addSession('Tariff comparison 2025', 20 * DAY, null, [['Compare tariffs', '| Plan | Price |\n|---|---|\n| Basic | $10 |\n| Pro | $25 |']]);

const ANSWERS = {
  code: [
    'Here is how to call the API from JavaScript:',
    '',
    '```js',
    "const res = await fetch('/api/chat', {",
    "  method: 'POST',",
    "  headers: { 'Content-Type': 'application/json' },",
    "  body: JSON.stringify({ question: 'Hello' })",
    '});',
    'console.log(await res.json());',
    '```',
    '',
    'Use `session_id` to continue a conversation.'
  ].join('\n'),
  table: [
    '### Plan comparison',
    '',
    '| Plan | Price | Support |',
    '|------|-------|---------|',
    '| Basic | $10 | Email |',
    '| **Pro** | $25 | 24/7 chat |'
  ].join('\n'),
  default: [
    'Sure! Here is a quick overview:',
    '',
    '- **Billing** runs on the 1st of each month',
    '- *Payments* can be made by card or bank transfer',
    '- Questions? See [the help center](https://example.com/help)',
    '',
    'Anything else I can help with? <script>alert("xss")</script>'
  ].join('\n')
};

/* ---------------- helpers ---------------- */

function cors(req, res) {
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'Content-Type, Authorization');
}

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(data) });
  res.end(data);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('too large'), { code: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function formField(buf, name) {
  const text = buf.toString('latin1');
  const m = text.match(new RegExp('name="' + name + '"\\r\\n\\r\\n([^\\r]*)'));
  return m ? m[1] : null;
}

function groupSessions(userId) {
  const out = { today: [], yesterday: [], this_week: [], older: [] };
  const now = new Date();
  const startToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  [...sessions.values()]
    .filter((s) => !userId || !s.user_id || s.user_id === userId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .forEach((s) => {
      const t = Date.parse(s.created_at + 'Z');
      const item = { session_id: s.session_id, title: s.title, created_at: s.created_at };
      if (t >= startToday) out.today.push(item);
      else if (t >= startToday - DAY) out.yesterday.push(item);
      else if (t >= startToday - 7 * DAY) out.this_week.push(item);
      else out.older.push(item);
    });
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- API ---------------- */

async function handleApi(req, res, url) {
  const p = url.pathname;
  try {
    if (req.method === 'GET' && p === '/api/health') return json(res, 200, { status: 'ok', mock: true });

    if (req.method === 'POST' && p === '/api/chat') {
      const body = JSON.parse((await readBody(req, 1e6)).toString('utf8') || '{}');
      const q = String(body.question || '');
      const lower = q.toLowerCase();
      if (!q.trim()) return json(res, 422, { detail: [{ loc: ['body', 'question'], msg: 'field required', type: 'value_error' }] });
      await sleep(lower.includes('slow') ? 6000 : DELAY);
      if (lower.includes('fail')) return json(res, 500, { detail: 'Traceback (most recent call last): psycopg2.OperationalError ...' });
      if (lower.includes('invalid')) return json(res, 422, { detail: [{ loc: ['body', 'tenant_id'], msg: 'field required', type: 'value_error.missing' }] });
      if (lower.includes('auth')) return json(res, 401, { detail: 'Invalid API key' });
      let s = body.session_id && sessions.get(body.session_id);
      if (body.session_id && !s) return json(res, 404, { detail: 'Session not found' });
      if (!s) {
        const question = q.replace(/^Context:[\s\S]*?\n\nQuestion:\n/, '');
        s = addSession(question.slice(0, 40) || 'New chat', 0, body.user_id);
      }
      const answer = lower.includes('code') ? ANSWERS.code : lower.includes('table') ? ANSWERS.table : ANSWERS.default;
      s.messages.push({ id: messageId++, role: 'user', content: q, created_at: iso(0) });
      s.messages.push({ id: messageId++, role: 'assistant', content: answer, created_at: iso(0) });
      return json(res, 200, { response: answer, reasoning: 'mock', search_results: [], session_id: s.session_id });
    }

    if (req.method === 'POST' && p === '/api/chat/sessions') {
      const body = JSON.parse((await readBody(req, 1e5)).toString('utf8') || '{}');
      await sleep(200);
      return json(res, 200, groupSessions(body.user_id));
    }

    if (req.method === 'POST' && p === '/api/chat/session') {
      const body = JSON.parse((await readBody(req, 1e5)).toString('utf8') || '{}');
      const s = addSession(body.title || 'New chat', 0, body.user_id);
      return json(res, 200, { session_id: s.session_id, title: s.title, created_at: s.created_at, user_id: s.user_id });
    }

    const m = p.match(/^\/api\/chat\/session\/([^/]+)\/messages$/);
    if (req.method === 'GET' && m) {
      await sleep(250);
      const s = sessions.get(decodeURIComponent(m[1]));
      if (!s) return json(res, 404, { detail: 'Session not found' });
      return json(res, 200, { session_id: s.session_id, title: s.title, created_at: s.created_at, messages: s.messages });
    }

    if (req.method === 'POST' && (p === '/api/chat/upload/file' || p === '/api/chat/upload/image')) {
      const buf = await readBody(req, 10 * 1024 * 1024 + 4096);
      const field = p.endsWith('image') ? 'image' : 'file';
      const fm = buf.toString('latin1').match(new RegExp('name="' + field + '"; filename="([^"]*)"'));
      if (!fm) return json(res, 422, { detail: [{ loc: ['body', field], msg: 'field required' }] });
      const sid = formField(buf, 'session_id');
      const s = sid && sessions.get(sid);
      if (s) s.messages.push({ id: messageId++, role: 'user', content: 'Uploaded file: ' + fm[1], created_at: iso(0) });
      await sleep(400);
      return json(res, 200, { status: 'success', filename: fm[1], size: buf.length, message: 'File uploaded successfully' });
    }

    if (req.method === 'POST' && p === '/api/ingest') return json(res, 200, { status: 'queued', mock: true });

    return json(res, 404, { detail: 'Not Found' });
  } catch (err) {
    if (err && err.code === 413) return json(res, 413, { detail: 'File size exceeds 10.0MB limit' });
    return json(res, 500, { detail: String(err && err.message) });
  }
}

/* ---------------- static files ---------------- */

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/examples/index.html';
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (!STATIC_ONLY && url.pathname.startsWith('/api/')) {
    cors(req, res);
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    return handleApi(req, res, url);
  }
  return serveStatic(req, res, url);
});

server.listen(PORT, () => {
  console.log((STATIC_ONLY ? 'Static server' : 'Brainbox mock API + static server') + ' on http://localhost:' + PORT);
  if (!STATIC_ONLY) console.log('Open http://localhost:' + PORT + '/examples/floating.html');
});
