# Contract: External Plugin E2E Testing Approach

**Audience**: Plugin authors and contributors working on plugins in `plugins-external/`  
**Feature**: `076-review-e2e-tests`  
**Date**: 2026-04-07

---

## When Is an E2E Test Required for an External Plugin?

An external plugin **MUST** have at least one e2e smoke test when it is considered "installed by default" — i.e., it ships with the product or is listed in the plugin manager's promoted catalogue.

An external plugin **SHOULD** add e2e tests for any user interaction that:
- Cannot be verified without the host app loading the plugin (e.g., plugin panel renders after import, host ↔ plugin event exchange)
- Involves browser APIs that unit tests cannot exercise (storage persistence, MIDI input, audio context)

Pure UI logic (component rendering in isolation) continues to be covered by Vitest unit tests inside the plugin directory.

---

## Test Location

Each external plugin owns its own e2e folder:

```
plugins-external/<plugin-name>/
├── e2e/
│   ├── playwright.config.ts         # Plugin-specific Playwright config
│   └── <plugin-name>.smoke.spec.ts  # Smoke tests
├── dist/                            # Built plugin artefact (must exist before tests run)
├── src/
└── package.json
```

Do **not** place external plugin e2e tests inside `frontend/e2e/`. Core frontend e2e tests cover the host app; plugin smoke tests live with the plugin.

---

## Playwright Configuration (Template)

```typescript
// plugins-external/<plugin-name>/e2e/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',

  use: {
    // Point at the host app dev server (same port as frontend e2e)
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Reuse the existing server if already running; start it otherwise.
  // The host app must be started with PLAYWRIGHT_TEST=1 to use plain HTTP.
  webServer: {
    command: 'cd ../../frontend && PLAYWRIGHT_TEST=1 npm run dev -- --port 5174',
    url: 'http://localhost:5174',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
```

---

## Smoke Test Template

```typescript
// plugins-external/<plugin-name>/e2e/<plugin-name>.smoke.spec.ts
import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

// Plugin manifest (mirrors plugin.json)
const PLUGIN_MANIFEST = {
  id: '<plugin-id>',
  name: '<Plugin Name>',
  version: '1.0.0',
  pluginApiVersion: '8',          // match plugin.json
  entryPoint: 'index.js',
  description: '<description>',
  type: 'core',                   // or 'common'
  view: 'full-screen',            // or 'window'
};

/**
 * Reads the built plugin JS and seeds it into the host app's plugin-registry
 * IndexedDB before the React app initialises.
 */
function buildSeedScript(jsContent: string, manifest: typeof PLUGIN_MANIFEST): string {
  return `
    (async () => {
      const manifest = ${JSON.stringify(manifest)};
      const jsContent = ${JSON.stringify(jsContent)};
      const req = indexedDB.open('plugin-registry', 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('manifests')) db.createObjectStore('manifests', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('assets')) db.createObjectStore('assets', { keyPath: 'key' });
      };
      await new Promise((res, rej) => { req.onsuccess = res; req.onerror = rej; });
      const db = req.result;
      const tx = db.transaction(['manifests', 'assets'], 'readwrite');
      tx.objectStore('manifests').put({ id: manifest.id, manifest, installedAt: new Date() });
      tx.objectStore('assets').put({
        key: manifest.id + '/' + manifest.entryPoint,
        pluginId: manifest.id,
        name: manifest.entryPoint,
        data: new TextEncoder().encode(jsContent).buffer,
      });
      await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
    })();
  `;
}

test.describe('<Plugin Name> smoke', () => {
  let jsContent: string;

  test.beforeAll(() => {
    // Read the built plugin bundle from the plugin's own dist/ directory
    jsContent = readFileSync(join(__dirname, '../dist/index.js'), 'utf-8');
  });

  test.beforeEach(async ({ page }) => {
    // Inject plugin into IndexedDB before React mounts
    await page.addInitScript(buildSeedScript(jsContent, PLUGIN_MANIFEST));
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('plugin panel renders without critical errors', async ({ page }) => {
    // Capture console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    // Navigate to the plugin — adjust selector to match the plugin's nav button
    await page.getByRole('button', { name: /<Plugin Name>/i }).click();

    // Assert the plugin root element is visible
    await expect(page.locator('.<plugin-css-class>')).toBeVisible({ timeout: 15_000 });

    // No critical errors during render
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('back navigation returns to landing screen', async ({ page }) => {
    await page.getByRole('button', { name: /<Plugin Name>/i }).click();
    await expect(page.locator('.<plugin-css-class>')).toBeVisible({ timeout: 15_000 });

    // Click the toolbar back button
    await page.getByRole('button', { name: /←|back/i }).first().click();

    // Landing screen should re-appear
    await expect(page.getByRole('button', { name: /play/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.<plugin-css-class>')).not.toBeVisible();
  });
});
```

---

## Pre-Test Build Requirement

The plugin's `dist/index.js` must exist before running the e2e suite. Add a build step to the plugin's `package.json`:

```json
{
  "scripts": {
    "build": "vite build",
    "test:e2e": "npm run build && npx playwright test --config=e2e/playwright.config.ts"
  }
}
```

For CI, run `npm run test:e2e` from `plugins-external/<plugin-name>/`.

---

## Handling MIDI and Audio in CI

External plugins that use MIDI (e.g., `virtual-keyboard-pro`) MUST inject a browser-side MIDI mock before `page.goto()`:

```typescript
// No MIDI device (default CI scenario)
await page.addInitScript(`
  Object.defineProperty(navigator, 'requestMIDIAccess', {
    value: () => Promise.resolve({
      inputs: new Map(), outputs: new Map(), sysexEnabled: false,
      onstatechange: null, addEventListener: () => {}, removeEventListener: () => {},
    }),
    writable: true, configurable: true,
  });
`);
```

For MIDI-connected scenarios, inject a fake device with a populated `inputs` Map (see `frontend/e2e/fixtures/webMidiMock.ts` for the canonical implementation).

Audio context interactions (e.g., Tone.js) that require a user gesture cannot be fully automated. Gate audio assertions behind try/catch or skip them in CI with `test.skip(!!process.env.CI, 'audio requires user gesture')`.

---

## Checklist for a New External Plugin

- [ ] Plugin `dist/` is pre-built by `npm run build` before the test suite runs
- [ ] `e2e/playwright.config.ts` uses `reuseExistingServer: true`
- [ ] At least one test verifies the plugin panel renders without critical console errors
- [ ] At least one test verifies back navigation returns to the landing screen
- [ ] MIDI-dependent scenarios inject the Web MIDI mock via `page.addInitScript()`
- [ ] Audio-dependent scenarios are skipped in CI or use non-audio assertions
- [ ] Tests pass with `workers: 1` (CI constraint from `frontend/playwright.config.ts`)
