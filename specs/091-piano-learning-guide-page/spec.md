# Feature Specification: Piano Learning Guide Page

**Feature Branch**: `091-piano-learning-guide-page`  
**Created**: 2026-05-20  
**Status**: Draft  
**Input**: User description: "include in the guide a new page with how graditone helps you learning piano"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Discover How Graditone Supports Piano Practice (Priority: P1)

A prospective user or beginner pianist opens Graditone and navigates to the guide. They find a dedicated page that clearly explains how Graditone helps them learn piano — covering note highlighting during playback, tempo control for learning at a slow pace, loop regions for drilling difficult passages, and the virtual keyboard for visualization. After reading, they feel confident they can use the app to improve their piano skills.

**Why this priority**: This is the most critical story because new users need to understand the app's piano learning value before they invest time in it. Without this page, users may not discover key features like looping, tempo control, or the practice plugin that directly support piano skill development.

**Independent Test**: Navigate to the guide page, verify all core learning feature sections are present and readable, and confirm that each section links or references the relevant in-app feature. Delivers immediate value by reducing onboarding friction for piano learners.

**Acceptance Scenarios**:

1. **Given** a user opens the guide, **When** they navigate to the "Piano Learning" page, **Then** the page explains at least 4 key Graditone features relevant to learning piano (note highlighting, tempo control, loop practice regions, virtual keyboard).
2. **Given** the user reads the page, **When** they finish reading a feature description, **Then** each feature explanation includes a concrete benefit framed for a piano learner (e.g., "slow down the tempo to master a difficult run").
3. **Given** the user is on the guide page, **When** they look at the page on a tablet, **Then** the layout is readable and properly formatted, with no overflow or truncated content.
4. **Given** the user accesses the guide from the app's landing screen, **When** they navigate to the piano learning guide page, **Then** the page loads without errors and all content is visible.

---

### User Story 2 - Step-by-Step Piano Practice Workflow (Priority: P2)

A beginner pianist wants to know how to use Graditone to practice a piece from start to finish. The guide page walks them through a structured workflow: load a score → listen to the full piece at normal tempo → slow down tempo to study a section → mark a loop region → use the practice plugin to drill notes one by one → gradually increase tempo toward goal speed.

**Why this priority**: A workflow walkthrough gives concrete direction to users who know they want to practice but don't know how to connect the individual features. It bridges feature discovery with practical usage, turning the guide from a feature list into an actionable learning resource.

**Independent Test**: Follow the walkthrough step by step in the live app and verify each described step matches the actual app behavior. Can be tested independently from the feature-overview section.

**Acceptance Scenarios**:

1. **Given** the user reads the practice workflow section, **When** they follow the steps in the live app, **Then** each step corresponds to a real, accessible action in the current app (e.g., "tap the loop icon to set a region" works as described).
2. **Given** the user is viewing the workflow steps, **When** they read step descriptions, **Then** each step is action-oriented (starts with a verb) and references a specific UI element or control by its name.
3. **Given** the user wants to practice a specific passage, **When** they follow the loop-region step in the guide, **Then** the guide accurately describes how to set start and end points of a loop region in Graditone.
4. **Given** the user is on mobile or tablet, **When** they read the workflow, **Then** each step is presented clearly without requiring horizontal scrolling or zooming.

---

### User Story 3 - Piano-Specific Feature Highlights (Priority: P2)

A pianist already familiar with sheet music notation wants to understand how Graditone's features map to piano-specific practice techniques. The guide page highlights features that are especially relevant to piano learning: stacked staves view for reading treble and bass clef simultaneously, dynamics playback for understanding musical expression, and the MIDI input support for connecting a keyboard. Each feature explains its piano-learning benefit.

**Why this priority**: Piano players have specific needs (grand staff reading, left/right hand coordination, MIDI connectivity) that differ from other instrumentalists. Addressing these needs explicitly increases relevance for the target audience.

**Independent Test**: Read each piano-specific highlight and verify that the described feature exists and behaves as described in the current app. Can be tested independently by checking each highlight against the live app.

**Acceptance Scenarios**:

1. **Given** the user reads the stacked staves highlight, **When** they open a piano score in the app, **Then** the stacked view showing treble and bass clef simultaneously is accessible as described.
2. **Given** the user reads the dynamics playback highlight, **When** they play a score with dynamic markings, **Then** the app plays back dynamics as described (e.g., softer for pp, louder for ff).
3. **Given** the user reads the MIDI input highlight, **When** they connect a MIDI keyboard to their device, **Then** the app detects MIDI input as described in the guide.
4. **Given** the user reads the one-hand playback highlight, **When** they configure playback to a single hand in the practice plugin, **Then** only that hand's notes are played back as described.

---

### User Story 4 - Tips for Effective Practice (Priority: P3)

A motivated learner wants advice on how to get the most out of their practice sessions using Graditone. The guide page includes a concise set of piano practice tips — such as starting with hands separately, using a slow tempo first, focusing on small sections, and gradually increasing speed — and explains how each tip maps to a specific Graditone feature.

**Why this priority**: Practice tips add educational depth and reinforce feature usage. They are P3 because the page delivers core value through feature explanations and workflows; tips are supplementary but increase engagement and retention.

**Independent Test**: Read the tips section and verify that each tip references a real, available Graditone feature. The section can be added independently after the P1 and P2 stories are complete.

**Acceptance Scenarios**:

1. **Given** the user reads the tips section, **When** they count the tips, **Then** there are at least 4 distinct, actionable practice tips.
2. **Given** the user reads a tip, **When** they look for the associated Graditone feature, **Then** each tip references at least one specific feature (e.g., "Use the loop region to isolate the hardest bar" references the loop region feature).
3. **Given** the user reads the tips on a small-screen device, **When** they view the tips, **Then** the tips are scannable (short, bulleted, or numbered) and do not require long reading time.

---

### Edge Cases

- What happens if the user accesses the guide on a very small screen (< 360px wide)? Content should remain readable with appropriate text wrapping.
- How should the guide page behave when the app is offline? Since Graditone is a PWA, the guide page must be cached and accessible without a network connection.
- What if a described feature (e.g., MIDI input) is not available on the user's device or browser? The guide should indicate when a feature depends on specific hardware or browser support.
- How does the page handle multiple languages? All guide content MUST use the existing i18n infrastructure **and** all supported app languages (currently English and Spanish) MUST be fully translated at launch — stub placeholders are not acceptable for a shipped release.
- What happens when the user navigates to the guide from within an active practice session? The guide should be accessible without interrupting or resetting the current session state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST include a dedicated "Piano Learning Guide" page accessible from the app navigation (landing screen, help menu, or settings).
- **FR-002**: The guide page MUST contain a section explaining at least 4 core Graditone features relevant to piano learning: note highlighting, tempo control, loop practice regions, and the virtual keyboard.
- **FR-003**: The guide page MUST include a step-by-step practice workflow section that describes a complete piano practice session using Graditone features.
- **FR-004**: The guide page MUST include a piano-specific features section covering stacked staves view, dynamics playback, and MIDI keyboard input.
- **FR-005**: The guide page MUST include a practice tips section with at least 4 actionable tips, each linked to a specific Graditone feature.
- **FR-006**: The guide page MUST be responsive and render correctly on mobile (375px), tablet (768px), and desktop (1440px) viewports.
- **FR-007**: The guide page MUST be accessible offline (cached by the PWA service worker).
- **FR-008**: The guide page MUST be accessible via keyboard navigation (all links and interactive elements focusable and activatable with keyboard).
- **FR-009**: All text on the guide page MUST meet WCAG 2.1 AA color contrast requirements (4.5:1 for normal text, 3:1 for large text).
- **FR-010**: The guide page MUST use the existing i18n infrastructure so that content strings are ready for translation.
- **FR-011**: Feature descriptions that depend on optional hardware (MIDI keyboard) or specific browser capabilities MUST include a note about the prerequisite.
- **FR-012**: The guide page MUST be navigable from the landing screen without requiring the user to load a score first.
- **FR-013**: The guide page MUST be fully available in all supported app languages at launch. Currently this means English (`en.json`) and Spanish (`es.json`). The `es.json` locale file MUST NOT contain `[ES]` stub prefixes for any `guide.piano.*` key at the time of release.

### Key Entities

- **Guide Page**: A dedicated in-app screen presenting piano learning content; consists of structured sections (overview, workflow, piano-specific features, tips); accessible from app navigation; cached by service worker.
- **Feature Highlight**: A named, benefit-focused description of a Graditone feature, framed for a piano learner; contains a title, a one-sentence benefit statement, and a brief description; references a real app feature by its UI name.
- **Practice Workflow**: An ordered sequence of steps describing how to practice a piano piece using Graditone from start to finish; each step is action-oriented and references a specific UI element or control.
- **Practice Tip**: A concise, actionable piece of advice for piano learners that references at least one Graditone feature; presented in a scannable list format.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can locate and read the Piano Learning Guide page within 30 seconds of opening the app, starting from the landing screen.
- **SC-002**: The guide page covers at least 4 core piano-learning features with benefit-oriented descriptions.
- **SC-003**: 100% of text elements on the guide page pass WCAG 2.1 AA color contrast checks.
- **SC-004**: The guide page loads and is fully readable in offline mode (verified by disabling network in DevTools after first load).
- **SC-005**: The practice workflow section accurately reflects the current app behavior — every step can be performed in the live app without errors.
- **SC-006**: The guide page renders without layout issues (overflow, clipping, broken sections) on mobile (375px), tablet (768px), and desktop (1440px) viewports.
- **SC-007**: All i18n strings used on the guide page are defined in the existing translation files with full content in all supported languages (English and Spanish); no hardcoded strings outside i18n; no `[ES]` stub prefixes present in any locale file for `guide.piano.*` keys.

## Known Issues & Regression Tests *(if applicable)*

<!-- This section is intentionally empty at spec creation time. Issues will be documented here as they are discovered during implementation. -->

**Bugfix**: 2026-05-20 — BUG-001 Added FR-013 (Spanish translation parity required at launch); updated SC-007 to require full Spanish parity with no `[ES]` stub prefixes; updated multilingual edge case to prohibit deferred translation stubs in shipped releases.
