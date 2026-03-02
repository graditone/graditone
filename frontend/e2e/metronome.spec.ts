/**
 * Feature 035: Metronome for Play and Practice Views — E2E Tests
 * T021 — US1: Metronome button visible and togglable in Play Score toolbar
 * T022 — US2: Metronome button visible and togglable in Practice View header
 * T023 — US3: Metronome stops when plugin is closed (audio teardown)
 *
 * E2E scope: UI-level interactions only.
 * Audio synthesis is NOT verified (Tone.js context requires user gesture —
 * desktop tests mock or skip audio assertions).
 */

import { test, expect } from '@playwright/test';

// ─── Shared helpers ───────────────────────────────────────────────────────────

/**
 * Stub all .mxl fetches so scores load without full WASM parse.
 * Prevents flakiness from network timing or parse errors in CI.
 */
async function stubMxlFetch(page: import('@playwright/test').Page): Promise<void> {
  await page.route('**/*.mxl', route =>
    route.fulfill({
      status: 200,
      body: '',
      contentType: 'application/octet-stream',
    })
  );
}

// ─── T021 — Metronome in Play Score plugin toolbar ────────────────────────────

test.describe('Feature 035 / T021: Metronome in Play Score toolbar', () => {
  test.beforeEach(async ({ page }) => {
    await stubMxlFetch(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    // Navigate to Play Score plugin → Score selection
    await page.getByTestId('plugin-launch-play-score').click();
    // Select a score to enter the player view (toolbar becomes visible)
    await page.getByText('Bach — Invention No. 1').click();
  });

  test('metronome toggle button is visible in the playback toolbar', async ({ page }) => {
    const toolbar = page.getByRole('toolbar', { name: /playback controls/i });
    await expect(toolbar).toBeVisible();

    const metronomeBtn = toolbar.getByRole('button', { name: /toggle metronome/i });
    await expect(metronomeBtn).toBeVisible();
  });

  test('metronome button starts with aria-pressed="false"', async ({ page }) => {
    const toolbar = page.getByRole('toolbar', { name: /playback controls/i });
    const metronomeBtn = toolbar.getByRole('button', { name: /toggle metronome/i });

    await expect(metronomeBtn).toHaveAttribute('aria-pressed', 'false');
  });

  test('clicking metronome button sets aria-pressed="true" (starts metronome)', async ({ page }) => {
    const toolbar = page.getByRole('toolbar', { name: /playback controls/i });
    const metronomeBtn = toolbar.getByRole('button', { name: /toggle metronome/i });

    // Click to start
    await metronomeBtn.click();
    await expect(metronomeBtn).toHaveAttribute('aria-pressed', 'true');
  });

  test('clicking metronome button twice stops the metronome', async ({ page }) => {
    const toolbar = page.getByRole('toolbar', { name: /playback controls/i });
    const metronomeBtn = toolbar.getByRole('button', { name: /toggle metronome/i });

    // Start
    await metronomeBtn.click();
    await expect(metronomeBtn).toHaveAttribute('aria-pressed', 'true');

    // Stop
    await metronomeBtn.click();
    await expect(metronomeBtn).toHaveAttribute('aria-pressed', 'false');
  });
});

// ─── T022 — Metronome in Practice View header ─────────────────────────────────

test.describe('Feature 035 / T022: Metronome in Practice View header', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    // Navigate to Practice View plugin
    const practiceBtn = page.getByTestId('plugin-launch-practice-view');
    await expect(practiceBtn).toBeVisible({ timeout: 5000 });
    await practiceBtn.click();
    // Wait for practice view to render
    await expect(page.getByTestId('practice-view')).toBeVisible({ timeout: 5000 });
  });

  test('metronome toggle button is visible in the practice header', async ({ page }) => {
    const metronomeBtn = page.getByRole('button', { name: /toggle metronome/i });
    await expect(metronomeBtn).toBeVisible();
  });

  test('metronome button starts with aria-pressed="false"', async ({ page }) => {
    const metronomeBtn = page.getByRole('button', { name: /toggle metronome/i });
    await expect(metronomeBtn).toHaveAttribute('aria-pressed', 'false');
  });

  test('clicking metronome button sets aria-pressed="true" (starts metronome)', async ({ page }) => {
    const metronomeBtn = page.getByRole('button', { name: /toggle metronome/i });

    await metronomeBtn.click();
    await expect(metronomeBtn).toHaveAttribute('aria-pressed', 'true');
  });

  test('second click stops the metronome (aria-pressed returns to "false")', async ({ page }) => {
    const metronomeBtn = page.getByRole('button', { name: /toggle metronome/i });

    await metronomeBtn.click();
    await expect(metronomeBtn).toHaveAttribute('aria-pressed', 'true');

    await metronomeBtn.click();
    await expect(metronomeBtn).toHaveAttribute('aria-pressed', 'false');
  });
});

// ─── T023 — Metronome teardown on plugin close ────────────────────────────────

test.describe('Feature 035 / T023: Metronome audio teardown on plugin exit', () => {
  test('metronome stops when leaving Play Score plugin (Back button)', async ({ page }) => {
    await stubMxlFetch(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Enter Play Score player view
    await page.getByTestId('plugin-launch-play-score').click();
    await page.getByText('Bach — Invention No. 1').click();

    const toolbar = page.getByRole('toolbar', { name: /playback controls/i });
    const metronomeBtn = toolbar.getByRole('button', { name: /toggle metronome/i });

    // Start the metronome
    await metronomeBtn.click();
    await expect(metronomeBtn).toHaveAttribute('aria-pressed', 'true');

    // Leave the plugin via Back
    await page.getByRole('button', { name: /back/i }).click();

    // Verify plugin view is gone (plugin unmounted, engine disposed)
    await expect(toolbar).not.toBeVisible();
    // When re-entering, metronome should be inactive (new engine instance)
    await page.getByTestId('plugin-launch-play-score').click();
    await page.getByText('Bach — Invention No. 1').click();

    const toolbar2 = page.getByRole('toolbar', { name: /playback controls/i });
    const metronomeBtn2 = toolbar2.getByRole('button', { name: /toggle metronome/i });
    await expect(metronomeBtn2).toHaveAttribute('aria-pressed', 'false');
  });

  test('metronome stops when leaving Practice View plugin (Back button)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const practiceBtn = page.getByTestId('plugin-launch-practice-view');
    await expect(practiceBtn).toBeVisible({ timeout: 5000 });
    await practiceBtn.click();
    await expect(page.getByTestId('practice-view')).toBeVisible({ timeout: 5000 });

    const metronomeBtn = page.getByRole('button', { name: /toggle metronome/i });
    await metronomeBtn.click();
    await expect(metronomeBtn).toHaveAttribute('aria-pressed', 'true');

    // Exit via Back
    await page.getByRole('button', { name: /← back/i }).click();

    // Plugin should be gone
    await expect(page.getByTestId('practice-view')).not.toBeVisible();
  });
});
