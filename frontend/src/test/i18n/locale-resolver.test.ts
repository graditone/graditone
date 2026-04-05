/**
 * Tests for resolveLocale() — Feature 073: Landing Page i18n
 *
 * Tests written first (TDD / Constitution Principle V) — verified to FAIL
 * before frontend/src/i18n/registry.ts is created.
 *
 * Covers:
 * - Spanish locale codes (es, es-MX, es-AR) → 'es'
 * - English locale codes (en, en-US) → 'en'
 * - Unsupported locales (fr, zh-Hant-TW, de) → 'en' (fallback)
 * - Empty string and undefined → 'en' (fallback)
 */

import { describe, it, expect } from 'vitest';
import { resolveLocale } from '../../i18n/registry';

describe('resolveLocale()', () => {
  describe('Spanish locales', () => {
    it('returns es for exact "es" tag', () => {
      expect(resolveLocale('es')).toBe('es');
    });
    it('returns es for "es-MX" (Mexico)', () => {
      expect(resolveLocale('es-MX')).toBe('es');
    });
    it('returns es for "es-AR" (Argentina)', () => {
      expect(resolveLocale('es-AR')).toBe('es');
    });
    it('returns es for "es-419" (Latin America)', () => {
      expect(resolveLocale('es-419')).toBe('es');
    });
  });

  describe('English locales', () => {
    it('returns en for exact "en" tag', () => {
      expect(resolveLocale('en')).toBe('en');
    });
    it('returns en for "en-US"', () => {
      expect(resolveLocale('en-US')).toBe('en');
    });
    it('returns en for "en-GB"', () => {
      expect(resolveLocale('en-GB')).toBe('en');
    });
  });

  describe('Unsupported locales fall back to English', () => {
    it('returns en for "fr" (French)', () => {
      expect(resolveLocale('fr')).toBe('en');
    });
    it('returns en for "zh-Hant-TW" (Traditional Chinese)', () => {
      expect(resolveLocale('zh-Hant-TW')).toBe('en');
    });
    it('returns en for "de" (German)', () => {
      expect(resolveLocale('de')).toBe('en');
    });
    it('returns en for "ja" (Japanese)', () => {
      expect(resolveLocale('ja')).toBe('en');
    });
  });

  describe('Edge cases', () => {
    it('returns en for empty string', () => {
      expect(resolveLocale('')).toBe('en');
    });
    it('returns en for undefined', () => {
      expect(resolveLocale(undefined)).toBe('en');
    });
    it('is case-insensitive: "ES" resolves to es', () => {
      expect(resolveLocale('ES')).toBe('es');
    });
    it('is case-insensitive: "ES-MX" resolves to es', () => {
      expect(resolveLocale('ES-MX')).toBe('es');
    });
  });
});
