#!/usr/bin/env bash
set -e

DEB_URL="${1:-https://downloads.brainbox.ai/brainbox-cli.deb}"
TMP_DEB="/tmp/brainbox-cli.deb"

echo "Downloading $DEB_URL"
curl -fsSL "$DEB_URL" -o "$TMP_DEB"

echo "Installing Brainbox CLI package"
sudo dpkg -i "$TMP_DEB"
sudo systemctl daemon-reload
sudo systemctl enable --now brainbox-cli

echo "Brainbox CLI installed and running"
sudo systemctl status brainbox-cli --no-pager
