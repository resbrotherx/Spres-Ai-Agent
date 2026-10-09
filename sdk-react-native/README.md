# Brainbox for React Native (`spres-react-native`) v2

The Brainbox AI assistant for iOS and Android apps. It looks and behaves like the web (`spres-web`) and React SDKs:
same design system, logo, chat flow and options.

- **`BrainboxWidget`**: a floating launcher with an unread badge. It opens a chat sheet with a slide-up spring.
- **`BrainboxChat`**: a full-screen chat view for a tab or stack screen.
- **`useBrainboxChat`**: the state hook, for building your own UI.
- **`BrainboxClient`**: a headless API client. Answers stream token by token, and it falls back to whole answers automatically.
- **v1 compatibility**: `BrainboxReactNativeSDK` and `ChatScreen` still work.

The only runtime dependency is `react-native-svg`, a peer dependency used for the logo and icons.
`@react-native-async-storage/async-storage` is optional and remembers the last conversation across app restarts.

---

## Install

```bash
npm i spres-react-native react-native-svg
# optional: keep the conversation across app restarts
npm i @react-native-async-storage/async-storage
```

**Expo:** `npx expo install react-native-svg @react-native-async-storage/async-storage`. This works in Expo Go,
so you don't need a custom dev client.

**Bare React Native:** run `cd ios && pod install` after installing. On Android, haptics need the vibrate permission:
`<uses-permission android:name="android.permission.VIBRATE" />` in `AndroidManifest.xml`. Expo adds it by default.

Requirements: React 18 or newer, React Native 0.72 or newer, and react-native-svg 13 or newer.

## Quick start

### Floating widget (Expo or bare)

Render it once, as the last child of your root view:

```tsx
import { BrainboxWidget } from 'spres-react-native';

export default function App() {
  return (
    <View style={{ flex: 1 }}>
      <YourNavigation />
      <BrainboxWidget
        apiUrl="https://api.example.com"
        apiKey="pk_live_..."                      // publishable key only, never a secret key
        user={{ id: '42', name: 'Ada Lovelace' }}
        branding={{ botName: 'Acme Assistant' }}
        quickActions={['Track my order', { title: 'Billing', prompt: 'I have a billing question' }]}
      />
    </View>
  );
}
```

To open the widget from your own button, use a ref:

```tsx
const bb = useRef<BrainboxWidgetHandle>(null);
<BrainboxWidget ref={bb} launcher={false} ... />
bb.current?.open();       // also: close(), toggle(), isOpen(), send(text), newChat()
```

### Full-screen chat

```tsx
import { BrainboxChat } from 'spres-react-native';

function SupportScreen({ navigation }) {
  return (
    <BrainboxChat
      apiUrl="https://api.example.com"
      apiKey="pk_live_..."
      theme={{ mode: 'auto' }}
      onClose={() => navigation.goBack()}
    />
  );
}
```

`BrainboxChat` handles the safe area itself with `SafeAreaView` and uses a `KeyboardAvoidingView`. If your
navigator's header sits above it, pass `keyboardVerticalOffset={headerHeight}`. If the screen already handles
insets, pass `safeArea={false}`.

See [`example/App.tsx`](example/App.tsx) for both patterns.

---

## Props

`BrainboxChat` and `BrainboxWidget` accept the following props. The names match `spres-web` and the React SDK.

| Prop | Default | Description |
|---|---|---|
| `apiUrl` | – | Backend base URL. The SDK calls `${apiUrl}/api/...`. |
| `apiKey` | – | Publishable key, sent as `Authorization: Bearer <key>`. |
| `tenantId` | – | Optional. The backend takes the tenant from the key; if you set this, it must match. |
| `user` | `{}` | `{ id, name, email, avatarUrl }`. `id` is sent as `user_id` (per-user history) and `name` as `user_name`. The first name appears in the greeting. |
| `client` | – | Pass your own `BrainboxClient` instead of `apiUrl`/`apiKey`. |
| `headers` | `{}` | Extra headers on every request. |
| `timeout` | `200000` | Request timeout in ms. Answers can take about 3 minutes. |
| `streaming` | `true` | Streams answers token by token. If streaming isn't available, it falls back to `POST /api/chat`. |
| `theme` | `{ mode: 'light' }` | `{ primary, mode: 'light' \| 'dark' \| 'auto', fontFamily }`. `primary` overrides the accent colour. `auto` follows the device appearance. |
| `branding` | `{ botName: 'Brainbox AI' }` | `{ botName, title, subtitle, logoUrl, greeting }`. `title` defaults to `botName`, `subtitle` to "Online". `logoUrl` replaces the logo in the header and avatars. `greeting` defaults to `'Hi {{name}}'`. |
| `welcomeMessages` | `["I'm {{botName}}. How can I help you today?"]` | Text under the welcome greeting. `{{name}}` and `{{botName}}` are replaced. |
| `quickActions` | `[]` | Strings, or `{ title, description, prompt, icon }`. Shown as chips on the welcome screen; tapping one sends it. |
| `placeholder` | `'Message…'` | Composer placeholder. |
| `haptics` | `true` | Tiny haptics on send, reply and error. Pass `false` to turn them off, or a function `(type) => void` to use `expo-haptics` (see below). |
| `features` | all `true` | `{ history, newChat, feedback, copy, sources }` |
| `clipboard` | RN core `Clipboard` if present | Used by the copy buttons. Pass `expo-clipboard` or `@react-native-clipboard/clipboard`. `null` hides the copy buttons. |
| `storage` | AsyncStorage, else memory | Where the last session ID is kept. `null` disables persistence. |
| `storageKey` | `'bb-rn'` | Storage namespace, combined with the tenant and user ID. |
| `persistSession` | `true` | Reopen the last conversation on mount. |
| `initialSessionId` | – | Open this conversation instead. |
| `onEvent` | – | `(name, detail) => void` for `message`, `response`, `error`, `session`, `feedback`, `upload`, `fallback`, `open` and `close`. |
| `onClose` | – | `BrainboxChat` only. Shows a close button in the header. |
| `safeArea` / `keyboardVerticalOffset` / `style` | `true` / `0` / – | Layout controls for `BrainboxChat`. |

These props apply to `BrainboxWidget` only:

| Prop | Default | Description |
|---|---|---|
| `position` | `'bottom-right'` | `'bottom-right'` or `'bottom-left'` |
| `offset` | `{ x: 20, y: 28 }` | Launcher distance from the corner. |
| `defaultOpen` | `false` | Open on first render. |
| `open` / `onOpenChange` | – | Controlled open state. |
| `launcher` | `true` | Set to `false` to hide the floating button and open the widget from the ref. |

On phones the widget opens a full-screen sheet with a 12pt top radius. On screens 576pt or wider it opens a
380×600 floating window in the launcher's corner. When a reply arrives while the widget is closed, the launcher
shows an unread badge.

## What users get

- A header with the Brainbox logo, the title, a green status dot, and buttons for new chat, history and close.
- Message bubbles grouped by sender, with day separators ("Today", "Yesterday") and timestamps at the end of each
  group.
- Streaming answers with a blinking caret, and typing dots until the first token arrives. A stop button replaces
  send while an answer is being written.
- Under each answer: copy, 👍/👎 (sent to `POST /api/chat/feedback`; a 👎 is reported to staff as a knowledge gap),
  and a "Sources" disclosure when the answer used the knowledge base.
- Safe Markdown: bold, italic, inline code, code blocks (monospace, with a language label and copy button),
  bullet and numbered lists, headings, quotes, simple tables, and links. Links open with `Linking`, and only
  `http`, `https` and `mailto` URLs are allowed.
- A history sheet with conversations grouped as Today / Yesterday / This week / Older, plus search.
- Errors appear as an inline banner with **Retry**. Users never see raw JSON or stack traces.
- When the OS "Reduce motion" setting is on, animations become short fades. Controls have accessibility labels.

## Theming and dark mode

```tsx
<BrainboxChat theme={{ primary: '#0F9D76', mode: 'auto' }} ... />
```

The design tokens follow the shared Brainbox design system. The light palette is `#F5F5F7` / `#FFFFFF` with
label `#1D1D1F` and accent `#0071E3`. The dark palette is `#000` / `#1C1C1E` with accent `#0A84FF`. Text uses the
system font (SF Pro on iOS, Roboto on Android) at weights 400, 500 and 600. Shadows are minimal: only the launcher
and the floating window have one. To build your own UI on the same tokens, use
`useBrainboxTheme(theme)`, `<BrainboxLogo size={32} />` and `<BrainboxIcon name="history" color="..." />`.

### Haptics

`haptics={true}` gives a tiny `Vibration` pulse on Android. iOS can't do short vibrations, so the built-in
haptics are silent there. For real iOS haptics, pass a function:

```tsx
import * as Haptics from 'expo-haptics';
<BrainboxWidget haptics={(type) => type === 'error'
  ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
  : Haptics.selectionAsync()} ... />
```

## Streaming

`BrainboxClient.streamChat` posts to `/api/chat/stream` and reads Server-Sent Events (`meta`, `token`, `done`,
`error`) with `XMLHttpRequest` and `onprogress`. This works in React Native without polyfills. `EventSource` and
`fetch` streaming are not used.

- If the server answers **404 or 405**, the client remembers that and uses `POST /api/chat` for the rest of the
  session. Answers then arrive whole, so it works against servers that don't stream yet.
- If streaming **fails before the first event** (a network error, a 5xx, or an empty stream), the client retries
  once with `POST /api/chat`.
- After the first event, the client never re-sends the question, so it doesn't store a duplicate. A failure at
  that point is reported as a retryable error and the partial text is kept.
- `abort()` cancels the request, and no callbacks fire afterwards.

To turn streaming off, pass `streaming={false}` (component) or `new BrainboxClient({ ..., streaming: false })`.

## Headless use

```ts
import { BrainboxClient, BrainboxError } from 'spres-react-native';

const client = new BrainboxClient({ apiUrl, apiKey, tenantId, user: { id: '42', name: 'Ada' } });

const { abort, done } = client.streamChat('How do I reset my password?', {
  sessionId,                                  // optional
  onMeta: ({ session_id }) => {},
  onToken: (delta, textSoFar) => {},
  onDone: (res) => {},                        // { response, reasoning, search_results, session_id, message_id, user_message_id }
  onError: (err: BrainboxError) => {},        // err.message is user-friendly; also .status, .code, .detail, .retryable
  onFallback: (reason) => {}                  // 'unsupported' | 'error' | 'disabled'
});

await client.chat('Hello', sessionId);        // POST /api/chat
await client.listSessions();                  // { today, yesterday, this_week, older }
await client.getSessionMessages(id);          // { session_id, title, messages: [...] }
await client.createSession('Title');
await client.uploadFile({ uri, name, type }, sessionId);  // images -> /upload/image, others -> /upload/file
await client.sendFeedback({ session_id, message_id, rating: 'up' });
await client.health();
await client.request('GET', '/api/custom');  // low-level helper
```

The client also works in Node 18 and newer: it uses `fetch`, and you can inject `fetch` and `XMLHttpRequest`
for tests.

### Hook

```tsx
const chat = useBrainboxChat(client, { streaming: true, onEvent });
// chat.messages, chat.streamingText, chat.sending, chat.streaming, chat.error, chat.canRetry,
// chat.sessionId, chat.sessions, chat.historyLoading,
// chat.send(text), chat.stop(), chat.retry(), chat.newChat(), chat.loadSession(id),
// chat.refreshSessions(), chat.sendFeedback(localMessageId, 'up'|'down'), chat.uploadFile(file)
```

To keep the hook's state but use the built-in UI, render `<BrainboxChatView chat={chat} ... />`.

---

## Migrating from 1.x (`brainbox-react-native-sdk`)

```diff
- npm i brainbox-react-native-sdk
+ npm i spres-react-native react-native-svg
```

Existing code keeps working:

```tsx
import { BrainboxReactNativeSDK, ChatScreen } from 'spres-react-native';
const sdk = new BrainboxReactNativeSDK(apiUrl, apiKey, tenantId);
<ChatScreen sdk={sdk} title="Support" primaryColor="#2563EB" />
```

What changed:

- In 1.x, `streamChat` called `/api/chat/stream`, which did not exist, so every message failed. It now streams
  when the server supports it and otherwise falls back to `POST /api/chat`. `onChunk` receives text deltas and
  `onComplete` receives the final response object.
- On HTTP or network failures, methods now reject with a `BrainboxError` that carries a readable message. In 1.x
  they resolved with the error JSON.
- `ChatScreen` renders the v2 `BrainboxChat`. `title`, `placeholder` and `primaryColor` are mapped. `accentColor`,
  `headerStyle`, `inputStyle` and `buttonText` are ignored, because the design system sets those.
- `ingest()` is still available but needs a **secret** key. Never ship a secret key inside an app.

Moving to the v2 API:

```tsx
<BrainboxChat apiUrl={url} apiKey={key} tenantId={tenant}
              theme={{ primary: '#2563EB' }} branding={{ title: 'Support' }} />
```

## Security

Only use a **publishable** key (`pk_...`) in an app. Anyone can extract it from the app bundle. Publishable keys
can chat but cannot train the assistant. Set `user.id` so that each user sees only their own history.

## Development

```bash
npm install
npm run typecheck    # tsc --noEmit (src + example)
npm run build        # compiles src/ to lib/ with .d.ts
npm test             # builds, then runs __tests__/run.js (plain Node: SSE parser, client streaming/fallback
                     # with a fake XMLHttpRequest, markdown, and the hook via react-test-renderer)
```
