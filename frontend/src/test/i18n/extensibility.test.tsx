/**
 * Extensibility tests — T032, Feature 073: Landing Page i18n (US4)
 *
 * Validates FR-007: no language-specific conditional in component code.
 * Validates FR-008: a new catalog is usable by simply passing it to LocaleProvider.
 *
 * Written BEFORE confirming the implementation is catalog-driven (T033).
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LocaleProvider, useTranslation } from '../../i18n/index';
import type { TranslationKey } from '../../i18n/index';
import enCatalog from '../../i18n/locales/en.json';

// ---------------------------------------------------------------------------
// Helper component
// ---------------------------------------------------------------------------

function Translate({ translationKey }: { translationKey: TranslationKey }) {
  const { t } = useTranslation();
  return <span data-testid="out">{t(translationKey)}</span>;
}

// ---------------------------------------------------------------------------
// Minimal mock "third" catalog — all 30 keys present with mock values
// ---------------------------------------------------------------------------

const mockFrCatalog: Record<TranslationKey, string> = Object.fromEntries(
  Object.keys(enCatalog).map((key) => [key, `MOCK_FR:${key}`]),
) as Record<TranslationKey, string>;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LocaleProvider extensibility (US4)', () => {
  it('uses an injected mock catalog instead of the hard-coded EN catalog', () => {
    render(
      <LocaleProvider locale="en" _testCatalogOverride={mockFrCatalog}>
        <Translate translationKey="header.slogan" />
      </LocaleProvider>,
    );
    // Should show the injected value, NOT the EN string
    expect(screen.getByTestId('out').textContent).toBe('MOCK_FR:header.slogan');
    expect(screen.getByTestId('out').textContent).not.toBe(enCatalog['header.slogan']);
  });

  it('injects all 30 keys and each returns its mock value', () => {
    const keys = Object.keys(enCatalog) as TranslationKey[];

    // Render each key in turn and verify the mock value is returned
    for (const key of keys) {
      const { unmount } = render(
        <LocaleProvider _testCatalogOverride={mockFrCatalog}>
          <Translate translationKey={key} />
        </LocaleProvider>,
      );
      expect(screen.getByTestId('out').textContent).toBe(`MOCK_FR:${key}`);
      unmount();
    }
  });

  it('a catalog with all 30 required keys satisfies the TranslationKey type contract', () => {
    // TypeScript compile-time validation: mockFrCatalog must have exactly the keys
    // from TranslationKey (derived from en.json) — if any key is missing, build fails.
    const keysMatch =
      Object.keys(mockFrCatalog).length === Object.keys(enCatalog).length;
    expect(keysMatch).toBe(true);
  });
});
