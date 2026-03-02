/**
 * MetronomeEngine — Unit Tests
 * Feature 035: Metronome for Play and Practice Views
 * Tasks T002 (BPM clamping, beatIndex, start/stop lifecycle) + T018 (updateBpm)
 *
 * Constitution Principle V (Test-First): these tests were written before the
 * MetronomeEngine implementation. They model the contract of:
 *   - BPM clamping to [20, 300]
 *   - beatIndex computation (0-based, downbeat = 0)
 *   - start/stop/dispose lifecycle
 *   - updateBpm reschedule without interruption
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Hoisted mock state ───────────────────────────────────────────────────────
// vi.mock() factories are hoisted to the top of the file by Vitest's transform.
// Any variables they reference must also be hoisted via vi.hoisted() so they are
// initialised before the factory functions run.

const toneState = vi.hoisted(() => {
  let _beatCallback: (() => void) | null = null;
  let _eventIdCounter = 0;

  const scheduleRepeat = vi.fn((cb: () => void) => {
    _beatCallback = cb;
    return ++_eventIdCounter;
  });
  const transportClear = vi.fn();
  const transportStart = vi.fn();
  const toneStart = vi.fn().mockResolvedValue(undefined);
  const triggerDownbeat = vi.fn();
  const triggerUpbeat = vi.fn();
  const disposeDownbeat = vi.fn();
  const disposeUpbeat = vi.fn();

  // Constructor mocks must be created inside vi.hoisted() so they are actual
  // vi.fn() instances with [[Construct]] — arrow functions inside vi.mock()
  // factories are not constructable in all Vitest versions.
  const MembraneSynth = vi.fn(function MembraneSynth(this: unknown) {
    return {
      triggerAttackRelease: triggerDownbeat,
      toDestination: vi.fn(function(this: unknown) { return this; }),
      dispose: disposeDownbeat,
    };
  });
  const Synth = vi.fn(function Synth(this: unknown) {
    return {
      triggerAttackRelease: triggerUpbeat,
      toDestination: vi.fn(function(this: unknown) { return this; }),
      dispose: disposeUpbeat,
    };
  });

  return {
    MembraneSynth,
    Synth,
    scheduleRepeat,
    transportClear,
    transportStart,
    toneStart,
    triggerDownbeat,
    triggerUpbeat,
    disposeDownbeat,
    disposeUpbeat,
    getBeatCallback: () => _beatCallback,
    resetBeatCallback: () => { _beatCallback = null; },
  };
});

const adapterState = vi.hoisted(() => {
  let _beatCallback: (() => void) | null = null;
  let _eventIdCounter = 0;

  const init = vi.fn().mockResolvedValue(undefined);
  const scheduleRepeat = vi.fn((cb: () => void) => {
    _beatCallback = cb;
    return ++_eventIdCounter;
  });
  const clearTransportEvent = vi.fn();
  const isInitialized = vi.fn(() => true);

  return {
    init,
    scheduleRepeat,
    clearTransportEvent,
    isInitialized,
    getBeatCallback: () => _beatCallback,
    getEventId: () => _eventIdCounter,
    resetEventId: () => { _eventIdCounter = 0; },
    resetBeatCallback: () => { _beatCallback = null; },
  };
});

// ─── Mock Tone.js ─────────────────────────────────────────────────────────────

vi.mock('tone', () => ({
  MembraneSynth: toneState.MembraneSynth,
  Synth: toneState.Synth,
  Transport: {
    scheduleRepeat: toneState.scheduleRepeat,
    clear: toneState.transportClear,
    start: toneState.transportStart,
    stop: vi.fn(),
    state: 'stopped',
    bpm: { value: 120 },
  },
  start: toneState.toneStart,
  context: { resume: vi.fn().mockResolvedValue(undefined) },
  Destination: { mute: false },
  Sampler: vi.fn(),
  now: vi.fn(() => 0),
}));

// ─── Mock ToneAdapter ──────────────────────────────────────────────────────────

vi.mock('../playback/ToneAdapter', () => ({
  ToneAdapter: {
    getInstance: vi.fn(() => ({
      init: adapterState.init,
      scheduleRepeat: adapterState.scheduleRepeat,
      clearTransportEvent: adapterState.clearTransportEvent,
      isInitialized: adapterState.isInitialized,
      updateTempo: vi.fn(),
    })),
  },
}));

// ─── Local aliases for test readability ───────────────────────────────────────
// These are plain getters that delegate to hoisted state — safe to use below.

// The real beat callback is captured inside adapterState.getBeatCallback().

// ─── Import after mocks are set up ────────────────────────────────────────────

import { MetronomeEngine } from './MetronomeEngine';
import type { MetronomeState } from '../../plugin-api/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fireBeat(times = 1): void {
  for (let i = 0; i < times; i++) {
    const cb = adapterState.getBeatCallback();
    if (cb) cb();
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MetronomeEngine — BPM clamping (T002)', () => {
  it('clamps BPM below 20 to 20', async () => {
    const engine = new MetronomeEngine();
    await engine.start(5, 4, 4);
    expect(engine.getState().bpm).toBe(20);
    engine.dispose();
  });

  it('clamps BPM above 300 to 300', async () => {
    const engine = new MetronomeEngine();
    await engine.start(999, 4, 4);
    expect(engine.getState().bpm).toBe(300);
    engine.dispose();
  });

  it('passes through valid BPM values without clamping (120)', async () => {
    const engine = new MetronomeEngine();
    await engine.start(120, 4, 4);
    expect(engine.getState().bpm).toBe(120);
    engine.dispose();
  });

  it('passes through valid boundary BPM values (20 and 300)', async () => {
    const engine = new MetronomeEngine();
    await engine.start(20, 4, 4);
    expect(engine.getState().bpm).toBe(20);
    engine.dispose();

    const engine2 = new MetronomeEngine();
    await engine2.start(300, 4, 4);
    expect(engine2.getState().bpm).toBe(300);
    engine2.dispose();
  });
});

describe('MetronomeEngine — beatIndex computation (T002)', () => {
  let engine: MetronomeEngine;

  beforeEach(() => {
    engine = new MetronomeEngine();
    adapterState.resetBeatCallback();
    adapterState.resetEventId();
  });

  afterEach(() => {
    engine.dispose();
  });

  it('beatIndex starts at 0 (downbeat) immediately after start()', async () => {
    await engine.start(120, 4, 4);
    expect(engine.getState().beatIndex).toBe(0);
    expect(engine.getState().isDownbeat).toBe(true);
  });

  it('beatIndex increments to 1 after first beat fires', async () => {
    await engine.start(120, 4, 4);
    fireBeat(1);
    expect(engine.getState().beatIndex).toBe(1);
    expect(engine.getState().isDownbeat).toBe(false);
  });

  it('beatIndex wraps back to 0 (downbeat) after numerator beats in 4/4', async () => {
    await engine.start(120, 4, 4);
    fireBeat(4); // beats 0 → 1 → 2 → 3 → 0
    expect(engine.getState().beatIndex).toBe(0);
    expect(engine.getState().isDownbeat).toBe(true);
  });

  it('beatIndex wraps correctly for 3/4 time signature', async () => {
    await engine.start(120, 3, 4);
    fireBeat(3); // beats 0 → 1 → 2 → 0
    expect(engine.getState().beatIndex).toBe(0);
    expect(engine.getState().isDownbeat).toBe(true);
  });

  it('beatIndex wraps correctly for 6/8 time signature', async () => {
    await engine.start(120, 6, 8);
    fireBeat(6); // 6 beats wrap
    expect(engine.getState().beatIndex).toBe(0);
  });

  it('isDownbeat is true only on beat 0 in 4/4', async () => {
    await engine.start(120, 4, 4);
    const collected: boolean[] = [];
    fireBeat(1); collected.push(engine.getState().isDownbeat); // beat 1
    fireBeat(1); collected.push(engine.getState().isDownbeat); // beat 2
    fireBeat(1); collected.push(engine.getState().isDownbeat); // beat 3
    fireBeat(1); collected.push(engine.getState().isDownbeat); // beat 0 again
    expect(collected).toEqual([false, false, false, true]);
  });

  it('subscriber receives beatIndex updates on each beat', async () => {
    const states: MetronomeState[] = [];
    const unsubscribe = engine.subscribe(s => states.push(s));
    await engine.start(120, 4, 4);
    fireBeat(2);
    unsubscribe();
    // Active states: start notification (beatIndex=0) + beat-fired notifications.
    // _fireBeat notifies with the beat that JUST fired, then advances _beatIndex.
    // start: {beatIndex:0}, fireBeat#1: {beatIndex:0}, fireBeat#2: {beatIndex:1}
    const beatIndexes = states.filter(s => s.active).map(s => s.beatIndex);
    expect(beatIndexes).toContain(0);
    expect(beatIndexes).toContain(1);
  });
});

describe('MetronomeEngine — start/stop lifecycle (T002)', () => {
  let engine: MetronomeEngine;

  beforeEach(() => {
    engine = new MetronomeEngine();
    adapterState.resetBeatCallback();
    adapterState.resetEventId();
    adapterState.init.mockClear();
    adapterState.scheduleRepeat.mockClear();
    adapterState.clearTransportEvent.mockClear();
  });

  afterEach(() => {
    engine.dispose();
  });

  it('state is inactive before start()', () => {
    const state = engine.getState();
    expect(state.active).toBe(false);
    expect(state.beatIndex).toBe(-1);
    expect(state.bpm).toBe(0);
  });

  it('state is active after start()', async () => {
    await engine.start(120, 4, 4);
    const state = engine.getState();
    expect(state.active).toBe(true);
    expect(state.bpm).toBe(120);
  });

  it('calls ToneAdapter.init() on start()', async () => {
    await engine.start(120, 4, 4);
    expect(adapterState.init).toHaveBeenCalledOnce();
  });

  it('schedules a repeat event on start()', async () => {
    await engine.start(120, 4, 4);
    expect(adapterState.scheduleRepeat).toHaveBeenCalledOnce();
  });

  it('state is inactive after stop()', async () => {
    await engine.start(120, 4, 4);
    engine.stop();
    const state = engine.getState();
    expect(state.active).toBe(false);
    expect(state.beatIndex).toBe(-1);
    expect(state.bpm).toBe(0);
  });

  it('clears the Transport event on stop()', async () => {
    await engine.start(120, 4, 4);
    engine.stop();
    expect(adapterState.clearTransportEvent).toHaveBeenCalledOnce();
  });

  it('stop() is safe to call when not started (no-op)', () => {
    expect(() => engine.stop()).not.toThrow();
  });

  it('can be started again after stop()', async () => {
    await engine.start(120, 4, 4);
    engine.stop();
    adapterState.scheduleRepeat.mockClear();
    await engine.start(80, 3, 4);
    expect(engine.getState().active).toBe(true);
    expect(engine.getState().bpm).toBe(80);
    expect(adapterState.scheduleRepeat).toHaveBeenCalledOnce();
  });

  it('subscriber receives inactive state on stop()', async () => {
    const states: MetronomeState[] = [];
    engine.subscribe(s => states.push(s));
    await engine.start(120, 4, 4);
    engine.stop();
    const lastState = states.at(-1)!;
    expect(lastState.active).toBe(false);
    expect(lastState.beatIndex).toBe(-1);
  });

  it('dispose() clears event and marks as inactive', async () => {
    await engine.start(120, 4, 4);
    engine.dispose();
    expect(adapterState.clearTransportEvent).toHaveBeenCalledOnce();
    expect(engine.getState().active).toBe(false);
  });
});

describe('MetronomeEngine — subscribe/unsubscribe (T002)', () => {
  let engine: MetronomeEngine;

  beforeEach(() => {
    engine = new MetronomeEngine();
  });

  afterEach(() => {
    engine.dispose();
  });

  it('subscribe() fires handler immediately with current state', () => {
    let received: MetronomeState | null = null;
    engine.subscribe(s => { received = s; });
    expect(received).not.toBeNull();
    expect(received!.active).toBe(false);
  });

  it('unsubscribe() prevents further notifications', async () => {
    const calls: MetronomeState[] = [];
    const unsub = engine.subscribe(s => calls.push(s));
    const countAfterSubscribe = calls.length;
    unsub();
    await engine.start(120, 4, 4);
    // Should not receive start notification
    expect(calls.length).toBe(countAfterSubscribe);
  });

  it('multiple subscribers all receive notifications', async () => {
    const calls1: MetronomeState[] = [];
    const calls2: MetronomeState[] = [];
    engine.subscribe(s => calls1.push(s));
    engine.subscribe(s => calls2.push(s));
    await engine.start(120, 4, 4);
    expect(calls1.length).toBeGreaterThan(1);
    expect(calls2.length).toBeGreaterThan(1);
  });
});

// ─── T018: updateBpm tests ────────────────────────────────────────────────────

describe('MetronomeEngine — updateBpm (T018)', () => {
  let engine: MetronomeEngine;

  beforeEach(() => {
    engine = new MetronomeEngine();
    adapterState.resetBeatCallback();
    adapterState.resetEventId();
    adapterState.scheduleRepeat.mockClear();
    adapterState.clearTransportEvent.mockClear();
  });

  afterEach(() => {
    engine.dispose();
  });

  it('no-op when engine is not active', () => {
    engine.updateBpm(140);
    expect(adapterState.scheduleRepeat).not.toHaveBeenCalled();
  });

  it('updates the effective BPM', async () => {
    await engine.start(120, 4, 4);
    engine.updateBpm(140);
    expect(engine.getState().bpm).toBe(140);
  });

  it('clamps the new BPM to [20, 300]', async () => {
    await engine.start(120, 4, 4);
    engine.updateBpm(999);
    expect(engine.getState().bpm).toBe(300);
    engine.updateBpm(1);
    expect(engine.getState().bpm).toBe(20);
  });

  it('clears the existing event and reschedules at new interval', async () => {
    await engine.start(120, 4, 4);
    const firstEventId = adapterState.getEventId();
    adapterState.scheduleRepeat.mockClear();
    adapterState.clearTransportEvent.mockClear();

    engine.updateBpm(60);

    expect(adapterState.clearTransportEvent).toHaveBeenCalledWith(firstEventId);
    expect(adapterState.scheduleRepeat).toHaveBeenCalledOnce();
    // Interval for 60 BPM in 4/4 = 1.0 second
    const [, interval] = adapterState.scheduleRepeat.mock.calls[0];
    expect(interval).toBeCloseTo(1.0, 5);
  });

  it('schedules new interval for 120 BPM in 4/4 (0.5 s)', async () => {
    await engine.start(60, 4, 4);
    adapterState.scheduleRepeat.mockClear();
    engine.updateBpm(120);
    const [, interval] = adapterState.scheduleRepeat.mock.calls[0];
    expect(interval).toBeCloseTo(0.5, 5);
  });

  it('beatIndex remains continuous after updateBpm (does not reset)', async () => {
    await engine.start(120, 4, 4);
    fireBeat(2); // beatIndex should be 2
    const indexBeforeUpdate = engine.getState().beatIndex;
    engine.updateBpm(80);
    expect(engine.getState().beatIndex).toBe(indexBeforeUpdate);
  });

  it('no effect if new BPM equals current (same clamped value)', async () => {
    await engine.start(120, 4, 4);
    adapterState.scheduleRepeat.mockClear();
    adapterState.clearTransportEvent.mockClear();
    engine.updateBpm(120); // same value
    expect(adapterState.scheduleRepeat).not.toHaveBeenCalled();
    expect(adapterState.clearTransportEvent).not.toHaveBeenCalled();
  });

  it('notifies subscribers after updateBpm', async () => {
    const states: MetronomeState[] = [];
    engine.subscribe(s => states.push(s));
    await engine.start(120, 4, 4);
    const beforeCount = states.length;
    engine.updateBpm(80);
    expect(states.length).toBeGreaterThan(beforeCount);
    expect(states.at(-1)!.bpm).toBe(80);
  });
});

describe('MetronomeEngine — beat interval computation (T002)', () => {
  let engine: MetronomeEngine;

  beforeEach(() => {
    engine = new MetronomeEngine();
    adapterState.scheduleRepeat.mockClear();
  });

  afterEach(() => {
    engine.dispose();
  });

  it('schedules 0.5 s interval for 120 BPM in 4/4', async () => {
    await engine.start(120, 4, 4);
    const [, interval] = adapterState.scheduleRepeat.mock.calls[0];
    expect(interval).toBeCloseTo(0.5, 5);
  });

  it('schedules 1.0 s interval for 60 BPM in 4/4', async () => {
    await engine.start(60, 4, 4);
    const [, interval] = adapterState.scheduleRepeat.mock.calls[0];
    expect(interval).toBeCloseTo(1.0, 5);
  });

  it('schedules 0.25 s interval for 60 BPM in 3/8 (eighth note beat)', async () => {
    await engine.start(60, 3, 8);
    const [, interval] = adapterState.scheduleRepeat.mock.calls[0];
    // beatIntervalSeconds = (60 / 60) * (4 / 8) = 1 * 0.5 = 0.5
    expect(interval).toBeCloseTo(0.5, 5);
  });
});
