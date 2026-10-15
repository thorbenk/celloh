#!/usr/bin/env bash
# Shared by GitHub Actions and the local Dev Container runner.
set -euo pipefail
case "${1:-}" in
  '') ;;
  --with-deps) ;;
  *) echo 'Usage: scripts/ci.sh [--with-deps]' >&2; exit 2 ;;
esac
if (( $# > 1 )); then exit 2; fi
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
export CI=true
npm ci
npm run check
npm run test:audio
npm run audio:fetch
npm run audio:verify
npm run audio:soundfont
if [[ ${1:-} == --with-deps ]]; then
  npx --no-install playwright install --with-deps chromium firefox
else
  # System dependencies are already baked into the Dev Container image.
  npx --no-install playwright install chromium firefox
fi
npm run test:browser -- --trace retain-on-failure
npm run test:stories -- --trace retain-on-failure
npx --no-install playwright test --config playwright.firefox.config.ts --trace retain-on-failure
