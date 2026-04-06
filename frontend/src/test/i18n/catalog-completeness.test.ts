/**
 * Catalog completeness tests — Feature 073: Landing Page i18n
 *
 * Tests written first (TDD / Constitution Principle V).
 *
 * Invariants:
 * - Every key present in en.json must exist in es.json with a non-empty value
 * - Both catalogs must have exactly 117 keys
 * - No extra keys in es.json that are absent from en.json
 */

import { describe, it, expect } from 'vitest';
import enCatalog from '../../i18n/locales/en.json';
import esCatalog from '../../i18n/locales/es.json';

describe('Translation catalog completeness', () => {
  const enKeys = Object.keys(enCatalog) as Array<keyof typeof enCatalog>;
  const esKeys = Object.keys(esCatalog) as Array<keyof typeof esCatalog>;

  it('English catalog has exactly 117 keys', () => {
    expect(enKeys).toHaveLength(117);
  });

  it('Spanish catalog has exactly 117 keys', () => {
    expect(esKeys).toHaveLength(117);
  });

  it('every key in en.json exists in es.json', () => {
    const esKeySet = new Set(esKeys);
    const missingInEs = enKeys.filter(k => !esKeySet.has(k as keyof typeof esCatalog));
    expect(missingInEs).toEqual([]);
  });

  it('every key in es.json exists in en.json (no extra keys)', () => {
    const enKeySet = new Set(enKeys);
    const extraInEs = esKeys.filter(k => !enKeySet.has(k as keyof typeof enCatalog));
    expect(extraInEs).toEqual([]);
  });

  it('no Spanish translation value is empty', () => {
    const emptyKeys = enKeys.filter(k => {
      const val = (esCatalog as Record<string, string>)[k];
      return !val || val.trim() === '';
    });
    expect(emptyKeys).toEqual([]);
  });

  it('no English translation value is empty', () => {
    const emptyKeys = enKeys.filter(k => {
      const val = (enCatalog as Record<string, string>)[k];
      return !val || val.trim() === '';
    });
    expect(emptyKeys).toEqual([]);
  });
});
