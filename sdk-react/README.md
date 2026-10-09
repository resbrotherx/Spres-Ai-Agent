# Brainbox React SDK

A React UI SDK for Brainbox that includes built-in chat designs, a support bot, and streaming-ready backend communication.

## Installation

```bash
npm install spres-react
# or
yarn add spres-react

npm run build
npm run dev
```



## Deployment

`npm install spres-react` or `yarn add spres-react` only installs the library into your React project. It does not automatically deploy a live chat UI to a server.

To use the React UI:

1. Install the package in your React app.
2. Import `ChatWidget`, `ChatPanel`, or `useBrainboxChat`.
3. Build your app with your normal React build command (`npm run build`, `yarn build`, etc.).
4. Deploy the built frontend to your hosting platform or CDN.

The SDK provides client-side chat components. Your app must be served to users in a browser before the chat UI becomes live.

## What it includes

- `BrainboxReactSDK` class for API calls, including **real token streaming** (`streamChat`)
- `ChatWidget` — floating assistant (launcher + window, full-screen sheet on phones)
- `ChatPanel` — full-page chat with a sessions sidebar, search and an empty state with prompt cards
- `TrainingPanel` — upload / connect / paste training data and manage sources
- `useBrainboxChat` hook — streaming chat state for custom UIs
- `MessageContent`, `TypingIndicator`, `BrainboxLogo`, `playSound` building blocks
- One Apple-style design system (light / dark / auto, UI sounds, reduced-motion aware, accessible)

## Quick Start

```tsx
import { BrainboxReactSDK, ChatWidget } from 'spres-react';

const sdk = new BrainboxReactSDK(
  'https://api.yourbackend.com',
  'pk_live_…'          // publishable key for browsers
);

export function App() {
  return <ChatWidget sdk={sdk} />;
}
```

### Next.js (App Router)

All UI modules ship with a `"use client"` directive, so you can import them from a Server Component file and render
them directly. Create the SDK instance in a client component (or a module only imported by one):

```tsx
'use client';
import { BrainboxReactSDK, ChatWidget } from 'spres-react';
const sdk = new BrainboxReactSDK(process.env.NEXT_PUBLIC_BRAINBOX_URL!, process.env.NEXT_PUBLIC_BRAINBOX_PK!);
export default function Support() {
  return <ChatWidget sdk={sdk} mode="auto" />;
}
```

Styles are injected at runtime (once per component type), so there is no CSS file to import.

## Floating widget — `ChatWidget`

```tsx
<ChatWidget
  sdk={sdk}
  position="bottom-right"          // bottom-left | top-right | top-left | center
  mode="auto"                      // 'light' (default) | 'dark' | 'auto' (follows the OS)
  sounds                           // send / receive / error tones (default true, users can mute in the header)
  primaryColor="#0071E3"           // accent: user bubbles, send button, focus ring
  accentColor="#5E5CE6"            // second stop of the launcher gradient
  launcherType="icon"              // 'icon' (default gradient circle) | 'button' (pill + buttonText) | 'gif' (launcherGifUrl)
  buttonText="Chat"
  companyName="Acme Support"       // header title
  companyDescription="Typically replies in seconds"
  logoUrl="/logo.png"              // header + welcome logo (defaults to the Brainbox mark)
  avatarGifUrl="/bot.gif"          // assistant avatar
  user={{ name: 'Sarah Connor' }}  // personalises the greeting
  placeholder="Ask a question…"
  width="380px" height="600px"     // default 380×600
  showFileUpload showImageUpload   // composer attachments (default off in the widget)
  showVoiceInput                   // Chat / Voice mode switch
  showExportButton                 // export the conversation as JSON
  showFeedback                     // 👍/👎 under answers (default true)
  onOpenChange={(open) => {}}
/>
```

What you get: header with logo, online status and icon buttons (new chat, history, mute, expand, close); grouped
messages with day separators and hover timestamps; streaming text with a caret and a **Stop** button; copy and 👍/👎 on
every answer (sent to `/api/chat/feedback` with the stored `message_id`; 👎 becomes a knowledge gap for staff); a
"Sources" disclosure when the answer used the knowledge base; toasts; an unread badge on the launcher when a reply
arrives while the window is closed; Escape to close; full-screen sheet under 576 px.

Copy can be customised with `data` / `manualData`:

```tsx
<ChatWidget
  sdk={sdk}
  data={{
    greeting: 'Hi {{name}} 👋',
    introMessages: ['I can answer questions about billing and your account.'],
    quickActions: ['Where is my invoice?', { label: 'Talk to a human', prompt: 'I want to talk to support', icon: 'help' }],
    composer: { placeholder: 'Type a message…' }
  }}
/>
```

## Full-page chat — `ChatPanel`

```tsx
import { ChatPanel } from 'spres-react';

<div style={{ height: '100vh' }}>
  <ChatPanel
    sdk={sdk}
    mode="light"                    // users can also toggle dark mode from the top bar
    companyName="Acme"
    headerText="How can I help you today?"
    user={{ name: 'Sarah Connor', email: 'sarah@acme.com' }}
    data={{ promptCards: [{ title: 'Billing', description: 'Explain my last bill', prompt: 'Explain my last bill', icon: 'doc' }] }}
    showExportButton showFileUpload showImageUpload showVoiceInput
  />
</div>
```

The panel fills its parent (`height` prop, default `100%`). The sidebar lists sessions grouped by date with search and
"New chat"; under 860 px it becomes a drawer.

## Customization options

| Prop | Applies to | Notes |
|---|---|---|
| `mode` | all | `'light'` (default), `'dark'`, `'auto'` |
| `sounds` | all | UI sounds, default `true` (Web Audio, no files; muted while the tab is hidden) |
| `primaryColor` / `accentColor` / `backgroundColor` | all | accent, gradient end, surface |
| `border`, `borderRadius` | widget | window border / radius (default 18px) |
| `position`, `launcherType`, `launcherGifUrl`, `buttonText`, `width`, `height`, `defaultOpen`, `onOpenChange`, `zIndex` | widget | |
| `logoUrl`, `logoText`, `companyName`, `companyDescription`, `headerText`, `avatarGifUrl`, `user`, `bot` | all | branding |
| `placeholder`, `newChatButtonText`, `searchPlaceholder`, `sidebarTitle` | all / panel | copy |
| `showExportButton`, `showVoiceInput`, `showFileUpload`, `showImageUpload`, `showFeedback` | all | features |
| `initialSessionId` | all | open this session on mount |
| `persistSession` | all | remember the last session per API URL + tenant + user in `localStorage` (default `true`) |
| `data` / `manualData` | all | copy overrides (see above) |
| `design` | — | deprecated, ignored (there is one design) |

## Platform compatibility

- React 18+ and Next.js (Pages or App Router — components are marked `"use client"`).
- Angular / plain HTML / Odoo / jQuery: use the `sdk-web` widget.
- React Native: use `brainbox-react-native-sdk`.

## Streaming

`sdk.streamChat()` calls `POST /api/chat/stream` with `fetch` + `ReadableStream` and parses Server-Sent Events
(`meta`, `token`, `done`, `error`; `: ping` heartbeats are ignored). Auth headers are the same as every other call
(including token-getter functions). If the server answers **404/405** (no streaming endpoint yet) the SDK falls back
to `POST /api/chat` and remembers that for the rest of the session — the UI works the same either way.

```ts
const controller = new AbortController();
await sdk.streamChat(
  'How do I export invoices?',
  sessionId,                                  // or undefined for a new session
  (token) => render(token),                   // each text delta
  (result) => done(result),                   // { response, session_id, message_id, search_results, cached }
  (err) => showError(err.message),            // BrainboxApiError
  { signal: controller.signal, onMeta: (m) => setSession(m.session_id) }
);
controller.abort();                            // "stop generating": no callbacks fire after abort
```

## Using the SDK class directly

```tsx
import { BrainboxReactSDK } from 'spres-react';

const sdk = new BrainboxReactSDK('https://api.yourbackend.com', 'YOUR_API_KEY');

const chatResponse = await sdk.chat('What happened?');            // non-streaming
const session = await sdk.createChatSession('Support Session');
await sdk.sendFeedback({ session_id: chatResponse.session_id!, message_id: chatResponse.message_id, rating: 'up' });
```

## React hook

`useBrainboxChat(sdk, initialSessionId?, options?)` powers both components and is the easiest way to build your own UI.

```tsx
import { useBrainboxChat } from 'spres-react';

export function ChatApp() {
  const chat = useBrainboxChat(sdk, undefined, { open: true, onReply: (m) => console.log(m.text) });
  return (
    <div>
      {chat.messages.map((m) => (
        <p key={m.id}>
          {m.role}: {m.text} {m.status === 'streaming' ? '▍' : ''}
        </p>
      ))}
      <button onClick={() => chat.sendMessage('Hello')} disabled={chat.loading}>Send</button>
      {chat.streaming && <button onClick={chat.stop}>Stop</button>}
      {chat.error && <button onClick={chat.retry}>Retry</button>}
    </div>
  );
}
```

Returns `messages` (each with `status`, `messageId`, `sources`, `feedback`), `loading`, `streaming`, `error`,
`sessionId`, `sessions` / `sessionsLoaded` / `sessionsLoading` (sessions are only fetched when you call
`refreshSessions()`), `unreadCount` / `markRead` (replies received while `options.open === false`), and the actions
`sendMessage`, `stop`, `retry`, `sendFeedback(localId, 'up' | 'down')`, `createSession(title?)` (with a title the session
is created on the server immediately), `loadSession`, `refreshSessions`, `uploadFile`, `uploadImage`, `sendVoiceNote`,
`exportChat`, `clearError`, `reset`. Sending is guarded — a second message can't be sent while one is in flight.

## API keys

The backend issues two kinds of keys (ask your Brainbox admin, or run `python -m app.cli keys create ...` on the server):

| Key | Prefix | Use it in | Allows |
|---|---|---|---|
| Publishable | `pk_live_...` | public websites, browser widgets (`ChatWidget`, `ChatPanel`) | chat, sessions, chat uploads |
| Secret | `sk_live_...` | servers and **internal admin tools only** | everything, including training and ingest |

The tenant comes from the key, so the `tenantId` constructor argument is optional (if you pass it, it must match the key's
tenant). With a publishable key every chat user is treated as `public`: they only get answers built from content whose
audience is **Public**.

## Training

> **Training requires a secret key.** `TrainingPanel`, `useBrainboxTraining` and the training methods below are meant
> for internal admin tools (behind your own login), not for public sites — never ship an `sk_live_` key to a public page.
> With a publishable key every training call fails with `403` and the panel shows
> "This key can't train the AI — use a secret key on a server."

Teach the assistant from documents, pasted text and third-party APIs (for example a customer-support system, where each ticket becomes "customer issue + our response").

### Audiences

Every source has an **audience** that decides who the assistant may use it for (default `internal`):

| `TrainingAudience` | Who sees it |
|---|---|
| `public` | anyone, including anonymous website visitors |
| `customer` | logged-in customers / portal users (and staff, admins) |
| `vendor` | suppliers / vendors (and staff, admins) |
| `internal` | your staff (and admins) |
| `admin` | administrators only |

Pass it when training (`trainFile(file, { audience })`, `trainText(name, content, audience)`, `config.audience` for API
sources) and change it any time with `updateSource(id, { audience })` — all chunks of the source are relabelled at once.

### SDK methods

| Method | Endpoint | Returns |
|---|---|---|
| `trainFile(file, nameOrOptions?)` (`{ name?, audience?, onUploadProgress? }`) | `POST /api/train/file` (multipart) | `{ source, task_id }` |
| `trainText(name, content, audience?)` | `POST /api/train/text` | `{ source, task_id }` |
| `testApiSource(config)` | `POST /api/train/api-source/test` | `{ ok, status_code, records_found, preview, detected_fields, error? }` |
| `addApiSource(config)` | `POST /api/train/api-source` | `{ source, task_id }` |
| `syncSource(sourceId)` | `POST /api/train/sources/{id}/sync` | `{ source, task_id }` |
| `listSources()` | `GET /api/train/sources` | `{ sources, totals: { sources, documents } }` |
| `getSource(sourceId)` | `GET /api/train/sources/{id}` | `TrainingSource` |
| `updateSource(sourceId, { audience?, name? })` | `PATCH /api/train/sources/{id}` | `TrainingSource` |
| `deleteSource(sourceId)` | `DELETE /api/train/sources/{id}` | `{ deleted, documents_deleted }` |
| `getIngestStatus(taskId)` | `GET /api/ingest/status/{taskId}` | `{ task_id, status, error_message }` |

These methods throw a `BrainboxApiError` whose `message` is the backend's `detail` (or a readable fallback for network errors / 404s), with `status` and raw `detail` attached. Auth errors get a `code`: `'auth'` (401, invalid/missing/revoked key), `'scope'` (403, publishable key on a training endpoint — message `SECRET_KEY_REQUIRED_MESSAGE`) or `'tenant'` (403, tenant mismatch).

```tsx
import { BrainboxReactSDK } from 'spres-react';

// Secret key: internal admin tools / servers only.
const sdk = new BrainboxReactSDK('https://api.yourbackend.com', 'sk_live_...');

// Upload a PDF / XML / TXT / MD / CSV / JSON / DOCX file with progress
await sdk.trainFile(file, { name: 'Product manual', audience: 'customer', onUploadProgress: (pct) => console.log(pct) });

// Paste text (visible to everyone, incl. the public website widget)
await sdk.trainText('Refund policy', 'Refunds are processed within 5 days...', 'public');

// Later: hide it from the public again
await sdk.updateSource(sourceId, { audience: 'internal' });

// Connect a support-ticket API: test first, then save & train
const config = {
  name: 'Zendesk tickets',
  audience: 'internal',
  url: 'https://acme.zendesk.com/api/v2/tickets.json',
  method: 'GET',
  headers: { Authorization: 'Bearer ...' },
  data_path: 'tickets',
  source_type: 'support_tickets',
  mapping: { id_field: 'id', title_field: 'subject', question_field: 'description', messages_field: 'comments' },
  pagination: { type: 'cursor', cursor_path: 'meta.after_cursor', cursor_param: 'page[after]', max_pages: 10 }
} as const;

const test = await sdk.testApiSource(config);
if (test.ok) await sdk.addApiSource(config);

const { sources, totals } = await sdk.listSources();
```

### `TrainingPanel` component

A ready-made training page in the same design system (drag-and-drop upload with per-file progress and colored file-type tiles, connect an API with test + field mapping, paste text, and a searchable list of every training source with status, audience, chunk/record counts, sync and delete). Each tab has an "Audience · who can see this" picker (default *Internal staff*), and each row's audience pill is a dropdown that relabels the source in place. Use it with a **secret** key inside an internal admin app.

```tsx
import { BrainboxReactSDK, TrainingPanel } from 'spres-react';

export function TrainPage() {
  return (
    <TrainingPanel
      sdk={sdk}
      title="Train your AI"           // optional
      companyName="Acme"              // optional
      logoUrl="/logo.png"             // optional
      primaryColor="#0071E3"          // buttons (default: design-system blue)
      accentColor="#0071E3"           // highlights, progress bars, focus rings
      backgroundColor="#F5F5F7"       // page background
      mode="light"                    // 'light' | 'dark' | 'auto'
      sounds                          // success / error tones (default true)
      toasts                          // toasts for uploads, training results and errors (default true)
      variant="default"               // 'embedded' = no outer padding/background (for use inside another app)
      readOnly={false}                // true hides the add-data forms and per-source actions
    />
  );
}
```

`new BrainboxReactSDK(apiUrl, key)` also accepts a **function** returning the current bearer token
(e.g. `() => staffJwt`); it is read on every request.

### `useBrainboxTraining` hook

Build your own UI on the same state. The hook polls `listSources()` every ~3 s while any source is `queued` or `processing`.

```tsx
import { useBrainboxTraining } from 'spres-react';

const { sources, totals, loading, error, refresh, trainFile, trainText,
        testApiSource, addApiSource, syncSource, deleteSource, updateSource } = useBrainboxTraining(sdk);
```

### Preview

The preview app (`preview/`, `npm run dev` there) has four pages: `#/` (floating `ChatWidget`), `#/panel` (full-page
`ChatPanel`), `#/train` (the `TrainingPanel`) and `#/staff` (the staff dashboard, below). Add `?theme=dark` or
`?theme=auto` to preview the color modes and `?launcher=button|gif` for the other launchers. Connection settings live in `preview/src/config.js`.

## Staff dashboard

`StaffDashboard` is a complete, self-contained staff console for your Brainbox workspace (blue enterprise theme, no extra
dependencies): analytics, the **knowledge-gap inbox** (questions the assistant couldn't answer — every active staff member is
notified in-app and by email), conversations, training, staff management with invites and roles, and workspace settings.
Staff sign in with their own email + password (a staff JWT), so **no API key is embedded**.

```tsx
import { StaffDashboard } from 'spres-react';

export default function StaffApp() {
  return <StaffDashboard apiUrl="https://brainbox.example.com" brandName="Acme" />;
}
```

| Prop | Default | |
|---|---|---|
| `apiUrl` | — | Brainbox backend URL (without `/api`). |
| `brandName` | `'Brainbox'` | Shown in the sidebar, login screen and greetings. |
| `logoUrl` | — | Square logo; defaults to the Brainbox mark. |
| `theme` | blue | `{ primary, primaryHover, accent, sidebarFrom, sidebarTo, surface, text, muted, border, radius, fontFamily }` → CSS variables. |
| `routePrefix` | `''` | Hash prefix for all routes, e.g. `'/staff'` → `#/staff/overview` (to live inside another hash-routed app). |
| `offsetTop` | `0` | Height in px of fixed host chrome above the dashboard (keeps the sidebar/top bar sticky below it). |
| `client` | — | Your own `BrainboxStaffClient` instance (otherwise one is created from `apiUrl`). |
| `className` | — | Extra class on the root. |

**Routes** (hash, after `routePrefix`): `#/login`, `#/accept-invite?token=…`, `#/reset-password?token=…`, `#/overview`,
`#/gaps`, `#/gaps/:id`, `#/conversations`, `#/conversations/:id`, `#/training`, `#/staff`, `#/settings`,
`#/settings/:tab` (`general`, `alerts`, `widget`, `keys`, `install`), `#/notifications`, `#/account`.
Invite and reset emails link to `${DASHBOARD_URL}/#/accept-invite?token=…`, so host the dashboard at `DASHBOARD_URL` with
the default empty prefix (or redirect those hashes, as the preview does for `#/staff`).

**Roles** — `owner` > `admin` > `trainer` > `viewer`. The UI hides what a role can't do (the backend enforces it too):

| Role | Can |
|---|---|
| viewer | Read everything: overview, gaps, conversations, training sources, staff list, settings. |
| trainer | + train the AI, answer / dismiss / reopen knowledge gaps. |
| admin | + invite, change and remove trainers/viewers, change settings, manage API keys. |
| owner | + manage admins and owners (a workspace always keeps one active owner). |

**Feedback** — `sdk.sendFeedback({ session_id, message_id, rating: 'down', comment })` (the `message_id` comes from the
`/api/chat` response) reports a thumbs-down; it appears as a *Negative feedback* gap, and transcripts show each answer's
gap reason and rating.

**Session** — the JWT is stored in `localStorage` under `bb-staff-token:<apiUrl>` and cleared on any 401 (the user is sent
back to the login screen and returned to the page they were on after signing in).

### `BrainboxStaffClient`

The typed API client the dashboard uses; handy for your own tooling. Errors are `BrainboxApiError` (with the backend
`detail` as `message`).

```ts
import { BrainboxStaffClient, TrainingPanel } from 'spres-react';

const staff = new BrainboxStaffClient({ apiUrl, onUnauthorized: () => location.assign('/login') });
await staff.login('ada@acme.com', 'secret');          // stores the JWT
const { items, counts } = await staff.listGaps({ status: 'open', reason: 'no_context', q: 'refund' });
await staff.answerGap(items[0].id, { answer: '…', audience: 'customer', also_resolve_similar: true });
const report = await staff.overview(30);
<TrainingPanel sdk={staff.sdk} />                       // training authenticated with the same staff token
```

Methods: `login`, `me`, `updateMe`, `changePassword`, `acceptInvite`, `forgotPassword`, `resetPassword`, `logout`,
`listStaff`, `inviteStaff`, `updateStaff`, `deleteStaff`, `resendInvite`, `listGaps`, `getGap`, `updateGap`, `answerGap`,
`listNotifications`, `markNotificationRead`, `markAllNotificationsRead`, `overview`, `listConversations`,
`getConversation`, `getSettings`, `updateSettings`, `widgetConfig`, `listKeys`, `createKey`, `revokeKey`, the training
methods (`listSources`, `getSource`, `trainFile`, `trainText`, `testApiSource`, `addApiSource`, `syncSource`,
`updateSource`, `deleteSource`, `getIngestStatus`), plus `getToken` / `setToken` / `onTokenChange` / `isAuthenticated`.

### Mock mode (no backend)

`preview/mock/staff-mock.js` implements the whole staff API in memory with seeded data (60 days of activity, ~25 gaps of
every reason, 8 staff in every role/state, 19 conversations, 10 training sources, notifications). Run the preview and open
`http://localhost:4173/?mock=1#/staff/overview`, then sign in with `owner@acme.test`, `admin@acme.test`,
`trainer@acme.test` or `viewer@acme.test` (password `password123`). Add `&smtp=0` to simulate a server without email
(invite links are shown to copy), and call `window.__bbMock.simulateGap()` in the console to push a new gap notification.
Reset-password links are printed to the console.

## Publish and install

### Publish

```bash
cd sdk-react
npm install
npm test
npm login
npm publish --access public
```

### Install in a project

```bash
npm install spres-react
# or
yarn add spres-react

npm run dev
npm run build
```
git push origin

## Notes

- The React UI is designed for frontend chat and support experiences.
- Conversations are stored by the backend; the components remember the last session id in `localStorage`
  (disable with `persistSession={false}`) and fetch the session list only when history is opened.
- Use `sdk.ingest()` separately for data ingestion or log collection.
- Customize the widget styling without changing backend behavior.

## See Also

- Backend: [Brainbox Backend](../brainBox/)
- Python SDK: [sdk-python](../sdk-python/)
- Node SDK: [sdk-node](../sdk-node/)
