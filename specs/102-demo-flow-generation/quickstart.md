# Quickstart: Rapid Demo Flow Generation from a Goal

**Feature**: `102-demo-flow-generation`  
**Branch**: `102-demo-flow-generation`

This quickstart validates the feature after implementation: the derived index, the lookup tool, the agent-driven generation workflow, the annotation guard, and the representative goal set that SC-001/SC-002 are measured against. It is a run/validation guide; implementation detail lives in `tasks.md`.

---

## Prerequisites

- **Node 22.18+** (or 23.6+). Both the `demos/` harness and the `frontend/` app are needed.
- Install dependencies: `cd demos && npm ci` and `cd frontend && npm ci`.
- **ffmpeg** on `PATH` (only needed for the video step, not for generation).
- A **DemoClip** build at `~/devel/democlip/dist` or `DEMOCLIP_APP`, or capture only with `DEMO_SKIP_DEMOCLIP=1`.
- A working **audio output device** if you capture video (a frozen Web Audio clock makes a silent clip).

> **Dev-server port trap** (known debt `demos-runner-port-detection`): `demos/src/run.ts` treats any response below HTTP 500 as "the app is up", so another worktree's server on 5174 can make it skip Graditone. For the video step, start the app yourself and point the runner at it:
>
> ```bash
> (cd frontend && PLAYWRIGHT_TEST=1 npm run dev -- --port 5175 --strictPort) &
> cd demos && DEMO_BASE_URL=http://localhost:5175 node src/run.ts <id>
> ```

---

## Steps

### 1. Build the derived index

```bash
cd demos
npm run catalog:build        # scans frontend annotations + e2e specs → catalog/elements.json
```

Expected: `catalog/elements.json` is written with `entries` covering the demo-relevant controls; `sources.annotation` is non-zero. Re-running on unchanged sources produces byte-identical output (stable sort).

### 2. Resolve a phrase (the lookup)

```bash
npm run catalog:find -- "raise the tempo"
# → {"phrase":"raise the tempo","resolved":true,"entry":{"id":"play-score/tempo-plus",...},...}
# exit code 0

npm run catalog:find -- "press play"
# → {"resolved":false,"reason":"ambiguous","candidates":[{"screen":"play-score",...},{"screen":"train",...}]}
# exit code 1
```

Expected: an unambiguous phrase resolves and exits 0; an ambiguous phrase is flagged with candidates and exits 1 — it never auto-resolves (FR-006).

### 3. Generate a flow (the documented workflow)

Follow `.agents/skills/graditone-demo-authoring`: state the goal, resolve each step with `catalog:find`, order the steps with the waits/captions/holds the video needs, then write `demos/flows/<id>.yaml` and emit the Generation Report.

Goal example (resolved journey): *"Open Play Score, choose Für Elise, start playback, then raise the tempo while it plays."*

Expected: a new `demos/flows/<id>.yaml` with an id that does not collide with an existing flow, a title/description matching the goal, and steps using only the existing vocabulary; a report showing `resolved` targets and `unresolved` flagged steps; `elapsedMs` under 10000 for the representative set (SC-001).

Goal example (unresolved step): *"Open the settings tab and turn on dark mode."*

Expected: the flow is still produced for the parts that resolve, the settings step is listed under `unresolved` with a reason and candidates, and `gaps` names the missing annotation — no guessed selector is written (SC-003).

### 4. Validate the emitted flow without capturing

```bash
cd demos && npm run typecheck           # harness types, including the new modules
node -e "import('./src/run.ts')" -- --list   # the new flow appears in the catalogue
```

Expected: the new flow parses as a `Flow` and lists; the existing flows still list (SC-007).

### 5. Produce the video (the existing, slower command)

```bash
cd demos && DEMO_BASE_URL=http://localhost:5175 node src/run.ts <id>
```

Expected: the video is produced exactly as for a hand-written flow, with no extra manual step (US3 acceptance 3, SC-006 for fully-resolved goals).

### 6. Run the guards

```bash
cd frontend
npm run lint                            # includes scripts/check-demo-annotations.mjs
npx playwright test e2e/annotation-coverage.spec.ts
npm test -- --run                       # vitest units incl. i18n parity
```

Expected: the annotation guard passes for every demo-relevant control; removing a control's `data-testid` or accessible name makes it fail (FR-017, SC-009).

### 7. Run the new units

```bash
cd demos && npm run typecheck
# vitest is a frontend dependency; the demos units run via the harness's test runner as wired in tasks.md
```

Expected: index builder, lookup, flow assembly, and report tests pass (Phases A–C).

---

## Representative goal set (SC-001 / SC-002)

| # | Goal | Plan | Kind |
|---|------|------|------|
| 1 | `play-a-score` (existing) | `flows/01-play-a-score.yaml` | resolved, baseline |
| 2 | `play-a-score-tempo` (existing) | `flows/02-play-a-score-tempo.yaml` | resolved, baseline |
| 3 | Open Play Score, choose Für Elise and slow the music down | `plans/play-score-slow-down.json` | resolved journey |
| 4 | Open Train View, start a session and wait for the on-screen keyboard | `plans/train-a-session.json` | wait-heavy journey |
| 5 | Open Play Score and open the display settings to enable dark mode | `plans/settings-dark-mode.json` | one unresolved step |
| 6 | Open Play Score, show the phrases, select the 3rd phrase and reproduce it | `plans/play-score-third-phrase.json` | resolved, list-then-select |

The three new goals are asserted automatically by `demos/src/generate/representative.test.ts` (`npm test` in `demos/`), which builds the index from the app and checks each plan's expected resolved/unresolved counts, the inserted content wait, and that unresolved steps produce gaps rather than selectors.

**Acceptance**: for this set, a complete draft is produced in under ten seconds in ≥90% of runs (SC-001), and fully-resolved drafts run end-to-end with zero first-attempt selector failures in ≥90% of runs (SC-002).

---

## Expected outcomes → success criteria

| Check | Criterion |
|-------|-----------|
| Generation time under 10 s for the set | SC-001 |
| Fully-resolved flows capture first try | SC-002 |
| Every unresolved step flagged with reason + candidates | SC-003 |
| Index resolves ≥95% of demo-relevant controls | SC-005 |
| Existing flows still run; pipeline unchanged | SC-007 |
| Report alone tells resolved/unresolved and targets | SC-008 |
| Guard fails on a removed annotation | SC-009 |
