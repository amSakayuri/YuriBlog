#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
. scripts/compose.sh
command -v docker >/dev/null || { echo 'Docker Engine and Compose v2 are required.' >&2; exit 1; }
docker info >/dev/null
compose version --short
compose config --quiet
# Build and run the same tools image used by migrations/worker; no host Node is required.
compose build migrate
compose run --rm --no-deps -T --entrypoint node migrate scripts/production-env.mjs check-env
echo 'PASS: Docker daemon, Compose configuration, tools build and production environment.'
echo 'DNS, public HTTPS, restore drill and real Giscus still require acceptance checks.'
