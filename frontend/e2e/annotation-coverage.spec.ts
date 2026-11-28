/**
 * Feature 102 — Demo-Relevant Control Annotations — Coverage Guard
 *
 * The application's own accessibility surface is the source of truth for the
 * generated demo element index (spec FR-007, SC-009; annotation-contract.md §2).
 * This guard pins, for every demo-relevant control:
 *   1. reachability by `getByTestId(...)` (the stable handle), and
 *   2. a correct `role` and a non-empty accessible name, and
 *   3. reachability by `getByRole(role, { name })` (role + name matching works).
 *
 * Written before the annotations were fixed ("watch it fail"), so a control
 * that loses its handle or its accessible name fails here rather than silently
 * degrading the derived index (FR-017).
 *
 * Requires a running dev server — Playwright's `webServer` starts it on 5174.
 *
 * @see specs/102-demo-flow-generation/contracts/annotation-contract.md
 */

import { test, expect, type Page } from '@playwright/test';

// ─── Shared helpers ───────────────────────────────────────────────────────────

async function stubMxlFetch(page: Page): Promise<void> {
  await page.route('**/*.mxl', route =>
    route.fulfill({
      status: 200,
      body: '',
      contentType: 'application/octet-stream',
    })
  );
}

/** Open the app on the landing screen. */
async function openLanding(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
}

/** Open the Play Score plugin's score selector (no score chosen yet). */
async function openScoreSelector(page: Page): Promise<void> {
  await stubMxlFetch(page);
  await openLanding(page);
  await page.getByTestId('plugin-launch-play-score').click();
  await expect(page.getByTestId('score-selector-dialog')).toBeVisible();
}

/** Open the Play Score plugin with a score loaded (the player toolbar). */
async function openPlayScore(page: Page): Promise<void> {
  await openScoreSelector(page);
  await page.getByTestId('score-selector-item-beethoven-fur-elise').click();
  await expect(page.getByRole('toolbar')).toBeVisible();
}

// ─── Landing — plugin launcher cards ──────────────────────────────────────────

test.describe('Feature 102: landing — plugin launcher cards', () => {
  test.beforeEach(async ({ page }) => {
    await openLanding(page);
  });

  test('the Play Score card is reachable by testid, role and accessible name', async ({ page }) => {
    const card = page.getByTestId('plugin-launch-play-score');
    await expect(card).toBeVisible();
    await expect(card).toHaveRole('button');
    await expect(card).toHaveAccessibleName('Play');

    // Role + name matching resolves the same control.
    await expect(page.getByRole('button', { name: 'Play' })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Play' })).toHaveAttribute(
      'data-testid',
      'plugin-launch-play-score'
    );
  });
});

// ─── Score selector — dialog + score rows ─────────────────────────────────────

const SCORE_ROWS = [
  { testid: 'score-selector-item-bach-invention-1', name: 'Bach — Invention No. 1' },
  { testid: 'score-selector-item-beethoven-fur-elise', name: 'Beethoven — Für Elise' },
] as const;

test.describe('Feature 102: score selector — dialog and rows', () => {
  test.beforeEach(async ({ page }) => {
    await openScoreSelector(page);
  });

  test('the dialog is reachable by testid with role dialog and a name', async ({ page }) => {
    const dialog = page.getByTestId('score-selector-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveRole('dialog');
    await expect(dialog).toHaveAccessibleName(/\S/);
  });

  for (const row of SCORE_ROWS) {
    test(`score row "${row.name}" is reachable by testid, role and name`, async ({ page }) => {
      const button = page.getByTestId(row.testid);
      await expect(button).toBeVisible();
      await expect(button).toHaveRole('button');
      await expect(button).toHaveAccessibleName(row.name);

      // Role + name matching resolves exactly this row.
      await expect(page.getByRole('button', { name: row.name })).toHaveCount(1);
    });
  }
});

// ─── Play Score toolbar — Play / Stop ─────────────────────────────────────────

test.describe('Feature 102: Play Score toolbar — Play and Stop', () => {
  test.beforeEach(async ({ page }) => {
    await openPlayScore(page);
  });

  test('Play is a toolbar button with a stable testid and name', async ({ page }) => {
    const play = page.getByTestId('play-score-play');
    await expect(play).toBeVisible();
    await expect(play).toHaveRole('button');
    await expect(play).toHaveAccessibleName('Play');

    const toolbar = page.getByRole('toolbar');
    await expect(toolbar.getByRole('button', { name: 'Play' })).toHaveCount(1);
  });

  test('Stop is a toolbar button with a stable testid and name', async ({ page }) => {
    const stop = page.getByTestId('play-score-stop');
    await expect(stop).toBeVisible();
    await expect(stop).toHaveRole('button');
    await expect(stop).toHaveAccessibleName('Stop');

    const toolbar = page.getByRole('toolbar');
    await expect(toolbar.getByRole('button', { name: 'Stop' })).toHaveCount(1);
  });
});

// ─── Tempo widget — decrease / display / increase / subdivision ───────────────

test.describe('Feature 102: tempo widget', () => {
  test.beforeEach(async ({ page }) => {
    await openPlayScore(page);
  });

  test('decrease is a button named "Decrease tempo"', async ({ page }) => {
    const minus = page.getByTestId('tempo-minus');
    await expect(minus).toBeVisible();
    await expect(minus).toHaveRole('button');
    await expect(minus).toHaveAccessibleName('Decrease tempo');
    await expect(page.getByRole('button', { name: 'Decrease tempo' })).toHaveCount(1);
  });

  test('display exposes the BPM readout in its accessible name', async ({ page }) => {
    const display = page.getByTestId('tempo-display');
    await expect(display).toBeVisible();
    await expect(display).toHaveRole('button');
    await expect(display).toContainText('BPM');
    // The accessible name must carry the readout, not only the visible text.
    await expect(display).toHaveAccessibleName(/\d+\s*BPM/);
    await expect(page.getByRole('button', { name: /BPM/ })).toHaveCount(1);
  });

  test('increase is a button named "Increase tempo"', async ({ page }) => {
    const plus = page.getByTestId('tempo-plus');
    await expect(plus).toBeVisible();
    await expect(plus).toHaveRole('button');
    await expect(plus).toHaveAccessibleName('Increase tempo');
    await expect(page.getByRole('button', { name: 'Increase tempo' })).toHaveCount(1);
  });

  test('subdivision is a button named /metronome subdivision/i opening menuitems', async ({ page }) => {
    const chevron = page.getByTestId('metronome-subdivision');
    await expect(chevron).toBeVisible();
    await expect(chevron).toHaveRole('button');
    await expect(chevron).toHaveAccessibleName(/metronome subdivision/i);

    const byRole = page.getByRole('button', { name: /metronome subdivision/i });
    await expect(byRole).toHaveCount(1);
    await byRole.click();

    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /1\/4/ })).toBeVisible();
  });
});

// NOTE: the score-viewer phrase controls (`score-phrases-toggle`,
// `score-phrases-prev`, `score-phrases-next`) mount only once a score is parsed
// and engraved, which needs a built WASM engine — as unavailable here as the
// capture step (see quickstart.md). They are therefore guarded statically in
// `scripts/check-demo-annotations.mjs` and via the derived index, not at runtime
// here. When a WASM build is present, add them to a Play Score guard above.
