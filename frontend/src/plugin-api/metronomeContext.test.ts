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

const INACTIVE: MetronomeState = { active: false, beatIndex: -1, isDownbeat: false, bpm: 0, subdivision: 1, subBeatIndex: 0 };
const ACTIVE: MetronomeState = { active: true, beatIndex: 0, isDownbeat: true, bpm: 120, subdivision: 1, subBeatIndex: 0 };

// ─── Mock ToneAdapter ────────────────────────────────────────────────────────
// Captures the onTransportRestart listener so loop-restart tests can fire it.

const adapterMock = vi.hoisted(() => {
  let _restartListener: (() => void) | null = null;
  const onTransportRestart = vi.fn((listener: () => void) => {
    _restartListener = listener;
    return () => { _restartListener = null; };
  });
  return {
    onTransportRestart,
    getTransportSeconds: vi.fn(() => 0),
    getRestartListener: () => _restartListener,
    resetRestartListener: () => { _restartListener = null; },
  };
});

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

vi.mock('../services/playback/ToneAdapter', () => ({
  ToneAdapter: {
    getInstance: vi.fn(() => ({
      onTransportRestart: adapterMock.onTransportRestart,
      getTransportSeconds: adapterMock.getTransportSeconds,
    })),
  },
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
    exactBpm: initialBpm,
    title: null,
    error: null,
    staffCount: 0,
    timeSignature: { numerator: 4, denominator: 4 },
    pickupTicks: 0,
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
  adapterMock.onTransportRestart.mockClear();
  adapterMock.resetRestartListener();
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
        h({ active: true, beatIndex: 0, isDownbeat: true, bpm: 120, subdivision: 1, subBeatIndex: 0 })
      );
    });
    expect(received.length).toBe(countAfter);
  });
});

// ─── useMetronomeBridge — loop restart (US2) ──────────────────────────────────

describe('useMetronomeBridge — loop restart via onTransportRestart (US2)', () => {
  it('registers onTransportRestart listener on mount', () => {
    const scorePlayer = makeMockScorePlayer(120);
    renderHook(() => useMetronomeBridge(scorePlayer));
    expect(adapterMock.onTransportRestart).toHaveBeenCalledOnce();
  });

  it('calls engine.start() when onTransportRestart fires while engine is active AND status is playing (loop wrap)', async () => {
    currentHookState = ACTIVE;
    const scorePlayer = makeMockScorePlayer(120);
    renderHook(() => useMetronomeBridge(scorePlayer));

    // Simulate loop wrap: status must be 'playing' so the listener knows it's a loop,
    // not an initial-play Transport restart (which the subscriber handles instead).
    await act(async () => {
      scorePlayer._notify({ status: 'playing', bpm: 120 });
    });

    mockEngine.start.mockClear();

    const listener = adapterMock.getRestartListener();
    expect(listener).not.toBeNull();

    await act(async () => {
      listener!();
      // flush the Promise.resolve() microtask inside the listener
      await Promise.resolve();
    });

    expect(mockEngine.start).toHaveBeenCalled();
  });

  it('does NOT call engine.start() when onTransportRestart fires while status is NOT playing (initial play)', async () => {
    // The subscriber's 'playing' transition handler takes care of initial play.
    // The onTransportRestart microtask must skip to avoid firing beat-0 at the
    // wrong phase (e.g. at tick 0 of a pickup score) before the subscriber corrects it.
    currentHookState = ACTIVE;
    const scorePlayer = makeMockScorePlayer(120);
    renderHook(() => useMetronomeBridge(scorePlayer));
    // status stays 'idle' (default)

    const listener = adapterMock.getRestartListener();
    expect(listener).not.toBeNull();

    await act(async () => {
      listener!();
      await Promise.resolve();
    });

    expect(mockEngine.start).not.toHaveBeenCalled();
  });

  it('does NOT call engine.start() when onTransportRestart fires while engine is inactive', async () => {
    currentHookState = INACTIVE;
    const scorePlayer = makeMockScorePlayer(120);
    renderHook(() => useMetronomeBridge(scorePlayer));

    const listener = adapterMock.getRestartListener();
    expect(listener).not.toBeNull();

    await act(async () => {
      listener!();
      await Promise.resolve();
    });

    expect(mockEngine.start).not.toHaveBeenCalled();
  });

  it('uses the current scorePlayer BPM when restarting after loop wrap', async () => {
    currentHookState = ACTIVE;
    const scorePlayer = makeMockScorePlayer(72);
    renderHook(() => useMetronomeBridge(scorePlayer));

    // Put into 'playing' state so the listener treats this as a loop wrap
    await act(async () => {
      scorePlayer._notify({ status: 'playing', bpm: 72 });
    });
    mockEngine.start.mockClear();

    const listener = adapterMock.getRestartListener();
    await act(async () => {
      listener!();
      await Promise.resolve();
    });

    const [bpmArg] = mockEngine.start.mock.calls[0];
    expect(bpmArg).toBe(72);
  });
});

// ─── useMetronomeBridge — fresh-start phase lock (US1 timing fix) ────────────

describe('useMetronomeBridge — fresh-start fires beat-0 click (US1)', () => {
  it('schedules first click at transportSeconds+0.001 when transport just started (tick=0)', async () => {
    // Simulate: metronome is active, playback transitions to 'playing' from tick 0
    // with transportSeconds=0 (Transport just started with +0.05 lookahead, not yet
    // past the lookahead window).  The fix should fire on beat 0 immediately rather
    // than skipping to beat 1 (one full beat interval later).
    currentHookState = ACTIVE;
    adapterMock.getTransportSeconds.mockReturnValue(0);
    const scorePlayer = makeMockScorePlayer(13);
    scorePlayer.getCurrentTickLive.mockReturnValue(0);

    const { result } = renderHook(() => useMetronomeBridge(scorePlayer));

    await act(async () => {
      scorePlayer._notify({ status: 'playing', bpm: 13 });
    });

    // engine.stop() then engine.start() should have been called
    expect(mockEngine.stop).toHaveBeenCalled();
    expect(mockEngine.start).toHaveBeenCalled();

    // The 5th argument is scheduleOffsetSeconds — should be 0+0.001 = 0.001
    // (not a full beat interval ≈ 4.615 s which would miss beat 0)
    const [, , , startBeatIndex, scheduleOffsetSeconds] = mockEngine.start.mock.calls[mockEngine.start.mock.calls.length - 1];
    expect(startBeatIndex).toBe(0); // downbeat
    expect(scheduleOffsetSeconds).toBeCloseTo(0.001, 3);
  });

  it('still fires beat-0 click when subscriber fires late (transportSeconds 0.15s, still in first beat)', async () => {
    // Simulate: React subscriber fires ~150 ms after startTransport() (slow render).
    // transportSeconds=0.15 (Transport already past 50 ms lookahead), but currentTick
    // is still near 0 because we're at 13 BPM and a beat is ~4.6 s long.
    // Expected: fresh-start guard still applies because we're in the first beat,
    // so the click fires immediately (transportSeconds+0.001) rather than ~4.5 s later.
    // Without this guard, the metronome would lag the music by ~50 ms on every beat.
    currentHookState = ACTIVE;
    adapterMock.getTransportSeconds.mockReturnValue(0.15);
    const scorePlayer = makeMockScorePlayer(13);
    // 150 ms at 13 BPM = 150/1000 * 13/60 * 960 ≈ 31 ticks (well within first beat)
    scorePlayer.getCurrentTickLive.mockReturnValue(31);

    const { result } = renderHook(() => useMetronomeBridge(scorePlayer));

    await act(async () => {
      scorePlayer._notify({ status: 'playing', bpm: 13 });
    });

    expect(mockEngine.start).toHaveBeenCalled();
    const [, , , startBeatIndex, scheduleOffsetSeconds] = mockEngine.start.mock.calls[mockEngine.start.mock.calls.length - 1];
    expect(startBeatIndex).toBe(0);
    // Should be transportSeconds + 0.001 ≈ 0.151, NOT ~4.45 s (next-beat path)
    expect(scheduleOffsetSeconds).toBeCloseTo(0.151, 2);
    expect(scheduleOffsetSeconds).toBeLessThan(0.5);
  });

  it('falls back to next-beat logic when transport has been running >50 ms (mid-song toggle)', async () => {
    // Simulate enabling metronome mid-song at tick=480 (half-beat), Transport at 2.307 s
    currentHookState = INACTIVE;
    adapterMock.getTransportSeconds.mockReturnValue(2.307);
    const scorePlayer = makeMockScorePlayer(13);
    scorePlayer.getCurrentTickLive.mockReturnValue(480); // half-beat into measure

    const { result } = renderHook(() => useMetronomeBridge(scorePlayer));

    await act(async () => {
      // Manually notify 'playing' so toggle() uses phase-lock path
      scorePlayer._notify({ status: 'playing', bpm: 13 });
      // Now toggle while playing
      await result.current.toggle();
    });

    const lastCall = mockEngine.start.mock.calls[mockEngine.start.mock.calls.length - 1];
    const [, , , , scheduleOffsetSeconds] = lastCall;
    // scheduleOffsetSeconds should be transportSeconds + timeUntilNextBeat
    // transportSeconds=2.307, fractionalBeat=0.5 → timeUntilNextBeat≈2.307 s
    // → scheduleOffsetSeconds ≈ 4.614 (> 0.05, not the fresh-start path)
    expect(scheduleOffsetSeconds).toBeGreaterThan(0.05);
  });
});

// ─── useMetronomeBridge — pickup measure phase correction ────────────────────

describe('useMetronomeBridge — pickup measure beat alignment', () => {
  it('Für Elise (3/8, 2-beat pickup): beat-0 fires at tick=960 (first full-measure downbeat)', async () => {
    // Für Elise is 3/8 time with a 2-eighth-note pickup.
    // ticksPerBeat = 960 * (4/8) = 480.  Pickup = 2 × 480 = 960 ticks.
    // At tick=0 (score start), we are on beat 1 of a 3-beat measure (0-indexed),
    // NOT beat 0. Without the pickup correction, beatOrdinal=0 → startBeatIndex=0
    // (falsely fires as downbeat).  With correction, adjustedTick=-960 → ordinal=-2
    // → ((−2 % 3) + 3) % 3 = 1 → startBeatIndex=1 (correct: pickup beat).
    currentHookState = ACTIVE;
    adapterMock.getTransportSeconds.mockReturnValue(0);
    const scorePlayer = makeMockScorePlayer(120);
    scorePlayer.getCurrentTickLive.mockReturnValue(0);

    const { result } = renderHook(() => useMetronomeBridge(scorePlayer));

    await act(async () => {
      scorePlayer._notify({
        status: 'playing',
        bpm: 120,
        timeSignature: { numerator: 3, denominator: 8 },
        pickupTicks: 960, // 2 eighth-note beats
      });
    });

    expect(mockEngine.start).toHaveBeenCalled();
    const [, , , startBeatIndex] = mockEngine.start.mock.calls[mockEngine.start.mock.calls.length - 1];
    // tick=0 is beat 1 in a 3-beat cycle (pickup takes beats 1 and 2, downbeat was at -480)
    expect(startBeatIndex).toBe(1);
  });

  it('no pickup (4/4): beat-0 fires at tick=0 as before', async () => {
    currentHookState = ACTIVE;
    adapterMock.getTransportSeconds.mockReturnValue(0);
    const scorePlayer = makeMockScorePlayer(120);
    scorePlayer.getCurrentTickLive.mockReturnValue(0);

    const { result } = renderHook(() => useMetronomeBridge(scorePlayer));

    await act(async () => {
      scorePlayer._notify({
        status: 'playing',
        bpm: 120,
        timeSignature: { numerator: 4, denominator: 4 },
        pickupTicks: 0,
      });
    });

    expect(mockEngine.start).toHaveBeenCalled();
    const [, , , startBeatIndex] = mockEngine.start.mock.calls[mockEngine.start.mock.calls.length - 1];
    expect(startBeatIndex).toBe(0); // downbeat as expected
  });

  it('1-beat 3/4 pickup: beat-0 fires at tick=1920 (first real downbeat)', async () => {
    // 3/4 time, 1-beat pickup. ticksPerBeat=960. pickupTicks=960.
    // adjustedTick = 0 - 960 = -960 → ordinal = -1 → ((-1%3)+3)%3 = 2.
    currentHookState = ACTIVE;
    adapterMock.getTransportSeconds.mockReturnValue(0);
    const scorePlayer = makeMockScorePlayer(120);
    scorePlayer.getCurrentTickLive.mockReturnValue(0);

    const { result } = renderHook(() => useMetronomeBridge(scorePlayer));

    await act(async () => {
      scorePlayer._notify({
        status: 'playing',
        bpm: 120,
        timeSignature: { numerator: 3, denominator: 4 },
        pickupTicks: 960, // 1 quarter-note beat
      });
    });

    expect(mockEngine.start).toHaveBeenCalled();
    const [, , , startBeatIndex] = mockEngine.start.mock.calls[mockEngine.start.mock.calls.length - 1];
    // tick=0 is beat 2 (0-indexed) of a 3-beat measure (the last beat before the real downbeat)
    expect(startBeatIndex).toBe(2);
  });
});
