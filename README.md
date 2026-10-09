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
npm run test:browser   # Fresh static build and Chromium integration tests
npm run format        # Apply the shared formatting rules
```

ESLint uses the [type-aware TypeScript rules](https://typescript-eslint.io/getting-started/typed-linting/); Prettier handles formatting. TypeScript also checks tests and configuration, with unchecked array access and exact optional properties enabled. `npm run typecheck` and `npm run lint` are available separately.

## Browser checks

With system Chromium or Chrome installed, run `npm run test:browser`. This builds the current source first so tests cannot accidentally exercise an old `dist/` directory. Set `CHROME_PATH` to use a different browser executable. On other platforms, install Playwright’s browser with `npx playwright install chromium`. The checks cover note spelling, delayed audio loading and reset, volume changes, overlays, keyboard activation, and a 375-pixel mobile viewport.

## Features

- Four strings, C2 / G2 / D3 / A3, with open strings and 24 semitone steps each.
- German sharp/flat spelling, including H (B natural) and B (B flat), with consistent colors for matching notes across strings and octaves.
- Colored brackets and finger numbers for positions 1–4, with independently selectable lower/upper variants of positions 2 and 3 and finger-number circles beside each bracket.
- Optional backward first-finger extensions, shown with dashed brackets.
- Click, tap, or keyboard activation to play Ethan Winer cello samples; volume control.
- Responsive layout with a scrollable fingerboard and accessible note buttons.
- Note-icon panel with an interactive bass staff, quarter note, and ledger lines; hover previews, click or tap plays, and arrow keys / Enter work too.
- Exact-pitch matches are highlighted across all strings; a toolbar toggle enables or disables dimming of other pitches without clearing the selection. Reset clears the selection.
- Read-only bass-clef notation in the fingerboard’s upper-left corner always shows the selected pitch, including when the note panel is closed. It reserves a fixed C2–A5 range so the staff and note scale remain stable as ledger lines appear.
- The note and settings panels are mutually exclusive; the fingerboard remains usable while the note panel is open.

The staff picker covers C2–G4 (with sharp/flat modifiers). Higher pitches clicked on the board still display in bass clef with additional ledger lines. Accidental buttons lower, restore, or raise the same written staff note by a semitone, preserving its position and displaying ♭, ♮, or ♯ explicitly. The global spelling preference applies when selecting notes on the fingerboard; it is not changed by the accidental buttons. Bass-clef placement follows [Open Music Theory](https://viva.pressbooks.pub/openmusictheory/chapter/clefs/).

The hand model is closed fingering, with a semitone between adjacent fingers. Lower/upper first-finger offsets above the open string are: first position 2; second 3/4; third 5/6; fourth 7. A backward extension lowers only finger 1 by one semitone. This app shows pitch relationships, with equal visual spacing rather than realistic physical distances. Forward extensions and thumb-position fingerings are not included.

## Audio generation

The generated MP3 files and manifest in `public/audio/` are ignored by Git, along with the original soundfont and downloaded reference images. Generate the recordings locally before testing playback or building a deployment with sound. The app can run without them, but note playback will report a loading error.

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

Generate the audio first (see above), then run `npm run build` and upload the contents of `dist/` to any static web host. The relative asset base supports both domain-root hosting and subdirectories, such as `/celloh/`. Serve through HTTP(S), rather than opening `index.html` through `file://`. No backend, external font service, or runtime CDN is required.

The app works in mobile browsers. Offline installation is a possible follow-up; this version requires connectivity to load the app and uncached recordings.
