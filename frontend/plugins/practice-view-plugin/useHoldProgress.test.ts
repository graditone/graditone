import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useHoldProgress } from './useHoldProgress';
import { INITIAL_PRACTICE_STATE } from './practiceEngine.types';

function makeMockParams() {
  return {
    practiceState: { ...INITIAL_PRACTICE_STATE },
    dispatchPractice: () => {},
  };
}

describe('useHoldProgress', () => {
  it('returns expected shape', () => {
    const { result } = renderHook(() => useHoldProgress(makeMockParams()));
    expect(result.current).toHaveProperty('holdProgress');
    expect(typeof result.current.holdProgress).toBe('number');
  });
});
