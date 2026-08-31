# Practice View Plugin — Architecture

> Last updated: 2026-08-30 | Branch: `free-mode-fixes` | Features: 092, 094

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
├── freePractice.helpers.ts         Pure onset-derived measure detection (no React)
├── useFreePractice.ts              Feature 092/094: free practice domain (see below)
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
| `freeStaffBpm` / `freeStaffBpmRef` | **Base** BPM captured from metronome at session start (Feature 093: no longer the displayed value) |
| `freeEffectiveBpm` / `freeEffectiveBpmRef` | **Effective** BPM = `round(base × multiplier)` — single source of truth for the readout, StaffViewer, measure clock, and saved `FreeMidiRecord.bpm` (Feature 093) |
| `freeTempoMultiplier` / `freeTempoMultiplierRef` | Tempo multiplier applied to the base (updated by the toolbar slider via `setFreeTempo`; reset to 1.0 on entry/replay) |
| `freeMidiRecord` | Finalized FreeMidiRecord set on Stop; drives ResultsOverlay |
| `freeMidiEventsRef` | Raw FreeMidiEvents accumulator (Feature 094: the ONLY recorded representation; measures are derived from it) |
| `freeStartMsRef` | Wall-clock ms of first MIDI note (not Start button press) |
| `freeElapsedMs` | Elapsed seconds shown in toolbar |
| `freeReplayTimersRef` | setTimeout IDs for replay playback |

### Key design decisions
1. **Timing deferred to first note** — pressing Start/▶ only arms the session (`freeSessionActiveRef = true`). All session timing (origin, elapsed timer, display origin) initializes on the **first MIDI attack**. This prevents empty leading measures when the user waits before playing.
2. **Onset-derived measure detection (Feature 094)** — the beat grid and measure boundaries are ALWAYS reconstructed from the recorded note onsets via `detectMeasures()` in `freePractice.helpers.ts`. The metronome and wall-clock timers are NEVER timing sources (metronome-agnostic). The live staff, the saved record, and replay all consume the SAME derived view (`freeModeToPluginNotes`), guaranteeing identical structure (SC-005).
3. **No wall-clock measure clock** — the pre-094 per-measure `setInterval` quantization clock was removed. Measure segmentation is computed on demand:
   - On each MIDI attack/release → re-derive `freeDisplayNotes` for the live staff (cheap O(n)).
   - On Stop → derive the final staff + persist raw events + effective BPM.
   - On Replay / saved-load → derive the same measures from the stored events + BPM.
4. **Position-based note values (Issue #7)** — note values are derived from the 16th-step GRID, not from per-note time ratios. Every onset is snapped to the grid (±half a cell); a note's value is the gap to the next onset, with the held-duration cap applied **only when the release leaves a genuine rest** (`gap - held ≥ MIN_REST_STEPS`) — so "long note" vs "note + rest" stays distinct, rests appear only for ≥1-beat silence, and a slightly-early release with the next attack on time keeps the measure complete (Issue #10). This made accurate eighth runs (2 steps apart) robust: previously a gap edging past 0.5 beat flipped eighths into quarters that then collapsed onto one beat position (the reported La Candeur "chords of two black notes").
   - **Measure attribution comes from the rounded grid (Issue #8)** — `mIdx`/`step` are computed from `round(rel/cell)` (then `mIdx=floor/16`, `step=mod16`), not from the raw time floor. A note played a few tens of ms before a measure boundary snaps to the NEXT measure's step 0 instead of being clamped to the previous measure's step 15, which previously split the final beat into three notes.
   - **Replay highlight (Issue #9)** — during free replay, `handleFreeReplay` groups recorded events by onset and sets `freeReplayNoteIndexes` (staff attack indexes) as each group sounds, mirroring score-replay highlighting. `PluginStaffViewer` gained `highlightedNoteIndexes` (multi-index) so a whole chord lights together on the WASM staff; the plugin passes `highlightedNoteIndexes={freePractice.freeReplayNoteIndexes}` to the free staff.
5. **Rests only for genuine silence (≥ 1 beat)** — gaps of a full beat or more are decomposed into ordinary rest values; sub-beat legato gaps produce no rests.
6. **Effective tempo is the single source of truth (Feature 093)** — the base is ALWAYS the free nominal `FREE_NOMINAL_BPM = 120` (the scorePlayer default with no score); every tempo change is expressed through the multiplier (`freeEffectiveBpm = round(120 × multiplier)`). The readout, StaffViewer `bpm`, the onset-grid beat length, and the persisted `FreeMidiRecord.bpm` (effective at stop) all derive from it.
   - **Metronome BPM is effective (Issue #2/#4 unified model)** — the metronome reports `scoreTempo × multiplier`, an *effective* tempo. `computeFreeBpmMultiplier(metBpm)` converts it to a multiplier (`metBpm / 120`, or 1.0 when inactive) so the effective tempo always equals the audible metronome. `handleFreePractice`, the ▶-start re-seed, `handleFreeReplay`, and saved-load all seed with `seedFreeTempo(FREE_NOMINAL_BPM, multiplier)`.
   - **Entry syncs slider + scorePlayer (Issue #4)** — `onFreePractice` sets `setTempoMultiplier` AND `scorePlayer.setTempoMultiplier` to the SAME derived multiplier (not hard-coded 1.0), keeping readout, slider, and metronome in agreement on entry and re-entry. This replaces the earlier force-reset that desynced the label (30) from the metronome (120).
   - **Repractice keeps the session tempo (Issue #3)** — `handleRepractice` (orchestrator) and `handleFreeRepractice` (hook) do not reset the tempo multiplier or re-derive from the metronome. Repractice continues at `base × multiplier`, and the scorePlayer-driven metronome is left untouched.
7. **Free-mode metronome lifecycle mirrors score practice (Issue #5)** — in free mode `handleMetronomeToggle` **arms** the metronome instead of starting it immediately; `useFreePractice` exposes `onFreeNoteAttackRef` (invoked on every MIDI attack of an active session) which the orchestrator points at the same `onFirstNoteAttack` deferred-start handler used by score practice, so the metronome begins on the **first played note**. `stopFreeMetronome()` un-arms and stops it when the free session is stopped (Start/Stop toggle), on Back, and on results dismiss — the metronome always stops with the practice. Starting a free session while a standalone metronome is running stops and re-arms it so it re-aligns to the first note.
   - **Metronome-on intent persists across stop → Repractice (Issue #6)** — `freeMetronomeEnabledRef` remembers whether the user wants the metronome ON in free practice (set on arm, cleared on toggle-off and on exiting free practice). `stopFreeMetronome` stops the engine but preserves this intent, and `handleRepractice` re-arms the metronome when it is set — so the next practice starts active in waiting mode until the first note.
   - **Standalone restart resets the Transport to beat 0 (Issue #11)** — `MetronomeEngine.start()` with `skipTransportStart=false` now always `Transport.stop()` + `start('+0.01', 0)`. `engine.stop()` never stops `Tone.Transport` (score playback may own it), so without the reset a leftover `'started'` Transport would make the first click fire up to a beat late relative to the first note. Playback-shared restarts (`skipTransportStart=true`) are unchanged.

### Handlers
| Handler | Called from | Action |
|---|---|---|
| `handleFreePractice` | ScoreSelector "Free Practice" button | Enter free-practice mode, set up state |
| `handleFreeToggle` | PracticeToggle button (▶/■) | Start or stop a recording session |
| `handleFreeReplay` | ResultsOverlay Replay button | Schedule setTimeout playback of saved events (staff re-derived from saved events) — also drives `freeReplayNoteIndexes` so the note(s) currently playing light up on the staff (Issue #9) |
| `handleFreeRepractice` | ResultsOverlay Repractice button | Reset state, re-arm session for new recording (**keeps the finished session's tempo** — never resets the multiplier; Issue #3) |
| `handleFreeBack` | Toolbar back button | Exit free-practice mode, return to selector |
| `handleFreeDismiss` | ResultsOverlay × button | Clear timers, return to selector |
| `loadSavedFreePractice` | useSavedPracticeManager (via onFreePracticeLoad) | Restore a saved free practice from IndexedDB |
| `cleanupFreeTimers` | PracticeViewPlugin unmount | Clear `freeIntervalRef` |

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

- `frontend/node_modules` is not pre-installed in worktrees. The pre-commit hook auto-runs `npm install --prefer-offline` on first commit, so dependencies are installed automatically.
- The backend (`cargo`) shares the main repo's `~/.cargo` registry and `backend/target/` — no extra setup needed.
- Files changed in the worktree are committed directly; no manual copy to the main repo is required.

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
