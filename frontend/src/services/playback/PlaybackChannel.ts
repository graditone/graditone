/**
 * PlaybackChannel — audio graph fragment for a single instrument part.
 *
 * Owns:  synth/sampler → Tone.Volume → (shared) limiter → destination
 * Lifecycle: created by ToneAdapter.initChannel(), destroyed on ToneAdapter.destroyChannels()
 *
 * Feature 088: Piano and Violin Playback Support
 */

import * as Tone from 'tone';
import { type TimbreConfig } from './InstrumentTimbres';
import { velocityToGain, DEFAULT_VELOCITY } from './volumeUtils';

/** Minimum note duration in seconds to avoid Tone.js scheduling artifacts. */
const MIN_NOTE_DURATION = 0.05;

/** Linear volume → dBFS. Clamps 0→-Infinity, 1→0 dB. */
function linearToDb(linear: number): number {
  if (linear <= 0) return -Infinity;
  return 20 * Math.log10(linear);
}

/**
 * IPlaybackChannel — public interface contract (see contracts/internal-contracts.md)
 * Feature 088: Piano and Violin Playback Support
 */
export interface IPlaybackChannel {
  playNote(pitch: number, duration: number, time: number, velocity?: number): void;
  stopAll(): void;
  setMuted(muted: boolean): void;
  setVolume(volume: number): void;
  dispose(): void;
  readonly isMuted: boolean;
  readonly volume: number;
}

/**
 * PlaybackChannel wraps a Tone.js synth/sampler and a Volume node for a single
 * instrument part. Multiple channels share a single upstream Limiter node owned
 * by ToneAdapter.
 */
export class PlaybackChannel implements IPlaybackChannel {
  private readonly polySynth: Tone.PolySynth | null = null;
  /**
   * Sampler reference is shared (owned by ToneAdapter). PlaybackChannel does NOT
   * call dispose() on it — only on its own Volume node.
   */
  private readonly samplerRef: Tone.Sampler | null = null;
  /** Stored so we can re-attach the sampler to the limiter on dispose(). */
  private readonly limiterRef: Tone.Limiter;
  private readonly volumeNode: Tone.Volume;
  private _isMuted = false;
  private _volume = 1.0;
  private _disposed = false;

  /**
   * @param config  Timbre configuration from InstrumentTimbres registry
   * @param limiter Shared Tone.Limiter owned by ToneAdapter (not disposed here)
   * @param samplerRef  When config.source === 'sampler', the shared Sampler node
   */
  constructor(
    config: TimbreConfig,
    limiter: Tone.Limiter,
    samplerRef?: Tone.Sampler,
  ) {
    this.limiterRef = limiter;
    // Create a Volume node with the timbre's initial gain setting
    this.volumeNode = new Tone.Volume(config.volumeDb).connect(limiter);

    if (config.source === 'sampler' && samplerRef) {
      // The shared Sampler is connected to the limiter directly by ToneAdapter
      // (so legacy playNote()/attackNote() can drive it). We must REPLACE that
      // direct connection with our Volume node, otherwise piano audio plays via
      // both paths and channel mute/volume only affects half of it.
      console.log(`[PlaybackChannel] partIndex sampler path: ${Object.prototype.toString.call(samplerRef)}`);
      try { samplerRef.disconnect(); } catch { /* no prior connections */ }
      samplerRef.connect(this.volumeNode);
      this.samplerRef = samplerRef;
    } else {
      // Build a new PolySynth for this instrument
      console.log(`[PlaybackChannel] POLYSYNTH path: source=${config.source} samplerRef=${samplerRef}`);
      const oscillatorType = config.oscillatorType ?? 'triangle';
      const envelope = config.envelope ?? {
        attack: 0.05,
        decay: 0.10,
        sustain: 0.50,
        release: 0.30,
      };
      this.polySynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: oscillatorType as OscillatorType },
        envelope,
      }).connect(this.volumeNode);
    }
  }

  get isMuted(): boolean {
    return this._isMuted;
  }

  get volume(): number {
    return this._volume;
  }

  playNote(pitch: number, duration: number, time: number, velocity?: number): void {
    if (this._disposed || this._isMuted) return;

    const safeDuration = Math.max(MIN_NOTE_DURATION, duration);
    const noteName = Tone.Frequency(pitch, 'midi').toNote();
    const gain = velocityToGain(velocity ?? DEFAULT_VELOCITY);

    if (this.samplerRef) {
      this.samplerRef.triggerAttackRelease(noteName, safeDuration, time, gain);
    } else if (this.polySynth) {
      this.polySynth.triggerAttackRelease(noteName, safeDuration, time, gain);
    }
  }

  stopAll(): void {
    if (this._disposed) return;
    if (this.samplerRef) {
      this.samplerRef.releaseAll();
    } else if (this.polySynth) {
      this.polySynth.releaseAll();
    }
  }

  setMuted(muted: boolean): void {
    this._isMuted = muted;
    // Set volume to -Infinity when muted, restore when unmuted
    this.volumeNode.volume.value = muted ? -Infinity : linearToDb(this._volume);
  }

  setVolume(volume: number): void {
    this._volume = Math.max(0, Math.min(1, volume));
    // Only apply if not muted (mute takes priority)
    if (!this._isMuted) {
      this.volumeNode.volume.value = linearToDb(this._volume);
    }
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    // polySynth is owned by this channel — dispose it
    if (this.polySynth) {
      this.polySynth.releaseAll();
      this.polySynth.dispose();
    }
    // samplerRef is shared — do NOT dispose it, but restore its direct
    // connection to the limiter so legacy playNote()/attackNote() keep working
    // after this channel is gone (e.g. after destroyChannels()).
    if (this.samplerRef) {
      try { this.samplerRef.disconnect(this.volumeNode); } catch { /* already disconnected */ }
      try { this.samplerRef.connect(this.limiterRef); } catch { /* limiter disposed */ }
    }
    // Volume node is owned by this channel — dispose it
    this.volumeNode.dispose();
  }
}
