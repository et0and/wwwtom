#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Turbo restores cached output files but cannot remove files left by an older
# cached revision. Start from empty client directories so the checker sees only
# the build it is about to inspect.
rm -rf \
  "$ROOT_DIR/apps/web/dist" \
  "$ROOT_DIR/apps/sophie/dist" \
  "$ROOT_DIR/apps/editor/dist"

VITE_ADAPTER_URL=https://adapter.tom.so \
  pnpm turbo run build --filter=@tom/web
VITE_ADAPTER_URL=https://adapter.sophie.st \
  pnpm turbo run build --filter=@tom/sophie
VITE_ADAPTER_URL=https://adapter.sophie.st \
VITE_AUTH_PROVIDER=google \
VITE_SOPHIE=true \
  pnpm turbo run build --filter=@tom/editor
