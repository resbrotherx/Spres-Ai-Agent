#!/usr/bin/env bash
set -e

PACKAGE_NAME=brainbox-cli
PACKAGE_VERSION=1.0.0
BUILD_ROOT=build_rpm
DESTDIR=$BUILD_ROOT/root
BIN_DIR=$DESTDIR/usr/local/bin
SERVICE_DIR=$DESTDIR/etc/systemd/system

rm -rf "$BUILD_ROOT"
mkdir -p "$BIN_DIR" "$SERVICE_DIR"

cat > "$BIN_DIR/$PACKAGE_NAME" <<'EOF'
#!/usr/bin/env bash
python3 /opt/brainbox-cli/brainbox_cli.py "$@"
EOF
chmod +x "$BIN_DIR/$PACKAGE_NAME"

# Copy service definition
cp brainbox-cli.service "$SERVICE_DIR/"
chmod 644 "$SERVICE_DIR/brainbox-cli.service"

# Copy full package source to /opt/brainbox-cli
mkdir -p "$DESTDIR/opt/brainbox-cli"
cp -r . "$DESTDIR/opt/brainbox-cli"

if command -v fpm >/dev/null 2>&1; then
  fpm -s dir -t rpm \
    -n "$PACKAGE_NAME" \
    -v "$PACKAGE_VERSION" \
    --prefix / \
    --description "Brainbox CLI Linux log collection agent" \
    --url https://github.com/brainbox-ai/brainbox-sdk-cli \
    --license MIT \
    --vendor "Brainbox Team" \
    --depends python3 \
    --depends python3-requests \
    --rpm-os linux \
    -C "$DESTDIR" \
    usr/local/bin/$PACKAGE_NAME \
    etc/systemd/system/brainbox-cli.service \
    opt/brainbox-cli
  echo "Created ${PACKAGE_NAME}-${PACKAGE_VERSION}-1.x86_64.rpm"
else
  echo "Error: fpm is required to build RPM packages. Install it with 'gem install fpm' or use your distro's packaging tools."
  exit 1
fi
