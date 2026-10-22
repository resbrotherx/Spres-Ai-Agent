#!/usr/bin/env bash
# Brainbox production deploy — run ON THE SERVER (GitHub Actions calls it over SSH).
#   bash /var/www/Spres-Ai-Agent/deploy/deploy.sh
# What it does:
#   1. fast-forwards the checkout to origin/main (never discards local commits — fails instead)
#   2. rebuilds the API image only when requirements.txt / Dockerfile changed
#   3. recreates ONLY the brainbox-api container (postgres / redis / ollama are left running)
#   4. waits for /api/health and prints the API logs if it doesn't come up
#   5. makes sure the staff dashboard container (brainbox-staff, port $STAFF_PORT, default 2029) is up
# The web SDK is served by nginx straight from sdk-web/, so step 1 publishes it.
set -euo pipefail

REPO_DIR="${REPO_DIR:-/var/www/Spres-Ai-Agent}"
BRANCH="${BRANCH:-main}"
API_DIR="$REPO_DIR/brainBox"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:8000/api/health}"
LOCK=/tmp/brainbox-deploy.lock
STAFF_PORT="${STAFF_PORT:-2029}"

# Customer portal (Sterling-Tech/customer-portal, master): pulled, built and run in its own container
# on $PORTAL_PORT. Rebuilt only when master moves. Never fails the deploy.
PORTAL_REPO="${PORTAL_REPO:-https://github.com/Sterling-Tech/customer-portal.git}"
PORTAL_BRANCH="${PORTAL_BRANCH:-master}"
PORTAL_DIR="${PORTAL_DIR:-/var/www/customer-portal}"
PORTAL_PORT="${PORTAL_PORT:-5050}"
PORTAL_ENV=/etc/customer-portal.env
ensure_portal() {
  if [ ! -d "$PORTAL_DIR/.git" ]; then
    echo "==> Cloning customer portal ($PORTAL_BRANCH)"
    git clone -q -b "$PORTAL_BRANCH" "$PORTAL_REPO" "$PORTAL_DIR"
  fi
  cd "$PORTAL_DIR"
  git fetch -q origin "$PORTAL_BRANCH"
  git checkout -q -B "$PORTAL_BRANCH" "origin/$PORTAL_BRANCH"
  local rev; rev=$(git rev-parse --short HEAD)
  if ! docker ps -a --format '{{.Names}}' | grep -qx customer-portal; then
    if ss -ltnH "sport = :$PORTAL_PORT" 2>/dev/null | grep -q .; then
      echo "!! Port $PORTAL_PORT is already used by another program; customer portal not started"
      return 0
    fi
  fi
  if [ ! -s "$PORTAL_ENV" ]; then
    local ip; ip=$(curl -fsS -m 5 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
    umask 077
    printf 'NEXTAUTH_SECRET=%s\nNEXTAUTH_URL=http://%s:%s\nNEXT_PUBLIC_API_URL=%s\n' \
      "$(openssl rand -hex 32)" "$ip" "$PORTAL_PORT" "${PORTAL_API_URL:-http://188.166.161.13:8065}" > "$PORTAL_ENV"
  fi
  local api; api=$(grep '^NEXT_PUBLIC_API_URL=' "$PORTAL_ENV" | cut -d= -f2-)
  local running; running=$(docker inspect -f '{{index .Config.Labels "portal.rev"}}' customer-portal 2>/dev/null || true)
  if [ "$running" != "$rev" ] || [ "${FORCE_PORTAL:-0}" = "1" ]; then
    echo "==> Building customer portal $rev (this takes a few minutes)"
    docker build -q -t "customer-portal:$rev" --label "portal.rev=$rev" --build-arg NEXT_PUBLIC_API_URL="$api" \
      -f "$REPO_DIR/deploy/customer-portal.Dockerfile" "$PORTAL_DIR" >/dev/null \
      || { echo "!! Customer portal build failed; the running version (if any) is left as it is"; return 0; }
    docker rm -f customer-portal >/dev/null 2>&1 || true
    docker run -d --name customer-portal --restart unless-stopped --label "portal.rev=$rev" \
      -p "$PORTAL_PORT:3000" --env-file "$PORTAL_ENV" "customer-portal:$rev" >/dev/null
  fi
  for i in $(seq 1 30); do
    if curl -fsS -o /dev/null "http://127.0.0.1:$PORTAL_PORT/login"; then
      echo "Customer portal $rev is up on port $PORTAL_PORT"
      return 0
    fi
    sleep 2
  done
  echo "!! Customer portal did not answer on port $PORTAL_PORT; last logs:"
  docker logs --tail 30 customer-portal 2>&1 || true
}

# Staff dashboard: its own small nginx container on $STAFF_PORT. Never fails the deploy.
ensure_staff() {
  cd "$API_DIR"
  if ! docker ps --format '{{.Names}}' | grep -qx brainbox-staff; then
    if ss -ltnH "sport = :$STAFF_PORT" 2>/dev/null | grep -q .; then
      echo "!! Port $STAFF_PORT is already used by another program; staff dashboard not started"
      ss -ltnp "sport = :$STAFF_PORT" 2>/dev/null || true
      return 0
    fi
  fi
  echo "==> Staff dashboard (port $STAFF_PORT)"
  STAFF_PORT="$STAFF_PORT" docker compose up -d --no-deps staff
  docker exec brainbox-staff nginx -t >/dev/null 2>&1 && docker exec brainbox-staff nginx -s reload >/dev/null 2>&1 || true
  for i in $(seq 1 10); do
    if curl -fsS -o /dev/null "http://127.0.0.1:$STAFF_PORT/"; then
      echo "Staff dashboard is up on port $STAFF_PORT"
      return 0
    fi
    sleep 2
  done
  echo "!! Staff dashboard did not answer on port $STAFF_PORT; last logs:"
  docker logs --tail 30 brainbox-staff 2>&1 || true
}

exec 9>"$LOCK"
flock -n 9 || { echo "Another deploy is running"; exit 1; }

cd "$REPO_DIR"
echo "==> Fetching $BRANCH"
git fetch --quiet origin "$BRANCH"
OLD=$(git rev-parse HEAD)
NEW=$(git rev-parse "origin/$BRANCH")
if [ "$OLD" = "$NEW" ] && [ "${FORCE:-0}" != "1" ]; then
  echo "Already at $NEW — nothing to deploy"
  ensure_staff || echo "!! staff dashboard step failed"
  ensure_portal || echo "!! customer portal step failed"
  exit 0
fi
git merge --ff-only "origin/$BRANCH"
echo "==> $OLD -> $NEW"

cd "$API_DIR"
REBUILD=0
if [ "${FORCE_BUILD:-0}" = "1" ] || git diff --name-only "$OLD" "$NEW" -- requirements.txt Dockerfile .dockerignore | grep -q .; then
  REBUILD=1
fi

if [ "$REBUILD" = "1" ]; then
  echo "==> Dependencies changed — rebuilding API image"
  docker compose build api
fi

if git diff --name-only "$OLD" "$NEW" -- docker-compose.yml | grep -q . || [ "$REBUILD" = "1" ]; then
  echo "==> Recreating brainbox-api"
  docker compose up -d --no-deps api
else
  echo "==> Restarting brainbox-api"
  docker restart brainbox-api >/dev/null
fi

echo "==> Waiting for health"
for i in $(seq 1 60); do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    echo "Healthy after ${i}x2s: $(curl -fsS "$HEALTH_URL")"
    ensure_staff || echo "!! staff dashboard step failed"
    ensure_portal || echo "!! customer portal step failed"
    exit 0
  fi
  sleep 2
done
echo "!! API did not become healthy — last logs:"
docker logs --tail 80 brainbox-api
exit 1
