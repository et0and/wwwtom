#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_NAME="${BUNDLE_CHECKER_IMAGE:-wwwtom-bundle-checker:local}"

docker build \
  --pull \
  --load \
  --file "$ROOT_DIR/tools/bundle-checker/Dockerfile" \
  --tag "$IMAGE_NAME" \
  "$ROOT_DIR/tools/bundle-checker"

docker run \
  --rm \
  --volume "$ROOT_DIR:/workspace:ro" \
  --workdir /workspace \
  "$IMAGE_NAME" \
  --root /workspace \
  --config tools/bundle-checker/budgets.json \
  "$@"
