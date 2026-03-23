import type { PracticeState } from '../practiceEngine.types';
import type { ScorePlayerState } from '../plugin-api';

export interface UsePracticeHighlightsParams {
  practiceState: PracticeState;
  playerState: ScorePlayerState;
  /** From usePracticeMidi — triggers recomputation on MIDI events */
  midiPressedNoteIds: ReadonlySet<string>;
  /** From usePracticeMidi — tick counter triggering recomputation */
  midiEventTick: number;
  /** From usePracticeMidi — read-only ref of currently held MIDI keys */
  heldMidiKeysRef: React.RefObject<Set<number>>;
  /** From usePhantomTempo — phantom cursor position */
  phantomIndex: number;
  /** From ResultsOverlay — whether replay animation is active */
  isReplaying: boolean;
  /** From ResultsOverlay — note IDs highlighted during replay */
  replayHighlightedNoteIds: ReadonlySet<string>;
}

export interface UsePracticeHighlightsReturn {
  /** Note IDs the player should target next */
  targetNoteIds: ReadonlySet<string>;
  /** Note IDs confirmed as correctly played in the current chord */
  confirmedNoteIds: ReadonlySet<string>;
  /** Human-readable pitch labels for currently pressed keys */
  pressedPitchLabels: string[];
  /** Human-readable pitch labels for expected keys */
  expectedPitchLabels: string[];
  /** Combined set of note IDs to visually highlight (active practice or replay) */
  highlightedNoteIds: ReadonlySet<string>;
  /** Whether practice mode is 'active' or 'holding' */
  practiceActive: boolean;
  /** Whether practice mode is 'waiting' */
  practiceWaiting: boolean;
}

export declare function usePracticeHighlights(params: UsePracticeHighlightsParams): UsePracticeHighlightsReturn;
