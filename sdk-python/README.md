# Brainbox Python SDK (`spres-ai`)

Train your Brainbox from your own servers, scripts and databases, and chat with it.
Everything you send goes straight to your Brainbox and is processed by Brainbox's own AI.

## Installation

Until the package is on PyPI, install the wheel straight from your Brainbox server:

```bash
pip install https://port.smartpowerbilling.com/sdk/downloads/spres_ai-1.1.0-py3-none-any.whl
```

(Later: `pip install spres-ai`.) Requires Python 3.8+ and `requests`.

## Keys: which identifier is which

| Identifier | Looks like | Use it for |
|---|---|---|
| Tenant ID | `acme-co` | Which company's knowledge base. Not a password. Optional here: the key already decides it. |
| Publishable key | `pk_live_...` | Websites / apps chat widgets only. Safe in a browser. Cannot train. |
| Secret key | `sk_live_...` | Servers, scripts, training. **Never put it in a browser or mobile app.** |

Create a secret key in the staff dashboard: **Settings -> API keys -> Create -> Secret**.
Keep it in an environment variable:

```bash
export BRAINBOX_SECRET_KEY=sk_live_...        # PowerShell: $env:BRAINBOX_SECRET_KEY="sk_live_..."
```

## Training quick start

```python
import os
from brainbox_sdk import BrainboxPythonSDK

sdk = BrainboxPythonSDK(
    api_url="https://port.smartpowerbilling.com",
    api_key=os.environ["BRAINBOX_SECRET_KEY"],   # tenant comes from the key
)

# 1) Upload a document (PDF, XML, DOCX, TXT, CSV, JSON...; max 25 MB)
job = sdk.train_file("employee-handbook.pdf", name="Handbook", audience="internal")
sdk.wait_for_task(job["task_id"])                 # polls until completed / failed

# 2) Teach free text or database rows
for row in rows_from_my_database():
    sdk.train_text(
        f"Q: {row['question']}\nA: {row['answer']}",
        name=f"FAQ #{row['id']}",
        audience="customer",
    )

# 3) Connect a support-tickets API (preview first, nothing is saved)
config = dict(
    url="https://helpdesk.example.com/api/tickets",
    headers={"Authorization": "Bearer HELPDESK_TOKEN"},
    data_path="data.tickets",
    source_type="support_tickets",
    mapping={"question_field": "subject", "answer_field": "resolution"},
    pagination={"type": "page", "page_param": "page", "max_pages": 10},
    audience="internal",
)
preview = sdk.test_api_source(**config)
if preview["ok"]:
    source = sdk.add_api_source(name="Helpdesk", **config)

# 4) Manage sources
print(sdk.list_sources()["totals"])                       # {'sources': 3, 'documents': 120}
sdk.update_source(source["source"]["source_id"], audience="customer")
sdk.sync_source(source["source"]["source_id"])            # re-fetch an API source now
sdk.delete_source(source["source"]["source_id"])          # forget everything it taught
```

A complete script lives in [`examples/train_from_python.py`](examples/train_from_python.py).

### Audiences

Every source has an audience that controls who the AI may show it to:
`public`, `customer`, `vendor`, `internal` (default) and `admin`.
Change it later with `update_source(source_id, audience=...)`.

## Training methods

| Method | What it does | Returns |
|---|---|---|
| `train_file(path, name=None, audience=None)` | Upload a document | `{"source", "task_id"}` |
| `train_text(content, name=None, audience=None)` | Teach free text / one record | `{"source", "task_id"}` |
| `test_api_source(**config)` | Dry-run an API, preview records | `{"ok", "records_found", "preview", "detected_fields", "error"}` |
| `add_api_source(**config)` | Save an API source and start syncing | `{"source", "task_id"}` |
| `list_sources()` | All sources | `{"sources", "totals"}` |
| `get_source(id)` | One source | source dict |
| `update_source(id, audience=None, name=None)` | Rename / relabel | source dict |
| `delete_source(id)` | Delete a source and its documents | `{"deleted", "documents_deleted"}` |
| `sync_source(id)` | Re-fetch an API source | `{"source", "task_id"}` |
| `get_ingest_status(task_id)` | Status of any task | `{"task_id", "status", "error_message"}` |
| `wait_for_task(task_id, timeout=600, poll=3)` | Block until a task finishes | final status |

`add_api_source` / `test_api_source` keywords: `url` (required), `name`, `method` (`GET`/`POST`),
`headers`, `query`, `body`, `data_path`, `source_type` (`support_tickets` | `api_generic`),
`mapping` (`id_field`, `question_field`, `answer_field`, `title_field`, `messages_field`,
`extra_fields`), `pagination` (`type`: `none`/`page`/`cursor`, `page_param`, `cursor_path`,
`cursor_param`, `max_pages`), `audience`.

## Errors

All API errors raise `BrainboxError` (or a subclass) with the backend's explanation:

```python
from brainbox_sdk import BrainboxError, BrainboxAuthError, BrainboxValidationError

try:
    sdk.train_file("photo.png")
except BrainboxValidationError as e:     # 400/409/413/415/422
    print(e.status_code, e.detail)       # 415 "Unsupported file type '.png'. Allowed: ..."
except BrainboxAuthError:                # 401/403: wrong or publishable key
    print("Use a secret key (sk_live_...)")
except BrainboxError as e:               # anything else, incl. network errors
    print(e)
```

## Other methods

- `ingest(source_type, content, file_path=None, metadata=None, audience=None)`: low-level ingest
  (logs, codebase, json, csv, nginx_logs, docker_logs, postgres_logs).
- `chat(question, session_id=None)`, `create_chat_session(title=None)`.
- `health_check()`.

API reference: https://port.smartpowerbilling.com/docs

## Function Locator (Built-in)

Find functions in your codebase without needing a separate tool.

### Find a Specific Function

```python
sdk = BrainboxPythonSDK(api_key="sk_live_...")

# Find login function
login_funcs = sdk.find_function("login", directory="./src")
for func in login_funcs:
    print(f"Found: {func.name}")
    print(f"Location: {func.file_path}:{func.line_number}")
    print(f"Signature: {func.signature}")
    print(f"Parameters: {func.parameters}")
```

### Find All Functions

```python
# Get all functions in codebase
all_funcs = sdk.find_all_functions(directory="./src")
print(f"Total functions: {len(all_funcs)}")
```

### Find Functions in Specific File

```python
# Get all functions in a file
auth_funcs = sdk.find_function_by_file("./src/auth.py")
for func in auth_funcs:
    print(f"  {func.name} at line {func.line_number}")
```

### Find Async Functions

```python
# Find all async/await functions
async_funcs = sdk.find_async_functions(directory="./src")
print(f"Found {len(async_funcs)} async functions")

for func in async_funcs:
    print(f"  {func.name} (async) in {func.file_path}")
```

### Function Info Object

```python
func = sdk.find_function("login")[0]

# Access function details
print(func.name)           # "login"
print(func.file_path)      # "/app/auth.py"
print(func.line_number)    # 45
print(func.signature)      # "def login(username, password)"
print(func.parameters)     # ["username", "password"]
print(func.is_async)       # False
print(func.language)       # "python"
print(func.class_name)     # None (or class name if method)

# Convert to dict
func_dict = func.to_dict()
```

### Supported Languages

- Python (`.py` files)
- JavaScript (`.js` files)
- TypeScript/React (`.ts`, `.tsx` files)
