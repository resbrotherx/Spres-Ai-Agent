# Node SDK

npm install axios

## Quick Start

```javascript
const BrainboxNodeSDK = require('./brainbox-sdk');

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

See README.md for detailed documentation.
