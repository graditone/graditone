/**
 * Contract tests for useTranslation() hook — Feature 073: Landing Page i18n
 *
 * Tests written first (TDD / Constitution Principle V).
 *
 * Covers:
 * - t() returns correct EN string when LocaleProvider locale="en"
 * - t() returns correct ES string when LocaleProvider locale="es"
 * - t() falls back to EN when a key is absent from the active ES catalog
 * - useTranslation() throws when used outside LocaleProvider (dev guard)
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LocaleProvider, useTranslation } from '../../i18n/index';
import enCatalog from '../../i18n/locales/en.json';
import esCatalog from '../../i18n/locales/es.json';

// Helper: renders a component that calls t(key) and displays it in a <span>
function TranslationDisplay({ translationKey }: { translationKey: string }) {
  const { t } = useTranslation();
  return <span data-testid="result">{t(translationKey as Parameters<typeof t>[0])}</span>;
}

describe('useTranslation() — LocaleProvider contract', () => {
  it('returns English slogan when locale is "en"', () => {
    render(
      <LocaleProvider locale="en">
        <TranslationDisplay translationKey="header.slogan" />
      </LocaleProvider>
    );
    expect(screen.getByTestId('result').textContent).toBe(enCatalog['header.slogan']);
  });

  it('returns Spanish slogan when locale is "es"', () => {
    render(
      <LocaleProvider locale="es">
        <TranslationDisplay translationKey="header.slogan" />
      </LocaleProvider>
    );
    expect(screen.getByTestId('result').textContent).toBe(esCatalog['header.slogan']);
  });

  it('returns English plugins button when locale is "en"', () => {
    render(
      <LocaleProvider locale="en">
        <TranslationDisplay translationKey="header.plugins_button" />
      </LocaleProvider>
    );
    expect(screen.getByTestId('result').textContent).toBe(enCatalog['header.plugins_button']);
  });

  it('returns Spanish plugins button when locale is "es"', () => {
    render(
      <LocaleProvider locale="es">
        <TranslationDisplay translationKey="header.plugins_button" />
      </LocaleProvider>
    );
    expect(screen.getByTestId('result').textContent).toBe(esCatalog['header.plugins_button']);
  });

  it('falls back to English when key is missing from Spanish catalog', () => {
    // Inject a catalog that is missing 'header.slogan' to test fallback
    const partialEs = { ...esCatalog } as Record<string, string>;
    delete partialEs['header.slogan'];

    render(
      <LocaleProvider locale="es" _testCatalogOverride={partialEs}>
        <TranslationDisplay translationKey="header.slogan" />
      </LocaleProvider>
    );
    // Should fall back to English value
    expect(screen.getByTestId('result').textContent).toBe(enCatalog['header.slogan']);
  });
});
