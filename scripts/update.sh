#!/bin/sh
# Host-side updater: source checkout is separate from server configuration/data.
set -eu
cd "$(dirname "$0")/.."
install_root=$(pwd)
repository=https://github.com/amSakayuri/YuriBlog.git
branch=main
check_only=0
mode=proxy
content=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --check) check_only=1 ;;
    --caddy) mode=caddy ;;
    --with-content) content=1 ;;
    --help)
      echo 'Usage: sh scripts/update.sh [--check] [--caddy] [--with-content]'
      echo 'Pulls amSakayuri/YuriBlog main. Defaults to existing Baota/Nginx HTTPS proxy.'
      exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
  shift
done
for executable in git docker flock jq tar; do
  command -v "$executable" >/dev/null || { echo "Required command missing: $executable" >&2; exit 1; }
done
umask 077
mkdir -p .updates/releases
exec 9>.deploy.lock
flock -n 9 || { echo 'Another deployment/update is running.' >&2; exit 1; }
state="$install_root/.updates"
export YURI_ENV_FILE="${YURI_ENV_FILE:-$install_root/.env.production}"
case "$YURI_ENV_FILE" in /*) ;; *) YURI_ENV_FILE="$install_root/$YURI_ENV_FILE" ;; esac
[ -f "$YURI_ENV_FILE" ] || { echo 'Missing production environment; run initial deployment first.' >&2; exit 1; }
if [ ! -d "$state/repository.git" ]; then git init --bare "$state/repository.git" >/dev/null; fi
git --git-dir="$state/repository.git" fetch --no-tags "$repository" "refs/heads/$branch"
revision=$(git --git-dir="$state/repository.git" rev-parse FETCH_HEAD)
current=$(cat "$state/revision" 2>/dev/null || :)
echo "Available revision: $revision"
echo "Installed revision: ${current:-not recorded}"
[ "$check_only" = 0 ] || exit 0
if [ "$current" = "$revision" ]; then echo 'Already up to date; services were not restarted.'; exit 0; fi

stage=configuration
finish() {
  result=$?
  trap - EXIT HUP INT TERM
  if [ "$result" -ne 0 ]; then
    echo "Update failed at: $stage. Data volumes and previous source versions were retained." >&2
    echo 'If migration/start failed, inspect logs and backups before restarting; no automatic database rollback.' >&2
  fi
  exit "$result"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP

# Resolve the currently deployed Compose project before selecting a candidate.
if [ ! -f "$state/current/docker-compose.yml" ] && [ "$content" = 1 ] && [ -z "${COMPOSE_FILE:-}" ]; then
  export COMPOSE_FILE="$install_root/docker-compose.yml:$install_root/deploy/repository.compose.yml"
fi
. scripts/compose.sh
compose config --format json > "$state/previous.json"
project=$(jq -er '.name' "$state/previous.json")
export COMPOSE_PROJECT_NAME="$project"
postgres_id=$(compose ps -a -q postgres)
[ -n "$postgres_id" ] || { echo 'Existing PostgreSQL container not found; refusing to create a new database during update.' >&2; exit 1; }
expected_database=$(jq -er '.volumes.postgres_data.name' "$state/previous.json")
actual_database=$(docker inspect "$postgres_id" --format '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}')
[ "$expected_database" = "$actual_database" ] || { echo 'Database volume mismatch; update stopped.' >&2; exit 1; }
web_id=$(compose ps -a -q web)
[ -n "$web_id" ] || { echo 'Existing web container not found; update stopped.' >&2; exit 1; }
expected_uploads=$(jq -er '.volumes.uploads.name' "$state/previous.json")
actual_uploads=$(docker inspect "$web_id" --format '{{range .Mounts}}{{if eq .Destination "/app/data/uploads"}}{{.Name}}{{end}}{{end}}')
[ "$expected_uploads" = "$actual_uploads" ] || { echo 'Upload volume mismatch; update stopped.' >&2; exit 1; }

stage=download
release="$state/releases/$revision"
if [ -e "$release" ]; then
  # Failed attempts are retained rather than overwritten; retries use a new directory.
  release="$release-$(date +%s)-$$"
fi
mkdir "$release"
git --git-dir="$state/repository.git" archive --format=tar --output="$state/source.tar" "$revision"
tar -xf "$state/source.tar" -C "$release"
for required in Dockerfile docker-compose.yml scripts/deploy.sh scripts/production-preflight.sh prisma/schema.prisma; do
  [ -f "$release/$required" ] || { echo "Release missing: $required" >&2; exit 1; }
done
previous_source="$install_root"
if [ -d "$state/current" ]; then previous_source="$state/current"; fi
# Existing migrations are immutable; destructive additions require manual review.
for migration in "$previous_source"/prisma/migrations/*/migration.sql; do
  [ -f "$migration" ] || continue
  migration_name=$(basename "$(dirname "$migration")")
  candidate_migration="$release/prisma/migrations/$migration_name/migration.sql"
  [ -f "$candidate_migration" ] || { echo "Historical migration missing: $migration_name" >&2; exit 1; }
  # Uploading from Windows can change line endings without changing SQL.
  carriage_return=$(printf '\r')
  sed "s/$carriage_return\$//" "$migration" > "$state/previous-migration.sql"
  sed "s/$carriage_return\$//" "$candidate_migration" > "$state/candidate-migration.sql"
  cmp -s "$state/previous-migration.sql" "$state/candidate-migration.sql" || {
    echo "Historical migration changed or missing: $migration_name. Manual review required." >&2; exit 1;
  }
done
for migration in "$release"/prisma/migrations/*/migration.sql; do
  [ -f "$migration" ] || continue
  migration_name=$(basename "$(dirname "$migration")")
  [ ! -f "$previous_source/prisma/migrations/$migration_name/migration.sql" ] || continue
  if grep -Eiq '(^|[^[:alnum:]_])(DROP|TRUNCATE|DELETE)[[:space:]]' "$migration"; then
    echo "Potentially destructive migration: $migration_name. Manual review required." >&2; exit 1
  fi
done
export COMPOSE_FILE="$release/docker-compose.yml"
if [ "$content" = 1 ]; then
  export COMPOSE_FILE="$COMPOSE_FILE:$release/deploy/repository.compose.yml"
fi
cd "$release"
stage=validate
docker compose --env-file "$YURI_ENV_FILE" config --format json > "$state/candidate.json"
# Never silently change the PostgreSQL image or named volumes in an automatic update.
for config in previous candidate; do
  jq -S '{postgres:.services.postgres.image,volumes:.volumes,storage:[.services.postgres.volumes[],.services.web.volumes[],.services.worker.volumes[]]|map(select(.type=="volume"))}' \
    "$state/$config.json" > "$state/$config-storage.json"
done
cmp -s "$state/previous-storage.json" "$state/candidate-storage.json" || {
  echo 'Release changes database image or persistent storage; manual migration is required.' >&2; exit 1;
}
# Relative bind mounts would resolve against the new release directory.
jq -er '[.services.web.volumes[],.services.worker.volumes[]]|map(select(.type=="bind"))|sort_by(.target)' \
  "$state/previous.json" > "$state/previous-binds.json"
jq -er '[.services.web.volumes[],.services.worker.volumes[]]|map(select(.type=="bind"))|sort_by(.target)' \
  "$state/candidate.json" > "$state/candidate-binds.json"
cmp -s "$state/previous-binds.json" "$state/candidate-binds.json" || {
  echo 'Web/worker bind mounts changed. Use --with-content when enabled, and absolute server key paths.' >&2; exit 1;
}
export BACKUP_DIR="${BACKUP_DIR:-$install_root/backups}"
stage=deploy
if [ "$mode" = caddy ]; then sh scripts/deploy.sh --caddy; else sh scripts/deploy.sh; fi

stage=record
printf '%s\n' "$project" > "$state/project.tmp"
mv "$state/project.tmp" "$state/project"
printf '%s\n' "$content" > "$state/content.tmp"
mv "$state/content.tmp" "$state/content"
ln -s "$release" "$state/current.tmp"
mv -Tf "$state/current.tmp" "$state/current"
printf '%s\n' "$revision" > "$state/revision.tmp"
mv "$state/revision.tmp" "$state/revision"
echo "Update complete: $revision. Services restarted and healthy."
