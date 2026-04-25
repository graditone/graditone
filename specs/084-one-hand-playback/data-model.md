# Data Model: One-Hand Playback in Practice Mode

**Branch**: `084-one-hand-playback` | **Date**: 2026-04-25

---

## Domain Entities

### HandMode

A three-state selection that determines which staff's notes are audible during score playback.

| Field | Type | Values | Description |
|-------|------|--------|-------------|
| value | `'both' \| 'right' \| 'left'` | `'both'` (default), `'right'`, `'left'` | The active filtering mode |

**Mapping to staff index**:

| HandMode | staffIndex passed to `setPlaybackStaffFilter` |
|----------|----------------------------------------------|
| `'both'` | `null` (all staves play) |
| `'right'` | `0` (treble staff = staff index 0) |
| `'left'` | `1` (bass staff = staff index 1) |

**Invariants**:
- `HandMode` is only meaningful when a two-stave piano score is loaded (`staffCount >= 2`).
- When `staffCount < 2`, the selector is hidden and `HandMode` is implicitly `'both'`.
- `HandMode` is fixed for the duration of a training session; changes apply from the next session.

---

### PlaybackStaffFilter

A nullable integer held inside `useScorePlayerBridge` that gates which notes enter the playback engine.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `playbackStaffFilter` | `number \| null` | `null` | When `null`, all staves play. When `number`, only notes from `expandedNotesByStaff[n]` are scheduled |

**Location**: State variable in `useScorePlayerBridge` (`scorePlayerContext.ts`)  
**Set via**: `setPlaybackStaffFilter(staffIndex: number | null)` API method  
**Read by**: `useMemo` that derives the `notes` array passed to `usePlayback`

---

### ExerciseConfig (extended)

The existing `ExerciseConfig` interface in `trainTypes.ts` is extended with one optional field to carry hand mode across exercise rounds (FR-003).

```typescript
export interface ExerciseConfig {
  // ...existing fields...
  preset: 'scales' | 'score';
  noteCount: number;
  clef: 'Treble' | 'Bass';
  octaveRange: 1 | 2 | 3 | 4;
  scaleId: string;
  mode: TrainMode;
  stepTimeoutMultiplier: number;
  /**
   * FR-003: Hand mode for one-hand playback filtering.
   * Only active when preset === 'score' and staffCount >= 2.
   * Defaults to 'both' when absent (backward-compatible).
   */
  handMode?: HandMode;
}
```

**Note**: `handMode` is optional to maintain backward compatibility with saved train records and existing test fixtures.

---

## State Transitions

### HandMode state machine (Train plugin, score preset)

```
         ┌────────────────────────────────────────────────────┐
         │                   score loaded                     │
         ▼                                                    │
    [staffCount < 2]  ──────────────────────────────→  hidden (no control)
         │
         ▼
    [staffCount >= 2]
         │
         ▼
    [handMode = 'both'] ←─── user selects "Both" ─────┐
         │                                              │
         │ user selects "Right"                         │
         ▼                                              │
    [handMode = 'right'] ──── user selects "Both" ────→┤
         │                                              │
         │ user selects "Left"                          │
         ▼                                              │
    [handMode = 'left'] ──── user selects "Both" ─────→┘
```

**On hand mode change**:
1. Update local `handMode` state in the plugin
2. Call `context.scorePlayer.setPlaybackStaffFilter(staffIndexForHandMode)`
3. Persist to `localStorage` via `scopedSetItem('train-hand-mode', handMode)`
4. If currently in `playing` phase → change takes effect from next round (FR spec: "change mid-exercise takes effect from next round")

---

## Persistence Schema

### localStorage keys (profile-scoped via `scopedStorage.ts`)

| Raw key | After scoping | Value | Default |
|---------|--------------|-------|---------|
| `train-hand-mode` | `profile:<id>:train-hand-mode` | `'both' \| 'right' \| 'left'` | `'both'` |
| `practice-hand-mode` | `profile:<id>:practice-hand-mode` | `'both' \| 'right' \| 'left'` | `'both'` |

**Read on mount**: Plugin reads the persisted value and calls `setPlaybackStaffFilter` immediately if the score is already loaded.  
**Migration**: Keys absent → default `'both'` (graceful; existing users unaffected).

---

## Relationships

```
Score
  └─ instruments[0]
       └─ staves[]         ← staffIndex 0 = right hand, 1 = left hand
            └─ voices[]
                 └─ interval_events: Note[]
                                         ↑
                              ┌──────────┘
                              │  extractNotesByStaff() partitions here
                              │
                    expandedNotesByStaff: Note[][]
                              │
                    playbackStaffFilter: number | null
                              │
                      filteredNotes: Note[]  ←── passed to usePlayback()
                                                 (via useMemo in useScorePlayerBridge)
```

---

## Validation Rules

1. `staffIndex` passed to `setPlaybackStaffFilter` must be `null` or a non-negative integer within bounds of `expandedNotesByStaff`. Out-of-bounds values are silently clamped to `null` (safe fallback = all notes play).
2. `HandMode` persisted value that does not match `'both' | 'right' | 'left'` is ignored; fallback to `'both'`.
3. If `staffCount` drops below 2 when a new score is loaded while `handMode !== 'both'`, the filter is automatically cleared (`setPlaybackStaffFilter(null)`) and UI selector is hidden.
