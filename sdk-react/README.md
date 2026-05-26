# React SDK

Brainbox SDK for React applications.

## Installation

```bash
npm install axios
# or yarn
yarn add axios
```

## Quick Start

```tsx
import { useBrainbox } from './brainbox-sdk';

export function ChatApp() {
  const { chat, ingest, loading, error } = useBrainbox(
    'http://localhost:8000',
    'your-api-key',
    'company-1'
  );

  const handleChat = async (question: string) => {
    const response = await chat(question);
    console.log(response.response);
  };

  return (
    <div>
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
      <button onClick={() => handleChat('What happened?')}>Ask</button>
    </div>
  );
}
```

## Using the SDK Class Directly

```tsx
import { BrainboxReactSDK } from './brainbox-sdk';

const sdk = new BrainboxReactSDK(
  'http://localhost:8000',
  'your-api-key',
  'company-1'
);

// Ingest
const result = await sdk.ingest('logs', 'Error content');

// Chat
const response = await sdk.chat('What failed?');

// Create session
const session = await sdk.createChatSession('Support Session');
```

## React Hook

The `useBrainbox` hook provides:
- `ingest()` - Queue data for ingestion
- `chat()` - Send chat message
- `createChatSession()` - Create new session
- `loading` - Loading state
- `error` - Error message

## TypeScript Support

Full TypeScript types included.

## See Also

- Backend: [Brainbox Backend](../brainBox/)
- Python SDK: [sdk-python](../sdk-python/)
- Node SDK: [sdk-node](../sdk-node/)
