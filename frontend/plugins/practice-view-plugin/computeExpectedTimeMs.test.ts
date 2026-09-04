import { describe, it, expect } from 'vitest';
import { computeExpectedTimeMs, PracticeLoopRegion } from './usePracticeMidi';

describe('computeExpectedTimeMs (feature 100)', () => {
  const loop1920: PracticeLoopRegion = { startTick: 0, endTick: 1920 };
  const loop960: PracticeLoopRegion = { startTick: 0, endTick: 960 };

  it('bpm <= 0 returns 0 (division-by-zero guard)', () => {
    expect(computeExpectedTimeMs({ tick: 0, bpm: 0, loopRegion: loop1920, loopIteration: 1 })).toBe(0);
    expect(computeExpectedTimeMs({ tick: 960, bpm: -5, loopRegion: null, loopIteration: 0 })).toBe(0);
  });

  it('non-loop first-iteration notes use the pure musical position', () => {
    // bpm 120 → msPerTick = 1000/1920
    expect(computeExpectedTimeMs({ tick: 0, bpm: 120, loopRegion: null, loopIteration: 0 })).toBe(0);
    expect(computeExpectedTimeMs({ tick: 960, bpm: 120, loopRegion: null, loopIteration: 0 })).toBe(500);
  });

  it('iteration 1 uses the pure musical position (parity with non-loop)', () => {
    expect(computeExpectedTimeMs({ tick: 0, bpm: 120, loopRegion: loop1920, loopIteration: 0 })).toBe(0);
    expect(computeExpectedTimeMs({ tick: 960, bpm: 120, loopRegion: loop1920, loopIteration: 0 })).toBe(500);
    expect(computeExpectedTimeMs({ tick: 0, bpm: 120, loopRegion: loop1920, loopIteration: 0 })).toBe(
      computeExpectedTimeMs({ tick: 0, bpm: 120, loopRegion: null, loopIteration: 0 }),
    );
  });

  it('loop iteration k anchors at the musical loop period (regression: no completion-timestamp anchor)', () => {
    // loop period for {0, 1920} at 120 bpm = 1920 * (1000/1920) = 1000 ms
    expect(computeExpectedTimeMs({ tick: 0, bpm: 120, loopRegion: loop1920, loopIteration: 1 })).toBe(1000);
    expect(computeExpectedTimeMs({ tick: 960, bpm: 120, loopRegion: loop1920, loopIteration: 1 })).toBe(1500);
    expect(computeExpectedTimeMs({ tick: 0, bpm: 120, loopRegion: loop1920, loopIteration: 2 })).toBe(2000);
    expect(computeExpectedTimeMs({ tick: 960, bpm: 120, loopRegion: loop1920, loopIteration: 2 })).toBe(2500);
  });

  it('smaller loop region produces a proportionally smaller period offset', () => {
    // {0, 960} at 120 bpm = 500 ms period
    expect(computeExpectedTimeMs({ tick: 0, bpm: 120, loopRegion: loop960, loopIteration: 1 })).toBe(500);
    expect(computeExpectedTimeMs({ tick: 0, bpm: 120, loopRegion: loop960, loopIteration: 2 })).toBe(1000);
  });

  it('is monotonic across iterations for the same tick', () => {
    const it0 = computeExpectedTimeMs({ tick: 0, bpm: 60, loopRegion: loop1920, loopIteration: 0 });
    const it1 = computeExpectedTimeMs({ tick: 0, bpm: 60, loopRegion: loop1920, loopIteration: 1 });
    const it2 = computeExpectedTimeMs({ tick: 0, bpm: 60, loopRegion: loop1920, loopIteration: 2 });
    expect(it1).toBeGreaterThan(it0);
    expect(it2).toBeGreaterThan(it1);
    // bpm 60 → period = 1920 * (1000/(1*960)) = 2000 ms
    expect(it0).toBe(0);
    expect(it1).toBe(2000);
    expect(it2).toBe(4000);
  });

  it('non-loop with loopIteration > 0 still uses the pure musical position', () => {
    expect(computeExpectedTimeMs({ tick: 0, bpm: 120, loopRegion: null, loopIteration: 1 })).toBe(0);
    expect(computeExpectedTimeMs({ tick: 960, bpm: 120, loopRegion: null, loopIteration: 2 })).toBe(500);
  });
});