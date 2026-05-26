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

## API Endpoints

### Health Checks
- `GET /api/health` - Service health
- `GET /api/health/db` - Database connection
- `GET /api/health/cache` - Redis connection

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/api-key` - Generate API key

### Ingestion
- `POST /api/ingest` - Queue data for ingestion
- `GET /api/ingest/status/{task_id}` - Check ingestion status

### Chat
- `POST /api/chat` - Send chat question
- `POST /api/chat/session` - Create chat session

## Usage Examples

### Ingest Data

```bash
curl -X POST http://localhost:8000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "company-1",
    "source_type": "logs",
    "file_path": "/var/log/app.log",
    "content": "2024-01-15 ERROR: Database connection failed"
  }'
```

### Chat API

```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "company-1",
    "question": "Why is the database failing?"
  }'
```

## SDK Integration

All SDKs post to `/api/ingest`:

```json
{
  "tenant_id": "string",
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
- **ChatSession**: Chat session management
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

1. Add API authentication
2. Implement rate limiting
3. Add monitoring dashboards
4. Configure S3 backup
5. Set up Kubernetes deployment
6. Add tool approval workflow

## License

MIT
