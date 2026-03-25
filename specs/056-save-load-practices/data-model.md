# Data Model: Save and Load Practices

**Feature**: 056-save-load-practices  
**Date**: 2026-03-25

## Entities

### SavedPractice (Full Data — stored in IndexedDB)

The complete persisted record of a practice session, including all performance data needed for replay.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | UUID v4, unique identifier (primary key in IndexedDB) |
| `name` | `string` | Yes | Auto-generated name: `{score_name}-{hand}-{scope}-{datetime}` |
| `savedAt` | `string` | Yes | ISO 8601 timestamp of when the practice was saved |
| `scoreRef` | `ScoreRef` | Yes | Reference to the original score (see below) |
| `scoreTitle` | `string` | Yes | Display title of the score at time of saving |
| `staffIndex` | `number` | Yes | Hand selection: 0 (RH), 1 (LH), -1 (BH) |
| `loopRegion` | `{ startTick: number; endTick: number } \| null` | Yes | Loop region boundaries, or null for full score |
| `tempoMultiplier` | `number` | Yes | Tempo multiplier at time of practice |
| `loopCount` | `number` | Yes | Number of loops configured |
| `completionStatus` | `'complete' \| 'partial'` | Yes | Whether practice was finished or stopped mid-session |
| `performanceData` | `PerformanceData` | Yes | Full performance record for replay (see below) |

### ScoreRef (Embedded in SavedPractice)

Reference to identify and load the original score.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `'preloaded' \| 'user'` | Yes | Source type of the score |
| `id` | `string` | Yes | Filename for preloaded scores (e.g., `Beethoven_FurElise.mxl`), IndexedDB UUID for user-uploaded scores |

### PerformanceData (Embedded in SavedPractice)

Serializable copy of the performance record, covering both complete and partial sessions.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `notes` | `PluginPracticeNoteEntry[]` | Yes | The ordered note sequence that was practiced |
| `noteResults` | `PracticeNoteResult[]` | Yes | Per-note outcome data |
| `wrongNoteEvents` | `WrongNoteEvent[]` | Yes | Wrong note attempts during practice |
| `bpmAtCompletion` | `number` | Yes | BPM when practice ended |
| `stoppedAtIndex` | `number \| null` | Yes | Index where practice was stopped (null if complete) |
| `totalNoteCount` | `number \| null` | Yes | Total notes in sequence (null if complete) |

### SavedPracticeIndexEntry (Lightweight metadata — stored in localStorage)

Minimal metadata for fast list rendering in the load score dialog. No performance data.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Same UUID as the full SavedPractice in IndexedDB |
| `name` | `string` | Yes | Auto-generated practice name |
| `savedAt` | `string` | Yes | ISO 8601 timestamp |
| `completionStatus` | `'complete' \| 'partial'` | Yes | For visual distinction in the list |
| `scoreTitle` | `string` | Yes | For display context |

## Relationships

```
SavedPracticeIndex (localStorage)        SavedPractice (IndexedDB)
┌──────────────────────┐                 ┌──────────────────────────┐
│ id ─────────────────────────────────── │ id (primary key)         │
│ name                 │                 │ name                     │
│ savedAt              │                 │ savedAt                  │
│ completionStatus     │                 │ scoreRef: ScoreRef       │
│ scoreTitle           │                 │ scoreTitle               │
└──────────────────────┘                 │ staffIndex               │
                                         │ loopRegion               │
                                         │ tempoMultiplier          │
                                         │ loopCount                │
                                         │ completionStatus         │
                                         │ performanceData          │
                                         └──────────┬───────────────┘
                                                    │
                                                    │ scoreRef.id
                                                    ▼
                                         ┌──────────────────────────┐
                                         │ Score (IndexedDB scores) │
                                         │ OR preloaded MXL file    │
                                         └──────────────────────────┘
```

## Validation Rules

1. `id` must be a valid UUID v4 string.
2. `name` must match the pattern `{sanitized_title}-{RH|LH|BH}-{all|region}-{YYYYMMDDTHHmmss}`.
3. `savedAt` must be a valid ISO 8601 string.
4. `staffIndex` must be one of: -1, 0, 1.
5. `completionStatus` must be `'complete'` or `'partial'`.
6. If `completionStatus === 'partial'`, then `performanceData.stoppedAtIndex` and `performanceData.totalNoteCount` must be non-null numbers.
7. If `completionStatus === 'complete'`, then `performanceData.stoppedAtIndex` and `performanceData.totalNoteCount` must be null.
8. `scoreRef.type` must be `'preloaded'` or `'user'`.
9. Maximum 100 entries in the index; oldest entries are evicted on overflow.

## State Transitions

```
[Practice Active] ──complete──▶ [Results Overlay: Complete]
                   ──stop────▶ [Results Overlay: Partial]

[Results Overlay] ──click Save──▶ [Saving...]
[Saving...] ──success──▶ [Saved ✓] (button disabled)
[Saving...] ──failure──▶ [Save Error] (button re-enabled with error message)

[Load Dialog] ──select practice──▶ [Loading Score...]
[Loading Score...] ──score found──▶ [Results Overlay with saved data]
[Loading Score...] ──score not found──▶ [Error: score unavailable]

[Load Dialog] ──delete practice──▶ [Remove from index + IndexedDB]
```

## IndexedDB Schema

**Database**: `graditone-db`  
**Version**: 2 (bumped from 1)

| Store | Key Path | Indexes | Version Added |
|-------|----------|---------|---------------|
| `scores` | `id` | `lastModified` (non-unique) | 1 |
| `practices` | `id` | `savedAt` (non-unique) | 2 |

## localStorage Keys

| Key | Shape | Max Entries |
|-----|-------|-------------|
| `graditone-user-scores-index` | `UserScore[]` | 20 (existing) |
| `graditone-saved-practices-index` | `SavedPracticeIndexEntry[]` | 100 (new) |
