import { ToneAdapter } from './ToneAdapter';
import type { Note } from '../../types/score';

/**
 * PPQ - Pulses Per Quarter Note
 * 
 * Feature 003 - Music Playback: US2 T039
 * 
 * Graditone uses 960 ticks per quarter note (PPQ) for high timing precision.
 * This allows accurate representation of tuplets, dotted notes, and complex rhythms.
 * 
 * Examples at 120 BPM (one beat = 0.5 seconds):
 * - Quarter note: 960 ticks = 0.5s
 * - Half note: 1920 ticks = 1.0s
 * - Eighth note: 480 ticks = 0.25s
 * - Sixteenth note: 240 ticks = 0.125s
 */
export const PPQ = 960;

/**
 * Minimum note duration in seconds
 * 
 * US2 T040: Ensures extremely short notes still produce audible sound.
 * Notes shorter than this threshold are extended to MIN_NOTE_DURATION.
 */
export const MIN_NOTE_DURATION = 0.05; // 50 milliseconds

/**
 * Default tempo in BPM
 * 
 * US2 T042: Fallback tempo when score tempo is invalid or undefined.
 */
export const DEFAULT_TEMPO = 120;

/**
 * Convert musical time (ticks) to real time (seconds)
 * 
 * Feature 003 - Music Playback: US2 T033
 * 
 * Formula: seconds = ticks / (tempo/60 * PPQ)
 * 
 * Derivation:
 * - tempo (BPM) = beats per minute
 * - beats per second = tempo / 60
 * - ticks per second = (tempo / 60) * PPQ
 * - seconds per tick = 1 / (tempo/60 * PPQ)
 * - seconds = ticks * seconds_per_tick
 * 
 * @param ticks - Musical time in ticks (0-based)
 * @param tempo - Tempo in beats per minute (BPM)
 * @returns Time in seconds
 * 
 * @example
 * ```typescript
 * // Quarter note at 120 BPM
 * ticksToSeconds(960, 120); // 0.5 seconds
 * 
 * // Half note at 60 BPM
 * ticksToSeconds(1920, 60); // 2.0 seconds
 * ```
 */
export function ticksToSeconds(ticks: number, tempo: number): number {
  // US2 T042: Apply tempo fallback for invalid values
  const validTempo = tempo > 0 && tempo <= 400 ? tempo : DEFAULT_TEMPO;
  
  // Convert ticks to seconds using PPQ constant
  const beatsPerSecond = validTempo / 60;
  const ticksPerSecond = beatsPerSecond * PPQ;
  const seconds = ticks / ticksPerSecond;
  
  return seconds;
}

/**
 * Convert real time (seconds) to musical time (ticks)
 * 
 * Feature 003 - Music Playback: Pause/Resume
 * 
 * Formula: ticks = seconds * (tempo/60 * PPQ)
 * 
 * @param seconds - Time in seconds
 * @param tempo - Tempo in beats per minute (BPM)
 * @returns Musical time in ticks
 * 
 * @example
 * ```typescript
 * // 0.5 seconds at 120 BPM = quarter note
 * secondsToTicks(0.5, 120); // 960 ticks
 * ```
 */
export function secondsToTicks(seconds: number, tempo: number): number {
  // Apply tempo fallback for invalid values
  const validTempo = tempo > 0 && tempo <= 400 ? tempo : DEFAULT_TEMPO;
  
  // Convert seconds to ticks using PPQ constant
  const beatsPerSecond = validTempo / 60;
  const ticksPerSecond = beatsPerSecond * PPQ;
  const ticks = seconds * ticksPerSecond;
  
  return Math.round(ticks); // Round to nearest tick
}

/**
 * PlaybackScheduler - Manages note scheduling and timing
 * 
 * Feature 003 - Music Playback: US2 T032
 * Feature 024 - Performance: Windowed scheduling for large scores
 * 
 * Coordinates with ToneAdapter to schedule notes at precise times.
 * Handles tick-to-time conversion, duration calculation, and playback offset.
 * 
 * Uses a lookahead window to limit the number of simultaneously scheduled
 * Tone.js Transport events. This prevents Tone.js from degrading on mobile
 * when processing thousands of scheduled events in its internal timeline.
 * 
 * @example
 * ```typescript
 * const adapter = ToneAdapter.getInstance();
 * const scheduler = new PlaybackScheduler(adapter);
 * 
 * // Schedule notes from beginning
 * await scheduler.scheduleNotes(notes, 120, 0);
 * 
 * // Resume from tick 960 (0.5s into score at 120 BPM)
 * await scheduler.scheduleNotes(notes, 120, 960);
 * 
 * // Clear all scheduled notes
 * scheduler.clearSchedule();
 * ```
 */

/** Lookahead window in seconds: schedule this far ahead of current Transport time */
const LOOKAHEAD_SECONDS = 10;

/** How often (in seconds) the refill callback checks for new notes to schedule */
const REFILL_INTERVAL_SECONDS = 4;

export class PlaybackScheduler {
  private toneAdapter: ToneAdapter;

  // Windowed scheduling state
  private pendingNotes: Note[] = [];
  private pendingIndex = 0;
  private scheduleTempo = DEFAULT_TEMPO;
  private scheduleTempoMultiplier = 1.0;
  private scheduleStartTick = 0;
  private refillEventId: number | null = null;

  /**
   * Create a new PlaybackScheduler
   * 
   * @param toneAdapter - ToneAdapter instance for audio playback
   */
  constructor(toneAdapter: ToneAdapter) {
    this.toneAdapter = toneAdapter;
  }

  /**
   * Convert tick offset (relative to playback start) to Transport-relative seconds.
   */
  private tickOffsetToSeconds(ticksFromStart: number): number {
    let seconds = ticksToSeconds(ticksFromStart, this.scheduleTempo);
    if (this.scheduleTempoMultiplier !== 1.0) {
      seconds = seconds / this.scheduleTempoMultiplier;
    }
    return seconds;
  }

  /**
   * Schedule notes within the lookahead window starting from pendingIndex.
   * Advances pendingIndex past all notes that were scheduled.
   * Returns true if there are more notes remaining.
   */
  private scheduleWindow(): boolean {
    const notes = this.pendingNotes;
    const len = notes.length;
    if (this.pendingIndex >= len) return false;

    // Determine the Transport time ceiling for this window
    const transportNow = this.toneAdapter.getTransportSeconds();
    const windowEnd = transportNow + LOOKAHEAD_SECONDS;

    while (this.pendingIndex < len) {
      const note = notes[this.pendingIndex];
      const ticksFromStart = note.start_tick - this.scheduleStartTick;
      const transportTime = this.tickOffsetToSeconds(ticksFromStart);

      // Stop if this note is beyond the lookahead window
      if (transportTime > windowEnd) break;

      // Calculate note duration
      let durationSeconds = ticksToSeconds(note.duration_ticks, this.scheduleTempo);
      if (this.scheduleTempoMultiplier !== 1.0) {
        durationSeconds = durationSeconds / this.scheduleTempoMultiplier;
      }
      if (durationSeconds < MIN_NOTE_DURATION) {
        durationSeconds = MIN_NOTE_DURATION;
      }

      this.toneAdapter.playNote(note.pitch, durationSeconds, transportTime);
      this.pendingIndex++;
    }

    return this.pendingIndex < len;
  }

  /**
   * Schedule notes for playback with accurate timing
   * 
   * Feature 003 - Music Playback: US2 T035
   * Feature 008 - Tempo Change: T013 Added tempo multiplier support
   * Feature 024 - Performance: Windowed scheduling
   * 
   * Only schedules notes within a lookahead window of LOOKAHEAD_SECONDS.
   * A Transport-level repeating event refills the window as playback progresses.
   * This keeps the number of live Transport events small (~200-400 at any time),
   * preventing Tone.js timeline degradation on mobile with large scores.
   * 
   * @param notes - Array of notes to schedule (must be pre-sorted by start_tick)
   * @param tempo - Tempo in beats per minute (BPM)
   * @param currentTick - Current playback position in ticks (for resume from pause)
   * @param tempoMultiplier - Tempo multiplier (0.5 to 2.0, default 1.0)
   * 
   * @returns Promise that resolves when the initial window is scheduled
   */
  public async scheduleNotes(
    notes: Note[],
    tempo: number,
    currentTick: number,
    tempoMultiplier: number = 1.0
  ): Promise<void> {
    // US2 T042: Apply tempo fallback
    this.scheduleTempo = tempo > 0 && tempo <= 400 ? tempo : DEFAULT_TEMPO;
    this.scheduleTempoMultiplier = tempoMultiplier;
    this.scheduleStartTick = currentTick;

    // Filter out notes already past, then sort by start_tick
    this.pendingNotes = notes
      .filter(note => note.start_tick >= currentTick)
      .sort((a, b) => a.start_tick - b.start_tick);
    this.pendingIndex = 0;

    // Schedule first window immediately
    const hasMore = this.scheduleWindow();

    // If there are more notes beyond the window, set up a refill loop
    if (hasMore) {
      this.startRefillLoop();
    }
  }

  /**
   * Start a Transport-level repeating event that refills the scheduling window.
   */
  private startRefillLoop(): void {
    // Cancel any existing refill loop
    this.stopRefillLoop();

    this.refillEventId = this.toneAdapter.scheduleRepeat(() => {
      const hasMore = this.scheduleWindow();
      if (!hasMore) {
        this.stopRefillLoop();
      }
    }, REFILL_INTERVAL_SECONDS);
  }

  /**
   * Stop the refill loop.
   */
  private stopRefillLoop(): void {
    if (this.refillEventId !== null) {
      this.toneAdapter.clearTransportEvent(this.refillEventId);
      this.refillEventId = null;
    }
  }

  /**
   * Clear all scheduled notes and stop playback
   * 
   * Feature 003 - Music Playback: US2 T036
   * 
   * Stops all currently playing notes and cancels any scheduled future notes.
   * Also stops the refill loop and clears pending notes.
   */
  public clearSchedule(): void {
    this.stopRefillLoop();
    this.pendingNotes = [];
    this.pendingIndex = 0;
    // US2 T036: Stop all audio and clear transport schedule
    this.toneAdapter.stopAll();
  }
}
