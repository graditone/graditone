# Quickstart: Free Mode Measure Detection — Validation Guide

**Feature**: 094 — Free Mode Measure Detection
**Date**: 2026-08-30
**Precondition**: Run via `/speckit.tasks` then implement. This guide validates the feature end-to-end **after** implementation.

## Prerequisites

- Worktree repo with `frontend/` (React + Vitest).
- Dependency install completed: `npm install` (or pnpm/yarn per repo convention).
- No external services: feature is local/PWA (Principle III).

## Automated validation (primary — must pass before manual testing)

Run the unit suite (RED-first regression included):

```bash
# From repository root
npx vitest run frontend/plugins/practice-view-plugin/freePractice.helpers.test.ts
npx vitest run frontend/plugins/practice-view-plugin/useFreePractice.test.ts
```

The regression test for **Issue #1** MUST be present, written RED (fails on the
current implementation before the fix, passes after), and remain green permanently.
See [known-issue #1](../spec.md) and task TASK-DET-001.

Feature-specific assertions covered by the suite:

| SC | Assertion |
|----|-----------|
| SC-001 | 8 on-beat quarter notes → 2 complete measures × 4 quarter notes; 8 notes; 0 rests; sums = 4 beats each |
| SC-002 | Any N-beat-aligned performance → every measure but a possible trailing one complete |
| SC-003 | Continuous legato input (gaps < 1 beat) → zero rests; genuine ≥ 1-beat silence → one rest of correct value |
| SC-004 | Same input at 20, 60, 120, 240, 300 BPM → identical measure structure |
| SC-006 | Same input with ±25%-of-beat attack jitter and short/long holds → still 2 complete 4×1/4 measures |
| SC-007 | Same performance, metronome on vs off → identical detection (metronome is never a timing source) |
| SC-008 | 16th-note run detected as 1/16; no value finer than 1/16 anywhere |

## Manual end-to-end validation (PWA/tablet)

### Scenario A — reported bug, target case (SC-001/SC-006/SC-007)

1. Start the dev app (repo's dev command, e.g. `npm run dev`).
2. Open Practice plugin → score selection dialog → **Free Practice**.
3. Set/index tempo to a clean 4/4 (e.g., 80 BPM). Turn the metronome **on**.
4. Play **8 quarter notes on the piano**, each attacked on a tick and held until the next tick (equal to one tick each).
5. Stop.
6. **Expected**: staff shows **two complete measures**, each with **4 quarter notes** — no 1/8/1/16 splits, no rests, 8 notes total.

7. Repeat the same 8 notes with the metronome **off** (play steady 1-per-second notes). **Expected**: identical measure structure (SC-007).

### Scenario B — general beat-aligned input (SC-002/SC-003/SC-008)

8. Play 2 measures: two half notes, then four quarter notes. **Expected**: 2 complete measures; halves as halves, quarters as quarters; no rests.
9. Play a 1/16 run over one measure. **Expected**: all 1/16 values, measure complete (SC-008).
10. Play a measure then **stay silent for one full beat** then play 3 quarters. **Expected**: one rest of 1/4 value at the silence; measure completes to 4 beats (SC-003).

### Scenario C — imperfect timing (SC-006)

11. Repeat Scenario A with deliberately sloppy timing (attacks ~50–150 ms off-grid, holds slightly short/long). **Expected**: still 2 complete 4×1/4 measures with no artifacts.

### Scenario D — honest partial measure (FR-006) and boundary carry (FR-009)

12. Play 5 quarter notes and stop mid-measure. **Expected**: measure 1 complete (4×1/4), measure 2 partial (1×1/4) — not auto-filled with rests.
13. Play a whole note spanning a bar line (hold 4 beats starting on beat 3). **Expected**: note placed in its attacking measure, full length carried across the bar line, no spurious 1/16 rest.

## References

- Domain/function contracts: [contracts/free-mode-detection.md](./contracts/free-mode-detection.md)
- Derived data model: [data-model.md](./data-model.md)
- Requirements/success criteria: [spec.md](./spec.md) (FR-001…FR-013, SC-001…SC-008)
- Known defect & regression guard: [spec.md → Issue #1](../spec.md#known-issues--regression-tests-if-applicable)
## Validation Notes

- **Automated portion (SC-001…SC-008)**: PASSED on 2026-08-30 via `npx vitest run frontend/plugins/practice-view-plugin/` — 282 tests green, including the Issue #1 regression guard (see `freePractice.helpers.test.ts`).
- **Manual tablet/PWA scenarios A–D (T036)**: NOT executed in this environment — requires a tablet device with MIDI input. Pending user verification per quickstart above.
