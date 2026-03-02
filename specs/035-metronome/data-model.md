# Data Model: Metronome for Play and Practice Views

**Feature**: 035-metronome  
**Date**: 2026-03-02

---

## Entities

### MetronomeEngine

Represents the running metronome. A single `MetronomeEngine` instance is created per view (play, practice). Instances are independent.

| Field | Type | Description |
|---|---|---|
| `active` | `boolean` | Whether the metronome is currently ticking |
| `bpm` | `number` | Current BPM (20–300, clamped). Derived from the score's tempo at load time, or from the practice BPM setting in standalone mode |
| `timeSignatureNumerator` | `number` | Beats per measure (e.g. 4 for 4/4, 3 for 3/4). Used to distinguish downbeat vs upbeat. Default: 4 |
| `timeSignatureDenominator` | `number` | Beat unit (e.g. 4 for quarter note). Used to compute beat interval in ticks. Default: 4 |
| `beatIndex` | `number` | 0-based beat within the current measure. 0 = downbeat. Resets to 0 on `start()` (standalone) or derived from `currentTick` (phase-locked) |

**Validation rules**:
- `bpm` is clamped to [20, 300] (FR-008a)
- `timeSignatureNumerator` must be ≥ 1
- `timeSignatureDenominator` must be a power of 2 (2, 4, 8, 16); defaults to 4 if invalid

**Computed values**:
```
beatIntervalTicks   = PPQ * (4 / timeSignatureDenominator)
beatIntervalSeconds = beatIntervalTicks / ((bpm / 60) * PPQ)
                    = 60 / bpm    [simplifies when denominator=4]
```

---

### MetronomeState

The immutable snapshot emitted to subscribers via `context.metronome.subscribe()`. This is what plugin UI code consumes.

| Field | Type | Description |
|---|---|---|
| `active` | `boolean` | Whether the metronome is on |
| `beatIndex` | `number` | Most recent beat index within the measure (0-based; 0 = downbeat). `-1` before first beat fires after activation |
| `isDownbeat` | `boolean` | `true` iff `beatIndex === 0` |
| `bpm` | `number` | Current effective BPM (clamped, post-multiplier) |

---

### TempoDefinition

A tempo marking from the loaded score. Multiple `TempoDefinition` entries may exist in one score (e.g., music with a mid-piece accelerando).

| Field | Type | Description |
|---|---|---|
| `bpm` | `number` (BPM) | Beats per minute at this marking |
| `tick` | `number` (Tick) | 960-PPQ position where this tempo applies |

**Relationships**: A loaded score has 1..N `TempoDefinition` entries. MetronomeEngine uses the one applicable at the current playback position (or the first one when no playback is active).

---

### TimeSignatureDefinition

A time signature from the loaded score.

| Field | Type | Description |
|---|---|---|
| `numerator` | `number` | Beats per measure |
| `denominator` | `number` | Beat unit (4 = quarter, 8 = eighth, etc.) |
| `tick` | `number` (Tick) | Position where this time signature applies; 0 for the initial signature |

---

## State Transitions

```
[off] ──toggle()──► [initializing]
                        │  ToneAdapter.init() resolves
                        ▼
                    [active: ticking, Transport scheduled]
                        │
                    toggle() or view unmount
                        ▼
                      [off]

[initializing] ──ToneAdapter.init() blocked (autoplay)──► [audio_blocked]
    [audio_blocked] ──user pointer event──► [initializing] (retry)
```

---

## `ScorePlayerState` Extension

New field added to the existing `ScorePlayerState` interface (types.ts):

```typescript
/** Time signature at tick 0; defaults to { numerator: 4, denominator: 4 }. */
readonly timeSignature: { readonly numerator: number; readonly denominator: number };
```

The `MetronomeEngine` reads this from `context.scorePlayer.subscribe()` to populate `timeSignatureNumerator`/`timeSignatureDenominator`.

---

## Beat Position Computation

### Phase-locked mode (playback active)

The Transport position is derived from the Tone.js Transport clock, which is already synchronized with audio playback. No additional phase computation is needed — beat intervals are scheduled as repeating Transport events starting from the Transport's current position.

Beat index for visual pulse (rAF loop):
```typescript
const beatIntervalTicks = PPQ * (4 / denominator);
const beatIndex = Math.floor(currentTick / beatIntervalTicks) % numerator;
const isDownbeat = beatIndex === 0;
```

### Standalone mode (no playback)

Beat counter starts at 0 on `MetronomeEngine.start()`. Tone.js Transport is started fresh (or reused if already running). The repeat callback increments beat index modulo `timeSignatureNumerator`.

---

## BPM Clamping Contract

```
effectiveBpm = Math.min(300, Math.max(20, rawBpm))
```

Applied by `MetronomeEngine` at start time and when BPM changes. No error is thrown; the clamped value is used silently (FR-008a). A `console.warn` is emitted when clamping occurs.
