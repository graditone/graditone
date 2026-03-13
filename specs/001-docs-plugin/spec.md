# Feature Specification: Graditone Documentation Plugin

**Feature Branch**: `001-docs-plugin`  
**Created**: 2026-03-13  
**Status**: Draft  
**Input**: User description: "Create a new plugin documenting what is Graditone and how to use for end users. This plugin must be preloaded and it must be shown in the top menu bar, to the right."

## Clarifications

### Session 2026-03-13

- Q: What is the canonical menu label and icon for the documentation plugin entry in the top menu bar? → A: "Guide" with icon 📖.
- Q: How are sections within the Guide view navigated — scrollable page, tabs, or accordion? → A: Single scrollable page with clearly styled section headings; users read top-to-bottom and scroll to the desired section.
- Q: What plugin view type should the Guide use — `full-screen` (like core nav plugins) or `window` (floating overlay)? → A: **Revised during planning**: Research showed that `type: "core"` plugins appear only on the landing screen, not in the nav bar. Guide must be `"type": "common"` (nav bar) with `"view": "window"` and `"pluginApiVersion": "1"` so the host provides the back button. See research.md R-001 and R-002.
- Q: What `order` value should the Guide plugin declare in its manifest to guarantee rightmost placement? → A: `order: 99` — a high sentinel value that stays rightmost even as new core plugins are added.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - First-Time User Orientation (Priority: P1)

A user opens Graditone for the first time and doesn't know what the app is or how to start. They tap the **Guide** entry (📖) in the top menu bar (rightmost entry) and immediately see a clear overview of what Graditone is, what it can do, and where to begin.

**Why this priority**: This is the single most valuable outcome of the feature — reducing confusion and abandonment for new users. It can be delivered and demonstrated as a standalone experience without any other story being complete.

**Independent Test**: Can be fully tested by opening the app, tapping the documentation plugin entry in the top menu bar, and verifying that an overview description of Graditone is displayed with a description of its core purpose.

**Acceptance Scenarios**:

1. **Given** the user has just opened Graditone, **When** they look at the top menu bar, **Then** the **Guide** entry (📖) is visible as the rightmost item.
2. **Given** the user taps the documentation plugin entry, **When** the plugin view opens, **Then** they see a clear, friendly title and a short paragraph explaining what Graditone is.
3. **Given** the documentation view is open, **When** the user reads the overview section, **Then** they understand Graditone is a tablet-native app for interactive music scores designed for practice and performance.
4. **Given** the documentation view is open on any device size, **When** the content is displayed, **Then** all text is legible without horizontal scrolling or truncation.

---

### User Story 2 - Feature Discovery by Section (Priority: P2)

A user who already knows Graditone wants to understand how a specific feature works (e.g., how to loop a section, how to use the practice mode, how to import a MusicXML file). They open the guide plugin and navigate to the relevant section to find step-by-step instructions.

**Why this priority**: Sectioned content transforms the guide from a one-time read into an on-demand reference. Users can re-consult it whenever they forget a specific workflow, reducing reliance on trial-and-error.

**Independent Test**: Can be fully tested by opening the Guide plugin and verifying that at least five distinct feature sections exist and are reachable by scrolling the single-page view.

**Acceptance Scenarios**:

1. **Given** the Guide view is open, **When** the user looks at the content, **Then** they can identify five clearly labelled sections — app overview, score playback, practice mode, train mode, and MusicXML loading — each visually separated by a prominent heading on the single scrollable page.
2. **Given** the documentation view has multiple sections, **When** the user navigates to the "Score Playback" section, **Then** they see instructions covering how to start playback, how to tap notes to seek, and how to create a loop region.
3. **Given** the documentation view has multiple sections, **When** the user navigates to the "Practice" section, **Then** they see instructions covering how to load a score, how to connect a MIDI device, and how the step-by-step guidance works.
4. **Given** the documentation view has multiple sections, **When** the user navigates to the "Train" section, **Then** they see instructions explaining the three complexity levels (Low/Mid/High), the two training modes (Flow/Step), the three exercise presets (Random/C4 Scale/Score), and how to use a MIDI keyboard or microphone as input.
5. **Given** the documentation view has multiple sections, **When** the user navigates to the "Loading a Score" section, **Then** they see instructions for: how to generate a MusicXML file (export from MuseScore, Sibelius, or Finale), the preloaded demo scores available without uploading, how to upload a custom .mxl/.musicxml file, and how uploaded scores persist across sessions.

---

### User Story 3 - Access from Any App State (Priority: P3)

A user is in the middle of using another plugin (e.g., watching playback in the Play view) and wants to quickly check how a gesture works. They tap the documentation plugin entry in the top menu bar, read what they need, and return to the Play view without losing their place.

**Why this priority**: The guide is most valuable when reachable from anywhere without disrupting the user's current workflow. This story depends on the top-menu positioning (P1) and sectioned content (P2) both being complete.

**Independent Test**: Can be tested by navigating to any other plugin view (e.g., Play), tapping the documentation entry, verifying the guide loads, then tapping another plugin entry and verifying the user returns to that plugin's state.

**Acceptance Scenarios**:

1. **Given** the user is viewing any plugin other than the documentation plugin, **When** they tap the documentation plugin entry in the top menu bar, **Then** the documentation view opens.
2. **Given** the documentation view is open, **When** the user taps another plugin entry in the top menu bar, **Then** they are taken to that plugin and can continue their previous task.
3. **Given** the documentation plugin is the rightmost item in the top menu bar, **When** the user is on any screen, **Then** the top menu bar remains visible and the documentation entry is always reachable without scrolling.

---

### Edge Cases

- What happens when the documentation view is opened on a small mobile screen where the full menu bar might overlap the content?
- What happens if the documentation plugin fails to load (content parse error)?
- How does the section layout behave when the device is rotated between portrait and landscape mid-view?

## Assumptions

- The documentation plugin is built-in (shipped with the app) and cannot be uninstalled or hidden by users.
- The plugin uses `"type": "common"`, `"view": "window"`, and `"pluginApiVersion": "1"` in its manifest. This makes it appear in the top nav bar (common plugins are nav bar entries; core plugins are landing screen entries only) and activates the host-provided back button bar (no need for the Guide to implement its own back navigation).
- The plugin declares `"order": 99` in its manifest — a high sentinel value that ensures rightmost placement in the top menu bar regardless of what order values future core plugins use.
- The documentation plugin appears as the last (rightmost) item in the top navigation menu, after all other core plugins.
- The content of the guide is presented as a single scrollable page with section headings; no tabs, accordions, or in-page search are required.
- The content of the guide is static — it does not pull data from a server and works fully offline.
- The guide covers the features that exist at the time of implementation: score viewing, audio playback with gestures, practice mode (MIDI-driven step practice), train mode (ear-training exercises with MIDI/mic input and complexity levels), and MusicXML loading (bundled demo scores + user-uploaded scores persisted in browser storage).
- The Guide plugin CSS MUST use the app's `--color-*` CSS custom properties (defined in `App.css` and mapped from the active landing theme's `--ls-*` tokens) for all colors and fonts. Hard-coded colour values are not permitted. This ensures the Guide inherits every future theme change automatically, matching the pattern established by `TrainPlugin.css` and `plugin-dialog.css`.
- The documentation plugin does not require a score to be loaded to be usable.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The documentation plugin MUST be included in the application by default and available without any user installation step. It MUST be declared as `"type": "common"`, `"view": "window"`, and `"pluginApiVersion": "1"` in its manifest.
- **FR-002**: The documentation plugin MUST appear as a persistent entry in the top navigation menu bar, positioned to the right of all other core navigation entries. Its canonical label is **"Guide"** and its icon is 📖 (reflected in `plugin.json` `name` and `icon` fields). It MUST declare `"order": 99` to guarantee rightmost placement.
- **FR-003**: The documentation plugin MUST be accessible regardless of which other plugin or view is currently active.
- **FR-004**: The documentation plugin view MUST display content organized into clearly labelled sections covering: app overview, score playback and gestures, practice mode, train mode, and MusicXML loading. The MusicXML loading section is cross-view shared context (applies to both Play and Train plugins).
- **FR-005**: The app overview section MUST explain in plain language what Graditone is and who it is for.
- **FR-006**: The score playback section MUST document all available tap and gesture interactions (tap to seek, long-press to pin/loop, tap inside loop to clear).
- **FR-007**: The practice section MUST explain how to start a practice session, the role of a MIDI device, and how step-by-step note guidance works.
- **FR-008**: The Train section MUST explain: (a) the three complexity levels (Low — 8 notes, step, 40 BPM; Mid — 16 notes, step, 80 BPM; High — 20 notes, flow, 100 BPM); (b) the two training modes (Flow — play all notes in time; Step — wait for the correct note before advancing); (c) the three exercise presets (Random, C4 Scale, Score — uses notes extracted from the loaded score); (d) input sources (MIDI keyboard auto-detected, or device microphone); (e) that the selected complexity level is remembered across sessions.
- **FR-009**: The MusicXML loading section MUST describe: (a) what MusicXML is and which file extensions are supported (.mxl, .musicxml, .xml); (b) how to export MusicXML from common notation software (MuseScore — free, Sibelius, Finale, Dorico); (c) the bundled preloaded demo scores available without any upload; (d) how to upload a custom file from the device; (e) that uploaded scores are stored in the browser and persist across sessions.
- **FR-010**: The documentation content MUST be readable without an internet connection (fully offline-capable).
- **FR-011**: The documentation plugin MUST load its content within the same time budget as other core plugins.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The documentation plugin entry is visible in the top menu bar on every screen of the app, verified by navigating to each core plugin view.
- **SC-002**: A first-time user can identify what Graditone is and locate the primary action (loading a score or starting playback) within 60 seconds of opening the guide.
- **SC-003**: All five documented sections (overview, playback, practice, train, MusicXML loading) are present and contain at least one concrete user instruction each.
- **SC-004**: The guide is accessible and fully readable while the device is in offline/airplane mode.
- **SC-005**: Navigating from the documentation plugin back to any other plugin takes no more than one tap.
- **SC-006**: The guide content renders correctly on screen widths from 375 px (small phone) to 1366 px (large tablet) without content truncation or overlap, and it visually matches the active landing theme by using `--color-*` CSS tokens for all colors and fonts.

