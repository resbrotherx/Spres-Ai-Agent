# Node SDK

npm install axios

## Quick Start

```javascript
const BrainboxNodeSDK = require('./spres-ai');

const sdk = new BrainboxNodeSDK(
  'http://localhost:8000',
  'your-api-key',
  'company-1'
);

// Ingest logs
const result = await sdk.ingest('logs', 'Error log content', '/var/log/app.log');
console.log(`Task ID: ${result.task_id}`);

// Chat
const response = await sdk.chat('What happened?');
console.log(`Response: ${response.response}`);
```

## Methods

- `ingest(sourceType, content, filePath, metadata)` - Queue data for ingestion
- `chat(question, sessionId)` - Ask AI a question
- `getIngestStatus(taskId)` - Check ingestion status
- `createChatSession(title)` - Create chat session
- `healthCheck()` - Check backend health

## Function Locator (Built-in)

Find functions in your codebase without needing a separate tool.

### Find a Specific Function

```javascript
const sdk = new BrainboxNodeSDK('http://localhost:8000', 'api-key', 'company-1');

// Find login function
const loginFuncs = sdk.findFunction('login', './src');
loginFuncs.forEach(func => {
    console.log(`Found: ${func.name}`);
    console.log(`Location: ${func.file_path}:${func.line_number}`);
    console.log(`Signature: ${func.signature}`);
    console.log(`Parameters: ${func.parameters.join(', ')}`);
});
```

### Find All Functions

```javascript
// Get all functions in codebase
const allFuncs = sdk.findAllFunctions('./src');
console.log(`Total functions: ${allFuncs.length}`);
```

### Find Functions in Specific File

```javascript
// Get all functions in a file
const authFuncs = sdk.findFunctionByFile('./src/auth.js');
authFuncs.forEach(func => {
    console.log(`  ${func.name} at line ${func.line_number}`);
});
```

### Find Async Functions

```javascript
// Find all async/await functions
const asyncFuncs = sdk.findAsyncFunctions('./src');
console.log(`Found ${asyncFuncs.length} async functions`);

asyncFuncs.forEach(func => {
    console.log(`  ${func.name} (async) in ${func.file_path}`);
});
```

### Function Info Object

```javascript
const func = sdk.findFunction('login', './src')[0];

// Access function details
console.log(func.name);           // "login"
console.log(func.file_path);      // "/app/auth.js"
console.log(func.line_number);    // 45
console.log(func.signature);      // "function login(username, password)"
console.log(func.parameters);     // ["username", "password"]
console.log(func.is_async);       // false
console.log(func.language);       // "javascript"
console.log(func.class_name);     // null

// Convert to object
const funcObj = func.toObject();
```

### Supported Languages

- JavaScript (`.js`, `.jsx` files)
- TypeScript (`.ts`, `.tsx` files)
- React components

See README.md for detailed documentation.
