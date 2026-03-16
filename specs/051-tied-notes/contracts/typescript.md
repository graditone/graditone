# Contract: TypeScript Layer — Tied Notes

**Feature**: `051-tied-notes`  
**Date**: 2026-03-16  
**Direction**: Frontend-internal contracts between playback, practice, and renderer layers

---

## Purpose

Defines interfaces and contracts for the frontend-side logic that consumes the tie information emitted by the WASM layout engine.

---

## `TieResolver` Utility Contract

Location: `frontend/src/services/playback/TieResolver.ts`

```typescript
/**
 * Resolves tied note chains from a raw note list and returns a flattened
 * list of independent playback events with merged durations.
 *
 * CONTRACT:
 * - Input notes MUST be sorted by startTick ascending.
 * - A note with isTieContinuation=true is NOT emitted in the output.
 * - A tie-start note's durationTicks in the output = sum of all notes in the chain.
 * - Non-tied notes pass through unchanged.
 * - Throws if a tie chain references a noteId that does not exist (corrupt data).
 */
export function resolveTiedNotes(notes: Note[]): ResolvedNote[];

export interface ResolvedNote {
  /** The original note (tie start or non-tied note). */
  note: Note;
  /** Combined duration for playback (equals durationTicks if not tied). */
  combinedDurationTicks: number;
}
```

---

## `PlaybackScheduler` Integration Contract

Location: `frontend/src/services/playback/PlaybackScheduler.ts`

```typescript
// BEFORE scheduling, TieResolver must be applied:
// 
// const resolved = resolveTiedNotes(sortedNotes);
// for (const { note, combinedDurationTicks } of resolved) {
//   this.scheduleNote(note, combinedDurationTicks, tempo, tempoMultiplier);
// }
//
// MUST NOT call scheduleNote for notes where note.isTieContinuation === true.
```

**Test requirement**: A unit test MUST verify that given a tie chain of two quarter notes (each 240 ticks at 960 PPQ), the scheduler produces exactly ONE note event with `durationTicks = 480`, not two events.

---

## Practice Note Extraction Contract

Location: `frontend/src/plugin-api/scorePlayerContext.ts` or `practiceEngine.ts`

```typescript
// When building the practice note sequence:
// MUST exclude notes where isTieContinuation === true.
//
// Existing extraction pattern (pseudo):
// const practiceNotes = allNotes
//   .filter(note => !note.isTieContinuation)   // <-- add this filter
//   .map(note => toPracticeNoteEntry(note));
//
// The durationTicks of the tie-start note in PluginPracticeNoteEntry
// SHOULD reflect the combined tied duration (sourced from TieResolver output).
```

---

## `NotationRenderer` Rendering Contract

Location: `frontend/src/components/notation/NotationRenderer.tsx`

```typescript
// For each staff in the layout, after rendering noteheads:
//
// {staff.tieArcs?.map((arc) => (
//   <path
//     key={`tie-${arc.noteIdStart}-${arc.noteIdEnd}`}
//     d={`M ${arc.start.x},${arc.start.y} C ${arc.cp1.x},${arc.cp1.y} ${arc.cp2.x},${arc.cp2.y} ${arc.end.x},${arc.end.y}`}
//     fill="none"
//     stroke="currentColor"
//     strokeWidth={1.5}
//     className="tie-arc"
//   />
// ))}
//
// MUST NOT calculate any arc coordinates — use only what is in arc.start/end/cp1/cp2.
```

---

## Test Contracts

| Test file | What it verifies |
|-----------|-----------------|
| `frontend/tests/unit/TieResolver.test.ts` | `resolveTiedNotes()`: single tie, chain of 3, chord partial tie, non-adjacent notes |
| `frontend/tests/unit/NotationRenderer.test.tsx` | Snapshot: arc `<path>` present for staff with `tieArcs`; absent for staff without |
| `backend/tests/integration/test_tied_notes.rs` | Parse tiednotes_basic.musicxml → Note tie_next links correct; TieArc geometry in layout output |
| `frontend/tests/e2e/tied-notes.spec.ts` | Load app with Chopin score → SVG contains `.tie-arc` path elements |
