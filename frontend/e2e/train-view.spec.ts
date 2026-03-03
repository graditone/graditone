/**
 * Feature 036-rename-practice-train — Train Button E2E Tests
 *
 * Covers the landing screen ↔ TrainView navigation:
 *   - Train button is visible on the landing screen
 *   - Clicking it renders the Train Plugin view
 *   - The Back button returns to the landing screen
 *   - No critical console errors on the full round-trip
 */

import { test, expect } from '@playwright/test';

test.describe('Feature 036: Train View navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('Train button is visible on the landing screen', async ({ page }) => {
    await expect(page.getByRole('button', { name: /train/i })).toBeVisible();
  });

  test('clicking Train navigates to the Train view', async ({ page }) => {
    await page.getByRole('button', { name: /train/i }).click();

    // The Train view root and its heading must be visible
    await expect(page.locator('[data-testid="train-view"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: /train/i })).toBeVisible();
  });

  test('Back button in Train view returns to the landing screen', async ({ page }) => {
    await page.getByRole('button', { name: /train/i }).click();
    await expect(page.locator('[data-testid="train-view"]')).toBeVisible();

    // Press ← Back
    await page.getByRole('button', { name: /← back/i }).click();

    // Landing screen CTA must re-appear
    await expect(page.getByRole('button', { name: /play/i })).toBeVisible();
    await expect(page.locator('[data-testid="train-view"]')).not.toBeVisible();
  });

  test('No critical console errors when navigating to Train view', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.getByRole('button', { name: /train/i }).click();
    await expect(page.locator('[data-testid="train-view"]')).toBeVisible();

    const critical = errors.filter(
      (e) =>
        !e.includes('WASM') &&
        !e.includes('WebAssembly') &&
        !e.includes('favicon') &&
        !e.includes('ResizeObserver') &&
        !e.includes('getUserMedia'), // mic permission denied in headless
    );
    expect(critical).toHaveLength(0);
  });
});
