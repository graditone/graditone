/**
 * computePracticeScore.test.ts — Unit tests for practice scoring.
 *
 * Score is based purely on accuracy. Tempo does not affect the max score —
 * a perfect performance always earns 100 regardless of tempo multiplier.
 */

import { describe, it, expect } from 'vitest';
import { computePracticeScore } from './computePracticeScore';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build N all-correct note results with no wrong attempts. */
function allCorrect(n: number) {
  return Array.from({ length: n }, () => ({ outcome: 'correct', wrongAttempts: 0 }));
}

/** Build N note results where all are wrong (outcome = 'wrong'). */
function allWrong(n: number) {
  return Array.from({ length: n }, () => ({ outcome: 'wrong', wrongAttempts: 1 }));
}

// ─── Backward compatibility (no tempoMultiplier arg) ─────────────────────────

describe('computePracticeScore — backward compatibility', () => {
  it('returns null for empty array (unchanged behaviour)', () => {
    expect(computePracticeScore([])).toBeNull();
  });

  it('scores 100 for perfect notes with no multiplier arg', () => {
    const result = computePracticeScore(allCorrect(10));
    expect(result?.score).toBe(100);
  });

  it('includes tempoMultiplier: 1.0 in breakdown when arg is omitted', () => {
    const result = computePracticeScore(allCorrect(5));
    expect(result?.tempoMultiplier).toBe(1.0);
  });
});

// ─── tempoMultiplier = 1.0 (full speed) ──────────────────────────────────────

describe('computePracticeScore — tempoMultiplier 1.0', () => {
  it('returns score of 100 for all-correct notes at 1.0× (SC-001)', () => {
    const result = computePracticeScore(allCorrect(10), 1.0);
    expect(result?.score).toBe(100);
  });

  it('stores tempoMultiplier 1.0 in the breakdown', () => {
    const result = computePracticeScore(allCorrect(10), 1.0);
    expect(result?.tempoMultiplier).toBe(1.0);
  });
});

// ─── tempoMultiplier = 0.5 (half speed) ──────────────────────────────────────

describe('computePracticeScore — tempoMultiplier 0.5', () => {
  it('returns score of 100 for all-correct notes at 0.5× (max score unaffected by tempo)', () => {
    const result = computePracticeScore(allCorrect(10), 0.5);
    expect(result?.score).toBe(100);
  });

  it('stores tempoMultiplier 0.5 in the breakdown', () => {
    const result = computePracticeScore(allCorrect(10), 0.5);
    expect(result?.tempoMultiplier).toBe(0.5);
  });

  it('score at 0.5× equals score at 1.0× for the same accuracy', () => {
    // 8/10 correct = 80% raw, 2 wrong attempts → rawScore = round(80 - 4) = 76
    const notes = [
      ...allCorrect(8),
      ...allWrong(2),
    ];
    const at05x = computePracticeScore(notes, 0.5);
    const at10x = computePracticeScore(notes, 1.0);
    expect(at05x?.score).toBe(at10x?.score);
    expect(at05x?.score).toBe(76);
  });
});

// ─── tempoMultiplier > 1.0 (fast play — should not inflate beyond 100) ───────

describe('computePracticeScore — tempoMultiplier > 1.0', () => {
  it('caps score at 100 even at 1.5× multiplier (SC-001, FR-002)', () => {
    const result = computePracticeScore(allCorrect(10), 1.5);
    expect(result?.score).toBe(100);
  });

  it('caps score at 100 even at 2.0× multiplier', () => {
    const result = computePracticeScore(allCorrect(10), 2.0);
    expect(result?.score).toBe(100);
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('computePracticeScore — edge cases', () => {
  it('treats tempoMultiplier = 0 as 1.0 (guard for invalid legacy data)', () => {
    const result = computePracticeScore(allCorrect(10), 0);
    expect(result?.score).toBe(100);
  });

  it('treats negative tempoMultiplier as 1.0 (guard)', () => {
    const result = computePracticeScore(allCorrect(10), -1);
    expect(result?.score).toBe(100);
  });

  it('score at 0.5× equals score at 1.0× for same accuracy (tempo does not reduce score)', () => {
    const notes = allCorrect(10);
    const at1x = computePracticeScore(notes, 1.0)!.score;
    const atHalf = computePracticeScore(notes, 0.5)!.score;
    expect(at1x).toBe(atHalf);
  });
});
