# Feature Specification: E2E Test Coverage Review

**Feature Branch**: `076-review-e2e-tests`  
**Worktree**: `../worktrees/076-review-e2e-tests`  
**Created**: 2026-04-07  
**Status**: Complete  
**Input**: User description: "Review e2e tests. The practice plugin does not have e2e tests. And we need to review if all our e2e tests are really needed. And we need to define an approach for e2e in the plugins external."

## Context

The project currently has 65 e2e test cases (spread across multiple spec files) under `frontend/e2e/`. These tests cover the Train plugin, Play Score plugin, several layout regression checks, and some cross-cutting concerns (i18n, metronome). However:

1. **The `practice-view-plugin`** — the MIDI-based in-browser practice mode — has zero e2e tests despite being a primary user journey.
2. **Several e2e tests** verify highly specific SVG layout details (staccato dot placement, stem positions, accidental glyphs) that may be more appropriate as unit or backend tests.
3. **External plugins** (`sessions-plugin`, `virtual-keyboard-pro`) under `plugins-external/` have only self-contained unit tests and no tests verifying integration with the host application.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Practice Plugin E2E Smoke Coverage (Priority: P1)

A developer needs confidence that the practice-view-plugin loads, initialises, and responds to basic navigation correctly in a real browser. Currently there is no e2e test protecting against regressions in the practice plugin entry point, back navigation, or the "no MIDI device" state that any user without a controller encounters first.

**Why this priority**: The practice plugin represents a core differentiating feature. Having no e2e tests means any regression in plugin launch, back navigation, or the hardware-absent state goes undetected until manual QA.

**Independent Test**: Can be tested by launching the app, clicking the Practice button, observing the plugin view renders, and confirming back navigation returns to the landing screen — all without a MIDI device connected.

**Acceptance Scenarios**:

1. **Given** the app is open at the landing screen and a score is pre-loaded, **When** the user clicks the Practice button, **Then** the practice plugin view becomes visible.
2. **Given** the practice plugin is open and no MIDI device is connected, **When** the plugin finishes initialising, **Then** a "no MIDI device" or equivalent waiting/prompt state is shown (not a crash or blank screen).
3. **Given** the practice plugin is open, **When** the user clicks the Back button, **Then** the landing screen is restored and the practice plugin is no longer visible.
4. **Given** the practice plugin is open, **When** the user navigates away and back, **Then** no critical console errors are reported.

---

### User Story 2 — E2E Test Audit and Rationalisation (Priority: P2)

A developer needs a clear, audited catalogue of the existing 65 e2e test cases so that tests with low e2e value (highly specific SVG pixel checks, single-element regression assertions that duplicate backend tests) can be removed, converted, or marked as intentionally kept.

**Why this priority**: Bloated e2e suites are slow, brittle, and expensive to maintain. Rationalising the suite pays dividends with every future CI run and reduces onboarding friction.

**Independent Test**: Can be validated by producing a reviewed catalogue where every test is classified (KEEP / CONVERT / REMOVE) with rationale, low-value tests are migrated or deleted, and the suite still provides meaningful coverage.

**Acceptance Scenarios**:

1. **Given** the existing 65 e2e test cases, **When** each is reviewed against retention criteria (requires real browser, multi-component interaction, cannot be replicated by a unit test), **Then** each test case is labelled KEEP, CONVERT, or REMOVE with written rationale in `frontend/e2e/AUDIT.md`.
2. **Given** tests classified as CONVERT, **When** the migration is complete, **Then** equivalent unit or integration test coverage exists and the e2e test is deleted.
3. **Given** tests classified as REMOVE (no longer testing a live feature or already covered elsewhere), **When** removed, **Then** the CI suite still passes and coverage does not regress for retained scenarios.
4. **Given** the rationalised suite, **When** run in CI, **Then** total execution time is documented and no new flakiness is introduced.

---

### User Story 3 — E2E Approach for External Plugins (Priority: P3)

A developer or plugin author needs a documented and implemented strategy for e2e-testing plugins in `plugins-external/` (`sessions-plugin` and `virtual-keyboard-pro`). These plugins are loaded by the host app and currently have no browser-level integration test.

**Why this priority**: A unit test inside the plugin repo cannot verify that the host correctly loads, mounts, and communicates with the plugin. Any integration-level regression is invisible until reported by users.

**Independent Test**: Can be tested by running a smoke test that loads the host app with the plugin registered, confirms the plugin panel is visible, and verifies no critical errors appear.

**Acceptance Scenarios**:

1. **Given** the host app with `sessions-plugin` registered, **When** the user opens the Sessions view, **Then** the plugin panel renders without errors.
2. **Given** the host app with `virtual-keyboard-pro` registered, **When** the user opens the Virtual Keyboard Pro view, **Then** the plugin panel renders and basic interaction is possible without crashing.
3. **Given** a new external plugin is developed, **When** the developer follows the documented e2e approach, **Then** they can add a smoke test for their plugin without modifying core frontend test infrastructure.
4. **Given** the e2e approach document exists, **When** a reviewer reads it, **Then** they can explain what test scenarios are required for any new external plugin, how to run them, and how MIDI/audio is handled in CI.

---

### Edge Cases

- What happens when the practice plugin is launched but the browser blocks MIDI permissions? (Expected: graceful prompt or waiting state — not crashed)
- How should e2e tests handle the countdowns in Train/Practice flows without adding excessive fixed waits?
- External plugin tests depend on the plugin's built `dist/` artefact — what is the correct build/reload sequence in CI?
- What happens when an e2e test protecting a regression scenario is deleted if the regression resurfaces? (Answer must be captured in the KEEP / REMOVE rationale)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The e2e suite MUST include at least three test scenarios covering the practice-view-plugin: launch from landing screen, back navigation, and no-MIDI-device state.
- **FR-002**: Each of the 65 existing e2e test cases MUST be reviewed and assigned a classification of KEEP, CONVERT, or REMOVE with written rationale stored in `frontend/e2e/AUDIT.md`.
- **FR-003**: Tests classified as CONVERT MUST have equivalent unit or integration test coverage in place before their e2e test is deleted.
- **FR-004**: The project MUST have a written e2e approach document for external plugins, covering: when an e2e test is required, how to structure it (under `plugins-external/<plugin-name>/e2e/` with its own Playwright config), how to handle MIDI/audio absence in CI, and how to reference the plugin's built artefact.
- **FR-005**: At least one smoke e2e test MUST exist for each external plugin currently in `plugins-external/` (`sessions-plugin` and `virtual-keyboard-pro`). Each test MUST reside at `plugins-external/<plugin-name>/e2e/` and use the plugin's own Playwright config.
- **FR-006**: MIDI hardware interactions in practice plugin e2e tests MUST be handled by injecting a mock Web MIDI API (fake device) so that both the "no device" state and MIDI-connected note-input paths can be exercised in CI without physical hardware.
- **FR-007**: The final e2e suite MUST continue to pass on CI after all changes.
- **FR-008**: Before any test is removed, converted, or added, a baseline CI timing run MUST be executed and its duration recorded in `frontend/e2e/AUDIT.md`. The post-rationalisation CI runtime MUST NOT exceed this baseline.

### Key Entities

- **E2E test file**: A Playwright spec file in `frontend/e2e/`. Each file targets one feature or regression scenario.
- **Practice plugin**: The `practice-view-plugin` internal plugin providing MIDI-based note-by-note practice mode.
- **External plugin**: A standalone plugin bundle in `plugins-external/` loaded dynamically by the host application.
- **Audit catalogue**: `frontend/e2e/AUDIT.md` — a committed Markdown file classifying each of the 65 existing e2e test cases (KEEP / CONVERT / REMOVE) with rationale and migration notes.
- **E2E approach document**: A written guide for external plugin authors specifying testing standards, tooling, and CI constraints.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The practice-view-plugin has at least 3 passing e2e scenarios covering its primary user journeys.
- **SC-002**: 100% of existing 65 e2e test cases have a documented classification (KEEP / CONVERT / REMOVE) with rationale in `frontend/e2e/AUDIT.md` committed to the repository.
- **SC-003**: No e2e test is removed without equivalent coverage being confirmed in unit or integration tests first.
- **SC-004**: Each external plugin in `plugins-external/` has at least one passing e2e smoke test running in CI.
- **SC-005**: The e2e approach document is present and a first-time reader can follow it to add a smoke test for a new external plugin without further assistance.
- **SC-006**: After rationalisation, total CI e2e runtime does not exceed the pre-audit baseline duration recorded in `frontend/e2e/AUDIT.md` before any test changes were made.

## Assumptions

- The practice-view-plugin is accessible from the landing screen via a dedicated button (similar to Play and Train). A score must be pre-selected before entering the practice plugin; e2e tests MUST load a fixture score prior to clicking the Practice button.
- MIDI device events are handled in CI by injecting a mock Web MIDI API (fake device); both the no-MIDI state and MIDI-connected flows are testable without physical hardware.
- The host app can be configured to load external plugins from their local `dist/` directory during test runs.
- External plugin e2e tests reside at `plugins-external/<plugin-name>/e2e/` and each plugin maintains its own Playwright configuration; CI must invoke each plugin's test suite independently.
- Existing regression e2e tests that verify specific SVG glyph coordinates are strong candidates for CONVERT, since the backend already provides layout unit tests and the frontend can validate rendering via unit tests against fixture SVGs.

## Clarifications

### Session 2026-04-07

- Q: Where should external plugin e2e tests live? → A: `plugins-external/<plugin-name>/e2e/` — each plugin owns its own e2e folder and Playwright config
- Q: Does opening the practice plugin require a score to be pre-selected? → A: Score required before entry
- Q: How should e2e tests handle MIDI absence in CI? → A: Mock Web MIDI API (inject a fake device) — CI can run MIDI-connected test paths
- Q: Where should the audit catalogue be stored? → A: `frontend/e2e/AUDIT.md` — Markdown file committed alongside the test files
- Q: How should the SC-006 runtime baseline be established? → A: Record a timing baseline run before any test changes; commit the number to `frontend/e2e/AUDIT.md`

