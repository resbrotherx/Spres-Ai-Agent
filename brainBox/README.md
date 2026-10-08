# Brainbox - AI Backend

Production-grade AI backend for REST AI infrastructure with semantic search, LangGraph reasoning, and multi-tenant support.

## System Architecture

```
SDKs (Linux, Python, Node, React)
    ↓
FastAPI API
    ↓
Redis Queue
    ↓
Celery Workers
    ↓
Processing Pipeline
    ↓
Chunking + Embedding
    ↓
pgvector Database
    ↓
LangGraph AI
    ↓
AI Response
```

## Technology Stack

- **Framework**: FastAPI
- **Database**: PostgreSQL with pgvector
- **Cache/Queue**: Redis
- **Background Tasks**: Celery
- **AI/ML**: Sentence Transformers, LangGraph, LlamaIndex
- **LLM**: Ollama (local) or OpenAI (optional)
- **ORM**: SQLAlchemy

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Python 3.11+
- 4GB+ RAM

### Installation

1. **Clone and Setup**
```bash
cd brainBox
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

2. **Configure Environment**
```bash
cp .env.example .env
# Edit .env with your settings
```

3. **Start Services**
```bash
docker-compose up -d
```

4. **Initialize Database**
```bash
python -c "from app.db.session import init_db; init_db()"
```

5. **Start FastAPI**
```bash
uvicorn app.main:app --reload
```

6. **Start Celery Worker** (in another terminal)
```bash
celery -A app.celery_app.celery worker --loglevel=info
```

## Authentication & API keys

Every endpoint except `GET /` and `GET /api/health` needs an API key, sent as
`X-API-Key: <key>` or `Authorization: Bearer <key>`. Missing, unknown, revoked or expired keys
get `401 {"detail": "Invalid or missing API key"}`.

| Key type | Looks like | Where it may live | Can call |
|---|---|---|---|
| **publishable** | `pk_live_...` | browsers, mobile apps, public websites | `POST /api/chat`, `POST /api/chat/session`, sessions list (`POST /api/chat/sessions`, `GET /api/chat/sessions`, `/api/sessions`), `GET /api/chat/session/{id}/messages`, `POST /api/chat/upload/file`, `POST /api/chat/upload/image`, `GET /api/health` |
| **secret** | `sk_live_...` | servers only (Odoo, your backend, CI) - never ship it to a browser | everything: the above plus `/api/ingest*`, all `/api/train/*`, `/api/health/db`, `/api/health/cache`, `/api/health/vector` |

A publishable key on a secret-only endpoint gets `403` (`"This endpoint requires a secret API key ..."`).

**Tenant comes from the key.** `tenant_id` is now optional in every body / query / form. If you
send it and it differs from the key's tenant you get `403 {"detail": "tenant_id does not match API key"}`;
if you omit it the key's tenant is used.

**Roles are only trusted from servers.** With a publishable key, `user_role` from the client is
ignored and forced to `public` (`user_id` / `user_name` are still used to scope chat history).
With a secret key `user_role` is trusted: `admin`, `internal`, `customer`, `vendor`, `public`
(`portal` = `customer`). Unknown values and a missing role mean **`public`** - a server that wants
staff-level answers must say `"user_role": "internal"` (or `admin`) explicitly.

Keys are stored as SHA-256 hashes (`api_keys.key_hash`) with `key_type`, `key_prefix` (first
characters, for display), `tenant_id`, `name`, `is_active`, `expires_at` (honoured) and `last_used`
(updated at most once a minute). Keys created before key types existed (`key_type` NULL) are
treated as publishable.

### Managing keys

**CLI** (on the server, talks to the database directly; works even without the admin token):
```bash
python -m app.cli keys create --tenant acme --type publishable --name "Website widget"
python -m app.cli keys create --tenant acme --type secret --name "Odoo server" [--expires 2027-01-01]
# keep an already-deployed site working: import the key it already uses (>= 24 chars)
python -m app.cli keys create --tenant acme --type publishable --name "Legacy site" --key-stdin <<< "$OLD_KEY"
python -m app.cli keys list [--tenant acme]      # never prints raw keys
python -m app.cli keys revoke 42
```
The raw key is printed once by `create`; imported keys are not echoed. (`--key VALUE` also works
but leaves the key in your shell history.)

**Admin API** - requires `X-Admin-Token: $BRAINBOX_ADMIN_TOKEN` (constant-time compare; `503`
when the env var is unset, `401` when the header is wrong):

| Method | Path | Body / query | Returns |
|---|---|---|---|
| POST | `/api/admin/keys` | `{tenant_id, key_type: "publishable"\|"secret", name?, expires_at?, key?}` (`key` imports an existing raw key) | `201 {id, tenant_id, name, key_type, key_prefix, is_active, expired, created_at, expires_at, last_used, api_key}` - `api_key` only here, once. `409` duplicate, `422` invalid |
| GET | `/api/admin/keys?tenant_id=` | - | `{keys: [...]}` without raw keys |
| DELETE | `/api/admin/keys/{id}` | - | the revoked key (`is_active: false`); `404` if unknown |

`POST /api/auth/api-key?tenant_id=&key_type=publishable|secret` still exists for compatibility
but now also requires `X-Admin-Token` (it used to be open).

**Kill switch:** `REQUIRE_API_KEY=false` restores the old behaviour (no key needed, `tenant_id`
and `user_role` taken from the request; a warning is logged at startup). Use it only during
migration.

CORS stays open to any origin, with `allow_credentials=False` (keys are headers, not cookies).

## Audiences & roles

Every training source - and every document chunk it produces - has an **audience** saying who
the assistant may use it for:

| Audience | Meant for |
|---|---|
| `public` | anyone, including anonymous website visitors |
| `customer` | logged-in customers / portal users |
| `vendor` | suppliers / vendors |
| `internal` | staff (**default for new training sources**) |
| `admin` | administrators only |

Retrieval only returns chunks whose audience the effective role may read, so restricted content
never reaches the LLM (and the cache is keyed per tenant **and** role):

| Effective role | Sees audiences |
|---|---|
| `admin` | everything |
| `internal` | public, customer, vendor, internal |
| `customer` (`portal`) | public, customer |
| `vendor` | public, vendor |
| `public` (publishable keys, unknown/missing roles) | public |

Documents ingested before audiences existed have `audience = NULL` and are treated as
`LEGACY_DOC_AUDIENCE` (default `public`, so the live public widget keeps answering exactly as
before). Set `LEGACY_DOC_AUDIENCE=internal` to hide them from the public instead. `/api/ingest`
documents without an `audience` are stored as NULL (legacy) too.

Set the audience with the `audience` form field (`/api/train/file`) or JSON field
(`/api/train/text`, `/api/train/api-source`, `/api/ingest`); change it later with
`PATCH /api/train/sources/{source_id}` `{"audience": "customer"}` - this relabels every
document of the source at once and clears the tenant's cached answers.

## API Endpoints

### Health Checks
- `GET /api/health` - Service health (public). Send a key/staff JWT to also validate it: `key: {valid, key_type, tenant_id}` or 401 ("Test connection")
- `GET /api/health/db` - Database connection (secret key)
- `GET /api/health/cache` - Redis connection (secret key)
- `GET /api/health/vector` - pgvector + embedding check (secret key)

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/admin/keys`, `GET /api/admin/keys`, `DELETE /api/admin/keys/{id}` - API keys (`X-Admin-Token`)
- `POST /api/auth/api-key` - Deprecated, `X-Admin-Token` required

### Ingestion (secret key)
- `POST /api/ingest` - Queue data for ingestion (`audience?` optional)
- `GET /api/ingest/status/{task_id}` - Check ingestion status (only your tenant's tasks)

### Chat
- `POST /api/chat` - Send chat question (response includes `message_id` / `user_message_id`)
- `POST /api/chat/feedback` - Thumbs up/down on an answer `{session_id, message_id?, rating, comment?}`
- `GET /api/widget-config` - Widget appearance configured in the staff dashboard (publishable key OK)
- `POST /api/chat/session` - Create chat session
- `POST /api/chat/sessions` (or `GET ?tenant_id=&user_id=`) - List sessions grouped by date
- `GET /api/chat/session/{session_id}/messages?tenant_id=&user_id=` - Session history
- `POST /api/chat/upload/file`, `POST /api/chat/upload/image` - Attach a file to a session

## Staff dashboard API

Endpoints behind the React staff dashboard (`sdk-react` `StaffDashboard`). Staff log in with
email + password and send `Authorization: Bearer <jwt>`. Full contract: see `contract-staff.md`
(paths below are under `/api`).

### Accounts & roles

- Roles: `owner` > `admin` > `trainer` > `viewer`. Viewers read everything; trainers also train
  (`/api/train/*`, `/api/ingest`) and triage gaps; admins also manage staff below admin, settings
  and API keys; owners manage everyone. A tenant always keeps at least one active owner (409).
- Staff users are rows of `users` with `tenant_id` + `role` set (`username` = email). **Emails are
  unique globally**: one email address = one staff account in one tenant.
- Staff JWT (HS256, `JWT_SECRET_KEY`, `STAFF_JWT_HOURS`=12): `{sub: email, user_id, tenant_id, role,
  typ: "staff", iat, exp}`. The user row is re-loaded on every request, so deactivation, removal
  and role changes apply immediately. Password changes do not revoke already-issued tokens
  (they expire after 12 h) - deactivate the user to cut access at once.
- A staff JWT is accepted wherever a secret key is (tenant from the JWT; on secret-key endpoints
  write methods need trainer+). Staff-only endpoints (`/api/staff*`, `/api/reports*`,
  `/api/notifications*`, `/api/settings`, `/api/keys`) reject API keys with 403
  `Staff login required` - even with `REQUIRE_API_KEY=false`.
- Failed logins are rate limited per email+IP (`LOGIN_MAX_FAILURES` per `LOGIN_WINDOW_MINUTES`,
  429). The counter is **in memory, per worker process**: with several uvicorn workers the
  effective limit is multiplied - run one worker or add a proxy-level limit.

Bootstrap the first owner (on the server):

```bash
python -m app.cli staff create --tenant acme --email owner@acme.com --role owner --password-stdin <<< 'a long password'
python -m app.cli staff create --tenant acme --email ops@acme.com --role admin      # prints an invite link
python -m app.cli staff list [--tenant acme]
python -m app.cli staff set-password owner@acme.com --password-stdin
python -m app.cli staff deactivate someone@acme.com
# or over HTTP with the admin token:
curl -X POST $API/api/admin/staff -H "X-Admin-Token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"tenant_id":"acme","email":"owner@acme.com","role":"owner"}'   # -> {user, invite_url}
```

| Endpoint | Role |
|---|---|
| `POST /staff/login`, `/staff/accept-invite`, `/staff/forgot-password`, `/staff/reset-password` | none |
| `GET/PATCH /staff/me`, `POST /staff/me/password` | any staff |
| `GET /staff` | viewer |
| `POST /staff/invite`, `PATCH/DELETE /staff/{id}`, `POST /staff/{id}/resend-invite` | admin |
| `GET /reports/gaps[/{id}]`, `/reports/overview`, `/reports/conversations[/{session_id}]` | viewer |
| `PATCH /reports/gaps/{id}`, `POST /reports/gaps/{id}/answer` | trainer |
| `GET /notifications`, `POST /notifications/{id}/read`, `POST /notifications/read-all` | viewer (own) |
| `GET /settings` / `PUT /settings` | viewer / admin |
| `GET/POST /keys`, `DELETE /keys/{id}` | admin |
| `GET /widget-config` | any API key |

Invite links are valid 7 days, reset links 1 hour; both point to
`${DASHBOARD_URL or request Origin}/#/accept-invite?token=...` (`#/reset-password?token=...`).
Without SMTP the invite response still returns `invite_url` (with `email_sent: false`) so an admin
can share it manually.

### Knowledge gaps

Every `/api/chat` answer is checked (synchronously, no I/O except one tenant-settings read) and
the result is recorded in a background task, so responses aren't delayed:

| reason | when |
|---|---|
| `llm_unavailable` | the LLM fallback text was returned |
| `no_context` | retrieval found no documents for the user's audiences |
| `llm_unknown` | the answer starts with "I don't have that information yet" (the prompt asks for it) or a common "I don't know / couldn't find" phrase |
| `low_confidence` | best cosine distance > tenant `gap_distance_threshold` (default 0.55) |
| `negative_feedback` | thumbs-down via `POST /api/chat/feedback` |

Gaps are grouped per tenant by normalized question (lowercase, punctuation removed, whitespace
collapsed): repeats increase `occurrences` and keep the status (resolved stays resolved; negative
feedback re-opens). Cached answers store their gap reason in the cache entry, so a cached gap
answer still counts as an occurrence/unanswered question (no new notification). Answering a gap
(`POST /reports/gaps/{id}/answer`) creates a text training source "Answer: <question>" with
`Question: ...\nAnswer: ...`, resolves the gap (optionally also similar open gaps) and clears the
tenant's answer cache once trained.

Analytics (`/reports/overview`): `questions` = user messages in range (includes history);
`unanswered` = `chat_events` rows with `answered=false` (one per gap question asked, cached
included; recorded from this release on); `top_questions` from `chat_events`; days are UTC dates.

### Notifications & email

A new gap (first occurrence), every negative feedback and every failed training source (admins+
only) create an in-app notification for each active staff user with `notify_in_app`, and an email
to each with `notify_email` when SMTP is configured and the tenant allows it (`notify_on_gap` /
`notify_on_feedback`). Notification emails are capped at `email_max_per_hour` **per tenant,
counted per recipient email** (table `email_log`); over the cap the email is skipped (in-app
still created). Invite / reset emails are never throttled. Without `SMTP_HOST` all email is
skipped silently (logged at INFO).

SMTP: `SMTP_HOST`, `SMTP_PORT` (default 587/465/25 by mode), `SMTP_USER`, `SMTP_PASSWORD`,
`SMTP_FROM`, `SMTP_TLS` = `starttls` | `ssl` | `none`, `SMTP_TIMEOUT`.

### Upgrade notes

- Set `JWT_SECRET_KEY` to a long random value before creating staff (the placeholder logs a loud
  warning at startup; anyone knowing the secret can forge staff sessions). Changing it logs
  everyone out.
- New tables (`knowledge_gaps`, `chat_events`, `chat_feedback`, `notifications`,
  `tenant_settings`, `email_log`) are created and `users` columns added on startup (Postgres).
- Set `DASHBOARD_URL` (e.g. `https://admin.example.com/brainbox`) so emailed links are absolute.
- The answer cache key is now a SHA-256 of the whole normalized question (tenant + role scoped);
  old cache entries simply expire.

## Usage Examples

### Ingest Data

```bash
curl -X POST http://localhost:8000/api/ingest \
  -H "X-API-Key: sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "source_type": "logs",
    "file_path": "/var/log/app.log",
    "content": "2024-01-15 ERROR: Database connection failed"
  }'
```

### Chat API

```bash
curl -X POST http://localhost:8000/api/chat \
  -H "X-API-Key: pk_live_..." \
  -H "Content-Type: application/json" \
  -d '{"question": "Why is the database failing?"}'
```

### Per-user sessions

Integrators (Odoo, websites) can scope chat history to their own end users without keeping
their own storage. All fields are optional; clients that omit them behave exactly as before
(sessions are tenant-wide).

| Field | Meaning |
|---|---|
| `user_id` | External user id, e.g. `"odoo:mydb:7"` |
| `user_name` | Display name |
| `user_role` | `admin` / `internal` / `portal` / `customer` / `vendor` / `public` - trusted only with a secret key (see Audiences & roles) |

Accepted on `POST /api/chat`, `POST /api/chat/session`, `POST /api/chat/sessions` (body),
`GET /api/chat/sessions` (query `user_id`), `GET /api/chat/session/{id}/messages`
(query `tenant_id`, `user_id`) and the upload endpoints (form fields).

- Sessions created with a `user_id` are stamped with it (`chat_sessions.external_user_id`,
  `user_name`, `user_role`); listing with a `user_id` returns only that user's sessions.
  Listing without `user_id` returns every session of the tenant (legacy).
- A session stamped with a user can only be read / written / uploaded to with that same
  `user_id`; any other caller, or a `tenant_id` that doesn't match, gets
  `404 {"detail": "Session not found"}`. Unstamped (legacy) sessions stay tenant-wide.
- `POST /api/chat` (and uploads) with a `session_id` that doesn't exist yet creates that
  session, stamped with the tenant/user, so client-chosen ids work and no orphan messages exist.
- Session responses include `user_id` (null for tenant-wide sessions).
- The effective role filters retrieval (see Audiences & roles). It always comes from the current
  request/key - a session stamped with a role earlier never lends that role to a later caller.
- Note: a publishable key can still list/read tenant-wide (unstamped) sessions, as before; send
  `user_id` to keep end users apart.

```bash
curl -X POST http://localhost:8000/api/chat -H "X-API-Key: sk_live_..." -H "Content-Type: application/json" \
  -d '{"question": "Where is my order?", "user_id": "odoo:mydb:7", "user_name": "Alice", "user_role": "portal"}'
curl -H "X-API-Key: pk_live_..." "http://localhost:8000/api/chat/sessions?user_id=odoo:mydb:7"
```

## Training API

Teach a tenant's bot from files, free text and third-party APIs (e.g. a support desk's
tickets and the responses given). Content is extracted, chunked, embedded (bge-base, 768d)
and stored in `documents` with a `source_id`; chat retrieves it via pgvector search.
Every endpoint requires a **secret** key (publishable keys get 403); `tenant_id` is optional
(defaults to the key's tenant, 403 if it differs). Errors are `{"detail": "..."}`. Heavy work runs in the
background: create calls return **202** with `{source, task_id}`; poll
`GET /api/train/sources/{source_id}?tenant_id=` (or `GET /api/ingest/status/{task_id}`).

| Method | Path | Body / query | Returns |
|---|---|---|---|
| POST | `/api/train/file` | multipart: `file`, `tenant_id?`, `name?`, `audience?` | `{source, task_id}` |
| POST | `/api/train/text` | `{tenant_id?, name?, content, audience?}` | `{source, task_id}` |
| POST | `/api/train/api-source/test` | ApiSourceConfig | `{ok, status_code, records_found, preview[{title,text}], detected_fields, error?, data_path, records_skipped}` |
| POST | `/api/train/api-source` | ApiSourceConfig | `{source, task_id}` |
| POST | `/api/train/sources/{source_id}/sync?tenant_id=` | - | `{source, task_id}` (400 for non-API, 409 if already syncing) |
| GET | `/api/train/sources?tenant_id=` | - | `{sources: [TrainingSource], totals: {sources, documents}}` (newest first) |
| GET | `/api/train/sources/{source_id}?tenant_id=` | - | `TrainingSource` (404 if missing / other tenant) |
| PATCH | `/api/train/sources/{source_id}` | `{audience?, name?}` | `TrainingSource` (relabels all its documents) |
| DELETE | `/api/train/sources/{source_id}?tenant_id=` | - | `{deleted: true, documents_deleted}` |

**Files** (max 25 MB, else 413; other types 415): `.pdf` (per page, `page` kept in chunk
metadata; scanned PDFs without a text layer fail with a message - no OCR), `.xml` (flattened to
`path/tag: text` lines, `@attr` lines; repeated elements become one chunk each), `.docx`,
`.txt`, `.md`, `.csv`, `.json`. JSON/CSV/XML that look like support tickets are run through the
ticket normalizer below.

**TrainingSource**: `source_id, tenant_id, name, kind (file|api|text), source_type (pdf, xml, docx,
txt, md, csv, json, text, support_tickets, api_generic), filename, url, audience (public|customer|vendor|internal|admin;
legacy sources show LEGACY_DOC_AUDIENCE), status
(queued|processing|completed|failed), documents_count, records_count, last_task_id,
last_synced_at, error_message, created_at, updated_at, config` (API sources only; secret-looking
headers/query params/body keys are returned as `"••••"`).

**ApiSourceConfig**:
```json
{
  "name": "Helpdesk", "audience": "internal", "url": "https://desk.example.com/api/v2/tickets",
  "method": "GET", "headers": {"Authorization": "Bearer ..."}, "query": {"status": "solved"},
  "body": null, "data_path": "data.tickets", "source_type": "support_tickets",
  "mapping": {"id_field": "id", "title_field": "subject", "question_field": "description",
              "answer_field": "resolution", "messages_field": "comments", "extra_fields": ["priority"]},
  "pagination": {"type": "page", "page_param": "page", "max_pages": 10}
}
```
- `data_path` (dot path, list indexes allowed) is auto-detected when omitted: a top-level list,
  or the first list under `data/results/items/tickets/records/...`.
- `pagination.type`: `none` | `page` (increments `page_param`, stops on an empty/repeated page) |
  `cursor` (reads `cursor_path`, e.g. `meta.next_cursor`, and sends it as `cursor_param`; a full
  `next` URL is followed directly). Capped by `max_pages` (<= 100). Requests: 30 s timeout,
  redirects followed, 20 MB max per response.
- `support_tickets` renders one chunk per ticket (split only above ~2000 chars):
  `Support ticket #<id>: <subject>` / `Customer issue: ...` / `Our response: ...` /
  `Conversation:` with `Customer:` / `Agent:` lines / `key: value` extras. Fields are auto-detected
  (case-insensitive, also one level nested such as Jira's `fields.summary`) when `mapping` is
  omitted. Records with neither an issue nor a response are skipped (noted in `error_message`).
  Re-syncs skip unchanged tickets and replace tickets whose content (e.g. response) changed.
- `api_generic` renders each record as flattened `key: value` lines.

Examples:
```bash
K='X-API-Key: sk_live_...'
curl -H "$K" -F audience=public -F file=@handbook.pdf http://localhost:8000/api/train/file
curl -X POST http://localhost:8000/api/train/text -H "$K" -H 'Content-Type: application/json' \
  -d '{"name":"Shipping FAQ","audience":"public","content":"We ship to 40 countries..."}'
curl -X POST http://localhost:8000/api/train/api-source/test -H "$K" -H 'Content-Type: application/json' \
  -d '{"url":"https://desk.example.com/api/tickets","headers":{"Authorization":"Bearer TOKEN"}}'
curl -H "$K" "http://localhost:8000/api/train/sources"
curl -X PATCH -H "$K" -H 'Content-Type: application/json' -d '{"audience":"customer"}' \
  "http://localhost:8000/api/train/sources/<source_id>"
curl -X DELETE -H "$K" "http://localhost:8000/api/train/sources/<source_id>"
```

Schema changes are applied automatically on startup by `init_db()`: new `training_sources`
table, `documents.source_id` + `documents.audience` columns + indexes, `training_sources.audience`,
`api_keys.key_type` + `api_keys.key_prefix` (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`), and
`CREATE EXTENSION IF NOT EXISTS vector`.

## SDK Integration

All SDKs post to `/api/ingest` with a **secret** key (`X-API-Key: sk_live_...`):

```json
{
  "tenant_id": "string (optional, must match the key)",
  "audience": "public|customer|vendor|internal|admin (optional; omitted = legacy/LEGACY_DOC_AUDIENCE)",
  "source_type": "logs|codebase|json|csv|docker_logs|nginx_logs|postgres_logs",
  "file_path": "string",
  "content": "string",
  "metadata": {}
}
```

## Database Models

- **Document**: Stores chunks with embeddings
- **User**: Application users
- **APIKey**: API key management
- **ProcessingTask**: Ingestion task tracking
- **ChatSession**: Chat session management (optionally owned by an external user)
- **ChatMessage**: Chat message history

## Deduplication

Prevents duplicate embeddings and reduces:
- Storage costs
- Embedding compute time
- Irrelevant search results

Hash: SHA256 of content

## Multi-Tenancy

Every table includes `tenant_id` for complete isolation:
- Customers see only their data
- Independent vector spaces per tenant
- Secure data boundaries

## Caching Strategy

Redis caching reduces costs:

1. User asks question
2. Check Redis cache
3. If hit: return cached response
4. If miss: pgvector search + LLM + cache result

Cache TTL: 1 hour

## Production Deployment

### Enabling API keys (upgrade checklist)

Do these steps **before** running the new version with `REQUIRE_API_KEY=true` (the default),
otherwise every existing client starts getting 401:

1. Deploy the code with `REQUIRE_API_KEY=false` in `.env` first (schema columns are added on startup).
2. Set `BRAINBOX_ADMIN_TOKEN` in `.env` to a long random value
   (`python -c "import secrets; print(secrets.token_urlsafe(48))"`) and restart.
3. For every existing site/integration, register a key **for its tenant** (on the server):
   - Browser widgets / public sites that already ship a key: import that exact key as
     publishable so nothing has to be redeployed:
     `python -m app.cli keys create --tenant <T> --type publishable --name "<site>" --key-stdin <<< "<current key>"`
   - Server integrations (Odoo module, backends, the TrainingPanel admin tool, SDK ingesters):
     `python -m app.cli keys create --tenant <T> --type secret --name "<integration>"` and put the
     new `sk_live_...` into that server's config (never into front-end code).
   - Check with `python -m app.cli keys list`.
   - With Docker, run the CLI inside the API container: `docker exec -i brainbox-api python -m app.cli keys ...`.
4. Decide `LEGACY_DOC_AUDIENCE` (default `public` keeps today's answers) and relabel sensitive
   training sources (`PATCH /api/train/sources/{id}` or the TrainingPanel audience picker).
5. Set `REQUIRE_API_KEY=true` (or remove the line) and restart. Watch the logs for 401/403s;
   flip back to `false` to roll back instantly.

### Using Docker Compose

```bash
docker-compose -f docker-compose.yml up -d
```

### Using Kubernetes

Create deployment manifests in `k8s/` directory.

### Monitoring

- Logs: `brainbox.log`
- Metrics: Expose Prometheus metrics at `/metrics`
- Alerts: Configure based on task failure rates

## Configuration

Key settings in `app/config.py`:

- `CHUNK_SIZE`: 1024 bytes
- `VECTOR_DIM`: 768 dimensions
- `BATCH_SIZE`: 32 documents
- `MAX_FILE_SIZE`: 50 MB

## Performance Tips

1. **Use pgvector indexes**: Automatically created
2. **Batch ingestion**: Group multiple documents
3. **Enable caching**: Redis TTL 3600s
4. **Scale Celery**: Add workers as needed
5. **Monitor embeddings**: Track generation time

## Troubleshooting

**Celery tasks not processing?**
```bash
celery -A app.celery_app.celery inspect active
```

**Database errors?**
```bash
# Check connection
python -c "from app.db.session import engine; engine.execute('SELECT 1')"
```

**Redis connection issues?**
```bash
redis-cli ping
```

## SDK Support

- Linux Agent (`linux-agent/`)
- Python SDK (`sdk-python/`)
- Node SDK (`sdk-node/`)
- React SDK (`sdk-react/`)

## Next Steps

1. Implement rate limiting (per API key)
2. Origin allow-lists per publishable key
3. Add monitoring dashboards
4. Configure S3 backup
5. Set up Kubernetes deployment
6. Add tool approval workflow

## License

MIT
