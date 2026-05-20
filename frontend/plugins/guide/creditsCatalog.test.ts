/**
 * creditsCatalog.test.ts — Feature 091-guide-credits-preloaded-songs
 *
 * TDD unit tests for the CREDITS_CATALOG data contract.
 * Written BEFORE implementation (Constitution Principle V).
 *
 * Run: npm run test -- src/data/creditsCatalog
 */

import { describe, it, expect } from 'vitest';
import { CREDITS_CATALOG } from './creditsCatalog';

const VALID_LICENSE_KEYS = [
  'guide.credits.license.pd',
  'guide.credits.license.ccby',
  'guide.credits.license.ccbysa',
  'guide.credits.license.ccbyncsa',
  'guide.credits.license.cczero',
  'guide.credits.license.all_rights_reserved',
] as const;

describe('CREDITS_CATALOG — contract (Feature 091)', () => {
  it('has exactly 7 entries', () => {
    expect(CREDITS_CATALOG).toHaveLength(7);
  });

  it('every entry has a non-empty id, displayName, composer, and a valid licenseKey', () => {
    for (const entry of CREDITS_CATALOG) {
      expect(entry.id).toBeTruthy();
      expect(entry.displayName).toBeTruthy();
      expect(entry.composer).toBeTruthy();
      expect(VALID_LICENSE_KEYS).toContain(entry.licenseKey);
    }
  });

  it('all id values are unique across the catalog', () => {
    const ids = CREDITS_CATALOG.map((e) => e.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('Bach entry has a MuseScore sourceUrl and licenseKey === guide.credits.license.ccby', () => {
    const bach = CREDITS_CATALOG.find((e) => e.id === 'bach-invention-1');
    expect(bach).toBeDefined();
    expect(bach!.sourceUrl).toBe('https://musescore.com/kursattaydas/scores/1478431');
    expect(bach!.licenseKey).toBe('guide.credits.license.ccby');
  });

  it('Pachelbel entry has no sourceUrl and licenseKey === guide.credits.license.pd', () => {
    const pachelbel = CREDITS_CATALOG.find((e) => e.id === 'pachelbel-canon-d');
    expect(pachelbel).toBeDefined();
    expect(pachelbel!.sourceUrl).toBeUndefined();
    expect(pachelbel!.licenseKey).toBe('guide.credits.license.pd');
  });

  it('Star Sky entry has arranger Smiley32 and licenseKey === guide.credits.license.ccbysa', () => {
    const starSky = CREDITS_CATALOG.find((e) => e.id === 'star-sky-two-steps-from-hell');
    expect(starSky).toBeDefined();
    expect(starSky!.arranger).toBe('Smiley32');
    expect(starSky!.licenseKey).toBe('guide.credits.license.ccbysa');
  });

  it('all three CC BY-NC-SA MuseScore entries have a sourceUrl starting with https://musescore.com and correct licenseKey', () => {
    const entries = [
      { id: 'beethoven-fur-elise', licenseKey: 'guide.credits.license.cczero' },
      { id: 'burgmuller-arabesque', licenseKey: 'guide.credits.license.ccbysa' },
      { id: 'burgmuller-la-candeur', licenseKey: 'guide.credits.license.cczero' },
    ];
    for (const { id, licenseKey } of entries) {
      const entry = CREDITS_CATALOG.find((e) => e.id === id);
      expect(entry, `entry ${id} should exist`).toBeDefined();
      expect(entry!.sourceUrl, `${id} should have a sourceUrl`).toBeDefined();
      expect(entry!.sourceUrl!.startsWith('https://musescore.com')).toBe(true);
      expect(entry!.licenseKey).toBe(licenseKey);
    }
  });
});
