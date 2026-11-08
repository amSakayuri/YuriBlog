#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
export YURI_ENV_FILE="${YURI_ENV_FILE:-.env.production}"
. scripts/compose.sh
compose "$@"
