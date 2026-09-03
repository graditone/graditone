/**
 * holdDuration helpers — contract tests (feature 098).
 *
 * Covers the full contract table in specs/098-fix-chord-hold-validation/
 * contracts/hold-validation.md.
 */
import { describe, it, expect } from 'vitest';
import {
  HOLD_FLOOR_MS,
  EARLY_ACCEPTANCE_RATIO,
  EARLY_ACCEPTANCE_CAP_MS,
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
  it('uses the 20% early-acceptance window when the margin is below the cap', () => {
    expect(computeHoldAcceptanceMs(2_000)).toBe(1_600); // 2000 - 400 (20%)
    expect(computeHoldAcceptanceMs(1_000)).toBe(800); // 1000 - 200 (20%)
  });

  it('caps the early-acceptance window at 1500 ms for long holds', () => {
    expect(computeHoldAcceptanceMs(24_000)).toBe(22_500); // 24 000 - min(4 800, 1 500)
  });

  it('returns 0 when requiredHoldMs <= 0', () => {
    expect(computeHoldAcceptanceMs(0)).toBe(0);
    expect(computeHoldAcceptanceMs(-1)).toBe(0);
  });
});

describe('isHoldAccepted', () => {
  it('rejects a hold below the acceptance threshold', () => {
    expect(isHoldAccepted(2_000, 1_599)).toBe(false);
  });

  it('accepts a hold at exactly the acceptance threshold (boundary)', () => {
    expect(isHoldAccepted(2_000, 1_600)).toBe(true);
  });

  it('accepts full and over-held durations', () => {
    expect(isHoldAccepted(2_000, 2_000)).toBe(true);
    expect(isHoldAccepted(2_000, 4_000)).toBe(true);
  });

  it('never accepts when no hold is required (requiredHoldMs = 0)', () => {
    expect(isHoldAccepted(0, 100_000)).toBe(false);
  });

  it('whole-measure chord accepted with a 20% release margin (feature 099)', () => {
    // Clean case: 4/4 whole note at 60 BPM → required 4000 ms, margin 20% = 800 ms
    // → accepted after 3200 ms (80% of the measure).
    const required60 = computeRequiredHoldMs(3_840, 60);
    expect(required60).toBe(4_000);
    expect(computeHoldAcceptanceMs(required60)).toBe(3_200);
    expect(isHoldAccepted(required60, 3_200)).toBe(true);
    expect(isHoldAccepted(required60, 3_100)).toBe(false);

    // Realistic case at 78 BPM: required ≈ 3 077 ms, acceptance ≈ 2 461 ms.
    const required78 = computeRequiredHoldMs(3_840, 78);
    const acceptance78 = computeHoldAcceptanceMs(required78);
    expect(required78).toBeCloseTo(3_077, 0);
    expect(acceptance78).toBeGreaterThan(2_460);
    expect(acceptance78).toBeLessThan(2_463);
    expect(isHoldAccepted(required78, acceptance78)).toBe(true);
    expect(isHoldAccepted(required78, 2_400)).toBe(false);
  });
});

describe('HOLD_FLOOR_MS', () => {
  it('is the 500 ms floor below which no hold is required', () => {
    expect(HOLD_FLOOR_MS).toBe(500);
  });
});

describe('early-acceptance tuning constants (feature 099)', () => {
  it('exposes the 20% / 1500 ms margin for tunability', () => {
    expect(EARLY_ACCEPTANCE_RATIO).toBe(0.2);
    expect(EARLY_ACCEPTANCE_CAP_MS).toBe(1500);
  });
});