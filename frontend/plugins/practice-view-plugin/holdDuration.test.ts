/**
 * holdDuration helpers — contract tests (feature 098).
 *
 * Covers the full contract table in specs/098-fix-chord-hold-validation/
 * contracts/hold-validation.md.
 */
import { describe, it, expect } from 'vitest';
import {
  HOLD_FLOOR_MS,
  computeRequiredHoldMs,
  computeHoldAcceptanceMs,
  isHoldAccepted,
} from './holdDuration';

describe('computeRequiredHoldMs', () => {
  it('returns 24 000 ms for a whole note (3 840 ticks) at 10 BPM', () => {
    expect(computeRequiredHoldMs(3_840, 10)).toBe(24_000);
  });

  it('returns 500 ms for a quarter note (960 ticks) at 120 BPM', () => {
    expect(computeRequiredHoldMs(960, 120)).toBe(500);
  });

  it('returns 0 when bpm <= 0 (division-by-zero guard)', () => {
    expect(computeRequiredHoldMs(3_840, 0)).toBe(0);
    expect(computeRequiredHoldMs(3_840, -1)).toBe(0);
  });

  it('equals one full 4/4 measure at 40/60/120 BPM (US2 rule)', () => {
    // A 4/4 measure is a whole note: 3 840 ticks.
    expect(computeRequiredHoldMs(3_840, 40)).toBe(6_000);
    expect(computeRequiredHoldMs(3_840, 60)).toBe(4_000);
    expect(computeRequiredHoldMs(3_840, 120)).toBe(2_000);
  });
});

describe('computeHoldAcceptanceMs', () => {
  it('uses the 10% window for notes <= 5 000 ms required', () => {
    expect(computeHoldAcceptanceMs(2_000)).toBe(1_800);
    expect(computeHoldAcceptanceMs(1_000)).toBe(900);
  });

  it('caps the early-acceptance window at 500 ms for longer holds', () => {
    expect(computeHoldAcceptanceMs(24_000)).toBe(23_500);
  });

  it('returns 0 when requiredHoldMs <= 0', () => {
    expect(computeHoldAcceptanceMs(0)).toBe(0);
    expect(computeHoldAcceptanceMs(-1)).toBe(0);
  });
});

describe('isHoldAccepted', () => {
  it('rejects a hold below the acceptance threshold', () => {
    expect(isHoldAccepted(2_000, 1_799)).toBe(false);
  });

  it('accepts a hold at exactly the acceptance threshold (boundary)', () => {
    expect(isHoldAccepted(2_000, 1_800)).toBe(true);
  });

  it('accepts full and over-held durations', () => {
    expect(isHoldAccepted(2_000, 2_000)).toBe(true);
    expect(isHoldAccepted(2_000, 4_000)).toBe(true);
  });

  it('never accepts when no hold is required (requiredHoldMs = 0)', () => {
    expect(isHoldAccepted(0, 100_000)).toBe(false);
  });
});

describe('HOLD_FLOOR_MS', () => {
  it('is the 500 ms floor below which no hold is required', () => {
    expect(HOLD_FLOOR_MS).toBe(500);
  });
});