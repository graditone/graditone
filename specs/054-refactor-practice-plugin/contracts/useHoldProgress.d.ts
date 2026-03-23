import type { PracticeState, PracticeAction } from '../practiceEngine.types';

export interface UseHoldProgressParams {
  practiceState: PracticeState;
  dispatchPractice: React.Dispatch<PracticeAction>;
}

export interface UseHoldProgressReturn {
  /** Progress fraction 0..1 for the hold duration indicator. 0 when not holding. */
  holdProgress: number;
}

export declare function useHoldProgress(params: UseHoldProgressParams): UseHoldProgressReturn;
