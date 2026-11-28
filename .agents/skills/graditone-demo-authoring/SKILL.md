---
name: graditone-demo-authoring
description: Use when turning a plain-language goal into a Graditone demo flow file (demos/flows/<id>.yaml) quickly. Covers building the derived element index from the app's annotations, resolving each step's phrase with catalog:find, assembling the flow + generation report with flow:author, and handing off to the capture runbook. Triggers on: author a demo, generate a demo flow, demo flow from a goal, catalog:find, catalog:build, flow:author, element index, demo authoring, add a demo flow, write a flow yaml.
---

# Authoring a Graditone demo flow from a goal

The demo agent turns a plain-language goal into a runnable flow file **without
recording a video**. Capture stays a separate, slower command (see the
`graditone-demo-videos` skill). The work is grounded on the app's own
annotations, so a step resolves only to a real control — or is flagged, never
guessed (see `specs/102-demo-flow-generation/`).

## The loop

1. **Build the index** (once per session; fast, needs no running app):

   ```bash
   cd demos && npm run catalog:build
   ```

   It scans the demo-relevant components, `frontend/e2e/*.spec.ts` and the
   existing `demos/flows/*.yaml`, and writes `demos/catalog/elements.json`
   (generated; git-ignored).

2. **Resolve each phrase** with the lookup, one phrase at a time:

   ```bash
   npm run catalog:find -- "raise the tempo"      # resolved → exit 0
   npm run catalog:find -- "press play"           # ambiguous → exit 1 + candidates
   npm run catalog:find -- "press play" --screen play-score
   ```

   A phrase resolves **only** when exactly one control matches after any
   `--screen` filter. If it is ambiguous or missing, do **not** invent a
   selector: either narrow it with `--screen`, or leave that step out and let
   the report flag it.

3. **Write a plan** (JSON): the goal plus the ordered steps. Each step gives its
   `phrase` (resolved from the index) or an explicit `selector` when no
   annotation exists yet, plus the presentation the video needs (`caption`,
   `hold`, `pressMs`) and any `waitForContent` that must precede it.

   ```json
   {
     "goal": { "text": "Open Play Score and slow the music down", "id": "play-score-slow-down" },
     "steps": [
       { "phrase": "open play score", "action": "click", "caption": "Open the Play Score plugin.", "hold": 700 },
       { "selector": "[role=\"toolbar\"]", "action": "waitFor",
         "waitForContent": { "script": "document.querySelectorAll('svg line, svg path').length > 40" } },
       { "phrase": "slow down", "action": "click", "caption": "Hold − to slow the playback.", "pressMs": 2500, "hold": 3000 }
     ]
   }
   ```

4. **Assemble** the flow and the report:

   ```bash
   npm run flow:author -- plans/play-score-slow-down.json
   ```

   It writes `demos/flows/<id>.yaml`, prints the Generation Report (time,
   resolved/unresolved, targets, gaps), and never starts a capture. A step whose
   phrase does not resolve is left out and listed under `unresolved`.

5. **Review, then hand off.** If every step resolved, the flow runs as-is. If the
   report lists gaps, either annotate the control (add role + accessible name +
   `data-testid`, then `catalog:build` again) or add an explicit `selector` to
   that step. When happy, capture with the `graditone-demo-videos` runbook:

   ```bash
   cd demos && node src/run.ts <id>
   ```

## Rules of thumb

- **Prefer `data-testid`.** It is the primary, diff-stable handle; role+name is
  the fallback. Use `--screen` to disambiguate duplicate labels (for example
  "Play" on several surfaces).
- **Resolved or flagged, never guessed.** An unresolved step is useful
  information; a wrong selector costs a full capture.
- **The flow format is fixed.** Emit only the existing step vocabulary and
  attributes (`demos/src/types.ts`); never edit the runner or the video pipeline.
- **Caption and hold matter.** Every action a viewer should notice needs a
  `caption`, and a state change (playback, tempo) needs a `hold` long enough to
  see it. Insert a `waitForContent` before acting on anything the score engine
  produces asynchronously.

## Where things live

| Piece | Path |
|-------|------|
| Index builder / lookup | `demos/src/catalog/` |
| Flow assembly / report | `demos/src/generate/` |
| CLIs | `demos/src/tools/{build-index,find-element,author-flow}.ts` |
| Contracts | `specs/102-demo-flow-generation/contracts/` |
| Capture runbook | `.agents/skills/graditone-demo-videos/SKILL.md` |
