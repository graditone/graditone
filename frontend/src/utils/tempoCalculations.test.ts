/**
 * tempoCalculations unit tests — Feature 083
 *
 * Tests:
 *   - MIN_TEMPO_MULTIPLIER is 0.1 (was 0.5)
 *   - ABSOLUTE_BPM_FLOOR is 10 BPM (new constant)
 *   - clampTempoMultiplier works with the new [0.1, 2.0] range
 *   - computeEffectiveMinMultiplier returns correct floor per score BPM
 */

import { describe, it, expect } from 'vitest';
import {
  MIN_TEMPO_MULTIPLIER,
  MAX_TEMPO_MULTIPLIER,
  ABSOLUTE_BPM_FLOOR,
  clampTempoMultiplier,
  computeEffectiveMinMultiplier,
} from './tempoCalculations';

describe('tempoCalculations — Feature 083 constants', () => {
  it('MIN_TEMPO_MULTIPLIER is 0.1 (10%)', () => {
    expect(MIN_TEMPO_MULTIPLIER).toBe(0.1);
  });

  it('MAX_TEMPO_MULTIPLIER is 2.0 (200%)', () => {
    expect(MAX_TEMPO_MULTIPLIER).toBe(2.0);
  });

  it('ABSOLUTE_BPM_FLOOR is 10 BPM', () => {
    expect(ABSOLUTE_BPM_FLOOR).toBe(10);
  });
});

describe('clampTempoMultiplier — Feature 083 range', () => {
  it('clamps values below the new minimum (0.1) to 0.1', () => {
    expect(clampTempoMultiplier(0.05)).toBe(0.1);
    expect(clampTempoMultiplier(0.0)).toBe(0.1);
  });

  it('passes through values within [0.1, 2.0]', () => {
    expect(clampTempoMultiplier(0.1)).toBe(0.1);
    expect(clampTempoMultiplier(0.3)).toBe(0.3);
    expect(clampTempoMultiplier(1.0)).toBe(1.0);
    expect(clampTempoMultiplier(2.0)).toBe(2.0);
  });

  it('clamps values above the maximum (2.0) to 2.0', () => {
    expect(clampTempoMultiplier(3.0)).toBe(2.0);
  });
});

describe('computeEffectiveMinMultiplier — Feature 083 BPM floor', () => {
  it('returns 0.1 when score bpm is fast (bpm=120, 10% → 12 BPM > floor)', () => {
    expect(computeEffectiveMinMultiplier(120)).toBeCloseTo(0.1);
  });

  it('returns 0.25 when bpm=40 (10 BPM floor: max(0.1, 10/40) = 0.25)', () => {
    expect(computeEffectiveMinMultiplier(40)).toBeCloseTo(0.25);
  });

  it('returns 0.1 at bpm=100 (10/100 = 0.1 ties with floor)', () => {
    expect(computeEffectiveMinMultiplier(100)).toBeCloseTo(0.1);
  });

  it('handles bpm=0 defensively — returns MIN_TEMPO_MULTIPLIER (0.1)', () => {
    expect(computeEffectiveMinMultiplier(0)).toBe(0.1);
  });

  it('handles negative bpm defensively — returns MIN_TEMPO_MULTIPLIER (0.1)', () => {
    expect(computeEffectiveMinMultiplier(-10)).toBe(0.1);
  });

  it('returns clamped value for very slow scores (bpm=20, 10/20=0.5)', () => {
    expect(computeEffectiveMinMultiplier(20)).toBeCloseTo(0.5);
  });
});
