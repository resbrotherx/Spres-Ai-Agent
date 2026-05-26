# 📚 DOCUMENTATION INDEX

## Quick Navigation

### 🏃 Quick Start (Start Here!)
- **[QUICK_START.md](QUICK_START.md)** - Get running in 5 minutes
- **[INSTALLATION.md](brainBox/INSTALLATION.md)** - Detailed installation guide
- **[GETTING_STARTED.md](brainBox/GETTING_STARTED.md)** - Usage examples and workflows

### 📖 Main Documentation
- **[README.md](brainBox/README.md)** - Architecture overview and features
- **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** - Complete file structure
- **[API Documentation](http://localhost:8000/docs)** - Interactive API docs (after starting)

### 🔧 SDK Documentation
- **[Python SDK](sdk-python/README.md)** - Python client library
- **[Node SDK](sdk-node/README.md)** - Node.js client library
- **[React SDK](sdk-react/README.md)** - React/TypeScript client library

---

## File Directory

### Brainbox Backend
```
brainBox/
├── README.md                 # Main documentation
├── GETTING_STARTED.md        # Usage guide
├── INSTALLATION.md           # Setup instructions
├── requirements.txt          # Python dependencies
├── docker-compose.yml        # Container orchestration
├── Dockerfile                # Container image
├── .env.example             # Environment template
├── setup.py                 # Python package setup
├── pyproject.toml           # Modern Python config
├── setup.sh                 # Unix setup script
├── setup.bat                # Windows setup script
├── app/
│   ├── main.py              # FastAPI entry point
│   ├── config.py            # Configuration
│   ├── api/                 # API routes
│   ├── agents/              # LangGraph agents
│   ├── db/                  # Database layer
│   ├── ingestion/           # Data pipeline
│   ├── embeddings/          # Embedding generation
│   ├── llm/                 # LLM integrations
│   ├── chunkers/            # Data chunking
│   ├── schemas/             # Request/response schemas
│   ├── utils/               # Utilities
│   └── celery_app/          # Background jobs
└── tests/
    └── test_api.py          # API tests
```

### SDKs
```
sdk-python/
├── brainbox_sdk.py          # Python SDK
└── README.md                # Python docs

sdk-node/
├── brainbox-sdk.js          # Node.js SDK
├── package.json             # Dependencies
└── README.md                # Node docs

sdk-react/
├── brainbox-sdk.ts          # React SDK
├── package.json             # Dependencies
└── README.md                # React docs
```

---

## By Task

### 🚀 I Want To...

#### Get Started Quickly
→ Read: **QUICK_START.md** (5 min)

#### Install Everything
→ Read: **INSTALLATION.md** (15 min)

#### Understand Architecture
→ Read: **README.md** + **PROJECT_STRUCTURE.md** (20 min)

#### Use the Python SDK
→ Read: **sdk-python/README.md** + Example code

#### Use the Node SDK
→ Read: **sdk-node/README.md** + Example code

#### Use the React SDK
→ Read: **sdk-react/README.md** + Example code

#### Ingest Data
→ See examples in **GETTING_STARTED.md**

#### Deploy to Production
→ See deployment section in **README.md**

#### Troubleshoot Issues
→ Check troubleshooting section in **INSTALLATION.md**

#### Understand the Code
→ Check specific modules in **app/** with docstrings

---

## Technology Overview

| Component | Technology | Docs |
|-----------|-----------|------|
| Web Framework | FastAPI | [fastapi.tiangolo.com](https://fastapi.tiangolo.com) |
| Database | PostgreSQL + pgvector | [postgres.org](https://www.postgresql.org) |
| Cache/Queue | Redis | [redis.io](https://redis.io) |
| Background Jobs | Celery | [celery.io](https://docs.celeryproject.io) |
| Embeddings | Sentence Transformers | [huggingface.co](https://huggingface.co) |
| AI Agents | LangGraph | [langchain.com](https://python.langchain.com) |
| LLM | Ollama | [ollama.ai](https://ollama.ai) |
| ORM | SQLAlchemy | [sqlalchemy.org](https://www.sqlalchemy.org) |

---

## Key Concepts

### Ingestion Pipeline
1. User sends data via `/api/ingest`
2. Task queued in Redis
3. Celery worker processes
4. Data chunked by type
5. Embeddings generated
6. Duplicates filtered
7. Stored in pgvector

### Chat Flow
1. User sends question via `/api/chat`
2. Check Redis cache
3. If miss: semantic search in pgvector
4. Send context to LLM
5. Generate response
6. Cache result

### Multi-Tenancy
- Every table has `tenant_id`
- Complete data isolation
- Independent embeddings
- Secure by design

---

## API Quick Reference

### Health
- `GET /api/health` - Check service health
- `GET /api/health/db` - Check database
- `GET /api/health/cache` - Check cache

### Auth
- `POST /api/auth/login` - Login
- `POST /api/auth/api-key` - Create API key

### Ingest
- `POST /api/ingest` - Queue data
- `GET /api/ingest/status/{task_id}` - Check status

### Chat
- `POST /api/chat` - Send message
- `POST /api/chat/session` - Create session

### Documentation
- `GET /docs` - Swagger UI
- `GET /redoc` - ReDoc

---

## Common Tasks

### Run Backend
```bash
cd brainBox
docker-compose up -d
uvicorn app.main:app --reload
```

### Run Celery
```bash
celery -A app.celery_app.celery worker --loglevel=info
```

### Run Tests
```bash
pytest tests/
```

### Check Status
```bash
docker-compose ps
docker-compose logs
```

### Install Python SDK
```bash
pip install -r sdk-python/requirements.txt
python sdk-python/brainbox_sdk.py
```

### Install Node SDK
```bash
cd sdk-node
npm install
```

### Use React SDK
```bash
npm install axios
import { BrainboxReactSDK } from '../sdk-react/brainbox-sdk'
```

---

## Support Resources

| Resource | Link |
|----------|------|
| API Docs | http://localhost:8000/docs |
| GitHub Issues | [GitHub Issues URL] |
| Slack | [Slack Channel] |
| Email | support@restai.com |

---

## Next Steps

1. ✅ Read QUICK_START.md
2. ✅ Run docker-compose up
3. ✅ Start FastAPI
4. ✅ Visit http://localhost:8000/docs
5. ✅ Try example requests
6. ✅ Integrate SDKs
7. ✅ Deploy to production

---

## Last Updated
**May 23, 2024**

## Version
**1.0.0**
