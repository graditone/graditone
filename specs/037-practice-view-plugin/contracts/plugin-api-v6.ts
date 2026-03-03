/**
 * Plugin API v6 Contract — Feature 037: Practice View Plugin (External)
 *
 * v6 adds three things:
 *   1. `ScorePlayerState.staffCount` — number of staves in the loaded score
 *   2. `PluginPracticeNoteEntry` — replaces `{ midiPitch }` with `{ midiPitches, noteIds, tick }`
 *   3. `extractPracticeNotes(staffIndex, maxCount?)` — staff-aware extraction
 *
 * All v5 fields are preserved unchanged for backward compatibility.
 * v2–v5 plugins receive a no-op stub for the new capability.
 *
 * GEOMETRY CONSTRAINT (Principle VI):
 *   New types carry ONLY MIDI integers, opaque note ID strings, and integer tick values.
 *   No (x, y) coordinates, bounding boxes, or spatial data cross the plugin API boundary.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Re-export everything from v5 that is unchanged
// ─────────────────────────────────────────────────────────────────────────────

export type {
  PluginNoteEvent,
  PluginRecordingContext,
  PluginManifest,
  PluginStaffViewerProps,
  PluginScoreRendererProps,
  PluginScoreSelectorProps,
  PluginPreloadedScore,
  ScoreLoadSource,
  PluginPlaybackStatus,
  PluginMetronomeContext,
  MetronomeState,
  MetronomeSubdivision,
  MusicorePlugin,
} from '../../../frontend/src/plugin-api/types';

// ─────────────────────────────────────────────────────────────────────────────
// v6 new type: PluginPracticeNoteEntry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single note-position entry in the practice note sequence.
 *
 * Replaces the v5 `{ midiPitch: number }` item shape in PluginScorePitches.
 *
 * For single notes: `midiPitches` has one element and `noteIds` has one element.
 * For chords: `midiPitches` carries ALL pitches at the tick (parallel to `noteIds`).
 *
 * Usage:
 *   - MIDI matching: check if `event.midiNote` is in `midiPitches`
 *   - Highlighting:  pass `new Set(noteIds)` to ScoreRenderer.highlightedNoteIds
 *   - Seeking:       seek to `tick` for score navigation
 *
 * GEOMETRY CONSTRAINT: carries only MIDI integers, opaque IDs, and integer ticks.
 */
export interface PluginPracticeNoteEntry {
  /**
   * Ordered MIDI pitch(es) at this score position.
   * For single notes: exactly one element.
   * For chords: all pitches present at this tick on the target staff/voice.
   * Any match in this array (exact integer equality) counts as a correct press.
   */
  readonly midiPitches: ReadonlyArray<number>;

  /**
   * Opaque note ID string(s) parallel to `midiPitches`.
   * Pass this array's contents as `new Set(noteIds)` to ScoreRenderer.highlightedNoteIds
   * to highlight the target note(s) on screen.
   * IDs carry no spatial data — they are identifiers only.
   */
  readonly noteIds: ReadonlyArray<string>;

  /**
   * Absolute tick position of this note/chord (960-PPQ integer).
   * Use with context.scorePlayer.seekToTick(tick) to reposition the score.
   */
  readonly tick: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// v6 updated type: PluginScorePitches
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Flat ordered list of note/chord entries extracted from the selected staff.
 * Returned by context.scorePlayer.extractPracticeNotes(staffIndex, maxCount?).
 *
 * v6 change from v5:
 *   - `notes` items are now `PluginPracticeNoteEntry` (was `{ midiPitch: number }`)
 *   - `clef` now reflects the selected staffIndex's clef (was always staves[0])
 *
 * GEOMETRY CONSTRAINT: contains only MIDI integers, opaque IDs, ticks, and metadata.
 */
export interface PluginScorePitches {
  /**
   * Ordered note/chord entries extracted from the selected staff.
   * Length: min(maxCount ?? Infinity, totalAvailable).
   * Rests excluded. Chords produce one entry with all pitches.
   */
  readonly notes: ReadonlyArray<PluginPracticeNoteEntry>;

  /**
   * Total playable note-positions available on the selected staff, before cap.
   */
  readonly totalAvailable: number;

  /**
   * Clef of the selected staffIndex.
   * Normalised: 'Treble' | 'Bass'. Unusual clefs (Alto, Tenor) map to 'Treble'.
   */
  readonly clef: 'Treble' | 'Bass';

  /** Display title from score metadata; null if absent in the file. */
  readonly title: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// v6 updated type: ScorePlayerState (adds staffCount)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Snapshot of playback state pushed to plugin subscribers.
 *
 * v6 addition: `staffCount`
 */
export interface ScorePlayerState {
  // v5 fields (unchanged)
  readonly status: import('../../../frontend/src/plugin-api/types').PluginPlaybackStatus;
  readonly currentTick: number;
  readonly totalDurationTicks: number;
  readonly highlightedNoteIds: ReadonlySet<string>;
  readonly bpm: number;
  readonly title: string | null;
  readonly error: string | null;
  readonly timeSignature: {
    readonly numerator: number;
    readonly denominator: number;
  };

  // ─── v6 addition ────────────────────────────────────────────────────────

  /**
   * Number of staves in the currently-loaded score.
   *
   * - 0: no score loaded (status is 'idle', 'loading', or 'error')
   * - 1: single-staff score (e.g. solo instrument) — skip staff selector
   * - 2: grand staff / piano score (Treble + Bass)
   * - N: ensemble stave (rare, but supported)
   *
   * Updated once per loadScore() cycle; stable while status === 'ready'.
   */
  readonly staffCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// v6 updated interface: PluginScorePlayerContext (adds extractPracticeNotes v6)
// ─────────────────────────────────────────────────────────────────────────────

export interface PluginScorePlayerContext {
  // ─── All v3/v4/v5 methods (unchanged) ────────────────────────────────────
  getCatalogue(): ReadonlyArray<import('../../../frontend/src/plugin-api/types').PluginPreloadedScore>;
  loadScore(source: import('../../../frontend/src/plugin-api/types').ScoreLoadSource): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  seekToTick(tick: number): void;
  setPinnedStart(tick: number | null): void;
  setLoopEnd(tick: number | null): void;
  setTempoMultiplier(multiplier: number): void;
  subscribe(handler: (state: ScorePlayerState) => void): () => void;
  getCurrentTickLive(): number;

  // ─── v6 updated (replaces v4/v5 extractPracticeNotes) ────────────────────

  /**
   * Extract an ordered list of note/chord positions from the specified staff.
   *
   * v6 change from v5:
   *   - First parameter `staffIndex` added (0-based; 0 = top/treble staff)
   *   - `maxCount` is now optional (omit to receive all notes)
   *   - Returned entries are `PluginPracticeNoteEntry` (includes `noteIds`, `tick`)
   *   - For chords: ALL pitches at each tick are returned (not just the maximum)
   *
   * Must only be called when `scorePlayerState.status === 'ready'`.
   * Returns null if status is not 'ready' (no score, loading, or error).
   *
   * Extraction rules (applied by host — plugin receives results only):
   *   - Source: instruments[0].staves[staffIndex].voices[0]
   *   - Rests (events without pitch) are excluded
   *   - Chords: ALL simultaneous pitches at the same tick are included in midiPitches[]
   *   - Results are ordered by ascending tick
   *   - If staffIndex ≥ staffCount, returns null
   *
   * @param staffIndex - 0-based staff index (0 = treble/top, 1 = bass/bottom, etc.)
   * @param maxCount   - Optional cap on returned entries
   *
   * @example Practice mode activation:
   * ```tsx
   * const pitches = context.scorePlayer.extractPracticeNotes(selectedStaffIndex);
   * if (pitches) {
   *   practiceEngine.dispatch({ type: 'START', notes: pitches.notes, staffIndex: selectedStaffIndex });
   * }
   * ```
   *
   * @example Staff selector:
   * ```tsx
   * // staffCount > 1 → show selector; staffCount === 1 → auto-select 0
   * const staffCount = scorePlayerState.staffCount;
   * ```
   */
  extractPracticeNotes(staffIndex: number, maxCount?: number): PluginScorePitches | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// v6 PluginContext (extends v5)
// ─────────────────────────────────────────────────────────────────────────────

import type { ComponentType } from 'react';

export interface PluginContext {
  // ─── v2 fields (unchanged) ────────────────────────────────────────────────
  emitNote(event: import('../../../frontend/src/plugin-api/types').PluginNoteEvent): void;
  playNote(event: import('../../../frontend/src/plugin-api/types').PluginNoteEvent): void;
  readonly midi: {
    readonly subscribe: (
      handler: (event: import('../../../frontend/src/plugin-api/types').PluginNoteEvent) => void
    ) => () => void;
  };
  readonly recording: import('../../../frontend/src/plugin-api/types').PluginRecordingContext;
  stopPlayback(): void;
  close(): void;
  readonly manifest: Readonly<import('../../../frontend/src/plugin-api/types').PluginManifest>;

  // ─── v3 components (unchanged) ────────────────────────────────────────────
  readonly components: {
    readonly StaffViewer: ComponentType<import('../../../frontend/src/plugin-api/types').PluginStaffViewerProps>;
    readonly ScoreRenderer: ComponentType<import('../../../frontend/src/plugin-api/types').PluginScoreRendererProps>;
    readonly ScoreSelector: ComponentType<import('../../../frontend/src/plugin-api/types').PluginScoreSelectorProps>;
  };

  // ─── v3 scorePlayer (v6 updated — extractPracticeNotes signature change) ──
  readonly scorePlayer: PluginScorePlayerContext;

  // ─── v5 metronome (unchanged) ─────────────────────────────────────────────
  readonly metronome: import('../../../frontend/src/plugin-api/types').PluginMetronomeContext;
}

// ─────────────────────────────────────────────────────────────────────────────
// API version constant
// ─────────────────────────────────────────────────────────────────────────────

export const PLUGIN_API_VERSION = '6' as const;

// ─────────────────────────────────────────────────────────────────────────────
// MusicorePlugin (unchanged from v2–v5)
// ─────────────────────────────────────────────────────────────────────────────

export interface MusicorePlugin {
  init(context: PluginContext): void;
  dispose?(): void;
  Component: ComponentType;
}
