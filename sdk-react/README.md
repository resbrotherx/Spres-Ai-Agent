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

## Function Locator (Built-in)

Find and analyze functions in code snippets without needing a separate tool.

### Find Functions in Code

```tsx
import { useBrainbox } from './brainbox-sdk';

export function CodeAnalyzer() {
  const { findFunction, findAllFunctions, findAsyncFunctions } = useBrainbox(
    'http://localhost:8000',
    'api-key',
    'tenant-1'
  );

  const codeSnippet = `
    function login(username, password) {
      // login logic
    }

    const handleAuth = async (token) => {
      // auth logic
    }
  `;

  const loginFunc = findFunction('login', codeSnippet);
  const allFuncs = findAllFunctions(codeSnippet);
  const asyncFuncs = findAsyncFunctions(codeSnippet);

  return (
    <div>
      <p>Found: {allFuncs.length} functions</p>
      <p>Async: {asyncFuncs.length} functions</p>
      {loginFunc.map(func => (
        <div key={func.name}>
          <h3>{func.name}</h3>
          <p>Signature: {func.signature}</p>
          <p>Line: {func.line_number}</p>
        </div>
      ))}
    </div>
  );
}
```

### Using SDK Class Directly

```tsx
import { BrainboxReactSDK } from './brainbox-sdk';

const sdk = new BrainboxReactSDK(apiUrl, apiKey, tenantId);

// Find specific function
const funcs = sdk.findFunction('handleClick', codeContent);

// Find all functions
const allFuncs = sdk.findAllFunctions(codeContent);

// Find async functions
const asyncFuncs = sdk.findAsyncFunctions(codeContent);
```

### Function Info Object

```tsx
const func = findFunction('login', codeSnippet)[0];

// Access properties
console.log(func.name);           // "login"
console.log(func.line_number);    // 2
console.log(func.signature);      // "function login(username, password)"
console.log(func.parameters);     // ["username", "password"]
console.log(func.is_async);       // false
console.log(func.language);       // "javascript"

// Convert to object
const funcObj = func.toObject();
```

### Supported Function Types

- Regular functions: `function name() {}`
- Arrow functions: `const name = () => {}`
- Async functions: `async function name() {}`
- Async arrow: `const name = async () => {}`
- React components: `function ComponentName() {}`

## See Also

- Backend: [Brainbox Backend](../brainBox/)
- Python SDK: [sdk-python](../sdk-python/)
- Node SDK: [sdk-node](../sdk-node/)
