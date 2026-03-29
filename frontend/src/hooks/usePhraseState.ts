/**
 * usePhraseState — Phrase visibility, selection, and navigation state
 * Feature 062: Score Phrase Detection
 *
 * Manages the toggle for showing/hiding phrase color bands on the score,
 * phrase selection for loop regions, and next/previous navigation.
 */

import { useState, useCallback, useMemo } from 'react';
import type { PhraseRegion } from '../types/score';

export interface PhraseStateOptions {
  /** Called when a phrase is selected/deselected with its tick range */
  onPhraseSelect?: (startTick: number | null, endTick: number | null) => void;
}

export interface PhraseState {
  /** Whether phrase color bands are visible on the score */
  phrasesVisible: boolean;
  /** Toggle phrase visibility on/off */
  togglePhrases: () => void;
  /** The phrase regions from the score (empty array if none) */
  phrases: readonly PhraseRegion[];
  /** Whether the score has any detected phrases */
  hasPhrases: boolean;
  /** Currently selected phrase index (null = none) */
  selectedPhraseIndex: number | null;
  /** Select a phrase by index (null to deselect) */
  selectPhrase: (index: number | null) => void;
  /** Navigate to the next phrase (wraps around) */
  goToNextPhrase: () => void;
  /** Navigate to the previous phrase (wraps around) */
  goToPreviousPhrase: () => void;
}

/**
 * Hook for managing phrase overlay state.
 *
 * @param phrases - Phrase regions from Score.phrases (may be undefined)
 * @param options - Optional callbacks for phrase selection
 * @returns PhraseState with toggle, visibility, selection, and navigation
 */
export function usePhraseState(phrases: PhraseRegion[] | undefined, options?: PhraseStateOptions): PhraseState {
  const [phrasesVisible, setPhrasesVisible] = useState(false);
  const [selectedPhraseIndex, setSelectedPhraseIndex] = useState<number | null>(null);

  const safePhrases = useMemo(() => phrases ?? [], [phrases]);
  const hasPhrases = safePhrases.length > 0;

  const togglePhrases = useCallback(() => {
    setPhrasesVisible(prev => !prev);
  }, []);

  const selectPhrase = useCallback((index: number | null) => {
    setSelectedPhraseIndex(index);
    if (index !== null && safePhrases[index]) {
      options?.onPhraseSelect?.(safePhrases[index].start_tick, safePhrases[index].end_tick);
    } else {
      options?.onPhraseSelect?.(null, null);
    }
  }, [safePhrases, options]);

  const goToNextPhrase = useCallback(() => {
    if (safePhrases.length === 0) return;
    setSelectedPhraseIndex(prev => {
      const next = prev === null ? 0 : (prev + 1) % safePhrases.length;
      options?.onPhraseSelect?.(safePhrases[next].start_tick, safePhrases[next].end_tick);
      return next;
    });
  }, [safePhrases, options]);

  const goToPreviousPhrase = useCallback(() => {
    if (safePhrases.length === 0) return;
    setSelectedPhraseIndex(prev => {
      const next = prev === null ? safePhrases.length - 1 : (prev - 1 + safePhrases.length) % safePhrases.length;
      options?.onPhraseSelect?.(safePhrases[next].start_tick, safePhrases[next].end_tick);
      return next;
    });
  }, [safePhrases, options]);

  return {
    phrasesVisible,
    togglePhrases,
    phrases: safePhrases,
    hasPhrases,
    selectedPhraseIndex,
    selectPhrase,
    goToNextPhrase,
    goToPreviousPhrase,
  };
}
