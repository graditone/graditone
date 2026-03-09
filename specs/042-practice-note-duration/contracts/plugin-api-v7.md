# Plugin API Contract: v7 (Practice Note Duration)

**Feature**: 042-practice-note-duration  
**Date**: 2026-03-09  
**Previous version**: v6 (Feature 037)  
**Change type**: MINOR — additive field, backward compatible

---

## Changed Interface: `PluginPracticeNoteEntry`

_File_: `frontend/src/plugin-api/types.ts`

### Before (v6)

```typescript
export interface PluginPracticeNoteEntry {
  readonly midiPitches: ReadonlyArray<number>;
  readonly noteIds: ReadonlyArray<string>;
  readonly tick: number;
}
```

### After (v7)

```typescript
export interface PluginPracticeNoteEntry {
  readonly midiPitches: ReadonlyArray<number>;
  readonly noteIds: ReadonlyArray<string>;
  readonly tick: number;
  /**
   * Written note duration in ticks (960 PPQ integer).
   * 
   * For chords: the maximum duration_ticks across all notes at this tick
   * (defensive — standard notation has all chord notes share the same duration).
   *
   * 0 means no duration checking applies (random/scale modes, or a future case
   * where duration is not available). When 0, consumers MUST skip hold validation
   * and advance immediately on correct pitch press, as in v6 behaviour.
   *
   * To convert to milliseconds: requiredHoldMs = (durationTicks / ((bpm / 60) * 960)) * 1000
   * where bpm is the current session playback tempo (playerState.bpm).
   *
   * v7 addition: Feature 042
   */
  readonly durationTicks: number;
}
```

---

## Changed Type: `NoteOutcome`

_File_: `frontend/plugins/practice-view-plugin/practiceEngine.types.ts`

### Before (v6)

```typescript
export type NoteOutcome = 'correct' | 'correct-late' | 'wrong' | 'pending';
```

### After (v7)

```typescript
export type NoteOutcome = 'correct' | 'correct-late' | 'wrong' | 'early-release' | 'pending';
```

**`'early-release'`**: Correct pitch was pressed but all required pitches were released before 90% of the required hold duration elapsed. Score weight: 0.5 (same as `'correct-late'`).

---

## Changed Type: `PracticeMode`

_File_: `frontend/plugins/practice-view-plugin/practiceEngine.types.ts`

### Before (v6)

```typescript
export type PracticeMode = 'inactive' | 'waiting' | 'active' | 'complete';
```

### After (v7)

```typescript
export type PracticeMode = 'inactive' | 'waiting' | 'active' | 'holding' | 'complete';
```

**`'holding'`**: The engine is waiting for the current note's hold duration to reach 90% of `requiredHoldMs`. The user has already pressed the correct pitches. The session does not advance until `HOLD_COMPLETE` is dispatched.

---

## Changed Interface: `PracticeNoteResult`

_File_: `frontend/plugins/practice-view-plugin/practiceEngine.types.ts`

### Added fields (v7)

```typescript
/**
 * Actual hold duration in ms (wall-clock time from pitch press to release or
 * HOLD_COMPLETE). 0 when durationTicks was 0 for this note (no hold tracking).
 */
readonly holdDurationMs: number;

/**
 * Required hold duration in ms derived from durationTicks and session BPM.
 * 0 when durationTicks was 0 for this note.
 */
readonly requiredHoldMs: number;
```

---

## Changed Interface: `PracticeState`

_File_: `frontend/plugins/practice-view-plugin/practiceEngine.types.ts`

### Added fields (v7)

```typescript
/**
 * Wall-clock ms (Date.now()) when the current note was correctly pressed.
 * 0 when mode is not 'holding'.
 */
readonly holdStartTimeMs: number;

/**
 * Required hold duration (ms) for the note currently being held.
 * 0 when mode is not 'holding'.
 */
readonly requiredHoldMs: number;
```

---

## New Actions

_File_: `frontend/plugins/practice-view-plugin/practiceEngine.types.ts`

```typescript
| {
    /**
     * Dispatched by the React component when the hold duration threshold
     * (90% of requiredHoldMs) is reached while in 'holding' mode.
     */
    readonly type: 'HOLD_COMPLETE';
    /** Actual hold duration in ms at dispatch time. */
    readonly holdDurationMs: number;
    /** Expected time in ms (forwarded from the original CORRECT_MIDI). */
    readonly expectedTimeMs: number;
    /** Optional loop-region end index. */
    readonly endIndex?: number;
  }
| {
    /**
     * Dispatched by the MIDI release handler when any required pitch is
     * released before the hold threshold while in 'holding' mode.
     */
    readonly type: 'EARLY_RELEASE';
    /** Actual hold duration in ms at release time. */
    readonly holdDurationMs: number;
    /** Expected time in ms (forwarded from the original CORRECT_MIDI). */
    readonly expectedTimeMs: number;
  }
```

---

## Updated `INITIAL_PRACTICE_STATE`

```typescript
export const INITIAL_PRACTICE_STATE: PracticeState = {
  mode: 'inactive',
  notes: [],
  currentIndex: 0,
  selectedStaffIndex: 0,
  noteResults: [],
  currentWrongAttempts: 0,
  wrongNoteEvents: [],
  holdStartTimeMs: 0,   // NEW
  requiredHoldMs: 0,    // NEW
};
```

---

## Behavioral Contract for `extractPracticeNotes`

**Host responsibility** (`frontend/src/plugin-api/scorePlayerContext.ts`):

- When building `PluginPracticeNoteEntry` from score notes, the host MUST populate `durationTicks` from `note.duration_ticks`.
- For chords (multiple notes at the same tick), take `Math.max(...durations)`.
- For score-based sessions: `durationTicks > 0` always (notes always have positive duration).
- For random-note/scale modes (no score loaded): `durationTicks = 0`.

**Plugin responsibility** (`practiceEngine.ts`):

- When receiving `CORRECT_MIDI` and the corresponding entry has `durationTicks > 0`, the engine MUST transition to `'holding'` mode.
- When `durationTicks === 0`, advance immediately as before.

---

## Breaking Changes

None. `durationTicks` is a new required field on `PluginPracticeNoteEntry`, but:
- Only the host (`scorePlayerContext.ts`) produces `PluginPracticeNoteEntry` objects.
- Only the practice plugin consumes them.
- Both are updated together in this feature.

No other plugins or consumers use `PluginPracticeNoteEntry`.

---

## Validation Invariants (for tests)

| Invariant | Rule |
|-----------|------|
| V-001 | `durationTicks >= 0` for all entries |
| V-002 | `durationTicks === 0` → CORRECT_MIDI advances immediately, no hold state set |
| V-003 | `durationTicks > 0` → CORRECT_MIDI sets mode to `'holding'`, sets `holdStartTimeMs > 0` |
| V-004 | HOLD_COMPLETE while `mode !== 'holding'` → no-op (returns same state) |
| V-005 | EARLY_RELEASE while `mode !== 'holding'` → no-op |
| V-006 | After EARLY_RELEASE: `holdStartTimeMs === 0`, `requiredHoldMs === 0`, `mode === 'holding'` (stays), `noteResults` has one new entry with `outcome === 'early-release'` |
| V-007 | After HOLD_COMPLETE: `holdStartTimeMs === 0`, `requiredHoldMs === 0`, mode advances, `noteResults` has one new entry with `outcome === 'correct'` or `'correct-late'` |
| V-008 | WRONG_MIDI while `mode === 'holding'` → same as while `mode === 'active'` (increment `currentWrongAttempts`, mode stays `'holding'`) |
