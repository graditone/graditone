# Data Model: Free Mode Measure Detection

**Feature**: 094 — Free Mode Measure Detection
**Date**: 2026-08-30

> **Scope note**: No persistence-schema changes. `FreeMidiEvent` / `FreeMidiRecord`
> remain the stored contract; measure segmentation is always *derived* from it.
> Derived entities below are computed at detection/render time (D5).

## Entities

### FreeMidiRecord (stored — unchanged contract)

Serializable snapshot of a completed free practice session. Defined in
`frontend/src/services/savedPractice.types.ts`.

| Field | Type | Notes |
|-------|------|-------|
| `events` | `FreeMidiEvent[]` | Ordered by `timestampMs`. Sole source of truth for detection. |
| `elapsedMs` | `number` | Wall-clock duration at Stop (informational only — not a timing source for measures). |
| `noteCount` | `number` | `=== events.length`. |
| `bpm` | `number` | Effective BPM at Stop (slider-derived, floored). Determines beat length in detection. |

### FreeMidiEvent (stored — unchanged contract)

| Field | Type | Notes |
|-------|------|-------|
| `midiNote` | `number` | MIDI pitch 0–127. |
| `timestampMs` | `number` | Wall-clock ms from session start at attack. Relative offsets define onsets. |
| `durationMs` | `number \| undefined` | Hold duration in ms; undefined only for legacy/never-released events. |

### Measure (derived at detection time)

Span produced by `detectMeasures`. Not stored.

| Field | Type | Notes |
|-------|------|-------|
| `index` | `number` | 0-based measure number. |
| `startMs` | `number` | First-onset-anchored grid position. |
| `endMs` | `number` | `startMs + 4 × msPerBeat`. |
| `complete` | `boolean` | `sum(detected durations) === 4 beats` (trailing partial measure → `false`). |
| `notes` | `DetectedNote[]` | Detected notes assigned to this measure. |
| `rests` | `DetectedRest[]` | Only where a genuine gap ≥ 1 beat existed. |

### DetectedNote (derived)

| Field | Type | Notes |
|-------|------|-------|
| `midiNote` | `number` | |
| `startStep` | `number` | 0–15 within the measure (1/16 grid). |
| `durationSteps` | `number` | 1–16; `clamp(round(durationMs/msPerSixteenth), 1, 16 - startStep)`. |
| `value` | `string` | Quantized note value: `1/4`, `1/8`, `1/16` (or longer values for multi-step notes). |
| `acrossBarLine` | `boolean` | `true` when displayed duration extends past the measure (display concern only). |

### DetectedRest (derived)

| Field | Type | Notes |
|-------|------|-------|
| `startStep` | `number` | 0-based 1/16 position. |
| `durationSteps` | `number` | ≥ 4 (≥ 1 beat). |
| `value` | `string` | Rest value from greedy decomposition (whole/half/quarter/8th/16th). |

### Beat Grid (derived)

| Attribute | Value |
|-----------|-------|
| Anchor | `events[0].timestampMs` (first onset) — measure 1 starts there (R-002). |
| Beat length | `60_000 / bpm` ms, where `bpm` = effective session BPM. |
| Grid cell | `msPerBeat / 4` ms (1/16). |
| Sources | **Only** onsets (never metronome/wall-clock; FR-001, SC-007). |

## Relationships

```
FreeMidiRecord 1 ── * FreeMidiEvent
FreeMidiRecord 1 ──> * Measure      (derived via detectMeasures)
Measure        1 ── * DetectedNote / DetectedRest
DetectedNote   1 ── 1 FreeMidiEvent (each onset belongs to exactly one measure & note)
```

## Validation / constraints (from FRs)

- FR-002/FR-003: complete measures MUST sum to exactly `4 beats` (16 steps); no missing/surplus time.
- FR-013/SC-008: detected values ∈ {…, 1/4, 1/8, 1/16}; never finer than 1/16.
- FR-005/SC-003: `DetectedRest.durationSteps ≥ 4`; sub-beat gaps never produce rests.
- FR-006: at most ONE trailing partial measure (`complete === false`) at the very end.
- FR-010: simultaneous onsets map to one `startStep` — chords count as one beat unit (detected per-pitch, positions equal).
- FR-009: `acrossBarLine` flag may extend a note past its measure for display without changing detection sums.