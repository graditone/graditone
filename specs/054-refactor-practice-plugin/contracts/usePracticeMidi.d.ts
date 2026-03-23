import type { PracticeState, PracticeAction } from '../practiceEngine.types';
import type { ScorePlayerState, PluginContext, ChordDetector } from '../plugin-api';
import type { LoopRegion, LoopRange } from './usePracticeLoop.d';

export interface UsePracticeMidiParams {
  context: PluginContext;
  practiceStateRef: React.RefObject<PracticeState>;
  playerStateRef: React.RefObject<ScorePlayerState>;
  dispatchPractice: React.Dispatch<PracticeAction>;
  // From usePracticeLoop (read-only refs)
  loopRegionRef: React.RefObject<LoopRegion | null>;
  loopPracticeRangeRef: React.RefObject<LoopRange | null>;
  loopIterationRef: React.RefObject<number>;
  loopStartTimesRef: React.RefObject<number[]>;
  practiceStartTimeRef: React.RefObject<number>;
  selectedStaffIndex: number;
}

export interface UsePracticeMidiReturn {
  /** Set of currently pressed MIDI note IDs — reactivity trigger for highlights */
  midiPressedNoteIds: ReadonlySet<string>;
  /** Tick counter incremented on each MIDI event — reactivity trigger */
  midiEventTick: number;
  /** Writer-owns-ref: set of currently held MIDI key numbers */
  heldMidiKeysRef: React.RefObject<Set<number>>;
  /** Writer-owns-ref: chord detector instance */
  chordDetectorRef: React.RefObject<ChordDetector>;
}

export declare function usePracticeMidi(params: UsePracticeMidiParams): UsePracticeMidiReturn;
