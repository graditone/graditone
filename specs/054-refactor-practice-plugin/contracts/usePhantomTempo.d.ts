import type { PracticeState } from '../practiceEngine.types';
import type { ScorePlayerState } from '../plugin-api';

export interface UsePhantomTempoParams {
  practiceState: PracticeState;
  practiceStateRef: React.RefObject<PracticeState>;
  playerStateRef: React.RefObject<ScorePlayerState>;
}

export interface UsePhantomTempoReturn {
  /** Index into practiceState.notes indicating the phantom tempo cursor position. -1 when inactive. */
  phantomIndex: number;
}

export declare function usePhantomTempo(params: UsePhantomTempoParams): UsePhantomTempoReturn;
