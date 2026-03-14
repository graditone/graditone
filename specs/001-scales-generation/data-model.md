# Data Model: Scales Generation

**Phase**: 1 | **Date**: 2026-03-14 | **Feature**: [spec.md](spec.md)

---

## Entities

### PreloadedScore (existing — unchanged)

Represents a single bundled score file loadable from the app.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Stable unique identifier (e.g., `c-major-oct4`) |
| `displayName` | `string` | Human-readable label (e.g., `"C Major — Octave 4"`) |
| `path` | `string` | URL relative to `BASE_URL` (e.g., `"/scores/scales/C_major_oct4.mxl"`) |

**No changes** to `PreloadedScore`. Scale score files conform exactly to this shape.

---

### ScoreGroup (new)

A named collection of scores from a single subfolder, displayed as a collapsible group in the load score dialog.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Stable unique identifier for this group (e.g., `"scales"`) |
| `displayName` | `string` | Label shown in group header (e.g., `"Scales"`) |
| `scores` | `ReadonlyArray<PreloadedScore>` | Ordered list of scores within this group |

**Invariants**:
- `scores` is non-empty when the group appears in the dialog; a group with zero scores is hidden entirely (FR-006: hide if empty)
- `scores` ordering: circle of fifths (major oct4, major oct5, minor oct4, minor oct5)

---

### PreloadedCatalog (new)

The complete collection of preloaded scores, structured as ungrouped top-level entries and named subfolder groups.

| Field | Type | Description |
|---|---|---|
| `ungrouped` | `ReadonlyArray<PreloadedScore>` | Top-level scores (existing classical pieces) |
| `groups` | `ReadonlyArray<ScoreGroup>` | Subfolder groups (initially just `scales`); empty groups omitted |

**Derivation**: `PRELOADED_CATALOG` is assembled at module initialisation from `PRELOADED_SCORES` (ungrouped) and `SCALE_SCORE_GROUPS` (groups). Both source arrays remain independently exported for backward compatibility and testing.

---

## Scale Score File Catalogue

### Major Scales — 24 files

| Circle of fifths position | Root | Display name prefix | Filename prefix | Fifths | oct4 file | oct5 file |
|---|---|---|---|---|---|---|
| 1 | C | C Major | C_major | 0 | C_major_oct4.mxl | C_major_oct5.mxl |
| 2 | G | G Major | G_major | 1 | G_major_oct4.mxl | G_major_oct5.mxl |
| 3 | D | D Major | D_major | 2 | D_major_oct4.mxl | D_major_oct5.mxl |
| 4 | A | A Major | A_major | 3 | A_major_oct4.mxl | A_major_oct5.mxl |
| 5 | E | E Major | E_major | 4 | E_major_oct4.mxl | E_major_oct5.mxl |
| 6 | B | B Major | B_major | 5 | B_major_oct4.mxl | B_major_oct5.mxl |
| 7 | F# | F# Major | Fs_major | 6 | Fs_major_oct4.mxl | Fs_major_oct5.mxl |
| 8 | D♭ | D♭ Major | Db_major | -5 | Db_major_oct4.mxl | Db_major_oct5.mxl |
| 9 | A♭ | A♭ Major | Ab_major | -4 | Ab_major_oct4.mxl | Ab_major_oct5.mxl |
| 10 | E♭ | E♭ Major | Eb_major | -3 | Eb_major_oct4.mxl | Eb_major_oct5.mxl |
| 11 | B♭ | B♭ Major | Bb_major | -2 | Bb_major_oct4.mxl | Bb_major_oct5.mxl |
| 12 | F | F Major | F_major | -1 | F_major_oct4.mxl | F_major_oct5.mxl |

### Natural Minor Scales — 24 files

Ordered by root note in circle of fifths order (C, G, D, A, E, B, F#, C#, G#, D#, B♭, F):

| Circle of fifths position | Root | Display name prefix | Filename prefix | Fifths | oct4 file | oct5 file |
|---|---|---|---|---|---|---|
| 1 | C | C Minor | C_minor | -3 | C_minor_oct4.mxl | C_minor_oct5.mxl |
| 2 | G | G Minor | G_minor | -2 | G_minor_oct4.mxl | G_minor_oct5.mxl |
| 3 | D | D Minor | D_minor | -1 | D_minor_oct4.mxl | D_minor_oct5.mxl |
| 4 | A | A Minor | A_minor | 0 | A_minor_oct4.mxl | A_minor_oct5.mxl |
| 5 | E | E Minor | E_minor | 1 | E_minor_oct4.mxl | E_minor_oct5.mxl |
| 6 | B | B Minor | B_minor | 2 | B_minor_oct4.mxl | B_minor_oct5.mxl |
| 7 | F# | F# Minor | Fs_minor | 3 | Fs_minor_oct4.mxl | Fs_minor_oct5.mxl |
| 8 | C# | C# Minor | Cs_minor | 4 | Cs_minor_oct4.mxl | Cs_minor_oct5.mxl |
| 9 | G# | G# Minor | Gs_minor | 5 | Gs_minor_oct4.mxl | Gs_minor_oct5.mxl |
| 10 | D# | D# Minor | Ds_minor | 6 | Ds_minor_oct4.mxl | Ds_minor_oct5.mxl |
| 11 | B♭ | B♭ Minor | Bb_minor | -5 | Bb_minor_oct4.mxl | Bb_minor_oct5.mxl |
| 12 | F | F Minor | F_minor | -4 | F_minor_oct4.mxl | F_minor_oct5.mxl |

---

## State Transitions

The `<details>` element manages open/closed state natively. No React state required.

| State | Trigger | Outcome |
|---|---|---|
| Group closed (default) | User clicks group header | Group expands, scale list visible |
| Group open | User clicks group header | Group collapses, scale list hidden |
| Group open | User selects a scale | Score loads; dialog closes; group state reset on next open |

---

## Scale Pitch Tables (MIDI semitone offsets from root)

**Major intervals**: `[0, 2, 4, 5, 7, 9, 11, 12]` (W-W-H-W-W-W-H)  
**Natural minor intervals**: `[0, 2, 3, 5, 7, 8, 10, 12]` (W-H-W-W-H-W-W)  
**Descending**: reverse of ascending, excluding duplicate root (root at top already present)

Bar layout (4/4, quarter notes):
```
Bar 1: notes 1–4 ascending
Bar 2: notes 5–8 ascending (including octave root)
Bar 3: notes 9–12 descending
Bar 4: notes 13–16 descending (returning to root)
```
