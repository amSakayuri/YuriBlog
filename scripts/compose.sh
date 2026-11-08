#!/bin/sh
# Source from operational scripts; never print the interpolated Compose configuration.
# Root-directory maintenance follows the last successfully installed source release.
if [ -f .updates/current/docker-compose.yml ]; then
  YURI_ENV_FILE="${YURI_ENV_FILE:-.env.production}"
  case "$YURI_ENV_FILE" in /*) ;; *) YURI_ENV_FILE="$(pwd)/$YURI_ENV_FILE" ;; esac
  export YURI_ENV_FILE
  export COMPOSE_PROJECT_NAME="$(cat .updates/project)"
  export COMPOSE_FILE="$(pwd)/.updates/current/docker-compose.yml"
  if [ "$(cat .updates/content)" = 1 ]; then
    COMPOSE_FILE="$COMPOSE_FILE:$(pwd)/.updates/current/deploy/repository.compose.yml"
    export COMPOSE_FILE
  fi
fi
compose() {
  docker compose --env-file "${YURI_ENV_FILE:-.env}" "$@"
}
