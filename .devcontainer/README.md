# Zed / Codex Dev Container

## Setup

Install [Docker Engine](https://docs.docker.com/engine/install/), Node.js/npm, and optionally Zed on the host. Your user must be able to run Docker without sudo. After changing Docker group membership, log out and back in and restart Zed.

Set your Git identity once from a host terminal in this repository. It is stored in the shared `.git/config` and survives rebuilds:

```sh
git config --local user.name "Your Name"
git config --local user.email "you@example.com"
```

Open with Zed's **Open in Container**, or run from the project root:

```sh
zed --dev-container .
```

The image includes Node.js 22, Python 3, Codex, and Playwright system dependencies. Creation runs `npm ci` and installs the lockfile-matched Chromium and Firefox browsers. Terminals and language servers run as `node` in `/workspace`; edits appear immediately on the host.

## Daily commands

Run on the host:

```sh
.devcontainer/update.sh        # Rebuild without cache with latest Codex
.devcontainer/update.sh --zed  # Also open in Zed
.devcontainer/check.sh         # Run the full CI suite in a separate container
```

The scripts use a pinned Dev Containers CLI through `npx`. Updates retain project files and the Codex volume, but replace other container-local files and stop running processes. Reconnect Zed and restart development servers afterward.

Run inside the development container:

```sh
npm run audio:fetch
npm run dev                       # http://localhost:5173
npm run preview                   # http://localhost:4173 (build first)
npm run storybook -- --port 6006  # http://localhost:6006
```

These ports bind to host loopback and must be free when the container starts. Recreate the container after changing port mappings. Add system packages to the Dockerfile and rebuild; runtime sudo is disabled.

The check container has no published ports or Codex login volume. It runs [scripts/ci.sh](../scripts/ci.sh), shared with GitHub Actions, against the working tree, including uncommitted changes. Checks replace `node_modules` and build output; stop other development/test processes first. Browser failure reports remain in `test-results/` and `playwright-report/`. Rebuild after changing Playwright's locked version.

## Codex login

Inside the container, sign in once and complete the browser flow on the host:

```sh
codex login --device-auth
codex login status
codex --yolo
```

Device authentication must be enabled in your ChatGPT security settings. See [Codex authentication](https://developers.openai.com/codex/auth).

`/home/node/.codex` is a named Docker volume (`celloh-codex-…`) holding file-based authentication tokens, configuration, and sessions. Rebuilds attach the same volume, so login persists. Keep the volume; deleting it loses the saved login. Moving the project may change the volume identity. Existing volumes retain their configuration when the image changes.

If login status succeeds but Codex still asks you to sign in, exit Codex and run:

```sh
codex app-server daemon restart
```

Then restart Codex. `codex --yolo --no-daemon` also bypasses the stale daemon issue observed with Codex 0.162.1.

## Container boundary

`--yolo` disables Codex approvals and its own sandbox. The container runs as `node`, drops all Linux capabilities, and prevents privilege escalation. The project is writable, network access is enabled, and Codex can access its saved tokens. Host home directories, SSH agents, and the Docker socket are not mounted by this configuration. Push from the host unless you separately configure Git authentication.

Before using YOLO after changing the container setup, inspect the actual container from the host:

```sh
docker ps
docker inspect CONTAINER_ID --format '{{json .Mounts}}'
```

Expect the project bind mount at `/workspace` and the Codex volume at `/home/node/.codex`. Check unexpected host mounts. Secrets or nested host mounts already inside the project are accessible to the container.

If Zed reports Docker socket permission denied while Docker works in your host terminal, fully quit and restart Zed. See [Zed's Dev Container documentation](https://zed.dev/docs/dev-containers).
