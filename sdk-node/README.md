# Brainbox Node.js SDK (`spres-ai`)

Train your Brainbox from your own servers, scripts and databases, and chat with it.
Everything you send goes straight to your Brainbox and is processed by Brainbox's own AI.

## Installation

Until the package is on npm, install the tarball straight from your Brainbox server:

```bash
npm install https://port.smartpowerbilling.com/sdk/downloads/spres-ai-1.1.0.tgz
```

(Later: `npm install spres-ai`.) Node 14+; Node 18+ recommended. TypeScript types included.

## Keys: which identifier is which

| Identifier | Looks like | Use it for |
|---|---|---|
| Tenant ID | `acme-co` | Which company's knowledge base. Not a password. Optional here: the key already decides it. |
| Publishable key | `pk_live_...` | Websites / apps chat widgets only. Safe in a browser. Cannot train. |
| Secret key | `sk_live_...` | Servers, scripts, training. **Never put it in a browser or mobile app.** |

Create a secret key in the staff dashboard: **Settings -> API keys -> Create -> Secret**, and keep it in
an environment variable (`BRAINBOX_SECRET_KEY`).

## Training quick start

```javascript
const { BrainboxNodeSDK } = require('spres-ai');   // or: import BrainboxNodeSDK from 'spres-ai'

const sdk = new BrainboxNodeSDK({
  apiUrl: 'https://port.smartpowerbilling.com',
  apiKey: process.env.BRAINBOX_SECRET_KEY,          // tenant comes from the key
});

// 1) Upload a document (PDF, XML, DOCX, TXT, CSV, JSON...; max 25 MB)
const job = await sdk.trainFile('./employee-handbook.pdf', { name: 'Handbook', audience: 'internal' });
await sdk.waitForTask(job.task_id);                // polls until completed / failed

// 2) Teach free text or database rows
for (const row of await db.query('SELECT id, question, answer FROM faq')) {
  await sdk.trainText(`Q: ${row.question}\nA: ${row.answer}`, { name: `FAQ #${row.id}`, audience: 'customer' });
}

// 3) Connect a support-tickets API (preview first, nothing is saved)
const config = {
  url: 'https://helpdesk.example.com/api/tickets',
  headers: { Authorization: 'Bearer HELPDESK_TOKEN' },
  data_path: 'data.tickets',
  source_type: 'support_tickets',
  mapping: { question_field: 'subject', answer_field: 'resolution' },
  pagination: { type: 'page', page_param: 'page', max_pages: 10 },
  audience: 'internal',
};
const preview = await sdk.testApiSource(config);
if (preview.ok) {
  const api = await sdk.addApiSource({ ...config, name: 'Helpdesk' });
  await sdk.waitForTask(api.task_id);
  // later, re-fetch on demand:
  await sdk.syncSource(api.source.source_id);
}

// 4) Manage sources
const { sources, totals } = await sdk.listSources();
await sdk.updateSource(sources[0].source_id, { audience: 'customer' });
await sdk.deleteSource(sources[0].source_id);      // forget everything it taught
```

A complete script lives in [`examples/train-from-node.js`](examples/train-from-node.js).

The positional constructor still works: `new BrainboxNodeSDK(apiUrl, apiKey)` (tenantId is optional).

### Audiences

Every source has an audience that controls who the AI may show it to:
`public`, `customer`, `vendor`, `internal` (default) and `admin`.

## Training methods

| Method | What it does | Resolves to |
|---|---|---|
| `trainFile(path, { name, audience })` | Upload a document | `{ source, task_id }` |
| `trainText(content, { name, audience })` | Teach free text / one record | `{ source, task_id }` |
| `testApiSource(config)` | Dry-run an API, preview records | `{ ok, records_found, preview, detected_fields, error }` |
| `addApiSource(config)` | Save an API source and start syncing | `{ source, task_id }` |
| `listSources()` | All sources | `{ sources, totals }` |
| `getSource(id)` | One source | source |
| `updateSource(id, { audience, name })` | Rename / relabel | source |
| `deleteSource(id)` | Delete a source and its documents | `{ deleted, documents_deleted }` |
| `syncSource(id)` | Re-fetch an API source | `{ source, task_id }` |
| `getIngestStatus(taskId)` | Status of any task | `{ task_id, status, error_message }` |
| `waitForTask(taskId, { timeout: 600, poll: 3 })` | Wait until a task finishes (seconds) | final status |

API source `config`: `url` (required), `name`, `method` (`GET`/`POST`), `headers`, `query`, `body`,
`data_path`, `source_type` (`support_tickets` | `api_generic`), `mapping` (`id_field`,
`question_field`, `answer_field`, `title_field`, `messages_field`, `extra_fields`), `pagination`
(`type`: `none`/`page`/`cursor`, `page_param`, `cursor_path`, `cursor_param`, `max_pages`), `audience`.

## Errors

Every API error is a `BrainboxError` (or subclass) carrying the backend's explanation:

```javascript
const { BrainboxValidationError, BrainboxAuthError } = require('spres-ai');
try {
  await sdk.trainFile('photo.png');
} catch (err) {
  if (err instanceof BrainboxValidationError) console.log(err.statusCode, err.detail); // 415 "Unsupported file type '.png'..."
  else if (err instanceof BrainboxAuthError) console.log('Use a secret key (sk_live_...)');
  else throw err;
}
```

## Other methods

- `ingest(sourceType, content, filePath?, metadata?, audience?)`: low-level ingest (logs, code, JSON...).
- `chat(question, sessionId?)`, `createChatSession(title?)`, `healthCheck()`.

API reference: https://port.smartpowerbilling.com/docs

## Function Locator (Built-in)

Find functions in your codebase without needing a separate tool.

### Find a Specific Function

```javascript
const sdk = new BrainboxNodeSDK({ apiKey: process.env.BRAINBOX_SECRET_KEY });

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

