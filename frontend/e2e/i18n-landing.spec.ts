/**
 * E2E smoke test: Landing page i18n — Feature 073
 *
 * Opens the app with locale set to 'es' and verifies that the
 * key visible Spanish strings are present on the landing page.
 *
 * Run: npx playwright test e2e/i18n-landing.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Landing page i18n (Feature 073)', () => {
  test('Spanish locale shows Spanish slogan and loading text', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'es' });
    const page = await context.newPage();

    await page.goto('/');

    // The loading state is very brief. Try to catch it first, but don't fail
    // if the page has already finished loading.
    const loadingEl = page.locator('text=Cargando el motor de música');
    const sloganEl = page.locator('text=La plataforma abierta para la práctica musical');

    // Assert: at least one of loading text OR slogan is visible in Spanish
    // (loading might be gone by the time we check, so we accept either)
    await Promise.race([
      loadingEl.waitFor({ state: 'visible', timeout: 3000 }).catch(() => null),
      sloganEl.waitFor({ state: 'visible', timeout: 10000 }),
    ]);

    // After engine loads, the slogan MUST be visible in Spanish
    await expect(sloganEl).toBeVisible({ timeout: 15000 });

    await context.close();
  });

  test('English locale shows English slogan', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'en' });
    const page = await context.newPage();

    await page.goto('/');

    await expect(
      page.locator('text=The open platform for musical practice'),
    ).toBeVisible({ timeout: 15000 });

    await context.close();
  });

  test('Unsupported locale (fr) falls back to English', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'fr' });
    const page = await context.newPage();

    await page.goto('/');

    await expect(
      page.locator('text=The open platform for musical practice'),
    ).toBeVisible({ timeout: 15000 });

    await context.close();
  });
});
