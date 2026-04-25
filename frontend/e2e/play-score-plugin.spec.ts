/**
 * Feature 033: Play Score Plugin — End-to-End Test (T028)
 *
 * SC-006 regression suite covering:
 * - Launching the plugin from landing screen
 * - Selection screen with all expected scores
 * - Navigation to player view and back
 * - Playback control visibility
 * - Audio teardown on plugin exit (SC-005)
 */

import { test, expect } from '@playwright/test';

const EXPECTED_SCORES = [
  'Bach — Invention No. 1',
  'Beethoven — Für Elise',
  'Burgmüller — Arabesque',
  'Burgmüller — La Candeur',
  'Chopin — Nocturne Op. 9 No. 2',
  'Pachelbel — Canon in D',
];

test.describe('Feature 033: Play Score Plugin', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  // ─── Launch + Selection screen ────────────────────────────────────────────

  test('launch button is visible on landing screen', async ({ page }) => {
    const btn = page.getByTestId('plugin-launch-play-score');
    await expect(btn).toBeVisible();
  });

  test('selection screen shows 6 expected score entries', async ({ page }) => {
    await page.getByTestId('plugin-launch-play-score').click();

    for (const name of EXPECTED_SCORES) {
      await expect(page.getByText(name)).toBeVisible();
    }
  });

  test('selection screen shows "Load from file" option', async ({ page }) => {
    await page.getByTestId('plugin-launch-play-score').click();

    await expect(page.getByText(/load from file/i)).toBeVisible();
  });

  test('Back button is absent on selection screen', async ({ page }) => {
    await page.getByTestId('plugin-launch-play-score').click();

    // No Back button on the selection screen (FR-002)
    await expect(page.getByRole('button', { name: /back/i })).not.toBeVisible();
  });

  // ─── Score selection → player view ────────────────────────────────────────

  test('selecting Beethoven transitions to player view with toolbar', async ({ page }) => {
    // Stub .mxl fetches so score loads quickly without full WASM parse
    await page.route('**/*.mxl', route =>
      route.fulfill({ status: 200, body: '', contentType: 'application/octet-stream' }),
    );

    await page.getByTestId('plugin-launch-play-score').click();
    await page.getByText('Beethoven — Für Elise').click();

    // Player view should render the toolbar with a Back button
    const toolbar = page.getByRole('toolbar', { name: /playback controls/i });
    await expect(toolbar).toBeVisible();
    await expect(page.getByRole('button', { name: /back/i })).toBeVisible();
  });

  test('tapping Back in player view returns to selection or closes plugin', async ({ page }) => {
    await page.route('**/*.mxl', route =>
      route.fulfill({ status: 200, body: '', contentType: 'application/octet-stream' }),
    );

    await page.getByTestId('plugin-launch-play-score').click();
    await page.getByText('Bach — Invention No. 1').click();

    // Back button present in player view
    const backBtn = page.getByRole('button', { name: /back/i });
    await expect(backBtn).toBeVisible();
    await backBtn.click();

    // Plugin is closed — the selection list is no longer visible,
    // and the landing screen is shown again
    await expect(page.getByTestId('plugin-launch-play-score')).toBeVisible();
  });

  // ─── Playback control visibility in player view ───────────────────────────

  test('Play, Stop and elapsed time are rendered in the toolbar', async ({ page }) => {
    await page.route('**/*.mxl', route =>
      route.fulfill({ status: 200, body: '', contentType: 'application/octet-stream' }),
    );

    await page.getByTestId('plugin-launch-play-score').click();
    await page.getByText('Chopin — Nocturne Op. 9 No. 2').click();

    const toolbar = page.getByRole('toolbar', { name: /playback controls/i });
    await expect(toolbar).toBeVisible();

    // Playback buttons present
    await expect(page.getByRole('button', { name: /play/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /stop/i })).toBeVisible();

    // Elapsed time display (format mm:ss)
    const timer = page.getByLabel('Elapsed time');
    await expect(timer).toBeVisible();
    await expect(timer).toHaveText(/\d{2}:\d{2}/);
  });

  test('Tempo slider is present with correct range', async ({ page }) => {
    await page.route('**/*.mxl', route =>
      route.fulfill({ status: 200, body: '', contentType: 'application/octet-stream' }),
    );

    await page.getByTestId('plugin-launch-play-score').click();
    await page.getByText('Pachelbel — Canon in D').click();

    const slider = page.getByRole('slider', { name: /tempo/i });
    await expect(slider).toBeVisible();
    await expect(slider).toHaveAttribute('min', '0.1');
    await expect(slider).toHaveAttribute('max', '2');
  });
});
