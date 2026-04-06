/**
 * AndroidInstallBanner i18n tests — T022, Feature 073: Landing Page i18n
 *
 * Written BEFORE migration of AndroidInstallBanner.tsx (T026).
 * Tests FAIL until useTranslation() replaces hardcoded strings.
 *
 * Mocks:
 * - navigator.userAgent → Android string (force Android detection)
 * - window.matchMedia → returns standalone: false
 * - localStorage → empty (not previously dismissed)
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AndroidInstallBanner } from '../../components/AndroidInstallBanner';
import { LocaleProvider } from '../../i18n/index';
import esCatalog from '../../i18n/locales/es.json';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAndroidEnv() {
  Object.defineProperty(navigator, 'userAgent', {
    value: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36',
    configurable: true,
  });
  vi.stubGlobal('matchMedia', (_query: string) => ({
    matches: false,
    media: _query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  localStorage.clear();
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  makeAndroidEnv();
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Tests (T022) — should FAIL before T026 migration
// ---------------------------------------------------------------------------

describe('AndroidInstallBanner i18n — Spanish locale (US3)', () => {
  it('shows Spanish banner aria-label when locale is "es"', () => {
    render(
      <LocaleProvider locale="es">
        <AndroidInstallBanner />
      </LocaleProvider>,
    );
    expect(
      screen.getByRole('banner', { name: esCatalog['android_install.banner_aria'] }),
    ).toBeInTheDocument();
  });

  it('shows Spanish title when locale is "es"', () => {
    render(
      <LocaleProvider locale="es">
        <AndroidInstallBanner />
      </LocaleProvider>,
    );
    expect(screen.getByText(esCatalog['android_install.title'])).toBeInTheDocument();
  });

  it('shows Spanish CTA link when locale is "es"', () => {
    render(
      <LocaleProvider locale="es">
        <AndroidInstallBanner />
      </LocaleProvider>,
    );
    const cta = screen.getByRole('link', { name: esCatalog['android_install.cta_aria'] });
    expect(cta).toBeInTheDocument();
    expect(cta.textContent).toBe(esCatalog['android_install.cta']);
  });

  it('shows Spanish dismiss aria-label when locale is "es"', () => {
    render(
      <LocaleProvider locale="es">
        <AndroidInstallBanner />
      </LocaleProvider>,
    );
    expect(
      screen.getByRole('button', { name: esCatalog['android_install.dismiss_aria'] }),
    ).toBeInTheDocument();
  });
});
