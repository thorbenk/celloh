#!/usr/bin/env bash
# Shared host-side setup. Source from the entry points below.
project_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)
for tool in docker npx; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Missing $tool. Run this command on the host with Docker and Node.js installed." >&2
    exit 1
  fi
done
if ! docker info >/dev/null; then
  echo 'Docker is unavailable. Check the daemon and your Docker group membership.' >&2
  exit 1
fi

devcontainer() {
  local subcommand=$1
  shift
  npx --yes @devcontainers/cli@0.89.0 "$subcommand" --workspace-folder "$project_dir" "$@"
}
