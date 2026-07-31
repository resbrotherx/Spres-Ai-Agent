#!/usr/bin/env bash
set -e

DEB_URL="${1:-https://github.com/YOUR_USERNAME/brainbox-sdk-cli/releases/download/v1.0.0/brainbox-cli-1.0.0.deb}"
TMP_DEB="/tmp/brainbox-cli.deb"
API_URL="https://port.smartpowerbilling.com"

echo "Downloading Brainbox CLI..."
curl -fsSL "$DEB_URL" -o "$TMP_DEB"

echo "Installing Brainbox CLI package..."
sudo dpkg -i "$TMP_DEB"
sudo apt --fix-broken install -y

echo "Setting up isolated Python environment..."
sudo /usr/bin/python3 -m venv /opt/brainbox-cli/venv
sudo /opt/brainbox-cli/venv/bin/pip install --upgrade pip -q
sudo /opt/brainbox-cli/venv/bin/pip install requests -q

sudo systemctl daemon-reload

echo ""
echo "=== Brainbox CLI Setup ==="
#read -rp "Backend API URL (e.g. https://port.smartpowerbilling.com): " API_URL
read -rp "Your API Key: " API_KEY
read -rp "Your Tenant ID: " TENANT_ID

sudo brainbox-cli init --api-url "$API_URL" --api-key "$API_KEY" --tenant-id "$TENANT_ID"

sudo systemctl enable --now brainbox-cli
sudo systemctl restart brainbox-cli

echo ""
echo "✓ Brainbox CLI installed, configured, and running"
sudo systemctl status brainbox-cli --no-pager