FROM mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm

USER root

# Python is used by this project's audio scripts. OS packages belong in the
# image: no-new-privileges intentionally prevents runtime sudo.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 \
    && rm -rf /var/lib/apt/lists/*

# Match browser system libraries to the repository's locked Playwright version.
# Browser binaries are installed as node by scripts/ci.sh (no runtime sudo).
COPY package-lock.json /tmp/celloh-package-lock.json
RUN PLAYWRIGHT_VERSION=$(node -p "require('/tmp/celloh-package-lock.json').packages['node_modules/playwright'].version") \
    && npx --yes "playwright@${PLAYWRIGHT_VERSION}" install-deps chromium firefox \
    && rm -rf /var/lib/apt/lists/* /tmp/celloh-package-lock.json

# Resolve npm's stable release on each uncached build.
RUN npm install --global @openai/codex@latest

# Docker seeds a new named volume from this directory, including ownership.
RUN install -d -m 0700 -o node -g node /home/node/.codex
COPY --chown=node:node .devcontainer/config.toml /home/node/.codex/config.toml

USER node
WORKDIR /workspace
