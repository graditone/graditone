/**
 * savedPractice.types.ts — Shared type definitions for saved practice feature.
 * Feature 056: Save and Load Practices
 * Feature 092: Free Practice Option — adds FreeMidiEvent, FreeMidiRecord,
 *              extends ScoreRef with 'free' type, extends SavedPractice with freeMidiRecord.
 *
 * Defines the data model for persisting practice sessions.
 * Full data is stored in IndexedDB; lightweight index entries in localStorage.
 */
import type { PluginPracticeNoteEntry } from '../plugin-api/types';
import type { PracticeNoteResult, WrongNoteEvent } from '../../plugins/practice-view-plugin/practiceEngine.types';

// ---------------------------------------------------------------------------
// Score Reference
// ---------------------------------------------------------------------------

/** Reference to identify and load the original score. */
export interface ScoreRef {
  /**
   * Source type of the score.
   * - 'preloaded': bundled catalogue score; `id` is the catalogue filename.
   * - 'user': user-uploaded score stored in IndexedDB; `id` is the UUID.
   * - 'free': score-less free practice session (Feature 092); `id` MUST be ''.
   */
  type: 'preloaded' | 'user' | 'free';
  /** Filename for preloaded scores (e.g., `Beethoven_FurElise.mxl`), IndexedDB UUID for user-uploaded scores, empty string for free practice. */
  id: string;
}

// ---------------------------------------------------------------------------
// Free Practice types (Feature 092)
// ---------------------------------------------------------------------------

/** A single MIDI note-attack event captured during a free practice session. */
export interface FreeMidiEvent {
  /** MIDI pitch (0–127). */
  midiNote: number;
  /** Wall-clock ms elapsed from session start at the moment of the note-attack. */
  timestampMs: number;
  /**
   * Note duration in ms (attack → release). Populated since the VirtualKeyboard-style
   * release-tracking fix; undefined for events recorded before that change.
   */
  durationMs?: number;
}

/** Snapshot of a completed free practice session — used for display and replay. */
export interface FreeMidiRecord {
  /** All note-attack events ordered by timestampMs. */
  events: FreeMidiEvent[];
  /** Total wall-clock duration of the session in ms (captured at Stop). */
  elapsedMs: number;
  /** Redundant with events.length — stored for fast display without deserialisation. */
  noteCount: number;
  /** BPM active at the end of the session. */
  bpm: number;
}

// ---------------------------------------------------------------------------
// Performance Data
// ---------------------------------------------------------------------------

/** Serializable copy of the performance record, covering both complete and partial sessions. */
export interface SavedPerformanceData {
  notes: PluginPracticeNoteEntry[];
  noteResults: PracticeNoteResult[];
  wrongNoteEvents: WrongNoteEvent[];
  bpmAtCompletion: number;
  /** Non-null for partial practices. */
  stoppedAtIndex: number | null;
  /** Non-null for partial practices. */
  totalNoteCount: number | null;
}

// ---------------------------------------------------------------------------
// Full Saved Practice (IndexedDB `practices` store)
// ---------------------------------------------------------------------------

/** Complete persisted record of a practice session, including all performance data for replay. */
export interface SavedPractice {
  /** UUID v4. */
  id: string;
  /** Auto-generated: {score_name}-{hand}-{scope}-{datetime} or FreePractice-{datetime}. */
  name: string;
  /** ISO 8601 timestamp of when the practice was saved. */
  savedAt: string;
  scoreRef: ScoreRef;
  scoreTitle: string;
  /** 0 = RH, 1 = LH, -1 = BH. Always 0 for free practice sessions. */
  staffIndex: number;
  loopRegion: { startTick: number; endTick: number } | null;
  tempoMultiplier: number;
  loopCount: number;
  completionStatus: 'complete' | 'partial';
  performanceData: SavedPerformanceData;
  /**
   * Feature 092: Raw MIDI event log for free practice sessions.
   * Present if and only if scoreRef.type === 'free'.
   */
  freeMidiRecord?: FreeMidiRecord;
}

// ---------------------------------------------------------------------------
// Lightweight Index Entry (localStorage)
// ---------------------------------------------------------------------------

/** Minimal metadata for fast list rendering in the load score dialog. No performance data. */
export interface SavedPracticeIndexEntry {
  /** Same UUID as SavedPractice.id. */
  id: string;
  name: string;
  /** ISO 8601. */
  savedAt: string;
  completionStatus: 'complete' | 'partial';
  scoreTitle: string;
}
