/**
 * Feature 051: Tied Notes — End-to-End Test (T014)
 *
 * Verifies that tie arcs are rendered as SVG <path> elements
 * when a score with tied notes is loaded and displayed.
 */

import { test, expect } from '@playwright/test';

test.describe('Feature 051: Tied Notes Rendering', () => {
  test('Chopin Nocturne renders tie arc SVG paths', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Launch Play Score plugin and pick a score known to have ties
    await page.getByTestId('plugin-launch-play-score').click();
    await page.getByText('Chopin — Nocturne Op. 9 No. 2').click();

    // Wait for the WASM layout to render SVG content
    await page.waitForSelector('svg', { timeout: 15_000 });

    // Wait for tie arcs to appear (they're rendered after the layout engine runs)
    const tieArcs = page.locator('path.tie-arc');
    await expect(tieArcs.first()).toBeVisible({ timeout: 15_000 });

    // Verify at least one tie arc exists
    const count = await tieArcs.count();
    expect(count).toBeGreaterThan(0);

    // Verify tie arc has a valid cubic Bézier path
    const d = await tieArcs.first().getAttribute('d');
    expect(d).toMatch(/^M .+ C .+/);
  });
});
