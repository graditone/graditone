# Data Model: Practice Note Duration Validation

**Feature**: 042-practice-note-duration  
**Date**: 2026-03-09

---

## Overview

This feature adds hold-duration tracking to the practice session state machine. Changes touch three layers:
1. **Plugin API type** — `PluginPracticeNoteEntry` gains `durationTicks`
2. **Practice engine types** — new mode, outcome, action, and state fields
3. **Practice engine logic** — new transitions for HOLD_COMPLETE and EARLY_RELEASE

---

## 1. Plugin API Type (v7)

### `PluginPracticeNoteEntry` (modified)

_File_: `frontend/src/plugin-api/types.ts`

| Field | Type | Change | Description |
|-------|------|--------|-------------|
| `midiPitches` | `ReadonlyArray<number>` | existing | Ordered MIDI pitches to press |
| `noteIds` | `ReadonlyArray<string>` | existing | Opaque note IDs for highlighting |
| `tick` | `number` | existing | Absolute start tick (960 PPQ) |
| `durationTicks` | `number` | **NEW** | Written note duration in ticks (960 PPQ). `0` means no duration checking (random/scale modes, or rests). For chords: the duration of the chord (all notes at the same tick share the same duration). |

**Backward compatibility**: `durationTicks === 0` disables hold checking. All existing practice sessions that do not source notes from a loaded score produce entries with `durationTicks = 0` and are unaffected.

---

## 2. Practice Engine Types (modified)

_File_: `frontend/plugins/practice-view-plugin/practiceEngine.types.ts`

### `NoteOutcome` (modified)

```
'correct' | 'correct-late' | 'wrong' | 'early-release' | 'pending'
```

| Value | Meaning | Score weight |
|-------|---------|-------------|
| `'correct'` | Correct pitch, held long enough, on time | 1.0 |
| `'correct-late'` | Correct pitch, held long enough, timing late | 0.5 |
| `'early-release'` | **NEW** — Correct pitch pressed but released before 90% of required duration | 0.5 |
| `'wrong'` | Wrong pitch pressed | 0 (penalty) |
| `'pending'` | Not yet attempted | — |

### `PracticeMode` (modified)

```
'inactive' | 'waiting' | 'active' | 'holding' | 'complete'
```

| Mode | Meaning |
|------|---------|
| `'inactive'` | No session running |
| `'waiting'` | Session ready, waiting for first correct note |
| `'active'` | Advancing between notes (no hold in progress) |
| `'holding'` | **NEW** — Correct pitches pressed; hold timer counting toward 90% threshold |
| `'complete'` | All notes exhausted |

### `PracticeNoteResult` (modified)

| Field | Type | Change | Description |
|-------|------|--------|-------------|
| `noteIndex` | `number` | existing | Index into `notes[]` |
| `outcome` | `NoteOutcome` | existing + `'early-release'` | Result of this note attempt |
| `playedMidi` | `number` | existing | MIDI note pressed |
| `expectedMidi` | `ReadonlyArray<number>` | existing | Expected pitches |
| `responseTimeMs` | `number` | existing | Time from session start to note press |
| `expectedTimeMs` | `number` | existing | Expected press time from BPM + tick |
| `relativeDeltaMs` | `number` | existing | Timing delta from expected interval |
| `wrongAttempts` | `number` | existing | Wrong-pitch attempts before success |
| `holdDurationMs` | `number` | **NEW** | Actual hold duration in ms. `0` for notes where duration checking is not active. |
| `requiredHoldMs` | `number` | **NEW** | Required hold duration in ms. `0` when `durationTicks === 0`. |

### `PracticeState` (modified)

| Field | Type | Change | Description |
|-------|------|--------|-------------|
| `mode` | `PracticeMode` | existing + `'holding'` | Current session mode |
| `notes` | `ReadonlyArray<PracticeNoteEntry>` | existing | Ordered note targets |
| `currentIndex` | `number` | existing | Current target index |
| `selectedStaffIndex` | `number` | existing | Staff being practiced |
| `noteResults` | `ReadonlyArray<PracticeNoteResult>` | existing + new fields | Per-note outcomes |
| `currentWrongAttempts` | `number` | existing | Wrong attempts for current note |
| `wrongNoteEvents` | `ReadonlyArray<WrongNoteEvent>` | existing | All wrong-pitch events |
| `holdStartTimeMs` | `number` | **NEW** | Wall-clock ms when the current note was correctly pressed. `0` when mode is not `'holding'`. |
| `requiredHoldMs` | `number` | **NEW** | Required hold duration in ms for current note. `0` when no hold in progress. |

### New Actions

#### `HOLD_COMPLETE`

Dispatched by the React component timer when the hold duration threshold (90%) is reached.

```typescript
{
  readonly type: 'HOLD_COMPLETE';
  /** Actual hold duration in ms at the moment of dispatch. */
  readonly holdDurationMs: number;
  /** Expected time in ms (passed through from the original CORRECT_MIDI). */
  readonly expectedTimeMs: number;
  /** Optional end index for loop-region completion. */
  readonly endIndex?: number;
}
```

**Engine transition**: `holding → active` (or `complete` if last note). Records the pitch result as `correct` or `correct-late` with the actual hold duration.

#### `EARLY_RELEASE`

Dispatched by the MIDI release handler when a required pitch is released before the hold threshold.

```typescript
{
  readonly type: 'EARLY_RELEASE';
  /** Actual hold duration in ms at release time. */
  readonly holdDurationMs: number;
  /** Expected time in ms (passed through from the original CORRECT_MIDI). */
  readonly expectedTimeMs: number;
}
```

**Engine transition**: `holding → holding` (stays on the same note). Records an `early-release` result. Resets `holdStartTimeMs = 0` and `requiredHoldMs = 0` so a retry starts clean.

---

## 3. State Machine Transitions (complete picture)

```
INITIAL_STATE (inactive)
  │
  ├─ START ────────────────────────────────────────────→ waiting
  │
waiting / active
  ├─ CORRECT_MIDI (durationTicks > 0) ─────────────────→ holding
  │     records: holdStartTimeMs = now, requiredHoldMs = calculated
  ├─ CORRECT_MIDI (durationTicks == 0) ────────────────→ active (unchanged behaviour)
  ├─ WRONG_MIDI ───────────────────────────────────────→ (same mode, increment wrongAttempts)
  │
holding
  ├─ HOLD_COMPLETE ────────────────────────────────────→ active (or complete if last note)
  │     records: outcome = 'correct' | 'correct-late', holdDurationMs
  ├─ EARLY_RELEASE ────────────────────────────────────→ holding (same index, reset hold state)
  │     records: outcome = 'early-release', holdDurationMs
  │     (user may re-press to enter holding again)
  │
  ├─ CORRECT_MIDI in holding (retry after early-release) → holding (reset hold start time, no new result entry)
  ├─ WRONG_MIDI ───────────────────────────────────────→ (holding mode, break hold, increment wrongAttempts)
  │
active / holding
  ├─ SEEK ─────────────────────────────────────────────→ active (same as before)
  ├─ STOP ─────────────────────────────────────────────→ inactive
  ├─ DEACTIVATE ───────────────────────────────────────→ inactive (preserves index)
  ├─ LOOP_RESTART ─────────────────────────────────────→ active (from complete only)
```

---

## 4. Score Player Context Change

_File_: `frontend/src/plugin-api/scorePlayerContext.ts`

In `extractPracticeNotes`, when building each `PluginPracticeNoteEntry`:

- **Before**: `{ midiPitches, noteIds, tick }` — `duration_ticks` discarded
- **After**: `{ midiPitches, noteIds, tick, durationTicks }` — take `durationTicks` from the first note at each tick (all notes in a chord at the same tick share the same duration in standard notation). For a chord (multiple notes at the same tick), use the maximum `duration_ticks` across all notes in case notation tools allow different values — this is defensive.

```typescript
// When creating a new entry:
tickMap.set(note.start_tick, {
  midiPitches: [note.pitch],
  noteIds: [note.id],
  tick: note.start_tick,
  durationTicks: note.duration_ticks,   // NEW
});

// When extending an existing entry (chord):
tickMap.set(note.start_tick, {
  ...existing,
  midiPitches: [...existing.midiPitches, note.pitch],
  noteIds: [...existing.noteIds, note.id],
  durationTicks: Math.max(existing.durationTicks, note.duration_ticks),  // NEW — defensive max
});
```

---

## 5. Scoring Formula (updated)

The post-session score calculation gains one new term:

```
earlyRelease = noteResults.filter(r => r.outcome === 'early-release').length
score = ((correct + (late + earlyRelease) × 0.5) / total) × 100 − min(wrongAttempts × 2, 30)
```

Clamped to [0, 100] as before.

---

## 6. Hold Progress (transient UI state)

Not stored in the engine reducer. Maintained as React state in `PracticeViewPlugin.tsx`:

```typescript
const [holdProgress, setHoldProgress] = useState(0); // 0.0 to 1.0
```

- Updated ≥60 fps via `requestAnimationFrame` loop while `mode === 'holding'`
- Reset to `0` on `EARLY_RELEASE` or STOP/DEACTIVATE
- Visual indicator rendered as a CSS `width: N%` bar only when `holdProgress > 0` and `requiredHoldMs > (960 / ((bpm/60) * 960)) * 1000` (i.e., note longer than one quarter note at current BPM — per A-004)

---

## Invariants

1. `holdStartTimeMs > 0` if and only if `mode === 'holding'`
2. `requiredHoldMs > 0` if and only if `mode === 'holding'`
3. `noteResults` never has two entries at the same `noteIndex` from HOLD_COMPLETE — EARLY_RELEASE entries from retries are the only additional entries per index
4. `durationTicks === 0` bypasses all hold logic — the existing CORRECT_MIDI → advance path is unchanged
