# Brainbox CLI SDK

Terminal SDK for collecting server logs, Docker logs, database logs, SSL logs, and system metrics. Automatically collects and ingests all server information to Brainbox AI backend.

## Installation

### From PyPI
```bash
pip install brainbox-cli
```

### From Source
```bash
git clone https://github.com/brainbox-ai/brainbox-sdk-cli.git
cd brainbox-sdk-cli
pip install -e .
```

## Quick Start

### Step 1: Initialize Configuration

```bash
brainbox-cli init \
  --api-url http://localhost:8000 \
  --api-key YOUR_API_KEY \
  --tenant-id company-1
```

This saves your configuration to `~/.brainbox-cli/config.json` (secure permissions).

### Step 2: Check Backend Health

```bash
brainbox-cli health
```

Output: `✓ Backend is healthy`

### Step 3: Collect Logs

```bash
# Collect all available logs
brainbox-cli collect --type docker,postgres,nginx,system,ssl,services,resources

# Or collect specific types
brainbox-cli collect --type docker,nginx
```

### Step 4: Ingest to Backend

```bash
# Send collected logs to backend
brainbox-cli ingest

# Or collect and send in one command
brainbox-cli collect --type docker,postgres && brainbox-cli ingest
```

## What Gets Collected

### Docker Logs (`--type docker`)
- Last 100 lines from each running container
- Container ID, name, and timestamps
- Error logs, startup logs, application logs

### System Logs (`--type system`)
- Syslog (`/var/log/syslog` or `/var/log/messages`)
- Auth logs (`/var/log/auth.log`)
- Kernel logs (`/var/log/kern.log`)
- Boot logs (`/var/log/boot.log`)

### PostgreSQL Logs (`--type postgres`)
- PostgreSQL error logs
- Query logs
- Connection logs
- By default from `/var/log/postgresql/`

**Custom path:**
```bash
brainbox-cli collect --type postgres --postgres-path /var/log/postgresql/
```

### Nginx Logs (`--type nginx`)
- Access logs
- Error logs
- By default from `/var/log/nginx/`

**Custom path:**
```bash
brainbox-cli collect --type nginx --nginx-path /var/log/nginx/
```

### SSL Certificates (`--type ssl`)
- SSL certificate information
- Certificate details (expiry, subject, etc.)
- Uses `openssl` for certificate inspection
- From `/etc/ssl/certs/` by default

### Service Status (`--type services`)
- Status of key services (nginx, postgresql, redis, docker, mysql)
- Systemctl output
- Service uptime and health

### System Resources (`--type resources`)
- CPU usage (via `top`)
- Memory usage (via `free`)
- Disk usage (via `df`)

## Usage Examples

### Collect Everything Daily

```bash
# Add to crontab
0 0 * * * brainbox-cli collect --type docker,postgres,nginx,system,ssl,services,resources && brainbox-cli ingest
```

### Collect Docker Logs Every Hour

```bash
# In crontab
0 * * * * brainbox-cli collect --type docker && brainbox-cli ingest
```

### Monitor Specific Service

```bash
# Check PostgreSQL logs
brainbox-cli collect --type postgres --postgres-path /custom/postgres/logs
```

### Export Logs to File

```bash
# Collect logs (they're stored in memory during collection)
brainbox-cli collect --type docker
# Then view what was collected before ingesting
brainbox-cli ingest
```

## Authentication

### Configuration File
Your API key is saved in `~/.brainbox-cli/config.json` with secure permissions (600).

### Environment Variables (Optional)
```bash
export BRAINBOX_API_URL=http://localhost:8000
export BRAINBOX_API_KEY=your-api-key
export BRAINBOX_TENANT_ID=company-1

brainbox-cli health
```

## Commands Reference

```bash
# Initialize configuration
brainbox-cli init --api-url <URL> --api-key <KEY> --tenant-id <TENANT>

# Check backend health
brainbox-cli health

# Collect logs (specify types)
brainbox-cli collect --type <types>

# Ingest collected logs
brainbox-cli ingest

# Help
brainbox-cli --help
```

## Log Types Summary

| Type | What's Collected | Required Tools |
|------|-----------------|-----------------|
| `docker` | Container logs | Docker CLI |
| `system` | System logs (syslog, auth, kernel, boot) | Standard Unix tools |
| `postgres` | PostgreSQL error logs | Access to log files |
| `nginx` | Nginx access/error logs | Access to log files |
| `ssl` | SSL certificate information | openssl |
| `services` | Service status | systemctl |
| `resources` | CPU, Memory, Disk | top, free, df |

## Requirements

### Minimum
- Python 3.8+
- `requests` library (auto-installed)

### For Full Functionality
- Docker (for Docker logs)
- `openssl` (for SSL log collection)
- Access to `/var/log/` directories
- `systemctl` (for service status)

### Permissions
May need `sudo` to access some log directories:
```bash
sudo brainbox-cli collect --type system,postgres,ssl
```

## Troubleshooting

### Error: "Backend unreachable"
```bash
# Check API URL and network
brainbox-cli health

# Verify API key
brainbox-cli init --api-url http://localhost:8000 --api-key your-key
```

### Error: "Permission denied" on log files
```bash
# Run with sudo
sudo brainbox-cli collect --type system,postgres
```

### Docker not found
```bash
# Install Docker or use other log types
brainbox-cli collect --type system,nginx
```

### No logs collected
```bash
# Check specific types
brainbox-cli collect --type docker --verbose
# Review what's available on your system
ls /var/log/
docker ps
```

## Security

- API keys are stored locally with secure permissions (600)
- Logs are transmitted over HTTPS
- No sensitive data is logged by default
- All log entries include timestamps and source tracking
- Audit logs available on backend

## Performance

- Collects last 200-500 lines from each log file (configurable)
- Batch processing of multiple log sources
- Rate-limited ingestion to backend
- Handles large log files efficiently

## Support

- Documentation: https://docs.brainbox.ai/cli
- Issues: https://github.com/brainbox-ai/brainbox-sdk-cli/issues
- Email: support@brainbox.ai

## License

MIT License
