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

// ─── T021-US3: genuine early releases carry the 0.5× score penalty ────────────

describe('computePracticeScore — early-release penalty (feature 098)', () => {
  it('counts early-release outcomes separately and applies 0.5× credit', () => {
    const notes = [
      { outcome: 'correct', wrongAttempts: 0 },
      { outcome: 'early-release', wrongAttempts: 0 },
    ];
    const result = computePracticeScore(notes, 1.0);
    expect(result?.earlyReleaseCount).toBe(1);
    expect(result?.correctCount).toBe(1);
    // rawScore = ((1 + 1*0.5) / 2) * 100 = 75
    expect(result?.score).toBe(75);
  });

  it('scores lower than the equivalent fully-correct session', () => {
    const earlyReleaseSession = computePracticeScore([
      { outcome: 'correct', wrongAttempts: 0 },
      { outcome: 'early-release', wrongAttempts: 0 },
    ], 1.0)!.score;
    const fullyCorrect = computePracticeScore([
      { outcome: 'correct', wrongAttempts: 0 },
      { outcome: 'correct', wrongAttempts: 0 },
    ], 1.0)!.score;
    expect(earlyReleaseSession).toBeLessThan(fullyCorrect);
  });
});

// ─── Feature 101: strict tempo failures earn zero credit (T013) ───────────────

describe('computePracticeScore — strict tempo failures (feature 101)', () => {
  it('zero-credits a strict correct-late result and counts it in strictFailureCount', () => {
    const notes = [
      { outcome: 'correct', wrongAttempts: 0 },
      { outcome: 'correct-late', wrongAttempts: 0, strictFailure: true },
    ];
    const result = computePracticeScore(notes, 1.0);
    expect(result?.strictFailureCount).toBe(1);
    // lateCount still counts every correct-late row, strict or not
    expect(result?.lateCount).toBe(1);
    // rawScore = ((1 + 0) / 2) * 100 = 50 — a strict failure earns nothing
    expect(result?.score).toBe(50);
  });

  it('zero-credits a strict early-release result and counts it in strictFailureCount', () => {
    const notes = [
      { outcome: 'correct', wrongAttempts: 0 },
      { outcome: 'early-release', wrongAttempts: 0, strictFailure: true },
    ];
    const result = computePracticeScore(notes, 1.0);
    expect(result?.strictFailureCount).toBe(1);
    expect(result?.earlyReleaseCount).toBe(1);
    expect(result?.score).toBe(50);
  });

  it('legacy correct-late / early-release keep 0.5 credit and never count as strict failures', () => {
    const notes = [
      { outcome: 'correct-late', wrongAttempts: 0 },
      { outcome: 'early-release', wrongAttempts: 0 },
    ];
    const result = computePracticeScore(notes, 1.0);
    expect(result?.strictFailureCount).toBe(0);
    // rawScore = ((0.5 + 0.5) / 2) * 100 = 50
    expect(result?.score).toBe(50);
  });

  it('mixed strict / legacy / correct / wrong results produce the expected score', () => {
    const notes = [
      { outcome: 'correct', wrongAttempts: 0 },                          // 1.0 credit
      { outcome: 'correct-late', wrongAttempts: 0, strictFailure: true },// 0 credit
      { outcome: 'correct-late', wrongAttempts: 0 },                     // 0.5 credit
      { outcome: 'wrong', wrongAttempts: 3 },                            // 0 credit, −6 penalty
    ];
    const result = computePracticeScore(notes, 1.0);
    // rawScore = ((1 + 0 + 0.5 + 0) / 4) * 100 − 6 = 37.5 − 6 = 31.5 → 32
    expect(result?.score).toBe(32);
    expect(result?.strictFailureCount).toBe(1);
    expect(result?.lateCount).toBe(2);
    expect(result?.earlyReleaseCount).toBe(0);
    expect(result?.totalWrongAttempts).toBe(3);
  });

  it('a session with only in-time notes still scores 100 and reports 0 strict failures', () => {
    const result = computePracticeScore(allCorrect(4), 1.0);
    expect(result?.score).toBe(100);
    expect(result?.strictFailureCount).toBe(0);
  });

  it('empty input still returns null', () => {
    expect(computePracticeScore([])).toBeNull();
  });

  it('clamps at 0 when all notes are strict failures with heavy wrong-attempt penalties', () => {
    const notes = [
      { outcome: 'correct-late', wrongAttempts: 5, strictFailure: true },
      { outcome: 'early-release', wrongAttempts: 5, strictFailure: true },
    ];
    // raw = 0 − min(10*2, 30) = −30 → clamped to 0
    const result = computePracticeScore(notes, 1.0);
    expect(result?.score).toBe(0);
    expect(result?.strictFailureCount).toBe(2);
  });
});
