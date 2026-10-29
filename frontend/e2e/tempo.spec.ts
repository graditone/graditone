/**
 * Feature 101 — Shared Tempo/Metronome Widget — E2E Tests
 *
 * The digital BPM stepper (metronome button shows the BPM, flanked by − / +,
 * with a subdivision dropdown) is shared by the Play Score and Practice
 * toolbars. These tests drive the Play Score view.
 *
 * Requires a running dev server (npm run dev).
 */

import { test, expect } from '@playwright/test';

// ─── Shared helpers ───────────────────────────────────────────────────────────

async function stubMxlFetch(page: import('@playwright/test').Page): Promise<void> {
  await page.route('**/*.mxl', route =>
    route.fulfill({
      status: 200,
      body: '',
      contentType: 'application/octet-stream',
    })
  );
}

async function openPlayScore(page: import('@playwright/test').Page): Promise<void> {
  await stubMxlFetch(page);
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.getByTestId('plugin-launch-play-score').click();
  await page.getByText('Bach — Invention No. 1').click();
}

// ─── Shared widget basics ─────────────────────────────────────────────────────

test.describe('Feature 101: shared tempo + metronome widget (Play Score)', () => {
  test.beforeEach(async ({ page }) => {
    await openPlayScore(page);
  });

  test('the metronome start button carries the BPM readout', async ({ page }) => {
    const display = page.getByTestId('tempo-display');
    await expect(display).toBeVisible();
    await expect(display).toContainText('BPM');
    await expect(display).toContainText(/\d+/);
  });

  test('a short plus press raises the readout by 1 BPM', async ({ page }) => {
    const display = page.getByTestId('tempo-display');
    const before = parseInt((await display.textContent()) ?? '', 10);

    await page.getByTestId('tempo-plus').click();
    await expect(display).toContainText(String(before + 1));

    await page.getByTestId('tempo-minus').click();
    await expect(display).toContainText(String(before));
  });

  test('the subdivision chevron opens the 1/4 · 1/8 · 1/16 menu', async ({ page }) => {
    const chevron = page.getByRole('button', { name: /metronome subdivision/i });
    await expect(chevron).toBeVisible();
    await chevron.click();

    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /1\/4/ })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /1\/8/ })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /1\/16/ })).toBeVisible();

    await menu.getByRole('menuitem', { name: /1\/8/ }).click();
    await expect(menu).not.toBeVisible();
  });
});
