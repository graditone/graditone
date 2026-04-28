# Data Model — Feature 088: Piano and Violin Playback Support

**Branch**: `088-piano-violin-playback` | **Date**: 2026-04-28

---

## Overview

This feature extends the audio playback layer with multi-instrument awareness. No new database tables or IndexedDB stores are introduced. The domain model changes are confined to the Rust backend's `Instrument` entity (enriching `instrument_type`) and new TypeScript value types representing mixer state.

---

## Backend Domain Entity Changes

### `Instrument` (existing — modified)

```rust
// backend/src/domain/instrument.rs

pub struct Instrument {
    pub id: InstrumentId,
    pub name: String,           // unchanged: part name from MusicXML
    pub instrument_type: String, // NOW populated from classify_instrument_type()
    pub staves: Vec<Staff>,
}
```

**Change**: `instrument_type` is no longer always `"piano"`. The MusicXML converter calls `classify_instrument_type(name, midi_program)` to set it. Values are canonical lowercase strings (see R-002).

**Validation rules**:
- Must be a non-empty lowercase string
- Unknown instruments → `"default"` (never error)
- MIDI program takes precedence over name match if both are present

**New pure function** (same file):

```rust
/// Classify instrument type from part name and optional MIDI program number.
/// Returns a canonical lowercase type string suitable for playback timbre selection.
pub fn classify_instrument_type(name: &str, midi_program: Option<u8>) -> String
```

---

## Frontend Value Types (new)

### `TimbreConfig` (new — `frontend/src/services/playback/InstrumentTimbres.ts`)

Describes how a `PlaybackChannel` should be configured for a given instrument type.

```typescript
export type TimbreSource = 'sampler' | 'polysynth';

export interface SynthEnvelope {
  attack: number;    // seconds
  decay: number;     // seconds
  sustain: number;   // 0.0–1.0
  release: number;   // seconds
}

export interface TimbreConfig {
  /** Audio source type */
  source: TimbreSource;
  /** Oscillator type — only relevant when source === 'polysynth' */
  oscillatorType?: OscillatorType;   // 'sine' | 'triangle' | 'square' | 'sawtooth'
  /** ADSR envelope — only relevant when source === 'polysynth' */
  envelope?: SynthEnvelope;
  /** Initial gain in dBFS (e.g., 0 for piano, -6 for violin) */
  volumeDb: number;
}
```

**Canonical timbre registry** (keyed by `instrument_type`):

| `instrument_type` | `source`    | `oscillatorType` | `attack` | `decay` | `sustain` | `release` | `volumeDb` |
|-------------------|-------------|-----------------|----------|---------|-----------|-----------|------------|
| `"piano"`         | `sampler`   | —               | —        | —       | —         | —         | 0          |
| `"violin"`        | `polysynth` | `triangle`      | 0.08     | 0.05    | 0.75      | 0.40      | -6         |
| `"viola"`         | `polysynth` | `triangle`      | 0.10     | 0.05    | 0.75      | 0.45      | -6         |
| `"cello"`         | `polysynth` | `triangle`      | 0.10     | 0.05    | 0.80      | 0.50      | -6         |
| `"contrabass"`    | `polysynth` | `triangle`      | 0.12     | 0.08    | 0.80      | 0.60      | -4         |
| `"guitar"`        | `polysynth` | `triangle`      | 0.01     | 0.30    | 0.30      | 0.50      | -3         |
| `"flute"`         | `polysynth` | `sine`          | 0.05     | 0.02    | 0.85      | 0.25      | -6         |
| `"oboe"`          | `polysynth` | `triangle`      | 0.04     | 0.03    | 0.80      | 0.30      | -6         |
| `"clarinet"`      | `polysynth` | `triangle`      | 0.04     | 0.03    | 0.75      | 0.30      | -6         |
| `"trumpet"`       | `polysynth` | `sawtooth`      | 0.03     | 0.05    | 0.70      | 0.20      | -4         |
| `"default"`       | `polysynth` | `triangle`      | 0.05     | 0.10    | 0.50      | 0.30      | -3         |

---

### `InstrumentChannelConfig` (new — `frontend/src/types/playback.ts`)

Identifies a single instrument's audio channel at runtime.

```typescript
export interface InstrumentChannelConfig {
  /** 0-based index into Score.instruments — also the channel key in ToneAdapter */
  partIndex: number;
  /** Instrument name (e.g., "Violin I") — from Score.instruments[partIndex].name */
  partName: string;
  /** Canonical instrument type string — from Score.instruments[partIndex].instrument_type */
  instrumentType: string;
}
```

---

### `InstrumentMixerEntry` (new — `frontend/src/types/playback.ts`)

Runtime mutable state for one instrument part in the mixer.

```typescript
export interface InstrumentMixerEntry {
  /** Identifies the channel */
  channel: InstrumentChannelConfig;
  /** Current mute state */
  isMuted: boolean;
  /** Current volume (0.0–1.0) */
  volume: number;
}
```

**Validation rules**:
- `volume` clamped to `[0.0, 1.0]` before applying or persisting
- `isMuted = true` → immediate audio silencing (no re-scheduling)
- When all entries are muted: playback progresses but no audio heard

---

### `InstrumentMixerState` (new — `frontend/src/types/playback.ts`)

Full mixer state for a loaded score.

```typescript
export interface InstrumentMixerState {
  /** One entry per instrument part; empty for single-instrument scores */
  entries: InstrumentMixerEntry[];
  /** True when entries.length > 1 — convenience flag for UI show/hide */
  isMultiInstrument: boolean;
}
```

---

### Tagged note extension (internal — NOT a domain type change)

Notes extracted for playback carry a non-persisted `_partIndex` property added at extraction time. This is an internal scheduler detail; the `Note` domain type (`frontend/src/types/score.ts`) is NOT modified.

```typescript
// Internal to PlaybackScheduler — never serialised or exposed externally
export type TaggedNote = Note & { readonly _partIndex?: number };
```

---

## Persistence Schema

### Per-instrument volume (localStorage — profile-scoped)

**Key format**: `graditone:volume:part:<scoreId>::<partName>`  
**Scoping**: wrapped by `scopedSetItem` → `profile:<profileId>:graditone:volume:part:<scoreId>::<partName>`  
**Value**: stringified number, `"0"` to `"1"` (e.g., `"0.75"`)  
**Lifecycle**: persisted on slider change, restored when score is loaded  
**Migration**: none needed (new keys only)  

Example key: `profile:abc123:graditone:volume:part:550e8400-e29b-41d4-a716-446655440000::Violin I`

---

## State Transitions

### Mute state machine (per instrument entry)

```
unmuted ─── user taps mute ──────────► muted
            (setMuted(true))           (audio suppressed immediately)

muted ──── user taps unmute ──────────► unmuted
           (setMuted(false))            (audio restored immediately)

(score unloaded) ──────────────────────► [entries cleared]
```

### Volume state machine

```
[0.0 ... 1.0]  ←────── slider drag ──────────►  [0.0 ... 1.0]
               ←── persisted/restored on load ──►
```

---

## Entity Relationships

```
Score
  └── instruments[]: Instrument           (existing)
        ├── id: InstrumentId
        ├── name: string                  (e.g., "Violin I")
        ├── instrument_type: string       ← NOW POPULATED (e.g., "violin")
        └── staves[]: Staff

InstrumentMixerState                      (new — runtime only)
  └── entries[]: InstrumentMixerEntry
        ├── channel.partIndex             ← maps to Score.instruments index
        ├── channel.partName              ← mirrors Instrument.name
        ├── channel.instrumentType        ← mirrors Instrument.instrument_type
        ├── isMuted                       ← runtime state
        └── volume                        ← persisted to localStorage

ToneAdapter                               (singleton — extended)
  └── channels: Map<partIndex, PlaybackChannel>
        ├── synth: Tone.Sampler | Tone.PolySynth
        ├── volumeNode: Tone.Volume
        └── limiter: Tone.Limiter (shared singleton)
```
