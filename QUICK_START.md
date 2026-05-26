# QUICK_START.md

## 🚀 Brainbox Backend - Quick Start (5 minutes)

### Prerequisites
- Docker & Docker Compose installed
- Python 3.11+
- ~4GB RAM free

### Step 1: Start All Services

```bash
cd brainBox
docker-compose up -d
```

Wait 30 seconds for services to start.

### Step 2: Create Virtual Environment & Install

```bash
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Step 3: Initialize Database

```bash
python -c "from app.db.session import init_db; init_db()"
```

### Step 4: Start API Server

```bash
uvicorn app.main:app --reload
```

Open browser: **http://localhost:8000/docs**

### Step 5: Test It

**Ingest Data:**
```bash
curl -X POST http://localhost:8000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "demo",
    "source_type": "logs",
    "content": "ERROR: Database failed"
  }'
```

**Chat:**
```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "demo",
    "question": "What happened?"
  }'
```

## 📚 Full Documentation

- **INSTALLATION.md** - Detailed setup guide
- **GETTING_STARTED.md** - Usage and examples
- **README.md** - Architecture and features
- **API Docs** - http://localhost:8000/docs

## 🔧 Common Commands

```bash
# Check services
docker-compose ps

# View logs
docker-compose logs -f

# Restart services
docker-compose restart

# Stop all
docker-compose down

# Start Celery (optional, for background jobs)
celery -A app.celery_app.celery worker --loglevel=info

# Run tests
pytest tests/
```

## 📦 SDK Usage

### Python
```python
from sdk_python.brainbox_sdk import BrainboxPythonSDK

sdk = BrainboxPythonSDK('http://localhost:8000', 'api-key', 'tenant-id')
result = sdk.ingest('logs', 'content')
response = sdk.chat('question')
```

### Node
```javascript
const BrainboxSDK = require('../sdk-node/brainbox-sdk');
const sdk = new BrainboxSDK('http://localhost:8000', 'api-key', 'tenant-id');
const result = await sdk.ingest('logs', 'content');
```

### React
```tsx
import { useBrainbox } from '../sdk-react/brainbox-sdk';
const { chat, ingest } = useBrainbox(url, apiKey, tenantId);
```

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Port 8000 in use | `lsof -i :8000` and kill process or use different port |
| DB connection error | `docker-compose restart postgres` |
| Services won't start | Check RAM, ports, and `docker-compose logs` |
| No models in Ollama | Run `ollama pull llama2` |

## ✅ You're Done!

Your Brainbox AI backend is ready. Start building! 🎉
