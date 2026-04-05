/**
 * OfflineBanner i18n tests — T023, Feature 073: Landing Page i18n
 *
 * Written BEFORE migration of OfflineBanner.tsx (T027).
 * Tests FAIL until useTranslation() replaces the hardcoded offline message.
 *
 * Mocks:
 * - useOfflineDetection → returns false (offline) so the banner renders
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OfflineBanner } from '../../components/OfflineBanner';
import { LocaleProvider } from '../../i18n/index';
import esCatalog from '../../i18n/locales/es.json';

// ---------------------------------------------------------------------------
// Mock useOfflineDetection so banner is always shown (isOnline = false)
// ---------------------------------------------------------------------------

vi.mock('../../hooks/useOfflineDetection', () => ({
  useOfflineDetection: vi.fn().mockReturnValue(false),
}));

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests (T023) — should FAIL before T027 migration
// ---------------------------------------------------------------------------

describe('OfflineBanner i18n — Spanish locale (US3)', () => {
  it('shows Spanish offline message when locale is "es"', () => {
    render(
      <LocaleProvider locale="es">
        <OfflineBanner />
      </LocaleProvider>,
    );
    expect(screen.getByText(esCatalog['offline.banner'])).toBeInTheDocument();
  });
});
