import { defineConfig, devices } from '@playwright/test';

/**
 * Production-simulation Playwright config.
 *
 * Runs E2E tests against a `vite preview` server built with
 * VITE_BASE=/graditone/ — the same sub-path used on GitHub Pages.
 *
 * Usage (from the frontend/ directory):
 *   VITE_BASE=/graditone/ npm run build
 *   npx playwright test --config playwright.config.prod.ts
 *
 * Why this exists:
 *   The default playwright.config.ts runs against the Vite dev server
 *   (base = '/'), which masks sub-path issues. This config forces the
 *   production base path so bugs like hardcoded '/scores/...' paths
 *   surface as 404s before the code is deployed to GitHub Pages.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'html',
  // Individual assertions carry their own explicit timeouts; 30 s at the
  // test level is enough for all current E2E flows.
  timeout: 30_000,

  use: {
    // Must match the sub-path the build was produced with
    baseURL: 'http://localhost:4173/graditone/',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Block the PWA service worker during E2E tests.
    // On first activation the SW calls clients.claim() which forces a
    // page reload, detaching all DOM elements mid-test and causing
    // locator.click() to fail with "element detached / navigation".
    serviceWorkers: 'block',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Expects the dist/ to already be built with VITE_BASE=/graditone/
  // The CI workflow does the build step before invoking playwright.
  webServer: {
    command: 'VITE_BASE=/graditone/ npx vite preview --port 4173',
    url: 'http://localhost:4173/graditone/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
