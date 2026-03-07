/**
 * Playback Types
 * 
 * Type definitions for music playback state and scheduling.
 * Feature: 003-music-playback, 024-playback-performance
 */

/**
 * Playback status indicating the current state of audio playback
 */
export type PlaybackStatus = 'stopped' | 'playing' | 'paused';

/**
 * Feature 024: Non-React mechanism for reading the current playback tick.
 * Used by the rAF highlight loop to avoid React state subscriptions.
 */
export interface ITickSource {
  /** Current playback position in ticks. Updated by the playback engine. */
  readonly currentTick: number;
  /** Current playback status */
  readonly status: PlaybackStatus;
}

/**
 * Complete playback state tracking position and status
 */
export interface PlaybackState {
  /** Current playback status */
  status: PlaybackStatus;
  
  /** Current playback position in ticks (0 to max score duration) */
  currentTick: number;
  
  /** Tone.now() timestamp when playback started (undefined when stopped) */
  startTime?: number;
  
  /** Tick position when paused (undefined when not paused) */
  pausedAt?: number;
}

/**
 * Scheduled note with both musical timing (ticks) and real-time timing (seconds)
 * Used internally by PlaybackScheduler to track scheduled audio events
 */
export interface ScheduledNote {
  /** Note entity ID for tracking */
  noteId: string;
  
  /** MIDI pitch (21-108 for piano) */
  pitch: number;
  
  /** Musical time position in ticks */
  startTick: number;
  
  /** Musical duration in ticks */
  durationTicks: number;
  
  /** Real-time scheduled start (Tone.now() + offset) */
  startTime: number;
  
  /** Real-time duration in seconds */
  durationSeconds: number;
}

/**
 * Tempo adjustment state
 * 
 * Feature 008 - Tempo Change: Manages playback tempo multiplier
 * Separate from score's TempoEvent (domain model) - this is playback adapter state
 */
export interface TempoState {
  /**
   * Tempo multiplier applied to playback
   * - 1.0 = 100% (no change)
   * - 0.5 = 50% (half speed)
   * - 2.0 = 200% (double speed)
   * Range: 0.5 to 2.0
   */
  tempoMultiplier: number;

  /**
   * Original tempo from score (in BPM)
   * Used to calculate effective tempo for display
   * Example: 120 BPM * 0.8 multiplier = 96 BPM effective
   */
  originalTempo: number;
}

/**
 * Tempo preference stored in browser localStorage
 * 
 * Feature 008 - Tempo Change: Per-score tempo persistence
 * Key format: "graditone:tempo:{scoreId}"
 * Example: "graditone:tempo:d5f8a9c2-4b3e-11ef-9a1b-0242ac110002"
 */
export interface TempoPreference {
  /**
   * Unique identifier for the score
   * Matches Score.id from backend API
   */
  scoreId: string;

  /**
   * Saved tempo multiplier (0.5 to 2.0)
   */
  tempoMultiplier: number;

  /**
   * When this preference was last saved (Unix timestamp in milliseconds)
   * Used for cleanup of old preferences
   */
  timestamp: number;

  /**
   * Schema version for future migrations
   * Current version: 1
   */
  version: number;
}

/**
 * Feature 009: Playback Scroll and Highlight
 * Auto-scroll configuration and state
 */

/**
 * Auto-scroll state during playback
 */
export interface ScrollState {
  /** Whether auto-scroll is currently enabled */
  enabled: boolean;
  
  /** Target scroll position in pixels (calculated from currentTick) */
  targetScrollX: number;
  
  /** Timestamp of last programmatic scroll update (for manual override detection) */
  lastAutoScrollTime: number;
}

/**
 * Scroll calculation configuration
 */
export interface ScrollConfig {
  /** Desired position ratio (0-1) for current playback position in viewport */
  targetPositionRatio: number;  // Default: 0.3 (30% from left)
  
  /** Pixels per tick from layout engine */
  pixelsPerTick: number;
  
  /** Viewport width in pixels */
  viewportWidth: number;
  
  /** Total score width in pixels (from NotationLayoutEngine) */
  totalWidth: number;
  
  /** Current horizontal scroll position in pixels */
  currentScrollX: number;
}

/**
 * Result of scroll position calculation
 */
export interface ScrollCalculation {
  /** Target scroll position in pixels (clamped to valid range) */
  scrollX: number;
  
  /** Whether scrolling should occur (false if score fits in viewport) */
  shouldScroll: boolean;
  
  /** Whether we're near the end of the score */
  nearEnd: boolean;
}
