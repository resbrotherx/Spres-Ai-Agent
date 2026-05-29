# Brainbox Platform - Deployment Guide

Complete guide for deploying Brainbox to customers.

---

## Overview

Brainbox consists of 5 SDKs that customers install to automatically collect server logs and query databases.

| SDK | Type | Installation | Purpose |
|-----|------|--------------|---------|
| Python SDK | Main | `pip install brainbox-sdk` | Python apps + function locator |
| Node.js SDK | Main | `npm install brainbox-sdk` | Node.js apps + function locator |
| React SDK | Main | `npm install brainbox-react-sdk` / `yarn add brainbox-react-sdk` | React apps + function locator |
| CLI SDK | Service | `pip install brainbox-cli` or `sudo apt install brainbox-cli-1.0.0.deb` | Auto-running Linux log collection |
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
chmod +x build-deb.sh
./build-deb.sh
# Creates: brainbox-cli-1.0.0.deb
```

**Or build RPM for CentOS/RHEL:**
```bash
cd sdk-cli
chmod +x build-rpm.sh
./build-rpm.sh
# Creates: brainbox-cli-1.0.0-1.x86_64.rpm
```

**Customer installs .deb:**
```bash
sudo apt install ./brainbox-cli-1.0.0.deb
sudo systemctl enable --now brainbox-cli
sudo systemctl status brainbox-cli
```

**Customer installs .rpm:**
```bash
sudo rpm -ivh brainbox-cli-1.0.0-1.x86_64.rpm
sudo systemctl enable --now brainbox-cli
sudo systemctl status brainbox-cli
```

**What happens automatically:**
- The service starts on boot
- The agent runs continuously every 60 seconds
- Collects Docker, Nginx, PostgreSQL, system, SSL and service status
- Sends data to your backend automatically
- Monitored services are restarted by the agent itself if they are down, during the next collection cycle

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
CMD ["brainbox-cli", "daemon", "--interval", "60"]
```

---

## React SDK Publishing

### Publish to npm
```bash
cd sdk-react
npm install
npm test
npm login
npm publish --access public
```

### Install with npm or Yarn
```bash
npm install brainbox-react-sdk
# or
yarn add brainbox-react-sdk
```

### Notes
- Yarn uses the npm registry by default, so publishing to npm makes the package available to Yarn users.
- If the package is not visible in Yarn's site, ensure the package has been published successfully to npm first.

## React UI deployment

`npm install brainbox-react-sdk` installs the React SDK library into a project. It does not automatically deploy a live UI to a server.

To make the React UI live:

1. Install the package in your React application.
2. Import `ChatWidget`, `ChatPanel`, or `useBrainboxChat`.
3. Build the application (`npm run build`, `yarn build`, etc.).
4. Deploy the built frontend to your hosting platform, static site host, or CDN.

The React SDK is client-side code and must be served as part of your own app.

## SDK runtime model

Not every SDK package is a running service. Most SDKs are libraries that are installed into apps:

- `sdk-react`: a React web library. Deploy the built frontend to a web host or CDN.
- `sdk-web`: a browser script library. Host the JS asset and include it in the page.
- `sdk-react-native`: a native mobile library. Install it in a React Native app and build/distribute that app.
- `sdk-python`: a Python client library. Import it into Python code or services as needed.
- `sdk-node`: a Node.js client library. Import it into Node apps or backend code.
- `sdk-database`: utility library or scripts for database integration.
- `sdk-cli`: a command-line tool. If you want it to run continuously for ingestion or monitoring, run it as a service; otherwise it can be used manually.

The only core service that must be deployed and running on a server is your Brainbox backend/API.

## What needs to be live

- Brainbox backend server (`brainBox/`): yes. This is the API service that handles chat, session, ingest, and health requests.
- React web app using `sdk-react`: yes, the built web app must be hosted.
- Web UI using `sdk-web`: yes, the page and JS asset must be served by a web host.
- React Native app using `sdk-react-native`: yes, the mobile app must be built and distributed to devices.
- Python/Node code using `sdk-python` or `sdk-node`: no separate service unless you build a server application with them.
- CLI tool (`sdk-cli`): optional service. Only if you want it running continuously for ingestion or monitoring.

## SDK deployment summary

| SDK | Type | Needs live hosting/app deployment? | Notes |
|---|---|---|---|
| `sdk-react` | React web UI library | Yes | Build and host the web frontend. |
| `sdk-web` | Browser JS widget | Yes | Host the JS asset and page. |
| `sdk-react-native` | React Native mobile library | Yes | Install into a mobile app and distribute the app. |
| `sdk-python` | Python client library | No* | Used in Python apps; deploy only if the app is a running service. |
| `sdk-node` | Node.js client library | No* | Used in Node apps; deploy only if the app runs as a service. |
| `sdk-database` | Database utility library | No* | Library only; deploy if the containing service runs. |
| `sdk-cli` | Command-line tool | Optional | Can be run manually or as a background service. |
| `brainBox/` backend | API service | Yes | Must be deployed and running for all SDKs. |

*Client libraries themselves do not require hosting unless used by a running service.

NPM/Yarn publish is only for distributing the package. It does not make an SDK automatically live by itself.

## Deployment examples

### Deploy the Brainbox backend

From `brainBox/`:

```bash
cd brainBox
docker compose up -d --build
```

Then confirm the service is running and reachable:

```bash
docker compose ps
curl https://your-server/api/health
```

### Deploy a React web app using `sdk-react`

In your React app project:

```bash
npm install brainbox-react-sdk
npm run build
```

Then deploy the generated build folder to your hosting provider, static host, or CDN.

Example hosts:

- Vercel / Netlify / Cloudflare Pages
- AWS S3 + CloudFront
- Azure Static Web Apps
- Any web server that can serve static files

### Deploy a plain HTML / Odoo page using `sdk-web`

Host `sdk-web/brainbox-web-sdk.js` as a static asset and include it in your page with a `<script>` tag.

For Odoo, add the script to the XML template or page HTML so the browser loads it when the page renders.

### Deploy a React Native app using `sdk-react-native`

In your React Native app project:

```bash
npm install brainbox-react-native-sdk
```

Then build and distribute the mobile app:

- Android: `npx react-native run-android`, or build an AAB/APK
- iOS: `npx react-native run-ios`, or build an IPA/TestFlight release

The mobile app contains the SDK as a library, but the app itself must be built and deployed.

### Run `sdk-cli` as a service (optional)

If you want the CLI to run continuously for ingestion or monitoring, run it as a background service:

```bash
cd sdk-cli
python brainbox_cli.py
```

Or use a system service manager to keep it alive.

## Plain web and Odoo support

For non-React apps and Odoo users, use the `sdk-web` package:

- `sdk-web/brainbox-web-sdk.js` — plain JS client for `/api/chat`, `/api/chat/session`, `/api/ingest`, `/api/health`
- `sdk-web/widget-example.html` — copy/paste chat widget for HTML/CSS/jQuery sites

This approach allows legacy HTML sites, Odoo templates, AngularJS, and other non-React frontends to embed the chat UI and call your backend endpoints directly.

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
Description=Brainbox CLI SDK Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/brainbox-cli
ExecStart=/usr/local/bin/brainbox-cli daemon --interval 60
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
