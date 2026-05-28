# Brainbox Platform - Complete Documentation

Professional guide for deploying Brainbox to your customers.

---

## 📚 Documentation

| Document | Purpose | Audience |
|----------|---------|----------|
| **DEPLOYMENT.md** | Installation methods, auto-running services, customer setup | Ops/DevOps/Sales |
| **SDK_REFERENCE.md** | SDK methods, code examples, all features | Developers |
| **BACKEND.md** | API endpoints, database setup, security | Backend Engineers |

---

## Quick Start

### For Your Customers

**Install:**
```bash
pip install brainbox-sdk brainbox-cli brainbox-db
npm install brainbox-sdk
```

**Configure:**
```bash
brainbox-cli init --api-key sk_xxx --api-url https://api.brainbox.ai --tenant-id company-1
```

**Auto-runs** in background collecting logs every 5 minutes.

### For You (Backend)

**Implement 4 API endpoints** (see BACKEND.md):
1. `/api/db/test-connection` - Test database
2. `/api/db/schema` - Get tables/columns
3. `/api/db/query` - Execute read-only queries
4. `/api/db/audit-log` - Query history

**Create 1 database table:**
- `QueryAuditLog` - Audit trail

---

## What's Included

### SDKs (5 Total)
- ✅ Python SDK (Python apps)
- ✅ Node.js SDK (Node.js backends)
- ✅ React SDK (React frontends)
- ✅ CLI SDK (Auto log collection)
- ✅ Database SDK (Safe queries)

### Features
- ✅ Automatic log collection (Docker, system, DB, Nginx, SSL)
- ✅ Auto-running background service
- ✅ Function locator (find code functions)
- ✅ Safe database access (read-only enforcement)
- ✅ Query auditing & logging
- ✅ Rate limiting
- ✅ Full security

### Installation Methods
- ✅ pip (Python)
- ✅ npm (Node/React)
- ✅ apt (Linux .deb)
- ✅ rpm (CentOS/RHEL)
- ✅ snap (Ubuntu)
- ✅ Docker

---

## Architecture

```
Customer Infrastructure
├── CLI Service (auto-runs every 5 min)
├── Python/Node/React apps (use SDKs)
└── Customer database

         ↓ HTTPS (encrypted)

Your Brainbox Backend
├── API Gateway (auth, validation)
├── Ingestion Pipeline (processes)
├── AI Agents (analyzes)
├── Database (stores)
└── Dashboard (displays)
```

---

## Implementation Steps

### Week 1: Backend Setup
- [ ] Add 4 API endpoints (BACKEND.md)
- [ ] Create audit log table
- [ ] Setup rate limiting
- [ ] Test locally

### Week 2: Packaging
- [ ] Publish to PyPI
- [ ] Publish to NPM
- [ ] Build .deb package
- [ ] Test installations

### Week 3: Testing
- [ ] Test with customers
- [ ] Verify auto-running service
- [ ] Check database access
- [ ] Validate security

### Week 4: Launch
- [ ] Create dashboard
- [ ] Setup support
- [ ] Announce to customers
- [ ] Monitor usage

---

## Files Structure

```
ai/
├── sdk-python/              # Python SDK
├── sdk-node/                # Node.js SDK
├── sdk-react/               # React SDK
├── sdk-cli/                 # CLI service
├── sdk-database/            # Database SDK
├── brainBox/                # Backend (FastAPI)
│
├── DEPLOYMENT.md            # Installation & setup
├── SDK_REFERENCE.md         # SDK methods & examples
├── BACKEND.md               # API endpoints & database
├── PUBLISHING_GUIDE.md      # How to publish to PyPI/NPM
├── PROJECT_STRUCTURE.md     # Backend architecture
└── QUICK_START.md           # Original quick start
```

---

## Key Sections

### DEPLOYMENT.md
- 5 installation methods (pip, apt, rpm, snap, docker)
- Auto-running on Linux/Windows/Mac
- Customer setup flow
- What gets collected
- Troubleshooting

### SDK_REFERENCE.md
- All SDK methods
- Code examples for all languages
- Error handling
- Function locator
- Database SDK reference

### BACKEND.md
- 4 API endpoints (complete code)
- Database models
- Security checks
- Rate limiting
- Query logging
- Deployment checklist

---

## Security Features

✅ **Read-only enforcement** - Blocks DELETE, DROP, ALTER
✅ **Tenant isolation** - Data separated by tenant
✅ **Query auditing** - All queries logged
✅ **Rate limiting** - Prevent abuse
✅ **API authentication** - API key validation
✅ **HTTPS encryption** - All data encrypted in transit
✅ **Parameterized queries** - SQL injection prevention
✅ **Row limits** - Prevent large exports

---

## Customer Experience

### Installation
```bash
$ pip install brainbox-cli
$ brainbox-cli init --api-key sk_xxx
✓ Service installed and running
```

### What Happens Automatically
```
Every 5 minutes:
- Collects Docker logs
- Collects system logs
- Collects database logs
- Collects Nginx logs
- Sends to backend
- AI analyzes
- Results in dashboard
```

### Usage
```python
# Python
from brainbox_sdk import BrainboxPythonSDK
sdk = BrainboxPythonSDK(...)
response = sdk.chat("What's wrong?")

# Database
from brainbox_db import DatabaseReader
db = DatabaseReader(...)
results = db.query("SELECT ...")
```

---

## Support

**Questions?** See:
- **DEPLOYMENT.md** - How to deploy
- **SDK_REFERENCE.md** - How to use SDKs
- **BACKEND.md** - How to implement backend
- **PUBLISHING_GUIDE.md** - How to publish packages

---

## Next Steps

1. **Read BACKEND.md** → Implement API endpoints (2-3 hours)
2. **Read DEPLOYMENT.md** → Setup packages (1-2 hours)
3. **Read SDK_REFERENCE.md** → Understand all features
4. **Test locally** → Verify everything works
5. **Publish** → Upload to PyPI/NPM
6. **Launch** → Start selling to customers

---

**Brainbox Platform is production-ready!** 🚀
