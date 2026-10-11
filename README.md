# CellOh!

A small static web app for exploring cello notes and fingerboard positions, built for my son who plays. TypeScript code, German labels, and real cello recordings.

## Development

Use Node.js 22.13+ and npm:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. The development server also listens on the local network for testing on a phone.

```sh
npm run check
npm run build
npm run preview
```

### Component previews

```sh
npm run storybook -- --port 6006
npm run test:stories
```

Storybook uses the existing vanilla TypeScript views and production HTML/CSS, not
copies or a second UI framework. The fingerboard, compact notation, note picker,
piano keyboard, and pitch sequence mount without the application shell. Controls vary their container width/height,
pitch, key signature, and spacing. Workspace stories cover portrait, short portrait,
and desktop layouts, including the extra key-signature row and hidden/open piano dock. View observers and
event handlers are disposed when a story or its controls change.

`test:stories` builds Storybook and runs isolated Chromium checks against that build.
`build:storybook` creates a separate, gitignored `storybook-static/` directory;
Storybook is not included in the production app bundle.

### Amp orbs

`.agents/setup` uses the orb's preinstalled Node.js 22.13+, npm, and Python 3,
installs the locked npm dependencies and Playwright Chromium (including system
dependencies), and downloads the verified audio release. Amp snapshots this prepared
environment, so fresh orbs with an exact snapshot skip setup. When setup reruns,
browser downloads are cached and unchanged, valid audio is reused. No Cloudflare
credentials or audio rendering tools are needed for development.

`.agents/resume` checks the tools and dependencies, launches and closes Playwright
Chromium, and verifies the audio release; it never installs packages. A missing browser
or recording is reported immediately. To repair an orb manually, run `.agents/setup`.

Start the supervised development server and obtain its portal link with:

```sh
amp orb services ensure
```

The app and Storybook services are declared in `.amp/services.yaml`. Amp manages their ports and portal
hostname, and Vite accepts the hostname supplied by Amp. It runs `npm run dev:portal`,
using Vite 8's experimental bundled development mode to avoid a source-module
request waterfall over the higher-latency portal connection. HMR remains enabled.
Generated portal state is ignored by Git.

All commands use Vite 8, but bundled development is enabled only for the portal.
Local `npm run dev` stays unbundled; production build configuration is unchanged.
To fall back to unbundled portal development, change the service command to
`npm run dev -- --port "$PORT" --strictPort` and rerun `amp orb services ensure`.

## Reading the code

Start with `src/main.ts`, which only mounts the app. Then read:

| File                                      | Responsibility                                                        |
| ----------------------------------------- | --------------------------------------------------------------------- |
| `src/app.ts`                              | Connect user actions to the model, views, and audio.                  |
| `src/model.ts`                            | Selection, preview, and spelling rules, without browser dependencies. |
| `src/music.ts`                            | Cello tuning, board locations, pitch names, and finger positions.     |
| `src/notation.ts`                         | Convert between sounding pitch and written bass-clef notation.        |
| `src/view/layout.html`                    | Static HTML layout and German UI text.                                |
| `src/view/fingerboard.ts`, `positions.ts` | Note buttons and position brackets.                                   |
| `src/view/staff.ts`, `panels.ts`          | Shared staff drawing and panel interactions.                          |
| `src/view/geometry.ts`                    | Shared pixel geometry, passed to CSS as custom properties.            |
| `src/audio.ts`                            | On-demand sample loading, volume, and cancellation.                   |
| `src/style.css`                           | Styles grouped by component, with mobile and reduced-motion rules.    |

`MidiPitch` is a validated numeric type constructed with `midiPitch()`. Accidentals, string identifiers, positions, and variants have finite types. A selection is either a board selection with its origin or a written staff note. The sounding pitch is derived from that written note, rather than maintained as a separate mutable field. Hover previews never change the committed selection.

The code uses checked DOM lookups instead of non-null assertions. Button-to-note associations are stored directly, so event handlers do not need to parse untyped `data-*` attributes. SVG templates interpolate only application-owned musical data.

## Code quality

```sh
npm run check          # Formatting, type-aware linting, strict type checks, unit tests
npm run test:audio     # Audio bundle validation tests (Python 3)
npm run test:browser   # Fresh static build and Chromium integration tests
npm run format        # Apply the shared formatting rules
```

ESLint uses the [type-aware TypeScript rules](https://typescript-eslint.io/getting-started/typed-linting/); Prettier handles formatting. TypeScript also checks tests and configuration, with unchecked array access and exact optional properties enabled. `npm run typecheck` and `npm run lint` are available separately.

## Browser checks

With system Chromium or Chrome installed, run `npm run test:browser`. This builds the current source first so tests cannot accidentally exercise an old `dist/` directory. Set `CHROME_PATH` to use a different browser executable. On other platforms, install Playwright’s browser with `npx playwright install chromium`. The checks cover note spelling, delayed audio loading and reset, volume changes, overlays, keyboard activation, and a 375-pixel mobile viewport.

## Features

- Labelled “Einstellungen” and “Hilfe” controls in the header, with “Noten”, “Klaviatur”,
  and “Tonfolge” together in a single bottom tool bar. Settings are grouped into keyboard-accessible
  “Musik” (key, spelling, positions), “Griffbrett” (spacing, dimming, zoom), and “Klang”
  (volume, sequence tempo) tabs. Help contains “Gut zu wissen” and “Über CellOh!”.
- Four strings, C2 / G2 / D3 / A3, with open strings and 24 semitone steps each.
- German sharp/flat spelling, including H (B natural) and B (B flat), with consistent colors for matching notes across strings and octaves.
- Colored brackets and finger numbers for positions 1–4, with independently selectable lower/upper variants of positions 2 and 3 and finger-number circles beside each bracket.
- Optional backward first-finger extensions, shown with dashed brackets.
- Click, tap, or keyboard activation to play Ethan Winer cello samples; volume control.
- Responsive layout with a scrollable fingerboard and accessible note buttons.
- A compact, independently scrollable C2–A5 piano dock above the footer. The “Klaviatur”
  button shows/hides it without resizing notes or resetting fingerboard scrolling.
  Hidden initially on phones, shown on desktop; the choice is remembered locally.
  Natural keys are labelled in German, C keys show octaves, and the selected key
  shows its full name. Piano taps play the same cello recordings and share exact-pitch
  highlighting with the board and notation. Left/right arrows navigate keys; Enter/Space
  plays, Home/End move to the range limits. Selected off-screen keys are brought into
  view without interrupting an active pointer gesture or wheel scroll.
- Optional “Tonfolge” notation history above the piano (also usable with the piano hidden).
  Played notes from all three inputs appear as quarter notes, including repeated pitches;
  previews and settings changes do not add entries. It scrolls to new notes automatically,
  can be scrolled independently by touch or keyboard, and asks for confirmation before clearing.
  “Abspielen” replays the quarter notes with synchronized highlighting in the history, piano,
  fingerboard, and notation; playback never adds history entries. “Stopp”, a manual note,
  reset, or confirmed clearing cancels replay, including pending sample loads. Settings
  provide a 40–240 BPM quarter-note tempo (initially 120); changes apply to subsequent beats.
  History lasts for the current page session, including while hidden. The current key
  determines spelling and the bass-clef key signature; without a selected key it uses C major.
  Alterations and natural cancellations apply to the written pitch/octave until changed
  (there are no measures). Changing the key re-notates the existing pitches without changing
  their sound. Note size stays fixed; height grows only to fit the entered range and resets
  when cleared. Sharps, flats, and naturals use font-independent SVG shapes in all staff views.
- Note-icon panel with an interactive bass staff, quarter note, and ledger lines; hover previews, click or tap plays, and arrow keys / Enter work too.
- Exact-pitch matches are highlighted across all strings; a toolbar toggle enables or disables dimming of other pitches without clearing the selection. Reset clears the selection.
- Read-only bass-clef notation in the fingerboard’s upper-left corner always shows the selected pitch, including when the note panel is closed. It reserves a fixed C2–A5 range so the staff and note scale remain stable as ledger lines appear.
- The note and settings panels are mutually exclusive; the fingerboard remains usable while the note panel is open.

The staff picker covers C2–G4 (with sharp/flat modifiers). Higher pitches clicked on the board still display in bass clef with additional ledger lines. Accidental buttons lower, restore, or raise the same written staff note by a semitone, preserving its position and displaying ♭, ♮, or ♯ explicitly. The global spelling preference applies when selecting notes on the fingerboard; it is not changed by the accidental buttons. Bass-clef placement follows [Open Music Theory](https://viva.pressbooks.pub/openmusictheory/chapter/clefs/).

The hand model is closed fingering, with a semitone between adjacent fingers. Lower/upper first-finger offsets above the open string are: first position 2; second 3/4; third 5/6; fourth 7. A backward extension lowers only finger 1 by one semitone. This app shows pitch relationships, with equal visual spacing rather than realistic physical distances. Forward extensions and thumb-position fingerings are not included.

## Audio generation

The generated MP3 files and manifest in `public/audio/` are ignored by Git, along with the original soundfont and downloaded reference images. Download the published recordings before testing playback:

```sh
npm run audio:fetch
```

This downloads the release pinned in `audio-release.json`, checks the bundle against its published SHA-256, and validates all 46 recordings and the source soundfont recorded in the manifest. It needs Python 3, but no rendering tools or GitHub credentials for this public repository. A failed download or validation stops the command; it does not silently build without audio. The checksum is published alongside the bundle, rather than separately pinned in the repository, so release assets should never be replaced.

To generate them, install FluidSynth and ffmpeg, download [Ethan Winer's Cello Solo soundfont](https://ethanwiner.com/ewsf2.html), and extract the ZIP into `references/`:

```sh
sudo apt-get install fluidsynth ffmpeg
python3 scripts/render-audio.py references/cello_solo.sf2
```

The script renders 46 unique pitches at one consistent velocity, with a 1.6-second sustained note and a release tail, then encodes mono MP3 files. The manifest records source, soundfont checksum, and rendering settings. Recordings are fetched and decoded on demand, then cached for the session. Rapid selections discard outdated loading requests and fade out the previous note. Reset cancels pending and active playback, and playback uses the latest volume even if the recording was still loading when the volume changed.

Ethan Winer explicitly permits royalty-free use, including commercial projects, without attribution. See his [usage terms](https://ethanwiner.com/ewsf2.html). Attribution is retained in the app and audio manifest.

## References

[Cello Online's fingering chart](https://www.celloonline.com/cellofingeringchart.htm) was consulted for positions. Reference charts and the original soundfont are stored locally in the gitignored `references/` directory. Copyrighted charts are not included in the application or published build.

## Static deployment

For Cloudflare, use `npm run build:deploy` as the build command. It fetches the pinned audio release, runs the code checks, and builds the app. Deploy `dist/`. Use Node.js 22.13+ and Python 3 in the build environment. The first audio release must finish publishing before this build can succeed.

For another static host, run the same command and upload the contents of `dist/`. The relative asset base supports both domain-root hosting and subdirectories, such as `/celloh/`. Serve through HTTP(S), rather than opening `index.html` through `file://`. No backend, external font service, or runtime CDN is required.

### Cloudflare Workers

`wrangler.toml` contains the public configuration for an asset-only Worker named `celloh`. It serves `dist/`, enables the `workers.dev` address and preview URLs, and contains no account credentials. Wrangler is pinned in the development dependencies and lockfile.

Connect `thorbenk/celloh` to a Cloudflare Worker named `celloh`, then configure its Git build:

| Setting                       | Value                    |
| ----------------------------- | ------------------------ |
| Production branch             | `master`                 |
| Root directory                | Repository root          |
| Build command                 | `npm run build:deploy`   |
| Deploy command                | `npm run deploy`         |
| Non-production deploy command | `npm run deploy:preview` |
| Build variable `NODE_VERSION` | `22.22.1`                |

Cloudflare's [build settings](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/) manage the deployment API token and any private build variables. The app has no runtime secrets. `npm run deploy:preview` uploads a version with a preview URL without promoting it to production.

For local deployment, authenticate with `npx wrangler login`, or copy `.env.example` to the gitignored `.env` and provide `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`. Use a token scoped to the deployment account with Workers Scripts edit permission. Wrangler [loads these environment variables](https://developers.cloudflare.com/workers/wrangler/system-environment-variables/). The example contains placeholders; account IDs and tokens stay out of the public configuration. Vite variables prefixed with `VITE_` are exposed to the browser, so do not use that prefix for credentials.

```sh
npm run build:deploy
npm run deploy:check    # Validate/package locally without uploading
npm run deploy:preview # Upload a preview version
npm run deploy         # Publish to production
```

Deployment commands use the existing `dist/` directory; run the build first. `.wrangler/`, `.env` files, and `.dev.vars` files are ignored by Git. Only `dist/` is uploaded as public assets, so the credential template and repository configuration are not served with the app.

### Publishing audio releases

The **Publish cello audio** GitHub Actions workflow creates `audio-v1` on the first push of these files to `master`. It also supports **Actions → Publish cello audio → Run workflow**. It uses the repository's built-in `GITHUB_TOKEN` with `contents: write`; no additional secrets are needed.

The workflow downloads the original soundfont, checks both ZIP and soundfont SHA-256 values from `audio-release.json`, installs FluidSynth and ffmpeg, and renders the samples. It attaches `cello-audio-v1.tar.gz` and its `.sha256` file to the release, retaining the manifest inside the archive. The soundfont and reference charts are never attached or committed. Audio releases do not replace the repository's latest application release.

Existing releases are left unchanged. To publish different recordings, change the tag in `audio-release.json` to `audio-v2` (and update source checksums if needed), then push to `master`. The workflow publishes the new version and subsequent builds fetch it. Rendering-tool versions follow Ubuntu 24.04 packages; each released bundle is reused unchanged rather than regenerated for app deployments.

The app works in mobile browsers. Offline installation is a possible follow-up; this version requires connectivity to load the app and uncached recordings.

### Live pitch feedback (experimental)

Select a note on the existing fingerboard, piano, or notation picker, open **Intonation** from the bottom toolbar, then tap **Start Listening** and allow microphone access. Bow a single sustained note; the panel compares it with the selected target. **Zu tief** means move the stopping finger toward the bridge; **Zu hoch** means move it toward the scroll. The green state uses ±5 cents. Movement refers to the finger along the string. Open **Diagnose** to inspect raw/filtered Hz, cents, clarity, frame acceptance, and sample rate. Octave differences remain visible and show an octave warning.

Test on current iOS Safari and Android Chrome using an HTTPS deployment (plain LAN HTTP does not provide microphone access; localhost works on the device running the server). Test low C2, A3, notes slightly above/below the target, silence for at least 500 ms, and changing the selected target while listening. Try a quiet room and sustained bowing first. Check permission denial and retry, then **Stop Listening**, switching apps, and leaving the page: the browser microphone indicator should turn off. Start again to verify resources can be reopened. Also stop while the permission prompt is pending and confirm any subsequently granted stream immediately closes. Phone/cello testing is still required; synthetic tests cannot establish real bowed-instrument reliability or mobile compatibility.

The service in `src/pitch.ts` uses [Pitchy](https://github.com/ianprime0509/pitchy) and a reusable 4096-sample mono buffer at 40 ms intervals. Adjust `PITCH_CONFIG` for clarity (0.9), median window (5), logarithmic smoothing (150 ms), tolerance (5 cents), and silence timeout (500 ms). A -60 dB input floor rejects numerical pitch estimates from near-silence. Audio stays on the device and is not recorded. The panel is hidden by default. Closing it stops microphone capture. Toolbar labels disappear on narrow screens; the icons retain accessible names. Listening stops when the document is hidden; restart on return.
