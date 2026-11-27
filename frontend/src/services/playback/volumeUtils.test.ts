/**
 * Tests for volume/velocity utilities.
 * Feature: 063-midi-volume-control + audio-level fix.
 */

import { describe, it, expect } from 'vitest';
import {
  velocityToGain,
  applyCCScaling,
  percentToDb,
  dbToPercent,
  DEFAULT_VELOCITY,
} from './volumeUtils';

describe('velocityToGain', () => {
  it('is linear in velocity', () => {
    expect(velocityToGain(127)).toBeCloseTo(1, 5);
    expect(velocityToGain(DEFAULT_VELOCITY)).toBeCloseTo(80 / 127, 5);
  });

  it('clamps out-of-range velocities to [1, 127]', () => {
    expect(velocityToGain(0)).toBeCloseTo(1 / 127, 5);
    expect(velocityToGain(200)).toBeCloseTo(1, 5);
  });
});

describe('applyCCScaling', () => {
  it('scales by CC7 and CC11', () => {
    expect(applyCCScaling(1, 64, 127)).toBeCloseTo(64 / 127, 5);
    expect(applyCCScaling(1, 127, 0)).toBe(0);
  });
});

describe('percentToDb (linear-amplitude master-volume curve)', () => {
  it('maps 100% to 0 dB', () => {
    expect(percentToDb(100)).toBeCloseTo(0, 5);
  });

  it('maps 50% to ≈ −6 dB', () => {
    expect(percentToDb(50)).toBeCloseTo(-6.0206, 3);
  });

  it('maps 80% to ≈ −1.94 dB (old curve gave −12 dB)', () => {
    expect(percentToDb(80)).toBeCloseTo(-1.9382, 3);
  });

  it('maps 0% to −Infinity', () => {
    expect(percentToDb(0)).toBe(-Infinity);
    expect(percentToDb(-10)).toBe(-Infinity);
  });
});

describe('dbToPercent', () => {
  it('is the inverse of percentToDb', () => {
    for (const p of [1, 25, 50, 80, 100]) {
      expect(dbToPercent(percentToDb(p))).toBeCloseTo(p, 4);
    }
  });

  it('maps 0 dB to 100% and −Infinity to 0%', () => {
    expect(dbToPercent(0)).toBeCloseTo(100, 5);
    expect(dbToPercent(-Infinity)).toBe(0);
  });
});
