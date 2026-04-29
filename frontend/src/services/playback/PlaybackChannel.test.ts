/**
 * Tests for PlaybackChannel — per-instrument audio graph fragment.
 * Feature 088: Piano and Violin Playback Support
 *
 * These tests use a mock Tone.js environment. Tone is aliased in vitest.config.ts
 * to a mock (or tested via duck-typing). The real audio graph is not exercised —
 * we verify the public interface contract and state management only.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Minimal Tone.js mock
// ---------------------------------------------------------------------------

const mockTriggerAttackRelease = vi.fn();
const mockReleaseAll = vi.fn();
const mockDispose = vi.fn();
const mockConnect = vi.fn().mockReturnThis();

vi.mock('tone', () => {
  const Synth = class {};

  function makePolySynth() {
    return {
      triggerAttackRelease: mockTriggerAttackRelease,
      releaseAll: mockReleaseAll,
      dispose: mockDispose,
      connect: mockConnect,
    };
  }
  const PolySynth = vi.fn().mockImplementation(makePolySynth);

  function makeVolume() {
    return {
      dispose: mockDispose,
      connect: vi.fn().mockReturnThis(),
      volume: { value: 0 },
    };
  }
  const Volume = vi.fn().mockImplementation(makeVolume);

  const Frequency = vi.fn((pitch: number) => ({
    toNote: () => `C${Math.floor(pitch / 12) - 1}`,
  }));

  function makeLimiter() {
    return {
      dispose: mockDispose,
      toDestination: vi.fn().mockReturnThis(),
      connect: mockConnect,
    };
  }
  const Limiter = vi.fn().mockImplementation(makeLimiter);

  return { PolySynth, Synth, Volume, Frequency, Limiter };
});

// ---------------------------------------------------------------------------
// Now import (after mocks are installed)
// ---------------------------------------------------------------------------

import { PlaybackChannel } from './PlaybackChannel';
import type { TimbreConfig } from './InstrumentTimbres';

const polySynthTimbre: TimbreConfig = {
  source: 'polysynth',
  oscillatorType: 'triangle',
  envelope: { attack: 0.08, decay: 0.05, sustain: 0.75, release: 0.40 },
  volumeDb: -6,
};

const makeMockLimiter = () => ({
  dispose: vi.fn(),
  connect: vi.fn().mockReturnThis(),
  toDestination: vi.fn().mockReturnThis(),
});

describe('PlaybackChannel (polysynth)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts unmuted with default volume 1.0', () => {
    const limiter = makeMockLimiter();
    const ch = new PlaybackChannel(polySynthTimbre, limiter as never);
    expect(ch.isMuted).toBe(false);
    expect(ch.volume).toBe(1.0);
  });

  it('setMuted(true) sets isMuted to true', () => {
    const limiter = makeMockLimiter();
    const ch = new PlaybackChannel(polySynthTimbre, limiter as never);
    ch.setMuted(true);
    expect(ch.isMuted).toBe(true);
  });

  it('setMuted(false) clears mute', () => {
    const limiter = makeMockLimiter();
    const ch = new PlaybackChannel(polySynthTimbre, limiter as never);
    ch.setMuted(true);
    ch.setMuted(false);
    expect(ch.isMuted).toBe(false);
  });

  it('setVolume updates volume property', () => {
    const limiter = makeMockLimiter();
    const ch = new PlaybackChannel(polySynthTimbre, limiter as never);
    ch.setVolume(0.5);
    expect(ch.volume).toBe(0.5);
  });

  it('setVolume clamps to [0, 1]', () => {
    const limiter = makeMockLimiter();
    const ch = new PlaybackChannel(polySynthTimbre, limiter as never);
    ch.setVolume(1.5);
    expect(ch.volume).toBe(1.0);
    ch.setVolume(-0.1);
    expect(ch.volume).toBe(0.0);
  });

  it('setMuted(true) after setVolume does not change volume property', () => {
    const limiter = makeMockLimiter();
    const ch = new PlaybackChannel(polySynthTimbre, limiter as never);
    ch.setVolume(0.7);
    ch.setMuted(true);
    expect(ch.volume).toBe(0.7); // volume preserved
    expect(ch.isMuted).toBe(true);
  });

  it('setVolume while muted does not unmute', () => {
    const limiter = makeMockLimiter();
    const ch = new PlaybackChannel(polySynthTimbre, limiter as never);
    ch.setMuted(true);
    ch.setVolume(0.5);
    expect(ch.isMuted).toBe(true); // still muted
    expect(ch.volume).toBe(0.5);   // volume stored
  });

  it('playNote delegates to polysynth', () => {
    const limiter = makeMockLimiter();
    const ch = new PlaybackChannel(polySynthTimbre, limiter as never);
    ch.playNote(60, 0.5, 1.0, 80);
    expect(mockTriggerAttackRelease).toHaveBeenCalledTimes(1);
  });

  it('playNote does nothing when muted', () => {
    const limiter = makeMockLimiter();
    const ch = new PlaybackChannel(polySynthTimbre, limiter as never);
    ch.setMuted(true);
    ch.playNote(60, 0.5, 1.0, 80);
    expect(mockTriggerAttackRelease).not.toHaveBeenCalled();
  });

  it('stopAll releases all polysynth notes', () => {
    const limiter = makeMockLimiter();
    const ch = new PlaybackChannel(polySynthTimbre, limiter as never);
    ch.stopAll();
    expect(mockReleaseAll).toHaveBeenCalledTimes(1);
  });

  it('dispose calls dispose on audio nodes', () => {
    const limiter = makeMockLimiter();
    const ch = new PlaybackChannel(polySynthTimbre, limiter as never);
    ch.dispose();
    // dispose() is called on the PolySynth and the Volume node
    expect(mockDispose).toHaveBeenCalled();
  });

  it('dispose is idempotent (no throw on second call)', () => {
    const limiter = makeMockLimiter();
    const ch = new PlaybackChannel(polySynthTimbre, limiter as never);
    expect(() => {
      ch.dispose();
      ch.dispose();
    }).not.toThrow();
  });
});

/**
 * T029 [FR-007]: Piano brace edge case.
 *
 * A piano score has two staves (treble + bass) but they share a single
 * instrument_type ('piano') and a single PlaybackChannel (partIndex=0).
 * A single mute/volume control must silence both staves simultaneously
 * because both staves route through the same PlaybackChannel.
 *
 * This test verifies that a single PlaybackChannel correctly handles
 * all notes routed through it regardless of their staff origin.
 */
describe('[T029] Piano brace edge case — single channel for both staves', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('one PlaybackChannel handles notes from both treble and bass staves', () => {
    // Both treble and bass notes share _partIndex=0 → same PlaybackChannel
    const limiter = makeMockLimiter();
    const ch = new PlaybackChannel(polySynthTimbre, limiter as never);

    // Treble staff note (e.g. C5 = pitch 72)
    ch.playNote(72, 0.5, 0.0, 0.8);
    // Bass staff note (e.g. C3 = pitch 48)
    ch.playNote(48, 0.5, 0.0, 0.8);

    // Both notes were scheduled through the same channel
    expect(mockTriggerAttackRelease).toHaveBeenCalledTimes(2);
  });

  it('muting the single channel silences both treble and bass staves', () => {
    const limiter = makeMockLimiter();
    const ch = new PlaybackChannel(polySynthTimbre, limiter as never);

    ch.setMuted(true);

    // Both treble and bass notes are suppressed by the single mute
    ch.playNote(72, 0.5, 0.0, 0.8); // treble
    ch.playNote(48, 0.5, 0.0, 0.8); // bass

    expect(mockTriggerAttackRelease).not.toHaveBeenCalled();
  });

  it('unmuting the channel restores playback for both staves', () => {
    const limiter = makeMockLimiter();
    const ch = new PlaybackChannel(polySynthTimbre, limiter as never);

    ch.setMuted(true);
    ch.setMuted(false);

    ch.playNote(72, 0.5, 0.0, 0.8); // treble
    ch.playNote(48, 0.5, 0.0, 0.8); // bass

    expect(mockTriggerAttackRelease).toHaveBeenCalledTimes(2);
  });
});
