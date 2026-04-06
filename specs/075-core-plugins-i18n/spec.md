# Feature Specification: Complete i18n for Internal Core Plugins

**Feature Branch**: `075-core-plugins-i18n`
**Worktree**: `../worktrees/075-core-plugins-i18n`
**Created**: 2026-04-06
**Status**: Draft
**Input**: User description: "Complete i18n for internal core plugins. There are some missing strings that need translations in the plugins inside the platform. Let's review all of them in order to translate 100% of the messages."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Spanish-speaking user browses all plugins (Priority: P1)

A Spanish-speaking user opens the application with their browser language set to Spanish. They navigate through every internal plugin — play-score, train-view, practice-view, sessions, guide, and virtual-keyboard — and see all user-facing text rendered in Spanish with no English fallback strings visible.

**Why this priority**: The core value of this feature is ensuring every piece of text across all internal plugins is translated. If even one plugin shows English strings to a non-English user, the experience feels incomplete and unprofessional.

**Independent Test**: Can be tested by switching the browser language to Spanish (es), navigating to each plugin in sequence, and verifying that every label, button, tooltip, heading, empty state message, and status text appears in Spanish.

**Acceptance Scenarios**:

1. **Given** the browser language is set to Spanish, **When** the user opens the play-score plugin, **Then** all UI text (toolbar labels, score selection headings, file load buttons, tempo label) is displayed in Spanish
2. **Given** the browser language is set to Spanish, **When** the user opens the train-view plugin, **Then** all UI text (level labels, difficulty options, tips, action buttons, result labels) is displayed in Spanish
3. **Given** the browser language is set to Spanish, **When** the user opens the practice-view plugin, **Then** all UI text (controls, session task labels, difficulty options, tempo label, results overlay) is displayed in Spanish
4. **Given** the browser language is set to Spanish, **When** the user opens the sessions plugin, **Then** all UI text (toolbar, tabs, action buttons, empty states, goal form labels) is displayed in Spanish
5. **Given** the browser language is set to Spanish, **When** the user opens the virtual-keyboard plugin, **Then** all UI text (title, action labels) is displayed in Spanish

---

### User Story 2 - Plugin navigation names are translated (Priority: P1)

A user with a non-English locale views the sidebar or navigation area where plugin names are listed. Every internal plugin name appears translated in the user's language rather than falling back to the raw manifest name.

**Why this priority**: Plugin names in the navigation are the first thing users see. Untranslated names (e.g., "sessions-plugin" instead of "Sesiones") break the illusion of a fully localized application.

**Independent Test**: Can be tested by switching locale to Spanish, opening the plugin navigation, and verifying that all six internal plugin entries show their translated display names.

**Acceptance Scenarios**:

1. **Given** the browser language is set to Spanish, **When** the user views the plugin navigation, **Then** the sessions plugin name is shown as its Spanish translated name instead of the raw manifest name
2. **Given** the browser language is set to Spanish, **When** the user views the plugin navigation, **Then** the virtual-keyboard plugin name is shown as its Spanish translated name instead of the raw manifest name

---

### User Story 3 - English user experience remains unchanged (Priority: P2)

An English-speaking user navigates through all internal plugins and sees the same text labels they have always seen, with no regressions introduced by the internationalization work.

**Why this priority**: Ensuring the default English experience is unbroken is essential to avoid regressions for the majority of existing users.

**Independent Test**: Can be tested by using the application with the browser set to English, navigating all plugins, and confirming every label matches its expected English text.

**Acceptance Scenarios**:

1. **Given** the browser language is set to English, **When** the user navigates through all internal plugins, **Then** all UI text displays correctly in English with no missing or broken strings
2. **Given** the browser language is set to English, **When** the user views plugin navigation, **Then** all plugin names display their English labels correctly

---

### User Story 4 - Locale files have complete key parity (Priority: P2)

A developer inspecting the locale files (en.json and es.json) finds that every key present in the English file also exists in the Spanish file, and vice versa. There are no orphaned or missing keys in either locale.

**Why this priority**: Parity between locale files prevents runtime fallback issues and makes it easy to add future languages by using either file as a complete reference.

**Independent Test**: Can be tested by programmatically comparing the key sets in en.json and es.json and asserting they are identical.

**Acceptance Scenarios**:

1. **Given** the en.json and es.json locale files, **When** a developer compares the key sets, **Then** both files contain exactly the same set of translation keys
2. **Given** the locale files, **When** a developer searches for any hardcoded user-facing string in internal plugin source files, **Then** no untranslated hardcoded strings are found — all text uses translation keys

---

### Edge Cases

- What happens when a translation key is missing from the active locale? The system falls back to English gracefully rather than showing a raw key identifier.
- What happens when a plugin has dynamic text (e.g., interpolated values like counts or names)? The translation system must support parameterized strings so that translated text can include dynamic values in the correct grammatical position.
- What happens with very long translated strings? Spanish translations are often longer than English equivalents; UI layouts must accommodate varying text lengths without truncation or overflow.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: All user-facing text in the play-score plugin MUST use translation keys instead of hardcoded English strings — including toolbar labels (Play, Pause, Stop, Tempo), score selection screen headings ("PRELOADED SCORES", "Load from file"), and any status messages
- **FR-002**: All user-facing text in the train-view plugin MUST use translation keys — including level names, difficulty options (Low, Mid, High, Custom), tips text, action labels, and result overlay labels
- **FR-003**: All user-facing text in the practice-view plugin MUST use translation keys — including practice controls, session task labels, difficulty options (Easy, Medium, Hard), staff selection prompts, tempo label, and results overlay (Notes, Correct, Wrong)
- **FR-004**: All user-facing text in the sessions plugin MUST use translation keys — including toolbar labels, tab names, action buttons, empty state messages, and goal creation form labels and buttons
- **FR-005**: All user-facing text in the virtual-keyboard plugin MUST use translation keys — including the title, "Clear" button label, and "Staff" label
- **FR-006**: Navigation display names for sessions-plugin and virtual-keyboard MUST have translation keys in both locale files so they no longer fall back to raw manifest names
- **FR-007**: The English locale file (en.json) MUST contain entries for every new translation key introduced
- **FR-008**: The Spanish locale file (es.json) MUST contain entries for every new translation key introduced, with accurate Spanish translations
- **FR-009**: The guide plugin (already largely localized) MUST be audited to confirm 100% coverage — any remaining gaps MUST be filled
- **FR-010**: Existing translated strings MUST NOT be modified or removed unless correcting an error

### Key Entities

- **Translation Key**: A unique string identifier (e.g., `plugin.play-score.toolbar.play`) used in components to reference translatable text
- **Locale File**: A JSON file (en.json, es.json) mapping translation keys to their localized string values
- **Plugin Manifest**: A plugin.json file containing metadata including the plugin's default display name, which serves as a fallback when no translation key exists

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of user-facing strings across all six internal plugins (play-score, train-view, practice-view, sessions, guide, virtual-keyboard) use translation keys — zero hardcoded English strings remain in plugin component files
- **SC-002**: The English and Spanish locale files have identical key sets with no missing or orphan keys
- **SC-003**: All six internal plugin names appear correctly translated in the navigation area when the locale is set to Spanish
- **SC-004**: A user switching between English and Spanish sees every piece of plugin UI text change language instantly with no page reload required
- **SC-005**: No regressions in existing English UI text — all previously translated strings remain correct and intact

## Assumptions

- The existing custom i18n system (LocaleContext provider + `useTranslation` hook) is sufficient for the scope of this work and does not need to be replaced or extended with new capabilities. If the system lacks needed features (e.g., pluralization or interpolation), that will be addressed as a separate concern.
- Only English (en) and Spanish (es) are in scope for this feature, consistent with the currently supported locales.
- The guide plugin is already largely localized and requires only a gap audit rather than full translation work.
- "Internal core plugins" refers to the six built-in plugins in `frontend/plugins/`: play-score, train-view, practice-view-plugin, sessions-plugin, guide, and virtual-keyboard. External plugins in `plugins-external/` are out of scope.
- Translation key naming will follow a consistent convention (e.g., `plugin.<plugin-name>.<section>.<element>`) but the exact convention will be decided during implementation planning.
