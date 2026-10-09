#!/usr/bin/env bash
# Brainbox — set up the brainBox backend on a NEW Ubuntu 22.04 / 24.04 server.
#
#   sudo bash bootstrap-server.sh [REPO_URL] [DOMAIN]
#
#   REPO_URL  default https://github.com/resbrotherx/Spres-Ai-Agent.git
#   DOMAIN    optional, only used to print the nginx example (default brainbox.example.com)
#   env: BRANCH (default main), REPO_DIR (default /var/www/Spres-Ai-Agent)
#
# Safe to run again (idempotent):
#   * installs Docker Engine + the compose plugin only if they are missing
#   * clones the repo only if REPO_DIR does not exist yet (an existing checkout is left untouched)
#   * creates brainBox/.env from .env.example only if it does not exist
#   * generates POSTGRES_PASSWORD, JWT_SECRET_KEY and BRAINBOX_ADMIN_TOKEN only when they are
#     empty or still the .env.example placeholder — existing values are never replaced
#   * secret VALUES are never printed, only the names of the ones that were generated
#   * pulls the Ollama model only if it is not there yet
# It does NOT touch nginx, certbot or the firewall: it prints the commands for you to review.
set -euo pipefail

REPO_URL="${1:-https://github.com/resbrotherx/Spres-Ai-Agent.git}"
DOMAIN="${2:-brainbox.example.com}"
BRANCH="${BRANCH:-main}"
REPO_DIR="${REPO_DIR:-/var/www/Spres-Ai-Agent}"
API_DIR="$REPO_DIR/brainBox"
ENV_FILE="$API_DIR/.env"
HEALTH_URL="http://127.0.0.1:8000/api/health"
DEFAULT_MODEL="qwen2.5:1.5b"

say()  { printf '\n==> %s\n' "$*"; }
info() { printf '    %s\n' "$*"; }
die()  { printf '\n!! %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Run as root (sudo bash $0 ...)"
command -v apt-get >/dev/null 2>&1 || die "This script expects Ubuntu (apt-get not found)"

# ---------------------------------------------------------------------------------------------
# 1. Base packages + Docker
# ---------------------------------------------------------------------------------------------
say "Checking base packages"
NEED=""
for p in git curl openssl ca-certificates gnupg; do
  dpkg -s "$p" >/dev/null 2>&1 || NEED="$NEED $p"
done
if [ -n "$NEED" ]; then
  info "installing:$NEED"
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq $NEED >/dev/null
else
  info "git, curl, openssl, ca-certificates, gnupg already installed"
fi

add_docker_repo() {
  if [ ! -f /etc/apt/sources.list.d/docker.list ]; then
    info "adding the official Docker apt repository"
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    # shellcheck disable=SC1091
    . /etc/os-release
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
      > /etc/apt/sources.list.d/docker.list
  fi
  apt-get update -qq
}

say "Checking Docker"
if ! command -v docker >/dev/null 2>&1; then
  add_docker_repo
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin >/dev/null
  info "Docker installed"
else
  info "Docker already installed: $(docker --version)"
fi
if ! docker compose version >/dev/null 2>&1; then
  info "compose plugin missing — installing docker-compose-plugin"
  add_docker_repo
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq docker-compose-plugin >/dev/null
fi
info "$(docker compose version)"
systemctl enable --now docker >/dev/null 2>&1 || true

# ---------------------------------------------------------------------------------------------
# 2. Repository
# ---------------------------------------------------------------------------------------------
say "Checking the repository at $REPO_DIR"
if [ -d "$REPO_DIR/.git" ]; then
  info "already cloned — left as it is (deploy.sh updates it). Current commit: $(git -C "$REPO_DIR" rev-parse --short HEAD)"
elif [ -e "$REPO_DIR" ]; then
  die "$REPO_DIR exists but is not a git checkout — move it away first"
else
  mkdir -p "$(dirname "$REPO_DIR")"
  git clone --branch "$BRANCH" "$REPO_URL" "$REPO_DIR"
  info "cloned $REPO_URL ($BRANCH)"
fi
[ -f "$API_DIR/docker-compose.yml" ] || die "$API_DIR/docker-compose.yml not found — wrong repository?"

# ---------------------------------------------------------------------------------------------
# 3. brainBox/.env
# ---------------------------------------------------------------------------------------------
get_env() {  # value of KEY in .env (last occurrence, surrounding quotes removed)
  grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -n 1 | cut -d= -f2- | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/" || true
}
set_env() {  # set KEY=VALUE in .env (replace the existing line or append). Values must not contain '|'.
  if grep -qE "^$1=" "$ENV_FILE"; then
    sed -i "s|^$1=.*|$1=$2|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$1" "$2" >> "$ENV_FILE"
  fi
}
gen_secret() { openssl rand -hex 32; }   # 64 hex chars: safe in URLs, sed and shell

say "Checking $ENV_FILE"
if [ ! -f "$ENV_FILE" ]; then
  [ -f "$API_DIR/.env.example" ] || die "$API_DIR/.env.example not found"
  cp "$API_DIR/.env.example" "$ENV_FILE"
  info "created from .env.example"
else
  info "already exists — only empty / placeholder secrets will be filled in"
fi
chmod 600 "$ENV_FILE"

GENERATED=""
PG_GENERATED=0
v="$(get_env POSTGRES_PASSWORD)"
if [ -z "$v" ] || [ "$v" = "change-me" ]; then
  set_env POSTGRES_PASSWORD "$(gen_secret)"; GENERATED="$GENERATED POSTGRES_PASSWORD"; PG_GENERATED=1
fi
v="$(get_env JWT_SECRET_KEY)"
case "$v" in
  ""|"your-secret-key-change-in-production"|"change-me"|"secret")
    set_env JWT_SECRET_KEY "$(gen_secret)"; GENERATED="$GENERATED JWT_SECRET_KEY" ;;
esac
v="$(get_env BRAINBOX_ADMIN_TOKEN)"
if [ -z "$v" ]; then
  set_env BRAINBOX_ADMIN_TOKEN "$(gen_secret)"; GENERATED="$GENERATED BRAINBOX_ADMIN_TOKEN"
fi

set_env REQUIRE_API_KEY true
set_env LEGACY_DOC_AUDIENCE internal
set_env DEBUG false
# OLLAMA_MODEL: keep whatever .env says (the last line wins, as in python-dotenv); default only if empty
if [ -z "$(get_env OLLAMA_MODEL)" ]; then
  set_env OLLAMA_MODEL "$DEFAULT_MODEL"
fi
OLLAMA_MODEL="$(get_env OLLAMA_MODEL)"; OLLAMA_MODEL="${OLLAMA_MODEL:-$DEFAULT_MODEL}"

if [ -n "$GENERATED" ]; then
  info "generated (values NOT shown — read them in $ENV_FILE when you need them):$GENERATED"
else
  info "no secrets generated (all were already set)"
fi
info "set REQUIRE_API_KEY=true, LEGACY_DOC_AUDIENCE=internal, DEBUG=false; OLLAMA_MODEL=$OLLAMA_MODEL"

if [ "$PG_GENERATED" = "1" ] && docker volume inspect brainbox_postgres_data >/dev/null 2>&1; then
  printf '\n!! WARNING: a new POSTGRES_PASSWORD was generated but the volume brainbox_postgres_data already\n'
  printf '!! exists. Postgres keeps the password it was first created with, so the API may fail to connect.\n'
  printf '!! Put the original password back in .env, or (empty server only!) remove the volume.\n'
fi

# ---------------------------------------------------------------------------------------------
# 4. Containers
# ---------------------------------------------------------------------------------------------
say "Starting postgres, redis, ollama and api (docker compose up -d)"
cd "$API_DIR"
docker compose up -d postgres redis ollama api

say "Checking the Ollama model '$OLLAMA_MODEL'"
for i in $(seq 1 30); do
  docker exec brainbox-ollama ollama list >/dev/null 2>&1 && break
  sleep 2
done
if docker exec brainbox-ollama ollama list 2>/dev/null | awk 'NR>1{print $1}' | grep -qx "$OLLAMA_MODEL"; then
  info "already pulled"
else
  info "pulling (a few GB, can take several minutes)..."
  docker exec brainbox-ollama ollama pull "$OLLAMA_MODEL"
fi

say "Waiting for $HEALTH_URL"
HEALTHY=0
for i in $(seq 1 90); do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then HEALTHY=1; break; fi
  sleep 2
done
if [ "$HEALTHY" = "1" ]; then
  info "healthy: $(curl -fsS "$HEALTH_URL")"
else
  printf '\n!! The API did not become healthy within 3 minutes. Last logs:\n'
  docker logs --tail 80 brainbox-api || true
  exit 1
fi

# ---------------------------------------------------------------------------------------------
# 5. Next steps (printed only — nothing below is executed)
# ---------------------------------------------------------------------------------------------
cat <<EOF

==========================================================================================
 brainBox is running on this server (http://127.0.0.1:8000). Next steps:
==========================================================================================

 1. Restore a database backup (when moving from another server) — otherwise skip:
      docker stop brainbox-api
      docker exec brainbox-postgres dropdb -U spres spres_ai
      docker exec brainbox-postgres createdb -U spres spres_ai
      docker exec -i brainbox-postgres pg_restore -U spres -d spres_ai --no-owner < backup.dump
      docker start brainbox-api

 2. Create the first owner of a company (tenant). Prints an invite link (valid 7 days):
      docker exec brainbox-api python -m app.cli staff create --tenant acme --email owner@acme.com --role owner
    or set a password straight away (you type it, it is not echoed):
      docker exec -it brainbox-api python -m app.cli staff create --tenant acme --email owner@acme.com --role owner --password

 3. Create API keys (the raw key is printed ONCE — store it in a password manager):
      docker exec brainbox-api python -m app.cli keys create --tenant acme --type publishable --name "Website widget"
      docker exec brainbox-api python -m app.cli keys create --tenant acme --type secret --name "Odoo server"
      docker exec brainbox-api python -m app.cli keys list --tenant acme

 4. nginx + HTTPS for $DOMAIN (point the DNS A record to this server first):
      apt-get install -y nginx certbot python3-certbot-nginx
    then create /etc/nginx/sites-available/brainbox with:

server {
    listen 80;
    server_name $DOMAIN;
    client_max_body_size 60M;

    # web SDK served straight from the repo (every deploy updates it)
    location /sdk/ {
        alias $REPO_DIR/sdk-web/;
        add_header Access-Control-Allow-Origin "*";
    }

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;     # AI answers can take a while
        proxy_send_timeout 300s;
    }
}

      ln -s /etc/nginx/sites-available/brainbox /etc/nginx/sites-enabled/brainbox
      nginx -t && systemctl reload nginx
      certbot --nginx -d $DOMAIN          # adds HTTPS + automatic renewal

 5. Firewall — allow only SSH, HTTP and HTTPS (review, then enable yourself):
      ufw default deny incoming
      ufw default allow outgoing
      ufw allow 22/tcp
      ufw allow 80/tcp
      ufw allow 443/tcp
      ufw enable
    NOTE: Docker-published ports bypass ufw. docker-compose.yml publishes the API as 8000:8000
    on all interfaces, so also block 8000 in your cloud provider's firewall (or change the
    mapping to 127.0.0.1:8000:8000). Postgres is bound to 127.0.0.1; redis and ollama are not published.

 6. Optional in $ENV_FILE (then: docker restart brainbox-api):
      DASHBOARD_URL=https://<where the staff dashboard is hosted>   (links in invite emails)
      SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD / SMTP_FROM  (email alerts + invites)

 7. Automatic deploys: add the GitHub Actions deploy key and secrets — see deploy/README.md.
    Manual deploy at any time:  bash $REPO_DIR/deploy/deploy.sh
==========================================================================================
EOF
