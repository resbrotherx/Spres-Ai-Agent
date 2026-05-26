# Brainbox Python SDK

Python client library for Brainbox AI Backend.

## Installation

```bash
pip install requests
```

## Quick Start

```python
from brainbox_sdk import BrainboxPythonSDK

sdk = BrainboxPythonSDK(
    api_url="http://localhost:8000",
    api_key="your-api-key",
    tenant_id="company-1"
)

# Ingest data
result = sdk.ingest(
    source_type="logs",
    content="ERROR: Database connection failed",
    file_path="/var/log/app.log"
)
print(f"Task ID: {result['task_id']}")

# Chat
response = sdk.chat("What happened to the database?")
print(f"Answer: {response['response']}")
```

## Methods

### `ingest(source_type, content, file_path=None, metadata=None)`

Send data to Brainbox for processing.

**Parameters:**
- `source_type` (str): Type of data (logs, codebase, json, csv, docker_logs, nginx_logs, postgres_logs)
- `content` (str): The actual content to ingest
- `file_path` (str, optional): File path for reference
- `metadata` (dict, optional): Additional metadata

**Returns:** Dictionary with `task_id` and `status`

### `chat(question, session_id=None)`

Ask a question to the AI.

**Parameters:**
- `question` (str): Your question
- `session_id` (str, optional): Chat session ID

**Returns:** Dictionary with `response`, `reasoning`, and `search_results`

### `get_ingest_status(task_id)`

Check ingestion task status.

**Parameters:**
- `task_id` (str): Task ID from ingest response

**Returns:** Task status dictionary

### `create_chat_session(title=None)`

Create a new chat session.

**Parameters:**
- `title` (str, optional): Session title

**Returns:** Dictionary with `session_id`

### `health_check()`

Check if backend is running.

**Returns:** Service health status

## Examples

### Ingest Logs

```python
sdk.ingest(
    source_type="logs",
    content=open("/var/log/nginx/error.log").read(),
    file_path="/var/log/nginx/error.log"
)
```

### Ingest Code

```python
sdk.ingest(
    source_type="codebase",
    content=open("app.py").read(),
    file_path="app.py"
)
```

### Ingest JSON

```python
sdk.ingest(
    source_type="json",
    content='{"error": "Failed", "code": 500}',
    file_path="config.json"
)
```

### Chat Session

```python
# Create session
session = sdk.create_chat_session(title="Troubleshooting")
session_id = session['session_id']

# Ask questions in the session
response = sdk.chat("What's happening?", session_id=session_id)
response = sdk.chat("How do I fix it?", session_id=session_id)
```

## Error Handling

```python
try:
    response = sdk.chat("Question")
except Exception as e:
    print(f"Error: {e}")
```

## Source Types

| Type | Use Case |
|------|----------|
| logs | Generic log files |
| nginx_logs | Nginx access/error logs |
| docker_logs | Docker container logs |
| postgres_logs | PostgreSQL logs |
| codebase | Source code |
| json | JSON formatted data |
| csv | CSV formatted data |
