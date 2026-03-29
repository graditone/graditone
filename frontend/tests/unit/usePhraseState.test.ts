/**
 * Unit tests for usePhraseState hook
 * Feature 062 — Score Phrase Detection (US1, US2, US3)
 * Test T030: toggles phrasesVisible on/off
 * Test T038: selectPhrase sets selectedPhraseIndex
 * Test T045: goToNextPhrase / goToPreviousPhrase with wrap-around
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePhraseState } from '../../src/hooks/usePhraseState';
import type { PhraseRegion } from '../../src/types/score';

function makePhrase(startMeasure: number, endMeasure: number, startTick: number, endTick: number): PhraseRegion {
  return {
    instrument_index: 0,
    start_measure: startMeasure,
    end_measure: endMeasure,
    start_tick: startTick,
    end_tick: endTick,
  };
}

describe('usePhraseState', () => {
  const phrases: PhraseRegion[] = [
    makePhrase(0, 3, 0, 3840),
    makePhrase(4, 7, 3840, 7680),
    makePhrase(8, 11, 7680, 11520),
  ];

  // T030: toggles phrasesVisible on/off
  describe('T030 — phrasesVisible toggle', () => {
    it('starts with phrasesVisible = false', () => {
      const { result } = renderHook(() => usePhraseState(phrases));
      expect(result.current.phrasesVisible).toBe(false);
    });

    it('toggles phrasesVisible to true on first call', () => {
      const { result } = renderHook(() => usePhraseState(phrases));
      act(() => result.current.togglePhrases());
      expect(result.current.phrasesVisible).toBe(true);
    });

    it('toggles phrasesVisible back to false on second call', () => {
      const { result } = renderHook(() => usePhraseState(phrases));
      act(() => result.current.togglePhrases());
      act(() => result.current.togglePhrases());
      expect(result.current.phrasesVisible).toBe(false);
    });

    it('exposes the phrases array', () => {
      const { result } = renderHook(() => usePhraseState(phrases));
      expect(result.current.phrases).toBe(phrases);
    });

    it('returns empty phrases when input is undefined', () => {
      const { result } = renderHook(() => usePhraseState(undefined));
      expect(result.current.phrases).toEqual([]);
    });

    it('disables toggle when no phrases are available', () => {
      const { result } = renderHook(() => usePhraseState([]));
      expect(result.current.hasPhrases).toBe(false);
    });

    it('indicates phrases available when array is non-empty', () => {
      const { result } = renderHook(() => usePhraseState(phrases));
      expect(result.current.hasPhrases).toBe(true);
    });
  });

  // T038: selectPhrase sets selectedPhraseIndex and calls onPhraseSelect callback
  describe('T038 — selectPhrase', () => {
    it('starts with selectedPhraseIndex = null', () => {
      const { result } = renderHook(() => usePhraseState(phrases));
      expect(result.current.selectedPhraseIndex).toBeNull();
    });

    it('selectPhrase sets selectedPhraseIndex', () => {
      const { result } = renderHook(() => usePhraseState(phrases));
      act(() => result.current.selectPhrase(1));
      expect(result.current.selectedPhraseIndex).toBe(1);
    });

    it('selectPhrase calls onPhraseSelect with correct phrase ticks', () => {
      const onSelect = vi.fn();
      const { result } = renderHook(() => usePhraseState(phrases, { onPhraseSelect: onSelect }));
      act(() => result.current.selectPhrase(1));
      expect(onSelect).toHaveBeenCalledWith(3840, 7680);
    });

    it('selectPhrase(null) clears selection', () => {
      const onSelect = vi.fn();
      const { result } = renderHook(() => usePhraseState(phrases, { onPhraseSelect: onSelect }));
      act(() => result.current.selectPhrase(1));
      act(() => result.current.selectPhrase(null));
      expect(result.current.selectedPhraseIndex).toBeNull();
      expect(onSelect).toHaveBeenLastCalledWith(null, null);
    });

    it('selecting a different phrase updates the loop region', () => {
      const onSelect = vi.fn();
      const { result } = renderHook(() => usePhraseState(phrases, { onPhraseSelect: onSelect }));
      act(() => result.current.selectPhrase(0));
      expect(onSelect).toHaveBeenCalledWith(0, 3840);
      act(() => result.current.selectPhrase(2));
      expect(onSelect).toHaveBeenCalledWith(7680, 11520);
    });
  });

  // T045: goToNextPhrase / goToPreviousPhrase with wrap-around
  describe('T045 — phrase navigation', () => {
    it('goToNextPhrase from index 0 → index 1', () => {
      const onSelect = vi.fn();
      const { result } = renderHook(() => usePhraseState(phrases, { onPhraseSelect: onSelect }));
      act(() => result.current.selectPhrase(0));
      act(() => result.current.goToNextPhrase());
      expect(result.current.selectedPhraseIndex).toBe(1);
    });

    it('goToPreviousPhrase from index 1 → index 0', () => {
      const { result } = renderHook(() => usePhraseState(phrases));
      act(() => result.current.selectPhrase(1));
      act(() => result.current.goToPreviousPhrase());
      expect(result.current.selectedPhraseIndex).toBe(0);
    });

    it('goToNextPhrase wraps from last → first', () => {
      const { result } = renderHook(() => usePhraseState(phrases));
      act(() => result.current.selectPhrase(2));
      act(() => result.current.goToNextPhrase());
      expect(result.current.selectedPhraseIndex).toBe(0);
    });

    it('goToPreviousPhrase wraps from first → last', () => {
      const { result } = renderHook(() => usePhraseState(phrases));
      act(() => result.current.selectPhrase(0));
      act(() => result.current.goToPreviousPhrase());
      expect(result.current.selectedPhraseIndex).toBe(2);
    });

    it('goToNextPhrase with no selection starts at 0', () => {
      const { result } = renderHook(() => usePhraseState(phrases));
      act(() => result.current.goToNextPhrase());
      expect(result.current.selectedPhraseIndex).toBe(0);
    });

    it('navigation calls onPhraseSelect with new phrase ticks', () => {
      const onSelect = vi.fn();
      const { result } = renderHook(() => usePhraseState(phrases, { onPhraseSelect: onSelect }));
      act(() => result.current.selectPhrase(0));
      act(() => result.current.goToNextPhrase());
      expect(onSelect).toHaveBeenLastCalledWith(3840, 7680);
    });
  });
});
