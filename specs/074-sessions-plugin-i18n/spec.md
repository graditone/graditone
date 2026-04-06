# Feature Specification: Sessions Plugin Internationalization (i18n)

**Feature Branch**: `074-sessions-plugin-i18n`  
**Worktree**: `../worktrees/074-sessions-plugin-i18n`  
**Created**: 2026-04-06  
**Status**: Draft  
**Input**: User description: "add i18n support to sessions plugin external. Follow how i18n has been implemented for core plugins. Update the plugins development doc to include i18n."

## Clarifications

### Session 2026-04-06

- Q: Is the SessionsGuide prose content (paragraph-length help text) in scope for translation, or UI strings only? → A: Guide prose included — all in-plugin help text and SessionsGuide content is fully translated as part of this feature.
- Q: How should the active locale be shared within the plugin — React context provider at the plugin root, or per-component detection? → A: React context provider — a LocaleProvider wraps the plugin root; all child components call useTranslation() which reads from context.
- Q: Should the i18n implementation include automated tests (locale switching, catalog completeness) or is manual verification sufficient? → A: Automated tests required — unit/component tests verify locale switching behavior and that no catalog key is missing from the Spanish catalog.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Spanish-Speaking User Sees Sessions Plugin in Spanish (Priority: P1)

A Spanish-speaking user opens the Sessions plugin on a device or browser configured with Spanish as the preferred language. All visible text in the plugin — loading states, section headings, action buttons, form labels, confirmation dialogs, and accessibility labels — appears in Spanish without any manual action.

**Why this priority**: This is the core deliverable. Every other story depends on translations existing and being correctly wired into the plugin. Without this, no i18n value is delivered.

**Independent Test**: Can be fully tested by loading the app with a Spanish browser locale, opening the Sessions plugin, and verifying all visible text (including empty states, toolbar labels, and button text) is in Spanish.

**Acceptance Scenarios**:

1. **Given** a browser with language preference set to Spanish (`es`), **When** the user opens the Sessions plugin, **Then** all visible interface text (headings, buttons, labels, empty states, loading indicators) is displayed in Spanish.
2. **Given** a browser with a regional Spanish variant (`es-MX`, `es-AR`), **When** the user opens the Sessions plugin, **Then** the generic Spanish translations are used as a fallback for the full locale tag.
3. **Given** a browser with language preference set to English, **When** the user opens the Sessions plugin, **Then** all visible text is displayed in English (unchanged from current behavior).

---

### User Story 2 - All Sessions Plugin Surfaces Are Translated (Priority: P1)

Every user-facing text surface within the Sessions plugin is covered by the translation system: loading states, toolbar titles, view headings, empty-state messages, button labels, confirmation dialog copy, form field labels and placeholders, error messages, and all aria-labels for accessibility.

**Why this priority**: Partial translation produces an inconsistent experience. All text surfaces must be covered together — a partially translated plugin is still a broken plugin from a user perspective.

**Independent Test**: Can be fully tested by switching to Spanish locale and verifying each distinct screen and state in the plugin: sessions list, goals view, calendar view, task builder, creation forms, overlays, and confirmation dialogs.

**Acceptance Scenarios**:

1. **Given** a Spanish browser, **When** the sessions list is empty, **Then** the empty-state message is displayed in Spanish.
2. **Given** a Spanish browser, **When** the user opens the Goals view, **Then** all goal-related labels, buttons, and section headings are in Spanish.
3. **Given** a Spanish browser, **When** the user opens the Calendar view, **Then** day names, month names, period labels, and all overlay text are in Spanish.
4. **Given** a Spanish browser, **When** the user initiates a delete or confirmation action, **Then** the confirmation dialog text and action buttons are in Spanish.
5. **Given** any browser locale, **When** a screen reader inspects interactive elements in the Sessions plugin, **Then** all `aria-label` values are in the user's language.

---

### User Story 3 - Unsupported Language Falls Back to English (Priority: P2)

A user whose browser language is not English or Spanish (e.g., French, German, Japanese) opens the Sessions plugin. They see all plugin content in English rather than untranslated keys or blank text.

**Why this priority**: Graceful fallback preserves usability for all users while the supported language set is small.

**Independent Test**: Can be fully tested by loading the app with an unsupported browser locale (e.g., `fr`) and verifying the Sessions plugin renders entirely in English with no missing or raw translation keys.

**Acceptance Scenarios**:

1. **Given** a browser configured with an unsupported language (e.g., French), **When** the user opens the Sessions plugin, **Then** all text is displayed in English.
2. **Given** the Spanish translation catalog is missing a key, **When** a Spanish-language user encounters that string, **Then** the English version of the string is displayed rather than a raw key string or blank space.

---

### User Story 4 - Plugin Developer Can Follow Documented i18n Pattern (Priority: P3)

A plugin developer creating a new external plugin reads the updated plugin development documentation and can implement i18n in their plugin by following the described pattern — without needing to study the sessions plugin source code directly.

**Why this priority**: Documentation leverage multiplies the value of this feature across all future external plugins. It is not required for the sessions plugin itself to work, but is important for long-term maintainability.

**Independent Test**: Can be fully tested by following the documented steps from scratch to add i18n to a new plugin and verifying the locale-switching behavior works as described.

**Acceptance Scenarios**:

1. **Given** the updated plugin development documentation, **When** a developer follows the i18n section, **Then** they can add locale catalog files and a translation hook to their plugin without referencing any other source.
2. **Given** the documentation, **When** a developer adds a Spanish catalog file to a new plugin and opens it with a Spanish browser, **Then** Spanish text renders correctly.

---

### Edge Cases

- What happens when `navigator.language` is unavailable (e.g., server-side or bot context)? → English is used as the default locale.
- What happens when a sessions plugin locale catalog is missing a translation key? → The English value for that key is used as a fallback.
- What happens when a browser sends a complex locale tag (e.g., `zh-Hant-TW`)? → The primary language subtag (`zh`) is extracted; if unsupported, English is used.
- What happens with date and time formatting in the calendar view (month names, day names)? → These are included as entries in the locale catalog rather than relying on browser-specific date formatting, ensuring consistent rendering across all supported locales.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Sessions plugin MUST display all user-facing text in Spanish when the user's browser locale is set to Spanish (`es` or any `es-*` variant).
- **FR-002**: The Sessions plugin MUST display all user-facing text in English when the user's browser locale is set to English or any unsupported language.
- **FR-003**: The Sessions plugin MUST include a self-contained English locale catalog covering every user-facing string in the plugin (headings, buttons, labels, empty states, loading states, confirmation dialogs, error messages, and aria-labels).
- **FR-004**: The Sessions plugin MUST include a self-contained Spanish locale catalog that provides a translation for every key in the English catalog.
- **FR-005**: The Sessions plugin MUST resolve the user's locale from the browser's language preference using the same primary-subtag extraction logic as the core app (Feature 073): extract the primary language subtag from the BCP-47 tag and fall back to English if not supported.
- **FR-006**: If a translation key is missing from the Spanish catalog, the Sessions plugin MUST fall back to the English value for that key rather than displaying a raw key string or blank text.
- **FR-007**: All hardcoded user-facing strings currently in the Sessions plugin components MUST be replaced with calls to the plugin's translation function. This includes all prose content in the `SessionsGuide` component (paragraph-length help text) in addition to functional UI strings (labels, buttons, headings, confirmations, empty states, and aria-labels).
- **FR-008**: The plugin's locale detection and translation logic MUST be self-contained within the sessions plugin bundle — no imports from the host app's i18n module are permitted, in line with the Plugin API boundary constraint.
- **FR-009**: The plugins development documentation (PLUGINS.md) MUST be updated with a dedicated i18n section describing the pattern for adding internationalization to an external plugin.
- **FR-010**: The Sessions plugin's i18n implementation MUST follow the same structural pattern used in the core app: locale catalog JSON files, a locale resolver function, and a `useTranslation`-style hook.
- **FR-011**: The Sessions plugin MUST use a React context provider (`LocaleProvider`) wrapping its root component to share the resolved locale with all child components. Individual components MUST obtain translations via `useTranslation()` rather than reading `navigator.language` independently.
- **FR-012**: The Sessions plugin MUST include automated tests that verify: (a) the locale resolver correctly maps supported and unsupported BCP-47 tags, (b) components render in Spanish when the locale is `es`, (c) components fall back to English when the locale is unsupported, and (d) the Spanish catalog contains a value for every key present in the English catalog.

### Key Entities

- **Locale Catalog**: A JSON file mapping dot-namespaced string keys (e.g., `"sessions.loading"`) to their translated values for a single language. One catalog file per supported language.
- **Locale Resolver**: A function that maps a raw BCP-47 browser language tag to one of the plugin's supported locales, falling back to English for unsupported tags.
- **Translation Hook**: A React hook (e.g., `useTranslation`) that accepts a translation key and optional interpolation parameters (e.g., `{name}`, `{count}`), returning the translated string for the active locale.
- **LocaleProvider**: A React context provider component that resolves the user's locale once at mount (from `navigator.language`) and makes it available to the entire plugin component tree via context.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of user-facing strings in the Sessions plugin are covered by the locale catalog — no hardcoded English text remains in any rendered component. Verified by automated catalog-completeness tests.
- **SC-002**: A user with a Spanish browser locale sees 100% of Sessions plugin text in Spanish, with no visible English strings in normal plugin use.
- **SC-003**: A user with an unsupported browser locale sees 100% of Sessions plugin text in English — no raw translation keys or blank fields appear.
- **SC-004**: The PLUGINS.md development guide includes a complete, self-contained i18n section that a developer can follow to add locale support to a new external plugin without consulting any other source.
- **SC-005**: Adding a third language to the Sessions plugin requires adding one new locale catalog file and one registry update in `i18n.ts` (adding the locale code to `SUPPORTED_LOCALES` and the catalog import to the `catalogs` object) — no component code changes are required.

## Assumptions

- The two supported locales for this feature are English (`en`) and Spanish (`es`), matching the core app's initial i18n scope (Feature 073).
- The sessions plugin resolves the user's locale from `navigator.language` once at mount inside a `LocaleProvider` component, then distributes the resolved locale to all child components via React context. It does not receive the host app's active locale through the Plugin API.
- Calendar-specific strings (day names, month names, period labels) are included in the sessions plugin's locale catalog rather than delegated to the browser's date formatting, ensuring consistent rendering across supported locales.
- The Plugin API boundary rule (no imports outside `frontend/src/plugin-api/index.ts`) means the sessions plugin must bundle its own i18n implementation rather than importing from the host's `frontend/src/i18n/` module.
- The documentation update targets PLUGINS.md (the main plugin development guide). The plugin-system.md architectural reference doc is out of scope.
- The `SessionsGuide` prose content is in scope for translation. Both the English and Spanish locale catalogs must include translations for all guide text in addition to functional UI strings.

