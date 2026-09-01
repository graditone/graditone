# Tasks: Unified Metronome Lifecycle API

**Input**: Design documents from `/specs/097-metronome-lifecycle-api/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, contracts/metronome-lifecycle-contract.md, quickstart.md

**Tests**: Constitution Principle V requires tests-first. New engine/API/hook behaviour tested before wiring; existing behaviour assertions preserved (mechanically updated for constant/name shifts).

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

- Web app: `frontend/` under `/Users/alvaro.delcastillo/devel/graditone/.worktrees/097-metronome-lifecycle-api/`.

---

## Phase 1: Setup

- [x] T001 Baseline: `npx vitest run` in `frontend/` green on current checkout (expect ~2224 passed / 25 skipped); note any failures before changes
- [x] T002 Add `armed: false` to the `MetronomeState` literals in `frontend/src/services/metronome/useMetronome.ts` (INACTIVE_STATE), `frontend/plugins/play-score/PlayScorePlugin.tsx` and `frontend/plugins/train-view/TrainPlugin.tsx` (INITIAL_METRONOME_STATE), and the doc example in `frontend/src/plugin-api/types.ts` so everything compiles after the type change

---

## Phase 2: Foundational — Engine armed state

- [x] T003 Write failing engine tests in `frontend/src/services/metronome/MetronomeEngine.test.ts`: (a) `setArmed(true)` → `state.armed === true && state.active === false`; (b) `setArmed(true)` while active is a no-op; (c) `setArmed(false)` clears armed; (d) `stop()` clears armed; (e) engine state includes `armed` (invariant `!(armed && active)`)
- [x] T004 Implement in `frontend/src/services/metronome/MetronomeEngine.ts`: add `_armed`, `setArmed(armed): void` (no-op while active; notifies), `armed` in `_getState()`/`_notifySubscribers()`, clear `_armed` in `stop()` and on `start()`
- [x] T005 Run `npx vitest run src/services/metronome/MetronomeEngine.test.ts` — all pass (existing + new)

---

## Phase 3: Foundational — Plugin API

- [x] T006 Write failing API tests in `frontend/src/plugin-api/metronomeContext.test.ts`: (a) `arm()` → engine armed path; (b) `disarm()`; (c) `toggle()` from armed disarms (does NOT start); (d) `startFromDeferred()` consumes arm + starts (returns true); (e) `startFromDeferred()` no-op when not armed (returns false); (f) proxy/noop expose the new methods; (g) `armed` in emitted state
- [x] T007 Implement in `frontend/src/plugin-api/types.ts` (`MetronomeState.armed`, `PluginMetronomeContext.arm/disarm/startFromDeferred`) and `frontend/src/plugin-api/metronomeContext.ts` (bridge methods + INACTIVE_STATE.armed; noop + proxy updated). `startFromDeferred()` uses the standalone start branch (Transport reset before repeat)
- [x] T008 Run `npx vitest run src/plugin-api/metronomeContext.test.ts` — all pass

---

## Phase 4: User Story 1+2 — Practice lifecycle hook + plugin wiring (Priority: P1) 🎯 MVP

**Goal**: One `useMetronomeLifecycle` hook owns armed/active from `MetronomeState` + the "enabled" preference; score & free practice and toolbar consume it; all bespoke refs/helpers removed.

### Tests for US (test-first) ⚠️

- [x] T009 [P] [US12] Create `frontend/plugins/practice-view-plugin/useMetronomeLifecycle.test.ts` with a mocked `PluginMetronomeContext`: (a) `onToggle` while idle+canArm → `arm()`, enabled=true; (b) `onToggle` while armed → `disarm()`, enabled=false; (c) `onToggle` while active → `toggle()`, enabled=false; (d) `onToggle` idle+!canArm → `toggle()`, enabled=true; (e) `onFirstNote` → `startFromDeferred()`; (f) `onSessionEnd` enabled → `toggle()` then `arm()`; (g) `onSessionEnd` disabled → `toggle()` only; (h) `onExit` → `toggle()` + `disarm()` + clears preference; (i) exposes `armed`/`active` from state

### Implementation for US

- [x] T010 [US12] Create `frontend/plugins/practice-view-plugin/useMetronomeLifecycle.ts`: subscribes to `context.metronome`, exposes `{ state, armed, active, onToggle, onFirstNote, onSessionStart, onSessionEnd, onExit }`, owns one `enabledRef`, implements the contract table
- [x] T011 [US12] Refactor `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` to use the hook: delete `metronomeArmed`/`metronomeArmedRef`, `scoreMetronomeEnabledRef`, `freeMetronomeEnabledRef`, `stopScoreMetronome`, `stopFreeMetronome`, `onFirstNoteAttack`, `freeNoteAttackRef`; wire `onToggle` into toolbar handler, `onSessionStart` into practice start, `onSessionEnd` into stop/complete/repractice, `onExit` into free-practice exit; feed toolbar `metronomeArmed={lifecycle.armed}`
- [x] T012 [US12] Route first-note triggers into the hook: `frontend/plugins/practice-view-plugin/usePracticeMidi.ts` `onFirstNoteAttack` and `frontend/plugins/practice-view-plugin/useFreePractice.ts` `onFreeNoteAttackRef` both call `lifecycle.onFirstNote` (keep the trigger points)
- [x] T013 [US12] Run `npx vitest run plugins/practice-view-plugin` — existing metronome tests pass (update assertions mechanically to `state.armed`-driven button where needed)

---

## Phase 5: User Story 3 — Play/Train unaffected (Priority: P2)

- [x] T014 [US3] Verify no behaviour change: run Play/Train suites; confirm their metronome usage remains `toggle()`/`setSubdivision()`/`subscribe()` and `INITIAL_METRONOME_STATE` only gained `armed:false` (SC-003)

---

## Phase 6: Polish & Cross-Cutting

- [x] T015 [P] Full-frontend validation: `npx vitest run` (all suites), `npx eslint` changed files, `npx tsc -b`; run quickstart VS-01..05; grep-verify SC-001 (no bespoke armed/enabled refs or stop/disarm helpers left in practice code); update `FEATURES.md` Practice View bullet (metronome lifecycle now a shared API, Feature 097)

---

## Dependencies & Execution Order

- Setup (T001/T002) → Foundational engine (T003-T005) → API (T006-T008) → US hook + practice wiring (T009-T013) → US3 verify (T014) → Polish (T015)
- Engine before API; API before hook; hook before practice wiring
- Parallel: T002 alone; nothing else recommended before T013 (shared files); T015 [P]

## Parallel Example: none beyond T015 — engine/API/hook are strictly sequential (shared types + state).

---

## Bug Fixes and Regression Prevention

No bugs recorded yet. If one arises during refactor, use the standard [BUG] template (document → regression test → fix → full-suite verify) per Principle VII.

---

## Implementation Strategy

MVP-first: engine+API+hook (US12) is the deliverable; Play/Train (US3) is a verification pass; Polish closes with full validation + docs. Behaviour must remain identical — the existing metronome tests are the guard.