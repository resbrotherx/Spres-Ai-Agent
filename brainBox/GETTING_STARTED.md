# GETTING_STARTED.md

## Complete Setup Guide for Brainbox Backend

### Prerequisites

- Docker Desktop (Mac/Windows) or Docker + Docker Compose (Linux)
- Python 3.11+
- At least 4GB RAM available
- Port 8000, 5432, 6379, 11434 available

### Step 1: Clone and Navigate

```bash
cd brainBox
```

### Step 2: Install Dependencies (Local Development)

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install Python packages
pip install -r requirements.txt
```

### Step 3: Configure Environment

```bash
# Copy .env template
cp .env.example .env  # or just use provided .env

# Edit .env if needed
nano .env
```

Key variables:
- `DATABASE_URL`: PostgreSQL connection
- `REDIS_URL`: Redis cache connection
- `OLLAMA_BASE_URL`: Local LLM endpoint
- `DEBUG`: Set to true for development

### Step 4: Start Services with Docker

```bash
# Start all services (PostgreSQL, Redis, Ollama)
docker-compose up -d

# Wait for services to be ready (30-60 seconds)
docker-compose logs -f

# Check individual services
docker-compose ps
```

Services:
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- Ollama: `localhost:11434`
- FastAPI: `localhost:8000`

### Step 5: Initialize Database

```bash
# Create tables and schemas
python3 -c "from app.db.session import init_db; init_db()"
```

### Step 6: Start FastAPI Server

```bash
# Terminal 1: Start API server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Step 7: Start Celery Worker (Optional but Recommended)

```bash
# Terminal 2: Start Celery worker for background tasks
celery -A app.celery_app.celery worker --loglevel=info
```

### Step 8: Verify Installation

```bash
# Test health endpoint
curl http://localhost:8000/api/health

# Should return:
# {"status":"healthy","service":"brainbox","version":"1.0.0"}
```

### Step 9: Access API Documentation

Open in browser:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Quick Test

### 1. Pull Ollama Model

```bash
# In Ollama container or on host with Ollama
ollama pull llama2
# or for lighter model:
ollama pull mistral
```

### 2. Ingest Sample Data

```bash
curl -X POST http://localhost:8000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "demo-company",
    "source_type": "logs",
    "file_path": "/var/log/app.log",
    "content": "2024-01-15 10:30:45 ERROR: Database connection timeout after 30s\n2024-01-15 10:31:00 ERROR: Retrying connection\n2024-01-15 10:31:15 INFO: Connection restored"
  }'
```

Response:
```json
{
  "status": "queued",
  "task_id": "abc123...",
  "message": "Ingestion task queued for processing"
}
```

### 3. Chat with AI

```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "demo-company",
    "question": "Why did the database timeout?"
  }'
```

Response:
```json
{
  "response": "Based on the logs, the database had a connection timeout after 30 seconds on 2024-01-15 at 10:30:45. This suggests either a network issue or database server overload. The system successfully retried and restored the connection at 10:31:15.",
  "search_results": [...],
  "reasoning": "Used semantic search and Ollama LLM for response"
}
```

## Troubleshooting

### PostgreSQL Won't Connect

```bash
# Check if container is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Restart
docker-compose restart postgres
```

### Redis Connection Error

```bash
# Test Redis
redis-cli ping

# Or in container
docker exec brainbox-redis redis-cli ping
```

### Ollama Model Not Found

```bash
# List available models
ollama list

# Pull a model
ollama pull llama2
```

### Port Already in Use

```bash
# Find process using port 8000
lsof -i :8000

# Or change port in docker-compose.yml or .env
```

### Database Tables Not Created

```bash
# Manually run schema
docker exec brainbox-postgres psql -U postgres -d restai < schema.sql

# Or from Python
python3 -c "from app.db.session import init_db; init_db()"
```

## Development Workflow

### File Structure
```
brainBox/
├── app/
│   ├── main.py           # FastAPI entry point
│   ├── config.py         # Configuration
│   ├── api/              # Route handlers
│   ├── agents/           # LangGraph agents
│   ├── ingestion/        # Data pipeline
│   ├── db/               # Database models
│   ├── embeddings/       # Embedding generation
│   ├── llm/              # LLM clients
│   └── ...
├── tests/                # Unit tests
├── requirements.txt      # Python dependencies
├── docker-compose.yml    # Services
├── .env                  # Environment variables
└── README.md             # Documentation
```

### Adding New Endpoints

1. Create route file in `app/api/`
2. Define schemas in `app/schemas/`
3. Add router to `app/main.py`
4. Write tests in `tests/`

### Database Migrations

Using Alembic (optional):

```bash
# Initialize (one-time)
alembic init alembic

# Create migration
alembic revision --autogenerate -m "Add new column"

# Apply migration
alembic upgrade head
```

### Running Tests

```bash
# Install test dependencies
pip install pytest pytest-cov

# Run tests
pytest

# With coverage
pytest --cov=app
```

## Production Deployment

### Using Docker

```bash
# Build image
docker build -t brainbox:1.0.0 .

# Run container
docker run -p 8000:8000 \
  -e DATABASE_URL=postgresql://user:pass@postgres:5432/restai \
  -e REDIS_URL=redis://redis:6379/0 \
  brainbox:1.0.0
```

### Using Kubernetes

Create manifests in `k8s/` and deploy:

```bash
kubectl apply -f k8s/
```

### Environment Variables for Production

```bash
DEBUG=false
LOG_LEVEL=INFO
JWT_SECRET_KEY=<very-long-random-string>
OPENAI_API_KEY=<if using OpenAI>
DATABASE_URL=<production-db-url>
REDIS_URL=<production-redis-url>
```

## Next Steps

1. **Add Authentication**: Implement JWT tokens and API keys
2. **Deploy**: Use Docker/Kubernetes to deploy
3. **Monitor**: Set up logging, metrics, alerting
4. **Scale**: Add more Celery workers
5. **Optimize**: Add caching, indexing, replication

## Support

- Check logs: `docker-compose logs <service>`
- Read docs: http://localhost:8000/docs
- Check config: `app/config.py`
