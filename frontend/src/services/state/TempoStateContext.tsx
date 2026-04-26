/**
 * TempoStateContext - React Context for tempo state management
 * 
 * Feature 008 - Tempo Change: Provides global tempo state and methods
 * for adjusting, resetting, and calculating effective tempo.
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { TempoState } from '../../types/playback';
import {
  clampTempoMultiplier,
  DEFAULT_TEMPO_MULTIPLIER,
} from '../../utils/tempoCalculations';

/**
 * Context value interface
 */
interface TempoStateContextValue {
  tempoState: TempoState;
  setTempoMultiplier: (multiplier: number) => void;
  adjustTempo: (percentageChange: number) => void;
  resetTempo: () => void;
  getEffectiveTempo: () => number;
  setOriginalTempo: (tempo: number) => void;
}

/**
 * React Context for tempo state
 */
const TempoStateContext = createContext<TempoStateContextValue | undefined>(undefined);

/**
 * Props for TempoStateProvider
 */
interface TempoStateProviderProps {
  children: ReactNode;
}

/**
 * Default original tempo (BPM)
 */
const DEFAULT_ORIGINAL_TEMPO = 120;

/**
 * TempoStateProvider - Provides tempo state to child components
 * 
 * @param props - Component props
 * @returns Provider component
 */
export function TempoStateProvider({ children }: TempoStateProviderProps) {
  const [tempoState, setTempoState] = useState<TempoState>({
    tempoMultiplier: DEFAULT_TEMPO_MULTIPLIER,
    originalTempo: DEFAULT_ORIGINAL_TEMPO,
  });

  /**
   * Set tempo multiplier directly (with clamping and integer-BPM snapping).
   *
   * Snaps the multiplier so that originalTempo × multiplier is always a whole
   * number BPM.  This guarantees the note schedule and the metronome use the
   * exact same interval, eliminating progressive drift at fractional tempos
   * (e.g. 120 BPM × 11% = 13.2 BPM would otherwise drift ~70 ms per beat).
   *
   * @param multiplier - New tempo multiplier (0.5 to 2.0)
   */
  const setTempoMultiplier = useCallback((multiplier: number): void => {
    setTempoState((prev) => {
      const clamped = clampTempoMultiplier(multiplier);
      // Snap: round(originalTempo × m) / originalTempo → integer BPM
      const snapped = prev.originalTempo > 0
        ? clampTempoMultiplier(Math.round(prev.originalTempo * clamped) / prev.originalTempo)
        : clamped;
      return { ...prev, tempoMultiplier: snapped };
    });
  }, []);

  /**
   * Adjust tempo by percentage change (with integer-BPM snapping).
   *
   * @param percentageChange - Change in percentage points (e.g., +1 for +1%, -10 for -10%)
   *
   * @example
   * adjustTempo(1);   // Increase by 1% (1.0 → 1.01)
   * adjustTempo(-1);  // Decrease by 1% (1.0 → 0.99)
   * adjustTempo(10);  // Increase by 10% (1.0 → 1.10)
   * adjustTempo(-10); // Decrease by 10% (1.0 → 0.90)
   */
  const adjustTempo = useCallback((percentageChange: number): void => {
    setTempoState((prev) => {
      const raw = prev.tempoMultiplier + percentageChange / 100;
      const clamped = clampTempoMultiplier(raw);
      const snapped = prev.originalTempo > 0
        ? clampTempoMultiplier(Math.round(prev.originalTempo * clamped) / prev.originalTempo)
        : clamped;
      return { ...prev, tempoMultiplier: snapped };
    });
  }, []);

  /**
   * Reset tempo multiplier to 1.0 (100%)
   */
  const resetTempo = useCallback((): void => {
    setTempoState((prev) => ({
      ...prev,
      tempoMultiplier: DEFAULT_TEMPO_MULTIPLIER,
    }));
  }, []);

  /**
   * Get effective tempo in BPM (rounded to whole number)
   * 
   * @returns Effective tempo (originalTempo * tempoMultiplier)
   */
  const getEffectiveTempo = useCallback((): number => {
    return Math.round(tempoState.originalTempo * tempoState.tempoMultiplier);
  }, [tempoState.originalTempo, tempoState.tempoMultiplier]);

  /**
   * Set original tempo (from score)
   * 
   * @param tempo - Original tempo in BPM
   */
  const setOriginalTempo = useCallback((tempo: number): void => {
    setTempoState((prev) => ({
      ...prev,
      originalTempo: tempo,
    }));
  }, []);

  const value: TempoStateContextValue = {
    tempoState,
    setTempoMultiplier,
    adjustTempo,
    resetTempo,
    getEffectiveTempo,
    setOriginalTempo,
  };

  return (
    <TempoStateContext.Provider value={value}>
      {children}
    </TempoStateContext.Provider>
  );
}

/**
 * Hook to access tempo state
 * 
 * @returns Tempo state context value
 * @throws Error if used outside TempoStateProvider
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useTempoState(): TempoStateContextValue {
  const context = useContext(TempoStateContext);
  if (context === undefined) {
    throw new Error('useTempoState must be used within TempoStateProvider');
  }
  return context;
}
