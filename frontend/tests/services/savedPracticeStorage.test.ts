/**
 * Unit Tests: savedPracticeStorage — generatePracticeName
 * Feature 056: Save and Load Practices
 *
 * Constitution Principle V: Test-First Development
 *
 * Note: IndexedDB CRUD tests would require fake-indexeddb or similar.
 * This file covers the pure generatePracticeName function thoroughly.
 */
import { describe, it, expect } from 'vitest';
import { generatePracticeName } from '../../src/services/savedPracticeStorage';

describe('generatePracticeName', () => {
  const fixedDate = new Date(2026, 2, 25, 14, 30, 22); // 2026-03-25T14:30:22

  it('generates name for RH full score practice', () => {
    const name = generatePracticeName('Fur Elise', 0, null, fixedDate);
    expect(name).toBe('Fur_Elise-RH-all-20260325T143022');
  });

  it('generates name for LH full score practice', () => {
    const name = generatePracticeName('Arabesque', 1, null, fixedDate);
    expect(name).toBe('Arabesque-LH-all-20260325T143022');
  });

  it('generates name for BH (both hands) with region', () => {
    const name = generatePracticeName('Arabesque', -1, { startTick: 100, endTick: 500 }, fixedDate);
    expect(name).toBe('Arabesque-BH-region-20260325T143022');
  });

  it('sanitizes special characters from title', () => {
    const name = generatePracticeName("Nocturne Op.9 No.2 (Chopin's)", 0, null, fixedDate);
    expect(name).toBe('Nocturne_Op9_No2_Chopins-RH-all-20260325T143022');
  });

  it('replaces spaces with underscores', () => {
    const name = generatePracticeName('Canon In D Major', 0, null, fixedDate);
    expect(name).toBe('Canon_In_D_Major-RH-all-20260325T143022');
  });

  it('truncates long titles to 50 characters', () => {
    const longTitle = 'A'.repeat(60);
    const name = generatePracticeName(longTitle, 0, null, fixedDate);
    const titlePart = name.split('-')[0];
    expect(titlePart).toHaveLength(50);
  });

  it('handles empty title', () => {
    const name = generatePracticeName('', 0, null, fixedDate);
    expect(name).toBe('-RH-all-20260325T143022');
  });

  it('pads single-digit month/day/hour/minute/second', () => {
    const earlyDate = new Date(2026, 0, 5, 3, 7, 9); // 2026-01-05T03:07:09
    const name = generatePracticeName('Test', 0, null, earlyDate);
    expect(name).toBe('Test-RH-all-20260105T030709');
  });

  it('uses region scope when loopRegion is present', () => {
    const name = generatePracticeName('Test', 0, { startTick: 0, endTick: 100 }, fixedDate);
    expect(name).toContain('-region-');
  });

  it('uses all scope when loopRegion is null', () => {
    const name = generatePracticeName('Test', 0, null, fixedDate);
    expect(name).toContain('-all-');
  });
});
