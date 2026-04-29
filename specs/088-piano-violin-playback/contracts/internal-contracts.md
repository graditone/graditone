# Internal Contracts — Feature 088: Piano and Violin Playback Support

This feature extends the internal audio playback layer. It does not expose any new
public APIs, REST endpoints, or CLI commands. The contracts documented here are
**TypeScript interface contracts** between the audio subsystem modules.

---

## Contract 1: `PlaybackChannel` public interface

**Module**: `frontend/src/services/playback/PlaybackChannel.ts`

```typescript
/**
 * PlaybackChannel — audio graph fragment for a single instrument part.
 *
 * Owns: synth/sampler → Tone.Volume → (shared) limiter → destination
 * Lifecycle: created by ToneAdapter.initChannel(), destroyed on ToneAdapter.destroyChannels()
 */
export interface IPlaybackChannel {
  /**
   * Play a note on this channel at the specified Transport time.
   * @param pitch   MIDI pitch 0–127
   * @param duration  Duration in seconds (minimum MIN_NOTE_DURATION)
   * @param time    Tone.js Transport time (absolute seconds from Transport start)
   * @param velocity MIDI velocity 1–127 (default 80)
   */
  playNote(pitch: number, duration: number, time: number, velocity?: number): void;

  /**
   * Immediately stop all sounding notes on this channel.
   */
  stopAll(): void;

  /**
   * Set mute state. Effect is immediate (Web Audio graph ramp-less gain change).
   * @param muted true → silence this channel; false → restore to current volume
   */
  setMuted(muted: boolean): void;

  /**
   * Set channel volume (0.0–1.0). Converts to dBFS internally.
   * Does not affect mute state — a muted channel stays muted after volume change.
   * @param volume Linear volume factor 0.0 (silent) to 1.0 (full)
   */
  setVolume(volume: number): void;

  /**
   * Release all Tone.js nodes owned by this channel.
   * Must be called when the channel is no longer needed to prevent audio leaks.
   */
  dispose(): void;

  /** Current mute state (read-only). */
  readonly isMuted: boolean;

  /** Current volume 0.0–1.0 (read-only). */
  readonly volume: number;
}
```

**Invariants**:
- `setMuted(true)` followed by `setVolume(x)` → channel remains muted (volume stored but not applied until unmuted)
- `setVolume(0)` does NOT equal `setMuted(true)` — mute is a separate flag
- `dispose()` is idempotent

---

## Contract 2: `ToneAdapter` multi-channel extension

**Module**: `frontend/src/services/playback/ToneAdapter.ts` (extended)

```typescript
// New methods added to existing ToneAdapter class

interface ToneAdapterMultiChannelExtension {
  /**
   * Initialise a playback channel for the given instrument part.
   * If a channel already exists for partIndex, returns existing channel without re-creating.
   *
   * Must be called after ToneAdapter.init() has been awaited.
   *
   * @param partIndex  0-based instrument index (channel key)
   * @param config     Timbre configuration from InstrumentTimbres.getTimbre(instrumentType)
   * @returns          The created or existing PlaybackChannel
   */
  initChannel(partIndex: number, config: TimbreConfig): IPlaybackChannel;

  /**
   * Play a note on a specific instrument channel.
   * Falls back to channel 0 (piano) if the partIndex channel does not exist.
   *
   * @param partIndex  0-based instrument channel index
   * @param pitch      MIDI pitch 0–127
   * @param duration   Duration in seconds
   * @param time       Transport-relative time in seconds
   * @param velocity   MIDI velocity 1–127
   */
  playNoteOnChannel(
    partIndex: number,
    pitch: number,
    duration: number,
    time: number,
    velocity?: number
  ): void;

  /**
   * Stop all notes across all channels.
   * Called on transport stop and score unload.
   */
  stopAllChannels(): void;

  /**
   * Release and remove all per-instrument channels.
   * Resets to single-channel (channel 0) state.
   * Called when a new score is loaded.
   */
  destroyChannels(): void;

  /**
   * Get an existing channel by partIndex, or null if not initialised.
   */
  getChannel(partIndex: number): IPlaybackChannel | null;
}
```

---

## Contract 3: `useInstrumentMixer` hook

**Module**: `frontend/src/services/hooks/useInstrumentMixer.ts`

```typescript
export interface UseInstrumentMixerResult {
  /** Current mixer state for all instrument parts */
  mixerState: InstrumentMixerState;

  /**
   * Toggle mute for the instrument at partIndex.
   * Effect is immediate on the audio channel (ToneAdapter.getChannel(partIndex).setMuted).
   */
  toggleMute(partIndex: number): void;

  /**
   * Set volume for the instrument at partIndex (0.0–1.0).
   * Persists the value to localStorage via scopedSetItem.
   */
  setVolume(partIndex: number, volume: number): void;

  /**
   * Initialise mixer state from score instrument list.
   * Restores persisted volumes from localStorage.
   * Resets all mute states to false.
   *
   * @param instruments  Score.instruments array
   * @param scoreId      Score UUID — used as part of the localStorage key
   */
  initMixer(instruments: Instrument[], scoreId: string): void;

  /**
   * Reset mixer to initial state (no instruments).
   * Called on score unload.
   */
  resetMixer(): void;
}
```

---

## Contract 4: `InstrumentMixerOverlay` component props

**Module**: `frontend/src/components/notation/InstrumentMixerOverlay.tsx`

```typescript
export interface InstrumentMixerOverlayProps {
  /**
   * Layout systems from the WASM engine — used to extract name_label positions.
   * Only the first system's positions are used for overlay placement.
   */
  systems: LayoutSystem[];

  /**
   * Current mixer state (from useInstrumentMixer).
   */
  mixerState: InstrumentMixerState;

  /**
   * CSS scale factor applied to the score canvas.
   * Overlay positions are multiplied by this factor to align with the visual score.
   */
  scoreScale: number;

  /**
   * Callback when user taps the mute button for an instrument.
   */
  onToggleMute(partIndex: number): void;

  /**
   * Callback when user adjusts the volume slider for an instrument.
   */
  onVolumeChange(partIndex: number, volume: number): void;
}
```

**Rendering contract**:
- Renders `null` when `mixerState.isMultiInstrument === false`
- For each `system.staff_groups[i].name_label`, renders a mute button positioned at `(name_label.position.x * scoreScale, name_label.position.y * scoreScale)`
- Volume sliders render below each mute button
- The overlay is an `absolutely` positioned HTML `<div>` layered over the score SVG (no SVG elements added to the score canvas)

---

## Contract 5: Note tagging at extraction

**Module**: `frontend/src/plugin-api/scorePlayerContext.ts` (and `ScoreViewer.tsx`)

```typescript
/**
 * Extract all notes from a score, tagging each with its 0-based instrument index.
 * The tag is stored in the non-enumerable (but readable) _partIndex property.
 *
 * Invariants:
 * - Produces notes sorted by start_tick within each part (not globally sorted)
 * - _partIndex is always in range [0, score.instruments.length - 1]
 * - Single-instrument scores: all notes have _partIndex = 0
 */
function extractTaggedNotes(score: Score): TaggedNote[]
```
