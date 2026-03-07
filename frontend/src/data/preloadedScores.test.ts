import { describe, it, expect } from 'vitest';
import { PRELOADED_SCORES } from './preloadedScores';

describe('PRELOADED_SCORES', () => {
  it('contains exactly 6 entries', () => {
    expect(PRELOADED_SCORES).toHaveLength(6);
  });

  it('all IDs are unique', () => {
    const ids = PRELOADED_SCORES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all paths end with scores/<filename>.mxl', () => {
    for (const score of PRELOADED_SCORES) {
      // BASE_URL is '/' in tests, '/graditone/' in production — allow any prefix
      expect(score.path).toMatch(/scores\/[^/]+\.mxl$/);
    }
  });

  it('all display names are non-empty strings', () => {
    for (const score of PRELOADED_SCORES) {
      expect(typeof score.displayName).toBe('string');
      expect(score.displayName.length).toBeGreaterThan(0);
    }
  });

  it('includes expected composers', () => {
    const names = PRELOADED_SCORES.map((s) => s.displayName);
    expect(names.some((n) => n.includes('Bach'))).toBe(true);
    expect(names.some((n) => n.includes('Beethoven'))).toBe(true);
    expect(names.some((n) => n.includes('Chopin'))).toBe(true);
    expect(names.some((n) => n.includes('Pachelbel'))).toBe(true);
  });
});
