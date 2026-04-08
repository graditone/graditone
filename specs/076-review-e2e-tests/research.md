# Research: E2E Test Coverage Review

**Feature**: `076-review-e2e-tests`  
**Phase**: 0 — Research & Unknowns Resolution  
**Date**: 2026-04-07

---

## R-001 — Existing E2E Test Audit (65 test cases, 16 files)

### Decision
Classify 4 spec files (8 test cases) as **CONVERT** to backend/frontend unit tests.  
Classify 12 spec files (57 test cases) as **KEEP**.  
No files classified as **REMOVE** at audit time (all feature areas still live).

### Classification by File

| File | Tests | Classification | Rationale |
|------|-------|---------------|-----------|
| `demo-flow.spec.ts` | 7 | **KEEP** | Core onboarding user journey; multi-component, full pipeline, requires real browser |
| `difficulty-tag.spec.ts` | 4 | **KEEP** | Verifies difficulty badge data flows from backend → score selector UI; integration-level |
| `i18n-landing.spec.ts` | 4 | **KEEP** | Browser locale behaviour and string rendering; cannot be unit-tested reliably |
| `load-score-dialog.spec.ts` | 6 | **KEEP** | HTTP 404 checks for static assets require a real HTTP server; network path verification |
| `m21-flat-check.spec.ts` | 2 | **CONVERT** | Guards `convertScoreToLayoutFormat()` field forwarding; backend `m21_accidental_test.rs` already covers layout computation; frontend field-forwarding can be covered by a unit test on `convertScoreToLayoutFormat` given mock layout JSON |
| `metronome.spec.ts` | 15 | **KEEP** | Multi-plugin UI toggle (Play + Practice views), state teardown on close; genuine multi-component interaction |
| `nocturne-m2-staccato-verify.spec.ts` | 2 | **CONVERT** | Checks SVG circle `cy` coordinates — pixel-level layout assertions belong in Rust backend unit tests per Principle VI (Layout Engine Authority) |
| `nocturne-m29-m37-layout.spec.ts` | 3 | **CONVERT** | Checks glyph character code (U+E264) and 8va bracket presence; backend `nocturne_m29_m37_test.rs` already covers layout; frontend rendering verifiable via SVG snapshot unit test |
| `nocturne-m36-stem-verify.spec.ts` | 1 | **CONVERT** | Checks stem direction via SVG coordinate comparison — layout computation responsibility belongs to Rust backend (Principle VI) |
| `persist-uploaded-scores.spec.ts` | 7 | **KEEP** | IndexedDB persistence across page reload; browser storage lifecycle requires real browser |
| `play-score-plugin.spec.ts` | 10 | **KEEP** | Core Play Score user journey; plugin launch, score selection, playback teardown |
| `tied-notes.spec.ts` | 2 | **KEEP** | Guards the full pipeline (HTTP load → WASM parse → SVG `<path>` element rendered); prior regression caused by missing frontend render step, not layout computation |
| `train-complexity-levels.spec.ts` | 5 | **KEEP** | Level selection, BPM preset values, localStorage persistence across reload |
| `train-from-score.spec.ts` | 11 | **KEEP** | Most comprehensive integration test: score file upload → WASM parse → exercise start; multi-plugin, real assets |
| `train-view.spec.ts` | 6 | **KEEP** | Navigation smoke test; reference test for the practice-view-plugin equivalent |
| `train-virtual-keyboard.spec.ts` | 13 | **KEEP** | In-plugin VK toggle interaction, exercise input routing via VK; multi-component |

**CONVERT equivalents needed** (before deleting the 4 e2e files):
- `m21-flat-check`: unit test on `convertScoreToLayoutFormat()` in `frontend/src/` — given mock `LayoutJSON` with `has_explicit_accidental: true`, assert the WASM input has the field set
- `nocturne-m2-staccato`: Rust backend test (already has the pattern in `nocturne_m29_m37_test.rs`) — assert `notation_dots[*].y < notehead.y` in layout output
- `nocturne-m29-m37`: Rust backend — assert glyph char codes and 8va bracket fields in layout JSON
- `nocturne-m36-stem`: Rust backend — assert `stem_up: true` for notes 8–15 of M36

### Rationale (retention criteria)
Tests are kept when they satisfy **two or more** of:
1. Requires a real browser (storage lifecycle, locale, HTTP, audio context)
2. Exercises multi-component interaction (plugin A → plugin B, host ↔ plugin)
3. Guards an integration regression that could not be caught by a unit test alone

---

## R-002 — Practice Plugin E2E: Selectors & Test Shape

### Decision
Use CSS class selectors and ARIA roles; no new `data-testid` attributes needed for the 4 initial scenarios. Add `data-testid="practice-plugin-root"` to `PracticeViewPlugin.tsx` root `<div>` to align with project conventions.

### Key Selectors Identified

| Selector | Element | Purpose |
|----------|---------|---------|
| `page.getByRole('button', { name: /practice/i })` | Landing screen button | Navigate to practice plugin |
| `[data-testid="practice-plugin-root"]` | Root div of active plugin | Assert plugin is visible (to be added) |
| `.practice-plugin.practice-plugin--selection` | Selection wrapper | Assert ScoreSelector state (no score loaded) |
| `.practice-plugin` | Plugin root | Assert plugin rendered |
| `role="toolbar"` + `aria-label` | PracticeToolbar | Toolbar presence |
| `role="alert"` + `.practice-plugin__no-midi-notice` | No-MIDI notice | Assert no-MIDI state |
| `aria-label` containing `back` | Back button in toolbar | Back navigation |

### Test Shape (4 scenarios)

```
practice-view-plugin.spec.ts
  describe: 'Feature 076: Practice View Plugin E2E'
    beforeEach: goto('/'), waitForLoadState
    test SC-001: Practice button visible on landing screen
    test SC-002: Clicking Practice navigates to practice plugin view
    test SC-003: Back button returns to landing screen
    test SC-004: No-MIDI notice shown when practice started with no MIDI device
```

**SC-004 detail**: Requires:
1. Inject no-MIDI mock via `page.addInitScript()`
2. Load a default score (click a preloaded score from ScoreSelector)
3. Click the Practice / Start button in the toolbar
4. Assert `[role="alert"]` / `.practice-plugin__no-midi-notice` is visible

### Score Pre-selection for Tests
Per clarification: a score must be pre-loaded before the practice plugin renders the main view. Tests load a score by clicking a preloaded score entry after clicking Practice (the plugin renders `ScoreSelector` first — same as Train/Play flow). No fixture seeding needed for basic scenarios.

---

## R-003 — Web MIDI API Mock for Playwright

### Decision
Inject a browser-side mock via `page.addInitScript()` in a shared Playwright fixture. The existing `src/test/mockMidi.ts` is Vitest-only (uses `vi.fn()`). A new Playwright-specific file `frontend/e2e/fixtures/webMidiMock.ts` will export a serialisable inline script string.

### Approach

```typescript
// frontend/e2e/fixtures/webMidiMock.ts
// Returns a script string suitable for page.addInitScript()

export function buildNoMidiScript(): string {
  return `
    Object.defineProperty(navigator, 'requestMIDIAccess', {
      value: () => Promise.resolve({
        inputs: new Map(),
        outputs: new Map(),
        sysexEnabled: false,
        onstatechange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
      writable: true,
      configurable: true,
    });
  `;
}

export function buildMidiConnectedScript(deviceName = 'Test MIDI Device'): string {
  // Returns a script string with one fake connected input device
  return `...`;
}
```

**Usage in tests:**
```typescript
test.beforeEach(async ({ page }) => {
  await page.addInitScript(buildNoMidiScript()); // inject before page loads
  await page.goto('/');
});
```

**Why not reuse `mockMidi.ts`**: Playwright `addInitScript()` runs in the browser context — it cannot use Node/Vitest imports. The inline script must be serialisable JS strings or functions without module dependencies.

### Alternatives Considered
- **Playwright `browser context` route intercept**: not applicable (MIDI is a browser API, not HTTP)
- **Reuse `mockMidi.ts` with a build step**: over-engineered; the mock is 5 lines of vanilla JS
- **Skip MIDI tests entirely**: rejected per FR-006 (CI must be able to test MIDI-connected paths for practice plugin)

---

## R-004 — External Plugin E2E: Test Location and Playwright Config Pattern

### Decision
Each external plugin owns its own `e2e/` folder and `playwright.config.ts`. The config references the host app's Vite dev server, which must be started separately (or reused). Plugin's `dist/` must be pre-built before tests run.

### Plugin Loading Strategy in Tests
External plugins are stored in IndexedDB (via `PluginRegistry` — `plugin-registry` DB, `manifests` + `assets` stores). The e2e smoke tests seed IndexedDB before the React app initialises using `page.addInitScript()`:

```typescript
// Before page.goto():
await page.addInitScript(async () => {
  const openDB = () => new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('plugin-registry', 1);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  // Seed manifest + asset (index.js content injected as a string from test setup)
  // ...
}, { manifest: pluginManifest, jsContent: pluginJsText });
```

However, since `addInitScript` cannot read Node filesystem, the test runner reads `dist/index.js` in Node context and passes the content as a serialisable parameter to the page:

```typescript
// In the test file (Node context):
import { readFileSync } from 'fs';
const jsContent = readFileSync('dist/index.js', 'utf-8');
await page.addInitScript(seedPlugin, { manifest, jsContent });
```

### Playwright Config Skeleton (per plugin)

```typescript
// plugins-external/sessions-plugin/e2e/playwright.config.ts
export default defineConfig({
  testDir: '.',
  use: { baseURL: 'http://localhost:5174' },
  webServer: {
    command: 'cd ../../frontend && PLAYWRIGHT_TEST=1 npm run dev -- --port 5174',
    url: 'http://localhost:5174',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
```

### Alternatives Considered
- **Co-locate under `frontend/e2e/external-plugins/`** (Option A): Simpler CI (one Playwright run), but plugin authors must commit to the core frontend repo — rejected per clarification.
- **Top-level `tests/e2e-external/`** (Option C): Adds a new top-level directory with no clear ownership — rejected.
- **Each plugin serves its own dev server**: External plugins are not standalone apps; they require the host app context.

---

## R-005 — Baseline CI Timing

### Decision
Record a baseline timing run as the **first commit** of this feature, before any test changes. The baseline duration is committed to `frontend/e2e/AUDIT.md`.

### Measurement Protocol
Run: `cd frontend && time npx playwright test --workers=1 2>&1 | tail -3`  
Record: wall-clock seconds, number of tests passed, Playwright's reported duration.  
Commit the result to the `Baseline` section of `AUDIT.md`.

---

## R-006 — Constitution Check Post-Design (Re-evaluation)

All 7 principles remain PASS after Phase 1 design. Specifically:
- **Principle V** (Test-First): The 4 CONVERT test files will have their replacement unit/backend tests written BEFORE the e2e tests are deleted.
- **Principle VI** (Layout Engine Authority): CONVERT classification of the 3 nocturne SVG-coordinate tests reinforces this principle — SVG coordinate assertions move to Rust backend tests where they belong.
- **Principle VII** (Regression Prevention): The `AUDIT.md` rationale for each REMOVE/CONVERT captures the regression risk, satisfying the "permanent prevention" requirement.

**Gate result**: PASS — proceed to implementation.
