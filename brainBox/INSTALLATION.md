# INSTALLATION.md

## Complete Installation Guide

This guide covers installing and running the entire Brainbox AI backend stack.

## Prerequisites

### Minimum Requirements
- Python 3.11+
- Docker & Docker Compose
- 4GB RAM
- 10GB disk space
- Git (optional)

### Recommended
- 8GB+ RAM
- 50GB disk space (for embeddings and database)
- Linux/macOS or Windows 10+ with WSL2

## Installation Steps

### 1. Clone Repository or Create Project

```bash
cd ~/projects
git clone <repository-url> brainbox  # or
mkdir brainbox && cd brainbox
```

### 2. Set Up Python Environment

```bash
# Create virtual environment
python3 -m venv venv

# Activate (macOS/Linux)
source venv/bin/activate

# Activate (Windows)
venv\Scripts\activate

# Upgrade pip
pip install --upgrade pip setuptools wheel
```

### 3. Install Python Dependencies

```bash
pip install -r requirements.txt
```

This installs:
- FastAPI & Uvicorn (web framework)
- PostgreSQL & pgvector (database)
- Redis (cache/queue)
- Celery (background jobs)
- Sentence Transformers (embeddings)
- LangGraph & LlamaIndex (AI agents)
- And more...

### 4. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit configuration (optional)
# nano .env  (macOS/Linux)
# notepad .env  (Windows)
```

Key variables:
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection
- `OLLAMA_BASE_URL`: Local LLM endpoint
- `DEBUG`: Set to false for production

### 5. Start Docker Services

```bash
# Start all services
docker-compose up -d

# Wait for startup (30-60 seconds)
sleep 60

# Verify services are running
docker-compose ps

# Check logs
docker-compose logs -f
```

Services will be available at:
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- Ollama: `localhost:11434` (pull models: `ollama pull llama2`)

### 6. Initialize Database

```bash
# Create tables and schemas
python3 -c "from app.db.session import init_db; init_db()"

# Verify (optional)
docker exec brainbox-postgres psql -U postgres -d restai -c "\dt"
```

### 7. Start FastAPI Server

**Terminal 1:**
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Expected output:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 8. Start Celery Worker (Optional but Recommended)

**Terminal 2:**
```bash
celery -A app.celery_app.celery worker --loglevel=info
```

### 9. Verify Installation

```bash
# Health check
curl http://localhost:8000/api/health

# Expected response:
# {"status":"healthy","service":"brainbox","version":"1.0.0"}

# API documentation
# Browser: http://localhost:8000/docs
```

## Quick Test

### Test 1: Ingest Data

```bash
curl -X POST http://localhost:8000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "test-company",
    "source_type": "logs",
    "content": "ERROR: Connection timeout",
    "file_path": "/var/log/app.log"
  }'
```

### Test 2: Chat

```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "test-company",
    "question": "What error occurred?"
  }'
```

## SDK Installation

### Python SDK
```bash
cd ../sdk-python
# Copy brainbox_sdk.py to your project
pip install requests
```

### Node SDK
```bash
cd ../sdk-node
npm install
# Add brainbox-sdk.js to your project
```

### React SDK
```bash
cd ../sdk-react
npm install
npm install --save-dev typescript
# Add brainbox-sdk.ts to your React project
```

## Common Issues

### Port Already in Use
```bash
# Find process using port 8000
lsof -i :8000

# Kill process
kill -9 <PID>

# Or use different port
uvicorn app.main:app --port 8001
```

### PostgreSQL Connection Error
```bash
# Check if container is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Restart
docker-compose restart postgres

# Wait for startup
docker-compose logs -f postgres
```

### Ollama Models Not Available
```bash
# Pull model
ollama pull llama2

# List available
ollama list

# Or use lighter model
ollama pull mistral
```

### Database Already Exists
```bash
# Drop and recreate
docker-compose down -v postgres

# Then restart
docker-compose up -d postgres
```

### Permission Denied (macOS/Linux)
```bash
# Make scripts executable
chmod +x setup.sh

# Run setup
./setup.sh
```

## File Structure After Installation

```
brainBox/
├── app/
│   ├── main.py
│   ├── config.py
│   ├── api/
│   ├── agents/
│   ├── db/
│   ├── embeddings/
│   ├── llm/
│   └── ...
├── tests/
├── migrations/
├── .env
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
├── README.md
├── GETTING_STARTED.md
├── INSTALLATION.md
└── ...

../sdk-python/
├── brainbox_sdk.py
└── README.md

../sdk-node/
├── brainbox-sdk.js
└── package.json

../sdk-react/
├── brainbox-sdk.ts
└── package.json
```

## Verification Checklist

- [ ] Python 3.11+ installed
- [ ] Docker & Docker Compose running
- [ ] Virtual environment activated
- [ ] Dependencies installed with pip
- [ ] .env configured
- [ ] Docker services started
- [ ] Database initialized
- [ ] FastAPI server running
- [ ] Health check passes
- [ ] API docs accessible at /docs

## Next Steps

1. **Read GETTING_STARTED.md** for detailed usage
2. **Deploy**: Use docker-compose.yml or Kubernetes
3. **Test**: Use provided examples and test suite
4. **Integrate**: Connect SDKs to your applications
5. **Monitor**: Set up logging and metrics

## Support

- **Docs**: http://localhost:8000/docs
- **Logs**: `docker-compose logs`
- **Tests**: `pytest tests/`
- **README**: See main README.md

## Uninstall

```bash
# Remove containers and volumes
docker-compose down -v

# Remove virtual environment
rm -rf venv

# Remove .env
rm .env
```
