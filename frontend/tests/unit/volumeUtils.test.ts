/**
 * Unit tests for volumeUtils — linear velocity-to-gain curve.
 *
 * Feature: 063-midi-volume-control (T010)
 */

import { describe, it, expect } from 'vitest';
import { velocityToGain, applyCCScaling, DEFAULT_VELOCITY } from '../../src/services/playback/volumeUtils';

describe('velocityToGain', () => {
  it('returns ~0.008 for velocity 1 (minimum)', () => {
    const gain = velocityToGain(1);
    expect(gain).toBeCloseTo(1 / 127, 5);
  });

  it('returns 1.0 for velocity 127 (maximum)', () => {
    expect(velocityToGain(127)).toBe(1.0);
  });

  it('returns correct value for velocity 64 (mid-range)', () => {
    expect(velocityToGain(64)).toBeCloseTo(64 / 127, 5);
  });

  it('returns correct value for default mf velocity (80)', () => {
    expect(velocityToGain(80)).toBeCloseTo(80 / 127, 5);
  });

  it('clamps velocity below 1 to 1', () => {
    expect(velocityToGain(0)).toBeCloseTo(velocityToGain(1), 5);
    expect(velocityToGain(-5)).toBeCloseTo(velocityToGain(1), 5);
  });

  it('clamps velocity above 127 to 127', () => {
    expect(velocityToGain(200)).toBe(1.0);
  });

  it('produces distinct gains for all standard dynamic levels', () => {
    const levels = [16, 33, 49, 64, 80, 96, 112, 127]; // ppp→fff
    const gains = levels.map(velocityToGain);
    for (let i = 1; i < gains.length; i++) {
      expect(gains[i]).toBeGreaterThan(gains[i - 1]);
    }
  });

  it('difference between pp (33) and ff (112) gain values is meaningful', () => {
    const ppGain = velocityToGain(33);
    const ffGain = velocityToGain(112);
    // Linear curve gives ~10.6 dB range from pp to ff — clearly audible.
    const dbDiff = 20 * Math.log10(ffGain / ppGain);
    expect(dbDiff).toBeGreaterThanOrEqual(10);
    expect(ffGain / ppGain).toBeGreaterThan(3);
  });

  it('is monotonically increasing across 1–127', () => {
    let prev = velocityToGain(1);
    for (let v = 2; v <= 127; v++) {
      const current = velocityToGain(v);
      expect(current).toBeGreaterThanOrEqual(prev);
      prev = current;
    }
  });
});

describe('applyCCScaling', () => {
  it('returns noteGain unchanged when CC7=127 and CC11=127', () => {
    const gain = velocityToGain(80);
    expect(applyCCScaling(gain)).toBe(gain);
  });

  it('returns 0 when CC7=0', () => {
    expect(applyCCScaling(0.5, 0, 127)).toBe(0);
  });

  it('returns 0 when CC11=0', () => {
    expect(applyCCScaling(0.5, 127, 0)).toBe(0);
  });

  it('halves gain when CC7=64 and CC11=127', () => {
    const gain = 0.5;
    const result = applyCCScaling(gain, 64, 127);
    expect(result).toBeCloseTo(gain * (64 / 127), 5);
  });

  it('multiplicative: CC7=64 × CC11=64 yields ~25% of original', () => {
    const gain = 1.0;
    const result = applyCCScaling(gain, 64, 64);
    expect(result).toBeCloseTo((64 / 127) * (64 / 127), 5);
  });
});

describe('DEFAULT_VELOCITY', () => {
  it('is 80 (mezzo-forte)', () => {
    expect(DEFAULT_VELOCITY).toBe(80);
  });
});
