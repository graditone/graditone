# Tasks: Fix Metronome Issues

**Input**: Design documents from `/specs/085-fix-metronome-issues/`
**Branch**: `085-fix-metronome-issues`
**Prerequisites**: [plan.md](plan.md) ✅ | [spec.md](spec.md) ✅ | [research.md](research.md) ✅ | [data-model.md](data-model.md) ✅

**Design summary**:
- **US1 (P1)**: `MetronomeEngine.clampBpm()` floors at 20 BPM — change to 10 BPM (1 source file, 1 test file)
- **US2 (P2)**: `startTransport()` clears the metronome `scheduleRepeat` on every loop; `useMetronomeBridge` only re-registers on status transition — add `onTransportRestart` subscription with microtask restart (1 source file, 1 test file)
- **US3 (P3)**: `_fireBeat()` only notifies subscribers on beat boundaries, not subdivision ticks — remove gate, add `subBeatIndex` to `MetronomeState`, propagate to toolbar (8 source files, 7 test files)

---

## Phase 1: Setup

**Purpose**: Establish a green baseline before touching any code.

- [X] T001 Run baseline test suite to confirm starting state: `cd frontend && npx vitest run`

**Checkpoint**: All pre-existing tests pass. Record any pre-existing failures before proceeding.

---

## Phase 2: Foundational

**Purpose**: No shared blocking prerequisites across all 3 user stories — each fix is confined to independent files. The `MetronomeState` type extension (US3) is the only cross-cutting change, but it only blocks US3 tasks; US1 and US2 can start immediately after Phase 1.

> US1 and US2 tasks can begin in parallel after Phase 1. US3 tasks require T006 (type contract change) first.

---

## Phase 3: User Story 1 — Metronome Stays In Sync at Ultraslow Tempos (Priority: P1) 🎯 MVP

**Goal**: Accept 10 BPM without clamping it to 20 BPM so the metronome tick rate matches the playback speed at any supported tempo (10–300 BPM).

**Independent Test**: Start engine at 10 BPM, assert `engine.getState().bpm === 10`; verify `scheduleRepeat` interval equals 6.0 s (60/10 * 4/4).

### Tests for User Story 1 ⚠️ Write FIRST — verify they FAIL before T003

- [X] T002 [US1] Add failing regression test asserting `engine.start(10)` yields `getState().bpm === 10` (not 20); update "clamps BPM below 20 to 20" test description and assertion to reflect the new 10 BPM floor; add boundary test for `start(5)` → clamped to 10 in `frontend/src/services/metronome/MetronomeEngine.test.ts`

### Implementation for User Story 1

- [X] T003 [US1] Fix BPM clamp floor: change `Math.max(20, bpm)` to `Math.max(10, bpm)` in `MetronomeEngine.clampBpm()` in `frontend/src/services/metronome/MetronomeEngine.ts`

**Checkpoint**: `npx vitest run` — all MetronomeEngine BPM-clamping tests pass. User Story 1 independently verified.

---

## Phase 4: User Story 2 — Metronome Continues Running Through All Loop Repetitions (Priority: P2)

**Goal**: When loop playback wraps back to the start, the metronome engine re-registers its `scheduleRepeat` callback so ticks continue uninterrupted across every loop boundary.

**Independent Test**: Mock `adapter.onTransportRestart`; call the registered listener while engine is active; assert `engine.start()` is called again (new `scheduleRepeat` registered).

### Tests for User Story 2 ⚠️ Write FIRST — verify they FAIL before T005

- [X] T004 [US2] Add failing regression test in `frontend/src/plugin-api/metronomeContext.test.ts`: render `useMetronomeBridge`, start the engine, capture the `onTransportRestart` listener registered on the mock adapter, invoke it, and assert the engine's `start()` was called a second time; also assert engine does NOT restart when `onTransportRestart` fires while engine is inactive

### Implementation for User Story 2

- [X] T005 [US2] In `useMetronomeBridge` (`frontend/src/plugin-api/metronomeContext.ts`): inside the `useEffect` that subscribes to `scorePlayer`, also call `adapter.onTransportRestart(() => { if (!engineStateRef.current.active) return; const { bpm, timeSignature } = scoreStateRef.current; Promise.resolve().then(() => { engine.start(bpm, timeSignature.numerator, timeSignature.denominator, 0, 0, subdivisionRef.current).catch(console.error); }); })` and return its unsubscribe alongside the scorePlayer unsubscribe

**Checkpoint**: `npx vitest run` — metronomeContext loop-restart tests pass. User Story 2 independently verified.

---

## Phase 5: User Story 3 — Visual Blink Respects the Configured Subdivision (Priority: P3)

**Goal**: The visual blink fires on every subdivision tick (not just on full beats) by emitting `MetronomeState` on every `_fireBeat()` call and carrying `subBeatIndex` so the toolbar can restart its CSS animation per tick.

**Independent Test**: Start engine with `subdivision: 2` at 120 BPM; fire 2 Transport ticks; assert both emit `MetronomeState` to subscribers (not just the on-beat tick); assert `subBeatIndex` is 0 on tick 1 and 1 on tick 2.

### Type Contract (blocks all other US3 tasks)

- [X] T006 [US3] Add `readonly subBeatIndex: number` field to `MetronomeState` interface (after `subdivision`) with JSDoc: "0 = on-beat; 1..(subdivision-1) = subdivision tick within the current beat" in `frontend/src/plugin-api/types.ts`

### MetronomeState literal updates (all [P] — independent files, all depend on T006)

- [X] T007 [P] [US3] Add `subBeatIndex: 0` to `INACTIVE_STATE` constant in `frontend/src/services/metronome/useMetronome.ts`

- [X] T008 [P] [US3] Add `subBeatIndex: 0` to `INACTIVE_STATE` constant in `frontend/src/plugin-api/metronomeContext.ts`

- [X] T009 [P] [US3] Add `subBeatIndex: 0` to: `INITIAL_METRONOME_STATE` in `frontend/plugins/play-score/PlayScorePlugin.tsx`; `INITIAL_METRONOME_STATE` in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`; inline `MetronomeState` literal in `frontend/plugins/train-view/TrainPlugin.tsx`

- [X] T010 [P] [US3] Add `subBeatIndex: 0` to all inline `MetronomeState` literal objects in test files: `INACTIVE`/`ACTIVE` constants and inline calls in `frontend/src/plugin-api/metronomeContext.test.ts`; inline handler calls in `frontend/plugins/play-score/PlayScorePlugin.test.tsx`; inline handler calls in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.test.tsx`; inline handler calls in `frontend/plugins/train-view/TrainPlugin.test.tsx`; inline handler call in `frontend/plugins/train-view/TrainVirtualKeyboard.test.tsx`

### Tests for User Story 3 ⚠️ Write FIRST — verify they FAIL before T012 (depends on T006, T010)

- [X] T011 [US3] Add failing tests in `frontend/src/services/metronome/MetronomeEngine.test.ts`: (a) with `subdivision: 2`, firing 2 ticks notifies subscriber twice (not once); (b) first tick emits `subBeatIndex: 0`, second tick emits `subBeatIndex: 1`; (c) after a full subdivision cycle (2 ticks), `subBeatIndex` resets to 0 and `beatIndex` increments; update any existing subscriber-notification tests that assert `subscribers.forEach` is called only `if (isOnBeat)`

### Implementation for User Story 3

- [X] T012 [US3] In `MetronomeEngine._fireBeat()` (`frontend/src/services/metronome/MetronomeEngine.ts`): capture `currentSubBeatIndex = this._subBeatIndex` before advancing; remove the `if (isOnBeat)` gate from the `this._subscribers.forEach(h => h(state))` call; include `subBeatIndex: currentSubBeatIndex` in the emitted `MetronomeState` object; in `_getState()`, add `subBeatIndex: this._subBeatIndex` to both the active and inactive return objects

- [X] T013 [P] [US3] In `frontend/plugins/play-score/playbackToolbar.tsx`: add `metronomeSubBeatIndex: number` to `PlaybackToolbarProps`; destructure it; update animation key from `metro-${metronomeBeatIndex}` to `metro-${metronomeBeatIndex}-${metronomeSubBeatIndex}`; in `frontend/plugins/play-score/playbackToolbar.test.tsx`: add `metronomeSubBeatIndex: 0` to the `makeDefaultProps` default object

- [X] T014 [US3] In `frontend/plugins/play-score/PlayScorePlugin.tsx`: pass `metronomeSubBeatIndex={metronomeState.subBeatIndex}` to `<PlaybackToolbar>` (depends on T013)

**Checkpoint**: `npx vitest run` — all MetronomeEngine subdivision tests pass; all plugin render tests pass. User Story 3 independently verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final verification across all 3 fixes together.

- [X] T015 [P] Run full test suite `cd frontend && npx vitest run` and confirm all tests pass (no regressions introduced by any of the 3 fixes)

- [X] T016 [P] Run TypeScript type-check `cd frontend && npx tsc --noEmit` and confirm zero type errors (validates `subBeatIndex` propagation is complete across all consumers)

---

## Post-implementation Fix: Beat-0 Timing Sync (US1 follow-up)

**Problem**: At 13 BPM the metronome appeared "a bit slower than the music." Root cause: two separate issues:
1. `computeBeatPhase` always skipped to the NEXT beat, so beat 0 (downbeat) never got a click when playback started. At slow tempos (13 BPM, 4.6 s/beat) this silence on the first note was very noticeable.
2. `_fireBeat()` called `triggerAttackRelease` without the Tone.js `time` argument, so the synth fired at `Tone.now()` (≈ lookahead seconds early) rather than at the exact scheduled beat — creating a fixed offset vs. music notes which use the sample-accurate `scheduleTime` from `Transport.schedule`.

**Fix** (T017–T019 — not in original plan):

- [X] T017 Fix `computeBeatPhase` fresh-start case: when `transportSeconds < 0.05` AND `fractionalBeat < 0.05`, return `scheduleOffsetSeconds = transportSeconds + 0.001` and `startBeatIndex = currentBeat`. This fires beat 0 on the downbeat instead of skipping it. (`frontend/src/plugin-api/metronomeContext.ts`)

- [X] T018 Pass Tone.js `time` arg through `ToneAdapter.scheduleRepeat` and into `MetronomeEngine._fireBeat(time?)` so `triggerAttackRelease` uses sample-accurate scheduling. (`frontend/src/services/playback/ToneAdapter.ts`, `frontend/src/services/metronome/MetronomeEngine.ts`)

- [X] T019 Update mock callback type in `MetronomeEngine.test.ts`; add 2 new tests in `metronomeContext.test.ts` covering the fresh-start path and the mid-song path. All 71 tests pass, 0 TypeScript errors.

---

## Follow-up Fix — Late Subscriber Drift (T020)

**Problem**: After T017–T019 the metronome started in sync with the music but appeared to "delay" relative to subsequent notes. Root cause: `computeBeatPhase`'s fresh-start guard required `transportSeconds < 0.05`, which is too tight in practice. React's playback-start subscriber can fire 100–200 ms after `startTransport()` (the React effect/render delay), so by the time `computeBeatPhase` runs, `transportSeconds` is already > 0.05 even though the score is still in its very first beat (4.6 s long at 13 BPM). The guard would then fall through to the next-beat path, scheduling the first click ~50 ms before the next score beat — producing a fixed phase offset that the user perceives as "metronome falls behind the music."

**Fix** (T020 — not in original plan):

- [X] T020 Extend the fresh-start guard in `computeBeatPhase`: replace `transportSeconds < 0.05` with `transportSeconds < beatInterval`. Combined with the existing `fractionalBeat < 0.05` check, this fires beat 0 immediately whenever the subscriber lands inside the first beat of the score, regardless of how late the React effect runs. The `fractionalBeat < 0.05` condition still correctly excludes mid-song toggle paths. Added regression test for `transportSeconds = 0.15`, `tick = 31` case (slow-render simulation). 72/72 tests pass, 0 TypeScript errors. (`frontend/src/plugin-api/metronomeContext.ts`, `frontend/src/plugin-api/metronomeContext.test.ts`)

---

## Follow-up Fix — BPM Rounding Drift (T021)

**Problem**: Progressive drift where the metronome falls behind by ~70 ms per beat at 13 BPM (and proportionally at any slow practice speed). Root cause confirmed via diagnostic logging: note `audioCtx` intervals were 4.545 s apart (13.20 BPM) while metronome intervals were 4.615 s (13.00 BPM). `effectiveBpm = Math.round(scoreTempo × tempoMultiplier)` — at 120 BPM × 11 % = 13.2 BPM, rounding to 13 introduces a 1.5 % tempo error = 70 ms/beat drift. The display BPM needs rounding; the metronome interval does not.

**Fix** (T021):

- [X] T021 Add `exactBpm: number` field to `ScorePlayerState` (unrounded `scoreTempo × tempoMultiplier`). Keep `bpm` as the rounded integer for display. In `scorePlayerContext.ts`, compute `exactBpm` separately. In `metronomeContext.ts`, read `s.exactBpm ?? s.bpm` for all audio-timing paths (engine.start, engine.updateBpm). Updated `makeMockScorePlayer` in tests. Added diagnostic logging to `ToneAdapter.playNote` and `MetronomeEngine._fireBeat` to allow real-time timing verification (marked "remove before shipping"). 72/72 tests pass, 0 TypeScript errors. (`frontend/src/plugin-api/types.ts`, `frontend/src/plugin-api/scorePlayerContext.ts`, `frontend/src/plugin-api/metronomeContext.ts`, `frontend/src/plugin-api/metronomeContext.test.ts`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: N/A — no shared blocking work
- **US1 (Phase 3)**: Depends only on Phase 1 — can start immediately after baseline confirmed
- **US2 (Phase 4)**: Depends only on Phase 1 — can start immediately after baseline confirmed
- **US3 (Phase 5)**: Depends on Phase 1; T006 must complete before T007–T014
- **Polish (Phase 6)**: Depends on all US phases complete

### User Story Dependencies

```
Phase 1 (T001)
  ├── Phase 3 (T002 → T003)          [US1 — independent]
  ├── Phase 4 (T004 → T005)          [US2 — independent]
  └── Phase 5:
        T006
          ├── T007 [P]
          ├── T008 [P]
          ├── T009 [P]
          ├── T010 [P]
          ├── T011 (after T010)
          ├── T012 (after T011)
          ├── T013 [P]
          └── T014 (after T013)
                          ↓
                    Phase 6 (T015, T016)
```

### Parallel Opportunities

**Across stories**: US1 (Phase 3) and US2 (Phase 4) can run entirely in parallel — they touch completely different files.

**Within US3**: T007, T008, T009, T010, T013 are all parallel (independent files). T011 can begin as soon as T006 + T010 complete. T012 requires T011. T014 requires T013.

---

## Parallel Example: All 3 User Stories

```bash
# Terminal A: US1 — BPM clamp fix
# 1. Add failing test (T002)
# 2. Fix clamp (T003)
# 3. npx vitest run --reporter=verbose --testPathPattern=MetronomeEngine

# Terminal B: US2 — Loop restart fix
# 1. Add failing test (T004)
# 2. Add onTransportRestart subscription (T005)
# 3. npx vitest run --reporter=verbose --testPathPattern=metronomeContext

# Terminal C: US3 — Subdivision blink fix
# 1. types.ts change (T006)
# 2. All literal updates in parallel (T007–T010 each in its own sub-step)
# 3. Add failing tests (T011)
# 4. MetronomeEngine fix (T012)
# 5. Toolbar prop (T013) + PlayScorePlugin (T014)
# 6. npx vitest run --reporter=verbose --testPathPattern="MetronomeEngine|playbackToolbar|PlayScorePlugin"
```

---

## Implementation Strategy

**MVP Scope**: User Story 1 only (T001–T003) — delivers the highest-priority fix (tempo accuracy) with 3 tasks and zero cross-file dependencies.

**Full delivery order**: US1 → US2 → US3 (priority order), or all three in parallel if multiple implementers are available.

**Regression safety**: Each fix requires a failing test BEFORE implementation (Constitution Principles V + VII). Do not merge any implementation task without its corresponding test passing.

**File overlap notice**: `metronomeContext.ts` is modified by both US2 (T005) and US3 (T008). Implement T005 before T008 to avoid merge conflicts, or handle both in the same branch commit.

---

## Task Count Summary

| Phase | Tasks | User Story | Parallel? |
|-------|-------|-----------|-----------|
| Setup | T001 | — | — |
| US1 | T002–T003 | P1 | T003 only (different file from T002) |
| US2 | T004–T005 | P2 | — |
| US3 type | T006 | P3 | — (blocks T007–T014) |
| US3 literals | T007–T010 | P3 | All 4 fully parallel |
| US3 tests | T011 | P3 | — |
| US3 impl | T012–T014 | P3 | T013 parallel with T012 |
| Polish | T015–T016 | — | Both parallel |
| **Total** | **16** | | |
