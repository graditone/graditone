/**
 * MetronomeEngine — Core metronome service
 * Feature 035: Metronome for Play and Practice Views
 * Task T003 (implementation) + T019 (updateBpm)
 *
 * Provides sample-accurate click synthesis via Tone.js Transport scheduling.
 *
 * Architecture (research.md R-001, R-002):
 *   - Audio clicks: Tone.Transport.scheduleRepeat (ahead-of-time, ±10 ms accuracy)
 *   - Downbeat click: Tone.MembraneSynth (percussive "tock")
 *   - Upbeat click:   Tone.Synth (short ADSR, softer)
 *   - One MetronomeEngine instance per view (independent state — FR-011)
 *   - No Tone.js or Web Audio imports in plugin code; plugins use context.metronome
 *
 * Constitution Principle II (Hexagonal): this class is in src/services/metronome/
 * and is accessed by plugins ONLY via PluginMetronomeContext (plugin-api boundary).
 *
 * BPM clamping (FR-008a): values outside [20, 300] are silently clamped.
 * Audio unlock (FR-012): ToneAdapter.init() is called inside start(); failures
 * are caught and broadcast as audioBlocked state.
 */

import * as Tone from 'tone';
import { ToneAdapter } from '../playback/ToneAdapter';
import type { MetronomeState } from '../../plugin-api/types';

// Ticks per quarter note — mirrors PlaybackScheduler.PPQ (Principle IV)
export const PPQ = 960;

export class MetronomeEngine {
  // ─── Internal state ──────────────────────────────────────────────────────

  private _active = false;
  private _bpm = 0;
  private _beatIndex = 0;
  private _numerator = 4;
  private _denominator = 4;
  private _audioBlocked = false;

  /** Transport event ID returned by scheduleRepeat; null when stopped. */
  private _eventId: number | null = null;

  /** Tone.js synths — created once per engine instance, disposed on dispose(). */
  private _downbeatSynth: Tone.MembraneSynth | null = null;
  private _upbeatSynth: Tone.Synth | null = null;

  /** Subscribers set — push model (mirrors scorePlayerContext subscribe pattern). */
  private _subscribers = new Set<(state: MetronomeState) => void>();

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * Clamp a BPM value to the supported range [20, 300].
   * Emits a console.warn when clamping occurs (FR-008a).
   */
  public clampBpm(bpm: number): number {
    const clamped = Math.min(300, Math.max(20, bpm));
    if (clamped !== bpm) {
      console.warn(
        `[MetronomeEngine] BPM ${bpm} out of range [20, 300], clamped to ${clamped}.`
      );
    }
    return clamped;
  }

  /**
   * Start the metronome.
   * Initialises audio (ToneAdapter.init()), creates synths, schedules repeating
   * Transport events, and optionally starts the Transport if not already running.
   *
   * @param bpm                  - Tempo in BPM (clamped to [20, 300])
   * @param numerator            - Time signature numerator (beats per measure); default 4
   * @param denominator          - Time signature denominator (beat unit); default 4
   * @param startBeatIndex       - Which beat (0-based) fires first; default 0 (downbeat).
   *   Pass the beat index at the current tick to keep phase with the score.
   * @param scheduleOffsetSeconds - Transport time (seconds) at which the first click fires;
   *   default 0 (fires at Transport position 0 / immediately after standalone Transport.start).
   *   Pass `Tone.Transport.seconds + timeUntilNextBeatBoundary` when the Transport is
   *   already running so the metronome phase-locks to the current measure position.
   */
  public async start(
    bpm: number,
    numerator = 4,
    denominator = 4,
    startBeatIndex = 0,
    scheduleOffsetSeconds = 0,
  ): Promise<void> {
    const adapter = ToneAdapter.getInstance();

    // Attempt audio unlock (FR-012)
    try {
      await adapter.init();
    } catch (err) {
      const isBlocked =
        err instanceof Error &&
        (err.name === 'NotAllowedError' || err.name === 'NotSupportedError');
      if (isBlocked) {
        this._audioBlocked = true;
        this._notifySubscribers();
        return;
      }
      throw err;
    }

    this._audioBlocked = false;

    // Stop any currently running repeat before rescheduling
    this._clearEvent();

    this._bpm = this.clampBpm(bpm);
    this._numerator = Math.max(1, numerator);
    this._denominator = [2, 4, 8, 16].includes(denominator) ? denominator : 4;
    // startBeatIndex lets callers phase-lock the click to the score's measure position.
    // Clamped into [0, numerator) so an out-of-range value never breaks the counter.
    this._beatIndex = ((startBeatIndex % this._numerator) + this._numerator) % this._numerator;
    this._active = true;

    // Create synths once per engine instance
    if (!this._downbeatSynth) {
      this._downbeatSynth = new Tone.MembraneSynth({
        pitchDecay: 0.05,
        octaves: 6,
        envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 },
      }).toDestination();
    }
    if (!this._upbeatSynth) {
      this._upbeatSynth = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.04 },
      }).toDestination();
    }

    // Schedule repeat beat on Transport.
    // scheduleOffsetSeconds > 0 phase-locks the first click to a beat boundary
    // when the Transport is already running (playback mid-measure).
    const beatIntervalSeconds = this._computeBeatInterval(this._bpm, this._denominator);
    this._eventId = adapter.scheduleRepeat(
      () => this._fireBeat(),
      beatIntervalSeconds,
      scheduleOffsetSeconds > 0 ? scheduleOffsetSeconds : undefined,
    );

    // Start Transport in standalone mode — no-op if already running by playback.
    if ((Tone.Transport as unknown as { state: string }).state !== 'started') {
      Tone.Transport.start('+0.01');
    }

    this._notifySubscribers();
  }

  /**
   * Stop the metronome immediately.
   * Cancels the scheduled Transport repeat event. Does NOT stop the Transport
   * itself — it may still be used by the playback engine.
   */
  public stop(): void {
    this._clearEvent();
    this._active = false;
    this._beatIndex = 0;
    this._notifySubscribers();
  }

  /**
   * Update the BPM while the metronome is running (T019 — US3: tempo changes).
   * No-op if the engine is inactive or the clamped value equals the current BPM.
   *
   * Cancels the existing scheduleRepeat event and reschedules at the new interval.
   * Beat index is NOT reset — counting continues from the current position.
   *
   * @param bpm - New BPM value (clamped to [20, 300])
   */
  public updateBpm(bpm: number): void {
    if (!this._active) return;

    const clamped = this.clampBpm(bpm);
    if (clamped === this._bpm) return;

    this._bpm = clamped;

    this._clearEvent();
    const beatIntervalSeconds = this._computeBeatInterval(this._bpm, this._denominator);
    this._eventId = ToneAdapter.getInstance().scheduleRepeat(
      () => this._fireBeat(),
      beatIntervalSeconds
    );

    this._notifySubscribers();
  }

  /**
   * Subscribe to MetronomeState snapshots.
   * Handler is called immediately with the current state, then on each change.
   * Returns an unsubscribe function.
   */
  public subscribe(handler: (state: MetronomeState) => void): () => void {
    this._subscribers.add(handler);
    handler(this._getState());
    return () => {
      this._subscribers.delete(handler);
    };
  }

  /**
   * Get the current MetronomeState snapshot (read-only).
   */
  public getState(): MetronomeState {
    return this._getState();
  }

  /**
   * Whether audio is blocked by browser autoplay policy (FR-012).
   */
  public isAudioBlocked(): boolean {
    return this._audioBlocked;
  }

  /**
   * Release all resources: clear Transport event, dispose synths.
   * Call this when the host component containing this engine unmounts.
   */
  public dispose(): void {
    this.stop();
    if (this._downbeatSynth) {
      this._downbeatSynth.dispose();
      this._downbeatSynth = null;
    }
    if (this._upbeatSynth) {
      this._upbeatSynth.dispose();
      this._upbeatSynth = null;
    }
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Called by the Transport-scheduled repeat callback on every beat.
   * Triggers the appropriate click sound and notifies subscribers.
   */
  private _fireBeat(): void {
    const isDownbeat = this._beatIndex === 0;

    try {
      if (isDownbeat) {
        this._downbeatSynth?.triggerAttackRelease('C2', '16n');
      } else {
        this._upbeatSynth?.triggerAttackRelease('G4', '32n');
      }
    } catch {
      // Swallow audio errors — beat should still count even if synth fails
    }

    // Advance beat index BEFORE notifying subscribers so they see the
    // post-fire state (matching the visual "current beat just played")
    const currentBeatIndex = this._beatIndex;
    this._beatIndex = (this._beatIndex + 1) % this._numerator;

    // Build state snapshot with the beat that just fired
    const state: MetronomeState = {
      active: this._active,
      beatIndex: currentBeatIndex,
      isDownbeat,
      bpm: this._bpm,
    };
    this._subscribers.forEach(h => h(state));
  }

  private _getState(): MetronomeState {
    if (!this._active) {
      return {
        active: false,
        beatIndex: -1,
        isDownbeat: false,
        bpm: 0,
      };
    }
    return {
      active: true,
      beatIndex: this._beatIndex,
      isDownbeat: this._beatIndex === 0,
      bpm: this._bpm,
    };
  }

  private _notifySubscribers(): void {
    const state = this._getState();
    this._subscribers.forEach(h => h(state));
  }

  private _clearEvent(): void {
    if (this._eventId !== null) {
      ToneAdapter.getInstance().clearTransportEvent(this._eventId);
      this._eventId = null;
    }
  }

  /**
   * Compute the beat interval in seconds.
   * For quarter note beat: 60 / bpm
   * For other denominators: scale by 4 / denominator
   *   e.g. 3/8 time: beat = eighth note → interval = (60 / bpm) * (4 / 8)
   */
  private _computeBeatInterval(bpm: number, denominator: number): number {
    return (60 / bpm) * (4 / denominator);
  }
}
