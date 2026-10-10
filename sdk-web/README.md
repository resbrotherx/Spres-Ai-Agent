# Brainbox Web SDK (`spres-web`) v2.2

A single, dependency-free JavaScript file that adds the Brainbox AI chat assistant to any website:
plain HTML, WordPress, Odoo, or any JavaScript app. It includes:

- **`Brainbox.init()`**: an embeddable chat widget with four layouts (floating, sidebar, inline, page).
- **`Brainbox.Client`**: a headless API client you can use without any UI. It works in the browser and in Node 18+.
- **v1 compatibility**: `BrainboxWebSDK` and `BrainboxWebWidget` still work, so existing embeds keep running.

New in 2.2: **default design restored to the original pop-up; shadows removed.** The widget is back to the
"omago" look (lavender frosted glass, purple orb logo, `#b93fff` accent, pill launcher) with no drop shadows
anywhere: separation comes from translucent borders. Everything added in 2.1 is kept and restyled to match.

New in 2.1: light / dark / auto themes (dark is a deep aubergine variant of the omago palette), **real token streaming**
over `POST /api/chat/stream` with a Stop button and automatic fallback to `POST /api/chat`, subtle UI sounds,
toasts, thumbs up/down feedback, a "Sources" disclosure, an unread badge on the launcher, grouped messages with
day separators, skeleton loading and a full-screen sheet on phones.

The widget scopes all of its CSS under `.bb-web-root`, takes every theme value from CSS custom properties, and
resets fonts, buttons and inputs inside its root. Host CSS such as Bootstrap or Odoo therefore does not leak in.
Configuration strings are inserted with `textContent`, and assistant replies go through a safe markdown renderer
that never uses `innerHTML`.

---

## Quick start (plain HTML)

```html
<script src="https://your-server.example.com/sdk/brainbox-web-sdk.js"></script>
<!-- or from a CDN after publishing: https://cdn.jsdelivr.net/npm/spres-web@2 -->
<script>
  const bb = Brainbox.init({
    apiUrl: 'https://api.example.com',   // your Brainbox backend (or a same-origin proxy, see below)
    apiKey: 'YOUR_API_KEY',              // omit when using a proxy
    tenantId: 'YOUR_TENANT_ID',          // omit when the proxy injects it
    user: { id: '42', name: 'Ada Lovelace', email: 'ada@example.com' },
    branding: { botName: 'Acme Assistant', subtitle: 'Ask us anything' }
  });
</script>
```

A round launcher (56px, brand gradient) appears in the bottom-right corner. Clicking it opens the chat window.

With npm, `npm install spres-web`, then `require('spres-web')` or `import Brainbox from 'spres-web'`.
The module exports the same `Brainbox` object, and in a browser it also sets `window.Brainbox`.

---

## Modes

| Mode | What it renders | Needs `container` |
|---|---|---|
| `floating` (default) | Launcher in a corner. The 360×560 window opens above it. Below 576px it becomes a full-screen sheet (safe-area aware). | no |
| `sidebar` | A fixed panel on the right at full height. While open it pushes the page with `padding-right` (on viewports 992px and wider; below that it overlays the page). | no |
| `inline` | The chat panel fills the container. There is no launcher and no close button. | yes |
| `page` | Full layout: a conversation sidebar (New chat, search, sessions grouped Today / Yesterday / This week / Older) and the main chat with a hero greeting and prompt cards. Below 760px of container width, the sidebar becomes a drawer. | yes |

```js
// Floating (default)
Brainbox.init({ apiUrl, apiKey, tenantId });

// Sidebar under a 46px top bar. Users can switch between sidebar and floating with the dock button.
Brainbox.init({ apiUrl, apiKey, tenantId, mode: 'sidebar', sidebarTop: 46, defaultOpen: true,
                allowedModes: ['sidebar', 'floating'] });

// Inline inside an element. The container needs a height.
Brainbox.init({ apiUrl, apiKey, tenantId, mode: 'inline', container: '#support-chat', allowedModes: ['inline'] });

// Full page
Brainbox.init({ apiUrl, apiKey, tenantId, mode: 'page', container: '#assistant', allowedModes: ['page'],
                quickActions: [{ title: 'Compare plans', description: 'Put the plans in a table', prompt: 'Compare the plans' }] });
```

You can run several instances on one page, for example an inline panel plus a floating widget. Give each one its
own `storageKey` so they keep separate conversations.

---

## All options

| Option | Default | Description |
|---|---|---|
| `apiUrl` | `''` | Backend base URL. The SDK calls `${apiUrl}/api/...`. It can be a same-origin proxy path such as `'/brainbox_ai/proxy'`. |
| `apiKey` | – | Sent as `Authorization: Bearer <key>`. Omit it when you use a proxy. |
| `tenantId` | – | Sent as `tenant_id`, but only when set. A proxy can inject it instead. |
| `user` | `{}` | `{ id, name, email, avatarUrl }`. `id` is sent as `user_id` and `name` as `user_name`. The name is used in greetings and avatars. |
| `headers` | `{}` | Extra headers on every request, for example a CSRF token or a proxy marker. |
| `credentials` | `'same-origin'` | `fetch` credentials: `'omit'`, `'same-origin'` or `'include'`. |
| `timeout` | `200000` | Request timeout in ms. `/api/chat` can take about 180s. |
| `mode` | `'floating'` | One of `'floating'`, `'sidebar'`, `'inline'` or `'page'`. |
| `container` | – | Element or selector. Required for `inline` and `page`. |
| `position` | `'bottom-right'` | Floating launcher corner: `'bottom-right'` or `'bottom-left'`. |
| `offset` | `{ x: 24, y: 24 }` | Distance from the corner, in px. |
| `zIndex` | `9999` | z-index for the floating and sidebar layers. |
| `width` / `height` | `360` / `560` | Floating window size. The window is always capped to the viewport. |
| `sidebarWidth` | `380` | Sidebar width. |
| `sidebarTop` | `0` | Top offset of the sidebar, for example a fixed navbar height. |
| `sidebarPushContent` | `document.body` | Element or selector that gets `padding-right` while the sidebar is open. Use `null` to never push. |
| `defaultOpen` | `false` | Open on first load. After that, the user's last open or closed state is remembered. |
| `launcher` | `{ type: 'button', text: 'Chat' }` | `type` is `'button'` (purple gradient pill with `text`, the default), `'icon'` (56px circle), `'gif'` (uses `gifUrl`) or `'none'` (open it from your own UI with `bb.open()`). An unread badge appears when a reply arrives while the widget is closed. |
| `theme` | `{ mode: 'light' }` | `mode`: `'light'`, `'dark'` or `'auto'` (follows `prefers-color-scheme` live). `primary` overrides the accent colour (default `#b93fff`); the light / dark gradient stops and translucent tints of the orb, launcher, send button and pills are derived from it. Optional: `radius` (window corner, default 22), `fontFamily`, and the light-mode-only overrides `panel` (window background, default `#fbf1ff`) and `ink` (text, default `#08080a`). Dark mode uses an aubergine panel (`#1a1022`) with lavender accents. |
| `branding` | `{ botName: 'Brainbox AI', subtitle: 'Typically replies in seconds' }` | Also accepts `title` (header, defaults to `botName`), `logoUrl` (header logo; default is the purple Brainbox orb) and `botAvatarUrl` (bot avatar; defaults to `logoUrl`, then the orb). |
| `welcomeMessages` | `["I'm {{botName}}. Ask me anything ..."]` | Intro bubbles shown before the first message (bot name and time, these lines, then the quick-action pills). `{{name}}` is the user's first name, or "there" when no name is set. `{{botName}}` is also replaced. |
| `quickActions` | `[]` | Strings, or `{ title, description, prompt, icon }` objects. Clicking one sends it. In `page` mode they render as prompt cards. |
| `placeholder` | `'Type message...'` | Composer placeholder. |
| `features` | `{ history: true, upload: true, emoji: true, modeSwitch: true, newChat: true, export: false, feedback: true }` | Turns UI features on or off. `export` downloads the conversation as a `.txt` file. `feedback` shows thumbs up/down under answers (`POST /api/chat/feedback`). |
| `allowedModes` | `['floating', 'sidebar']` | Modes the user can cycle through with the header dock/undock button. The button appears only when the current mode is in this list and the list has at least two usable modes. |
| `page` | `{ greeting: 'Hello, {{name}}', heading: 'How can I help you today?' }` | Hero text for `page` mode. |
| `streaming` | `true` | Stream answers token by token from `POST /api/chat/stream`. When the server has no streaming endpoint (404/405) the SDK falls back to `POST /api/chat` automatically and remembers that for the page. `false` always uses `/api/chat`. |
| `sounds` | `true` | Subtle WebAudio UI sounds (send, receive, notify, success, error). No audio files; nothing plays before the first user gesture or while the tab is hidden (except `notify`). Users can mute them with the speaker button in the header (remembered per `storageKey`). `false` disables sounds and hides the button. |
| `context` | – | `() => string \| null` (it may also be async). The returned text is prepended to the question as `Context: ... Question: ...`, for example details of the record being viewed. Only the question is shown in the chat. |
| `storageKey` | `'bb-web'` | localStorage namespace, combined with the tenant and user ID. It stores the last session ID, the open state and the user's mode choice. |
| `locale` | browser default | Locale used to format times. |
| `onEvent` | – | `(name, detail) => {}`. Receives every event (see below). |

## Methods

```js
bb.open(); bb.close(); bb.toggle(); bb.isOpen();
bb.setMode('sidebar'); bb.getMode();      // saves the user's choice when the mode is in allowedModes
bb.send('Hello');                         // Promise resolving to the final answer (stream `done` payload or /api/chat JSON), or null on error / stop / busy
bb.stop();                                // stops the answer being generated (keeps the text so far)
bb.newChat();                             // cancels an in-flight request and starts a fresh conversation
bb.loadSession(sessionId);                // loads a past conversation
bb.updateConfig({ theme: { primary: '#0f9d76' } }); // re-renders and keeps the conversation and draft
bb.destroy();                             // removes the DOM, listeners and sidebar padding
const off = bb.on('response', d => {});   // returns an unsubscribe function
bb.getSessionId(); bb.getMessages();      // read-only helpers (messages include messageId and rating)
bb.setSoundEnabled(false); bb.isSoundEnabled();
bb.toast({ type: 'success', title: 'Saved', body: 'Optional text', action: { label: 'Undo', onClick } });
bb.client;                                // the Brainbox.Client this widget uses
```

## Events

Every event goes to `bb.on(name, fn)` listeners and to `onEvent(name, detail)`.

| Event | Detail |
|---|---|
| `ready` | `{ mode }` |
| `open` / `close` | `{ mode }` |
| `message` | `{ text, sessionId }`: the user sent a message |
| `response` | `{ text, sessionId, reasoning, searchResults, messageId, streamed, raw }` |
| `stop` | `{ sessionId, text }`: the user stopped a streaming answer |
| `feedback` | `{ messageId, rating, sessionId }` after a thumbs up/down was saved |
| `unread` | `{ count }`: a reply arrived while the widget was closed |
| `soundchange` | `{ enabled }` |
| `error` | `{ message, action, status, code }`. `action` is `'chat'`, `'session'` or `'upload'`. |
| `modechange` | `{ mode, previous }` |
| `session` | `{ sessionId, title? }`: a new or loaded conversation. `sessionId` is `null` after `newChat()`. |
| `upload` | `{ file: { name, size, type }, sessionId, raw }` |
| `export`, `destroy` | – |

## Behaviour

- **Streaming.** The widget posts to `/api/chat/stream` and reads the Server-Sent Events with `fetch` +
  `ReadableStream` (so auth headers work; `EventSource` can't send them). Events: `meta` (session id),
  `token` (`{ t }`, appended live with a blinking caret), `done` (final text, `message_id`, `search_results`) and
  `error`; `: ping` comments are ignored and events may be split across network chunks. While an answer streams,
  Send turns into **Stop** (AbortController). Typing dots show until the first token. If the endpoint is missing
  (404 "Not Found" / 405) the same request goes to `/api/chat`, so older servers keep working. A `200` JSON answer
  from a non-streaming proxy is also accepted. One request runs at a time; a new chat or loading a session cancels it.
- **Feedback and sources.** Each answer has copy and thumbs up/down buttons (shown on hover, always on the latest
  answer and on touch screens) that call `POST /api/chat/feedback { session_id, message_id, rating }`; a toast
  confirms. When the answer has `search_results`, a "N sources" button opens the list of sources.
- **Messages** from the same sender within 5 minutes are grouped (avatar once, 2px gap). Day separators ("Today",
  "Yesterday", weekday or date) are inserted, the time shows at the end of a group and on hover.
- **Toasts** (upload done, feedback saved, upload or feedback errors) appear above the composer, auto-dismiss after
  4 s (errors 6 s, hovering pauses), at most 3 at a time, announced via `aria-live`.
- **Dark mode.** `theme.mode: 'dark'` or `'auto'`. All colours are CSS custom properties (`--bb-accent`,
  `--bb-surface`, `--bb-label`, ...) on `.bb-web-root`; the dark palette is applied with the `.bb-web-dark` class.
- **Errors** appear as a friendly inline banner with **Retry**. Raw JSON and stack traces are never shown. A network
  failure shows "Can't reach the assistant right now."
- **History.** The last session ID is saved and its messages are restored the first time the widget opens. The
  history view lists your conversations, grouped by date and searchable.
- **Uploads.** The paperclip button sends images (`jpeg`, `png`, `gif`, `webp`) to `/api/chat/upload/image` and
  other files to `/api/chat/upload/file`. The maximum size is 10 MB. A session is created first if needed.
- **Markdown.** Supports bold, italic, inline code, fenced code blocks (with a language label and a copy button),
  bullet and numbered lists, headings, simple pipe tables, and links. Links open in a new tab with
  `rel="noopener noreferrer"` and only `http`, `https` and `mailto` URLs are allowed.
- **Accessibility.** Enter sends and Shift+Enter adds a new line. Escape closes the floating window or the sidebar.
  Escape also leaves the history view and closes the emoji picker. The composer is focused when the widget opens.
  The message list is an `aria-live="polite"` log (busy while streaming; the finished answer is announced once).
  Icon buttons have aria-labels, keyboard focus shows a 3px focus ring, and `prefers-reduced-motion` switches all
  motion to short opacity fades.
- **Timestamps.** Backend timestamps without a timezone are treated as UTC.

---

## Proxy mode (recommended for production)

Any `apiKey` you put in public HTML can be read by every visitor. In production, keep the key on your server:

1. Add a small endpoint on your own domain, for example `/brainbox_ai/proxy/api/*`. It checks the logged-in user,
   adds `Authorization: Bearer <secret key>` and `tenant_id` (and `user_id` if you want per-user history), then
   forwards the request to the Brainbox backend.
2. Point the widget at it and leave the secrets out:

```js
Brainbox.init({
  apiUrl: '/brainbox_ai/proxy',            // same origin, so no CORS
  headers: { 'X-CSRF-Token': csrfToken },  // whatever your proxy expects
  credentials: 'same-origin',              // sends the session cookie
  user: { name: currentUser.name }         // no id, so the proxy sets user_id from the session
});
```

When `tenantId` or `user.id` is not set, the SDK does not send `tenant_id` or `user_id`, so the proxy decides
their values. This also stops users from reading another user's history.

## Headless client

```js
const client = new Brainbox.Client({ apiUrl, apiKey, tenantId, user, headers, credentials });
const { response, session_id } = await client.chat('Hello', null /* sessionId */, 'optional context');
const done = await client.chatStream('Hello', sessionId, null, {   // POST /api/chat/stream, falls back to /api/chat
  onMeta: (meta) => {}, onToken: (t, fullText) => {}, signal: abortController.signal
});                                      // { response, message_id, search_results, session_id, streamed, ... }
await client.sendFeedback({ session_id, message_id, rating: 'up' });
await client.listSessions();             // { today, yesterday, this_week, older }
await client.getSessionMessages(id);     // { session_id, title, created_at, messages: [...] }
await client.createSession('Title');
await client.uploadFile(file, sessionId); await client.uploadImage(file, sessionId);
await client.health();
await client.request('POST', '/api/custom', { body: {} });  // low-level helper
```

Errors are `Brainbox.BrainboxError` objects with a user-friendly `message`, plus `status`, `code`
(`network`, `timeout`, `aborted`, `http_500`, ...), `detail` (the raw backend detail) and `retryable`.

---

## Migrating from v1

v1 code keeps working, because the old globals are now a thin layer on top of v2:

```js
const sdk = new BrainboxWebSDK(apiUrl, apiKey, tenantId);  // ingest, chat, createChatSession, listSessions, healthCheck, streamChat
new BrainboxWebWidget({ sdk, position: 'bottom-right', primaryColor: '#2563EB', buttonText: 'Help' });
```

What changed:

- `BrainboxWebSDK` methods now **reject with a `BrainboxError`** on HTTP or network errors. In v1 they resolved with
  the error JSON. Successful calls return the same JSON as before.
- `streamChat()` now really streams: `onChunk` is called for every token from `/api/chat/stream`, then `onComplete`
  with the final result. Against a server without the streaming endpoint it calls `onChunk` once with the whole answer.
- `BrainboxWebWidget` options are mapped to v2: `primaryColor` to `theme.primary`, `accentColor` to `theme.ink`,
  `backgroundColor` to `theme.panel` (pure white is ignored so the v2 look applies), `buttonText` to `launcher.text`,
  `launcherType` to `launcher.type`, `title` and `subtitle` to `branding`, and `width`, `height` and `placeholder`
  as-is. Use `position: 'inline'` together with `containerId` to render inline. Otherwise the widget floats as in v1.
- Closing the window now hides it instead of destroying it, so the conversation survives. The widget also gains
  history, new chat, uploads, an error banner with retry, and safe markdown.

Moving to the v2 API:

```js
// v1
const sdk = new BrainboxWebSDK(url, key, tenant);
new BrainboxWebWidget({ sdk, primaryColor: '#2563EB', buttonText: 'Help', title: 'Support' });
// v2
Brainbox.init({ apiUrl: url, apiKey: key, tenantId: tenant,
                theme: { primary: '#2563EB' }, launcher: { text: 'Help' }, branding: { botName: 'Support' } });
```

v1 widgets keep their pill launcher (`launcherType` defaults to `'button'` there) and their `primaryColor`.

### Upgrading to 2.3

- **Default colour is now blue** (`#2563eb` on a `#f3f6fd` panel). Pass `theme: { primary, panel }` to use your brand colours.
- **Icon-only launcher by default:** `launcher.type` defaults to `'auto'` — a round button with a chat icon until you set
  `launcher.text`, then a pill with that text. `type: 'button'` / `'icon'` / `'gif'` still force a style.
- **Centred start screen:** orb, bot name, welcome lines and quick-action pills in the middle of the window.
- **Code blocks** look like a code editor (Sublime/Monokai colours, line numbers, window dots, Copy).

### Upgrading to 2.2

No API changes. The default design is the original pop-up again (lavender glass, purple orb, `#b93fff`,
pill launcher, 360×560 window, intro bubbles with quick-action pills, History pill in the composer), and all
box-shadows / drop shadows were removed from the window, launcher, popovers, toasts and buttons. Keyboard focus
rings are outlines. Hosts that pass `theme.primary`, `launcher.type`, `width` / `height` keep what they set.

### Upgrading from 2.0 to 2.1

Everything is backwards compatible. 2.1 briefly shipped a different default look (blue accent, icon launcher,
380×600); 2.2 reverts that. `theme.panel` / `theme.ink` only apply in light mode.

---

## Examples and local preview

```bash
node examples/mock-server.js        # mock backend + static files on http://localhost:8787
# open http://localhost:8787/examples/  (floating, sidebar, inline + floating, page, v1-compat)
```

The mock implements every endpoint above using only Node built-ins. Some keywords in a question change its
behaviour: `code`, `table`, `slow` (6 s), `fail` (500, or an SSE `error` event mid-stream), `invalid` (422), `auth` (401)
and `nostream` (the stream endpoint answers 404, to test the fallback). The mock streams one token every ~30 ms
(`--token-ms`), sends `: ping` comments, splits some events across writes and implements `/api/chat/feedback`.
Append `?theme=dark` or `?theme=auto` to any example URL. To test cross-origin
requests, serve the pages from a second port with `node examples/mock-server.js --static-only --port 8788`.

## Build

`brainbox-web-sdk.js` is the readable source and is served as-is. `npm run build` writes
`dist/brainbox-web-sdk.min.js` with terser, and the `unpkg` and `jsdelivr` fields point to that file.
Supports evergreen browsers (ES2018).
