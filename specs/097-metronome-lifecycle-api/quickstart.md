# Quickstart: Unified Metronome Lifecycle API (097-metronome-lifecycle-api)

Validates that the refactor keeps behaviour identical while moving armed state into the engine/API. Contract: [contracts/metronome-lifecycle-contract.md](contracts/metronome-lifecycle-contract.md).

## Prerequisites

- Worktree `../worktrees/097-metronome-lifecycle-api` (based on main incl. 095/096).

## Validation Scenarios

### VS-01 — Engine armed lifecycle

**Run**: `npx vitest run src/services/metronome/MetronomeEngine.test.ts`.

**Expected**: `setArmed(true)` → armed; `startFromDeferred` consumption → active; `stop()` clears armed; `armed` in state; existing tests (incl. transport-order regression) green.

### VS-02 — Plugin API

**Run**: `npx vitest run src/plugin-api/metronomeContext.test.ts`.

**Expected**: `arm`/`disarm`/`startFromDeferred` forwarded through proxy + noop; toggle-from-armed disarms; armed in emitted state.

### VS-03 — Practice lifecycle hook + plugin

**Run**: `npx vitest run plugins/practice-view-plugin`.

**Expected**: existing metronome behaviour tests (deferred start in waiting, first-note start, stop-on-finish re-arm, no silent-arm, free lifecycle, cross-stop→start) green against `state.armed`; toolbar class from `state.armed`.

### VS-04 — No bespoke logic left (SC-001)

**Run**: grep — no `metronomeArmedRef`, `*MetronomeEnabledRef`, `stopScoreMetronome`, `stopFreeMetronome` in practice code.

**Expected**: zero matches.

### VS-05 — Play/Train unaffected

**Run**: full frontend suite.

**Expected**: Play/Train suites green; only compile-forced `armed:false` in their constants.

### VS-06 — Manual sanity

Run dev server (worktree) — arm metronome in practice, confirm it ticks with the first note and re-arms after stop; Play/Train metronome unchanged.

## Out of Scope

- No audio-engine timing changes; no user-visible behaviour change.