/**
 * Feature 076: Practice View Plugin — End-to-End Tests
 *
 * Covers the primary user journeys for the practice-view-plugin:
 *   SC-001: Practice launch button visible on the landing screen
 *   SC-002: Clicking Practice navigates to the plugin selection screen
 *   SC-003: Back button in the main practice view returns to landing
 *   SC-004: Practice toggle button is disabled when no MIDI device is connected
 *
 * All tests inject a no-MIDI stub via addInitScript so they are independent
 * of the host machine's physical MIDI state.
 */

import { test, expect } from '@playwright/test';
import { buildNoMidiScript } from './fixtures/webMidiMock';

const PRACTICE_LAUNCH_TESTID = 'plugin-launch-practice-view-plugin';

test.describe('Feature 076: Practice View Plugin E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Inject the no-MIDI mock before the page loads so requestMIDIAccess
    // returns an empty input map throughout the test session.
    await page.addInitScript(buildNoMidiScript());
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  // ─── SC-001 ───────────────────────────────────────────────────────────────

  test('SC-001: Practice launch button is visible on the landing screen', async ({ page }) => {
    await expect(page.getByTestId(PRACTICE_LAUNCH_TESTID)).toBeVisible();
  });

  // ─── SC-002 ───────────────────────────────────────────────────────────────

  test('SC-002: clicking Practice navigates to the practice plugin view', async ({ page }) => {
    await page.getByTestId(PRACTICE_LAUNCH_TESTID).click();

    // The selection screen renders inside the practice plugin root.
    await expect(page.getByTestId('practice-plugin-root')).toBeVisible();
  });

  // ─── SC-003 ───────────────────────────────────────────────────────────────

  test('SC-003: Back button in the Practice view returns to the landing screen', async ({ page }) => {
    await page.getByTestId(PRACTICE_LAUNCH_TESTID).click();

    // Select a catalogue score to trigger loading.
    await page.getByRole('button', { name: /Arabesque/ }).click();

    // Wait for the main practice view — toolbar becomes visible once the
    // score player reaches the 'ready' state.
    const toolbar = page.getByRole('toolbar', { name: /practice controls/i });
    await expect(toolbar).toBeVisible({ timeout: 15_000 });

    // Click the Back button in the practice toolbar (aria-label = "Back").
    await toolbar.getByRole('button', { name: 'Back' }).click();

    // Landing screen must be restored and the practice plugin root gone.
    await expect(page.getByTestId('landing-screen')).toBeVisible();
    await expect(page.getByTestId('practice-plugin-root')).not.toBeVisible();
  });

  // ─── SC-004 ───────────────────────────────────────────────────────────────

  test('SC-004: Practice toggle button is disabled when no MIDI device is connected', async ({ page }) => {
    await page.getByTestId(PRACTICE_LAUNCH_TESTID).click();
    await page.getByRole('button', { name: /Arabesque/ }).click();

    // Wait for the main practice view.
    const toolbar = page.getByRole('toolbar', { name: /practice controls/i });
    await expect(toolbar).toBeVisible({ timeout: 15_000 });

    // The practice toggle button must be visible but disabled —
    // requestMIDIAccess resolves with no inputs (midiConnected = false),
    // so the button is disabled to prevent starting a MIDI-dependent session.
    const practiceBtn = toolbar.getByRole('button', { name: 'Start practice mode' });
    await expect(practiceBtn).toBeVisible();
    await expect(practiceBtn).toBeDisabled();
  });
});
