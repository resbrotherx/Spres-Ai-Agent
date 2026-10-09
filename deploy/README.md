# deploy/

Scripts that put brainBox on a Linux server. Both run **on the server**, as root.
The full operations runbook (onboarding companies, backups, moving servers, troubleshooting) is
`docs/Brainbox-Operations-Runbook.pdf`.

| File | When | What it does |
|---|---|---|
| `bootstrap-server.sh` | once, on a **new** Ubuntu 22.04 / 24.04 server | installs Docker, clones the repo, creates `brainBox/.env`, starts the containers, pulls the AI model |
| `deploy.sh` | on every release (GitHub Actions runs it for you) | pulls `main`, restarts the API, checks health |

Server layout: repository at `/var/www/Spres-Ai-Agent`, Docker Compose project in `brainBox/`
(containers `brainbox-api`, `brainbox-postgres`, `brainbox-redis`, `brainbox-ollama`), secrets in
`brainBox/.env` (never committed). nginx proxies the domain to `127.0.0.1:8000` and serves
`/sdk/` straight from `sdk-web/`.

## bootstrap-server.sh

```bash
curl -fsSL https://raw.githubusercontent.com/resbrotherx/Spres-Ai-Agent/main/deploy/bootstrap-server.sh -o bootstrap-server.sh
sudo bash bootstrap-server.sh [REPO_URL] [DOMAIN]
#   REPO_URL default https://github.com/resbrotherx/Spres-Ai-Agent.git
#   DOMAIN   only used to print the nginx example
#   env: BRANCH=main  REPO_DIR=/var/www/Spres-Ai-Agent
```

It is idempotent — run it again at any time:

1. Installs `git curl openssl ca-certificates gnupg`, then Docker Engine + the compose plugin
   (official Docker apt repository) **only if missing**.
2. Clones the repository to `/var/www/Spres-Ai-Agent` if it is not there (an existing checkout is
   left untouched).
3. Creates `brainBox/.env` from `.env.example` (mode 600) if it does not exist, then generates
   `POSTGRES_PASSWORD`, `JWT_SECRET_KEY` and `BRAINBOX_ADMIN_TOKEN` **only when they are empty or
   still the placeholder**. It prints the names of the generated values, never the values.
   It sets `REQUIRE_API_KEY=true`, `LEGACY_DOC_AUDIENCE=internal` and `DEBUG=false`.
   `OLLAMA_MODEL` is kept as written in `.env` (the last line wins, like the API's dotenv loader;
   `.env.example` and production use `qwen2.5:1.5b`) and set to `qwen2.5:1.5b` only when empty.
   Edit `.env` before running the script (or re-run it afterwards) to choose another model.
4. `docker compose up -d postgres redis ollama api`, pulls the Ollama model named in `OLLAMA_MODEL`
   (skipped when already present) and waits for `http://127.0.0.1:8000/api/health`.
5. Prints the next steps: restoring a backup, creating the first owner and keys, an nginx +
   certbot example (with `location /sdk/` and `proxy_read_timeout 300s`) and the `ufw` commands
   for ports 22/80/443. **It does not configure nginx or enable the firewall itself.**

> Docker-published ports bypass `ufw`. `docker-compose.yml` publishes the API as `8000:8000`, so
> block port 8000 in the cloud provider's firewall too (or bind it to `127.0.0.1:8000:8000`).

## deploy.sh

```bash
bash /var/www/Spres-Ai-Agent/deploy/deploy.sh             # normal deploy
FORCE=1 bash /var/www/Spres-Ai-Agent/deploy/deploy.sh     # restart even if already up to date
FORCE_BUILD=1 bash /var/www/Spres-Ai-Agent/deploy/deploy.sh  # also rebuild the API image
```

1. Takes a lock (`/tmp/brainbox-deploy.lock`) so two deploys never overlap.
2. `git fetch` + `git merge --ff-only origin/main` — it never discards local commits; if the server
   checkout has diverged, the deploy fails instead.
3. Rebuilds the API image only when `requirements.txt`, `Dockerfile` or `.dockerignore` changed.
4. Recreates `brainbox-api` when `docker-compose.yml` changed or the image was rebuilt, otherwise
   just restarts it. Postgres, Redis and Ollama keep running.
5. Waits up to 2 minutes for `/api/health`; on failure prints the last 80 API log lines and exits 1.

Database schema changes need no separate step: the API adds new tables / columns itself when it
starts (`init_db`, idempotent). Because nginx serves `/sdk/` from the checkout, step 2 also
publishes the web SDK.

## GitHub Actions (`.github/workflows/deploy.yml`)

On every push to `main` that touches `brainBox/**`, `sdk-web/**`, `deploy/**` or the workflow
(or a manual *Run workflow*), the `check` job byte-compiles the backend and syntax-checks the web
SDK, then the `deploy` job (environment `production`) opens an SSH connection to the server. The
server's forced command runs `deploy.sh`, so the workflow sends no command of its own.

Repository → Settings → Secrets and variables → Actions (or the `production` environment):

| Secret | Value |
|---|---|
| `DEPLOY_HOST` | server IP or hostname, e.g. `165.227.77.33` |
| `DEPLOY_USER` | SSH user that owns the checkout (currently `root`) |
| `DEPLOY_KNOWN_HOSTS` | output of `ssh-keyscan -t ed25519 <host>` (run it from a trusted network and compare the fingerprint with `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` on the server) |
| `DEPLOY_SSH_KEY` | the **private** half of a key pair made only for this purpose |

### The deploy key

```bash
# on your own machine (not the server); no passphrase, it is used unattended
ssh-keygen -t ed25519 -C github-actions-deploy -f github-actions-deploy -N ""
```

Put the private file `github-actions-deploy` into `DEPLOY_SSH_KEY`, then add the public half to
`~/.ssh/authorized_keys` of `DEPLOY_USER` on the server **with a forced command**, all on one line:

```
restrict,command="bash /var/www/Spres-Ai-Agent/deploy/deploy.sh" ssh-ed25519 AAAA... github-actions-deploy
```

`restrict` disables port forwarding, agent forwarding, X11 and the PTY; `command=` means this key
can do exactly one thing — run the deploy — whatever the client asks for. Delete the local private
key file once it is stored in GitHub. To rotate: generate a new pair, replace the line and the
secret, done.

When moving to a new server, update `DEPLOY_HOST` and `DEPLOY_KNOWN_HOSTS` and add the
`authorized_keys` line there.
