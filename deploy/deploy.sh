#!/usr/bin/env bash
# Brainbox production deploy — run ON THE SERVER (GitHub Actions calls it over SSH).
#   bash /var/www/Spres-Ai-Agent/deploy/deploy.sh
# What it does:
#   1. fast-forwards the checkout to origin/main (never discards local commits — fails instead)
#   2. rebuilds the API image only when requirements.txt / Dockerfile changed
#   3. recreates ONLY the brainbox-api container (postgres / redis / ollama are left running)
#   4. waits for /api/health and prints the API logs if it doesn't come up
# The web SDK is served by nginx straight from sdk-web/, so step 1 publishes it.
set -euo pipefail

REPO_DIR="${REPO_DIR:-/var/www/Spres-Ai-Agent}"
BRANCH="${BRANCH:-main}"
API_DIR="$REPO_DIR/brainBox"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:8000/api/health}"
LOCK=/tmp/brainbox-deploy.lock

exec 9>"$LOCK"
flock -n 9 || { echo "Another deploy is running"; exit 1; }

cd "$REPO_DIR"
echo "==> Fetching $BRANCH"
git fetch --quiet origin "$BRANCH"
OLD=$(git rev-parse HEAD)
NEW=$(git rev-parse "origin/$BRANCH")
if [ "$OLD" = "$NEW" ] && [ "${FORCE:-0}" != "1" ]; then
  echo "Already at $NEW — nothing to deploy"; exit 0
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
    exit 0
  fi
  sleep 2
done
echo "!! API did not become healthy — last logs:"
docker logs --tail 80 brainbox-api
exit 1
