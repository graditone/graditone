/**
 * metronomeContext — Unit Tests
 * Feature 035: Metronome for Play and Practice Views
 * Task T008 (createNoOpMetronome, createMetronomeProxy, useMetronomeBridge)
 *
 * Tests are written first (TDD — Constitution Principle V).
 * Covers the T006 proxy pattern contract:
 *   - createNoOpMetronome: returns correct no-op shape
 *   - createMetronomeProxy: forwards toggle/subscribe to ref.current
 *   - useMetronomeBridge: exposes PluginMetronomeContext backed by engine + scorePlayer
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { PluginMetronomeContext, MetronomeState, ScorePlayerState } from './types';

// ─── Mock useMetronome ────────────────────────────────────────────────────────

type StateHandler = (s: MetronomeState) => void;

const INACTIVE: MetronomeState = { active: false, beatIndex: -1, isDownbeat: false, bpm: 0, subdivision: 1 };
const ACTIVE: MetronomeState = { active: true, beatIndex: 0, isDownbeat: true, bpm: 120, subdivision: 1 };

let mockEngineStateHandlers: Set<StateHandler>;
let mockEngine: {
  getState: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  updateBpm: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
};
let currentHookState: MetronomeState;

vi.mock('./metronomeContext', async (importOriginal) => {
  // Allow partial re-use but override with fresh mocks
  return importOriginal();
});

vi.mock('../services/metronome/useMetronome', () => ({
  useMetronome: vi.fn(() => {
    return { engine: mockEngine, state: currentHookState };
  }),
}));

import {
  createNoOpMetronome,
  createMetronomeProxy,
  useMetronomeBridge,
} from './metronomeContext';

// ─── Mock scorePlayer ─────────────────────────────────────────────────────────

type ScoreStateHandler = (s: ScorePlayerState) => void;

function makeMockScorePlayer(initialBpm = 120) {
  const subscribers = new Set<ScoreStateHandler>();
  let state: ScorePlayerState = {
    status: 'idle',
    currentTick: 0,
    totalDurationTicks: 0,
    highlightedNoteIds: new Set(),
    bpm: initialBpm,
    title: null,
    error: null,
    timeSignature: { numerator: 4, denominator: 4 },
  };

  return {
    getCatalogue: vi.fn(() => []),
    loadScore: vi.fn(async () => {}),
    play: vi.fn(async () => {}),
    pause: vi.fn(),
    stop: vi.fn(),
    seekToTick: vi.fn(),
    setPinnedStart: vi.fn(),
    setLoopEnd: vi.fn(),
    setTempoMultiplier: vi.fn(),
    subscribe: vi.fn((handler: ScoreStateHandler) => {
      subscribers.add(handler);
      handler(state);
      return () => subscribers.delete(handler);
    }),
    getCurrentTickLive: vi.fn(() => 0),
    extractPracticeNotes: vi.fn(() => null),
    _notify: (updates: Partial<ScorePlayerState>) => {
      state = { ...state, ...updates };
      subscribers.forEach(h => h(state));
    },
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  currentHookState = INACTIVE;
  mockEngineStateHandlers = new Set();
  mockEngine = {
    getState: vi.fn(() => currentHookState),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    updateBpm: vi.fn(),
    subscribe: vi.fn((h: StateHandler) => {
      mockEngineStateHandlers.add(h);
      h(currentHookState);
      return () => mockEngineStateHandlers.delete(h);
    }),
    dispose: vi.fn(),
  };
});

// ─── createNoOpMetronome ──────────────────────────────────────────────────────

describe('createNoOpMetronome (T008)', () => {
  it('returns an object with toggle and subscribe methods', () => {
    const noOp = createNoOpMetronome();
    expect(typeof noOp.toggle).toBe('function');
    expect(typeof noOp.subscribe).toBe('function');
  });

  it('toggle() resolves immediately (no-op)', async () => {
    const noOp = createNoOpMetronome();
    await expect(noOp.toggle()).resolves.toBeUndefined();
  });

  it('subscribe() calls handler immediately with inactive state', () => {
    const noOp = createNoOpMetronome();
    let received: MetronomeState | null = null;
    noOp.subscribe(s => { received = s; });
    expect(received).not.toBeNull();
    expect(received!.active).toBe(false);
    expect(received!.beatIndex).toBe(-1);
  });

  it('subscribe() returns an unsubscribe function', () => {
    const noOp = createNoOpMetronome();
    const unsub = noOp.subscribe(() => {});
    expect(typeof unsub).toBe('function');
    expect(() => unsub()).not.toThrow();
  });
});

// ─── createMetronomeProxy ─────────────────────────────────────────────────────

describe('createMetronomeProxy (T008)', () => {
  it('forwards toggle() to ref.current.toggle()', async () => {
    const mockApi: PluginMetronomeContext = {
      toggle: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(() => () => {}),
    };
    const proxyRef = { current: mockApi };
    const proxy = createMetronomeProxy(proxyRef);

    await proxy.toggle();
    expect(mockApi.toggle).toHaveBeenCalledOnce();
  });

  it('forwards subscribe() to ref.current.subscribe()', () => {
    const mockApi: PluginMetronomeContext = {
      toggle: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(() => () => {}),
    };
    const proxyRef = { current: mockApi };
    const proxy = createMetronomeProxy(proxyRef);

    const handler = vi.fn();
    proxy.subscribe(handler);
    expect(mockApi.subscribe).toHaveBeenCalledWith(handler);
  });

  it('uses the current ref.current at call time (indirection)', async () => {
    const mockApi1: PluginMetronomeContext = {
      toggle: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(() => () => {}),
    };
    const mockApi2: PluginMetronomeContext = {
      toggle: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(() => () => {}),
    };
    const proxyRef = { current: mockApi1 };
    const proxy = createMetronomeProxy(proxyRef);

    await proxy.toggle();
    expect(mockApi1.toggle).toHaveBeenCalledOnce();

    // Swap ref
    proxyRef.current = mockApi2;
    await proxy.toggle();
    expect(mockApi2.toggle).toHaveBeenCalledOnce();
    expect(mockApi1.toggle).toHaveBeenCalledOnce(); // not called again
  });
});

// ─── useMetronomeBridge ───────────────────────────────────────────────────────

describe('useMetronomeBridge (T008)', () => {
  it('returns an object with toggle and subscribe', () => {
    const scorePlayer = makeMockScorePlayer();
    const { result } = renderHook(() => useMetronomeBridge(scorePlayer));
    expect(typeof result.current.toggle).toBe('function');
    expect(typeof result.current.subscribe).toBe('function');
  });

  it('subscribe() immediately calls handler with current engine state', () => {
    const scorePlayer = makeMockScorePlayer();
    const { result } = renderHook(() => useMetronomeBridge(scorePlayer));
    const states: MetronomeState[] = [];
    result.current.subscribe(s => states.push(s));
    expect(states.length).toBeGreaterThan(0);
    expect(states[0].active).toBe(false);
  });

  it('toggle() calls engine.start() when inactive', async () => {
    currentHookState = INACTIVE;
    const scorePlayer = makeMockScorePlayer(120);
    const { result } = renderHook(() => useMetronomeBridge(scorePlayer));

    await act(async () => {
      await result.current.toggle();
    });

    expect(mockEngine.start).toHaveBeenCalledOnce();
  });

  it('toggle() calls engine.stop() when active', async () => {
    currentHookState = ACTIVE;
    const scorePlayer = makeMockScorePlayer(120);
    const { result } = renderHook(() => useMetronomeBridge(scorePlayer));

    await act(async () => {
      await result.current.toggle();
    });

    expect(mockEngine.stop).toHaveBeenCalledOnce();
    expect(mockEngine.start).not.toHaveBeenCalled();
  });

  it('toggle() passes scorePlayer BPM to engine.start()', async () => {
    currentHookState = INACTIVE;
    const scorePlayer = makeMockScorePlayer(90);
    const { result } = renderHook(() => useMetronomeBridge(scorePlayer));

    await act(async () => {
      await result.current.toggle();
    });

    expect(mockEngine.start).toHaveBeenCalledWith(90, 4, 4, 0, 0, 1);
  });

  it('toggle() defaults to 120 BPM when scorePlayer BPM is 0', async () => {
    currentHookState = INACTIVE;
    const scorePlayer = makeMockScorePlayer(0);
    const { result } = renderHook(() => useMetronomeBridge(scorePlayer));

    await act(async () => {
      await result.current.toggle();
    });

    const [bpm] = mockEngine.start.mock.calls[0];
    expect(bpm).toBe(120);
  });

  it('toggle() passes timeSignature to engine.start()', async () => {
    currentHookState = INACTIVE;
    const scorePlayer = makeMockScorePlayer(120);
    // Set 3/4 time signature
    scorePlayer._notify({ timeSignature: { numerator: 3, denominator: 4 } });
    const { result } = renderHook(() => useMetronomeBridge(scorePlayer));

    await act(async () => {
      await result.current.toggle();
    });

    expect(mockEngine.start).toHaveBeenCalledWith(120, 3, 4, 0, 0, 1);
  });

  it('unsubscribe returned from subscribe() removes the handler', () => {
    const scorePlayer = makeMockScorePlayer();
    const { result } = renderHook(() => useMetronomeBridge(scorePlayer));
    const received: MetronomeState[] = [];
    const unsub = result.current.subscribe(s => received.push(s));
    const countAfter = received.length;
    unsub();
    // Engine fire should NOT call removed handler
    act(() => {
      mockEngineStateHandlers.forEach(h =>
        h({ active: true, beatIndex: 0, isDownbeat: true, bpm: 120, subdivision: 1 })
      );
    });
    expect(received.length).toBe(countAfter);
  });
});
