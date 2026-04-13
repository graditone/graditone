# Tasks: Fix Train View — Wrong Note Overlap on Response Staff

**Feature**: `079-fix-train-note-overlap`  
**Branch**: `079-fix-train-note-overlap`  
**Input**: Design documents from `specs/079-fix-train-note-overlap/`  
**Prerequisites**: plan.md ✓, spec.md ✓

**Constitution Gates (Principles V & VII)**: T002 MUST be written and verified FAILING before T003 is started. Never skip the "confirm FAIL" step.

---

## Phase 1: Setup — Baseline

**Purpose**: Confirm the existing test suite is green before any changes.

- [x] T001 Run `npx vitest run` in `frontend/` and confirm all existing tests pass (baseline checkpoint before any code changes)

---

## Phase 2: Regression Test ⚠️ Write FIRST — verify FAIL before T003

**Purpose**: Produce a failing test that reproduces the overlap bug in step mode.

- [x] T002 Write failing regression test in `frontend/plugins/train-view/TrainPlugin.test.tsx`: simulate step mode, dispatch two different wrong-note inputs for the same slot via the MIDI handler, and assert that `responseNoteEvents` contains exactly one entry (not two). Confirm test FAILS before proceeding.

---

## Phase 3: Fix

**Purpose**: Replace the appending `setResponseNoteEvents` call with one that filters out the previous entry for the current slot before inserting the new one.

- [x] T003 In `frontend/plugins/train-view/TrainPlugin.tsx`, inside `handleStepInput`, change `setResponseNoteEvents(prev => [...prev, newEvent])` to `setResponseNoteEvents(prev => [...prev.filter(e => e.timestamp !== targetNote.expectedOnsetMs), newEvent])` so only one event per slot timestamp is retained.

---

## Phase 4: Verify

**Purpose**: Confirm the regression test is now green and no pre-existing tests regressed.

- [x] T004 Run `npx vitest run` in `frontend/` — the new regression test (T002) must pass green, and all pre-existing tests must remain green.
- [x] T005 Run `npm run build` in `frontend/` — zero TypeScript errors.

---

## Phase 5: Issue #2 — MIDI same-pitch consecutive slots silently dropped

**Root cause**: The `stepLastPlayTimeRef` and `lastStepMidiRef` debounce guards in `handleStepInput` were applied to all input sources. Designed for mic continuous-pitch carry-over protection, they incorrectly blocked discrete MIDI events within 700 ms of a slot advance (e.g. Arabesque M3 N1→N2 same chord).

- [x] T006 Wrap the two guards in `inputSourceRef.current === 'mic'` so they only fire for the continuous mic pitch-stream case. MIDI / virtual-keyboard discrete events bypass them.
- [x] T007 Add regression test: 'wrong MIDI note for slot 1 is processed immediately after slot 0 advances — no 700 ms wait'.
- [x] T008 Run `npx vitest run` — 1851 tests pass (0 failures).
