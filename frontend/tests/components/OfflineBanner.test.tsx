/**
 * Unit Tests: OfflineBanner - Feature 025 (User Story 4)
 * 
 * Tests that the offline banner communicates offline mode parity clearly
 * 
 * Constitution Principle V: Test-First Development
 * These tests are written BEFORE implementation and should FAIL initially.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { useOfflineDetection } from '../../src/hooks/useOfflineDetection';
import { LocaleProvider } from '../../src/i18n/index';

function renderWithLocale(ui: React.ReactElement) {
  return render(<LocaleProvider>{ui}</LocaleProvider>);
}
// Mock useOfflineDetection hook
vi.mock('../../src/hooks/useOfflineDetection');

describe('OfflineBanner - Feature 025 (User Story 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * T039: Unit test - OfflineBanner displays updated message when offline
   * 
   * EXPECTED TO FAIL initially - current message says "Changes will be saved locally"
   * Should say "all features work normally" after Feature 025 implementation.
   */
  describe('Offline message content', () => {
    it('should display updated message when offline', () => {
      // Arrange: Set offline state
      vi.mocked(useOfflineDetection).mockReturnValue(false); // false = offline

      // Act: Render banner
      renderWithLocale(<OfflineBanner />);

      // Assert: Banner visible
      const banner = screen.getByRole('alert');
      expect(banner).toBeInTheDocument();

      // Assert: Message contains updated text (Feature 025)
      // EXPECTED TO FAIL - current: "Changes will be saved locally"
      const message = screen.getByText(/you're offline/i);
      expect(message).toBeInTheDocument();
      expect(message.textContent).toContain('all features work normally');
    });

    it('should NOT mention "changes will be saved locally" (obsolete text)', () => {
      // Arrange: Set offline state
      vi.mocked(useOfflineDetection).mockReturnValue(false);

      // Act: Render banner
      renderWithLocale(<OfflineBanner />);

      // Assert: Old message should NOT appear
      // (Feature 025 removes implication that some features don't work)
      expect(screen.queryByText(/changes will be saved locally/i)).not.toBeInTheDocument();
    });

    it('should communicate positive message about offline capability', () => {
      // Arrange: Set offline state
      vi.mocked(useOfflineDetection).mockReturnValue(false);

      // Act: Render banner
      renderWithLocale(<OfflineBanner />);

      // Assert: Message should be reassuring, not limiting
      // EXPECTED TO FAIL - current message implies limitations
      const message = screen.getByRole('alert');
      expect(message.textContent).toMatch(/all features work normally/i);
    });
  });

  /**
   * T040: Unit test - OfflineBanner hidden when online
   * 
   * This should already pass - verifying existing behavior.
   */
  describe('Online/offline visibility', () => {
    it('should be hidden when online', () => {
      // Arrange: Set online state
      vi.mocked(useOfflineDetection).mockReturnValue(true); // true = online

      // Act: Render banner
      const { container } = renderWithLocale(<OfflineBanner />);

      // Assert: Banner not rendered
      expect(container.firstChild).toBeNull();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should be visible when offline', () => {
      // Arrange: Set offline state
      vi.mocked(useOfflineDetection).mockReturnValue(false); // false = offline

      // Act: Render banner
      renderWithLocale(<OfflineBanner />);

      // Assert: Banner visible with alert role
      const banner = screen.getByRole('alert');
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveAttribute('aria-live', 'polite');
    });
  });

  /**
   * T041: Unit test - OfflineBanner message contains "all features work normally"
   * 
   * Explicit test for the required text (per spec.md FR-009).
   */
  describe('Required message text', () => {
    it('should contain exact phrase "all features work normally"', () => {
      // Arrange: Set offline state
      vi.mocked(useOfflineDetection).mockReturnValue(false);

      // Act: Render banner
      renderWithLocale(<OfflineBanner />);

      // Assert: Exact phrase present
      // EXPECTED TO FAIL initially
      expect(screen.getByText(/all features work normally/i)).toBeInTheDocument();
    });

    it('should maintain offline icon (visual indicator)', () => {
      // Arrange: Set offline state
      vi.mocked(useOfflineDetection).mockReturnValue(false);

      // Act: Render banner
      renderWithLocale(<OfflineBanner />);

      // Assert: Icon still present
      const icon = screen.getByRole('alert').querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('offline-icon');
    });
  });

  /**
   * Accessibility tests
   */
  describe('Accessibility compliance', () => {
    it('should maintain ARIA attributes for screen readers', () => {
      // Arrange: Set offline state
      vi.mocked(useOfflineDetection).mockReturnValue(false);

      // Act: Render banner
      renderWithLocale(<OfflineBanner />);

      // Assert: Proper ARIA attributes
      const banner = screen.getByRole('alert');
      expect(banner).toHaveAttribute('aria-live', 'polite');
    });

    it('should have semantic class names', () => {
      // Arrange: Set offline state
      vi.mocked(useOfflineDetection).mockReturnValue(false);

      // Act: Render banner
      renderWithLocale(<OfflineBanner />);

      // Assert: Classes present
      const banner = screen.getByRole('alert');
      expect(banner).toHaveClass('offline-banner');
      
      const message = banner.querySelector('.offline-message');
      expect(message).toBeInTheDocument();
    });
  });
});
