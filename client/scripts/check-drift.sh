#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <path-to-app-repo>" >&2
  exit 1
fi

APP_ROOT="$(cd "$1" && pwd)"
"$(dirname "${BASH_SOURCE[0]}")/sync-to-app.sh" "$APP_ROOT"
git -C "$APP_ROOT" diff --exit-code -- src/protocol/foaf-client
