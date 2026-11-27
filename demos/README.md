# Graditone demos

Turn a **described user flow** into a demo video, automatically, with Playwright.

A flow is data (`flows/*.yaml`): the steps, the selectors, the captions and a
title/description. A generic runner drives Graditone through the flow, records
video and (real) audio, and hands the result to **DemoClip** for its title card,
logo and export. The same flow file that produces the video also *is* the
description of the flow — a catalogue can be generated from the same source.

```
flow (YAML) ─▶ Playwright runner ─▶ video.webm + audio.webm
                                     │
                                     ├─ ffmpeg: mux + align + normalise ─▶ <flow>.webm
                                     └─ DemoClip (headless)  ────────────▶ <flow>.mp4
```

## Run it

```bash
cd demos
npm ci
(cd ../frontend && npm ci)        # the runner serves this app

# Let the runner start the app, or start it yourself:
#   (cd ../frontend && PLAYWRIGHT_TEST=1 npm run dev -- --port 5174)

node src/run.ts play-a-score      # one flow by id
node src/run.ts --all             # every flow
node src/run.ts --list            # list the catalogue
DEMO_HEADFUL=1 node src/run.ts    # watch it happen in a real window
DEMO_SKIP_DEMOCLIP=1 node src/run.ts play-a-score   # capture only
DEMO_DEBUG=1 node src/run.ts play-a-score           # step + audio timings
```

Outputs land in `demos/out/` (git-ignored): the muxed `<id>.webm`, the finished
`<id>.mp4` from DemoClip, and the raw takes in `out/raw/<id>/`. The flow YAML is
the artifact to commit — `out/` never is.

### Prerequisites

- **Node 22.18+** (or 23.6+). The harness is TypeScript run directly by Node
  (type stripping — no build step).
- `npm ci` in **`demos/` and `frontend/`** — the runner serves the app from
  `frontend/`. `npm run typecheck` checks the harness types.
- **ffmpeg** on `PATH` (audio mux, loudness normalisation).
- A **working audio output device** — Chromium's Web Audio clock drives the
  recording; without one the clip is silent (see *The audio*).
- A **DemoClip** build for the title card and MP4 export, at
  `~/devel/democlip/dist` or `DEMOCLIP_APP`. Without it the capture still runs;
  the export step is skipped with a note.

Agent sessions: load the **`graditone-demo-videos`** skill for the runbook and
traps (selectors, the port collision, verification).

## Writing a flow

```yaml
id: play-a-score
title: Play a Score              # → the clip's title card
description: >                   # → the clip's description
  Open the Play Score plugin, pick a piece and listen.
viewport: { width: 1440, height: 900 }

steps:
  - caption: "Graditone opens on a shelf of plugins."   # caption bar in the video
    hold: 1200                                            # pause after the step (ms)
  - action: click
    selector: '[data-testid="plugin-launch-play-score"]'
  - action: waitFor
    selector: '.score-selector-item__btn'
  - action: waitForFunction
    script: "document.querySelectorAll('svg line').length > 40"
    timeout: 30000
  - action: click
    selector: '[role="toolbar"] [aria-label="Play"]'
    hold: 14000
```

Steps: `click`, `waitFor`, `waitForFunction`, `press`, `evaluate`, `goto`, and
`caption`/`hold` modifiers. Clicks glide the (injected) pointer and ripple, so a
tap reads on video. `pressMs` keeps the pointer down before release, for controls
that repeat while held — the tempo ± buttons step by 5 BPM after a second.

## Pieces

| File | What it is |
|------|------------|
| `src/types.ts` | the flow / capture / path types, and the page globals |
| `src/run.ts` | CLI: pick flows, ensure the app is served, orchestrate |
| `src/runner.ts` | the generic Playwright driver (no flow-specific code) |
| `src/pageChrome.ts` | injected pointer + click ripple + caption bar |
| `src/audioCapture.ts` | injects an AudioContext tap recorded with `MediaRecorder` |
| `src/postprocess.ts` | ffmpeg: align the audio, mux, normalise loudness |
| `src/democlip.ts` | drives DemoClip headlessly over its `window.democlip` surface |

## The audio

`recordVideo` records **no audio**, so the runner also records the page's own
audio. Graditone plays through the Web Audio API, so we tap the graph: whenever
a node connects to its `AudioContext`'s destination we tee it into a
`MediaStreamAudioDestinationNode` and record that with `MediaRecorder`. The
result is a normal Opus track, muxed back in and aligned to the video using wall
clock marks taken in the page (the video's start, and the first moment the tap
carried sound — see `audioDelayMs`).

**The capture needs a working audio output device.** Chromium drives the Web
Audio clock from the audio device; if none is available the clock freezes at
~0 s, nothing is processed, and the tap records nothing. On macOS a USB audio
interface that is unplugged or asleep is enough to cause this — `afplay`/`say`
fail the same way. The runner says so and still produces a silent video. If the
audio is silent, check the system output device first.

## Troubleshooting

| Symptom | Likely cause and fix |
|---------|----------------------|
| The run dies at the **first** step, `waiting for locator('[data-testid="plugin-launch-play-score"]')` | The runner found *something* on port 5174 — any HTTP status below 500 counts as "the app is up" — usually another worktree's Vite server answering 404, so it never started Graditone. Free the port, or start the app yourself on a free port and set `DEMO_BASE_URL` (see the `graditone-demo-videos` skill for the exact commands). |
| The clip is **silent** | No working audio output device; Chromium freezes the Web Audio clock. Check the system output device (an asleep USB interface is the usual cause) — see *The audio*. |
| `DemoClip: no build found … skipping` | No DemoClip `dist/`. Set `DEMOCLIP_APP=/path/to/dist`, or capture only with `DEMO_SKIP_DEMOCLIP=1`. |
| A selector is not found | Confirm the hook in `frontend/` — `[data-testid=…]`, `[role="toolbar"] [aria-label=…]` (labels in `frontend/src/i18n/locales/en.json`), or an existing `frontend/e2e/*.spec.ts`. |

## DemoClip

[DemoClip](https://github.com/acs/democlip) is a browser studio whose own MCP
server drives it through `window.democlip` (enabled with `?agent=1`). This runner
uses the same surface, headless: it imports the recording through the app's own
file input, sets the **Graditone** logo, the title card and the flow's
title/description, then exports an MP4. A build is found via `DEMOCLIP_APP`, or
at `~/devel/democlip/dist`. Importing needs no screen picker, so the whole step
is scriptable in CI.

A flow may also carry DemoClip annotations:

```yaml
democlip:
  logo: graditone
  titleCard: true
  annotations:
    - kind: arrow
      span: { s: 0.1, e: 0.3 }
      from: { x: 0.3, y: 0.5 }
      to: { x: 0.6, y: 0.5 }
```
