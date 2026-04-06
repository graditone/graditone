/**
 * IOSInstallModal i18n tests — T021, Feature 073: Landing Page i18n
 *
 * Written BEFORE migration of IOSInstallModal.tsx (T025).
 * Tests FAIL until useTranslation() replaces hardcoded strings.
 *
 * Mocks:
 * - navigator.platform → 'iPad' (force iOS detection)
 * - window.matchMedia → returns standalone: false
 * - localStorage → empty (not previously dismissed)
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IOSInstallModal } from '../../components/IOSInstallModal';
import { LocaleProvider } from '../../i18n/index';
import esCatalog from '../../i18n/locales/es.json';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeIosEnv() {
  Object.defineProperty(navigator, 'platform', { value: 'iPad', configurable: true });
  Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true });
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
  makeIosEnv();
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Tests (T021) — should FAIL before T025 migration
// ---------------------------------------------------------------------------

describe('IOSInstallModal i18n — Spanish locale (US3)', () => {
  it('shows Spanish modal title when locale is "es"', () => {
    render(
      <LocaleProvider locale="es">
        <IOSInstallModal />
      </LocaleProvider>,
    );
    expect(screen.getByText(esCatalog['ios_install.title'])).toBeInTheDocument();
  });

  it('shows Spanish step intro when locale is "es"', () => {
    render(
      <LocaleProvider locale="es">
        <IOSInstallModal />
      </LocaleProvider>,
    );
    expect(screen.getByText(esCatalog['ios_install.step_intro'])).toBeInTheDocument();
  });

  it('shows Spanish dismiss button label when locale is "es"', () => {
    render(
      <LocaleProvider locale="es">
        <IOSInstallModal />
      </LocaleProvider>,
    );
    const btn = screen.getByRole('button', { name: esCatalog['ios_install.dismiss_button_aria'] });
    expect(btn).toBeInTheDocument();
    expect(btn.textContent).toBe(esCatalog['ios_install.dismiss_button']);
  });

  it('shows Spanish share icon aria-label when locale is "es"', () => {
    render(
      <LocaleProvider locale="es">
        <IOSInstallModal />
      </LocaleProvider>,
    );
    expect(screen.getByRole('img', { name: esCatalog['ios_install.step_share_aria'] })).toBeInTheDocument();
  });
});
