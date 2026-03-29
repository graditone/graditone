# WASM Dynamics API Contract (Feature 063)

**Date**: 2026-03-29  
**Boundary**: Backend Rust/WASM → Frontend TypeScript  
**Protocol**: wasm-bindgen serialisation (serde JSON via JsValue)

## Overview

The backend `parse_musicxml()` WASM function already returns a `ScoreDto` containing notes, measures, metadata etc. This contract extends `ScoreDto` with dynamics data.

## Extended Types

### ScoreDto Extension

The existing `ScoreDto` serialized from Rust gains new fields:

```typescript
interface ScoreDto {
  // ...existing fields (metadata, parts, measures, notes, etc.)...

  /** Dynamic markings extracted from <dynamics> elements */
  dynamics: DynamicMarkingDto[];

  /** Gradual dynamics (crescendo/diminuendo) extracted from <wedge> elements */
  gradual_dynamics: GradualDynamicDto[];
}
```

### DynamicMarkingDto

```typescript
interface DynamicMarkingDto {
  /** Dynamic level name: "ppp" | "pp" | "p" | "mp" | "mf" | "f" | "ff" | "fff" */
  marking: string;

  /** MIDI velocity value (1–127). From <sound dynamics="N"/> or standard mapping */
  velocity: number;

  /** Absolute tick position where this dynamic takes effect */
  start_tick: number;

  /** Staff number (1-based) */
  staff: number;
}
```

### GradualDynamicDto

```typescript
interface GradualDynamicDto {
  /** "crescendo" | "diminuendo" */
  direction: string;

  /** Absolute tick position where the wedge begins */
  start_tick: number;

  /** Absolute tick position where the wedge ends */
  stop_tick: number;

  /** Staff number (1-based) */
  staff: number;
}
```

### NoteDto Extension

The existing note serialisation gains an optional velocity field:

```typescript
interface NoteDto {
  // ...existing fields (id, start_tick, duration_ticks, pitch, etc.)...

  /** Computed velocity (1–127) based on the active dynamic at this note's position.
   *  Omitted or undefined means default (80 = mf). */
  velocity?: number;
}
```

## Contract Rules

1. **Backwards compatibility**: `dynamics` and `gradual_dynamics` arrays MAY be empty (e.g., scores without dynamic markings). Frontend MUST handle empty arrays gracefully.
2. **Ordering**: `dynamics` array MUST be sorted by `start_tick` ascending. `gradual_dynamics` array MUST be sorted by `start_tick` ascending.
3. **Velocity clamping**: All `velocity` values MUST be in range 1–127. Values from `<sound dynamics="N"/>` are clamped to this range.
4. **Wedge completeness**: `gradual_dynamics` MUST only contain complete wedges (both start and stop resolved). Incomplete wedges (start without matching stop) are omitted with a parser warning.
5. **Staff scoping**: `staff` values use 1-based indexing matching MusicXML convention. If a `<direction>` has no `<staff>` child, default to staff 1.
6. **Note velocity**: If the backend provides `velocity` on `NoteDto`, the frontend uses it directly. If absent, the frontend's `DynamicsResolver` computes it from `dynamics` and `gradual_dynamics` arrays. The backend pre-computing velocity on each note is the preferred path (single source of truth).

## Serialisation Example

```json
{
  "dynamics": [
    { "marking": "p", "velocity": 49, "start_tick": 0, "staff": 1 },
    { "marking": "f", "velocity": 96, "start_tick": 3840, "staff": 1 }
  ],
  "gradual_dynamics": [
    { "direction": "crescendo", "start_tick": 1920, "stop_tick": 3840, "staff": 1 }
  ],
  "notes": [
    { "id": "n1", "start_tick": 0, "duration_ticks": 960, "pitch": 60, "velocity": 49 },
    { "id": "n2", "start_tick": 960, "duration_ticks": 960, "pitch": 62, "velocity": 49 },
    { "id": "n3", "start_tick": 1920, "duration_ticks": 960, "pitch": 64, "velocity": 65 },
    { "id": "n4", "start_tick": 2880, "duration_ticks": 960, "pitch": 65, "velocity": 80 },
    { "id": "n5", "start_tick": 3840, "duration_ticks": 960, "pitch": 67, "velocity": 96 }
  ]
}
```

In this example: Notes n1–n2 are under `p` (velocity 49). Notes n3–n4 fall within the crescendo and are interpolated between p (49) and f (96). Note n5 is under `f` (velocity 96).

## Contract Tests

Tests MUST verify:
1. A score with no dynamics produces empty `dynamics`/`gradual_dynamics` arrays and notes without `velocity` (or velocity = 80)
2. A score with static dynamics produces correctly mapped `velocity` values
3. A score with wedges produces correctly paired `start_tick`/`stop_tick` values
4. Notes within a crescendo have interpolated velocities between surrounding dynamic levels
5. Multi-staff scores produce per-staff dynamic markings with correct `staff` values
