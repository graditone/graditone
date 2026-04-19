/**
 * Feature 080: User Profile Support — E2E Tests
 *
 * Covers:
 * - ProfileIcon renders in the toolbar
 * - Opening ProfilePanel via ProfileIcon button
 * - Default "Default" profile is active on first launch
 * - Creating a new profile
 * - Switching between profiles
 * - Renaming a profile
 * - Deleting a profile
 * - Data isolation: user scores seeded in profile A are not visible in profile B
 *
 * Strategy:
 *   Navigate to the app, interact with the ProfileIcon in the Play score plugin
 *   toolbar (the most accessible toolbar in the main view). Use localStorage
 *   manipulation to seed/verify profile state where needed.
 */

import { test, expect, type Page } from '@playwright/test';

// ── Selectors ────────────────────────────────────────────────────────────────

const PROFILE_BTN = (name: string) => `[aria-label="Profile: ${name}"]`;
const PROFILE_PANEL = '[role="dialog"][aria-label="Profile management"]';
const ADD_PROFILE_BTN = 'button.profile-panel-add-btn';
const CREATE_INPUT = '.profile-panel-create .profile-panel-input';
const CREATE_BTN = '.profile-panel-create button.profile-panel-btn:has-text("Create")';
const PROFILE_NAME_ITEM = (name: string) => `[title="Switch to ${name}"]`;
const ACTIVE_BADGE = '.profile-panel-active-badge';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Navigate to the app and wait for the ProfileIcon to appear. */
async function gotoApp(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  // Wait for a ProfileIcon button to appear (any profile name)
  await expect(page.locator('[aria-label^="Profile:"]').first()).toBeVisible({ timeout: 15_000 });
}

/** Open the ProfilePanel by clicking the first ProfileIcon in the toolbar. */
async function openPanel(page: Page, profileName = 'Default') {
  await page.locator(PROFILE_BTN(profileName)).first().click();
  await expect(page.locator(PROFILE_PANEL)).toBeVisible({ timeout: 5_000 });
}

/** Create a new profile via the panel (panel must already be open). */
async function createProfile(page: Page, name: string) {
  await page.locator(ADD_PROFILE_BTN).click();
  await page.locator(CREATE_INPUT).fill(name);
  await page.locator(CREATE_BTN).click();
}

/** Seed the user-scores-index for the currently active profile. */
async function seedUserScores(page: Page, entries: Array<{ id: string; displayName: string }>) {
  const profileId = await page.evaluate(() => localStorage.getItem('graditone-active-profile') ?? '');
  const key = profileId ? `profile:${profileId}:graditone-user-scores-index` : 'graditone-user-scores-index';
  const data = entries.map(e => ({ ...e, uploadedAt: new Date().toISOString() }));
  await page.evaluate(
    ([k, d]) => localStorage.setItem(k, JSON.stringify(d)),
    [key, data] as [string, typeof data],
  );
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('[aria-label^="Profile:"]').first()).toBeVisible({ timeout: 15_000 });
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('Feature 080: User Profiles', () => {
  test.beforeEach(async ({ page }) => {
    // Clear all profile state so each test starts fresh
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('graditone-') || k.includes(':'))) keysToRemove.push(k);
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
  });

  test('ProfileIcon renders in the toolbar', async ({ page }) => {
    await expect(page.locator('[aria-label^="Profile:"]').first()).toBeVisible({ timeout: 15_000 });
  });

  test('default profile name is "Default" on first launch', async ({ page }) => {
    await expect(page.locator(PROFILE_BTN('Default')).first()).toBeVisible({ timeout: 15_000 });
  });

  test('clicking ProfileIcon opens the ProfilePanel', async ({ page }) => {
    await gotoApp(page);
    await openPanel(page);
    await expect(page.locator(PROFILE_PANEL)).toBeVisible();
  });

  test('clicking outside the panel closes it', async ({ page }) => {
    await gotoApp(page);
    await openPanel(page);
    // Click somewhere outside the panel (top-left corner)
    await page.mouse.click(10, 10);
    await expect(page.locator(PROFILE_PANEL)).not.toBeVisible({ timeout: 3_000 });
  });

  test('creating a new profile adds it to the list', async ({ page }) => {
    await gotoApp(page);
    await openPanel(page);
    await createProfile(page, 'Alice');
    await expect(page.locator(PROFILE_NAME_ITEM('Alice'))).toBeVisible({ timeout: 5_000 });
  });

  test('switching to a new profile updates the ProfileIcon', async ({ page }) => {
    await gotoApp(page);
    await openPanel(page);
    await createProfile(page, 'Bob');
    // Now switch to Bob
    await page.locator(PROFILE_NAME_ITEM('Bob')).click();
    // Panel should close and the ProfileIcon should now show Bob
    await expect(page.locator(PROFILE_BTN('Bob')).first()).toBeVisible({ timeout: 5_000 });
  });

  test('active profile shows a checkmark badge in the panel', async ({ page }) => {
    await gotoApp(page);
    await openPanel(page);
    // Default profile should show active badge
    const defaultItem = page.locator('.profile-panel-item').filter({ hasText: 'Default' });
    await expect(defaultItem.locator(ACTIVE_BADGE)).toBeVisible();
  });

  test('renaming a profile updates the ProfileIcon and list', async ({ page }) => {
    await gotoApp(page);
    await openPanel(page);
    // Click Rename on Default
    await page.locator('[aria-label="Rename Default"]').click();
    const renameInput = page.locator('.profile-panel-edit .profile-panel-input');
    await renameInput.fill('Main');
    await page.locator('.profile-panel-edit button', { hasText: '✓' }).click();
    // ProfileIcon should update
    await expect(page.locator(PROFILE_BTN('Main')).first()).toBeVisible({ timeout: 5_000 });
  });

  test('creating a profile with an empty name shows an error', async ({ page }) => {
    await gotoApp(page);
    await openPanel(page);
    await page.locator(ADD_PROFILE_BTN).click();
    // Leave input empty
    await page.locator(CREATE_BTN).click();
    await expect(page.locator('.profile-panel-create .profile-panel-error')).toBeVisible();
  });

  test('deleting a non-active profile removes it from the list', async ({ page }) => {
    await gotoApp(page);
    await openPanel(page);
    await createProfile(page, 'Temp');
    await expect(page.locator(PROFILE_NAME_ITEM('Temp'))).toBeVisible({ timeout: 5_000 });

    // Delete Temp
    await page.locator('[aria-label="Delete Temp"]').click();
    // Confirm
    await page.locator('.profile-panel-confirm button.profile-panel-btn-danger').click();
    await expect(page.locator(PROFILE_NAME_ITEM('Temp'))).not.toBeVisible({ timeout: 3_000 });
  });

  test('data isolation: scores seeded in Default are absent after switching profiles', async ({ page }) => {
    await gotoApp(page);

    // Seed a score for Default profile
    await seedUserScores(page, [{ id: 'profile-e2e-1', displayName: 'My Default Score' }]);

    // Create and switch to Alice
    await openPanel(page, 'Default');
    await createProfile(page, 'Alice');
    await page.locator(PROFILE_NAME_ITEM('Alice')).click();
    await expect(page.locator(PROFILE_BTN('Alice')).first()).toBeVisible({ timeout: 5_000 });

    // Open Train > Score selector and verify "My Default Score" is NOT visible
    await page.getByRole('button', { name: /train/i }).click();
    await expect(page.locator('[data-testid="train-view"]')).toBeVisible({ timeout: 15_000 });
    await page.getByLabel(/complexity level/i).selectOption('custom');
    await page.getByRole('radio', { name: /score/i }).click();
    await expect(page.locator('[data-testid="score-selector-dialog"]')).toBeVisible({ timeout: 15_000 });

    await expect(page.getByText('My Default Score')).not.toBeVisible();
  });
});
