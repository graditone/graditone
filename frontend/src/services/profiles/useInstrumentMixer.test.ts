/**
 * useInstrumentMixer — unit tests
 *
 * T015 [US2]: initMixer creates entries, toggleMute delegates to channel,
 *             all-muted state, resetMixer clears state, single instrument → isMultiInstrument=false
 * T021 [US3]: setVolume persists via scopedSetItem, initMixer restores from scopedGetItem,
 *             volume clamped to [0,1], single-instrument score has no volume entry
 *
 * Feature 088: Piano and Violin Playback Support
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInstrumentMixer } from './useInstrumentMixer';

// ── Mock ToneAdapter ─────────────────────────────────────────────────────────

const mockSetMuted = vi.fn();
const mockSetVolume = vi.fn();
const mockGetChannel = vi.fn();

vi.mock('../playback/ToneAdapter', () => ({
  ToneAdapter: {
    getInstance: vi.fn(() => ({
      getChannel: mockGetChannel,
    })),
  },
}));

// ── Mock profileStorage ──────────────────────────────────────────────────────

const mockScopedGetItem = vi.fn(() => null);
const mockScopedSetItem = vi.fn();

vi.mock('./profileStorage', () => ({
  scopedGetItem: (...args: unknown[]) => mockScopedGetItem(...args),
  scopedSetItem: (...args: unknown[]) => mockScopedSetItem(...args),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeChannel() {
  return { setMuted: mockSetMuted, setVolume: mockSetVolume };
}

const PIANO = { name: 'Piano', instrument_type: 'piano' };
const VIOLIN = { name: 'Violin', instrument_type: 'violin' };

// ── Tests ────────────────────────────────────────────────────────────────────

describe('[T015] useInstrumentMixer — mute/init', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetChannel.mockReturnValue(makeChannel());
  });

  it('initMixer creates entries for each instrument', () => {
    const { result } = renderHook(() => useInstrumentMixer());

    act(() => {
      result.current.initMixer([PIANO, VIOLIN], 'score-1');
    });

    expect(result.current.mixerState.entries).toHaveLength(2);
    expect(result.current.mixerState.entries[0].channel.partIndex).toBe(0);
    expect(result.current.mixerState.entries[0].channel.partName).toBe('Piano');
    expect(result.current.mixerState.entries[1].channel.partIndex).toBe(1);
    expect(result.current.mixerState.entries[1].channel.partName).toBe('Violin');
  });

  it('isMultiInstrument is true when two or more instruments', () => {
    const { result } = renderHook(() => useInstrumentMixer());

    act(() => {
      result.current.initMixer([PIANO, VIOLIN], 'score-1');
    });

    expect(result.current.mixerState.isMultiInstrument).toBe(true);
  });

  it('isMultiInstrument is false for single-instrument score', () => {
    const { result } = renderHook(() => useInstrumentMixer());

    act(() => {
      result.current.initMixer([PIANO], 'score-1');
    });

    expect(result.current.mixerState.isMultiInstrument).toBe(false);
  });

  it('toggleMute calls channel.setMuted with toggled value', () => {
    const { result } = renderHook(() => useInstrumentMixer());

    act(() => {
      result.current.initMixer([PIANO, VIOLIN], 'score-1');
    });

    act(() => {
      result.current.toggleMute(0);
    });

    expect(mockSetMuted).toHaveBeenCalledWith(true);
    expect(result.current.mixerState.entries[0].isMuted).toBe(true);
  });

  it('toggleMute twice restores unmuted state', () => {
    const { result } = renderHook(() => useInstrumentMixer());

    act(() => {
      result.current.initMixer([PIANO], 'score-1');
    });

    act(() => { result.current.toggleMute(0); });
    act(() => { result.current.toggleMute(0); });

    expect(result.current.mixerState.entries[0].isMuted).toBe(false);
    expect(mockSetMuted).toHaveBeenLastCalledWith(false);
  });

  it('toggleMute on both instruments mutes each independently', () => {
    const { result } = renderHook(() => useInstrumentMixer());

    act(() => {
      result.current.initMixer([PIANO, VIOLIN], 'score-1');
    });

    act(() => { result.current.toggleMute(0); });
    act(() => { result.current.toggleMute(1); });

    expect(result.current.mixerState.entries[0].isMuted).toBe(true);
    expect(result.current.mixerState.entries[1].isMuted).toBe(true);
  });

  it('resetMixer clears all entries and state', () => {
    const { result } = renderHook(() => useInstrumentMixer());

    act(() => {
      result.current.initMixer([PIANO, VIOLIN], 'score-1');
    });

    act(() => {
      result.current.resetMixer();
    });

    expect(result.current.mixerState.entries).toHaveLength(0);
    expect(result.current.mixerState.isMultiInstrument).toBe(false);
  });
});

describe('[T021] useInstrumentMixer — volume persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetChannel.mockReturnValue(makeChannel());
    mockScopedGetItem.mockReturnValue(null);
  });

  it('setVolume calls channel.setVolume with clamped value', () => {
    const { result } = renderHook(() => useInstrumentMixer());

    act(() => { result.current.initMixer([PIANO, VIOLIN], 'score-1'); });
    act(() => { result.current.setVolume(1, 0.3); });

    expect(mockSetVolume).toHaveBeenCalledWith(0.3);
    expect(result.current.mixerState.entries[1].volume).toBeCloseTo(0.3);
  });

  it('setVolume clamps to [0,1] — value above 1 becomes 1', () => {
    const { result } = renderHook(() => useInstrumentMixer());

    act(() => { result.current.initMixer([PIANO], 'score-1'); });
    act(() => { result.current.setVolume(0, 1.5); });

    expect(mockSetVolume).toHaveBeenCalledWith(1);
    expect(result.current.mixerState.entries[0].volume).toBe(1);
  });

  it('setVolume clamps to [0,1] — negative value becomes 0', () => {
    const { result } = renderHook(() => useInstrumentMixer());

    act(() => { result.current.initMixer([PIANO], 'score-1'); });
    act(() => { result.current.setVolume(0, -0.5); });

    expect(mockSetVolume).toHaveBeenCalledWith(0);
    expect(result.current.mixerState.entries[0].volume).toBe(0);
  });

  it('setVolume persists via scopedSetItem with correct key', () => {
    const { result } = renderHook(() => useInstrumentMixer());

    act(() => { result.current.initMixer([PIANO, VIOLIN], 'score-abc'); });
    act(() => { result.current.setVolume(1, 0.4); });

    expect(mockScopedSetItem).toHaveBeenCalledWith(
      'graditone:volume:part:score-abc::Violin',
      '0.4'
    );
  });

  it('initMixer restores persisted volume from scopedGetItem', () => {
    mockScopedGetItem.mockImplementation((key: string) => {
      if (key === 'graditone:volume:part:score-1::Violin') return '0.25';
      return null;
    });

    const { result } = renderHook(() => useInstrumentMixer());

    act(() => { result.current.initMixer([PIANO, VIOLIN], 'score-1'); });

    expect(result.current.mixerState.entries[1].volume).toBeCloseTo(0.25);
  });

  it('initMixer defaults volume to 1.0 when no persisted value', () => {
    mockScopedGetItem.mockReturnValue(null);
    const { result } = renderHook(() => useInstrumentMixer());

    act(() => { result.current.initMixer([PIANO, VIOLIN], 'score-1'); });

    expect(result.current.mixerState.entries[0].volume).toBe(1.0);
    expect(result.current.mixerState.entries[1].volume).toBe(1.0);
  });

  it('single-instrument score has no volume entries beyond index 0', () => {
    const { result } = renderHook(() => useInstrumentMixer());

    act(() => { result.current.initMixer([PIANO], 'score-1'); });

    expect(result.current.mixerState.entries).toHaveLength(1);
    expect(result.current.mixerState.entries[0].volume).toBe(1.0);
  });
});
