# Data Model: Practice Report Timing Labels (095-state-timing-ms)

> This feature introduces **no schema changes**. It reuses the existing per-note
> practice result entity as the single source of truth for the new State labels.
> This document records the entity contract relevant to the feature.

## Entity: PracticeNoteResult

**Source**: `frontend/plugins/practice-view-plugin/practiceEngine.types.ts:25` (persisted via `frontend/src/services/savedPractice.types.ts:66` in saved practice records).

| Field | Type | Role in this feature |
|-------|------|----------------------|
| `noteIndex` | number | Row ordering in the notes table (unused by this feature beyond rendering). |
| `outcome` | `NoteOutcome` | **Drives the State label.** Values relevant here: `correct-late` (out of time, late/early onset), `early-release` (out of time, released too soon), `correct` (in tolerance), `wrong` / others (not out-of-time). |
| `relativeDeltaMs` | number | **The displayed value.** Signed deviation in ms from expected interval. Positive = late, negative = early, `0` = no measurable deviation. Already persisted and computed for every result. |

Other fields (`playedMidi`, `expectedMidi`, `responseTimeMs`, `expectedTimeMs`, `wrongAttempts`, `holdDurationMs`, `requiredHoldMs`) are unchanged and not consumed by this feature.

## State → Label Mapping (derived / presentation)

This mapping is the presentation contract (see `contracts/status-label-contract.md`). It is derived, not stored.

| `outcome` | Icon (unchanged) | State label text (NEW) |
|-----------|------------------|------------------------|
| `correct-late` | ⏱️ | `+{n} ms` / `-{n} ms` / `0 ms` |
| `early-release` | ⏱️ | `+{n} ms` / `-{n} ms` / `0 ms` |
| `correct` | ✅ | `Correct` (unchanged) |
| anything else (`wrong`, …) | ❌ | `Wrong` (unchanged) |

## Validation Rules (from spec)

- The label amount MUST equal `relativeDeltaMs` rounded to the nearest whole ms (FR-002). Source values are already integers (`Math.round` in `practiceEngine.ts`).
- Sign: `+` when `relativeDeltaMs > 0`, `-` when `< 0`, bare `0 ms` when zero (FR-001).
- Only `correct-late` and `early-release` receive the ms label (FR-003). `correct` and `wrong` labels MUST NOT change (FR-004, FR-005).

## State Transitions

None. `NoteOutcome` and `relativeDeltaMs` are immutable per result, computed once by the practice engine. This feature only changes how already-recorded results are rendered.

## Persistence / Cross-boundary Impact

- Saved practices retain `noteResults: PracticeNoteResult[]` including `relativeDeltaMs` — so reports restored from storage render identical State labels to live reports (FR-007). No migration required.
- No new entities, no new stored state, no IndexedDB/schema change.