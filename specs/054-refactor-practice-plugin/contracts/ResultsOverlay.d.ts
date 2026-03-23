import type { PracticeState /* PracticeNoteResult, WrongNoteEvent */ } from '../practiceEngine.types';
import type { ScorePlayerState, PluginContext } from '../plugin-api';
import type { PerformanceRecord, PartialPerformanceRecord } from '../practiceEngine.types';
import type { LoopRegion } from './usePracticeLoop.d';

export interface ResultsOverlayProps {
  practiceState: PracticeState;
  playerState: ScorePlayerState;
  /** Completed session record (full loop). Null if not yet completed. */
  performanceRecord: PerformanceRecord | null;
  /** Partial record from mid-practice stop. Null if practice completed normally. */
  partialPerformanceRecord: PartialPerformanceRecord | null;
  /** Whether the results overlay is visible */
  resultsOverlayVisible: boolean;
  /** Current loop region (for loop slider visibility) */
  loopRegion: LoopRegion | null;
  /** Number of loop iterations */
  loopCount: number;
  /** Setter for loop count (from the loop slider) */
  setLoopCount: React.Dispatch<React.SetStateAction<number>>;
  /** Plugin context for playNote/stopPlayback during replay */
  context: PluginContext;
  /** Called when user taps "Practice Again" */
  onRepractice: () => void;
  /** Called to dismiss the overlay */
  onDismiss: () => void;
}

/**
 * ResultsOverlay communicates replay state back to the orchestrator via these
 * callbacks in a lifted-state pattern, since the orchestrator needs to pass
 * isReplaying/replayHighlightedNoteIds to usePracticeHighlights.
 *
 * Alternative: ResultsOverlay manages replay state internally and exposes it
 * via a ref. The orchestrator reads the ref. This was rejected because refs
 * don't trigger re-renders, and the highlight computation depends on these values.
 */
export interface ResultsOverlayReplayCallbacks {
  isReplaying: boolean;
  replayHighlightedNoteIds: ReadonlySet<string>;
  setIsReplaying: React.Dispatch<React.SetStateAction<boolean>>;
  setReplayHighlightedNoteIds: React.Dispatch<React.SetStateAction<ReadonlySet<string>>>;
}

export declare const ResultsOverlay: React.FC<ResultsOverlayProps & ResultsOverlayReplayCallbacks>;
