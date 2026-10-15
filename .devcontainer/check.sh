#!/usr/bin/env bash
set -euo pipefail
if (( $# )); then
  echo 'Usage: .devcontainer/check.sh' >&2
  echo 'Start/reuse the CI Dev Container (no published ports) and run GitHub CI checks.' >&2
  if [[ $# == 1 && ( $1 == --help || $1 == -h ) ]]; then exit 0; fi
  exit 2
fi
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
devcontainer up --config "$project_dir/scripts/devcontainer-ci/devcontainer.json"
# exec propagates the check command's exit status to the calling shell.
devcontainer exec --config "$project_dir/scripts/devcontainer-ci/devcontainer.json" bash scripts/ci.sh
