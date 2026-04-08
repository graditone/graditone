# Data Model: E2E Test Coverage Review

**Feature**: `076-review-e2e-tests`  
**Phase**: 1 — Design  
**Date**: 2026-04-07

---

## Entities

### 1. E2E Test Case

A single `test()` function inside a Playwright spec file.

| Field | Type | Description |
|-------|------|-------------|
| `file` | `string` | Spec filename (e.g. `train-view.spec.ts`) |
| `name` | `string` | Test name string |
| `classification` | `'KEEP' \| 'CONVERT' \| 'REMOVE'` | Audit decision |
| `rationale` | `string` | Written justification for the classification |
| `migration_target` | `string \| null` | For CONVERT: path to replacement test (unit or Rust) |

---

### 2. Audit Catalogue (`frontend/e2e/AUDIT.md`)

The single source of truth for the test audit. Structure:

```markdown
# E2E Test Audit — Feature 076

## Baseline
- Run date: YYYY-MM-DD
- Playwright version: X.Y.Z
- Total tests: 65
- Duration: Xs (wall clock, 1 worker)

## Classification

### KEEP (N tests)
| File | Test | Rationale |
| ... |

### CONVERT (N tests)
| File | Test | Replacement target | Rationale |
| ... |

### REMOVE (N tests)
<!-- none at initial audit -->
```

---

### 3. Web MIDI Playwright Fixture

A test fixture encapsulating the no-MIDI and connected-MIDI browser-side stubs.

```typescript
// frontend/e2e/fixtures/webMidiMock.ts
export function buildNoMidiScript(): string          // navigator.requestMIDIAccess → empty inputs
export function buildMidiConnectedScript(name?: string): string  // → one fake device in inputs
```

No state machine needed — both scripts are pure inline JS strings injected before `page.goto()`.

---

### 4. External Plugin Smoke Test Structure

Per plugin (repeated for `sessions-plugin` and `virtual-keyboard-pro`):

```
plugins-external/<name>/e2e/
├── playwright.config.ts       # References host app dev server; reuseExistingServer: true
└── <name>.smoke.spec.ts       # 1 describe block, 2–3 test cases
```

Spec shape:
```typescript
test.describe('<Plugin Name> smoke', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Read dist/index.js (Node context) → pass as param
    // 2. page.addInitScript(seedPlugin, { manifest, jsContent })
    // 3. page.goto('/')
    // 4. page.waitForLoadState('domcontentloaded')
  });

  test('plugin panel renders without errors', async ({ page }) => { ... });
  test('back navigation returns to landing screen', async ({ page }) => { ... });
});
```

---

### 5. Practice Plugin Root Selector

`PracticeViewPlugin.tsx` root `<div>` receives `data-testid="practice-plugin-root"` (added as part of this feature).  
States:
- `practice-plugin--selection` class: ScoreSelector shown, no score loaded
- base `practice-plugin` class: score loaded, toolbar + renderer visible
- `practice-plugin--phantom`: phantom tempo active

---

## State Transitions (Practice Plugin)

```
Landing screen
  ↓ click Practice
ScoreSelector (practice-plugin--selection)
  ↓ click a score entry
Practice main view (toolbar + score renderer)
  ↓ click Practice/Start
Practice active (practiceRunning=true)
  • no MIDI: role="alert" notice visible
  • MIDI connected: note display active
  ↓ click Back
Landing screen
```

---

## Validation Rules

- Every test classified CONVERT must have its `migration_target` filled in `AUDIT.md` before the e2e file is deleted.
- `frontend/e2e/AUDIT.md` must contain the baseline timing record before any test file modification.
- External plugin `e2e/playwright.config.ts` must use `reuseExistingServer: true` so parallel local dev is not disrupted.
- Plugin dist must be built (verify `dist/index.js` exists) before the smoke test suite is run; the `playwright.config.ts` may add a `prebuild` step.
