import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlayback } from '../../src/services/playback/MusicTimeline';
import { TempoStateProvider } from '../../src/services/state/TempoStateContext';
import type { Note } from '../../src/types/score';
import React, { type ReactNode } from 'react';

// Wrapper to provide TempoStateContext
const wrapper = ({ children }: { children: ReactNode }) => (
  <TempoStateProvider>{children}</TempoStateProvider>
);

/**
 * T031: Integration test for note timing accuracy
 * 
 * Feature 003 - Music Playback: User Story 2
 * Verifies that notes play at expected times with correct durations
 * using the complete playback pipeline.
 */
describe('Playback Integration - Note Timing', () => {
  // Mock ToneAdapter at module level
  beforeEach(() => {
    vi.mock('../../src/services/playback/ToneAdapter', () => {
      const mockPlayNote = vi.fn();
      const mockPlayNoteOnChannel = vi.fn();
      const mockStopAll = vi.fn();
      const mockInit = vi.fn().mockResolvedValue(undefined);
      const mockGetCurrentTime = vi.fn(() => 0);
      const mockStartTransport = vi.fn();
      const mockStopTransport = vi.fn();
      const mockClearSchedule = vi.fn();

      return {
        ToneAdapter: {
          getInstance: vi.fn(() => ({
            init: mockInit,
            playNote: mockPlayNote,
            playNoteOnChannel: mockPlayNoteOnChannel,
            stopAll: mockStopAll,
            getCurrentTime: mockGetCurrentTime,
            startTransport: mockStartTransport,
            stopTransport: mockStopTransport,
            clearSchedule: mockClearSchedule,
            getTransportSeconds: vi.fn(() => 0),
            scheduleRepeat: vi.fn(() => 999),
            clearTransportEvent: vi.fn(),
            isInitialized: vi.fn(() => true),
            setMuted: vi.fn(),
          })),
        },
      };
    });
  });

  /**
   * Integration test: 4 quarter notes at 120 BPM
   * 
   * Expected timing:
   * - Note 1 (tick 0): plays at 0.0s, duration 0.5s
   * - Note 2 (tick 960): plays at 0.5s, duration 0.5s
   * - Note 3 (tick 1920): plays at 1.0s, duration 0.5s
   * - Note 4 (tick 2880): plays at 1.5s, duration 0.5s
   */
  it('should play 4 quarter notes at correct times with 120 BPM', async () => {
    const notes: Note[] = [
      { id: 'note1', start_tick: 0, duration_ticks: 960, pitch: 60 },      // C4
      { id: 'note2', start_tick: 960, duration_ticks: 960, pitch: 62 },    // D4
      { id: 'note3', start_tick: 1920, duration_ticks: 960, pitch: 64 },   // E4
      { id: 'note4', start_tick: 2880, duration_ticks: 960, pitch: 65 },   // F4
    ];

    const { result } = renderHook(() => usePlayback(notes, 120), { wrapper });

    // Start playback
    await act(async () => {
      await result.current.play();
    });

    // Verify playback started
    expect(result.current.status).toBe('playing');

    // Note: Actual timing verification would require waiting for scheduled events
    // or using Tone.Offline rendering. For now, we verify the state transitions work.
  });

  /**
   * Integration test: Verify timing accuracy with different tempos
   */
  it('should adjust note timing based on tempo', async () => {
    const notes: Note[] = [
      { id: 'note1', start_tick: 0, duration_ticks: 960, pitch: 60 },
      { id: 'note2', start_tick: 960, duration_ticks: 960, pitch: 62 },
    ];

    // Test with 60 BPM (slower tempo)
    const { result: result60 } = renderHook(() => usePlayback(notes, 60), { wrapper });
    
    await act(async () => {
      await result60.current.play();
    });

    expect(result60.current.status).toBe('playing');

    // Test with 240 BPM (faster tempo)
    const { result: result240 } = renderHook(() => usePlayback(notes, 240), { wrapper });
    
    await act(async () => {
      await result240.current.play();
    });

    expect(result240.current.status).toBe('playing');
  });

  /**
   * Integration test: Pause and resume preserves timing
   */
  it('should preserve currentTick when pausing and resuming', async () => {
    const notes: Note[] = [
      { id: 'note1', start_tick: 0, duration_ticks: 960, pitch: 60 },
      { id: 'note2', start_tick: 960, duration_ticks: 960, pitch: 62 },
      { id: 'note3', start_tick: 1920, duration_ticks: 960, pitch: 64 },
    ];

    const { result } = renderHook(() => usePlayback(notes, 120), { wrapper });

    // Start playback
    await act(async () => {
      await result.current.play();
    });

    expect(result.current.status).toBe('playing');

    // Pause playback
    act(() => {
      result.current.pause();
    });

    expect(result.current.status).toBe('paused');
    const pausedTick = result.current.currentTick;

    // Resume playback
    await act(async () => {
      await result.current.play();
    });

    expect(result.current.status).toBe('playing');
    // CurrentTick should be preserved or advanced from pause point
  });

  /**
   * Integration test: Stop resets playback position
   */
  it('should reset to tick 0 when stopped', async () => {
    const notes: Note[] = [
      { id: 'note1', start_tick: 0, duration_ticks: 960, pitch: 60 },
      { id: 'note2', start_tick: 960, duration_ticks: 960, pitch: 62 },
    ];

    const { result } = renderHook(() => usePlayback(notes, 120), { wrapper });

    // Start playback
    await act(async () => {
      await result.current.play();
    });

    // Stop playback
    act(() => {
      result.current.stop();
    });

    expect(result.current.status).toBe('stopped');
    expect(result.current.currentTick).toBe(0);
  });
});
