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
node src/run.ts --handoff play-a-score   # capture + a plan for the DemoClip MCP
DEMO_HEADFUL=1 node src/run.ts    # watch it happen in a real window
DEMO_SKIP_DEMOCLIP=1 node src/run.ts play-a-score   # capture only
DEMO_DEBUG=1 node src/run.ts play-a-score           # step + audio timings
```

Outputs land in `demos/out/` (git-ignored): the muxed `<id>.webm`, the finished
`<id>.mp4` from DemoClip, the **editable pair** in `out/edit/` (the same clip,
caption-free, with a `.democlip.json` sidecar holding its annotations), and the
raw takes in `out/raw/<id>/`. The flow YAML is the artifact to commit — `out/`
never is.

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
  - caption: "Graditone opens on a shelf of plugins."   # → a DemoClip annotation (editable there)
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

Captions are **not** drawn into the recording: each `caption` becomes a DemoClip
**text annotation** over its step's stretch (bottom-centre, white), so the author
can move, reword or restyle it in DemoClip. The capture itself stays annotation-
free; only the exported clip carries them.

## Authoring a flow from a goal

A flow can be drafted from a plain-language goal instead of by hand. The app's
demo-relevant controls are annotated (a correct role + accessible name +
`data-testid`); a **derived index** of them is generated and queried, so a step
resolves to a real control or is flagged — never a guessed selector. Authoring
is fast and records no video.

```bash
cd demos
npm run catalog:build                       # scan the app's annotations → catalog/elements.json
npm run catalog:find -- "raise the tempo"   # resolve one phrase (exit 0) or flag it (exit 1)
npm run flow:author -- ../plan.json         # goal + steps → flows/<id>.yaml + a generation report
```

`catalog/elements.json` is generated and git-ignored; rebuild it after the app's
annotations change. See the **`graditone-demo-authoring`** skill for the full
workflow — the plan format, the `--screen` filter, and how unresolved steps
become gaps to close.

## Pieces

| File | What it is |
|------|------------|
| `src/types.ts` | the flow / capture / path types, and the page globals |
| `src/run.ts` | CLI: pick flows, ensure the app is served, orchestrate |
| `src/runner.ts` | the generic Playwright driver (no flow-specific code) |
| `src/pageChrome.ts` | injected pointer + click ripple (captions are DemoClip annotations, not drawn here) |
| `src/audioCapture.ts` | injects an AudioContext tap recorded with `MediaRecorder` |
| `src/postprocess.ts` | ffmpeg: align the audio, mux, normalise loudness |
| `src/democlip.ts` | drives DemoClip headlessly over its `window.democlip` surface |
| `src/handoff.ts` | the capture-only plan (`<id>.democlip-plan.json`) the DemoClip MCP applies |

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
uses the same surface: it imports the recording through the app's own file input,
sets the **Graditone** logo, the title card and the flow's title/description, then
exports an MP4. A build is found via `DEMOCLIP_APP`, or at `~/devel/democlip/dist`.
Importing needs no screen picker, so the whole step is scriptable in CI.

The runner serves DemoClip on a **fixed port** (`DEMOCLIP_PORT`, default `57364`)
and **reuses** a DemoClip already answering there — the DemoClip MCP's own server,
most often — so the harness and the MCP share one origin. It then drives a
**persistent** browser profile, kept in one place per user and keyed by **host
name** (`~/.democlip/browser/127.0.0.1`; override with `DEMOCLIP_PROFILE`).
DemoClip keeps its projects, profiles and recordings in the browser, and browser
storage is keyed by the whole origin — scheme, host *and port* — so the fixed port
is what keeps that storage from moving between runs: all the demo work on a host is
**one tenant**, and past demos stay openable. That profile is **persistent** — it
is kept when the browser closes, so a clip is there to evolve later; only
Playwright's *download* artifacts (the GUID temp files behind the download
dialog) are temporary. The browser is **headful by default** so the edits can be
watched; `DEMOCLIP_HEADLESS=1` hides it.

This is the **automated** path — right for CI and `--all`, where the clip is only
ever a build artifact. To instead leave the clip open for a person to evolve by
hand, hand the demo to the DemoClip **MCP** — see *Finishing a clip in the MCP
window* below.

The export runs twice. The first is the finished `<id>.mp4`, with the captions and
watermark **drawn** into the picture — the clip to send out. The second writes the
**editable pair** into `out/edit/`: the same clip with its annotations **carried**
in a `<id>.democlip.json` sidecar beside a caption-free `<id>.mp4`. Bring the video
back into DemoClip (its `import_take` reads the sidecar) and the captions are put
back over the stretches they belong to, so you can move, reword or restyle them.
Set `DEMO_NO_EDITABLE=1` to write only the finished clip.

A flow may also say how the clip is branded, and carry DemoClip annotations. The
mark is Graditone's and the **captions are made in Graditone's orange** unless a flow
names another; `democlip.annotationColour` is the one that overrides it:

```yaml
democlip:
  logo: graditone                  # the mark the clip wears (Graditone by default)
  titleCard: true                  # the card at the head of the file (on by default)
  annotationColour: '#ff6c23'      # the captions' colour (this orange by default)
  actionCues: true                 # an arrow at each action, and a sound as it lands
  annotations:
    - kind: arrow
      span: { s: 0.1, e: 0.3 }
      from: { x: 0.3, y: 0.5 }
      to: { x: 0.6, y: 0.5 }
```

`actionCues` marks every action the flow takes (a `click`, or a `press`): an **arrow**
pointing at the control it lands on — above the control, or below when the control sits near
the top so the arrow stays on the picture — and a **`thud`** the moment it lands, so a press
reads on the video. The runner takes both from the recorded step marks (the control's
position and the press's instant), so nothing is written per step; set it and every action is
cued. The arrows and sounds are ordinary DemoClip annotations, applied with the captions —
move, restyle or drop them in the window.

### Finishing a clip in the MCP window

The export above runs DemoClip in a browser the runner owns and **closes when it
is done** — a clip becomes a file and nothing more. To keep the demo somewhere a
person can go on editing it, hand off to the [DemoClip **MCP**](https://github.com/acs/democlip)
instead: its server opens a window the person can see, on the same fixed origin,
and **leaves it open** — so the clip is there to move, reword or restyle by hand
afterwards.

Capture only, with a plan for the MCP to apply:

```bash
cd demos
node src/run.ts --handoff play-a-score
```

That stops at `out/play-a-score.webm` (the muxed recording) and writes
`out/play-a-score.democlip-plan.json` — the flow's `title`, `description`, `logo`,
title-card flag and caption colour, plus every caption with the stretch it belongs
over, already worked out by `src/handoff.ts`. No video is recorded into DemoClip.

An agent then drives the MCP, and the person watches it happen:

1. `import_take` the muxed `.webm` (an absolute path).
2. `set_clip_property` `title`, `description`, `logo` and `addToExport` from the
   plan — and `annotationColour` **before** `annotate`, so the captions inherit it
   (changing it recolours nothing already placed).
3. `annotate("text", { span, text, y: 0.82, height: 0.05 })` for each
   `plan.captions` entry, then any `plan.annotations`.
4. `export_clip("mp4")` — the file lands in `demos/out/` (this repo's
   `.opencode/opencode.jsonc` points the MCP's `DEMOCLIP_DOWNLOAD_DIR` there), and
   is renamed to `<id>.mp4`. Open it from there: the DemoClip browser's *download
   history* lists Playwright's no-extension GUID temp files, which do not open
   (`demo-mcp-download-artifacts` in `DEBT.md`).

`DEMO_HANDOFF=1` is the same as `--handoff`. `DEMO_SKIP_DEMOCLIP=1` also stops at
the recording but writes no plan — use it when there is no MCP to hand off to.

The MCP keeps **one clip per session** and `import_take` **appends**, so start
from a clean one: check `describe_clip` first, and restart the project's MCP
server if a previous demo is still in front (tracked as `demo-mcp-clip-session`
in `DEBT.md`).

The MCP drives a **persistent** profile keyed by host, so a host is one tenant it
shares with the harness and past clips stay openable; its window lives as long as
the agent session, and the profile outlives it. This is the demo workflow the
**`graditone-demo-videos`** skill walks through.
