/**
 * useUserScores.test.ts — Unit tests for the useUserScores React hook.
 * Feature 045: Persist Uploaded Scores — T006
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUserScores } from '../../hooks/useUserScores';
import { USER_SCORES_INDEX_KEY } from '../../services/userScoreIndex';

// ── localStorage mock ──────────────────────────────────────────────────────
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

beforeEach(() => {
  vi.stubGlobal('localStorage', localStorageMock);
  localStorageMock.clear();
});

describe('useUserScores — initial state', () => {
  it('returns empty array when index is empty', () => {
    const { result } = renderHook(() => useUserScores());
    expect(result.current.userScores).toEqual([]);
  });

  it('loads existing entries from localStorage on mount', () => {
    // Pre-populate localStorage with a score
    const existing = [{ id: 'pre-1', displayName: 'Pre-loaded', uploadedAt: new Date().toISOString() }];
    localStorageMock.setItem(USER_SCORES_INDEX_KEY, JSON.stringify(existing));

    const { result } = renderHook(() => useUserScores());
    expect(result.current.userScores).toHaveLength(1);
    expect(result.current.userScores[0].id).toBe('pre-1');
  });
});

describe('useUserScores — addUserScore', () => {
  it('adds to state and returns the new entry', () => {
    const { result } = renderHook(() => useUserScores());

    let entry: ReturnType<typeof result.current.addUserScore>;
    act(() => {
      entry = result.current.addUserScore('score-1', 'My Waltz');
    });

    expect(result.current.userScores).toHaveLength(1);
    expect(result.current.userScores[0].id).toBe('score-1');
    expect(entry!.displayName).toBe('My Waltz');
  });

  it('updates the underlying localStorage index', () => {
    const { result } = renderHook(() => useUserScores());

    act(() => {
      result.current.addUserScore('score-2', 'Prelude');
    });

    const raw = localStorageMock.getItem(USER_SCORES_INDEX_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed[0].id).toBe('score-2');
  });

  it('second call with same display name deduplicates', () => {
    const { result } = renderHook(() => useUserScores());

    act(() => {
      result.current.addUserScore('score-1', 'Nocturne');
      result.current.addUserScore('score-2', 'Nocturne');
    });

    const names = result.current.userScores.map((s) => s.displayName);
    expect(names).toContain('Nocturne');
    expect(names).toContain('Nocturne (2)');
  });
});

describe('useUserScores — removeUserScore', () => {
  it('removes the entry from state', () => {
    const { result } = renderHook(() => useUserScores());

    act(() => {
      result.current.addUserScore('score-1', 'Waltz');
      result.current.addUserScore('score-2', 'Mazurka');
    });
    act(() => {
      result.current.removeUserScore('score-1');
    });

    expect(result.current.userScores).toHaveLength(1);
    expect(result.current.userScores[0].id).toBe('score-2');
  });

  it('updates localStorage after removal', () => {
    const { result } = renderHook(() => useUserScores());

    act(() => {
      result.current.addUserScore('score-1', 'Waltz');
    });
    act(() => {
      result.current.removeUserScore('score-1');
    });

    const raw = localStorageMock.getItem(USER_SCORES_INDEX_KEY);
    const parsed = JSON.parse(raw!);
    expect(parsed).toEqual([]);
  });
});

describe('useUserScores — refreshUserScores', () => {
  it('re-reads from localStorage and updates state', () => {
    const { result } = renderHook(() => useUserScores());

    // Directly mutate localStorage outside the hook (simulating another tab)
    const external = [{ id: 'ext-1', displayName: 'External', uploadedAt: new Date().toISOString() }];
    localStorageMock.setItem(USER_SCORES_INDEX_KEY, JSON.stringify(external));

    act(() => {
      result.current.refreshUserScores();
    });

    expect(result.current.userScores).toHaveLength(1);
    expect(result.current.userScores[0].id).toBe('ext-1');
  });
});
