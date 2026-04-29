# Data Model: Piano Practice with Violin Accompaniment Playback

**Feature**: 089-piano-violin-practice  
**Date**: 2026-04-29  
**Phase**: 1 — Design

---

## Domain Entities

### PluginInstrumentInfo *(new — Plugin API v11)*

Represents a single instrument part from the loaded score, as exposed to plugins via `getInstruments()`.

```typescript
/**
 * Feature 089: Instrument part descriptor exposed to plugins.
 * Returned by PluginScorePlayerContext.getInstruments().
 */
export interface PluginInstrumentInfo {
  /** 0-based index; matches ToneAdapter channel key and TaggedNote._partIndex */
  partIndex: number;
  /**
   * Canonical instrument type resolved from MusicXML metadata.
   * Examples: "piano", "violin", "cello", "viola", "flute".
   * Resolved by resolveInstrumentType() in InstrumentTimbres.ts at score load.
   */
  instrumentType: string;
  /** Display name from MusicXML <part-name> element. */
  name: string;
  /** Number of staves for this instrument (2 for piano grand staff, 1 for most others). */
  staffCount: number;
}
```

---

### AccompanimentState *(runtime — computed from PluginInstrumentInfo[])*

Derived state managed by the `useAccompaniment` hook. Not persisted.

```typescript
interface AccompanimentState {
  /**
   * All non-piano instrument parts from the loaded score.
   * Empty array when no score is loaded or score has no non-piano parts.
   */
  accompanimentParts: ReadonlyArray<PluginInstrumentInfo>;

  /**
   * True when the loaded score has ≥1 piano part AND ≥1 non-piano part.
   * Controls visibility of the AccompanimentVolumeSlider in the toolbar.
   */
  hasAccompaniment: boolean;

  /**
   * Current accompaniment volume as a linear scalar 0.0–1.0.
   * Default: 0.7 (70%). Sourced from module-level page-session state.
   */
  volume: number;

  /**
   * Callback to update accompaniment volume.
   * Immediately applies to all accompanimentParts via setPartVolume.
   */
  setVolume: (volume: number) => void;
}
```

---

### AccompanimentVolumeStore *(page-session singleton)*

Module-level state that survives component remounts within a page session (score changes). Initialised fresh on page reload.

```typescript
// Module-level singleton in useAccompaniment.ts
const DEFAULT_ACCOMPANIMENT_VOLUME = 0.7;
let pageSessionVolume: number = DEFAULT_ACCOMPANIMENT_VOLUME;
```

---

## State Transitions

### Score Load → Accompaniment Detection

```
State: no score loaded
  → Action: loadScore() called
  → Score resolves, instruments[] populated by WASM parser
  → getInstruments() returns PluginInstrumentInfo[]
  → hasPiano = instruments.some(i => i.instrumentType === 'piano')
  → hasNonPiano = instruments.some(i => i.instrumentType !== 'piano')
  → hasAccompaniment = hasPiano && hasNonPiano

If hasAccompaniment:
  → setPartVolume(partIndex, pageSessionVolume) applied to each non-piano partIndex
  → AccompanimentVolumeSlider renders in toolbar

If !hasAccompaniment:
  → AccompanimentVolumeSlider not rendered (FR-008)
  → No setPartVolume calls made
```

### Score Change Mid-Session

```
State: score A loaded (hasAccompaniment = true, volume = 0.5)
  → Action: loadScore(B) called
  → ToneAdapter.destroyChannels() called (existing behaviour)
  → New channels created for score B instruments
  → useAccompaniment re-evaluates: hasAccompaniment for score B?
    If yes: setPartVolume applied at volume = 0.5 (pageSessionVolume preserved)
    If no: slider hidden
```

### Volume Adjustment

```
State: hasAccompaniment = true, volume = 0.7
  → Action: user drags slider to 0.4
  → setVolume(0.4) called
  → pageSessionVolume = 0.4
  → setPartVolume(partIndex, 0.4) called for each accompanimentPart
  → ToneAdapter.getChannel(partIndex)?.setVolume(0.4) → Tone.Volume node adjusted
  → Audio output changes immediately (≤16ms via Tone.js audio scheduling)
```

### Playback Start/Stop/Pause

```
Volume node state is orthogonal to playback state.
setVolume() on a PlaybackChannel affects the Tone.Volume node directly.
No volume recalculation needed on play/stop/pause events.
```

### Page Session Boundary

```
State: accompaniment volume = 0.4
  → Action: user reloads page
  → pageSessionVolume re-initialised to DEFAULT_ACCOMPANIMENT_VOLUME (0.7)
  → All ToneAdapter channels destroyed and recreated
```

---

## Validation Rules

| Field | Rule |
|-------|------|
| `volume` | Clamped to `[0.0, 1.0]` before calling `setVolume()` on ToneAdapter channel |
| `partIndex` | Only valid indices (0 to instruments.length - 1) are passed to `setPartVolume` |
| `instrumentType` | Canonical string; piano detection uses strict equality: `instrumentType === 'piano'` |
| Default volume | `0.7` (70% linear gain); initialised in module scope, not in component state |

---

## Relationships

```
PluginScorePlayerContext
  ├── getInstruments() → PluginInstrumentInfo[]   (NEW v11)
  └── setPartVolume(partIndex, volume)             (NEW v11)
        └── ToneAdapter.getChannel(partIndex)
              └── IPlaybackChannel.setVolume(volume)
                    └── Tone.Volume node (per instrument)
                          └── Tone.Limiter (shared)
                                └── AudioDestination

useAccompaniment (Practice plugin hook)
  ├── reads: getInstruments()
  ├── derives: hasAccompaniment, accompanimentParts
  ├── reads/writes: pageSessionVolume (module singleton)
  └── calls: setPartVolume() for each accompanimentPart

AccompanimentVolumeSlider (Practice toolbar component)
  ├── props: { volume, onVolumeChange, visible }
  └── renders: slider (0–100%) + label, only when visible=true
```
