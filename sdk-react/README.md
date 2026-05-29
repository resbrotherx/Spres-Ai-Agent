# Brainbox React SDK

A React UI SDK for Brainbox that includes built-in chat designs, a support bot, and streaming-ready backend communication.

## Installation

```bash
npm install brainbox-react-sdk
# or
yarn add brainbox-react-sdk
```

## Deployment

`npm install brainbox-react-sdk` or `yarn add brainbox-react-sdk` only installs the library into your React project. It does not automatically deploy a live chat UI to a server.

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
import { BrainboxReactSDK, ChatWidget } from 'brainbox-react-sdk';

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
import { ChatPanel } from 'brainbox-react-sdk';

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
import { BrainboxReactSDK } from 'brainbox-react-sdk';

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
import { useBrainboxChat, BrainboxReactSDK } from 'brainbox-react-sdk';

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
npm install brainbox-react-sdk
# or
yarn add brainbox-react-sdk
```

## Notes

- The React UI is designed for frontend chat and support experiences.
- Chat history is managed in memory by default.
- Use `sdk.ingest()` separately for data ingestion or log collection.
- Customize the widget styling without changing backend behavior.

## See Also

- Backend: [Brainbox Backend](../brainBox/)
- Python SDK: [sdk-python](../sdk-python/)
- Node SDK: [sdk-node](../sdk-node/)
