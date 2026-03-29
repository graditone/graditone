# Data Model: MIDI Volume Control (Feature 063)

**Date**: 2026-03-29  
**Source**: [spec.md](spec.md) + [research.md](research.md)

## Domain Entities

### DynamicMarking (Backend: Rust struct → Frontend: TypeScript interface)

A sustained volume instruction at a specific score position.

| Field | Type | Description |
|-------|------|-------------|
| `marking` | `DynamicLevel` enum | One of: `PPP`, `PP`, `P`, `MP`, `MF`, `F`, `FF`, `FFF` |
| `velocity` | `u8` (1–127) | MIDI velocity value — may come from `<sound dynamics="N"/>` or the standard mapping |
| `start_tick` | `u32` | Absolute tick position (PPQ) where this dynamic takes effect |
| `staff` | `u8` | Staff number (1-based) this applies to; enables per-staff dynamics |

**Validation rules**:
- `velocity` must be in range 1–127 (0 is reserved for note-off)
- `start_tick` must be non-negative
- `staff` must be ≥ 1
- When `<sound dynamics="N"/>` is present, use that value (clamped to 1–127); otherwise, use the standard mapping for the `marking`

**Standard velocity mapping** (used when no `<sound dynamics>` is present):

| DynamicLevel | Velocity |
|-------------|----------|
| PPP | 16 |
| PP | 33 |
| P | 49 |
| MP | 64 |
| MF | 80 |
| F | 96 |
| FF | 112 |
| FFF | 127 |

---

### GradualDynamic (Backend: Rust struct → Frontend: TypeScript interface)

A volume transition (crescendo or diminuendo) spanning a range of tick positions.

| Field | Type | Description |
|-------|------|-------------|
| `direction` | `GradualDirection` enum | `Crescendo` or `Diminuendo` |
| `start_tick` | `u32` | Absolute tick position where the wedge begins |
| `stop_tick` | `u32` | Absolute tick position where the wedge ends |
| `staff` | `u8` | Staff number (1-based) |
| `number` | `u8` | MusicXML wedge number (for matching start/stop pairs) |

**Validation rules**:
- `stop_tick` must be > `start_tick`
- `staff` must be ≥ 1
- The start and end velocity values are NOT stored on the wedge itself — they are derived at runtime by the DynamicsResolver from the surrounding DynamicMarkings

**State transitions**: A wedge is initially created with only `start_tick` when the `<wedge type="crescendo|diminuendo">` is encountered. The `stop_tick` is filled in when the matching `<wedge type="stop" number="N">` is encountered.

---

### DynamicLevel (Backend: Rust enum → Frontend: TypeScript union)

```
PPP | PP | P | MP | MF | F | FF | FFF
```

---

### GradualDirection (Backend: Rust enum → Frontend: TypeScript union)

```
Crescendo | Diminuendo
```

---

### Note (Extended — existing entity)

The existing `Note` struct/interface gains one new field.

| Field | Type | Description | Status |
|-------|------|-------------|--------|
| *...existing fields...* | | | Unchanged |
| `velocity` | `u8` / `number` (optional) | Computed velocity based on the active dynamic at this note's position | **NEW** |

**Computation**: During MusicXML import (converter stage), each note's `velocity` is computed by looking up the active `DynamicMarking` at that note's `start_tick` for its staff, with interpolation through any active `GradualDynamic`. If no dynamic is present, defaults to 80 (mf).

---

### ScheduledNote (Extended — existing entity, frontend only)

The existing `ScheduledNote` interface gains one new field.

| Field | Type | Description | Status |
|-------|------|-------------|--------|
| *...existing fields...* | | | Unchanged |
| `velocity` | `number` | Velocity (1–127) to pass to ToneAdapter | **NEW** |

---

### MidiCCState (Frontend only — new)

Tracks the current MIDI CC7 and CC11 values for a connected controller.

| Field | Type | Description |
|-------|------|-------------|
| `channelVolume` | `number` (0–127) | Current CC7 value; defaults to 127 (max) |
| `expression` | `number` (0–127) | Current CC11 value; defaults to 127 (max) |

**Scaling formula**: `effectiveGain = noteVelocityGain × (channelVolume / 127) × (expression / 127)`

---

## Entity Relationships

```
Score
 └── Measure[]
      ├── DynamicMarking[]    (0..n per measure, per staff)
      ├── GradualDynamic[]    (0..n per measure, start/stop may span measures)
      └── Note[]
           └── velocity        (computed from DynamicMarkings + GradualDynamics)

ToneAdapter
 └── Tone.Destination.volume  ← Master Volume (persisted, 0–100%)
      └── per-note gain       ← logarithmic(velocity/127) × CC7 × CC11
```

## Frontend-Only Entities

### VolumeState (React state / context)

| Field | Type | Description |
|-------|------|-------------|
| `masterVolume` | `number` (0–100) | User-controlled master level; persisted to localStorage |
| `midiCC` | `MidiCCState` | Current CC7/CC11 from connected MIDI hardware |

### DynamicsResolver (Service — stateless utility)

Resolves the active velocity at any tick position for a given staff. Algorithm:

1. Sort all `DynamicMarking` entries by `start_tick` (ascending)
2. For a query at tick `T` on staff `S`:
   a. Find the last `DynamicMarking` where `start_tick ≤ T` and `staff = S`
   b. Check if tick `T` falls within any `GradualDynamic` where `start_tick ≤ T < stop_tick` and `staff = S`
   c. If inside a gradual dynamic: linearly interpolate between the velocity of the preceding `DynamicMarking` and the velocity of the next `DynamicMarking`
   d. If no preceding dynamic found: return 80 (mf default)
3. Return the resolved velocity (1–127)
