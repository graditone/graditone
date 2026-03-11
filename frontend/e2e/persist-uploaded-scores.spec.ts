/**
 * Feature 045: Persist Uploaded Scores — E2E Tests (T021)
 *
 * Covers:
 * - Seeded user score appears in "My Scores" section of ScoreSelectorPlugin
 * - Entries persist across page reload
 * - Deduplicated names render correctly
 * - Delete button removes score from the list
 *
 * Strategy:
 *   The host-provided ScoreSelectorPlugin (which renders UserScoreList)
 *   is used by the Train plugin's Score preset. We seed localStorage with
 *   user score metadata, open the Train plugin, switch to Score preset,
 *   and verify the "My Scores" section appears in the score-selector-dialog.
 *
 * Note: Full upload → persist E2E (through LoadScoreDialog) requires loading
 * a score into instruments view first. These tests focus on the metadata
 * persistence layer and UI rendering.
 */

import { test, expect, type Page } from '@playwright/test';

const TRAIN_BTN = /train/i;
const SCORE_RADIO = /score/i;
const SCORE_DIALOG = '[data-testid="score-selector-dialog"]';
const TRAIN_VIEW = '[data-testid="train-view"]';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Navigate to app, seed localStorage with user score entries, and reload. */
async function seedUserScores(page: Page, entries: Array<{ id: string; displayName: string; uploadedAt?: string }>) {
  const seeded = entries.map(e => ({
    id: e.id,
    displayName: e.displayName,
    uploadedAt: e.uploadedAt ?? new Date().toISOString(),
  }));
  await page.evaluate((data) => {
    localStorage.setItem('graditone-user-scores-index', JSON.stringify(data));
  }, seeded);
  // Reload so the React hook reads seeded data
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
}

/** Open the Train plugin and switch to Score preset to trigger ScoreSelector dialog. */
async function openTrainScoreSelector(page: Page) {
  await page.getByRole('button', { name: TRAIN_BTN }).click();
  await expect(page.locator(TRAIN_VIEW)).toBeVisible({ timeout: 15_000 });
  // Switch to Custom level so Score radio is visible
  await page.getByLabel(/complexity level/i).selectOption('custom');
  await page.getByRole('radio', { name: SCORE_RADIO }).click();
  await expect(page.locator(SCORE_DIALOG)).toBeVisible({ timeout: 15_000 });
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('Feature 045: Persist Uploaded Scores', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('seeded user score shows "My Scores" section in ScoreSelector', async ({ page }) => {
    await seedUserScores(page, [
      { id: 'e2e-test-1', displayName: 'E2E Test Score' },
    ]);

    await openTrainScoreSelector(page);

    await expect(page.getByText('My Scores')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('E2E Test Score')).toBeVisible();
  });

  test('user scores persist across page reload', async ({ page }) => {
    await seedUserScores(page, [
      { id: 'persist-1', displayName: 'Persistent Score' },
    ]);

    // Second reload to confirm persistence
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    await openTrainScoreSelector(page);

    await expect(page.getByText('My Scores')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Persistent Score')).toBeVisible();
  });

  test('deduplicated names render correctly', async ({ page }) => {
    await seedUserScores(page, [
      { id: 'dup-2', displayName: 'My Score (2)', uploadedAt: new Date(Date.now() - 1000).toISOString() },
      { id: 'dup-1', displayName: 'My Score', uploadedAt: new Date(Date.now() - 2000).toISOString() },
    ]);

    await openTrainScoreSelector(page);

    await expect(page.getByText('My Scores')).toBeVisible({ timeout: 10_000 });
    // Both entries should be visible with correct names
    await expect(page.getByText('My Score (2)')).toBeVisible();
    // 'My Score' without the suffix — use exact match to avoid matching 'My Score (2)'
    await expect(page.locator('.user-score-item__name').filter({ hasText: /^My Score$/ })).toBeVisible();
  });

  test('delete button removes score from the list', async ({ page }) => {
    await seedUserScores(page, [
      { id: 'del-1', displayName: 'Score To Delete' },
    ]);

    await openTrainScoreSelector(page);

    await expect(page.getByText('My Scores')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Score To Delete')).toBeVisible();

    // Click the × delete button
    const deleteBtn = page.getByRole('button', { name: /Remove Score To Delete/i });
    await deleteBtn.click();

    // Score should be removed from the list
    await expect(page.getByText('Score To Delete')).not.toBeVisible({ timeout: 5_000 });
    // "My Scores" heading should disappear since it was the only score
    await expect(page.getByText('My Scores')).not.toBeVisible();
  });

  test('"My Scores" section is hidden when no user scores exist', async ({ page }) => {
    // No seeding — localStorage is empty
    await openTrainScoreSelector(page);

    // "My Scores" heading should NOT be visible
    await expect(page.getByText('My Scores')).not.toBeVisible({ timeout: 5_000 });
    // Preloaded catalogue should still be visible
    await expect(page.getByText('Bach — Invention No. 1')).toBeVisible();
  });
});
