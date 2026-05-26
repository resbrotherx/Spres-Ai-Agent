# PROJECT_STRUCTURE.md

## Complete Brainbox AI Backend Project Structure

### Backend (brainBox/)

#### Core Application (app/)
- `main.py` - FastAPI entry point with middleware setup
- `config.py` - Configuration management with environment variables
- `dependencies.py` - Authentication and dependency injection

#### API Routes (app/api/)
- `ingest.py` - Data ingestion endpoints
- `chat.py` - Chat and conversation endpoints
- `health.py` - Health check endpoints
- `auth.py` - Authentication and API key management

#### Database (app/db/)
- `session.py` - Database connection and session management
- `base.py` - SQLAlchemy declarative base
- `models.py` - Database models (Document, User, APIKey, etc.)

#### AI Agents (app/agents/)
- `state.py` - LangGraph agent state definition
- `graph.py` - LangGraph workflow graph
- `nodes/`
  - `log_node.py` - Search and context retrieval nodes
- `tools/`
  - `vector_search.py` - Semantic search with pgvector
  - `postgres_search.py` - Full-text search

#### Ingestion Pipeline (app/ingestion/)
- `pipeline.py` - Main ingestion and processing logic
- `dedupe.py` - Deduplication system

#### Data Chunking (app/chunkers/)
- `logs.py` - Log file chunking
- `code.py` - Source code chunking
- `json.py` - JSON data chunking
- `csv.py` - CSV data chunking

#### Embeddings (app/embeddings/)
- `model.py` - Sentence Transformer model loading
- `generator.py` - Embedding generation functions

#### LLM Integration (app/llm/)
- `ollama_client.py` - Local LLM client (Ollama)
- `openai_client.py` - Cloud LLM client (OpenAI)

#### Background Tasks (app/celery_app/)
- `celery.py` - Celery configuration
- `tasks.py` - Background job definitions

#### Caching (app/redis_cache/)
- `cache.py` - Redis cache operations

#### Utilities (app/utils/)
- `hashing.py` - Content hashing and password hashing
- `logging.py` - Logging configuration
- `security.py` - JWT tokens and security functions

#### Request/Response Schemas (app/schemas/)
- `ingest.py` - Ingestion payload schemas
- `chat.py` - Chat payload schemas

#### Configuration Files
- `requirements.txt` - Python dependencies
- `docker-compose.yml` - Multi-container setup
- `Dockerfile` - Container image build
- `.env` - Environment variables
- `.env.example` - Environment template
- `setup.py` - Python package setup
- `pyproject.toml` - Modern Python project config
- `.gitignore` - Git ignore rules

#### Documentation
- `README.md` - Main documentation
- `GETTING_STARTED.md` - Quick start guide
- `INSTALLATION.md` - Detailed installation
- `GETTING_STARTED.md` - Usage guide

#### Scripts
- `setup.sh` - Unix/Linux setup script
- `setup.bat` - Windows setup script

#### Testing
- `tests/test_api.py` - API integration tests

---

### Python SDK (sdk-python/)
- `brainbox_sdk.py` - Python SDK client library
- `README.md` - Python SDK documentation

### Node.js SDK (sdk-node/)
- `brainbox-sdk.js` - Node.js SDK client library
- `package.json` - Node dependencies
- `README.md` - Node SDK documentation

### React SDK (sdk-react/)
- `brainbox-sdk.ts` - React/TypeScript SDK
- `package.json` - React dependencies
- `README.md` - React SDK documentation

---

## Key Features

### Data Ingestion
- Multi-source support (logs, code, JSON, CSV)
- Automatic chunking and deduplication
- Background processing with Celery
- Metadata tracking

### AI & Search
- Semantic search with pgvector
- Full-text search capability
- LangGraph agent framework
- Multi-step reasoning

### LLM Support
- Ollama for local inference
- OpenAI for cloud-based
- Configurable model selection
- Response caching

### Multi-Tenancy
- Complete data isolation
- Tenant-scoped API keys
- Per-tenant embeddings
- Secure RBAC

### Performance
- Redis caching layer
- Async/await support
- Batch processing
- Connection pooling

---

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Web Framework | FastAPI |
| Database | PostgreSQL with pgvector |
| Cache/Queue | Redis |
| Background Jobs | Celery |
| Embeddings | Sentence Transformers |
| AI Agents | LangGraph |
| LLM | Ollama/OpenAI |
| ORM | SQLAlchemy |
| API Docs | Swagger/ReDoc |

---

## Deployment Options

### Development
```bash
docker-compose up -d
uvicorn app.main:app --reload
```

### Docker Production
```bash
docker build -t brainbox:1.0.0 .
docker run -d brainbox:1.0.0
```

### Kubernetes
```bash
kubectl apply -f k8s/
```

---

## API Endpoints

### Health & Status
- `GET /api/health` - Service health
- `GET /api/health/db` - Database status
- `GET /api/health/cache` - Cache status

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/api-key` - Generate API key

### Ingestion
- `POST /api/ingest` - Queue data ingestion
- `GET /api/ingest/status/{task_id}` - Check status

### Chat
- `POST /api/chat` - Send chat message
- `POST /api/chat/session` - Create session

### Documentation
- `GET /docs` - Swagger UI
- `GET /redoc` - ReDoc

---

## Database Schema

### Documents Table
- `id` (PK)
- `tenant_id` (FK, indexed)
- `source_type` (indexed)
- `content` (text)
- `embedding` (vector 768)
- `content_hash` (unique)
- `file_path`
- `created_at` (indexed)

### Chat Sessions/Messages
- Multi-turn conversation tracking
- Tenant isolation
- Message history

### Users & API Keys
- User management
- API key rotation
- Access control

---

## Configuration Management

All settings in `app/config.py`:
- Database URL
- Redis URL
- Embedding model
- LLM model
- Chunk sizes
- Cache TTL
- Security settings

Via environment variables in `.env`

---

## Monitoring & Observability

- Structured logging
- Request tracing
- Task status tracking
- Error reporting
- Performance metrics

---

## Security Features

- JWT authentication
- API key management
- Multi-tenancy isolation
- Input validation
- Password hashing
- Sensitive data redaction

---

## Next Steps

1. **Read**: INSTALLATION.md → GETTING_STARTED.md
2. **Install**: Run setup.sh or setup.bat
3. **Test**: Use provided examples
4. **Deploy**: Choose deployment method
5. **Monitor**: Set up logging/alerts
6. **Scale**: Add workers/replicas

---

## Files Summary

Total files created:
- Python backend: 20+ files
- Python SDK: 2 files
- Node SDK: 3 files
- React SDK: 3 files
- Configuration: 8 files
- Documentation: 4 files
- Total: ~40 files
