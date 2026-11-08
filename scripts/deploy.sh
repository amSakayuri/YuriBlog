#!/bin/sh
# Run on the Linux Docker host from any directory.
set -eu
cd "$(dirname "$0")/.."

mode=proxy
domain=
initialize=0
export YURI_ENV_FILE="${YURI_ENV_FILE:-.env.production}"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --init) initialize=1; shift ;;
    --domain) [ "$#" -ge 2 ] || { echo 'Missing --domain value' >&2; exit 1; }; domain=$2; shift 2 ;;
    --caddy) mode=caddy; shift ;;
    --help)
      echo 'Usage: sh scripts/deploy.sh [--init --domain blog.example.com] [--caddy]'
      echo 'Default: existing Nginx/Baota HTTPS proxy. YURI_ENV_FILE defaults to .env.production.'
      exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

command -v docker >/dev/null || { echo 'Install Docker Engine and Compose v2 first.' >&2; exit 1; }
command -v flock >/dev/null || { echo 'Install util-linux (flock) first.' >&2; exit 1; }
exec 9>.deploy.lock
flock -n 9 || { echo 'Another deployment is running.' >&2; exit 1; }
docker info >/dev/null
docker compose version --short
. scripts/compose.sh

if [ ! -f "$YURI_ENV_FILE" ]; then
  [ "$initialize" = 1 ] && [ -n "$domain" ] || {
    echo 'No production environment. First deploy: sh scripts/deploy.sh --init --domain blog.amsakayuri.cn' >&2
    exit 1
  }
  project="${COMPOSE_PROJECT_NAME:-yuri-blog}"
  existing_data=$(docker volume ls -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.volume=postgres_data')
  [ -z "$existing_data" ] || {
    echo 'Existing database volume found. Restore its original environment file; do not generate new credentials.' >&2
    exit 1
  }
  env_directory=$(dirname "$YURI_ENV_FILE")
  env_name=$(basename "$YURI_ENV_FILE")
  env_directory=$(cd "$env_directory" && pwd)
  # Use the host UID so the generated file remains readable only by its owner.
  docker run --rm --user "$(id -u):$(id -g)" \
    -v "$(pwd)/scripts/production-env.mjs:/production-env.mjs:ro" \
    -v "$env_directory:/config" node:24-bookworm-slim \
    node /production-env.mjs init "/config/$env_name" "$domain"
fi
chmod 600 "$YURI_ENV_FILE"

stage=preflight
writers_stopped=0
finish() {
  result=$?
  trap - EXIT HUP INT TERM
  if [ "$result" -ne 0 ]; then
    echo "Deployment failed at: $stage. Existing data volumes were retained." >&2
    if [ "$writers_stopped" = 1 ]; then
      echo 'web/worker may be stopped. Inspect logs and backups before restarting; no automatic database rollback.' >&2
    fi
  fi
  exit "$result"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP

sh scripts/production-preflight.sh
if [ -n "$domain" ]; then
  compose run --rm --no-deps -T --entrypoint node migrate -e \
    'if(process.env.APP_ORIGIN!=="https://"+process.argv[1]){console.error("Domain differs from APP_ORIGIN. Update the environment explicitly first.");process.exit(1)}' "$domain"
fi
stage=build
compose build web worker

# A stopped/existing database must also be backed up before migration.
postgres_id=$(compose ps -a -q postgres)
database_volumes=$(docker volume ls -q \
  --filter "label=com.docker.compose.project=${COMPOSE_PROJECT_NAME:-yuri-blog}" \
  --filter 'label=com.docker.compose.volume=postgres_data')
stage=database
compose up -d --wait postgres
stage=stop-writers
compose stop web worker
writers_stopped=1
if [ -n "$postgres_id" ] || [ -n "$database_volumes" ]; then
  stage=backup
  sh scripts/backup-db.sh
fi
stage=migration
compose run --rm --no-deps -T migrate
stage=start
if [ "$mode" = caddy ]; then
  compose up -d --wait web worker caddy
else
  compose stop caddy
  compose up -d --wait web worker
fi
stage=health
compose exec -T web node -e \
  'fetch("http://127.0.0.1:3000/api/health",{signal:AbortSignal.timeout(10000)}).then(async r=>{if(!r.ok)throw Error("HTTP "+r.status);console.log(await r.text())}).catch(e=>{console.error(e.message);process.exit(1)})'
compose ps
echo 'Deployment complete. Open https://YOUR_DOMAIN/admin/login using the domain in APP_ORIGIN.'
if [ "$mode" = proxy ]; then
  echo 'Baota/Nginx must proxy the configured HTTPS domain to 127.0.0.1:3000 (or your configured WEB_PORT). Caddy is stopped.'
fi
echo 'Public DNS, TLS and Giscus must be checked separately. Copy backups off the server.'
