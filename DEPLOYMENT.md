# Brainbox Platform - Deployment Guide

Complete guide for deploying Brainbox to customers.

---

## Overview

Brainbox consists of 5 SDKs that customers install to automatically collect server logs and query databases.

| SDK | Type | Installation | Purpose |
|-----|------|--------------|---------|
| Python SDK | Main | `pip install brainbox-sdk` | Python apps + function locator |
| Node.js SDK | Main | `npm install brainbox-sdk` | Node.js apps + function locator |
| React SDK | Main | `npm install brainbox-sdk` | React apps + function locator |
| CLI SDK | Service | `pip install brainbox-cli` | Auto-running log collection |
| Database SDK | Library | `pip install brainbox-db` | Safe database queries |

---

## Installation Methods

### 1. Python Package (PyPI) - Recommended

```bash
# Customer installs
pip install brainbox-sdk brainbox-cli brainbox-db

# Verify
python -c "from brainbox_sdk import BrainboxPythonSDK; print('✓ Installed')"
```

### 2. Linux System Package (.deb)

**You build and publish:**
```bash
cd sdk-cli
python -m build
# Creates: brainbox-cli-1.0.0.deb
```

**Customer installs:**
```bash
sudo apt install brainbox-cli-1.0.0.deb
sudo systemctl status brainbox-cli
```

**What happens automatically:**
- Service starts on boot
- Collects logs every 5 minutes
- Sends to your backend
- Auto-running (no manual intervention)

### 3. Linux System Package (.rpm)

```bash
# CentOS/RHEL customers
sudo rpm install brainbox-cli-1.0.0.rpm
sudo systemctl start brainbox-cli
```

### 4. Snap (Ubuntu)

```bash
# Ubuntu customers
snap install brainbox-cli
# Auto-starts

# Check
snap info brainbox-cli
snap logs brainbox-cli -f
```

### 5. Docker

```dockerfile
FROM python:3.9
RUN pip install brainbox-cli
ENV BRAINBOX_API_KEY=sk_xxx
ENV BRAINBOX_API_URL=https://api.brainbox.ai
CMD ["python", "-m", "brainbox_cli", "daemon"]
```

Customer runs:
```bash
docker run -d \
  -e BRAINBOX_API_KEY=sk_customer_abc \
  -e BRAINBOX_API_URL=https://your-server \
  brainbox-cli
```

---

## Auto-Running Background Service

### Linux (systemd) - Recommended

**Service file:** `/etc/systemd/system/brainbox-cli.service`

```ini
[Unit]
Description=Brainbox - Automatic Log Collection
After=network.target

[Service]
Type=simple
User=brainbox
ExecStart=/usr/bin/python3 -m brainbox_cli daemon
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

**Enable:**
```bash
sudo systemctl enable brainbox-cli
sudo systemctl start brainbox-cli

# Monitor
sudo systemctl status brainbox-cli
sudo journalctl -u brainbox-cli -f
```

### Windows (Task Scheduler)

```powershell
$action = New-ScheduledTaskAction -Execute "python.exe" `
  -Argument "-m brainbox_cli daemon"
$trigger = New-ScheduledTaskTrigger -AtStartup
Register-ScheduledTask -TaskName "BrainboxCLI" `
  -Action $action -Trigger $trigger -Principal "SYSTEM"

Start-ScheduledTask -TaskName "BrainboxCLI"
```

### macOS (LaunchAgent)

```bash
cat > ~/Library/LaunchAgents/ai.brainbox.cli.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" 
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>ai.brainbox.cli</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/python3</string>
    <string>-m</string>
    <string>brainbox_cli</string>
    <string>daemon</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
</dict>
</plist>
EOF

launchctl load ~/Library/LaunchAgents/ai.brainbox.cli.plist
```

---

## What Gets Collected

Every 5 minutes automatically collects:

```
Docker logs
  └─ Container output, errors, startup logs

System logs
  ├─ syslog
  ├─ auth.log
  ├─ kern.log
  └─ boot.log

PostgreSQL logs
  ├─ Connection logs
  ├─ Error logs
  └─ Query logs

Nginx logs
  ├─ Access logs
  └─ Error logs

SSL Info
  └─ Certificate details, expiry

Service Status
  ├─ nginx, postgresql, redis
  ├─ docker, mysql
  └─ systemctl status

System Resources
  ├─ CPU usage
  ├─ Memory usage
  └─ Disk usage
```

---

## Customer Setup Flow

### Step 1: Install
```bash
pip install brainbox-sdk brainbox-cli brainbox-db
```

### Step 2: Configure
```bash
brainbox-cli init \
  --api-key sk_customer_abc \
  --api-url https://api.brainbox.ai \
  --tenant-id acme-corp
```

### Step 3: Start Service
```bash
# Linux
sudo systemctl start brainbox-cli
sudo systemctl enable brainbox-cli

# macOS
launchctl load ~/Library/LaunchAgents/ai.brainbox.cli.plist

# Windows
Start-ScheduledTask -TaskName "BrainboxCLI"
```

### Step 4: Verify
```bash
# Check service
sudo systemctl status brainbox-cli

# View logs
sudo journalctl -u brainbox-cli -f

# Test collection
brainbox-cli collect --type docker
brainbox-cli ingest
```

---

## Troubleshooting

### Service Not Running
```bash
# Check status
sudo systemctl status brainbox-cli

# Restart
sudo systemctl restart brainbox-cli

# View errors
sudo journalctl -u brainbox-cli -n 50
```

### No Logs Collected
```bash
# Test manually
brainbox-cli health
brainbox-cli collect --type docker,system
brainbox-cli ingest

# Check config
cat ~/.brainbox-cli/config.json
```

### API Connection Failed
```bash
# Verify API key
echo $BRAINBOX_API_KEY

# Test connection
curl -H "Authorization: Bearer sk_xxx" \
  https://api.brainbox.ai/api/health
```

---

## CLI SDK - What Customers See

```
$ brainbox-cli init
Enter API URL: https://api.brainbox.ai
Enter API Key: sk_customer_abc
Enter Tenant ID: acme-corp
✓ Configuration saved to ~/.brainbox-cli/config.json

$ brainbox-cli health
✓ Backend is healthy

$ brainbox-cli collect --type docker,postgres
✓ Found 5 running containers
✓ Collected logs from container: web-app
✓ Collected logs from container: database
✓ Collected PostgreSQL logs
✓ Collected 2,451 log entries

$ brainbox-cli ingest
✓ Successfully ingested 2,451 logs
```

---

## Database Access Flow

When customer queries database:

```
Customer Python App
├─ from brainbox_db import DatabaseReader
├─ db = DatabaseReader(api_key, tenant_id, db_type, host, database, username)
└─ results = db.query("SELECT ...")
    ↓
Request sent to YOUR backend API (HTTPS encrypted)
    ├─ Validates API key
    ├─ Verifies tenant
    ├─ Checks query is read-only
    ├─ Enforces rate limiting
    └─ Logs query (audit trail)
    ↓
YOUR backend executes on customer's database
    ├─ PostgreSQL
    ├─ MySQL
    └─ SQLite
    ↓
Results returned and logged
    ↓
Customer receives data
```

**Security:**
- ✅ Only read-only queries allowed (blocks DELETE, DROP, ALTER)
- ✅ Every query logged
- ✅ Tenant isolated
- ✅ Rate limited
- ✅ HTTPS encrypted

---

## Quick Reference

### Install All SDKs
```bash
pip install brainbox-sdk brainbox-cli brainbox-db
npm install brainbox-sdk
```

### Configure & Start
```bash
brainbox-cli init --api-key sk_xxx --api-url https://api.brainbox.ai
sudo systemctl start brainbox-cli
sudo systemctl enable brainbox-cli
```

### Monitor
```bash
sudo systemctl status brainbox-cli
sudo journalctl -u brainbox-cli -f
```

### Use in Code (Python)
```python
from brainbox_sdk import BrainboxPythonSDK
from brainbox_db import DatabaseReader

sdk = BrainboxPythonSDK("https://api.brainbox.ai", "sk_key", "tenant")
sdk.chat("What's happening?")

db = DatabaseReader(..., db_type="postgres", ...)
results = db.query("SELECT ...")
```

### Use in Code (React)
```tsx
import { useBrainbox } from 'brainbox-sdk';

const { chat, findFunction } = useBrainbox(url, key, tenant);
const response = await chat("What's wrong?");
```

---

## Support

- **Docs:** https://docs.brainbox.ai
- **Status:** https://status.brainbox.ai  
- **Help:** support@brainbox.ai
