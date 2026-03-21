/**
 * Regression tests for Nocturne Op.9 No.2 layout defects M29–M37.
 *
 * Defect 1 (M29): Double-flat accidental must render as U+E264.
 * Defect 2 (M31): 8va bracket must be present above the staff.
 *
 * These E2E tests verify the frontend correctly renders the layout
 * output from the WASM engine. The backend regression tests in
 * backend/tests/nocturne_m29_m37_test.rs cover the layout computation.
 */
import { test, expect } from '@playwright/test';

test.describe('Nocturne M29–M37 layout regression', () => {
  test('M29 double-flat note renders glyph U+E264', async ({ page }) => {
    // 1. Navigate to Play view and select Chopin Nocturne
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const launchBtn = page.getByTestId('plugin-launch-play-score');
    await expect(launchBtn).toBeVisible({ timeout: 10000 });
    await launchBtn.click();

    const chopinEntry = page.getByText('Chopin \u2014 Nocturne Op. 9 No. 2');
    await expect(chopinEntry).toBeVisible({ timeout: 10000 });
    await chopinEntry.click();

    // 2. Wait for score to render
    await page.waitForSelector('svg .glyph-run text', { timeout: 30000 });
    await page.waitForTimeout(2000);

    // 3. Scroll through the score and check for the double-flat glyph (U+E264)
    const result = await page.evaluate(async () => {
      const scoreContainer = document.querySelector('.score-scroll-container');
      if (!scoreContainer) return { error: 'no container', found: false };

      let scrollEl: Element | null = scoreContainer.parentElement;
      while (scrollEl) {
        const style = window.getComputedStyle(scrollEl);
        if ((style.overflow === 'auto' || style.overflowY === 'auto' ||
             style.overflow === 'scroll' || style.overflowY === 'scroll') &&
            scrollEl.scrollHeight > scrollEl.clientHeight) {
          break;
        }
        scrollEl = scrollEl.parentElement;
      }
      if (!scrollEl) return { error: 'no scrollable ancestor', found: false };

      const DOUBLE_FLAT = '\uE264';
      const totalHeight = scrollEl.scrollHeight;
      const viewHeight = scrollEl.clientHeight;
      const step = Math.floor(viewHeight * 0.7);

      for (let pos = 0; pos <= totalHeight; pos += step) {
        scrollEl.scrollTop = pos;
        await new Promise(r => setTimeout(r, 300));

        const textEls = document.querySelectorAll('svg .glyph-run text');
        for (const el of textEls) {
          if (el.textContent?.includes(DOUBLE_FLAT)) {
            return { found: true, error: null };
          }
        }
      }

      return { found: false, error: null };
    });

    expect(result.error).toBeNull();
    expect(result.found).toBe(true);
  });

  test('8va bracket label is present in the score', async ({ page }) => {
    // 1. Navigate to Play view and select Chopin Nocturne
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const launchBtn = page.getByTestId('plugin-launch-play-score');
    await expect(launchBtn).toBeVisible({ timeout: 10000 });
    await launchBtn.click();

    const chopinEntry = page.getByText('Chopin \u2014 Nocturne Op. 9 No. 2');
    await expect(chopinEntry).toBeVisible({ timeout: 10000 });
    await chopinEntry.click();

    // 2. Wait for score to render
    await page.waitForSelector('svg .glyph-run text', { timeout: 30000 });
    await page.waitForTimeout(2000);

    // 3. Scroll through the score and look for the 8va bracket label
    const result = await page.evaluate(async () => {
      const scoreContainer = document.querySelector('.score-scroll-container');
      if (!scoreContainer) return { error: 'no container', found: false };

      let scrollEl: Element | null = scoreContainer.parentElement;
      while (scrollEl) {
        const style = window.getComputedStyle(scrollEl);
        if ((style.overflow === 'auto' || style.overflowY === 'auto' ||
             style.overflow === 'scroll' || style.overflowY === 'scroll') &&
            scrollEl.scrollHeight > scrollEl.clientHeight) {
          break;
        }
        scrollEl = scrollEl.parentElement;
      }
      if (!scrollEl) return { error: 'no scrollable ancestor', found: false };

      const totalHeight = scrollEl.scrollHeight;
      const viewHeight = scrollEl.clientHeight;
      const step = Math.floor(viewHeight * 0.7);

      for (let pos = 0; pos <= totalHeight; pos += step) {
        scrollEl.scrollTop = pos;
        await new Promise(r => setTimeout(r, 300));

        // Look for 8va text in SVG elements
        const allText = document.querySelectorAll('svg text');
        for (const el of allText) {
          if (el.textContent?.includes('8va')) {
            return { found: true, error: null };
          }
        }
      }

      return { found: false, error: null };
    });

    expect(result.error).toBeNull();
    expect(result.found).toBe(true);
  });
});
