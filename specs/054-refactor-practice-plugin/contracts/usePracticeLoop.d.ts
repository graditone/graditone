import type { PracticeState, PracticeAction } from '../practiceEngine.types';
import type { ScorePlayerState, PluginContext, PluginPracticeNoteEntry } from '../plugin-api';
import type { PerformanceRecord } from '../practiceEngine.types';

// --- Shared local types ---

export interface PinState {
  noteId: string;
  tick: number;
}

export interface LoopRegion {
  startTick: number;
  endTick: number;
}

export interface LoopRange {
  startIndex: number;
  endIndex: number;
}

// --- Hook contract ---

export interface UsePracticeLoopParams {
  practiceState: PracticeState;
  dispatchPractice: React.Dispatch<PracticeAction>;
  playerState: ScorePlayerState;
  practiceStartTimeRef: React.RefObject<number>;
  context: PluginContext;
  /** Called when loop practice completes — receives the performance snapshot */
  onComplete: (record: PerformanceRecord) => void;
  /** Called to show the results overlay */
  onResultsShow: () => void;
}

export interface UsePracticeLoopReturn {
  // Loop pin state
  loopStart: PinState | null;
  loopEndPin: PinState | null;
  loopCount: number;
  setLoopCount: React.Dispatch<React.SetStateAction<number>>;

  // Derived loop geometry
  pinnedNoteIds: ReadonlySet<string>;
  loopRegion: LoopRegion | null;
  loopPracticeRange: LoopRange | null;

  // Refs (writer-owns-ref: created here, read-only to consumers)
  loopRegionRef: React.RefObject<LoopRegion | null>;
  loopPracticeRangeRef: React.RefObject<LoopRange | null>;
  loopIterationRef: React.RefObject<number>;
  loopStartTimesRef: React.RefObject<number[]>;
  remainingLoopsRef: React.MutableRefObject<number>;

  // Callbacks
  handleNoteLongPress: (noteId: string) => void;
  /** Resets loop tracking state for restart (called by handlePracticeToggle) */
  resetLoopTracking: () => void;
}

export declare function usePracticeLoop(params: UsePracticeLoopParams): UsePracticeLoopReturn;
