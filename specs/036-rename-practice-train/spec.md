# Feature Specification: Rename Practice Plugin to Train & Add Plugin Order Field

**Feature Branch**: `036-rename-practice-train`
**Created**: 2026-03-03
**Status**: Draft
**Input**: User description: "Rename Practice to Train. The current Practice Plugin must be renamed to Train Plugin. The change must cover visible names to the user, code names, and related documentation. The final views of the App will be Play, Train, Practice, Performance. The sorting of the views must be respected, so we need to extend the plugin description to include an order field and use it during rendering."

## Clarifications

### Session 2026-03-03

- Q: Should the plugin `id` field be renamed from `"practice-view"` to `"train-view"`, or kept as-is for backward compatibility? → A: Rename to `"train-view"` — full internal consistency is preferred; id-keyed storage (IndexedDB plugin registrations and any host-side records keyed by plugin id) must be migrated alongside the localStorage keys in FR-007.
- Q: Is the Virtual Keyboard remaining a visible navigation entry long-term, or will it be retired / absorbed into another view? → A: Virtual Keyboard stays as a visible navigation entry; its position in the navigation order is explicitly deferred to a future feature — it is not retired, hidden, or assigned an `order` value in this feature.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - User Sees "Train" in Navigation and Plugin UI (Priority: P1)

A user opens the Musicore app and finds the navigation entry previously labelled "Practice" now shows "Train". When they open the plugin, all headings, titles, and labels that referenced "Practice" in the context of this plugin now read "Train". No part of the user-facing interface retains the old "Practice" label for this plugin.

**Why this priority**: The user-visible rename is the primary observable outcome. It is the fastest deliverable and validates the entire feature with zero internal risk — a user can confirm it immediately from the navigation screen.

**Independent Test**: Can be fully tested by opening the app, checking the navigation bar, opening the renamed plugin, and verifying no visible element reads "Practice" where it referred to this plugin — independently of any code renaming or order field work.

**Acceptance Scenarios**:

1. **Given** the app is open, **When** the user looks at the navigation, **Then** the plugin entry reads "Train", not "Practice".
2. **Given** the user opens the Train plugin, **When** the plugin header loads, **Then** the page title and any visible heading reads "Train".
3. **Given** the user is using the Train plugin, **When** they scan the entire plugin UI (config sidebar, exercise area, results screen), **Then** no UI label, button, heading, or tooltip uses the word "Practice" to refer to this plugin.
4. **Given** the app is installed as a PWA, **When** the user opens the navigation, **Then** the "Train" entry appears in place of the old "Practice" entry without any reinstallation required.

---

### User Story 2 - Navigation Entries Appear in Defined Order (Priority: P2)

A user who has the default built-in plugins installed sees the app navigation entries rendered in the intended order — Play Score then Train — consistent with the target app view sequence of Play › Train › Practice › Performance. The ordering is stable across page reloads and plugin updates.

**Why this priority**: Navigation order is the first thing users perceive when they open the app and is essential for progressive onboarding. Establishing the order mechanism now sets a stable foundation for future views to slot in at their correct positions.

**Independent Test**: Can be fully tested by opening the app with only the default built-in plugins (Play Score, Train) and confirming the navigation renders Play Score before Train — independently of any future Practice or Performance entries.

**Acceptance Scenarios**:

1. **Given** the built-in plugins are loaded, **When** the navigation bar renders, **Then** the Play Score plugin entry (order 1) appears before the Train plugin entry (order 2).
2. **Given** a third-party plugin with no `order` field is imported, **When** the navigation renders, **Then** it appears after all plugins that have an `order` value.
3. **Given** two plugins share the same `order` value, **When** the navigation renders, **Then** they are ordered consistently by a stable secondary criterion (plugin `id` alphabetically) without crashing.
4. **Given** the user reloads the app (PWA restart), **When** the navigation renders, **Then** the plugin order is identical to the order before reload.

---

### User Story 3 - Developer Assigns Order to Any Plugin (Priority: P3)

A plugin developer (or Musicore contributor) can add an `order` field to any plugin's `plugin.json` manifest to control where it appears in the navigation relative to other plugins. They can verify the effect immediately by reloading the app with the updated manifest.

**Why this priority**: The `order` field is the mechanism that enables the full target app view sequence (Play › Train › Practice › Performance) to be maintained as new plugins are introduced. It must be in the manifest schema so any current or future plugin can use it.

**Independent Test**: Can be fully tested by adding `"order": 99` to the virtual-keyboard plugin manifest and confirming it moves to the end of the navigation — independently of the Train rename.

**Acceptance Scenarios**:

1. **Given** a plugin's `plugin.json` contains `"order": 1`, **When** the app loads, **Then** that plugin is positioned first among all plugins with order values.
2. **Given** a plugin's `plugin.json` omits the `order` field entirely, **When** the app loads, **Then** the plugin is placed after all plugins that declare an `order` value.
3. **Given** an invalid value is provided for `order` (e.g., a non-numeric string), **When** the app loads, **Then** the plugin is treated as if no order was specified — graceful fallback with no crash.
4. **Given** the Plugin API documentation, **When** a developer reads the manifest schema section, **Then** the `order` field is documented with its type, default behaviour when absent, and an ordering example covering the target view sequence.

---

### User Story 4 - All Code and Documentation Reflects the New Name (Priority: P4)

A developer cloning the repository and searching for "Practice" in the context of the renamed plugin finds only historical references (git history, annotated old spec files) — not any current code identifiers, CSS class names, or documentation headings that describe the Train plugin. The codebase is internally consistent with the user-facing name.

**Why this priority**: Code consistency with the user-facing name reduces onboarding confusion and prevents future contributors from accidentally recreating "Practice" identifiers when extending the Train plugin. It is lowest priority because it carries no user-facing risk and can be completed after P1–P3.

**Independent Test**: Can be validated by searching the renamed plugin directory for identifiers containing "practice" (case-insensitive) and confirming zero matches for current identifiers — independently of navigation order work.

**Acceptance Scenarios**:

1. **Given** the plugin directory is renamed to `frontend/plugins/train-view/`, **When** a developer searches the directory for identifiers containing "practice" (case-insensitive), **Then** zero current identifiers are found — only migration-history comments are exempt.
2. **Given** the component files are renamed (e.g., `PracticePlugin.tsx` → `TrainPlugin.tsx`), **When** the app is built, **Then** it compiles cleanly with no broken imports or missing type references.
3. **Given** localStorage or sessionStorage keys were previously prefixed with `practice-` for this plugin, **When** the app loads on a device that has old `practice-` keys, **Then** the app reads the old data, writes it to the new `train-` keys, and removes the old keys — the user's settings are preserved.
4. **Given** the existing spec and supporting documents in `specs/031-practice-view-plugin/`, **When** a developer reads them, **Then** a clearly marked notice at the top of each document states that the plugin was renamed to "Train" in feature 036 and points to the canonical plugin path `frontend/plugins/train-view/`.

---

### Edge Cases

- What happens if a user has an active PWA service worker serving cached assets that still contain "Practice" labels? The service worker update cycle must serve the new assets on the next activation — users on an old service worker see "Practice" until the cache refreshes.
- What happens with localStorage keys previously scoped to the Practice plugin (e.g., `practice-tips-v1-dismissed`, `practiceBpm`, `practice-complexity-level`)? Migration logic must read from old keys and write to new `train-` keys on first load, then remove old keys, preserving all user settings.
- What happens when the `order` field value is `0` or negative? These are valid numeric values; the system must treat them as ordered (positioned before plugins with higher values) without special-casing.
- What happens if two plugins have the same `order` value and identical `id`s? This is structurally impossible (plugin IDs must be unique), but if it occurs the system must not crash — deterministic rendering order is sufficient.
- What happens to the virtual-keyboard plugin, which currently has no `order` field? It must continue to render without error, appearing after all ordered plugins until a future feature assigns it an `order` value.

## Requirements *(mandatory)*

### Functional Requirements

**User-Facing Rename**

- **FR-001**: The `name` field in the Train plugin's `plugin.json` manifest MUST be changed from `"Practice"` to `"Train"`.
- **FR-002**: Every user-visible string within the Train plugin's UI that refers to this plugin by name (navigation label, plugin header title, window-level title if present) MUST read "Train".
- **FR-003**: The plugin directory MUST be renamed from `frontend/plugins/practice-view/` to `frontend/plugins/train-view/`, and all files within it that contain "Practice" in their names MUST be renamed to use "Train" (e.g., `PracticePlugin.tsx` → `TrainPlugin.tsx`, `PracticePlugin.css` → `TrainPlugin.css`, `PracticePlugin.test.tsx` → `TrainPlugin.test.tsx`).

**Code Rename**

- **FR-004**: All TypeScript identifiers exported from or used within the Train plugin directory that are named after "Practice" in the plugin context MUST be updated to use "Train" equivalents (e.g., `PracticePlugin` → `TrainPlugin`, `PracticePhase` → `TrainPhase`, `PracticeExercise` → `TrainExercise`).
- **FR-005**: All CSS class names within the Train plugin's stylesheet that are prefixed with `practice-plugin` or `practice-` MUST be updated to `train-plugin` and `train-` equivalents throughout both the CSS and the JSX that references them.
- **FR-006**: The `builtinPlugins.ts` host registration MUST import from `frontend/plugins/train-view/` instead of `frontend/plugins/practice-view/`, and the manifest it registers MUST use `id: "train-view"`.
- **FR-006b**: The plugin `id` field MUST be changed from `"practice-view"` to `"train-view"` in the manifest. Any host-side storage keyed by plugin id (e.g., IndexedDB plugin registration records) MUST be migrated: on first load after the update, if a record exists under the old id `"practice-view"`, it MUST be copied to `"train-view"` and the old record removed.
- **FR-007**: Any localStorage or sessionStorage keys owned by this plugin that are prefixed with `practice-` MUST be updated to `train-` prefixes. A one-time migration MUST run on the first app load after the update: for each affected key, if the new `train-` key is absent, read the value from the old `practice-` key, write it to the `train-` key, and delete the old key. If the old key is also absent, no action is taken.

**Plugin Manifest Order Field**

- **FR-008**: The `PluginManifest` TypeScript type MUST be extended with an optional `order` field of type `number`.
- **FR-009**: The host application's navigation rendering logic MUST sort all installed plugins by their `order` field value in ascending order before building the navigation entry list. Plugins that do not declare an `order` field MUST appear after all plugins that do, with stable secondary ordering by plugin `id` (alphabetical).
- **FR-010**: The `play-score` plugin's `plugin.json` MUST be assigned `"order": 1`.
- **FR-011**: The Train plugin's `plugin.json` MUST be assigned `"order": 2`.
- **FR-012**: When two plugins declare the same `order` value, they MUST be sorted by their `id` field alphabetically as a stable tiebreaker; the app MUST NOT crash or produce a non-deterministic order.
- **FR-013**: An `order` field value that is not a finite number MUST be treated as absent (plugin falls to the unordered group at the end), and a warning MUST be emitted to the console to aid debugging.

**Documentation**

- **FR-014**: The Plugin API manifest schema documentation MUST be updated to include the `order` field: type (`number`), optional status, default behaviour when absent (rendered after all ordered plugins, stable tiebreak by `id`), and a usage example showing the intended app view sequence (Play › Train › Practice › Performance) with example order values 1–4.
- **FR-015**: Each file in `specs/031-practice-view-plugin/` (`spec.md`, `plan.md`, `tasks.md`, `quickstart.md`) MUST receive a header notice at the top of the file stating that the plugin described was renamed to "Train" in feature 036, with a reference to the canonical path `frontend/plugins/train-view/`.

**Exercise Staff Display**

- **FR-016**: The exercise staff in the Train plugin MUST scale horizontally to fill the full available container width. The WASM layout engine MUST receive a `max_system_width` computed from the actual CSS pixel width of the staff container (converted to layout units: `px × 2 − LABEL_MARGIN`) so that the engraved notes spread across the entire staff area. The container MUST NOT display a horizontal scroll bar; `overflow-x: hidden` MUST be set on the staff wrapper.

**Microphone Lifecycle**

- **FR-017**: When the user leaves the Train view (component unmounts), the microphone stream MUST be released immediately. `context.recording.stop()` MUST be called in the unmount cleanup of `TrainPlugin`, which force-closes the `PluginMicBroadcaster` stream regardless of any pending subscriber-count logic. This ensures the browser mic indicator disappears as soon as the user navigates away.
- **FR-018**: The `PluginRecordingContext` interface MUST expose a `stop(): void` method in addition to `subscribe` and `onError`. The host MUST wire it to `pluginMicBroadcaster.stop()`. The broadcaster's `stop()` implementation MUST clear all pitch and error handlers and call the internal `stopMic()` teardown synchronously.

**Play Plugin Display Name**

- **FR-019**: The `play-score` plugin display name MUST be `"Play"` (not `"Play Score"`). The landing-screen launch button and any navigation entry that derives its label from `manifest.name` MUST read "Play".

### Key Entities

- **`PluginManifest`**: The runtime type for plugin metadata. Gains an optional `order: number` field that controls navigation position. All existing fields (`id`, `name`, `version`, `pluginApiVersion`, `entryPoint`, `description`, `type`, `view`, `icon`) are unchanged.
- **Train Plugin**: The renamed successor of the Practice plugin (`frontend/plugins/train-view/`). Functionally identical to the current Practice plugin — only names, identifiers, and file paths change.
- **Navigation Sort Order**: The rendering sequence of plugin navigation entries, derived from each plugin's `order` field in ascending numeric order, with unordered plugins appended last.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero instances of the word "Practice" appear in user-visible UI elements that refer to the renamed plugin, verified by manual review of the navigation bar, plugin header, config sidebar, and results screen after deployment.
- **SC-002**: The app navigation renders the Play Score entry before the Train entry on all supported browsers and device sizes, with no manual configuration required from any user.
- **SC-003**: Changing the `order` field value in any plugin manifest takes effect in the navigation order within one app reload, with no source-code change required beyond the manifest.
- **SC-004**: The app compiles with zero TypeScript errors and all existing tests pass after the rename, confirming no broken imports, missing identifiers, or broken test references.
- **SC-005**: A user who had saved settings under the old Practice plugin (last-used BPM, dismissed tips banner, selected complexity level) retains those settings after the update — verified by loading the Train plugin on a device with pre-existing `practice-` storage keys and confirming the values are present under the new `train-` keys.
- **SC-006**: The Plugin API documentation update covering the `order` field is present in the same feature branch before merge — no undocumented manifest schema surface is shipped.

## Assumptions

- The functional behaviour of the Train plugin is identical to the current Practice plugin; this feature covers naming and ordering only — no capability changes, bug fixes, or UX changes are in scope.
- The "Play Score" plugin display name (`manifest.name`) is changed to `"Play"` in this feature so that the landing-screen button and navigation label read "Play" consistently with the target app view sequence. This was originally noted as out of scope but was included in this branch (see FR-019).
- The "Practice" and "Performance" slots in the target navigation sequence (order 3 and 4 respectively) correspond to plugins not yet built. Assigning `order` values for those future plugins is out of scope here; this feature only asserts the order values for Play Score (1) and Train (2).
- The plugin `id` field MUST be changed from `"practice-view"` to `"train-view"` for full internal consistency (see FR-006b). Any id-keyed host storage (IndexedDB plugin registrations) must be migrated as part of the same update, following the same one-time migration pattern as FR-007.
- The virtual-keyboard plugin remains a visible navigation entry and intentionally does not receive an `order` assignment in this feature. It renders after all ordered plugins (Play Score, Train) as a deferred position — a dedicated future feature will assign its `order` value when the full navigation sequence (Play › Train › Practice › Performance) is finalised.
- The storage key migration (FR-007) covers only keys prefixed with `practice-` that are owned by this plugin. Any other parts of the app that use "practice" in storage keys for unrelated purposes are out of scope.
- All existing tests for the Practice plugin are updated to reference the new `Train` identifiers and file paths; no tests are deleted or skipped as part of this rename.

