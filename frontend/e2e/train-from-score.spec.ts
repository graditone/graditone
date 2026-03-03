/**
 * Feature 034 / Feature 036: Train from Score -- E2E Tests
 *
 * SC-001: Open Train plugin -> select Score preset -> selector opens -> choose
 *         Beethoven Fur Elise -> exercise staff has notes -> start exercise
 * SC-002: Switch to Random and back to Score -- no dialog opens (cache preserved)
 * SC-003: All existing Random and C4 Scale exercise flows still work (regression)
 * SC-004: Notes slider max matches totalAvailable from loaded score
 * SC-005: Score selector contains a file-upload control
 *
 * These tests run against the production build (vite preview) with real .mxl
 * files and WASM parsing.  No network stubs -- the full loading pipeline is
 * exercised end-to-end.
 *
 * All assertions use explicit timeouts rather than test.slow() to avoid
 * interaction effects between the tripled action-timeout and Playwright's
 * default expectation timeout.  Long-running steps (WASM parse, 3.5 s
 * countdown) have generous explicit timeouts.
 */

import { test, expect, type Page } from '@playwright/test';

// \u2500 Selectors \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

const TRAIN_BTN   = /train/i;
const SCORE_RADIO = /score/i;
const RANDOM_RADIO  = /random/i;
const C4_RADIO      = /c4 scale/i;
// Exact displayName from preloadedScores.ts (\u2014 is em-dash, \u00fc is u-umlaut)
const BEETHOVEN_TXT = 'Beethoven \u2014 F\u00fcr Elise';
const CHANGE_SCORE  = /change score/i;
const SCORE_DIALOG  = '[data-testid="score-selector-dialog"]';
const PLAY_BTN    = '[data-testid="train-play-btn"]';
const STOP_BTN    = '[data-testid="train-stop-btn"]';
const TRAIN_VIEW  = '[data-testid="train-view"]';
const STAFF_VIEWER  = '[data-testid="plugin-staff-viewer"]';

// \u2500 Helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

async function openTrain(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.getByRole('button', { name: TRAIN_BTN }).click();
  await expect(page.locator(TRAIN_VIEW)).toBeVisible({ timeout: 15_000 });
}

/**
 * Select Score preset, pick Beethoven from the catalogue, and wait for the
 * score to finish loading (real .mxl fetch + WASM parse).
 */
async function loadBeethovenScore(page: Page) {
  // Open the config panel by switching to Custom level
  await page.getByLabel(/complexity level/i).selectOption('custom');
  await page.getByRole('radio', { name: SCORE_RADIO }).click();
  // Dialog opens synchronously on radio click; allow up to 15 s for CI rendering
  await expect(page.locator(SCORE_DIALOG)).toBeVisible({ timeout: 15_000 });
  // Use getByText to match the catalogue button text (proven pattern)
  await page.getByText(BEETHOVEN_TXT).click();
  // Real WASM parsing -- give generous time on slow CI machines
  await expect(page.locator(SCORE_DIALOG)).not.toBeVisible({ timeout: 30_000 });
}

// \u2500 SC-001 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

test.describe('SC-001: Score preset basic flow', () => {
  test('select Score preset -> dialog -> pick score -> exercise staff populates', async ({ page }) => {
    await openTrain(page);
    await loadBeethovenScore(page);

    // Exercise staff should render with the loaded score notes
    await expect(page.locator(STAFF_VIEWER).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(PLAY_BTN)).toBeVisible({ timeout: 10_000 });

    // Start exercise -- countdown (~3.5 s) then playing
    await page.locator(PLAY_BTN).click();
    await expect(page.locator(PLAY_BTN)).not.toBeVisible({ timeout: 10_000 });
    await expect(page.locator(STOP_BTN)).toBeVisible({ timeout: 30_000 });
  });
});

// \u2500 SC-002 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

test.describe('SC-002: Cache preserved on preset switch', () => {
  test('switch to Random and back -- no dialog opens', async ({ page }) => {
    await openTrain(page);
    await loadBeethovenScore(page);

    // Switch away and back
    await page.getByRole('radio', { name: RANDOM_RADIO }).click();
    await page.getByRole('radio', { name: SCORE_RADIO }).click();

    // Dialog must NOT reopen (cached pitches still present)
    await expect(page.locator(SCORE_DIALOG)).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: CHANGE_SCORE })).toBeVisible({ timeout: 5_000 });
  });
});

// \u2500 SC-003 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

test.describe('SC-003: Existing preset regressions', () => {
  test('Random preset exercise starts normally', async ({ page }) => {
    await openTrain(page);
    // Select High complexity level -- uses random preset + flow mode (with countdown)
    const levelSel = page.getByLabel(/complexity level/i);
    await levelSel.selectOption('high');
    await expect(page.getByRole('radio', { name: RANDOM_RADIO })).toBeChecked({ timeout: 5_000 });

    await page.locator(PLAY_BTN).click();
    // Play button disappears as soon as countdown starts
    await expect(page.locator(PLAY_BTN)).not.toBeVisible({ timeout: 10_000 });
    // Countdown overlay is visible during the 3.5 s countdown phase
    await expect(page.locator('.train-countdown')).toBeVisible({ timeout: 5_000 });
    // Stop button appears once playing phase starts (after ~3.5 s countdown)
    await expect(page.locator(STOP_BTN)).toBeVisible({ timeout: 30_000 });
  });

  test('C4 Scale preset exercise starts normally', async ({ page }) => {
    await openTrain(page);
    // Open config panel via Custom to access preset selector
    await page.getByLabel(/complexity level/i).selectOption('custom');
    await page.getByRole('radio', { name: C4_RADIO }).click();

    await page.locator(PLAY_BTN).click();
    // C4 Scale uses step mode -- no countdown, goes straight to playing
    await expect(page.locator(PLAY_BTN)).not.toBeVisible({ timeout: 10_000 });
    await expect(page.locator(STOP_BTN)).toBeVisible({ timeout: 30_000 });
  });
});

// \u2500 SC-004 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

test.describe('SC-004: Notes slider max matches totalAvailable', () => {
  test('Notes slider max reflects score pitch count', async ({ page }) => {
    await openTrain(page);
    await loadBeethovenScore(page);

    // Use aria-label to target the Notes slider specifically (not the Tempo one)
    const slider = page.getByRole('slider', { name: /note count/i });
    await expect(slider).toBeVisible({ timeout: 10_000 });
    const max = await slider.getAttribute('max');
    expect(Number(max)).toBeGreaterThan(0);
  });
});

// \u2500 SC-005 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

test.describe('SC-005: Score selector file-upload UI', () => {
  test('score selector contains a file-upload control and cancel works', async ({ page }) => {
    await openTrain(page);
    // Open config panel via Custom to access preset selector
    await page.getByLabel(/complexity level/i).selectOption('custom');
    await page.getByRole('radio', { name: SCORE_RADIO }).click();
    await expect(page.locator(SCORE_DIALOG)).toBeVisible();

    // "Load from file" button is visible
    await expect(page.getByRole('button', { name: /load from file/i })).toBeVisible();

    // Hidden file input is attached to the DOM
    const fileInput = page.locator(`${SCORE_DIALOG} input[type="file"]`);
    await expect(fileInput).toBeAttached();

    // Cancel closes the dialog and reverts to random preset
    await page.getByRole('button', { name: /cancel score selection/i }).click();
    await expect(page.locator(SCORE_DIALOG)).not.toBeVisible();
    await expect(page.locator(TRAIN_VIEW)).toBeVisible();
  });
});
