---
name: graditone-demo-videos
description: Use whenever creating, editing, running or reviewing a Graditone demo video (the Playwright capture pipeline under demos/). Covers environment setup, the flow YAML DSL, finding UI selectors, the dev-server port trap, running without a screen, and verifying the captured clip. To draft the flow quickly from a plain-language goal, use the derived-index authoring workflow (see the graditone-demo-authoring skill). Triggers on: demo video, demos/, flows/*.yaml, demo flow, Playwright capture, DemoClip, play-a-score, tempo demo, record a demo, add a demo, graditone demo, generate a demo flow.
---

# Making Graditone demo videos

A demo video is a **flow** (`demos/flows/<id>.yaml`) run by a generic Playwright
harness. The flow file is the deliverable; the video is a build artifact under
`demos/out/` (git-ignored). Read `demos/README.md` for what the pipeline is and
the full flow DSL — this skill is the runbook and the traps.

## Runbook

1. **Update** the worktree: `git fetch origin main` and merge if needed. There is
   no `upstream` remote in this repo — `origin` **is** `graditone/graditone`.
2. **Install**: `npm ci` in `demos/` **and** in `frontend/`. Both are needed
   (the harness is TypeScript run directly by Node; the app must be served).
   Node **22.18+**; need `ffmpeg` on `PATH`; Playwright browsers installed.
3. **Get the flow.** The fast path is to **draft it from a goal** with the
   authoring workflow — see the **`graditone-demo-authoring`** skill
   (`npm run catalog:build` → `npm run catalog:find` → `npm run flow:author`),
   which writes `demos/flows/<id>.yaml` from a described journey, grounded on the
   app's own annotations. To write one by hand, copy
   `demos/flows/01-play-a-score.yaml` as a template. Either way, keep the `NN-`
   filename prefix for ordering; the flow's `id` is what `node src/run.ts <id>`
   takes.
4. **Run**: `cd demos && node src/run.ts <id>` (or `--all`, `--list`).
5. **Verify** the clip before you call it done (see *Verifying*).
6. **Commit** the flow (and any harness/doc change). `demos/out/` is ignored.
   New flows get a PR; open it and link the session.

## Flow DSL, in one screen

`click` · `waitFor` · `waitForFunction` · `press` · `evaluate` · `goto`, plus
`caption` (→ a DemoClip text annotation) and `hold` (ms pause after the step). `click` extras:
`steps` (glide steps), `settle` (pre-press pause), **`pressMs`** (keep the
pointer down — for hold-to-repeat controls). See `demos/README.md` for the
canonical list; it is the source of truth for the DSL.

Timing that reads well: caption + `hold` at the start, let each action land,
then hold the final state long enough to be seen (~1.5–3 s). When changing
state (tempo, mode), hold **after** the change so the viewer sees the result.

## Resolving controls (do this before writing steps)

**Fast path — the derived index.** The app's demo-relevant controls are
annotated (correct role + accessible name + `data-testid`) and indexed, so query
that instead of grepping. This is the whole point of feature 102.

```bash
cd demos
npm run catalog:build                          # rebuild the index from the app's annotations
npm run catalog:find -- "raise the tempo"      # resolves (exit 0) or flags it (exit 1)
```

A phrase resolves **only** to a unique match; build the flow from those handles
(the `graditone-demo-authoring` skill shows the plan JSON + `flow:author` step,
which writes the YAML and prints a generation report). If a phrase comes back
**unresolved, the control needs annotating** — add role + accessible name +
`data-testid`, extend `annotation-contract.md` §2 and the coverage guard, and
rebuild — do **not** invent a selector.

**Manual fallback** (a control the index does not have yet). Do **not** guess;
grep the frontend for the real hooks:

- `[data-testid="…"]` — the most stable hook (e.g. `plugin-launch-play-score`,
  `tempo-plus`, `tempo-minus`, `tempo-display`).
- `[role="toolbar"] [aria-label="Play"]` — toolbar buttons carry i18n labels.
- The English label text lives in `frontend/src/i18n/locales/en.json`
  (`play_score.toolbar.play_aria` → `"Play"`). Use the rendered label.
- Existing end-to-end specs (`frontend/e2e/*.spec.ts`) show selectors that
  already work against the real app — copy their patterns.
- The plugin itself is under `frontend/plugins/<plugin>/`; the shared toolbar
  widgets under `frontend/src/components/`.

Prefer, in order: `data-testid` → `role`/`aria-label` → a class + `:has-text`.
Avoid nth-child and pixel coordinates.

## The dev-server port trap

`run.ts` starts `frontend`'s Vite dev server on **5174** only if the base URL is
*not* reachable — and `reachable()` treats **any HTTP status below 500 as up**.
So another worktree's server on 5174 answering `404` counts as "Graditone is
up", the runner skips starting ours, and the run dies at the **first selector**
with a timeout (looks like a bad selector; it is a wrong server).

- Symptom: `locator.waitFor: Timeout … waiting for locator('[data-testid="plugin-launch-play-score"]')` on step 1.
- Workaround: start the app yourself on a free port and point the runner at it:

  ```bash
  (cd frontend && PLAYWRIGHT_TEST=1 npm run dev -- --port 5175 --strictPort) &
  cd demos && DEMO_BASE_URL=http://localhost:5175 node src/run.ts <id>
  ```

  (`ensureServer` still hardcodes 5174, so only the manual-server path works for
  a non-default port.) Tracked as `demos-runner-port-detection` in `DEBT.md`.

## Env switches

| Var | Effect |
|-----|--------|
| `DEMO_BASE_URL` | App URL the runner drives (default `http://localhost:5174`). |
| `DEMO_HEADFUL=1` | Watch it in a real window (also used for DemoClip). |
| `DEMO_SKIP_DEMOCLIP=1` | Capture only — skip the title card/MP4 export. |
| `DEMO_DEBUG=1` | Print step timings and the audio timeline. |
| `DEMOCLIP_APP` | Path to a built DemoClip `dist/` (else `~/devel/democlip/dist`). |

## Verifying a capture

1. `DEMO_DEBUG=1` shows step marks; watch the log for `! no audio was captured`
   and for page errors.
2. The muxed video is `demos/out/<id>.webm` (`ffprobe` it); the raw takes are in
   `demos/out/raw/<id>/`. The finished MP4 is `demos/out/<id>.mp4`.
3. Inspect frames — the cheap way to confirm the state actually changed:

   ```bash
   ffmpeg -ss 12 -i demos/out/<id>.webm -frames:v 1 -vf "crop=440:90:1000:0,scale=1760:360:flags=neighbor" /tmp/f.png
   ```

   (crop to the toolbar/region that matters, upscale for small text like BPM).
4. Confirm the audio is real, not silent:

   ```bash
   ffmpeg -i demos/out/<id>.webm -af volumedetect -f null - 2>&1 | grep -E 'mean_volume|max_volume'
   ```

   **Audio capture needs a working output device.** If none is present the Web
   Audio clock freezes and the clip is silent (the runner warns). Check the
   system output device first — an asleep USB interface is the usual cause.

## DemoClip

Post-processing imports the muxed recording into a headless DemoClip, brands it
from the flow (`title`, `description`, `logo`, `titleCard`) and exports the MP4.
If no build is found the step is skipped with a note (capture still succeeds).
Brand a clip entirely from the flow — do not edit the video by hand.

**Captions live in DemoClip.** The runner does not draw captions into the page
(they would be burned in and uneditable); instead each step's `caption` becomes a
DemoClip **text annotation** over that step's stretch, derived from the recorded
step marks. So the raw `.webm` has no captions and the exported `.mp4` does — and
the author can move/reword/restyle them in DemoClip afterwards. The pipeline
places them bottom-centre in white; `flow.democlip.annotations` still carries any
extra arrows/sounds/text the flow declares.

The run also writes an **editable pair** in `out/edit/`: the clip with its
annotations **carried** in a `.democlip.json` sidecar beside a caption-free video.
Bring that video back into DemoClip (its `import_take` reads the sidecar) to
reopen the captions and the watermark over the stretches they belong to. Set
`DEMO_NO_EDITABLE=1` to skip it.

## Flow review checklist

- Reads as a tutorial: caption per step, no dead air, final state held.
- Selectors from the conventions above; no coordinates.
- Uses real UI gestures, including `pressMs` where the control repeats on hold.
- The `title`/`description` match what the video shows.
- Ran clean (no page errors, audio present) and the frames confirm the change.
- `demos/README.md` still matches the DSL if you added an attribute or action.
- If the flow was generated: its report showed no unresolved steps (or each was
  closed), and `demos/plans/<id>.json` captures the goal for exact regeneration
  (`npm run flow:author -- plans/<id>.json`).
