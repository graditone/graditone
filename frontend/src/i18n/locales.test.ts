/**
 * locales.test.ts — Key parity tests for the host app locale catalogs.
 * Feature 075: Complete i18n for Internal Core Plugins
 *
 * Asserts that en.json and es.json always contain exactly the same set of
 * translation keys, preventing silent fallback due to missing translations.
 */

import { describe, it, expect } from 'vitest';
import enCatalog from './locales/en.json';
import esCatalog from './locales/es.json';

describe('locale catalog key parity', () => {
  const enKeys = Object.keys(enCatalog).sort();
  const esKeys = Object.keys(esCatalog).sort();

  it('English and Spanish catalogs have the same number of keys', () => {
    expect(esKeys.length).toBe(enKeys.length);
  });

  it('Spanish catalog contains every key in the English catalog', () => {
    const missingInEs = enKeys.filter((k) => !esKeys.includes(k));
    expect(missingInEs).toEqual([]);
  });

  it('English catalog contains every key in the Spanish catalog (no orphan ES keys)', () => {
    const missingInEn = esKeys.filter((k) => !enKeys.includes(k));
    expect(missingInEn).toEqual([]);
  });

  it('no translation value is an empty string', () => {
    const emptyEn = enKeys.filter((k) => (enCatalog as Record<string, string>)[k] === '');
    const emptyEs = esKeys.filter((k) => (esCatalog as Record<string, string>)[k] === '');
    expect(emptyEn).toEqual([]);
    expect(emptyEs).toEqual([]);
  });
});
