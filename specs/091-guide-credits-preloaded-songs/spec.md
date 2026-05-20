# Feature Specification: Credits Page for Preloaded Songs in Guide Plugin

**Feature Branch**: `091-guide-credits-preloaded-songs`  
**Created**: 2025-07-15  
**Status**: Draft  
**Input**: User description: "Credits page for preloaded songs included in guide plugin"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - User discovers song attribution in the Guide (Priority: P1)

A user playing Burgmüller — Arabesque wonders who arranged the score and whether it is freely licensed. They open the Guide plugin and scroll to the Credits section, where they find a clearly presented list of all preloaded songs with their composer, arranger/source, and license information. The information answers their question without leaving the app.

**Why this priority**: The credits section is the core deliverable of this feature. It satisfies the legal and ethical obligation to attribute third-party musical works bundled with the application, and it is the first piece of functionality a user would encounter.

**Independent Test**: Can be fully tested by opening the Guide plugin, scrolling to the Credits section, and verifying that every preloaded song (Bach Invention No. 1, Beethoven Für Elise, Burgmüller Arabesque, Burgmüller La Candeur, Chopin Nocturne Op. 9 No. 2, Pachelbel Canon in D, Two Steps from Hell — Star Sky) is listed with its attribution details.

**Acceptance Scenarios**:

1. **Given** a user has opened the Guide plugin, **When** they scroll to the Credits section, **Then** they see a section titled "Credits" (or equivalent) with an entry for each of the 7 preloaded songs
2. **Given** the Credits section is visible, **When** a user reads an entry for any preloaded song, **Then** they can see the song title, composer name, and the source or license under which the MusicXML file is distributed
3. **Given** a user reads the credits for the Two Steps from Hell — Star Sky entry, **When** they look at the license information, **Then** the license clearly indicates whether commercial reuse is permitted or restricted (since Star Sky is a contemporary copyrighted work unlike the public-domain classical pieces)

---

### User Story 2 - Spanish-speaking user reads credits in their language (Priority: P2)

A Spanish-speaking user opens Graditone with their browser language set to Spanish. They navigate to the Guide plugin's Credits section and find all headings, labels, and descriptive text translated into Spanish. Song titles and proper names (composer names) are displayed as-is, but all surrounding UI text and license labels appear in Spanish.

**Why this priority**: The Guide plugin is already fully i18n-enabled. Adding new static text without corresponding translations would break the application's established policy of full Spanish support.

**Independent Test**: Can be tested by setting the browser locale to Spanish, navigating to the Guide plugin Credits section, and verifying that all non-proper-noun text (headings, labels, descriptive introductory copy) is displayed in Spanish.

**Acceptance Scenarios**:

1. **Given** the browser language is set to Spanish, **When** the user scrolls to the Credits section in the Guide plugin, **Then** the section heading and any introductory explanatory text appear in Spanish
2. **Given** the browser language is set to Spanish, **When** the user reads individual credit entries, **Then** labels such as "Composer", "Source", and "License" appear in Spanish; song titles and composer names remain in their original form
3. **Given** the browser language is set to English, **When** the user reads the Credits section, **Then** all content is displayed correctly in English with no regressions to existing guide text

---

### User Story 3 - Developer adds a new preloaded song and updates credits (Priority: P3)

A developer adds a new preloaded score to the application. They update the credits data source with attribution information for the new piece, and the new entry automatically appears in the Guide plugin's Credits section without any additional UI changes.

**Why this priority**: The credits content must be maintainable. Tightly coupling credit entries to the UI would make future updates error-prone. A single authoritative data source that drives both the credits display and any future uses (e.g., a tooltip on the load score dialog) is the correct design.

**Independent Test**: Can be tested by adding a mock credit entry to the credits data source and verifying that it renders in the Credits section of the Guide plugin without modifying the GuidePlugin component itself.

**Acceptance Scenarios**:

1. **Given** a new song credit entry is added to the credits data source, **When** the Guide plugin is rendered, **Then** the new entry appears in the Credits section in the correct position (alphabetical or defined order)
2. **Given** a credit entry is removed from the credits data source, **When** the Guide plugin is rendered, **Then** the removed entry no longer appears in the Credits section

---

### Edge Cases

- What happens if a song's license information is not available or unknown? The entry must still appear in the credits list with a clear placeholder (e.g., "License: Unknown") rather than being silently omitted.
- What happens if a preloaded score file is removed from the app but its entry remains in the credits data? The credits section renders the entry as-is (it is static content, not dynamically linked to file presence).
- What if the credits section causes the Guide page to become very long? The section appears at the bottom of the existing five sections and inherits the same scrollable layout — no additional scroll management is required.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Guide plugin MUST include a new Credits section displaying attribution information for every preloaded song bundled with the application
- **FR-002**: The Credits section MUST list all 7 currently preloaded songs: Bach Invention No. 1, Beethoven Für Elise, Burgmüller Arabesque, Burgmüller La Candeur, Chopin Nocturne Op. 9 No. 2, Pachelbel Canon in D, and Two Steps from Hell — Star Sky
- **FR-003**: Each credit entry MUST display at minimum: the song display name, the composer (or original artist), and the license or source attribution for the MusicXML file used in the app
- **FR-004**: The Credits section MUST be the last section on the Guide plugin's single scrollable page, appearing after the existing "Loading a Score" section
- **FR-005**: All user-facing text in the Credits section (headings, labels, introductory copy) MUST use the application's i18n translation system — no hardcoded English strings
- **FR-006**: Translation keys for the Credits section MUST be added to both the English (en.json) and Spanish (es.json) locale files
- **FR-007**: Credit attribution data MUST be defined in a single authoritative data source (separate from the UI component) so that adding or removing a credit entry requires a change in only one place
- **FR-008**: The Credits section MUST be accessible — the section MUST have a labelled heading element and entries MUST be navigable by keyboard and readable by screen readers
- **FR-009**: The visual style of the Credits section MUST be consistent with the existing Guide plugin sections, reusing the same CSS patterns (`guide-section` class structure)

### Key Entities

- **SongCredit**: Represents the attribution record for a single preloaded song. Key attributes: song display name, composer/artist name, source URL or publication reference, license name, optional arranger name.
- **CreditsCatalog**: The ordered collection of all SongCredit entries, serving as the single source of truth for credits data displayed in the Guide plugin.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 7 preloaded songs have a visible credit entry in the Guide plugin's Credits section — 0 songs are omitted
- **SC-002**: Every credit entry contains the song title, composer/artist, and license — 0 entries have missing mandatory fields
- **SC-003**: All text in the Credits section renders correctly in both English and Spanish — 0 hardcoded strings or missing translation keys in either locale file
- **SC-004**: The Credits section heading and content are accessible: the section has a labelled heading, and all entries can be read by a screen reader in a logical order
- **SC-005**: Adding a new entry to the credits data source results in it appearing in the Guide Credits section without any modifications to the Guide plugin component code

## Assumptions

- The 7 preloaded songs listed in `frontend/src/data/preloadedScores.ts` as of this writing are the complete set to be credited. Scale scores (C Major, G Minor, etc.) are system-generated and do not require individual third-party attribution credits.
- License and source information for each preloaded MusicXML file will be researched and provided during implementation. For the classical public-domain works (Bach, Beethoven, Burgmüller, Chopin, Pachelbel), the compositions themselves are public domain; the specific MusicXML arrangement source and its license will be documented. For Two Steps from Hell — Star Sky, the copyright status and distribution terms of the fan-arranged MusicXML file must be confirmed before publication.
- The Credits section is static content — no interactive elements (e.g., clickable links to external sources) are required for the initial version, though an optional source URL field in the data model is desirable for future enhancement.
- The existing `useTranslation` / `t()` i18n pattern used throughout the Guide plugin is sufficient for this feature and does not require extension.
- No new navigation entry or separate route is needed — the credits appear as a section within the existing Guide plugin scroll view.

