import * as Tone from 'tone';

/**
 * ToneAdapter - Singleton wrapper for Tone.js audio synthesis
 * 
 * Feature 003 - Music Playback: User Story 1 & 2
 * Provides a simplified interface to Tone.js for:
 * - Audio context initialization (handling autoplay policy)
 * - Polyphonic synthesis with configurable envelope
 * - Note scheduling and playback
 * - Audio context time management
 * 
 * @example
 * ```typescript
 * const adapter = ToneAdapter.getInstance();
 * await adapter.init(); // Must be called after user interaction
 * adapter.playNote(60, 0.5, 1.0); // Play middle C for 0.5s at time=1.0s
 * adapter.stopAll(); // Stop all playing notes
 * ```
 */
export class ToneAdapter {
  private static instance: ToneAdapter | null = null;
  private polySynth: Tone.PolySynth | null = null;
  private sampler: Tone.Sampler | null = null;
  private initialized = false;
  private useSampler = true; // Use piano samples for rich sound
  private scheduledEventIds: number[] = []; // Track scheduled Transport events
  /** Guards against concurrent init() calls creating duplicate Samplers. */
  private initPromise: Promise<void> | null = null;
  /** Listeners called synchronously BEFORE Transport.start() inside startTransport(). */
  private transportRestartListeners = new Set<() => void>();

  /**
   * Private constructor - use getInstance() instead
   */
  private constructor() {}

  /**
   * Get the singleton instance of ToneAdapter
   * 
   * @returns The ToneAdapter instance
   */
  public static getInstance(): ToneAdapter {
    if (!ToneAdapter.instance) {
      ToneAdapter.instance = new ToneAdapter();
    }
    return ToneAdapter.instance;
  }

  /**
   * Initialize Tone.js audio context and synthesizer
   * 
   * US1 T019: Implements audio initialization with Tone.start() and PolySynth creation
   * 
   * Must be called after a user interaction (click/keypress) to comply with
   * browser autoplay policies. Idempotent - safe to call multiple times.
   * 
   * @throws Error if audio context initialization fails
   * 
   * @example
   * ```typescript
   * button.addEventListener('click', async () => {
   *   await adapter.init();
   *   // Now safe to play audio
   * });
   * ```
   */
  public async init(): Promise<void> {
    // Always resume the AudioContext before playing -- browsers auto-suspend it
    // after a period of silence (e.g., after natural playback end). Tone.start()
    // is idempotent: it is a no-op when the context is already running.
    await Tone.start();

    if (this.initialized) {
      return; // Sampler/synth already created, nothing else to do
    }

    // Deduplicate concurrent init() calls -- only one Sampler/PolySynth ever created.
    if (this.initPromise) {
      return this.initPromise;
    }
    this.initPromise = this._doInit();
    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  /** Internal init implementation -- called exactly once via the initPromise guard. */
  private async _doInit(): Promise<void> {

    try {
      // Note: We don't start Tone.Transport here - we'll start it fresh each playback

      if (this.useSampler) {
        // US3: Use Salamander Grand Piano samples for realistic sound
        // Feature 025: Samples are bundled locally (public/audio/salamander/) for full offline support.
        // Gracefully fall back to PolySynth if samples fail to load.
        try {
          this.sampler = new Tone.Sampler({
            urls: {
              A0: "A0.mp3",
              C1: "C1.mp3",
              "D#1": "Ds1.mp3",
              "F#1": "Fs1.mp3",
              A1: "A1.mp3",
              C2: "C2.mp3",
              "D#2": "Ds2.mp3",
              "F#2": "Fs2.mp3",
              A2: "A2.mp3",
              C3: "C3.mp3",
              "D#3": "Ds3.mp3",
              "F#3": "Fs3.mp3",
              A3: "A3.mp3",
              C4: "C4.mp3",
              "D#4": "Ds4.mp3",
              "F#4": "Fs4.mp3",
              A4: "A4.mp3",
              C5: "C5.mp3",
              "D#5": "Ds5.mp3",
              "F#5": "Fs5.mp3",
              A5: "A5.mp3",
              C6: "C6.mp3",
              "D#6": "Ds6.mp3",
              "F#6": "Fs6.mp3",
              A6: "A6.mp3",
              C7: "C7.mp3",
              "D#7": "Ds7.mp3",
              "F#7": "Fs7.mp3",
              A7: "A7.mp3",
              C8: "C8.mp3"
            },
            release: 1,
            baseUrl: `${import.meta.env.BASE_URL}audio/salamander/`,
            volume: -5,
          }).toDestination();

          // CRITICAL: Wait for samples to load before allowing playback
          // Timeout after 5 seconds to avoid hanging offline
          await Promise.race([
            Tone.loaded(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Sample load timeout')), 5000))
          ]);
          
          console.log('[ToneAdapter] Piano samples loaded successfully (local/offline-ready)');
        } catch (sampleError) {
          console.warn('[ToneAdapter] Failed to load local piano samples, falling back to PolySynth:', sampleError);
          this.sampler = null;
          this.useSampler = false;
        }
      }
      
      // Create PolySynth if sampler is not available (disabled or failed to load)
      if (!this.sampler) {
        // Fallback: Basic synthesizer (works offline)
        console.log('[ToneAdapter] Using PolySynth for audio playback');
        this.polySynth = new Tone.PolySynth(Tone.Synth, {
          volume: -8,
          envelope: {
            attack: 0.005,
            decay: 0.1,
            sustain: 0.3,
            release: 1.0,
          },
        }).toDestination();
      }

      this.initialized = true;
    } catch (error) {
      this.initialized = false;
      throw new Error(`Failed to initialize ToneAdapter: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get current audio context time in seconds
   * 
   * US1 T018: getCurrentTime() method for timeline synchronization
   * 
   * @returns Current time in seconds since audio context started
   */
  public getCurrentTime(): number {
    return Tone.now();
  }

  /**
   * Start Tone.Transport from the beginning.
   * Starts with a 50 ms lookahead so notes scheduled at Transport time 0
   * are never in the past by the time scheduleNotes() runs.
   * This is the canonical Tone.js pattern for gapless first-note scheduling.
   */
  public startTransport(): void {
    // Notify listeners synchronously BEFORE restarting.
    // MetronomeEngine uses this to clear its scheduleRepeat event so that
    // stale clicks don't fire at incorrect beat positions when Transport
    // restarts at position 0.
    this.transportRestartListeners.forEach(fn => fn());

    // Cancel only the playback note-events tracked in scheduledEventIds.
    // Using Transport.cancel() here would wipe ALL Transport events -- including
    // the metronome's scheduleRepeat -- so we clear IDs individually instead.
    this.scheduledEventIds.forEach(id => Tone.Transport.clear(id));
    this.scheduledEventIds = [];
    Tone.Transport.stop();
    // '+0.05' gives scheduleNotes() a 50 ms window before position-0 events fire.
    Tone.Transport.start('+0.05', 0);
  }

  /**
   * Register a callback that fires synchronously inside startTransport(),
   * BEFORE Transport.stop() / Transport.start().
   *
   * Use this to clear Transport-scheduled events that must not survive a
   * Transport restart (e.g. the metronome's scheduleRepeat).
   *
   * @returns An unsubscribe function.
   */
  public onTransportRestart(listener: () => void): () => void {
    this.transportRestartListeners.add(listener);
    return () => { this.transportRestartListeners.delete(listener); };
  }

  /**
   * Stop Tone.Transport and clear scheduled events
   */
  public stopTransport(): void {
    Tone.Transport.stop();
    // Clear only playback events; metronome scheduleRepeat must remain registered.
    this.scheduledEventIds.forEach(id => Tone.Transport.clear(id));
    this.scheduledEventIds = [];
  }

  /**
   * Clear all scheduled notes
   * US2 T038: Called by MusicTimeline.pause() and stop()
   */
  public clearSchedule(): void {
    // Cancel all scheduled Transport events
    this.scheduledEventIds.forEach(id => {
      Tone.Transport.clear(id);
    });
    this.scheduledEventIds = [];
    
    // Also stop Transport
    this.stopTransport();
  }

  /**
   * Stop all currently playing and scheduled notes
   * 
   * US1 T018: stopAll() method for playback control
   * US1 T023: Called by MusicTimeline.stop()
   * 
   * Safe to call even if not initialized.
   */
  public stopAll(): void {
    // Clear scheduled events
    this.clearSchedule();
    
    // Stop currently playing notes
    if (this.sampler) {
      this.sampler.releaseAll();
    } else if (this.polySynth) {
      this.polySynth.releaseAll();
    }
  }

  /**
   * Immediately attack (note-on) a single MIDI note.
   * Intended for real-time input (e.g. plugin virtual keyboard).
   * Uses the Sampler when available, falls back to PolySynth.
   *
   * @param pitch - MIDI note number (0–127, where 60 = middle C)
   * @param velocity - MIDI velocity (0–127, default 64)
   */
  public attackNote(pitch: number, velocity = 64): void {
    if (!this.initialized || (!this.sampler && !this.polySynth)) {
      console.warn('[ToneAdapter] attackNote: not initialized, call init() first.');
      return;
    }
    const noteName = Tone.Frequency(pitch, 'midi').toNote();
    const gain = (velocity / 127) * 1.0;
    if (this.sampler) {
      this.sampler.triggerAttack(noteName, Tone.now(), gain);
    } else if (this.polySynth) {
      this.polySynth.triggerAttack(noteName, Tone.now(), gain);
    }
  }

  /**
   * Immediately release (note-off) a MIDI note that is currently sustained.
   * Intended for real-time input (e.g. plugin virtual keyboard).
   *
   * @param pitch - MIDI note number (0–127)
   */
  public releaseNote(pitch: number): void {
    if (!this.initialized || (!this.sampler && !this.polySynth)) return;
    const noteName = Tone.Frequency(pitch, 'midi').toNote();
    if (this.sampler) {
      this.sampler.triggerRelease(noteName, Tone.now());
    } else if (this.polySynth) {
      this.polySynth.triggerRelease(noteName, Tone.now());
    }
  }

  /**
   * Play a single note with specified pitch, duration, and timing
   * 
   * US2 T034: Implement playNote() for actual note playback
   * US3 T046: Uses piano samples for realistic sound
   * US3 T048: Validates MIDI pitch range (21-108 standard piano)
   * US3 T051: Handles out-of-range notes gracefully
   * 
   * @param pitch - MIDI pitch number (0-127, where 60 = middle C)
   *                Standard piano range: 21 (A0) to 108 (C8)
   * @param duration - Duration in seconds
   * @param time - Absolute time to play the note (seconds since audio context start)
   * 
   * @example
   * ```typescript
   * // Play middle C (MIDI 60) for 0.5s at time 1.0s
   * adapter.playNote(60, 0.5, 1.0);
   * ```
   */
  public playNote(pitch: number, duration: number, time: number): void {
    if (!this.initialized || (!this.sampler && !this.polySynth)) {
      console.warn('ToneAdapter not initialized. Call init() first.');
      return;
    }

    // US3 T048 & T051: Validate MIDI pitch range (21-108 = standard piano)
    const PIANO_MIN_PITCH = 21; // A0
    const PIANO_MAX_PITCH = 108; // C8
    
    if (pitch < PIANO_MIN_PITCH || pitch > PIANO_MAX_PITCH) {
      console.warn(
        `MIDI pitch ${pitch} is out of piano range (${PIANO_MIN_PITCH}-${PIANO_MAX_PITCH}). Skipping playback.`
      );
      return; // Skip playback silently without crashing
    }

    // Convert MIDI pitch to note name (e.g., 60 -> "C4")
    const noteName = Tone.Frequency(pitch, 'midi').toNote();
    
    // Schedule the note using Transport for proper timing coordination
    const eventId = Tone.Transport.schedule((scheduleTime) => {
      if (this.sampler) {
        this.sampler.triggerAttackRelease(noteName, duration, scheduleTime);
      } else if (this.polySynth) {
        this.polySynth.triggerAttackRelease(noteName, duration, scheduleTime);
      }
    }, time);
    
    this.scheduledEventIds.push(eventId);
  }

  /**
   * Get the current Transport position in seconds.
   * Used by PlaybackScheduler to determine the lookahead window boundary.
   * 
   * @returns Transport time in seconds (0 at playback start)
   */
  public getTransportSeconds(): number {
    return Tone.Transport.seconds;
  }

  /**
   * Schedule a repeating callback on the Transport timeline.
   * Used by PlaybackScheduler's windowed scheduling to refill the note window.
   * 
   * @param callback - Function to invoke on each repeat
   * @param intervalSeconds - Repeat interval in seconds
   * @param startOffsetSeconds - Transport time (seconds) at which the first event
   *   fires.  Defaults to 0 (fires at Transport position 0).  Pass the current
   *   Transport.seconds + timeUntilNextBeat to phase-align with an already-running
   *   Transport (e.g. metronome activated mid-song).
   * @returns Event ID that can be used with clearTransportEvent()
   */
  public scheduleRepeat(
    callback: () => void,
    intervalSeconds: number,
    startOffsetSeconds?: number,
  ): number {
    return Tone.Transport.scheduleRepeat(
      () => callback(),
      intervalSeconds,
      startOffsetSeconds,
    );
  }

  /**
   * Cancel a single Transport event by ID.
   * 
   * @param eventId - The event ID returned by scheduleRepeat or Transport.schedule
   */
  public clearTransportEvent(eventId: number): void {
    Tone.Transport.clear(eventId);
  }

  /**
   * Check if the audio context is initialized
   * 
   * @returns True if init() has been called successfully
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Mute or unmute the master audio output.
   *
   * Used by PracticeView to silence the exercise playback while the microphone
   * is capturing the user's response, preventing speaker bleed from confusing
   * the pitch detector.
   *
   * @param muted - true to silence all output, false to restore
   */
  public setMuted(muted: boolean): void {
    Tone.Destination.mute = muted;
  }

  /**
   * Update the transport tempo (BPM)
   * 
   * Feature 008 - Tempo Change: T016
   * 
   * Updates the Tone.Transport BPM value. While our current implementation
   * calculates note timing manually in PlaybackScheduler, this ensures
   * Tone.Transport BPM stays synchronized for potential future features
   * like visual metronome or timeline display.
   * 
   * @param bpm - Tempo in beats per minute (1-400)
   * 
   * @example
   * ```typescript
   * // Update to 96 BPM (80% of 120 BPM)
   * adapter.updateTempo(96);
   * ```
   */
  public updateTempo(bpm: number): void {
    // Validate BPM range (reasonable musical tempos)
    const validBpm = Math.max(1, Math.min(400, bpm));
    
    if (validBpm !== bpm) {
      console.warn(`Tempo ${bpm} out of range (1-400), clamping to ${validBpm}`);
    }
    
    // Update Tone.Transport BPM
    Tone.Transport.bpm.value = validBpm;
  }
}
