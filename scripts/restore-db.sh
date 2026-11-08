#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
. scripts/compose.sh
restore_dir="${1:?Usage: restore-db.sh backups/TIMESTAMP --confirm}"
[ "${2:-}" = '--confirm' ] || { echo 'Restore replaces existing database contents. Add --confirm.'; exit 1; }
[ -f "$restore_dir/database.dump" ] && [ -f "$restore_dir/uploads.tar.gz" ] && [ -f "$restore_dir/SHA256SUMS" ] && [ -f "$restore_dir/RECEIPT" ]
grep -qx 'format=yuri-blog-backup-v1' "$restore_dir/RECEIPT"
# Verify exactly the expected portable filenames.
[ "$(wc -l < "$restore_dir/SHA256SUMS" | tr -d ' ')" = 2 ]
awk '{name=$2; sub(/^\*/,"",name); if(NF!=2 || (name!="database.dump" && name!="uploads.tar.gz")) exit 1; seen[name]++} END {if(seen["database.dump"]!=1 || seen["uploads.tar.gz"]!=1) exit 1}' "$restore_dir/SHA256SUMS"
(cd "$restore_dir" && sha256sum -c SHA256SUMS)
compose exec -T postgres pg_restore --list < "$restore_dir/database.dump" > /dev/null
archive_list="$(mktemp)"
trap 'rm -f "$archive_list"' EXIT
compose run --rm --no-deps -T --entrypoint tar web -tzf - < "$restore_dir/uploads.tar.gz" > "$archive_list"
awk '$0 !~ /^uploads\// || $0 ~ /(^|\/)\.\.(\/|$)/ || $0 ~ /\\/ {bad=1} END {exit bad}' "$archive_list"
compose stop web worker
# On any failure, writers remain stopped for operator recovery.
compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges --clean --if-exists --exit-on-error --single-transaction' < "$restore_dir/database.dump"
compose run --rm --no-deps -T --entrypoint tar web -xz --no-same-owner -C /app/data < "$restore_dir/uploads.tar.gz"
compose exec -T postgres sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\''DELETE FROM "Session";'\'''
echo 'Restore complete. Web/worker remain stopped. Verify the source revision and run migrations before reopening traffic.'
