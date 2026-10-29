/**
 * Strict Tempo Mode — pure helper tests (Feature 101, T002)
 *
 * ⚠️  PRINCIPLE V GATE: Written BEFORE strictTempo.ts exists.
 *     All tests MUST be RED (failing) until the helper is implemented.
 *
 * Covers the 40% tempo-relative window (clamped 120–300 ms), the signed
 * absolute-grid delta, grace-note anchoring, and the inclusive boundary.
 * No React, no timers, no storage — pure unit tests.
 */

import { describe, it, expect } from 'vitest';
import {
  STRICT_WINDOW_RATIO,
  STRICT_WINDOW_MIN_MS,
  STRICT_WINDOW_MAX_MS,
  STRICT_FAILURE_LIMIT,
  computeStrictWindowMs,
  evaluateStrictOnset,
} from './strictTempo';
import type { StrictAnchor } from './strictTempo';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('strict tempo constants', () => {
  it('exposes the contract constants', () => {
    expect(STRICT_WINDOW_RATIO).toBe(0.40);
    expect(STRICT_WINDOW_MIN_MS).toBe(120);
    expect(STRICT_WINDOW_MAX_MS).toBe(300);
    expect(STRICT_FAILURE_LIMIT).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// computeStrictWindowMs
// ---------------------------------------------------------------------------

describe('computeStrictWindowMs', () => {
  const cases: Array<[number, number]> = [
    [0, 120],      // zero gap → floor
    [100, 120],    // 0.4×100=40 → floor
    [300, 120],    // 0.4×300=120 → exactly floor
    [500, 200],    // 0.4×500=200 (120 BPM quarter note)
    [750, 300],    // 0.4×750=300 → exactly ceiling
    [1000, 300],   // 0.4×1000=400 → ceiling
    [2000, 300],   // 0.4×2000=800 → ceiling (slow tempo)
  ];

  it.each(cases)('gap %i ms → window %i ms', (gap, expected) => {
    expect(computeStrictWindowMs(gap)).toBe(expected);
  });

  it('uses the floor for negative gaps', () => {
    expect(computeStrictWindowMs(-500)).toBe(STRICT_WINDOW_MIN_MS);
  });

  it('uses the floor for NaN and Infinity', () => {
    expect(computeStrictWindowMs(Number.NaN)).toBe(STRICT_WINDOW_MIN_MS);
    // Non-finite also uses the floor per the contract
    expect(computeStrictWindowMs(Number.POSITIVE_INFINITY)).toBe(STRICT_WINDOW_MIN_MS);
  });

  it('rounds to an integer', () => {
    // 0.4 × 503.5 = 201.4 → 201
    expect(computeStrictWindowMs(503.5)).toBe(201);
    // 0.4 × 445 = 178 → exactly 178
    expect(computeStrictWindowMs(445)).toBe(178);
  });
});

// ---------------------------------------------------------------------------
// evaluateStrictOnset — grace anchoring
// ---------------------------------------------------------------------------

describe('evaluateStrictOnset — grace note (anchor null)', () => {
  it('establishes the anchor and returns delta 0, on beat', () => {
    const eval1 = evaluateStrictOnset({
      anchor: null,
      responseTimeMs: 1100,
      expectedTimeMs: 1000,
      expectedGapMs: 500,
    });
    expect(eval1.isGrace).toBe(true);
    expect(eval1.onBeat).toBe(true);
    expect(eval1.deltaMs).toBe(0);
    expect(eval1.anchor).toEqual({ expectedTimeMs: 1000, responseTimeMs: 1100 });
  });

  it('keeps the previous window value for a grace note', () => {
    const eval1 = evaluateStrictOnset({
      anchor: null,
      responseTimeMs: 1100,
      expectedTimeMs: 1000,
      expectedGapMs: 500,
    });
    expect(eval1.windowMs).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// evaluateStrictOnset — judged note against the absolute grid
// ---------------------------------------------------------------------------

describe('evaluateStrictOnset — judged note', () => {
  const anchor: StrictAnchor = { expectedTimeMs: 1000, responseTimeMs: 1000 };

  it('computes a positive (late) delta without updating the anchor', () => {
    const eval1 = evaluateStrictOnset({
      anchor,
      responseTimeMs: 3180,
      expectedTimeMs: 3000,
      expectedGapMs: 500,
    });
    // (3180−1000) − (3000−1000) = 2080 − 2000 = 180
    expect(eval1.deltaMs).toBe(180);
    expect(eval1.anchor).toBe(anchor); // same reference — anchor never updated
    expect(eval1.isGrace).toBe(false);
  });

  it('computes a negative (early) delta', () => {
    const eval1 = evaluateStrictOnset({
      anchor,
      responseTimeMs: 2820,
      expectedTimeMs: 3000,
      expectedGapMs: 500,
    });
    // (2820−1000) − (3000−1000) = 1820 − 2000 = −180
    expect(eval1.deltaMs).toBe(-180);
  });

  it('rounds the delta to an integer', () => {
    const eval1 = evaluateStrictOnset({
      anchor,
      responseTimeMs: 3000.4,
      expectedTimeMs: 3000,
      expectedGapMs: 500,
    });
    // (3000.4−1000) − 2000 = 0.4 → round → 0
    expect(eval1.deltaMs).toBe(0);
    const eval2 = evaluateStrictOnset({
      anchor,
      responseTimeMs: 3000.6,
      expectedTimeMs: 3000,
      expectedGapMs: 500,
    });
    expect(eval2.deltaMs).toBe(1);
  });

  it('is inclusive at the window boundary on both sides', () => {
    // gap 500 → window 200
    const atLateBoundary = evaluateStrictOnset({
      anchor,
      responseTimeMs: 3200,
      expectedTimeMs: 3000,
      expectedGapMs: 500,
    });
    expect(atLateBoundary.deltaMs).toBe(200);
    expect(atLateBoundary.onBeat).toBe(true);

    const pastLateBoundary = evaluateStrictOnset({
      anchor,
      responseTimeMs: 3201,
      expectedTimeMs: 3000,
      expectedGapMs: 500,
    });
    expect(pastLateBoundary.deltaMs).toBe(201);
    expect(pastLateBoundary.onBeat).toBe(false);

    const atEarlyBoundary = evaluateStrictOnset({
      anchor,
      responseTimeMs: 2800,
      expectedTimeMs: 3000,
      expectedGapMs: 500,
    });
    expect(atEarlyBoundary.onBeat).toBe(true);

    const pastEarlyBoundary = evaluateStrictOnset({
      anchor,
      responseTimeMs: 2799,
      expectedTimeMs: 3000,
      expectedGapMs: 500,
    });
    expect(pastEarlyBoundary.onBeat).toBe(false);
  });

  it('applies the window from the gap to the previous note, not a fixed value', () => {
    // gap 250 → window 120 (0.4×250=100 → floor); delta 150 fails even though
    // it would pass at gap 500 (window 200)
    const eval1 = evaluateStrictOnset({
      anchor,
      responseTimeMs: 3150,
      expectedTimeMs: 3000,
      expectedGapMs: 250,
    });
    expect(eval1.windowMs).toBe(120);
    expect(eval1.onBeat).toBe(false);
  });

  it('a constant interval deviation growing in absolute terms is caught by later notes', () => {
    // Player starts 250 ms after the anchor and repeats intervals 250 ms too long.
    // relativeDeltaMs stays +250 (legacy threshold 500 passes); the absolute
    // grid delta stays +250 → caught immediately (window is 200).
    const g0: StrictAnchor = { expectedTimeMs: 0, responseTimeMs: 0 };
    const eval1 = evaluateStrictOnset({ anchor: g0, responseTimeMs: 750, expectedTimeMs: 500, expectedGapMs: 500 });
    expect(eval1.deltaMs).toBe(250);
    expect(eval1.onBeat).toBe(false); // window is 200
  });

  it('a catch-up note can be on the grid even when its interval delta is large', () => {
    // Anchor at (0,0); note1 played at 1750 (delta 1250 — clearly off);
    // note2 played back on the grid at 1000 → delta 0 → on beat.
    const g0: StrictAnchor = { expectedTimeMs: 0, responseTimeMs: 0 };
    const eval1 = evaluateStrictOnset({ anchor: g0, responseTimeMs: 1000, expectedTimeMs: 1000, expectedGapMs: 500 });
    expect(eval1.deltaMs).toBe(0);
    expect(eval1.onBeat).toBe(true);
    expect(eval1.isGrace).toBe(false);
  });

  it('a grace note never produces a delta-driven failure', () => {
    // Even a huge response time after a re-anchor is not judged (delta 0)
    const eval1 = evaluateStrictOnset({
      anchor: null,
      responseTimeMs: 999_999,
      expectedTimeMs: 1000,
      expectedGapMs: 500,
    });
    expect(eval1.isGrace).toBe(true);
    expect(eval1.onBeat).toBe(true);
    expect(eval1.deltaMs).toBe(0);
  });
});
