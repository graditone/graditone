# Feature Specification: Plugin Manager Dialog

**Feature Branch**: `048-plugin-manager-dialog`  
**Created**: 2026-03-13  
**Status**: Draft  
**Input**: User description: "Rework plugins interface — In order to load and remove plugins, let's remove the current +/- buttons and add a plugins button. When it is pressed, a plugin dialog identical to the load score one is shown in order to load a plugin (like we load a score). In the dialog, the already installed plugins are shown, and they can be removed from this list, like we do for score. Explore if this dialog type can be offered in the Plugins API to be used for other plugins in the future."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Unified Plugin Manager Dialog (Priority: P1)

A user who regularly manages plugins is frustrated by the disjointed +/- button experience. With this feature, they tap a single "Plugins" button in the header and a familiar dialog appears — matching the single-panel score selection modal used in Play and Practice views — where they can see all their imported plugins in a list and remove any of them directly from that same view, without navigating to a separate removal dialog. The entire plugin management workflow lives in one place.

**Why this priority**: This is the core change. Replacing the +/- pair with a single, unified entry point simplifies the mental model and reduces the header clutter. Every other story depends on this dialog existing.

**Independent Test**: Open the app, click the Plugins button in the header, verify the Plugin Manager dialog opens showing installed plugins with remove actions — and that the old +/- buttons are gone. This alone delivers a cleaner interface.

**Acceptance Scenarios**:

1. **Given** the app has loaded with no plugins installed, **When** the user looks at the plugin navigation area in the header, **Then** they see a single "Plugins" button at the right edge and no separate + or − buttons — this button is the entry point to install the first plugin.
2. **Given** the Plugins button is visible, **When** the user clicks it, **Then** the Plugin Manager dialog opens with the same visual style as the score selection dialog used in Play and Practice views: a single-panel modal with a scrollable list and an import action.
3. **Given** the Plugin Manager dialog is open and the user has previously imported plugins, **When** they view the dialog, **Then** each imported plugin appears as a labeled row in a list with a remove action next to it.
4. **Given** a plugin row is shown, **When** the user activates the remove action for that plugin, **Then** the plugin is unloaded and removed from the list, and the header plugin tabs update immediately to reflect the change.
5. **Given** the Plugin Manager dialog is open, **When** the user presses Escape or clicks outside the dialog, **Then** the dialog closes without any changes.

---

### User Story 2 - Import Plugin From Dialog (Priority: P2)

A user wants to try a new external plugin. Instead of clicking a separate + button, they open the single Plugins dialog and find an "Import Plugin" action directly inside it, equivalent to how they upload a new score via the Score Loading dialog. They select their plugin ZIP file from disk and the newly imported plugin immediately appears in the dialog's list — and in the header — without needing to close and reopen anything.

**Why this priority**: Importing plugins is the second half of plugin management. Keeping this within the unified dialog is essential for the "one place" vision, but importing can still be done via the old mechanism in an interim step, making this independently testable.

**Independent Test**: Open the Plugins dialog with no installed plugins, use the Import action to select a valid plugin ZIP, confirm the plugin appears in the list and the dialog header tab appears — standalone success without needing the remove flow.

**Acceptance Scenarios**:

1. **Given** the Plugin Manager dialog is open, **When** the user looks at the dialog's action area, **Then** they see an "Import Plugin" entry (equivalent to the "Load New Score" button in the Score dialog).
2. **Given** the user activates "Import Plugin", **When** they select a valid plugin ZIP file from disk, **Then** the plugin is validated, imported, appears in the list within the dialog, and a new tab for it appears in the header; the dialog remains open so the user can continue managing plugins.
3. **Given** the user tries to import a plugin whose ID already exists, **When** they confirm overwrite in a prompt, **Then** the existing plugin is replaced and the list reflects the updated version.
4. **Given** the user selects an invalid or oversized file, **When** the import is attempted, **Then** a clear error message is shown inside the dialog without dismissing it.

---

### User Story 3 - Plugin Dialog API for Third-Party Plugins (Priority: P3)

A plugin developer building a custom plugin wants to show users a similar item selection dialog without reimplementing that UI pattern from scratch. The Plugin API exposes a new dialog capability that lets a plugin open a list dialog with custom items and actions, following the same visual style as the Plugin Manager and Score Loading dialogs.

**Why this priority**: This unlocks reuse for the ecosystem. It is a lower priority than the core manager dialog because it requires extracting the dialog into a reusable component first. It does not block any user-facing plugin management capability.

**Independent Test**: A plugin calls the new API to open a dialog listing custom items. The dialog renders with the same look-and-feel as the built-in plugin and score dialogs. This can be tested with a simple demo or test plugin independently of any other story.

**Acceptance Scenarios**:

1. **Given** the Plugin API, **When** a plugin accesses the new dialog capability, **Then** it can open a list dialog where each item has a label, an optional icon, and one configurable action with a custom label (e.g., "Remove", "Open", "Select").
2. **Given** a plugin-opened dialog is displayed, **When** the user interacts with it, **Then** the visual style matches the Plugin Manager dialog (same font, spacing, modal behavior, close behavior).
3. **Given** the Plugin API is updated to include this capability, **When** existing plugins that do not use it are loaded, **Then** there is no regression in their behavior.

---

### Edge Cases

- What happens when no plugins have been imported yet? The plugin list area shows an empty state message (e.g., "No plugins installed yet") and only the Import action is available.
- What happens if a plugin to be removed is currently the active/visible plugin? The active plugin view closes first, then the plugin is removed from the list.
- What if plugin removal fails due to a storage error? An inline error message is shown in the dialog row; the plugin remains in the list.
- What if the user imports a plugin while the dialog is open and then immediately tries to remove it? The newly added plugin's remove action must be functional without requiring a dialog close/reopen.
- What if there are many installed plugins (e.g., 20+)? The list area scrolls within the dialog bounds; the dialog does not grow taller than the viewport.
- What about built-in (auto-discovered) plugins that are part of the application bundle? They do not appear in the Plugin Manager dialog list because they cannot be removed by the user. Only user-imported plugins are shown.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST replace the separate Import Plugin (+) and Remove Plugin (−) header buttons with a single "Plugins" button, positioned at the right edge of the plugin navigation area (after all plugin tabs). The button MUST always be visible, including when no plugins are installed, as it is the entry point for importing the first plugin.
- **FR-002**: The "Plugins" button MUST open a unified Plugin Manager dialog using a single-panel layout: a scrollable list of installed plugins fills the main area, with an "Import Plugin" action anchored at the top or bottom. The dialog MUST match the visual style of the score selection modal used in Play and Practice views (modal chrome, backdrop, keyboard dismissal).
- **FR-003**: The Plugin Manager dialog MUST display all user-imported plugins in a scrollable list, each row showing the plugin name and a remove action.
- **FR-004**: A user MUST be able to remove an installed plugin directly from the Plugin Manager dialog list; the plugin MUST be unloaded and its header tab removed immediately upon confirmation.
- **FR-005**: The Plugin Manager dialog MUST include an "Import Plugin" action that allows the user to select a plugin ZIP file from disk, applying the same validation rules (file size limit, manifest validation, ID format check) as the current importer. After a successful import the dialog MUST remain open, with the new plugin visible in the list, so the user can continue managing plugins without reopening the dialog.
- **FR-006**: When a plugin that is currently active/displayed is removed, the system MUST deactivate and hide it before completing removal.
- **FR-007**: The Plugin Manager dialog MUST support standard modal dismissal: pressing Escape or clicking the backdrop closes the dialog with no side effects.
- **FR-008**: The Plugin Manager dialog MUST show an empty-state message when no user-imported plugins are installed.
- **FR-009**: Built-in (auto-discovered, non-removable) plugins MUST NOT appear in the Plugin Manager dialog list.
- **FR-010**: The system SHOULD extract the Plugin Manager dialog's list-and-actions pattern into a reusable capability that third-party plugins can invoke via the Plugin API. Each list item MUST support: a label (required), an optional icon, and exactly one configurable action with a custom label (e.g., "Remove", "Open", "Select").
- **FR-011**: The Plugin API, when extended with a dialog capability, MUST be backward-compatible so that existing plugins continue to work without modification.

### Key Entities

- **ImportedPlugin**: A user-supplied plugin stored in the application's local persistence (id, name, version, origin). This is the entity shown in the Plugin Manager dialog list.
- **PluginManagerDialog**: The unified modal surface for viewing, importing, and removing user-imported plugins. Shares visual design language with the Score Loading dialog.
- **ListDialogAPI** *(exploratory)*: A Plugin API capability that allows third-party plugins to open a similarly structured list dialog. Each item in the dialog consists of: a required label, an optional icon, and exactly one configurable action with a custom label.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can open, manage (import or remove a plugin), and close the Plugin Manager dialog in under 60 seconds from a standing start.
- **SC-002**: The header plugin navigation area is visually simpler after this change: exactly one "Plugins" button replaces two buttons, reducing the button count by one element.
- **SC-003**: All existing plugin management outcomes (import, remove, activate) remain fully achievable through the new unified dialog — no capability is lost.
- **SC-004**: The Plugin Manager dialog's visual design is consistent enough with the Score Loading dialog that 90% of users recognize the same interaction pattern without instructions.
- **SC-005**: Third-party plugins can open a list dialog using no more than a 5-line call in their plugin code, without reimplementing any modal or list rendering.

## Assumptions

- Only user-imported plugins appear in the Plugin Manager dialog. Built-in plugins bundled with the application are not shown because they cannot be removed by the user.
- The visual reference for the Plugin Manager dialog is the single-panel score selection modal used in the Play and Practice views (not the two-panel `LoadScoreDialog` in the main app). It shares the same modal chrome, backdrop behavior, and keyboard dismissal, with a scrollable list and a single import action.
- The Plugin API versioning for the new dialog capability will follow the project's established versioning convention.
- No confirmation prompt is required for plugin removal by default; the remove action is direct, matching the behavior used for removing user-uploaded scores in the Score Loading dialog.

## Clarifications

### Session 2026-03-13

- Q: After importing a plugin through the Plugin Manager dialog, what happens next (auto-close and activate, or stay in dialog)? → A: Stay in dialog; imported plugin appears in the list; user closes the dialog manually when done.
- Q: Where does the "Plugins" button sit in the header relative to the plugin tabs? → A: Right edge of the plugin navigation area, after all currently open plugin tabs (same position as the old +/− buttons).
- Q: What item shape does the Plugin API list dialog support? → A: Items with a required label, optional icon, and one action with a configurable label (e.g., "Remove", "Open").
- Q: Is the Plugins button visible when no plugins are installed? → A: Always visible — it is the entry point to install the first plugin.
- Q: What is the layout of the Plugin Manager dialog, and which score dialog is the visual reference? → A: Single-panel layout; the visual reference is the score selection dialog in Play and Practice views (not the two-panel main app dialog).

