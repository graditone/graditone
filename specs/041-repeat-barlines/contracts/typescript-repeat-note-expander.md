# Internal API Contract: TypeScript RepeatNoteExpander Service

**Feature**: 041-repeat-barlines
**Scope**: Frontend playback pre-processing service
**Date**: 2026-06-25

## Context

Playback scheduling (`usePlayback` / `MusicTimeline`) accepts a flat, tick-sorted `Note[]`. Repeat structures require that sections of the piece be played twice. Rather than making the scheduler repeat-aware, a pure pre-processing step (`expandNotesWithRepeats`) is applied at the two integration points before `usePlayback` is called.

---

## Contract 1: Function Signature

**File**: `frontend/src/services/playback/RepeatNoteExpander.ts`

```typescript
import type { Note } from '../../types/score';
import type { RepeatBarline } from '../../types/score';

/**
 * Expands a flat note array to account for repeat sections.
 *
 * @param notes - Notes sorted ascending by start_tick (original score order)
 * @param repeatBarlines - Repeat marker list from Score.repeat_barlines (may be undefined)
 * @returns A new array sorted ascending by start_tick with repeat sections duplicated.
 *           The input array and its Note objects are never mutated.
 */
export function expandNotesWithRepeats(
  notes: Note[],
  repeatBarlines: RepeatBarline[] | undefined
): Note[];
```

**Constraint**: This is a pure function — no side effects, no React hooks, no global state. Identical inputs always produce identical output (deterministic).

---

## Contract 2: Identity Case (No Repeats)

**Pre-conditions**: `repeatBarlines` is `undefined`, `null`, or an empty array.

**Post-conditions**:
- Return value is `notes` (same array reference, unchanged).
- No allocations performed.

---

## Contract 3: Single End-Repeat (Implicit Start)

**Pre-conditions**:
- `repeatBarlines` contains exactly one entry with `barline_type: 'End'` at `end_tick = E`.
- No `Start` marker present → section starts at tick 0.

**Section**: `[0, E)` — all notes with `start_tick < E`.

**Expansion steps**:
1. Collect `sectionNotes = notes.filter(n => n.start_tick < E)`.
2. Compute `sectionDuration = E - 0 = E`.
3. Clone each note with `start_tick += sectionDuration` and `end_tick += sectionDuration`.
4. Build output: `[...originalNotes, ...clones_inserted_at_right_position]` sorted by `start_tick`.

**Post-conditions**: Notes in `[0, E)` appear twice. Notes at `start_tick >= E` appear once, with their original ticks preserved.

---

## Contract 4: Start + End Repeat Pair

**Pre-conditions**:
- `repeatBarlines` contains one `Start` at `start_tick = S` and one `End` at `end_tick = E` where `S < E`.
- No other markers.

**Section**: `[S, E)` — all notes with `S <= start_tick < E`.

**Expansion**:
1. `sectionNotes = notes.filter(n => n.start_tick >= S && n.start_tick < E)`.
2. `sectionDuration = E - S`.
3. Clones have `start_tick += sectionDuration`.
4. Post-section notes (originally at `start_tick >= E`) are shifted by `sectionDuration`.

**Post-conditions**:
- Notes before `S` appear once (unchanged).
- Notes in `[S, E)` appear twice.
- Notes from `E` onward appear once, each shifted by `sectionDuration`.

---

## Contract 5: Multiple Repeat Pairs (La Candeur case)

**Pre-conditions**:
- Section A: implicit start (tick 0) to End at `E_A = 30720`.
- Section B: Start at `S_B = 30720`, End at `E_B = 61440`.
- Section C: no repeat — measures 17–23, ticks `[61440, ~)`.

**Playback plan** (each section with its pass offset):
```
Pass | Section | Original ticks       | Output ticks
-----|---------|----------------------|---------------------
  1  |    A    | [0, 30720)           | [0, 30720)
  2  |    A'   | [0, 30720) + 30720   | [30720, 61440)
  3  |    B    | [30720, 61440) + 30720 | [61440, 92160)
  4  |    B'   | [30720, 61440) + 61440 | [92160, 122880)
  5  |    C    | [61440, ~) + 61440   | [122880, ~)
```

**Running tick offset**: The implementation uses an accumulating `offset` variable.

```typescript
// Pseudocode
let offset = 0;
let cursor = 0;  // tick position in original note stream

for each section in ordered playback plan:
  copy section notes with tick += offset
  offset += sectionDuration
  if repeating: copy again with tick += offset; offset += sectionDuration
  else: cursor advances past section
```

**Post-conditions for La Candeur**:
- 39 sounded measures (SC-001).
- Last note `end_tick` ≤ `149760` (39 × 3840).
- First note `start_tick = 0`.

---

## Contract 6: Integration Points

**ScoreViewer.tsx** (`frontend/src/components/ScoreViewer.tsx`):

```typescript
// Before (current — no repeat expansion):
const allNotes = score.instruments.flatMap(inst =>
  inst.staves.flatMap(stave =>
    stave.voices[0]?.interval_events ?? []
  )
);
usePlayback(allNotes, initialTempo);

// After (with repeat expansion):
const rawNotes = score.instruments.flatMap(inst =>
  inst.staves.flatMap(stave =>
    stave.voices[0]?.interval_events ?? []
  )
);
const allNotes = expandNotesWithRepeats(rawNotes, score.repeat_barlines);
usePlayback(allNotes, initialTempo);
```

**scorePlayerContext.ts** (`frontend/plugins/score-player/scorePlayerContext.ts`):

Same pattern — `rawNotes` collected from `interval_events`, then `expandNotesWithRepeats` applied before `usePlayback`.

**Constraint**: `expandNotesWithRepeats` MUST be called synchronously during render / context initialisation, before `usePlayback` receives the notes. It MUST NOT be called inside a `useEffect` or deferred callback, as `usePlayback` depends on the full expanded array being stable on initial call.

---

## Summary: Usage Contract

| Call site | Input | Output |
|---|---|---|
| `ScoreViewer.tsx` | `rawNotes`, `score.repeat_barlines` | Expanded `allNotes` passed to `usePlayback` |
| `scorePlayerContext.ts` | `rawNotes`, `score.repeat_barlines` | Expanded `allNotes` passed to `usePlayback` |
| Score with no repeats | Any notes, `undefined` / `[]` | Identity — same array returned |
| La Candeur (3 markers) | 23-measure note stream | 39-measure expanded stream (149,760 tick span) |
