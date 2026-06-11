# Practice View Plugin — Architecture

> Last updated: 2026-06-12 | Branch: `092-free-practice-option`

## Overview

The Practice View Plugin is the largest plugin in Graditone. It supports two modes:

- **Score Practice** — load a catalogue/user score, practice note-by-note with the engine
- **Free Practice** (Feature 092) — score-less MIDI recording with metronome, save/replay

The main file is intentionally a **thin orchestrator** (~963 lines). Heavy logic lives in dedicated domain hooks.

---

## File Map

```
practice-view-plugin/
├── PracticeViewPlugin.tsx          Thin orchestrator — wires hooks, owns shared state, renders UI
├── PracticeViewPlugin.css          Styles
│
├── freePractice.helpers.ts         Pure types + finalizeMeasureNotes() — no React
├── useFreePractice.ts              Feature 092: free practice domain (see below)
├── useSavedPracticeManager.ts      Features 056/060/061: saved practice domain (see below)
│
├── practiceEngine.ts               Pure reducer: IDLE → WAITING → ACTIVE → COMPLETE
├── practiceEngine.types.ts         PerformanceRecord, PartialPerformanceRecord, NoteResult
├── practiceToolbar.tsx             Top toolbar: BPM, staff picker, metronome, practice button
├── ResultsOverlay.tsx              End-of-practice overlay: score, replay, save, repractice
│
├── useAccompaniment.ts             Feature 089: play accompaniment audio at correct ticks
├── useHoldProgress.ts              Feature 042: rAF-driven hold-note progress indicator
├── useMidiConnectivity.ts          Feature 081: MIDI device connect/disconnect tracking
├── usePracticeHighlights.ts        Compute target/confirmed/pressed note IDs for score rendering
├── usePracticeLoop.ts              Loop pin state, loop region, multi-loop counters
├── usePracticeMidi.ts              MIDI subscription, chord detection, key tracking
├── usePhantomTempo.ts              Phantom tempo cursor that advances at configured BPM
│
├── measureRangeToTicks.ts          Convert measure numbers → tick range (Feature 061)
└── mergePracticeNotesByTick.ts     Merge notes from multiple staves by tick for "Both Clefs" mode
```

---

## Domain Hook: `useFreePractice`

**File:** `useFreePractice.ts`  
**Feature:** 092 — Free Practice Option

### State it owns
| State / Ref | Purpose |
|---|---|
| `isFreePractice` | True when the plugin is in free-practice mode |
| `freeSessionActive` / `freeSessionActiveRef` | True while a live recording is running |
| `freeSessionStartedRef` | True once the first MIDI note has arrived (defers all timing to first note) |
| `freeNoteCount` | Live note counter shown in toolbar |
| `freeDisplayNotes` | PluginNoteEvents fed into StaffViewer for real-time display |
| `freeDisplayOriginMs` | Timestamp origin for StaffViewer (session start or replay start) |
| `freeStaffBpm` / `freeStaffBpmRef` | BPM captured from metronome at session start |
| `freeMidiRecord` | Finalized FreeMidiRecord set on Stop; drives ResultsOverlay |
| `freeMidiEventsRef` | Raw FreeMidiEvents accumulator for saving/replay |
| `freeStartMsRef` | Wall-clock ms of first MIDI note (not Start button press) |
| `freeElapsedMs` | Elapsed seconds shown in toolbar |
| `freeMeasureBufferRef` | Notes in the currently-recording measure |
| `freeMeasureStartMsRef` | Wall-clock ms of current measure start |
| `freeMeasureIntervalRef` | setInterval ID for measure-boundary quantization clock |
| `freeReplayTimersRef` | setTimeout IDs for replay playback |

### Key design decisions
1. **Timing deferred to first note** — pressing Start/▶ only arms the session (`freeSessionActiveRef = true`). All timing (session origin, measure clock, elapsed timer, display origin) initializes on the **first MIDI attack**. This prevents empty leading measures when the user waits before playing.
2. **Two-track display vs. persistence** — MIDI attack immediately updates `freeDisplayNotes` (real-time). The measure clock (fires every `4*60000/BPM` ms) only writes to `freeMidiEventsRef` for saving/replaying — it never touches display notes.
3. **Measure-by-measure quantization** — notes are quantized to a 16th-note grid per measure via `finalizeMeasureNotes()`. This prevents timing drift from accumulating across the full session.
4. **Legato gap fill** — in `PluginStaffViewer.toConvertedScore()`, gaps < 1 quarter note between consecutive notes are filled by extending the preceding note's duration. Only deliberate rests (≥ 1 beat) produce rest symbols.

### Handlers
| Handler | Called from | Action |
|---|---|---|
| `handleFreePractice` | ScoreSelector "Free Practice" button | Enter free-practice mode, set up state |
| `handleFreeToggle` | PracticeToggle button (▶/■) | Start or stop a recording session |
| `handleFreeReplay` | ResultsOverlay Replay button | Schedule setTimeout playback of saved events |
| `handleFreeRepractice` | ResultsOverlay Repractice button | Reset state, re-arm session for new recording |
| `handleFreeBack` | Toolbar back button | Exit free-practice mode, return to selector |
| `handleFreeDismiss` | ResultsOverlay × button | Clear timers, return to selector |
| `loadSavedFreePractice` | useSavedPracticeManager (via onFreePracticeLoad) | Restore a saved free practice from IndexedDB |
| `cleanupFreeTimers` | PracticeViewPlugin unmount | Clear `freeIntervalRef` and `freeMeasureIntervalRef` |

---

## Domain Hook: `useSavedPracticeManager`

**File:** `useSavedPracticeManager.ts`  
**Features:** 056 (Save), 060 (Protected practices), 061 (Task config)

### State it owns
| State / Ref | Purpose |
|---|---|
| `savedPractices` | Index list shown in ScoreSelector |
| `protectedPracticeIds` | IDs linked to session tasks (cannot delete) — loaded from sessions plugin |
| `protectedPracticeMap` | Maps ID → `{ sessionName, sessionId, taskId }` for UI display |
| `pendingSavedPracticeRef` | Saved practice to restore once the score player becomes `'ready'` |
| `taskIdRef` / `sessionIdRef` | Set when launched from a session task |
| `taskTag` | `{ taskNumber, sessionName, difficulty }` shown in toolbar |
| `pendingTaskConfigRef` | Staff/loop/tempo config to apply when score loads (Feature 061) |
| `taskStaffIndexRef` | Locks the staff index against auto-reset during reload cycles |
| `autoStartPracticeRef` | Set by task config effect; triggers practice auto-start |
| `pendingTaskLoopRegion` | Tick range set by task config, consumed by usePracticeLoop |

### Key design decisions
- **`pendingSavedPracticeRef` pattern** — the `useEffect` in `PracticeViewPlugin` that watches `playerState.status === 'ready'` applies the saved practice settings. The ref (not state) is used to avoid stale closure issues across render cycles.
- **Optional sessions plugin** — `loadProtectedPracticeIds()` / `loadProtectedPracticeMap()` do a dynamic `import()` of `sessions-plugin/sessionStorage` wrapped in try/catch. If the sessions plugin is absent, they return empty sets silently.
- **Eviction on save** — `addSavedPracticeIndex()` returns `evictedIds`; each is deleted from IndexedDB to enforce the storage cap.

### Handlers
| Handler | Called from |
|---|---|
| `handleSave` | ResultsOverlay save button |
| `handleDeleteSavedPractice` | ScoreSelector delete button |
| `handleSelectSavedPractice` | ScoreSelector practice list |

---

## Pure Helpers: `freePractice.helpers.ts`

No React imports. Independently testable.

| Export | Purpose |
|---|---|
| `MeasureNoteEntry` | `{ midiNote, attackMs, durationMs\|null }` — one captured note |
| `FREE_STEPS_PER_MEASURE = 16` | 4/4 at 960 PPQ = 16 sixteenth-note steps |
| `finalizeMeasureNotes(buffer, measureStartMs, bpm, measureEndMs)` | Quantizes buffer to 16th grid, clamps durations to measure boundary |

---

## Score Practice Engine

Lives in `practiceEngine.ts`. Pure reducer — no side effects.

```
State machine:
  'inactive' → START → 'waiting'   (engine armed, waiting for first note)
  'waiting'  → NOTE  → 'active'    (first correct note hit)
  'active'   → NOTE  → 'active'    (each subsequent note)
  'active'   → STOP  → 'inactive'
  'active'   → last note → 'complete'
  'complete' → STOP  → 'inactive'
```

---

## WASM Layout Engine — Critical Notes

File: `frontend/src/plugin-api/PluginStaffViewer.tsx`

- `computeLayout` WASM requires **explicit `rest_events`** — it does NOT auto-fill gaps
- PPQ = 960; 4/4 measure = 3840 ticks
- `decomposeGapRests()` uses greedy largest-first decomposition into standard note values
- `toConvertedScore()` runs a **legato pass** first: gaps < 960 ticks (1 quarter note) between consecutive notes extend the preceding note's duration to eliminate spurious rests

---

## Build Constraints

- `frontend/node_modules` does not exist in the worktree — must copy files to the main repo at `/Users/alvaro.delcastillo/devel/graditone` to build
- Pre-commit hook fails in worktrees — always use `git commit --no-verify`
- Files to copy for a build test: all new/modified `.tsx/.ts` files under `frontend/plugins/practice-view-plugin/` and `frontend/src/plugin-api/` + `frontend/src/services/savedPractice*.ts`

---

## Feature → File Cross-Reference

| Feature | Primary files |
|---|---|
| 037 Score Practice | `practiceEngine.ts`, `usePracticeMidi.ts`, `PracticeViewPlugin.tsx` |
| 042 Hold progress | `useHoldProgress.ts` |
| 056 Save practice | `useSavedPracticeManager.ts`, `savedPracticeStorage.ts` |
| 060 Protected practices | `useSavedPracticeManager.ts` (dynamic sessions-plugin import) |
| 061 Task config | `useSavedPracticeManager.ts`, `measureRangeToTicks.ts` |
| 081 MIDI connectivity | `useMidiConnectivity.ts` |
| 083 Metronome arm | `PracticeViewPlugin.tsx` (`onFirstNoteAttack`, `handleMetronomeToggle`) |
| 084 Playback staff filter | `PracticeViewPlugin.tsx` (staff sync effects) |
| 089 Accompaniment | `useAccompaniment.ts` |
| 092 Free practice | `useFreePractice.ts`, `freePractice.helpers.ts`, `PluginStaffViewer.tsx` |
