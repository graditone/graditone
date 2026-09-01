import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useMetronomeLifecycle } from './useMetronomeLifecycle';
import type { MetronomeState, PluginMetronomeContext } from '../../src/plugin-api/index';

type StateHandler = (s: MetronomeState) => void;

let state: MetronomeState;
const subs = new Set<StateHandler>();

function emit() {
  subs.forEach((h) => h(state));
}

function makeMetro() {
  const ctx = {
    toggle: vi.fn(async () => {
      if (state.active) state = { ...state, active: false, armed: false };
      else state = { ...state, active: true, armed: false };
      emit();
    }),
    arm: vi.fn(() => {
      if (!state.active) state = { ...state, armed: true };
      emit();
    }),
    disarm: vi.fn(() => {
      state = { ...state, armed: false };
      emit();
    }),
    startFromDeferred: vi.fn(async () => {
      const started = state.armed;
      if (started) state = { ...state, armed: false, active: true };
      emit();
      return started;
    }),
    setSubdivision: vi.fn(async () => {}),
    subscribe: vi.fn((h: StateHandler) => {
      subs.add(h);
      h(state);
      return () => subs.delete(h);
    }),
  } as unknown as PluginMetronomeContext;
  return ctx;
}

function makeState(active: boolean, armed: boolean): MetronomeState {
  return { active, armed, beatIndex: active ? 0 : -1, isDownbeat: active, bpm: active ? 120 : 0, subdivision: 1, subBeatIndex: 0 };
}

function setup(initial: MetronomeState) {
  state = initial;
  subs.clear();
  const ctx = makeMetro();
  const { result } = renderHook(() => useMetronomeLifecycle({ context: { metronome: ctx } }));
  return { ctx, result };
}

describe('useMetronomeLifecycle (Feature 097)', () => {
  it('subscribes once and exposes state/armed/active', () => {
    const { ctx, result } = setup(makeState(false, false));
    expect(ctx.subscribe).toHaveBeenCalledOnce();
    expect(result.current.armed).toBe(false);
    expect(result.current.active).toBe(false);
  });

  it('onToggle while idle + canArm arms the metronome (enabled=true)', () => {
    const { ctx, result } = setup(makeState(false, false));
    act(() => result.current.onToggle(true));
    expect(ctx.arm).toHaveBeenCalledOnce();
    expect(ctx.toggle).not.toHaveBeenCalled();
  });

  it('onToggle while armed disarms (no start)', () => {
    const { ctx, result } = setup(makeState(false, true));
    act(() => result.current.onToggle(true));
    expect(ctx.disarm).toHaveBeenCalledOnce();
    expect(ctx.toggle).not.toHaveBeenCalled();
  });

  it('onToggle while active calls toggle (stop) and disables', () => {
    const { ctx, result } = setup(makeState(true, false));
    act(() => result.current.onToggle(false));
    expect(ctx.toggle).toHaveBeenCalledOnce();
    expect(ctx.arm).not.toHaveBeenCalled();
  });

  it('onToggle while idle + !canArm starts immediately', () => {
    const { ctx, result } = setup(makeState(false, false));
    act(() => result.current.onToggle(false));
    expect(ctx.toggle).toHaveBeenCalledOnce();
  });

  it('onFirstNote consumes the arm via startFromDeferred', () => {
    const { ctx, result } = setup(makeState(false, true));
    act(() => { void result.current.onFirstNote(); });
    expect(ctx.startFromDeferred).toHaveBeenCalledOnce();
  });

  it('onSessionEnd stops the engine and re-arms when enabled', async () => {
    const { ctx, result } = setup(makeState(false, false));
    act(() => result.current.onToggle(true)); // arm (enabled=true)
    await act(async () => { await ctx.startFromDeferred(); });
    expect(result.current.active).toBe(true);

    act(() => { void result.current.onSessionEnd(); });
    expect(ctx.toggle).toHaveBeenCalledTimes(1); // stop the running engine
    expect(ctx.arm).toHaveBeenCalledTimes(2); // arm (onToggle) + re-arm (onSessionEnd)
  });

  it('onSessionEnd when disabled fully stops (no re-arm)', () => {
    const { ctx, result } = setup(makeState(true, false));
    // Running but never armed via lifecycle → not "enabled".
    act(() => { void result.current.onSessionEnd(); });
    expect(ctx.toggle).toHaveBeenCalledOnce();
    expect(ctx.arm).not.toHaveBeenCalled();
  });

  it('onExit stops, disarms and clears the enabled preference', async () => {
    const { ctx, result } = setup(makeState(false, false));
    act(() => result.current.onToggle(true)); // enable + arm
    await act(async () => { await ctx.startFromDeferred(); }); // active
    act(() => { void result.current.onExit(); });
    expect(ctx.toggle).toHaveBeenCalled(); // stop
    expect(ctx.disarm).toHaveBeenCalled();
    // A following session end must NOT re-arm (preference cleared).
    act(() => { void result.current.onSessionEnd(); });
    expect(ctx.arm).toHaveBeenCalledTimes(1); // only the initial arm
  });

  it('onSessionStart re-arms a running standalone metronome (stop + arm)', async () => {
    const { ctx, result } = setup(makeState(true, false));
    act(() => { void result.current.onSessionStart(); });
    expect(ctx.toggle).toHaveBeenCalledOnce(); // stop the running engine
    expect(ctx.arm).toHaveBeenCalledOnce(); // defer to first note
  });
});