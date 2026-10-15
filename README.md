# CellOh!

A small static web app for exploring cello notes and fingerboard positions, built for my son who plays. TypeScript, German labels, and real cello recordings.

- Interactive fingerboard, bass-clef notation, and piano keyboard.
- Positions 1–4, backward extensions, and German sharp/flat spelling.
- Editable note sequences with playback and optional SoundFont synthesis.
- Experimental microphone feedback for intonation and note recognition; audio stays on the device.
- Installable as a PWA, with offline playback after the first online visit.

## Sharing note sequences

The Tonfolge ⋮ menu offers **Text kopieren**, **Link kopieren**, and **Importieren …**.
Paste either exported text or a share link to replace the sequence; imports can be undone.
Share links load into an empty sequence without playing automatically.

The text format is `celloh:v1 C3/4 D3/8 Fis3/4. H3/2`: German note names,
scientific octaves (middle C is C4), and note lengths 1, 2, 4, 8, or 16 with
an optional dot. Bare note lists are accepted; omitted lengths mean quarters.
Whitespace or commas separate tokens. Links carry the same format with commas in
`#tonfolge=celloh:v1,C3/4,D3/8`. The format preserves sounding pitches and lengths,
not enharmonic spelling or app settings. Supported pitches run from C2 through A5.

## Development

Requires Node.js 22.13+ and Python 3:

```sh
npm ci
npm run audio:fetch
npm run dev
```

Open the URL printed by Vite. The server also listens on the local network for phone testing; microphone access requires HTTPS or localhost.

For Docker, Zed, and persistent Codex login, see the [Dev Container guide](.devcontainer/README.md). Run these on the host:

```sh
.devcontainer/update.sh        # Rebuild with latest Codex; retain login
.devcontainer/update.sh --zed  # Also open in Zed
.devcontainer/check.sh         # Run the full CI suite
```

For Amp orbs, `.agents/setup` prepares the environment; `amp orb services ensure` starts the app and Storybook.

## Checks and previews

```sh
npm run check                      # Formatting, lint, types, unit tests
npm run test:audio                 # Python audio tests
npm run test:browser               # Build and test in Chromium
npm run storybook -- --port 6006   # Component previews
npm run test:stories               # Storybook browser tests
npm run format                    # Apply formatting
```

Install Playwright browsers with `npx playwright install --with-deps chromium firefox` before running browser tests. [CI](.github/workflows/ci.yml) runs the full suite through [scripts/ci.sh](scripts/ci.sh), including Firefox checks.

## Deployment

```sh
npm run build:deploy   # Fetch audio, check code, and build dist/
npm run preview        # Preview locally
```

Publish `dist/` to any static HTTP(S) host. Subdirectory hosting is supported. For the configured Cloudflare Worker, authenticate with `npx wrangler login`, then run:

```sh
npm run deploy:check    # Validate without uploading
npm run deploy:preview # Upload a preview version
npm run deploy         # Publish to production
```

Cloudflare Git builds use `npm run build:deploy` and `npm run deploy` on `master`, or `npm run deploy:preview` for other branches. Deployment settings live in [wrangler.toml](wrangler.toml).

## Audio and offline use

Recordings are fetched from the release pinned in [audio-release.json](audio-release.json); generated audio is ignored by Git. The SoundFont is fetched automatically by `dev` and `build`. To publish new recordings, update the release tag and checksums and run the **Publish cello audio** GitHub Actions workflow.

Install through the browser menu, or **Share → Add to Home Screen** on iOS. The production app caches its assets after the first online visit. Updates activate after all app windows close. Use a production build to test offline behavior.

Cello samples and SoundFont are by [Ethan Winer](https://ethanwiner.com/ewsf2.html). Positions were informed by [Cello Online](https://www.celloonline.com/cellofingeringchart.htm). The board uses equal semitone spacing to show pitch relationships; it does not represent physical finger distances.
