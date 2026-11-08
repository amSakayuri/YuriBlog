#!/bin/sh
# Source from operational scripts; never print the interpolated Compose configuration.
compose() {
  docker compose --env-file "${YURI_ENV_FILE:-.env}" "$@"
}
