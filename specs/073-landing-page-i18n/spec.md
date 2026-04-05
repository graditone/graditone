# Feature Specification: Landing Page Internationalization (i18n)

**Feature Branch**: `073-landing-page-i18n`  
**Worktree**: `../worktrees/073-landing-page-i18n`  
**Created**: 2026-04-05  
**Status**: Draft  
**Input**: User description: "add i18n support to the landing page and support EN and ES initially"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Spanish-Speaking User Sees Native Language (Priority: P1)

A Spanish-speaking user visits Graditone on a device or browser configured with Spanish as the preferred language. All visible text on the landing page, install prompts, error states, and offline banner appears in Spanish without any manual action.

**Why this priority**: This is the core deliverable — the fundamental value of i18n is that users automatically get their language. Everything else builds on this.

**Independent Test**: Can be fully tested by loading the app in a browser with `es` as the preferred language and verifying all landing page text renders in Spanish.

**Acceptance Scenarios**:

1. **Given** a browser with language preference set to Spanish (`es`), **When** the user loads the Graditone landing page, **Then** all visible text (slogan, install prompts, error messages, offline banner) is displayed in Spanish.
2. **Given** a browser with language preference set to Spanish (`es-MX` or `es-AR`), **When** the user loads the landing page, **Then** the generic Spanish (`es`) translations are used as a fallback.
3. **Given** a browser with language preference set to English, **When** the user loads the landing page, **Then** all visible text is displayed in English (unchanged from current behavior).

---

### User Story 2 - Unsupported Language Falls Back to English (Priority: P2)

A user whose browser language is neither English nor Spanish (e.g., French, German, Japanese) visits the app. They see all landing page content in English rather than untranslated keys or blank text.

**Why this priority**: Graceful degradation preserves the experience for the majority of current users while the supported language set is still small.

**Independent Test**: Can be fully tested by loading the app with an unsupported browser locale (e.g., `fr`) and verifying English text renders throughout.

**Acceptance Scenarios**:

1. **Given** a browser configured with an unsupported language (e.g., French), **When** the user loads the landing page, **Then** all text is displayed in English.
2. **Given** the translation key for a string is missing in the Spanish catalog, **When** a Spanish-language user encounters that string, **Then** the English version of the string is displayed rather than a raw key or blank space.

---

### User Story 3 - All Landing Page Surfaces Are Translated (Priority: P2)

Every user-facing text surface on the landing page area is covered by the translation system: page title, meta description, loading state, WASM error states, install modals (iOS and Android), offline banner, and accessibility labels (aria-labels).

**Why this priority**: Partial translation creates an inconsistent, unprofessional experience. All surfaces must be covered as part of the initial rollout.

**Independent Test**: Can be fully tested by switching to Spanish and systematically verifying each surface: loading spinner, error card, iOS modal, Android banner, offline banner, and aria-labels via accessibility tree inspection.

**Acceptance Scenarios**:

1. **Given** a Spanish browser, **When** the music engine fails to load, **Then** the error card (title, body copy, details toggle) is displayed in Spanish.
2. **Given** a Spanish browser on an iOS device where install is available, **When** the iOS install modal appears, **Then** all modal copy and button labels are in Spanish.
3. **Given** a Spanish browser on an Android device where install is available, **When** the Android install banner appears, **Then** all banner copy, CTA link, and dismiss button label are in Spanish.
4. **Given** a Spanish browser with no network connection, **When** the app renders the offline banner, **Then** the offline message is in Spanish.
5. **Given** any browser locale, **When** a screen reader inspects interactive elements on the landing page, **Then** all `aria-label` values are in the user's language.

---

### User Story 4 - Adding a New Language Is Straightforward (Priority: P3)

A contributor or maintainer can add a third language (e.g., French) by creating a single translation catalog file without touching any component code.

**Why this priority**: Extensibility ensures the initial investment pays forward. However, it is not required for the MVP to deliver value.

**Independent Test**: Can be fully tested by adding a French translation file, setting the browser to French, and verifying French text appears without any component changes.

**Acceptance Scenarios**:

1. **Given** only translation catalog files exist per language (no component changes), **When** a new language catalog is added and a browser with that language loads the app, **Then** the new language is displayed.
2. **Given** a new language catalog is incomplete (some keys missing), **When** a user with that language loads the app, **Then** English is used for any missing keys.

---

### Edge Cases

- What happens when the browser sends a complex locale tag (e.g., `zh-Hant-TW`)? → The system extracts the primary language subtag (`zh`) and falls back to English if unsupported.
- What happens when browser language detection is unavailable (e.g., server-side render or bot)? → English is used as the default.
- What happens if the translation catalog file fails to load (network error)? → Not applicable: catalogs are compiled into the JS bundle and load synchronously with the application. A catalog cannot fail independently of the bundle itself.
- What happens with the page `<title>` and `<meta description>` for SEO? → These are static HTML values set at build time; runtime locale detection applies only to visible UI strings. Dynamic `<title>` updates via JavaScript are out of scope.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST detect the user's preferred language from `navigator.language` at runtime (the primary BCP 47 tag reported by the browser/OS). Only the top-level language subtag (e.g., `es` from `es-MX`) is used for catalog selection.
- **FR-002**: When the detected language is Spanish (`es` or any `es-*` subtag), the system MUST display all landing page strings in Spanish.
- **FR-003**: When the detected language is English (`en` or any `en-*` subtag), or any language not explicitly supported, the system MUST display all landing page strings in English.
- **FR-004**: The system MUST translate all user-facing strings in the following surfaces:
  - Loading state ("Loading music engine...")
  - WASM/engine initialization error card (all headings, body copy, and the error details toggle)
  - App header slogan and Plugins button label and its accessible name
  - Landing screen pause/resume accessible labels
  - iOS install instructions modal (all body copy, headings, and button labels)
  - Android Play Store install banner (all copy, CTA, and dismiss button label)
  - Offline status banner
- **FR-005**: The system MUST use the English string as a fallback whenever a translation key is absent from the active language catalog.
- **FR-006**: Translation catalogs MUST be maintained as discrete JSON files — one per language — using a flat key-value structure where keys are dot-notation identifiers (e.g., `"errors.wasm.title"`) and values are the translated strings. Catalogs MUST be compiled into the JavaScript bundle at build time (no separate network request or async load at runtime).
- **FR-007**: Component source code MUST NOT contain language-specific conditional logic; all language switching MUST be handled by the translation infrastructure.
- **FR-008**: Adding a new language MUST require only adding a new translation catalog file (and registering it), with no changes to component code.
- **FR-009**: All translated strings used as ARIA labels MUST be applied through the same translation mechanism as visible text (no separate hardcoded accessibility strings).

### Key Entities

- **Translation Catalog**: A flat JSON file mapping dot-notation string identifiers to their translated text for a single language (e.g., `en.json`, `es.json`). One catalog exists per supported language. Keys are language-agnostic dot-notation identifiers (e.g., `"errors.wasm.title"`); values are the human-readable strings in that language.
- **Locale Preference**: The user's preferred language as declared by their browser/OS. Used at app initialization to select the active catalog. Stored as a BCP 47 language tag (e.g., `en`, `es`, `es-MX`).
- **Translation Key**: A stable, language-agnostic identifier for a specific user-facing string (e.g., `landing.slogan`, `errors.wasm.title`). Keys must not change once established; only catalog values change across languages.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of user-facing strings across all landing page surfaces (loading state, error states, install prompts, offline banner, accessible labels) have translations in both English and Spanish catalogs.
- **SC-002**: A Spanish-language user sees 0 English strings when browsing the landing page on a browser configured to Spanish.
- **SC-003**: A user with an unsupported browser language sees 0 untranslated keys or blank strings; English text appears throughout.
- **SC-004**: Adding a third language requires changes to at most 2 files (the new catalog file and a language registry/configuration entry) — 0 component file changes.
- **SC-005**: The translation mechanism adds no perceptible delay to landing page rendering (first contentful paint time remains within 200ms of baseline without translations). This is guaranteed by the inline-bundle delivery strategy (no asynchronous catalog load).
- **SC-006**: Language-switching correctness is validated by unit tests (mocked `navigator.language`) for each translatable component, plus one Playwright E2E smoke test that loads the app in Spanish and asserts key visible strings render in Spanish.

## Assumptions

- The page `<title>` tag and `<meta name="description">` are treated as static values set at build/deploy time and are out of scope for runtime locale switching.
- The debug-only "Instruments" button in the landing screen is a developer tool and does not require translation.
- "The open platform for musical practice" slogan is considered a landing page string and must be translated.
- Locale detection reads only the primary browser/OS language preference; there is no in-app language selector UI in this feature.
- The resolved locale is NOT persisted to `localStorage` or any other storage; `navigator.language` is read fresh on every page load to always reflect the current OS/browser setting.
- The Spanish translation catalog covers all `es-*` regional variants (Latin American Spanish, Castilian Spanish) via a single `es` catalog without regional differentiation.
- Translation catalogs for EN and ES cover approximately 30 short strings (~3–5 KB combined); the resulting bundle size increase is accepted as negligible.

## Clarifications

### Session 2026-04-05

- Q: How should translation catalogs be delivered — bundled inline, async pre-cached, or async with FOUC fallback? → A: Bundle inline — catalogs compiled into the JS bundle at build time (synchronous, no network dependency, no flash of untranslated content).
- Q: Which browser locale signal should be used for language detection — `navigator.language`, `navigator.languages[0]`, or `Accept-Language` header? → A: `navigator.language` — the primary browser/OS preferred locale, synchronous, works offline and on static hosting.
- Q: What format should translation catalog files use — JSON flat, JSON nested, TypeScript objects, or PO/POT? → A: JSON flat — dot-notation key strings mapping to translated values (e.g., `en.json`, `es.json`), natively typed, no build tooling required beyond the bundler.
- Q: Should the resolved locale be persisted across sessions — no persistence, or localStorage? → A: No persistence — `navigator.language` is read fresh on every load; OS/browser setting is always the source of truth.
- Q: How should i18n behavior be tested — unit + E2E smoke, E2E only, or unit only? → A: Unit + one E2E smoke — unit tests mock `navigator.language` per component; one Playwright test loads the app in Spanish and asserts key visible strings.

