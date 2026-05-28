# Brainbox Platform - SDK Reference

Complete reference for all SDKs and their features.

---

## SDKs Overview

### Main SDKs (3)
- **Python SDK** - Python applications
- **Node.js SDK** - Node.js/JavaScript backends
- **React SDK** - React/Frontend applications

**All include:**
- ✅ Ingest data to Brainbox
- ✅ Chat with AI
- ✅ Find functions in code (Python/JS/React)

### Specialized SDKs (2)
- **CLI SDK** - Automatic log collection service
- **Database SDK** - Safe database query access

---

## Python SDK

### Installation
```bash
pip install brainbox-sdk
```

### Basic Usage
```python
from brainbox_sdk import BrainboxPythonSDK

sdk = BrainboxPythonSDK(
    api_url="https://api.brainbox.ai",
    api_key="sk_customer_abc",
    tenant_id="company-1"
)

# Ingest data
result = sdk.ingest(
    source_type="logs",
    content="ERROR: Database failed",
    file_path="/var/log/app.log"
)
print(f"Task ID: {result['task_id']}")

# Chat with AI
response = sdk.chat("What errors happened?")
print(response['response'])

# Find functions
login_funcs = sdk.find_function("login", directory="./src")
for func in login_funcs:
    print(f"{func.name} at {func.file_path}:{func.line_number}")
    print(f"Signature: {func.signature}")
    print(f"Async: {func.is_async}")

# Find all async functions
async_funcs = sdk.find_async_functions(directory="./src")
print(f"Found {len(async_funcs)} async functions")
```

### Methods

| Method | Purpose |
|--------|---------|
| `ingest(source_type, content, file_path, metadata)` | Send data for processing |
| `chat(question, session_id)` | Ask AI a question |
| `create_chat_session(title)` | Create new chat session |
| `find_function(name, directory)` | Find function by name |
| `find_all_functions(directory)` | Get all functions |
| `find_function_by_file(file_path)` | Functions in file |
| `find_async_functions(directory)` | Find async functions |
| `health_check()` | Check backend status |

---

## Node.js SDK

### Installation
```bash
npm install brainbox-sdk
```

### Basic Usage
```javascript
const BrainboxNodeSDK = require('brainbox-sdk');

const sdk = new BrainboxNodeSDK(
  'https://api.brainbox.ai',
  'sk_customer_abc',
  'company-1'
);

(async () => {
  // Ingest
  const result = await sdk.ingest(
    'logs',
    'ERROR: Database failed',
    '/var/log/app.log'
  );
  console.log(`Task ID: ${result.task_id}`);

  // Chat
  const response = await sdk.chat('What errors happened?');
  console.log(response.response);

  // Find functions
  const loginFuncs = sdk.findFunction('login', './src');
  loginFuncs.forEach(func => {
    console.log(`${func.name} at ${func.file_path}:${func.line_number}`);
    console.log(`Signature: ${func.signature}`);
  });

  // Find async functions
  const asyncFuncs = sdk.findAsyncFunctions('./src');
  console.log(`Found ${asyncFuncs.length} async functions`);
})();
```

### Methods

| Method | Purpose |
|--------|---------|
| `ingest(sourceType, content, filePath, metadata)` | Send data |
| `chat(question, sessionId)` | Ask AI |
| `createChatSession(title)` | Create session |
| `findFunction(name, directory)` | Find by name |
| `findAllFunctions(directory)` | Get all |
| `findFunctionByFile(filePath)` | Functions in file |
| `findAsyncFunctions(directory)` | Find async |
| `healthCheck()` | Check backend |

---

## React SDK

### Installation
```bash
npm install brainbox-sdk
```

### Using Hook (Recommended)
```tsx
import { useBrainbox } from 'brainbox-sdk';

export function MyComponent() {
  const { 
    chat, 
    ingest, 
    findFunction,
    findAllFunctions,
    findAsyncFunctions,
    loading, 
    error 
  } = useBrainbox(
    'https://api.brainbox.ai',
    'sk_customer_abc',
    'company-1'
  );

  const handleChat = async (question) => {
    const response = await chat(question);
    console.log(response.response);
  };

  const handleFindFunction = (codeSnippet) => {
    const funcs = findAllFunctions(codeSnippet);
    return funcs;
  };

  return (
    <div>
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
      <button onClick={() => handleChat('What happened?')}>
        Ask AI
      </button>
    </div>
  );
}
```

### Using SDK Class Directly
```tsx
import { BrainboxReactSDK } from 'brainbox-sdk';

const sdk = new BrainboxReactSDK(url, key, tenant);

// Ingest
await sdk.ingest('logs', 'error content');

// Chat
const response = await sdk.chat('What failed?');

// Find functions in code
const funcs = sdk.findFunction('login', codeContent);
const asyncFuncs = sdk.findAsyncFunctions(codeContent);
```

---

## CLI SDK

### Installation
```bash
pip install brainbox-cli
```

### Configuration (First Time)
```bash
brainbox-cli init \
  --api-url https://api.brainbox.ai \
  --api-key sk_customer_abc \
  --tenant-id company-1
```

### Commands

```bash
# Check backend health
brainbox-cli health

# Collect logs manually
brainbox-cli collect --type docker,postgres,nginx,system

# Ingest collected logs
brainbox-cli ingest

# Or collect and ingest together
brainbox-cli collect --type docker && brainbox-cli ingest
```

### Log Types
- `docker` - Docker container logs
- `system` - System logs (syslog, auth, kernel)
- `postgres` - PostgreSQL error logs
- `nginx` - Nginx access/error logs
- `ssl` - SSL certificate information
- `services` - Service status
- `resources` - CPU, memory, disk usage

### Background Service

Once installed as system package, it runs automatically:

```bash
# Check status
sudo systemctl status brainbox-cli

# View logs
sudo journalctl -u brainbox-cli -f

# Restart
sudo systemctl restart brainbox-cli

# Stop
sudo systemctl stop brainbox-cli
```

---

## Database SDK

### Installation
```bash
pip install brainbox-db
```

### Connection Setup
```python
from brainbox_db import DatabaseReader

db = DatabaseReader(
    api_url="https://api.brainbox.ai",
    api_key="sk_customer_abc",
    tenant_id="company-1",
    db_type="postgres",  # postgres, mysql, sqlite
    host="db.example.com",
    port=5432,
    database="mydb",
    username="readonly_user"
)

# Test connection
db.test_connection()
```

### Query Data
```python
# Get schema
schema = db.get_schema()
for table_name in schema:
    print(f"Table: {table_name}")

# Query data
users = db.query("SELECT id, email FROM users LIMIT 10")
for user in users:
    print(f"{user['id']}: {user['email']}")

# Get table info
table = db.inspect_table("users")
print(f"Rows: {table.row_count}")
print(f"Columns: {len(table.columns)}")

# Sample data
sample = db.sample_data("users", limit=5)

# Export
json_data = db.export_table("users", output_format="json")
csv_data = db.export_table("users", output_format="csv")

# Statistics
stats = db.get_statistics("users")
print(f"Total rows: {stats['total_rows']}")
```

### Methods

| Method | Purpose |
|--------|---------|
| `test_connection()` | Verify database connection |
| `get_schema()` | Get all tables |
| `inspect_table(name)` | Table details |
| `list_tables()` | List all tables |
| `query(sql, parameters, limit)` | Execute query |
| `count_rows(table)` | Row count |
| `sample_data(table, limit)` | Sample rows |
| `search_table(table, column, value)` | Search data |
| `export_table(table, format, limit)` | Export data |
| `get_statistics(table)` | Table stats |
| `get_audit_log(limit)` | Query history |

### Security

**What's blocked:**
- ✗ DELETE statements
- ✗ DROP statements
- ✗ ALTER statements
- ✗ TRUNCATE statements
- ✗ INSERT statements
- ✗ UPDATE statements

**What's allowed:**
- ✓ SELECT statements
- ✓ WITH (CTE) queries
- ✓ Parameterized queries
- ✓ JOIN queries
- ✓ Aggregate functions

---

## Function Locator (Built into Main SDKs)

### Find Functions

**Python:**
```python
sdk = BrainboxPythonSDK(...)
results = sdk.find_function("login", directory="./src")
```

**Node.js:**
```javascript
const funcs = sdk.findFunction('login', './src');
```

**React:**
```tsx
const { findFunction } = useBrainbox(...);
const funcs = findFunction('login', codeSnippet);
```

### Function Info Object

All SDKs return function info with:
- `name` - Function name
- `file_path` - File location
- `line_number` - Line in file
- `signature` - Full signature
- `parameters` - List of parameters
- `is_async` - Is async function
- `language` - Programming language
- `class_name` - Class name (if method)

---

## Source Types for Ingest

| Type | Use Case |
|------|----------|
| `logs` | Generic log files |
| `docker_logs` | Docker container logs |
| `postgres_logs` | PostgreSQL logs |
| `nginx_logs` | Nginx logs |
| `ssl_certificates` | SSL info |
| `codebase` | Source code |
| `json` | JSON data |
| `csv` | CSV data |

---

## Error Handling

### Python
```python
try:
    response = sdk.chat("Question")
except Exception as e:
    print(f"Error: {e}")
```

### Node.js
```javascript
try {
  const response = await sdk.chat("Question");
} catch (error) {
  console.error(`Error: ${error.message}`);
}
```

### React
```tsx
const { error, loading } = useBrainbox(...);

if (error) return <p>Error: {error}</p>;
if (loading) return <p>Loading...</p>;
```

---

## Environment Variables

```bash
export BRAINBOX_API_URL=https://api.brainbox.ai
export BRAINBOX_API_KEY=sk_customer_abc
export BRAINBOX_TENANT_ID=company-1
```

---

## Support

- **Docs:** https://docs.brainbox.ai
- **API Status:** https://status.brainbox.ai
- **Help:** support@brainbox.ai
