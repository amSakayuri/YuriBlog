#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
. scripts/compose.sh
backup_dir="${BACKUP_DIR:-./backups}"
umask 077
mkdir -p "$backup_dir"
chmod 700 "$backup_dir"
backup_path="$backup_dir/$(date -u +%Y%m%dT%H%M%SZ)-$$"
mkdir "$backup_path"
# Restore only the services that were running before this operation.
running_services="$(compose ps --status running --services | awk '$0=="web" || $0=="worker"')"
resume_writers() {
  result=$?
  trap - EXIT HUP INT TERM
  if [ -n "$running_services" ]; then
    compose start $running_services || result=1
  fi
  exit "$result"
}
trap resume_writers EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP
compose stop web worker
compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$backup_path/database.dump"
compose run --rm --no-deps -T --entrypoint tar web -cz -C /app/data uploads > "$backup_path/uploads.tar.gz"
test -s "$backup_path/database.dump"
test -s "$backup_path/uploads.tar.gz"
(cd "$backup_path" && sha256sum database.dump uploads.tar.gz > SHA256SUMS)
printf 'format=yuri-blog-backup-v1\ncreated_utc=%s\n' "$(date -u +%FT%TZ)" > "$backup_path/RECEIPT"
printf 'web_image_id=%s\n' "$(compose images -q web)" >> "$backup_path/RECEIPT"
echo "Backup complete: $backup_path (copy the entire directory off-site)."
