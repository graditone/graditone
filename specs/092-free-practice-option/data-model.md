# Data Model: Free Practice Option (Feature 092)

**Branch**: `092-free-practice-option`  
**Created**: 2026-05-31

---

## New Types

### `FreeMidiEvent`

A single MIDI note-attack event captured during a free practice session.

```
FreeMidiEvent {
  midiNote:    number   // MIDI pitch (0–127)
  timestampMs: number   // Wall-clock ms from session start
}
```

**Validation rules**:
- `midiNote` ∈ [0, 127]
- `timestampMs` ≥ 0

---

### `FreeMidiRecord`

Snapshot of a completed or stopped free practice session, used for display and replay.

```
FreeMidiRecord {
  events:         FreeMidiEvent[]  // All note-attack events, ordered by timestampMs
  elapsedMs:      number           // Total wall-clock duration of the session in ms
  noteCount:      number           // Derived: events.length (stored for fast display)
  bpm:            number           // BPM at session end (default 80, user-adjustable)
}
```

**Notes**:
- `noteCount` is redundant with `events.length` but stored explicitly to avoid deserialising the full event list when only the summary is needed.
- `elapsedMs` is captured at the moment the user presses Stop.

---

## Modified Types

### `ScoreRef` (in `savedPractice.types.ts`)

Add `'free'` to the discriminated union:

```
ScoreRef =
  | { type: 'preloaded'; id: string }   // existing
  | { type: 'user';      id: string }   // existing
  | { type: 'free';      id: '' }       // NEW — free practice, no score
```

**Constraint**: When `type === 'free'`, `id` MUST be the empty string `''`. The load handler checks `scoreRef.type === 'free'` to skip score loading.

---

### `SavedPractice` (in `savedPractice.types.ts`)

Add an optional `freeMidiRecord` field:

```
SavedPractice {
  // ... existing fields unchanged ...
  freeMidiRecord?: FreeMidiRecord   // NEW — present only when scoreRef.type === 'free'
}
```

**Validation rules**:
- `freeMidiRecord` MUST be present when `scoreRef.type === 'free'`
- `freeMidiRecord` MUST be absent when `scoreRef.type !== 'free'`
- `performanceData.notes` MUST be an empty array when `scoreRef.type === 'free'`

---

## New Functions

### `generateFreePracticeName(date: Date): string`

Pure function in `savedPracticeStorage.ts`.

**Signature**:
```typescript
generateFreePracticeName(date: Date): string
```

**Format**: `FreePractice-{YYYYMMDDTHHmmss}` using local time.

**Example output**: `FreePractice-20260531T112233`

**Test contract**:
- Given `new Date('2026-05-31T11:22:33')`, returns `'FreePractice-20260531T112233'`
- Does not contain score name, hand, or scope segments

---

## State Changes in `PracticeViewPlugin`

### New state / refs added

| State / Ref | Type | Initial value | Purpose |
|---|---|---|---|
| `isFreePractice` | `boolean` (state) | `false` | Activates free practice mode throughout the component |
| `freeMidiEventsRef` | `MutableRefObject<FreeMidiEvent[]>` | `[]` | Accumulates MIDI events during free session |
| `freeElapsedMsRef` | `MutableRefObject<number>` | `0` | Running elapsed ms (updated by interval) |
| `freeNoteCount` | `number` (state) | `0` | Displayed note count; updated on each MIDI event |
| `freeElapsedDisplay` | `string` (state) | `'00:00'` | Formatted elapsed time for toolbar |
| `freeMidiRecord` | `FreeMidiRecord \| null` (state) | `null` | Snapshot set on Stop; consumed by results overlay and save |

### Lifecycle

```
[ScoreSelector shown]
  ↓ user clicks "Free Practice"
  → setIsFreePractice(true)
  → freeMidiEventsRef.current = []
  → freeNoteCount = 0, freeMidiRecord = null

[Free Practice View shown — no score loaded]
  → MIDI events → push to freeMidiEventsRef; setFreeNoteCount(n+1)
  → setInterval(1000) → update freeElapsedDisplay

  ↓ user clicks ■ Stop Practice
  → snapshot freeMidiRecord from ref + elapsed
  → dispatchPractice({ type: 'STOP' })
  → setResultsOverlayVisible(true)

[Results overlay shown — simplified]
  ↓ Save → handleFreeSave()
  ↓ Replay → handleFreeReplay()
  ↓ Repractice → reset to fresh free session (skip ScoreSelector)

  ↓ Back pressed
  → setIsFreePractice(false); return to ScoreSelector
```

---

## No Changes Required

- `practiceEngine.ts` / `practiceEngine.types.ts` — free practice never starts a `START` action; the engine stays `'inactive'`
- `usePracticeMidi.ts` — MIDI subscription is unchanged; MIDI events are also forwarded to `freeMidiEventsRef` in the orchestrator
- IndexedDB schema version — `freeMidiRecord` is added as an optional field; existing records lack it and load cleanly (graceful default: `undefined`)
- Plugin API version — no new required props; `onFreePractice` is optional
