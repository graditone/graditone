# Quickstart: E2E Test Coverage Review

**Feature**: `076-review-e2e-tests`  
**Date**: 2026-04-07

---

## What This Feature Delivers

1. **Practice plugin e2e tests** — `frontend/e2e/practice-view-plugin.spec.ts` (4 test cases)
2. **E2E audit catalogue** — `frontend/e2e/AUDIT.md` (all 65 existing tests classified)
3. **CONVERT replacements** — backend Rust tests + frontend unit tests replacing 4 low-value e2e specs
4. **External plugin smoke tests** — `plugins-external/sessions-plugin/e2e/` and `plugins-external/virtual-keyboard-pro/e2e/`
5. **Web MIDI Playwright fixture** — `frontend/e2e/fixtures/webMidiMock.ts`
6. **E2E approach guide** — `specs/076-review-e2e-tests/contracts/external-plugin-e2e-approach.md` (also to be published as `docs/e2e-external-plugins.md`)

---

## Running the Practice Plugin E2E Tests

```bash
cd frontend
PLAYWRIGHT_TEST=1 npx playwright test e2e/practice-view-plugin.spec.ts
```

Or run the full suite:

```bash
cd frontend
PLAYWRIGHT_TEST=1 npx playwright test
```

---

## Running the Full E2E Suite

```bash
cd frontend
npx playwright test       # dev (reuses existing server, opens HTML report)
CI=1 npx playwright test  # CI mode (starts server, workers=1, retries=2)
```

---

## Running External Plugin Smoke Tests

Each plugin runs independently. Build the plugin first:

```bash
# sessions-plugin
cd plugins-external/sessions-plugin
npm run build
npx playwright test --config=e2e/playwright.config.ts

# virtual-keyboard-pro
cd plugins-external/virtual-keyboard-pro
npm run build
npx playwright test --config=e2e/playwright.config.ts
```

Requires the host app dev server to be reachable at `http://localhost:5174`. Either start it manually:

```bash
cd frontend && PLAYWRIGHT_TEST=1 npm run dev -- --port 5174
```

Or let the plugin's Playwright config start it (`reuseExistingServer: true` means it will start the server if not already running).

---

## Adding a New E2E Test for the Practice Plugin

Follow the pattern in `frontend/e2e/train-view.spec.ts` and `frontend/e2e/practice-view-plugin.spec.ts`.

Key points:
- **Score pre-selection**: The practice plugin shows a `ScoreSelector` first. Tests that need the main practice view must click a score entry after opening the plugin.
- **No MIDI by default**: Inject `webMidiMock.buildNoMidiScript()` in `beforeEach` via `page.addInitScript()` so CI tests do not wait on MIDI permission dialogs.
- **MIDI-connected scenarios**: Use `webMidiMock.buildMidiConnectedScript()` to inject a fake device.

---

## Adding a New External Plugin Smoke Test

See `specs/076-review-e2e-tests/contracts/external-plugin-e2e-approach.md` for the full guide.

Quick checklist:
1. Create `plugins-external/<name>/e2e/playwright.config.ts` (copy from template in the guide)
2. Create `plugins-external/<name>/e2e/<name>.smoke.spec.ts` (copy from template)
3. Update `plugin.json` fields in the test's `PLUGIN_MANIFEST` constant
4. Run `npm run build` in the plugin dir before testing

---

## Viewing the Test Audit Catalogue

```bash
cat frontend/e2e/AUDIT.md
```

The catalogue lists every test case, its classification (KEEP / CONVERT / REMOVE), and migration notes. The baseline CI timing is recorded in the `Baseline` section.

---

## Important Files

| File | Purpose |
|------|---------|
| `frontend/e2e/AUDIT.md` | All 65 tests classified; baseline timing |
| `frontend/e2e/practice-view-plugin.spec.ts` | New practice plugin e2e scenarios |
| `frontend/e2e/fixtures/webMidiMock.ts` | Playwright Web MIDI API mock helper |
| `plugins-external/sessions-plugin/e2e/` | Sessions plugin smoke tests |
| `plugins-external/virtual-keyboard-pro/e2e/` | VKP smoke tests |
| `specs/076-review-e2e-tests/contracts/external-plugin-e2e-approach.md` | Guide for plugin authors |
