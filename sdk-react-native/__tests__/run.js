/* eslint-disable */
// Plain Node tests (no jest): SSE parser, client streaming + fallback (fake XMLHttpRequest / fetch),
// markdown parser, error mapping, and the useBrainboxChat hook via react-test-renderer.
// Run: npm test   (builds lib/ first)
'use strict';
const assert = require('assert');
const path = require('path');
const lib = (p) => require(path.join(__dirname, '..', 'lib', p));
const { SSEParser } = lib('sse');
const { BrainboxClient } = lib('client');
const { BrainboxError, httpError } = lib('errors');
const { parseMarkdown, parseInline, safeHref } = lib('markdown');

let passed = 0;
let failed = 0;
const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ */
/* Fakes                                                               */
/* ------------------------------------------------------------------ */

function makeFakeXHR(script) {
  const instances = [];
  class FakeXHR {
    constructor() {
      this.readyState = 0;
      this.status = 0;
      this.responseText = '';
      this.headers = {};
      this.aborted = false;
      this.resHeaders = {};
      instances.push(this);
    }
    open(method, url) {
      this.method = method;
      this.url = url;
      this.readyState = 1;
    }
    setRequestHeader(k, v) {
      this.headers[k] = v;
    }
    getResponseHeader(k) {
      return this.resHeaders[k.toLowerCase()] || null;
    }
    fire(name) {
      const fn = this['on' + name];
      if (fn) fn.call(this, {});
    }
    abort() {
      if (this.aborted) return;
      this.aborted = true;
      this.status = 0;
      this.readyState = 4;
      this.fire('readystatechange'); // real XHR fires this; the client must ignore it
      this.fire('abort');
    }
    send(body) {
      this.body = body;
      const sc = script(this.url, JSON.parse(body), instances.length);
      (async () => {
        await tick(1);
        if (this.aborted) return;
        if (sc.networkError) {
          this.readyState = 4;
          this.status = 0;
          this.fire('readystatechange');
          this.fire('error');
          return;
        }
        this.status = sc.status;
        this.resHeaders = Object.fromEntries(Object.entries(sc.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
        this.readyState = 2;
        this.fire('readystatechange');
        for (const chunk of sc.chunks || []) {
          await tick(1);
          if (this.aborted) return;
          this.responseText += chunk;
          this.readyState = 3;
          this.fire('readystatechange');
          this.fire('progress');
        }
        if (sc.hang) return;
        await tick(1);
        if (this.aborted) return;
        this.readyState = 4;
        this.fire('readystatechange');
        this.fire('load');
      })();
    }
  }
  FakeXHR.instances = instances;
  return FakeXHR;
}

function makeFakeFetch(handler) {
  const calls = [];
  const f = async (url, init) => {
    calls.push({ url, init, body: init && init.body && typeof init.body === 'string' ? JSON.parse(init.body) : init && init.body });
    const r = await handler(url, init, calls.length);
    if (r instanceof Error) throw r;
    const text = typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
    return { ok: r.status >= 200 && r.status < 300, status: r.status, text: async () => text };
  };
  f.calls = calls;
  return f;
}

const SSE = 'text/event-stream; charset=utf-8';
const ev = (name, data) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
const CHAT_JSON = { response: 'Hello from /api/chat', reasoning: null, search_results: [{ title: 'Doc' }], session_id: 's-1', message_id: 11, user_message_id: 10 };

function collect(client, q, extra = {}) {
  const log = { meta: [], tokens: [], done: null, error: null, fallback: [] };
  const h = client.streamChat(q, {
    ...extra,
    onMeta: (m) => log.meta.push(m),
    onToken: (d, full) => log.tokens.push([d, full]),
    onDone: (r) => (log.done = r),
    onError: (e) => (log.error = e),
    onFallback: (r) => log.fallback.push(r)
  });
  return { h, log };
}

/* ------------------------------------------------------------------ */
/* SSE parser                                                          */
/* ------------------------------------------------------------------ */

test('sse: events split across arbitrary chunk boundaries', () => {
  const p = new SSEParser();
  const raw = ev('meta', { session_id: 'a' }) + ev('token', { t: 'Hel' }) + ev('token', { t: 'lo' }) + ': ping\n\n' + ev('done', { response: 'Hello' });
  const out = [];
  for (let i = 0; i < raw.length; i += 3) out.push(...p.push(raw.slice(i, i + 3)));
  out.push(...p.end());
  assert.deepStrictEqual(out.map((e) => e.event), ['meta', 'token', 'token', 'done']);
  assert.strictEqual(JSON.parse(out[2].data).t, 'lo');
});

test('sse: CRLF, lone CR at chunk end, multi-line data, no space after colon, default event', () => {
  const p = new SSEParser();
  const a = p.push('event:token\r');
  const b = p.push('\ndata:{"t":"x"}\r\n\r\ndata: line1\ndata: line2\n\n');
  const all = [...a, ...b];
  assert.strictEqual(all.length, 2);
  assert.deepStrictEqual(all[0], { event: 'token', data: '{"t":"x"}' });
  assert.deepStrictEqual(all[1], { event: 'message', data: 'line1\nline2' });
});

test('sse: comments ignored, event without data not dispatched, end() flushes', () => {
  const p = new SSEParser();
  assert.deepStrictEqual(p.push(': ping\n\nevent: x\n\n'), []);
  assert.deepStrictEqual(p.push('event: done\ndata: {"a":1}'), []);
  assert.deepStrictEqual(p.end(), [{ event: 'done', data: '{"a":1}' }]);
});

/* ------------------------------------------------------------------ */
/* Client: streaming + fallback                                        */
/* ------------------------------------------------------------------ */

test('client: streams meta/tokens/done over XHR; sends auth, scope and SSE headers', async () => {
  const XHR = makeFakeXHR(() => ({
    status: 200,
    headers: { 'Content-Type': SSE },
    chunks: [ev('meta', { session_id: 's-9', user_message_id: 1 }).slice(0, 20), ev('meta', { session_id: 's-9', user_message_id: 1 }).slice(20) + ev('token', { t: 'Hi ' }), ': ping\n\n' + ev('token', { t: 'there' }), ev('done', { response: 'Hi there!', session_id: 's-9', message_id: 2, search_results: null, cached: false })]
  }));
  const fetch = makeFakeFetch(() => ({ status: 500, body: {} }));
  const c = new BrainboxClient({ apiUrl: 'https://x.test/', apiKey: 'pk_test', tenantId: 't1', user: { id: 'u1', name: 'Ada' }, XMLHttpRequest: XHR, fetch });
  const { h, log } = collect(c, 'hello', { sessionId: 's-9' });
  const res = await h.done;
  assert.strictEqual(fetch.calls.length, 0);
  const x = XHR.instances[0];
  assert.strictEqual(x.url, 'https://x.test/api/chat/stream');
  assert.strictEqual(x.headers.Authorization, 'Bearer pk_test');
  assert.strictEqual(x.headers.Accept, 'text/event-stream');
  assert.deepStrictEqual(JSON.parse(x.body), { tenant_id: 't1', user_id: 'u1', user_name: 'Ada', question: 'hello', session_id: 's-9' });
  assert.deepStrictEqual(log.meta, [{ session_id: 's-9', user_message_id: 1 }]);
  assert.deepStrictEqual(log.tokens, [['Hi ', 'Hi '], ['there', 'Hi there']]);
  assert.strictEqual(log.done.response, 'Hi there!'); // final text replaces streamed text
  assert.strictEqual(res.message_id, 2);
  assert.strictEqual(log.error, null);
});

for (const st of [404, 405]) {
  test(`client: ${st} on /api/chat/stream falls back to POST /api/chat and remembers it`, async () => {
    const XHR = makeFakeXHR(() => ({ status: st, headers: { 'content-type': 'application/json' }, chunks: ['{"detail":"Not Found"}'] }));
    const fetch = makeFakeFetch(() => ({ status: 200, body: CHAT_JSON }));
    const c = new BrainboxClient({ apiUrl: 'https://x.test', apiKey: 'k', XMLHttpRequest: XHR, fetch });
    const { h, log } = collect(c, 'q1');
    await h.done;
    assert.deepStrictEqual(log.fallback, ['unsupported']);
    assert.strictEqual(fetch.calls.length, 1);
    assert.strictEqual(fetch.calls[0].url, 'https://x.test/api/chat');
    assert.strictEqual(fetch.calls[0].init.headers.Authorization, 'Bearer k');
    assert.deepStrictEqual(fetch.calls[0].body, { question: 'q1' });
    assert.deepStrictEqual(log.meta, [{ session_id: 's-1', user_message_id: 10 }]);
    assert.deepStrictEqual(log.tokens, [[CHAT_JSON.response, CHAT_JSON.response]]);
    assert.strictEqual(log.done.message_id, 11);
    assert.ok(c.streamUnsupported);
    // second call skips the stream endpoint entirely
    const second = collect(c, 'q2', { sessionId: 's-1' });
    await second.h.done;
    assert.strictEqual(XHR.instances.length, 1);
    assert.strictEqual(fetch.calls.length, 2);
    assert.deepStrictEqual(fetch.calls[1].body, { question: 'q2', session_id: 's-1' });
  });
}

test('client: 5xx / network error before the first event falls back', async () => {
  for (const sc of [{ status: 502, chunks: ['<html>bad gateway</html>'] }, { networkError: true }]) {
    const XHR = makeFakeXHR(() => sc);
    const fetch = makeFakeFetch(() => ({ status: 200, body: CHAT_JSON }));
    const c = new BrainboxClient({ apiUrl: 'https://x.test', XMLHttpRequest: XHR, fetch });
    const { h, log } = collect(c, 'q');
    const res = await h.done;
    assert.deepStrictEqual(log.fallback, ['error']);
    assert.strictEqual(res.response, CHAT_JSON.response);
    assert.strictEqual(c.streamUnsupported, false);
  }
});

test('client: 200 but stream closes with no events falls back', async () => {
  const XHR = makeFakeXHR(() => ({ status: 200, headers: { 'content-type': SSE }, chunks: [': ping\n\n'] }));
  const fetch = makeFakeFetch(() => ({ status: 200, body: CHAT_JSON }));
  const c = new BrainboxClient({ apiUrl: 'https://x.test', XMLHttpRequest: XHR, fetch });
  const { h, log } = collect(c, 'q');
  await h.done;
  assert.deepStrictEqual(log.fallback, ['error']);
  assert.strictEqual(log.done.response, CHAT_JSON.response);
});

test('client: 200 application/json (e.g. a proxy) is delivered as a whole answer', async () => {
  const XHR = makeFakeXHR(() => ({ status: 200, headers: { 'content-type': 'application/json' }, chunks: [JSON.stringify(CHAT_JSON)] }));
  const fetch = makeFakeFetch(() => ({ status: 500, body: {} }));
  const c = new BrainboxClient({ apiUrl: 'https://x.test', XMLHttpRequest: XHR, fetch });
  const { h, log } = collect(c, 'q');
  await h.done;
  assert.strictEqual(fetch.calls.length, 0);
  assert.strictEqual(log.done.session_id, 's-1');
});

test('client: 401 is reported (no fallback) with a friendly message', async () => {
  const XHR = makeFakeXHR(() => ({ status: 401, headers: { 'content-type': 'application/json' }, chunks: ['{"detail":"Invalid API key"}'] }));
  const fetch = makeFakeFetch(() => ({ status: 200, body: CHAT_JSON }));
  const c = new BrainboxClient({ apiUrl: 'https://x.test', XMLHttpRequest: XHR, fetch });
  const { h, log } = collect(c, 'q');
  assert.strictEqual(await h.done, null);
  assert.strictEqual(fetch.calls.length, 0);
  assert.ok(log.error instanceof BrainboxError);
  assert.strictEqual(log.error.status, 401);
  assert.strictEqual(log.error.code, 'auth');
  assert.strictEqual(log.error.retryable, false);
});

test('client: `error` event after meta is reported, no fallback (avoids a duplicate question)', async () => {
  const XHR = makeFakeXHR(() => ({ status: 200, headers: { 'content-type': SSE }, chunks: [ev('meta', { session_id: 's' }), ev('token', { t: 'par' }), ev('error', { detail: 'LLM failed', status: 503 })] }));
  const fetch = makeFakeFetch(() => ({ status: 200, body: CHAT_JSON }));
  const c = new BrainboxClient({ apiUrl: 'https://x.test', XMLHttpRequest: XHR, fetch });
  const { h, log } = collect(c, 'q');
  await h.done;
  assert.strictEqual(fetch.calls.length, 0);
  assert.strictEqual(log.error.status, 503);
  assert.ok(log.error.retryable);
  assert.strictEqual(log.done, null);
});

test('client: connection dropped mid-answer -> retryable stream error, no fallback', async () => {
  const XHR = makeFakeXHR(() => ({ status: 200, headers: { 'content-type': SSE }, chunks: [ev('meta', { session_id: 's' }), ev('token', { t: 'partial' })] }));
  const fetch = makeFakeFetch(() => ({ status: 200, body: CHAT_JSON }));
  const c = new BrainboxClient({ apiUrl: 'https://x.test', XMLHttpRequest: XHR, fetch });
  const { h, log } = collect(c, 'q');
  await h.done;
  assert.strictEqual(fetch.calls.length, 0);
  assert.strictEqual(log.error.code, 'stream');
  assert.ok(log.error.retryable);
});

test('client: abort() stops the XHR and suppresses all further callbacks', async () => {
  const XHR = makeFakeXHR(() => ({ status: 200, headers: { 'content-type': SSE }, chunks: [ev('meta', { session_id: 's' }), ev('token', { t: 'a' }), ev('token', { t: 'b' }), ev('done', { response: 'ab' })] }));
  const fetch = makeFakeFetch(() => ({ status: 200, body: CHAT_JSON }));
  const c = new BrainboxClient({ apiUrl: 'https://x.test', XMLHttpRequest: XHR, fetch });
  const { h, log } = collect(c, 'q');
  await tick(4); // after meta + first token or so
  h.abort();
  const res = await h.done;
  const tokensAtAbort = log.tokens.length;
  await tick(20);
  assert.strictEqual(res, null);
  assert.ok(XHR.instances[0].aborted);
  assert.strictEqual(log.tokens.length, tokensAtAbort);
  assert.strictEqual(log.done, null);
  assert.strictEqual(log.error, null);
  assert.strictEqual(fetch.calls.length, 0);
});

test('client: abort() during fallback cancels the fetch', async () => {
  const XHR = makeFakeXHR(() => ({ status: 404, chunks: [] }));
  let signal;
  const fetch = makeFakeFetch((url, init) => {
    signal = init.signal;
    return new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')));
    });
  });
  const c = new BrainboxClient({ apiUrl: 'https://x.test', XMLHttpRequest: XHR, fetch });
  const { h, log } = collect(c, 'q');
  await tick(10);
  h.abort();
  assert.strictEqual(await h.done, null);
  await tick(5);
  assert.ok(signal.aborted);
  assert.strictEqual(log.error, null);
});

test('client: streaming:false goes straight to POST /api/chat; fallback error is reported', async () => {
  const XHR = makeFakeXHR(() => assert.fail('XHR must not be used'));
  const fetch = makeFakeFetch(() => ({ status: 401, body: { detail: 'Invalid or missing API key' } }));
  const c = new BrainboxClient({ apiUrl: 'https://x.test', streaming: false, XMLHttpRequest: XHR, fetch });
  const { h, log } = collect(c, 'q');
  await h.done;
  assert.deepStrictEqual(log.fallback, ['disabled']);
  assert.strictEqual(log.error.code, 'auth');
});

test('client: timeout -> friendly retryable error', async () => {
  const XHR = makeFakeXHR(() => ({ status: 200, headers: { 'content-type': SSE }, chunks: [], hang: true }));
  const c = new BrainboxClient({ apiUrl: 'https://x.test', timeout: 30, XMLHttpRequest: XHR, fetch: makeFakeFetch(() => ({ status: 200, body: CHAT_JSON })) });
  const { h, log } = collect(c, 'q');
  await h.done;
  assert.strictEqual(log.error.code, 'timeout');
  assert.ok(log.error.retryable);
});

test('client: REST endpoints, paths, scope and feedback payload', async () => {
  const fetch = makeFakeFetch((url) => {
    if (url.includes('/sessions')) return { status: 200, body: { today: [{ session_id: 'a', title: 'A', created_at: '2026-10-09T10:00:00' }] } };
    if (url.includes('/messages')) return { status: 200, body: { session_id: 'a', messages: [] } };
    if (url.includes('/feedback')) return { status: 200, body: { ok: true } };
    if (url.includes('/health')) return { status: 200, body: { status: 'ok' } };
    return { status: 404, body: { detail: 'Not Found' } };
  });
  const c = new BrainboxClient({ apiUrl: 'https://x.test', apiKey: 'k', tenantId: 't', user: { id: 'u 1', name: 'Ada' }, fetch });
  const g = await c.listSessions();
  assert.deepStrictEqual(Object.keys(g), ['today', 'yesterday', 'this_week', 'older']);
  assert.deepStrictEqual(fetch.calls[0].body, { tenant_id: 't', user_id: 'u 1' });
  await c.getSessionMessages('a/b');
  assert.strictEqual(fetch.calls[1].url, 'https://x.test/api/chat/session/a%2Fb/messages?tenant_id=t&user_id=u%201');
  await c.sendFeedback({ session_id: 'a', message_id: '7', rating: 'down' });
  assert.deepStrictEqual(fetch.calls[2].body, { tenant_id: 't', user_id: 'u 1', session_id: 'a', rating: 'down', message_id: 7 });
  assert.deepStrictEqual(await c.health(), { status: 'ok' });
  await assert.rejects(c.createSession('x').then(() => c.request('GET', '/api/nope')), (e) => e instanceof BrainboxError && e.status === 404);
});

test('client: network failure in fetch -> BrainboxError network, retryable', async () => {
  const c = new BrainboxClient({ apiUrl: 'https://x.test', fetch: makeFakeFetch(() => new TypeError('Network request failed')) });
  await assert.rejects(c.health(), (e) => e.code === 'network' && e.retryable && /reach/.test(e.message));
});

test('errors: httpError mapping', () => {
  assert.strictEqual(httpError(422, { detail: [{ loc: ['body', 'question'], msg: 'field required' }] }).message, 'Invalid request: question: field required');
  assert.strictEqual(httpError(403, { detail: 'tenant_id does not match' }).code, 'forbidden');
  assert.ok(httpError(429, null).retryable);
  assert.ok(httpError(500, { detail: 'Traceback ...' }).message.indexOf('Traceback') === -1);
});

/* ------------------------------------------------------------------ */
/* Markdown                                                            */
/* ------------------------------------------------------------------ */

test('markdown: inline bold/italic/code/links; unsafe schemes are not links', () => {
  const n = parseInline('**Bold** and *it* and _u_ `x*y` [site](https://a.b/c) [bad](javascript:alert(1)) see https://e.x/y. snake_case_name');
  const types = n.map((x) => x.type);
  assert.deepStrictEqual(types.filter((t) => t !== 'text'), ['bold', 'italic', 'italic', 'code', 'link', 'link']);
  assert.strictEqual(n.find((x) => x.type === 'code').text, 'x*y');
  const links = n.filter((x) => x.type === 'link').map((x) => x.href);
  assert.deepStrictEqual(links, ['https://a.b/c', 'https://e.x/y']);
  assert.ok(JSON.stringify(n).includes('snake_case_name'));
  assert.ok(!JSON.stringify(n).includes('javascript:'));
  assert.strictEqual(safeHref('mailto:a@b.c'), 'mailto:a@b.c');
  assert.strictEqual(safeHref('tel:123'), null);
});

test('markdown: blocks — headings, lists, code (closed + unclosed), table, quote', () => {
  const md = '# Title\n\nPara line 1\nline 2\n\n- a\n- b\n  - nested\n\n1. one\n2. two\n\n```js\nconst a = 1;\n```\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n> quoted\n\n```py\nprint(1)';
  const b = parseMarkdown(md);
  assert.deepStrictEqual(b.map((x) => x.type), ['heading', 'paragraph', 'list', 'list', 'code', 'table', 'quote', 'code']);
  assert.strictEqual(b[2].items.length, 3);
  assert.strictEqual(b[2].items[2].indent, 1);
  assert.strictEqual(b[3].ordered, true);
  assert.strictEqual(b[4].lang, 'js');
  assert.strictEqual(b[5].rows.length, 1);
  assert.strictEqual(b[7].code, 'print(1)');
});

/* ------------------------------------------------------------------ */
/* Hook (react-test-renderer, no react-native needed)                  */
/* ------------------------------------------------------------------ */

test('hook: send streams into messages, persists session, feedback, stop, retry, newChat, restore', async () => {
  const React = require('react');
  const TR = require('react-test-renderer');
  const { useBrainboxChat } = lib('useBrainboxChat');
  const { createMemoryStorage } = lib('storage');
  global.IS_REACT_ACT_ENVIRONMENT = true;

  let mode = 'ok';
  const XHR = makeFakeXHR(() => {
    if (mode === 'ok') return { status: 200, headers: { 'content-type': SSE }, chunks: [ev('meta', { session_id: 'S1', user_message_id: 1 }), ev('token', { t: 'Hel' }), ev('token', { t: 'lo' }), ev('done', { response: 'Hello', session_id: 'S1', message_id: 2, search_results: [{ title: 'Doc' }] })] };
    if (mode === 'fail') return { status: 200, headers: { 'content-type': SSE }, chunks: [ev('meta', { session_id: 'S1' }), ev('error', { detail: 'boom', status: 500 })] };
    return { status: 200, headers: { 'content-type': SSE }, chunks: [ev('meta', { session_id: 'S1' }), ev('token', { t: 'slow' })], hang: true };
  });
  const fetch = makeFakeFetch((url) => {
    if (url.includes('/feedback')) return { status: 200, body: { ok: true } };
    if (url.includes('/messages')) return { status: 200, body: { session_id: 'S1', messages: [{ id: 1, role: 'user', content: 'hi', created_at: '2026-10-09T10:00:00' }, { id: 2, role: 'assistant', content: 'Hello', created_at: '2026-10-09T10:00:01' }] } };
    return { status: 404, body: {} };
  });
  const storage = createMemoryStorage();
  const client = new BrainboxClient({ apiUrl: 'https://x.test', XMLHttpRequest: XHR, fetch });
  const events = [];
  let api;
  function Probe() {
    api = useBrainboxChat(client, { storage, onEvent: (n) => events.push(n) });
    return null;
  }
  let r;
  await TR.act(async () => { r = TR.create(React.createElement(Probe)); });
  await TR.act(async () => { await tick(5); });
  assert.ok(api.ready);

  await TR.act(async () => { await api.send('hi'); });
  await TR.act(async () => { await tick(50); });
  assert.strictEqual(api.sending, false);
  assert.strictEqual(api.sessionId, 'S1');
  assert.strictEqual(api.messages.length, 2);
  assert.strictEqual(api.messages[1].text, 'Hello');
  assert.strictEqual(api.messages[1].status, 'done');
  assert.strictEqual(api.messages[1].messageId, 2);
  assert.strictEqual(api.messages[1].searchResults.length, 1);
  assert.strictEqual(await storage.getItem('bb-rn:default:anon:session'), 'S1');
  assert.ok(events.includes('message') && events.includes('response') && events.includes('session'));

  await TR.act(async () => { await api.sendFeedback(api.messages[1].id, 'up'); });
  assert.strictEqual(api.messages[1].feedback, 'up');
  const fb = fetch.calls.find((c) => c.url.endsWith('/api/chat/feedback'));
  assert.deepStrictEqual(fb.body, { session_id: 'S1', rating: 'up', message_id: 2 });

  // error -> canRetry -> retry succeeds without duplicating the user message
  mode = 'fail';
  await TR.act(async () => { await api.send('second'); });
  await TR.act(async () => { await tick(30); });
  assert.ok(api.error && api.canRetry);
  assert.strictEqual(api.messages.filter((m) => m.role === 'user').length, 2);
  mode = 'ok';
  await TR.act(async () => { await api.retry(); });
  await TR.act(async () => { await tick(50); });
  assert.strictEqual(api.error, null);
  assert.strictEqual(api.messages.filter((m) => m.role === 'user').length, 2);
  assert.strictEqual(api.messages[api.messages.length - 1].text, 'Hello');

  // stop keeps partial text as 'stopped'
  mode = 'hang';
  await TR.act(async () => { api.send('third'); await tick(40); });
  assert.ok(api.sending);
  await TR.act(async () => { api.stop(); await tick(5); });
  assert.strictEqual(api.sending, false);
  const last = api.messages[api.messages.length - 1];
  assert.strictEqual(last.status, 'stopped');
  assert.strictEqual(last.text, 'slow');

  // new chat clears and forgets the stored session
  await TR.act(async () => { api.newChat(); await tick(5); });
  assert.strictEqual(api.messages.length, 0);
  assert.strictEqual(api.sessionId, null);
  assert.strictEqual(await storage.getItem('bb-rn:default:anon:session'), null);

  // restore: a stored session id is loaded on mount
  await storage.setItem('bb-rn:default:anon:session', 'S1');
  await TR.act(async () => { r.unmount(); });
  await TR.act(async () => { r = TR.create(React.createElement(Probe)); await tick(20); });
  assert.strictEqual(api.sessionId, 'S1');
  assert.strictEqual(api.messages.length, 2);
  assert.ok(api.messages[0].fromHistory);
  assert.strictEqual(api.messages[0].createdAt, '2026-10-09T10:00:00.000Z'); // naive timestamps are UTC
  await TR.act(async () => { r.unmount(); });
});

/* ------------------------------------------------------------------ */

(async () => {
  for (const t of tests) {
    try {
      await t.fn();
      passed++;
      console.log('  ok   ' + t.name);
    } catch (e) {
      failed++;
      console.log('  FAIL ' + t.name + '\n       ' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join('\n       ') : e));
    }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
