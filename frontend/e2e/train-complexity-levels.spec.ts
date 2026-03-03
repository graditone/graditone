/**
 * Feature 001 / Feature 036: Train (formerly Practice) Complexity Levels — E2E Tests
 *
 * SC-001: Select Low → level selector shows Low active → clicking Play starts
 *         a c4scale exercise within 15 s (countdown + playing phase reached)
 * SC-002: Each level produces the correct parameters visible in the sidebar
 *         (BPM slider value matches FR-002/FR-003/FR-004 specs)
 * SC-003: Session reachable in exactly 2 interactions:
 *         select level → click Play → exercise starts
 * SC-004: Select High → reload page → selector shows High as active
 *
 * Tests run against the production build (vite preview on port 4173).
 */

import { test, expect, type Page } from '@playwright/test';

// ─ Selectors ─────────────────────────────────────────────────────────────────

const TRAIN_BTN   = /train/i;
const TRAIN_VIEW  = '[data-testid="train-view"]';
const PLAY_BTN    = '[data-testid="train-play-btn"]';
const STOP_BTN    = '[data-testid="train-stop-btn"]';

// ─ Helpers ───────────────────────────────────────────────────────────────────

async function openTrain(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.getByRole('button', { name: TRAIN_BTN }).click();
  await expect(page.locator(TRAIN_VIEW)).toBeVisible({ timeout: 15_000 });
}

// ─ Tests ─────────────────────────────────────────────────────────────────────

test.describe('Train Complexity Levels', () => {

  /**
   * SC-001: Selecting Low → Play starts the exercise within 15 s
   */
  test('SC-001: Low level → Play starts exercise within 15 s', async ({ page }) => {
    await openTrain(page);

    // Low should already be selected as default
    const sel = page.getByLabel(/complexity level/i);
    await expect(sel).toBeVisible({ timeout: 5_000 });
    await expect(sel).toHaveValue('low');

    // Click Play
    await page.locator(PLAY_BTN).click();

    // Countdown then playing — Stop button appears within 15 s
    await expect(page.locator(STOP_BTN)).toBeVisible({ timeout: 15_000 });
  });

  /**
   * SC-002: Each level shows the correct BPM in the Tempo slider
   *   Low  → 40 BPM
   *   Mid  → 80 BPM
   *   High → 100 BPM
   */
  test('SC-002: Each level applies correct BPM parameter (FR-002/003/004)', async ({ page }) => {
    await openTrain(page);

    const sel       = page.getByLabel(/complexity level/i);
    const bpmSlider = page.getByLabel(/tempo bpm/i);

    // Low: BPM = 40
    await sel.selectOption('low');
    await expect(bpmSlider).toHaveValue('40', { timeout: 3_000 });

    // Mid: BPM = 80
    await sel.selectOption('mid');
    await expect(bpmSlider).toHaveValue('80', { timeout: 3_000 });

    // High: BPM = 100
    await sel.selectOption('high');
    await expect(bpmSlider).toHaveValue('100', { timeout: 3_000 });
  });

  /**
   * SC-003: 2 interactions: select level → click Play → exercise starts
   */
  test('SC-003: Exercise reachable in 2 interactions (select level + Play)', async ({ page }) => {
    await openTrain(page);

    const sel = page.getByLabel(/complexity level/i);

    // Interaction 1: select Mid level
    await sel.selectOption('mid');
    await expect(sel).toHaveValue('mid');

    // Interaction 2: click Play
    await page.locator(PLAY_BTN).click();

    // Exercise starts — Stop button visible within 15 s
    await expect(page.locator(STOP_BTN)).toBeVisible({ timeout: 15_000 });
  });

  /**
   * SC-004: Select High → reload → selector still shows High
   */
  test('SC-004: Selected level persists after page reload', async ({ page }) => {
    await openTrain(page);

    const sel = page.getByLabel(/complexity level/i);

    // Select High
    await sel.selectOption('high');
    await expect(sel).toHaveValue('high');

    // Reload the page
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Open train again
    await page.getByRole('button', { name: TRAIN_BTN }).click();
    await expect(page.locator(TRAIN_VIEW)).toBeVisible({ timeout: 15_000 });

    // High should still be selected
    const sel2 = page.getByLabel(/complexity level/i);
    await expect(sel2).toHaveValue('high', { timeout: 5_000 });
  });

});
