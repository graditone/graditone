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
npm install

# Make sure the app is reachable (or let the runner start it):
#   (cd ../frontend && PLAYWRIGHT_TEST=1 npm run dev -- --port 5174)

node src/run.ts play-a-score      # one flow by id
node src/run.ts --all             # every flow
node src/run.ts --list            # list the catalogue
DEMO_HEADFUL=1 node src/run.ts    # watch it happen in a real window
DEMO_SKIP_DEMOCLIP=1 node src/run.ts play-a-score   # capture only
DEMO_DEBUG=1 node src/run.ts play-a-score           # step + audio timings
```

Outputs land in `demos/out/` (git-ignored): the muxed `<id>.webm`, the finished
`<id>.mp4` from DemoClip, and the raw takes in `out/raw/<id>/`.

The harness is written in TypeScript and **run directly by Node** (type
stripping — there is no build step). That needs **Node 22.18+** (or 23.6+). To
check the types: `npm run typecheck`.

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
