# Data Model: Practice View Plugin (External)

**Feature**: `037-practice-view-plugin`  
**Phase**: 1 — Design & Contracts  
**Date**: 2026-03-03  
**Source**: Derived from `spec.md` requirements and `research.md` findings

---

## Plugin API v6 Extensions

These additions are the only changes to `frontend/src/plugin-api/types.ts`. All v5 fields are preserved unchanged.

### New Type: `PluginPracticeNoteEntry`

```
PluginPracticeNoteEntry
├── midiPitches: ReadonlyArray<number>   // All MIDI pitches in this note/chord position (≥1 element)
├── noteIds: ReadonlyArray<string>       // Corresponding opaque note IDs (parallel array to midiPitches)
└── tick: number                         // Absolute tick position in the score (integer, 960-PPQ)
```

**Replaces** the v5 `{ midiPitch: number }` shape in `PluginScorePitches.notes`.  
**Geometry constraint**: carries MIDI integers, opaque IDs, and tick — no (x,y) coordinates.

### Updated Type: `PluginScorePitches` (v6)

```
PluginScorePitches
├── notes: ReadonlyArray<PluginPracticeNoteEntry>  // Ordered note/chord list for the selected staff
├── totalAvailable: number                          // Pre-cap count (unchanged)
├── clef: 'Treble' | 'Bass'                        // Clef of the selected staff (unchanged; now per staffIndex)
└── title: string | null                            // Score display title (unchanged)
```

### Updated Method: `PluginScorePlayerContext.extractPracticeNotes` (v6)

```
extractPracticeNotes(staffIndex: number, maxCount?: number): PluginScorePitches | null
```

- `staffIndex`: 0-based index of the target staff (0 = top/treble, 1 = second/bass, etc.)
- `maxCount`: optional cap on returned notes; omitting returns all notes
- Returns `null` if `scorePlayerState.status !== 'ready'`
- Rests are excluded; chords produce one `PluginPracticeNoteEntry` with all pitches at that tick

### New Field: `ScorePlayerState.staffCount` (v6)

```
ScorePlayerState
└── staffCount: number   // Number of staves in the loaded score (0 when status is 'idle'/'loading'/'error')
```

Added alongside existing fields; default 0 before a score is loaded. Populated once `status === 'ready'`.

---

## Plugin-Internal Data Model

These types live inside `plugins-external/practice-view-plugin/` and are never exposed through the Plugin API.

### `PracticeNoteEntry`

```
PracticeNoteEntry (alias for PluginPracticeNoteEntry consumed by PracticeEngine)
├── midiPitches: ReadonlyArray<number>
├── noteIds: ReadonlyArray<string>
└── tick: number
```

### `PracticeState` (state machine inside `practiceEngine.ts`)

```
PracticeState
├── mode: 'inactive' | 'active' | 'complete'
├── notes: ReadonlyArray<PracticeNoteEntry>   // Full ordered note list for selected staff
├── currentIndex: number                       // Index of the current target note in `notes`
└── selectedStaffIndex: number                 // Which staff is being practised (0-based)
```

**Transitions**:

| From | Event | To | Side Effect |
|------|-------|-----|-------------|
| `inactive` | `START(notes, staffIndex)` | `active` | `currentIndex = 0` |
| `active` | `CORRECT_MIDI(midiNote)` when `currentIndex < notes.length - 1` | `active` | `currentIndex++` |
| `active` | `CORRECT_MIDI(midiNote)` when `currentIndex === notes.length - 1` | `complete` | — |
| `active` | `WRONG_MIDI(midiNote)` | `active` | no change |
| `active` | `STOP` | `inactive` | `currentIndex = 0` |
| `active` | `DEACTIVATE` | `inactive` | `currentIndex` preserved at current position |
| `complete` | `DEACTIVATE` | `inactive` | `currentIndex = 0` |
| any | `SEEK(index)` | (same mode) | `currentIndex = index` |

**`isCorrect(event, targetNote)`**:
```
midiPitch ∈ targetNote.midiPitches  →  correct
```
(exact integer match, exact octave required — spec clarification Q4)

### `SelectedStaff`

```
SelectedStaff
├── index: number          // Staff index (0-based)
└── label: 'Treble' | 'Bass' | string  // Display label from score clef info
```

Stored in `PracticeViewPlugin` component state. Defaults to `{ index: 0 }` for single-staff scores (auto-selected). User-selected for multi-staff scores before Practice mode activates.

---

## Component Data Flow

```
PracticeViewPlugin (root)
│
│  state: ScorePlayerState (from context.scorePlayer.subscribe)
│  state: PracticeState (from usePracticeEngine hook)
│  state: selectedStaff: SelectedStaff
│
├── context.components.ScoreSelector          ← shown when status === 'idle'
│
├── practiceToolbar.tsx
│   ├── Back button        → context.close()
│   ├── Title              ← ScorePlayerState.title
│   ├── Play/Pause         → context.scorePlayer.play() / pause()
│   ├── Stop               → context.scorePlayer.stop() + practiceEngine.dispatch(STOP)
│   ├── Timer              ← ScorePlayerState.currentTick + bpm
│   ├── Tempo control      → context.scorePlayer.setTempoMultiplier()
│   ├── Staff selector     ← ScorePlayerState.staffCount > 1; onSelect → setSelectedStaff
│   └── Practice button    → practiceEngine.dispatch(START | DEACTIVATE)
│
└── context.components.ScoreRenderer
    ├── currentTick        ← ScorePlayerState.currentTick
    ├── highlightedNoteIds ← practiceState.mode === 'active'
    │                          ? new Set(practiceState.notes[currentIndex].noteIds)
    │                          : ScorePlayerState.highlightedNoteIds
    ├── loopRegion         ← (pass-through from scorePlayer state — nil in Practice mode)
    ├── pinnedNoteIds      ← (pass-through from scorePlayer state)
    ├── onNoteShortTap     → if Practice mode active: practiceEngine.dispatch(SEEK to nearest index at tick)
    │                        else: context.scorePlayer.seekToTick(tick)
    ├── onNoteLongPress    → context.scorePlayer.setPinnedStart / setLoopEnd (Practice mode passthrough)
    ├── onCanvasTap        → toggle play/pause (only when Practice mode inactive)
    └── onReturnToStart    → context.scorePlayer.seekToTick(0)
```

---

## MIDI Input Wiring

```
context.midi.subscribe(handler)
│
└── handler({ midiNote, type, timestamp })
    ├── if type !== 'attack': ignore
    ├── if practiceState.mode !== 'active': ignore
    ├── if midiNote ∈ practiceState.notes[currentIndex].midiPitches
    │   └── dispatch CORRECT_MIDI → advance currentIndex
    └── else
        └── dispatch WRONG_MIDI → no change
```

MIDI subscription is active for the entire plugin lifetime (subscribed in `useEffect` on mount, unsubscribed on unmount). Practice-mode filtering is handled in the handler, not by subscribe/unsubscribe cycles.

---

## Entity Relationships

```
PracticeViewPlugin
  1 ── 1   SelectedStaff
  1 ── 1   PracticeState
  1 ── *   PracticeNoteEntry   (the ordered practice sequence)
  1 ── 1   ScorePlayerState    (read-only, from host)
```

All `PracticeNoteEntry` objects are immutable once the practice sequence is extracted at Practice mode activation. The practiceEngine only holds an index — it does not mutate the note list.
