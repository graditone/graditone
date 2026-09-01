# Quickstart: Live Timing Feedback Overlay (096-timing-feedback-overlay)

The Practice view flashes a big, theme-styled `±ms` overlay when a note is played out of time, fading in/out in ~1s. Display contract: [contracts/timing-feedback-contract.md](contracts/timing-feedback-contract.md). Data source: [data-model.md](data-model.md).

## Prerequisites

- Worktree `../worktrees/095-state-timing-ms` (includes Feature 095's `stateLabel.ts`).
- `npm install` in `frontend/` (done).
- Test with `npx vitest run plugins/practice-view-plugin`; typecheck `npx tsc -b`; lint `npx eslint`.

## Validation Scenarios

### VS-01 — Unit: component renders ±ms value

**Run**: vitest on `frontend/plugins/practice-view-plugin/TimingFeedbackOverlay.test.tsx`.

**Expected**: `+120 ms` and `-80 ms` render correctly; `0 ms` renders; gated cases render nothing.

### VS-02 — Integration: overlay triggers in a live session

**Run**: `PracticeViewPlugin.test.tsx` drive a session via `ctx.simulateMidiEvent` with a note outside tolerance.

**Expected**: after the out-of-time result is recorded, an element `.practice-plugin__timing-overlay` with the signed ms text appears; it is removed after the dismissal timer (fake timers).

### VS-03 — Integration: no overlay for in-time / wrong / replay / results

**Run**: same test file, scenarios:
- `correct` note → no overlay element.
- wrong-pitch attempt → no overlay (red note flash still works).
- replay (`isReplaying`) → no overlay.
- free practice → no overlay.

**Expected**: all pass.

### VS-04 — Rapid successive out-of-time notes

**Run**: burst multiple out-of-time results quickly (fake timers).

**Expected**: exactly one overlay element, showing the **latest** deviation, no stacking/flicker.

### VS-05 — Manual theme check

**Run**: dev server, switch landing themes (two or more), play an out-of-time note in Practice.

**Expected**: overlay uses the theme's accent colour (no hardcoded colour); visible on both themes.

### VS-06 — Manual feel check

**Run**: live session. Play several notes including out-of-time ones.

**Expected**: overlay is big and legible, appears/disappears quickly with a fade, does not block taps on the score/controls, feels non-disruptive.

## Out of Scope

- Results overlay / replay behaviour changes.
- Persisted settings or toggles for the overlay.