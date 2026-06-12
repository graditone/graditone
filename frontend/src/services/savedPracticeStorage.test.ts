/**
 * savedPracticeStorage.test.ts — Tests for savedPracticeStorage pure functions.
 * Feature 092: Free Practice Option — covers generateFreePracticeName.
 */

import { describe, it, expect } from 'vitest';
import { generatePracticeName, generateFreePracticeName } from './savedPracticeStorage';

describe('generatePracticeName', () => {
  it('formats a complete practice name correctly', () => {
    const date = new Date(2024, 0, 5, 9, 7, 3); // 2024-01-05 09:07:03
    expect(generatePracticeName('Für Elise', 0, null, date)).toBe('Fr_Elise-RH-all-20240105T090703');
  });

  it('uses LH for staffIndex 1', () => {
    const date = new Date(2024, 5, 15, 14, 30, 0);
    const name = generatePracticeName('Moonlight Sonata', 1, null, date);
    expect(name).toMatch(/^Moonlight_Sonata-LH-all-/);
  });

  it('uses BH for staffIndex -1', () => {
    const date = new Date(2024, 5, 15, 14, 30, 0);
    const name = generatePracticeName('Moonlight Sonata', -1, null, date);
    expect(name).toMatch(/^Moonlight_Sonata-BH-all-/);
  });

  it('uses region when loopRegion is set', () => {
    const date = new Date(2024, 5, 15, 14, 30, 0);
    const name = generatePracticeName('Score', 0, { startTick: 0, endTick: 100 }, date);
    expect(name).toMatch(/-region-/);
  });
});

describe('generateFreePracticeName', () => {
  it('returns FreePractice- prefix with local datetime', () => {
    const date = new Date(2024, 2, 15, 9, 5, 3); // 2024-03-15 09:05:03
    expect(generateFreePracticeName(date)).toBe('FreePractice-20240315T090503');
  });

  it('zero-pads month, day, hour, minute, second', () => {
    const date = new Date(2025, 0, 1, 1, 1, 1); // 2025-01-01 01:01:01
    expect(generateFreePracticeName(date)).toBe('FreePractice-20250101T010101');
  });

  it('handles end-of-year dates correctly', () => {
    const date = new Date(2024, 11, 31, 23, 59, 59); // 2024-12-31 23:59:59
    expect(generateFreePracticeName(date)).toBe('FreePractice-20241231T235959');
  });

  it('always starts with "FreePractice-"', () => {
    const date = new Date(2025, 5, 20, 10, 0, 0);
    expect(generateFreePracticeName(date)).toMatch(/^FreePractice-/);
  });
});
