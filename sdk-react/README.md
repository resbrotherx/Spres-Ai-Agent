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

- `BrainboxReactSDK` class for API and ingestion calls
- `ChatWidget` support bot UI
- `ChatPanel` full chat UI with sidebar and history
- `useBrainboxChat` hook for real-time chat state
- Customizable colors, button placement, and design variants

## Quick Start

```tsx
import { BrainboxReactSDK, ChatWidget } from 'spres-react';

const sdk = new BrainboxReactSDK(
  'https://api.yourbackend.com',
  'YOUR_API_KEY',
  'your-tenant-id'
);

export function App() {
  return <ChatWidget sdk={sdk} />;
}
```

## Support chat UI

`ChatWidget` provides a launch button and popup chat bubble. It is styled by default to appear on the right side.

```tsx
<ChatWidget
  sdk={sdk}
  position="bottom-right"
  primaryColor="#2563EB"
  accentColor="#111827"
  backgroundColor="#F8FAFC"
  buttonText="Support"
  placeholder="Ask a question..."
  width="360px"
  height="520px"
  design="support"
/>
```

## Full chat panel UI

`ChatPanel` delivers a larger ChatGPT-style conversation experience with a sidebar for session status and history.

```tsx
import { ChatPanel } from 'spres-react';

<ChatPanel
  sdk={sdk}
  headerText="Brainbox AI Chat"
  sidebarTitle="Conversations"
  primaryColor="#0F172A"
  accentColor="#2563EB"
  backgroundColor="#FFFFFF"
  initialSessionId="session-123"
  design="cloud"
/>
```

## Customization options

You can customize the UI and behavior through props:

- `primaryColor` — button, header, and primary bubble color
- `accentColor` — secondary bubble and action color
- `backgroundColor` — panel background
- `buttonText` — launch button label
- `placeholder` — text input placeholder
- `position` — `bottom-right`, `bottom-left`, `top-right`, `top-left`, or `center`
- `width`, `height` — widget container size
- `design` — visual variant such as `support`, `assistant`, `cloud`, or `classic`

## Platform compatibility

- React and Next.js: supported for browser-rendered React components. In Next.js, use client-only components or `useEffect` to avoid server-side rendering issues.
- Angular / AngularJS: the React UI components are not compatible directly. Use the backend API endpoints or the `sdk-web` plain JavaScript widget for those environments.
- React Native: the React web UI components are not supported. Use the new `brainbox-react-native-sdk` package for native mobile UI and backend chat calls.
- Plain HTML / Odoo / jQuery: use the `sdk-web` package and copy-paste widget example.

## React Native guidance

The current React SDK does not include native mobile UI components for React Native. If you want React Native support:

- use `BrainboxReactNativeSDK` from `brainbox-react-native-sdk` for backend chat calls,
- use `ChatScreen` from `brainbox-react-native-sdk` for a mobile-ready chat UI,
- build your own React Native screen and message components if you need a custom experience,
- call `sdk.chat(...)` or `sdk.streamChat(...)` from your native UI.

This means React Native requires a separate deployment of your mobile app, not a browser-hosted web UI.

## Real-time chat behavior

The SDK supports HTTP streaming through `/api/chat/stream` when the backend exposes that endpoint. Streaming allows the UI to display response text gradually as the server generates it, which feels faster than waiting for the full reply.

If streaming is not available, the SDK falls back to a normal chat request to `/api/chat` and still returns a full response.

The current SDK does not use WebSocket for chat. It uses HTTP fetch/streaming, which is enough for fast, chunked responses in supported browsers and environments.

Response speed depends mainly on your backend and model latency. The SDK will show user messages immediately and then render assistant text as soon as the backend returns it.

## Real-time chat experience

The React SDK supports a streaming-friendly chat method. If your backend exposes `/api/chat/stream`, the widget will render incoming content in chunks.
If streaming is unavailable, the SDK falls back to a standard chat request and still delivers a full response.

## Using the SDK class directly

```tsx
import { BrainboxReactSDK } from 'spres-react';

const sdk = new BrainboxReactSDK(
  'https://api.yourbackend.com',
  'YOUR_API_KEY',
  'tenant-1'
);

const ingestResult = await sdk.ingest('logs', 'Error content');
const chatResponse = await sdk.chat('What happened?');
const session = await sdk.createChatSession('Support Session');
```

## React hook

`useBrainboxChat` is useful when you want to build a custom chat UI while reusing Brainbox chat state.

```tsx
import { useBrainboxChat, BrainboxReactSDK } from 'spres-react';

const sdk = new BrainboxReactSDK('https://api.yourbackend.com', 'YOUR_API_KEY', 'tenant-1');

export function ChatApp() {
  const { messages, loading, error, sendMessage } = useBrainboxChat(sdk);

  return (
    <div>
      <button onClick={() => sendMessage('Hello')}>Send</button>
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
      <pre>{JSON.stringify(messages, null, 2)}</pre>
    </div>
  );
}
```

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

A ready-made training page (upload files, connect an API with test + field mapping, paste text, and a searchable list of every training source with status, audience, chunk/record counts, sync and delete). Each tab has an "Audience · who can see this" picker (default *Internal staff*), and each row's audience pill is a dropdown that relabels the source in place. Use it with a **secret** key inside an internal admin app.

```tsx
import { BrainboxReactSDK, TrainingPanel } from 'spres-react';

export function TrainPage() {
  return (
    <TrainingPanel
      sdk={sdk}
      title="Train your AI"           // optional
      companyName="Acme"              // optional
      logoUrl="/logo.png"             // optional
      primaryColor="#111114"          // buttons (default black)
      accentColor="#a882f7"           // highlights (default lilac)
      backgroundColor="#f3f3f5"       // page background
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

The preview app (`preview/`, `npm run dev` there) has three pages: `#/` (chat demo), `#/train` (the `TrainingPanel`) and
`#/staff` (the staff dashboard, below). Connection settings live in `preview/src/config.js`.

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

- The React UI is designed for frontend chat and spport experiences.
- Chat history is managed in memory by default.
- Use `sdk.ingest()` separately for data ingestion or log collection.
- Customize the widget styling without changing backend behavior.

## See Also

- Backend: [Brainbox Backend](../brainBox/)
- Python SDK: [sdk-python](../sdk-python/)
- Node SDK: [sdk-node](../sdk-node/)
