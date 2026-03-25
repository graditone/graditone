/**
 * savedPractice.types.ts — Shared type definitions for saved practice feature.
 * Feature 056: Save and Load Practices
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
  /** Source type of the score. */
  type: 'preloaded' | 'user';
  /** Filename for preloaded scores (e.g., `Beethoven_FurElise.mxl`), IndexedDB UUID for user-uploaded scores. */
  id: string;
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
  /** Auto-generated: {score_name}-{hand}-{scope}-{datetime}. */
  name: string;
  /** ISO 8601 timestamp of when the practice was saved. */
  savedAt: string;
  scoreRef: ScoreRef;
  scoreTitle: string;
  /** 0 = RH, 1 = LH, -1 = BH. */
  staffIndex: number;
  loopRegion: { startTick: number; endTick: number } | null;
  tempoMultiplier: number;
  loopCount: number;
  completionStatus: 'complete' | 'partial';
  performanceData: SavedPerformanceData;
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
