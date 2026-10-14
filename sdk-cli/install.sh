#!/usr/bin/env bash
# Brainbox server agent installer for Ubuntu / Debian (any Linux with systemd and python3).
#
#   curl -fsSL https://YOUR-BRAINBOX/sdk/downloads/install-server-agent.sh | sudo bash
#
# It asks for your secret key (or set BRAINBOX_SECRET_KEY), installs the agent to
# /opt/brainbox-cli, and turns on the "brainbox-cli" service so it starts on boot and
# restarts by itself. Run it again at any time to upgrade; settings are kept.
set -euo pipefail

API_URL="${BRAINBOX_API_URL:-https://port.smartpowerbilling.com}"
API_URL="${API_URL%/}"
BASE="${BRAINBOX_DOWNLOADS:-$API_URL/sdk/downloads}"
DIR=/opt/brainbox-cli
UNIT=/etc/systemd/system/brainbox-cli.service

if [ "$(id -u)" -ne 0 ]; then echo "Please run with sudo."; exit 1; fi
if ! command -v systemctl >/dev/null 2>&1; then echo "This installer needs systemd."; exit 1; fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "==> Installing python3"
  apt-get update -qq && apt-get install -y -qq python3
fi

echo "==> Downloading the agent"
mkdir -p "$DIR"
curl -fsSL "$BASE/brainbox_cli.py" -o "$DIR/brainbox_cli.py.new"
python3 -m py_compile "$DIR/brainbox_cli.py.new"
mv "$DIR/brainbox_cli.py.new" "$DIR/brainbox_cli.py"
chmod 755 "$DIR/brainbox_cli.py"

cat > /usr/local/bin/brainbox-cli <<'EOF'
#!/usr/bin/env bash
exec /usr/bin/env python3 /opt/brainbox-cli/brainbox_cli.py "$@"
EOF
chmod 755 /usr/local/bin/brainbox-cli

cat > "$UNIT" <<'EOF'
[Unit]
Description=Brainbox server agent (sends this server's logs to Brainbox)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/brainbox-cli
Environment=PYTHONUNBUFFERED=1
ExecStart=/usr/bin/python3 /opt/brainbox-cli/brainbox_cli.py daemon
Restart=always
RestartSec=10
Nice=10
CPUQuota=20%
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Settings: keep what is there (including a 1.0.0 install) unless a key is supplied.
HAVE_CONFIG=0
if [ -s /etc/brainbox-cli/config.json ]; then
  HAVE_CONFIG=1
elif [ -s /root/.brainbox-cli/config.json ]; then
  mkdir -p /etc/brainbox-cli
  cp /root/.brainbox-cli/config.json /etc/brainbox-cli/config.json
  chmod 600 /etc/brainbox-cli/config.json
  HAVE_CONFIG=1
  echo "==> Kept the settings from the earlier install"
fi

KEY="${BRAINBOX_SECRET_KEY:-}"
if [ -z "$KEY" ] && [ "$HAVE_CONFIG" = "0" ]; then
  if [ -r /dev/tty ]; then
    printf "Secret key (sk_live_..., typing is hidden): " > /dev/tty
    read -rs KEY < /dev/tty
    echo > /dev/tty
  fi
  if [ -z "$KEY" ]; then echo "No key given. Set BRAINBOX_SECRET_KEY and run again."; exit 1; fi
fi
if [ -n "$KEY" ]; then
  brainbox-cli init --api-url "$API_URL" --api-key "$KEY" ${BRAINBOX_AUDIENCE:+--audience "$BRAINBOX_AUDIENCE"} || {
    echo "!! Saved, but Brainbox could not be reached at $API_URL. The service will keep retrying."; }
fi

echo "==> Turning the service on (starts on boot, restarts by itself)"
systemctl daemon-reload
systemctl enable brainbox-cli >/dev/null 2>&1
systemctl restart brainbox-cli
sleep 2
systemctl --no-pager --lines=5 status brainbox-cli || true

cat <<EOF

Done. Brainbox server agent $(brainbox-cli --version) is running.
  What it reads:      brainbox-cli logs
  Add a log file:     sudo brainbox-cli add-log /path/to/build.log --name "Build log"
  Watch it work:      sudo journalctl -u brainbox-cli -f
  Stop / start:       sudo systemctl stop brainbox-cli   |   sudo systemctl start brainbox-cli
EOF
