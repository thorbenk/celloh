#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo 'Usage: .devcontainer/update.sh [--fresh] [--zed]'
  echo 'Rebuild without cache (including latest stable Codex) and recreate the container.'
  echo 'Named volumes and project files are retained; running container processes stop.'
  echo '--fresh is accepted for compatibility; every update is now fresh.'
  echo '--zed also opens the project in Zed after updating.'
}
open_zed=false
for arg in "$@"; do
  case "$arg" in
    --fresh) ;;
    --zed) open_zed=true ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; exit 2 ;;
  esac
done
if "$open_zed" && ! command -v zed >/dev/null 2>&1; then
  echo 'Missing zed CLI. Install it or omit --zed.' >&2
  exit 1
fi
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
echo 'Rebuilding and recreating the Dev Container; retaining the Codex login volume.'
devcontainer up --remove-existing-container --build-no-cache
devcontainer exec codex --version
if "$open_zed"; then
  zed --dev-container "$project_dir"
fi
