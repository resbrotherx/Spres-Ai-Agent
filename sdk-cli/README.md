# Brainbox server agent (`brainbox-cli`)

Reads a Linux server's logs and sends them to your Brainbox, so the AI can answer questions
about what is happening on the server. Runs as a systemd service that starts on boot and
restarts by itself. Standard library only: needs `python3` and nothing else.

## Install (Ubuntu / Debian)

```bash
curl -fsSL https://port.smartpowerbilling.com/sdk/downloads/install-server-agent.sh | sudo bash
```

It asks for a **secret key** (`sk_live_...`, from Staff dashboard > Settings > API keys), installs to
`/opt/brainbox-cli` and turns on the `brainbox-cli` service. Run it again to upgrade; settings are kept.

Unattended: `curl ... | sudo BRAINBOX_SECRET_KEY=sk_live_... bash`
(also `BRAINBOX_API_URL`, `BRAINBOX_AUDIENCE`).

## What it sends

- Every 5 minutes, **only the new lines** of each log (rotation is handled).
- Built in: Nginx access and error logs, system and login logs, Docker container logs,
  service status and a CPU / memory / disk snapshot. Optional: `postgres`, `ports`, `nginx_sites`, `ssl`.
- Status snapshots are sent only when they change, at most once an hour.
- Everything is labelled **admin** (admins only) unless you change it.
- Passwords, tokens, API keys and bearer tokens are masked before leaving the server.

## Commands

```bash
sudo brainbox-cli add-log /var/www/myapp/logs/build.log --name "Build log"
brainbox-cli logs                       # what is read, and the settings
sudo brainbox-cli remove-log /var/www/myapp/logs/build.log

sudo brainbox-cli collect               # show what would be sent, send nothing
sudo brainbox-cli run-once              # collect and send now
sudo brainbox-cli health

sudo brainbox-cli set --interval 300
sudo brainbox-cli set --collectors nginx,system,docker,services,resources
sudo brainbox-cli set --audience internal
sudo brainbox-cli set --restart-services on   # restart nginx/postgresql/redis/docker/mysql when down (off by default)
```

## Service

```bash
sudo systemctl status brainbox-cli
sudo journalctl -u brainbox-cli -f
sudo systemctl restart brainbox-cli
sudo systemctl stop brainbox-cli
```

Settings: `/etc/brainbox-cli/config.json` (root only). Read positions: `/var/lib/brainbox-cli/state.json`.

## Remove

```bash
sudo systemctl disable --now brainbox-cli
sudo rm -rf /etc/systemd/system/brainbox-cli.service /opt/brainbox-cli /usr/local/bin/brainbox-cli /etc/brainbox-cli /var/lib/brainbox-cli
sudo systemctl daemon-reload
```

## Changes in 1.1.0

- 1.0.0 sent data with no audience label, so it was readable by **public** chat. 1.1.0 labels it admin.
- 1.0.0 re-sent the last few hundred lines of every log every 60 seconds. 1.1.0 sends only new lines every 5 minutes.
- 1.0.0 restarted services it found down without asking. That is now opt-in.
- No `requests` dependency; one-line installer; secrets masked; `add-log` for your own files.
