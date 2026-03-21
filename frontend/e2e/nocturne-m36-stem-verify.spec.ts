/**
 * Verification: Nocturne Op.9 No.2 M36 32nd note stem directions.
 * Notes 8-15 (F6→D5) should have stems UP per MusicXML <stem>up</stem>.
 */
import { test, expect } from '@playwright/test';

async function navigateToNocturne(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const launchBtn = page.getByTestId('plugin-launch-play-score');
  await expect(launchBtn).toBeVisible({ timeout: 10000 });
  await launchBtn.click();
  const chopinEntry = page.getByText('Chopin \u2014 Nocturne Op. 9 No. 2');
  await expect(chopinEntry).toBeVisible({ timeout: 10000 });
  await chopinEntry.click();
  await page.waitForSelector('svg .glyph-run text', { timeout: 30000 });
  await page.waitForTimeout(2000);
}

test('M36 32nd notes screenshot', async ({ page }) => {
  await navigateToNocturne(page);

  // Take initial screenshot
  await page.screenshot({
    path: 'test-results/nocturne-m36-initial.png',
    fullPage: false,
  });

  // Try mouse wheel scrolling on the score area
  const svg = page.locator('svg').first();
  await svg.scrollIntoViewIfNeeded();
  
  // Use mouse wheel  
  for (let i = 0; i < 20; i++) {
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(1000);
  
  await page.screenshot({
    path: 'test-results/nocturne-m36-scroll1.png',
    fullPage: false,
  });

  // More scrolling  
  for (let i = 0; i < 20; i++) {
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(1000);
  
  await page.screenshot({
    path: 'test-results/nocturne-m36-scroll2.png',
    fullPage: false,
  });

  // Even more
  for (let i = 0; i < 20; i++) {
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(1000);

  await page.screenshot({
    path: 'test-results/nocturne-m36-scroll3.png',
    fullPage: false,
  });

  // And more
  for (let i = 0; i < 20; i++) {
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(1000);

  await page.screenshot({
    path: 'test-results/nocturne-m36-scroll4.png',
    fullPage: false,
  });
});
