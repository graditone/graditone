/**
 * Feature 055: Difficulty Tag — End-to-End Smoke Test
 *
 * Verifies that at least one preloaded score entry in the load score dialog
 * displays a difficulty badge with text "Easy", "Medium", or "Hard".
 * Also verifies no score entry shows a blank or "Unknown" tag.
 */

import { test, expect } from '@playwright/test';

test.describe('Feature 055: Difficulty Tag', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('at least one preloaded score shows a difficulty badge', async ({ page }) => {
    await page.getByRole('button', { name: /play/i }).click();

    const difficultyTags = page.locator('[class*="difficulty-tag"]');
    await expect(difficultyTags.first()).toBeVisible({ timeout: 5000 });

    const count = await difficultyTags.count();
    expect(count).toBeGreaterThan(0);

    // Each visible tag must contain "Easy", "Medium", or "Hard"
    for (let i = 0; i < count; i++) {
      const text = await difficultyTags.nth(i).textContent();
      expect(text).toMatch(/^(Easy|Medium|Hard)$/);
    }
  });

  test('no score entry shows a blank or "Unknown" difficulty tag', async ({ page }) => {
    await page.getByRole('button', { name: /play/i }).click();

    // Wait for dialog content to render
    await expect(page.getByText('Bach — Invention No. 1')).toBeVisible();

    const unknownTags = page.locator('[class*="difficulty-tag"]', { hasText: 'Unknown' });
    await expect(unknownTags).toHaveCount(0);

    // No empty difficulty tags
    const allTags = page.locator('[class*="difficulty-tag"]');
    const count = await allTags.count();
    for (let i = 0; i < count; i++) {
      const text = (await allTags.nth(i).textContent())?.trim();
      expect(text).not.toBe('');
    }
  });
});
