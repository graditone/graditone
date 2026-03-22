# Data Model: Fix Practice Mode MIDI Detection

**Phase**: 1 — Design  
**Feature**: `001-fix-practice-midi-detection`

All entities below exist in the codebase already. This document records which fields change, which types expand, and which extraction rules are updated. No new tables, stores, or routes are introduced (frontend-only fix, no persistence).

---

## 1. `NoteOutcome` — Add `'auto-advanced'` variant

**File**: `frontend/plugins/practice-view-plugin/practiceEngine.types.ts`

### Current definition
```typescript
export type NoteOutcome = 'correct' | 'correct-late' | 'wrong' | 'pending' | 'early-release';
```

### Updated definition
```typescript
export type NoteOutcome =
  | 'correct'
  | 'correct-late'
  | 'wrong'
  | 'pending'
  | 'early-release'
  | 'auto-advanced';   // ← new: beat skipped after MAX_CONSECUTIVE_WRONG wrong presses
```

### Semantics
| Outcome | Score weight | Session advance |
|---------|-------------|-----------------|
| `'correct'` | 1.0 | ✓ |
| `'correct-late'` | 0.5 | ✓ |
| `'wrong'` | 0 (penalty) | ✗ |
| `'early-release'` | 0 (retry) | ✗ |
| `'auto-advanced'` | 0 (penalty, same weight as `'wrong'`) | ✓ |

The `'auto-advanced'` outcome is a forced advance and is useful for diagnostics and practice-replay display. It carries no score credit.

---

## 2. `PracticeState` — No structural changes

**File**: `frontend/plugins/practice-view-plugin/practiceEngine.types.ts`

The existing field `currentWrongAttempts: number` is reused as the auto-advance counter. It already:
- Increments on each `WRONG_MIDI` action
- Resets to `0` on `CORRECT_MIDI` / `HOLD_COMPLETE` / `LOOP_RESTART` / `SEEK` / `START`

No new fields are added to `PracticeState`. The threshold is enforced purely inside the reducer using the new exported constant (see §4).

---

## 3. `PracticeNoteResult` — No structural changes

**File**: `frontend/plugins/practice-view-plugin/practiceEngine.types.ts`

The existing fields accommodate an `'auto-advanced'` result without modification:
- `outcome: NoteOutcome` — expanded by §1
- `wrongAttempts: number` — records how many wrong presses occurred before auto-advance
- `playedMidi: number` — set to `0` for auto-advanced beats (no correct pitch was played)
- `holdDurationMs: number` — `0` (no hold)
- `requiredHoldMs: number` — `0` (no hold)

---

## 4. New constant: `MAX_CONSECUTIVE_WRONG`

**File**: `frontend/plugins/practice-view-plugin/practiceEngine.ts`

```typescript
/**
 * Number of consecutive wrong MIDI presses on a single beat before the
 * practice engine auto-advances past it (FR-003a).
 * Exported for test access (align with LATE_THRESHOLD_MS export pattern).
 * Default: 3.
 */
export const MAX_CONSECUTIVE_WRONG = 3;
```

This constant lives alongside the existing `LATE_THRESHOLD_MS = 500` export. It is the only change to configurable values in the engine.

---

## 5. `extractPracticeNotes()` — Staccato extraction rule change

**File**: `frontend/src/plugin-api/scorePlayerContext.ts`

### Current rule
```typescript
if (entry.hasStaccato) {
  entry.durationTicks = Math.round(entry.durationTicks * 0.5);  // halved
}
```

### Updated rule
```typescript
if (entry.hasStaccato) {
  entry.durationTicks = 0;  // staccato: pitch-only validation, no hold required
}
```

### Rationale
`durationTicks === 0` is the established contract in `PluginPracticeNoteEntry` for "advance immediately on correct press." See `types.ts` lines 305–315 for JSDoc contract. Staccato means detached playing — requiring hold duration is musically incorrect.

The existing `hasStaccato` property on the internal score model is read here; it is NOT propagated through to `PluginPracticeNoteEntry` (see `research.md` Decision 6).

---

## 6. ChordDetector pin logic — Conceptual change only

**File**: `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`  
**Type system impact**: None — `ChordDetector` public API unchanged

### Current pin logic (buggy)
```typescript
const prevEntry = ps.currentIndex > 0 ? ps.notes[ps.currentIndex - 1] : null;
const prevPitches = prevEntry ? (prevEntry.midiPitches as number[]) : [];

for (const pitch of onset) {
  // Only pins if pitch was also in the PREVIOUS entry
  if (prevPitches.includes(pitch) && heldMidiKeysRef.current.has(pitch)) {
    chordDetectorRef.current.pin(pitch);
  }
}
for (const pitch of sustained) {
  if (heldMidiKeysRef.current.has(pitch)) {
    chordDetectorRef.current.pin(pitch);
  }
}
```

### Updated pin logic
```typescript
// Pin ALL currently-held pitches that are required for the current chord:
// - Notes from the previous entry still physically held (cross-voice sustain)
// - Notes from the SAME entry still held after EARLY_RELEASE (retry scenario)
const allRequired = [...onset, ...sustained];
for (const pitch of allRequired) {
  if (heldMidiKeysRef.current.has(pitch)) {
    chordDetectorRef.current.pin(pitch);
  }
}
```

### Invariant preserved
`ChordDetector.pin(midi)` is a no-op if `midi` is not in the current `required` set (it checks internally). Pinning a note that the user does not happen to hold has no effect — `heldMidiKeysRef.current.has(pitch)` already guards this.

### Why this fixes the HL+HR chord retry
After `EARLY_RELEASE` from an HL+HR chord:
- `currentIndex` is unchanged; the same chord is required
- The LH notes are still physically held → `heldMidiKeysRef.current` contains them
- Old logic: `prevPitches` are from the previous beat — unless the previous beat also had the exact same LH pitches, they don't match → LH pitches NOT pinned
- New logic: all held pitches in `allRequired` are pinned immediately → user re-presses only RH note → chord completes → session advances

---

## 7. Auto-advance state transition in reducer

**File**: `frontend/plugins/practice-view-plugin/practiceEngine.ts`  
**Action**: `WRONG_MIDI`

### Logic added to `WRONG_MIDI` case
```typescript
case 'WRONG_MIDI': {
  // ... existing wrong-note event recording ...
  const newWrongAttempts = state.currentWrongAttempts + 1;

  if (newWrongAttempts >= MAX_CONSECUTIVE_WRONG) {
    // Build auto-advanced result for this beat
    const autoResult: PracticeNoteResult = {
      noteIndex: state.currentIndex,
      outcome: 'auto-advanced',
      playedMidi: action.midiNote,
      expectedMidi: state.notes[state.currentIndex].midiPitches as number[],
      responseTimeMs: action.responseTimeMs,
      expectedTimeMs: 0,
      relativeDeltaMs: 0,
      wrongAttempts: newWrongAttempts,
      holdDurationMs: 0,
      requiredHoldMs: 0,
    };
    const nextIndex = state.currentIndex + 1;
    const isSessionEnd = nextIndex >= state.notes.length;
    return {
      ...state,
      mode: isSessionEnd ? 'complete' : 'active',
      currentIndex: isSessionEnd ? state.notes.length - 1 : nextIndex,
      noteResults: [...state.noteResults, autoResult],
      currentWrongAttempts: 0,
      wrongNoteEvents: [...state.wrongNoteEvents, wrongNoteEvent],
    };
  }

  // Normal wrong-note case (existing behaviour, currentIndex unchanged)
  return {
    ...state,
    currentWrongAttempts: newWrongAttempts,
    wrongNoteEvents: [...state.wrongNoteEvents, wrongNoteEvent],
  };
}
```

### State transitions

```
active (wrong press, n < MAX_CONSECUTIVE_WRONG)
  → active (same index, currentWrongAttempts += 1)

active (wrong press, n === MAX_CONSECUTIVE_WRONG)
  → active (next index,  currentWrongAttempts = 0, noteResults += auto-advanced)
  → complete (if last index)
```

---

## Summary of Changes

| Entity | File | Change |
|--------|------|--------|
| `NoteOutcome` | `practiceEngine.types.ts` | Add `'auto-advanced'` variant |
| `MAX_CONSECUTIVE_WRONG` | `practiceEngine.ts` | New exported constant (value: `3`) |
| `extractPracticeNotes()` staccato | `scorePlayerContext.ts` | `× 0.5` → `= 0` |
| ChordDetector pin logic | `PracticeViewPlugin.tsx` | Pin all held pitches in required chord, not only those from prev entry |
| `WRONG_MIDI` reducer case | `practiceEngine.ts` | Auto-advance after `MAX_CONSECUTIVE_WRONG` wrong presses |
