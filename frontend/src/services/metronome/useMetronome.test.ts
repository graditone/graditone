/**
 * useMetronome — Unit Tests
 * Feature 035: Metronome for Play and Practice Views
 * Task T004 (hook lifecycle, state subscription, cleanup on unmount)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ─── Mock MetronomeEngine ─────────────────────────────────────────────────────
//
// vi.hoisted ensures the shared mock state and constructor are available
// BEFORE the vi.mock factory is resolved (factories are hoisted to top of file).

type StateVal = { active: boolean; beatIndex: number; isDownbeat: boolean; bpm: number };

const mockEngineState = vi.hoisted(() => {
  const INACTIVE: StateVal = { active: false, beatIndex: -1, isDownbeat: false, bpm: 0 };

  let _handler: ((s: StateVal) => void) | null = null;
  let _instance: Record<string, ReturnType<typeof vi.fn>> | null = null;

  // Regular function (NOT arrow) so `new MockMetronomeEngine()` is valid
  function MockMetronomeEngine(this: unknown): Record<string, ReturnType<typeof vi.fn>> {
    const inst: Record<string, ReturnType<typeof vi.fn>> = {
      getState: vi.fn(() => INACTIVE),
      subscribe: vi.fn((h: (s: StateVal) => void) => {
        _handler = h;
        h(INACTIVE);
        return () => { _handler = null; };
      }),
      dispose: vi.fn(),
    };
    _instance = inst;
    // Returning a non-primitive from a constructor makes `new` return it instead of `this`
    return inst;
  }

  return {
    MockMetronomeEngine,
    INACTIVE,
    getHandler: () => _handler,
    getInstance: () => _instance,
    resetRefs: () => { _handler = null; _instance = null; },
  };
});

vi.mock('./MetronomeEngine', () => ({
  MetronomeEngine: mockEngineState.MockMetronomeEngine,
}));

import { useMetronome } from './useMetronome';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useMetronome (T004)', () => {
  beforeEach(() => {
    mockEngineState.resetRefs();
  });

  it('returns inactive state on mount', () => {
    const { result } = renderHook(() => useMetronome());
    expect(result.current.state.active).toBe(false);
    expect(result.current.state.beatIndex).toBe(-1);
    expect(result.current.state.bpm).toBe(0);
  });

  it('exposes the engine instance after mount', () => {
    const { result } = renderHook(() => useMetronome());
    expect(result.current.engine).not.toBeNull();
    expect(result.current.engine).toBe(mockEngineState.getInstance());
  });

  it('subscribes to engine state on mount', () => {
    renderHook(() => useMetronome());
    expect(mockEngineState.getInstance()?.subscribe).toHaveBeenCalledOnce();
  });

  it('state updates when engine fires a new MetronomeState', () => {
    const { result } = renderHook(() => useMetronome());

    act(() => {
      mockEngineState.getHandler()?.({ active: true, beatIndex: 0, isDownbeat: true, bpm: 120 });
    });

    expect(result.current.state.active).toBe(true);
    expect(result.current.state.bpm).toBe(120);
    expect(result.current.state.isDownbeat).toBe(true);
  });

  it('state returns to inactive when engine fires inactive state', () => {
    const { result } = renderHook(() => useMetronome());

    act(() => {
      mockEngineState.getHandler()?.({ active: true, beatIndex: 0, isDownbeat: true, bpm: 120 });
    });
    act(() => {
      mockEngineState.getHandler()?.(mockEngineState.INACTIVE);
    });

    expect(result.current.state.active).toBe(false);
  });

  it('disposes engine on unmount', () => {
    const { unmount } = renderHook(() => useMetronome());
    unmount();
    expect(mockEngineState.getInstance()?.dispose).toHaveBeenCalledOnce();
  });

  it('engine reference is stable across re-renders', () => {
    const { result, rerender } = renderHook(() => useMetronome());
    const engineBefore = result.current.engine;
    act(() => { rerender(); });
    expect(result.current.engine).toBe(engineBefore);
  });
});
