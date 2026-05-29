#!/usr/bin/env bash
set -e

PACKAGE_NAME=brainbox-cli
PACKAGE_VERSION=1.0.0
BUILD_DIR=build
TARGET_DIR=$BUILD_DIR/opt/$PACKAGE_NAME
BIN_DIR=$BUILD_DIR/usr/local/bin
SYSTEMD_DIR=$BUILD_DIR/etc/systemd/system
DEBIAN_DIR=$BUILD_DIR/DEBIAN

rm -rf "$BUILD_DIR"
mkdir -p "$TARGET_DIR" "$BIN_DIR" "$SYSTEMD_DIR" "$DEBIAN_DIR"

# Copy the package source to /opt/brainbox-cli
cp -r . "$TARGET_DIR"

# Create executable wrapper
cat > "$BIN_DIR/$PACKAGE_NAME" <<'EOF'
#!/usr/bin/env bash
python3 /opt/brainbox-cli/brainbox_cli.py "$@"
EOF
chmod +x "$BIN_DIR/$PACKAGE_NAME"

# Copy systemd service
cp brainbox-cli.service "$SYSTEMD_DIR/"
chmod 644 "$SYSTEMD_DIR/brainbox-cli.service"

# Debian control file
cat > "$DEBIAN_DIR/control" <<'EOF'
Package: $PACKAGE_NAME
Version: $PACKAGE_VERSION
Section: utils
Priority: optional
Architecture: all
Maintainer: Brainbox Team <support@brainbox.ai>
Depends: python3, python3-requests
Description: Brainbox CLI Linux log collection agent
 A lightweight Python daemon that collects logs, service status, and system metrics
 and sends them to the Brainbox backend.
EOF

# Build the .deb package
fakeroot dpkg-deb --build "$BUILD_DIR" "$PACKAGE_NAME-$PACKAGE_VERSION.deb"

echo "Built $PACKAGE_NAME-$PACKAGE_VERSION.deb"
