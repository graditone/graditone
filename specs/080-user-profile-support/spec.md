# Feature Specification: User Profile Support

**Feature Branch**: `080-user-profile-support`  
**Created**: 2025-04-19  
**Status**: Draft  
**Input**: User description: "User profile support. For all user state managed in the application it must have the related user profile. To change between profiles an icon must be shown in the toolbar in the rightest position. When you press in the profile button, you can change between profiles or create a new one."

## Clarifications

### Session 2026-04-19

- Q: Should the profile icon also be accessible from the landing page and plugin views, or only from the score toolbar? → A: Profile icon must appear on all pages (landing, score toolbar, and plugins). The active profile must always be visible.
- Q: Should each browser tab operate independently with its own active profile, or should all tabs synchronize to the same profile? → A: The active profile is set at the page level and must be respected in all tabs. Switching profile in one tab switches it in all tabs.
- Q: Can users rename an existing profile? → A: Yes, allow renaming.
- Q: Should profiles have any form of access protection (e.g., PIN)? → A: No protection — profiles are freely accessible to anyone on the device.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Switch Between Profiles (Priority: P1)

A user who shares a tablet with family members wants to quickly switch to their own profile so that their scores, practice history, and settings are separate from other users. They tap the profile icon on the far right of the toolbar, see a list of existing profiles, and tap their name to switch. All application state instantly reflects their personal data.

**Why this priority**: Profile switching is the core interaction that enables multi-user support on a single device. Without it, profiles have no practical purpose.

**Independent Test**: Can be tested by creating two profiles, adding a score to one, switching to the other, and verifying the score is not visible in the second profile.

**Acceptance Scenarios**:

1. **Given** two or more profiles exist, **When** the user taps the profile icon in the toolbar, **Then** a dropdown/panel shows all available profiles with the active profile visually highlighted.
2. **Given** the profile panel is open, **When** the user selects a different profile, **Then** the application state (scores, practice data, volume, plugin settings) switches to reflect that profile's data.
3. **Given** a profile switch occurs, **When** the new profile loads, **Then** the user sees the landing page with that profile's "My Scores" list and all previously saved state for that profile.
4. **Given** a profile switch occurs, **When** playback is active, **Then** playback stops before the switch completes to prevent state conflicts.

---

### User Story 2 - Create a New Profile (Priority: P1)

A new family member wants to start using Graditone on the same device. They tap the profile icon, select "Create new profile," enter a display name, and are switched into a fresh profile with no scores, default settings, and the demo score experience.

**Why this priority**: Without profile creation, multi-user support cannot function. This is equally critical to switching.

**Independent Test**: Can be tested by tapping the profile icon, choosing "Create new profile," entering a name, and verifying the new profile starts with a clean state and the demo score.

**Acceptance Scenarios**:

1. **Given** the profile panel is open, **When** the user taps "Create new profile," **Then** a name input is displayed.
2. **Given** the name input is shown, **When** the user enters a display name and confirms, **Then** a new profile is created and the user is switched to it immediately.
3. **Given** a new profile is created, **When** it loads, **Then** the state is clean: no "My Scores," default volume, default plugin settings, and the demo score is available for exploration.
4. **Given** a profile name is entered, **When** the name is empty or consists only of whitespace, **Then** the creation is rejected with a validation message.

---

### User Story 3 - First-Time User Gets a Default Profile (Priority: P2)

A first-time user opens Graditone with no prior data. The application creates a default profile automatically so existing behavior is preserved and the user is not forced through a profile setup flow.

**Why this priority**: Ensures backward compatibility and a seamless first launch. Users who never need multiple profiles should not be bothered by profile management.

**Independent Test**: Can be tested by clearing all application data and opening Graditone, verifying a default profile is silently created and the existing first-launch experience (demo score) works identically.

**Acceptance Scenarios**:

1. **Given** no profiles exist (fresh install or cleared data), **When** the application launches, **Then** a default profile named "Default" is created automatically and activated without any prompt.
2. **Given** the default profile is active, **When** the user interacts with all features, **Then** the experience is identical to the pre-profile behavior.
3. **Given** the user had data before this feature existed, **When** the application launches for the first time after the update, **Then** all existing state (scores, practices, volume, plugin settings) is migrated into the default profile seamlessly.

---

### User Story 4 - Profile Icon Always Visible (Priority: P1)

The profile icon must be visible and accessible on every page of the application — the landing page, the score toolbar, and all plugin views. It always appears at the rightmost position, showing the active profile at a glance and providing a consistent entry point for profile management.

**Why this priority**: The icon is the sole entry point for all profile operations. Without it, users cannot access any profile functionality. Visibility on all pages ensures users always know which profile is active before interacting with any data.

**Independent Test**: Can be tested by navigating to the landing page, loading a score, and opening a plugin view, verifying the profile icon is visible in the rightmost position on each page.

**Acceptance Scenarios**:

1. **Given** the user is on the landing page, **When** they look at the top navigation area, **Then** a profile icon is visible at the rightmost position indicating the active profile.
2. **Given** a score is loaded, **When** the user looks at the score toolbar, **Then** the profile icon is visible at the rightmost position.
3. **Given** a plugin view is active, **When** the user looks at the toolbar/header, **Then** the profile icon is visible at the rightmost position.
4. **Given** the profile icon is visible on any page, **When** the user taps it, **Then** the profile panel opens showing the list of profiles and a "Create new profile" option.
5. **Given** the profile panel is open, **When** the user taps outside the panel or taps the icon again, **Then** the panel closes.
6. **Given** any screen size (phone, tablet, desktop), **When** any page renders, **Then** the profile icon remains in the rightmost position and is accessible.

---

### User Story 5 - Delete a Profile (Priority: P3)

A user wants to remove an old profile that is no longer needed. They open the profile panel, find the profile, and delete it. All data associated with that profile is permanently removed.

**Why this priority**: Cleanup functionality is important but less critical than creation and switching for the initial release.

**Independent Test**: Can be tested by creating a profile, adding data, deleting the profile, and verifying all associated data is removed and the profile no longer appears in the list.

**Acceptance Scenarios**:

1. **Given** the profile panel is open, **When** the user selects a delete action on a profile, **Then** a confirmation prompt is shown warning that all data for that profile will be permanently removed.
2. **Given** the confirmation is accepted, **When** deletion completes, **Then** the profile and all its associated data (scores, practice history, settings) are removed.
3. **Given** the user deletes the currently active profile, **When** deletion completes, **Then** the user is switched to another existing profile.
4. **Given** only one profile exists, **When** the user attempts to delete it, **Then** the delete action is disabled or hidden, preventing the user from having zero profiles.

---

### Edge Cases

- What happens when profile data in storage becomes corrupted? The application should fall back to creating a new default profile and warn the user.
- What happens when storage quota is exceeded while creating a new profile? The user should see a clear error message indicating insufficient storage.
- What happens if the user switches profiles while a score import is in progress? The import should complete under the original profile before the switch takes effect.
- What happens when the user accesses the application in multiple browser tabs? All tabs must synchronize to the same active profile. When the user switches profiles in one tab, all other open tabs must reflect the new profile.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST create a default profile automatically on first launch, migrating any pre-existing user state into it.
- **FR-002**: System MUST allow users to create new profiles with a display name.
- **FR-003**: System MUST allow users to switch between profiles via the profile icon in the toolbar.
- **FR-004**: System MUST display a profile icon at the rightmost position on all pages (landing page, score toolbar, and plugin views), always indicating the active profile.
- **FR-005**: System MUST isolate all user state per profile, including: uploaded scores (My Scores), saved practice sessions, volume settings, plugin configuration (e.g., Train complexity level), and install banner dismissal state.
- **FR-006**: System MUST persist profile data locally using the existing storage mechanisms (localStorage and IndexedDB), scoped by profile identifier.
- **FR-007**: System MUST remember which profile was last active and restore it on application relaunch.
- **FR-008**: System MUST allow users to delete profiles (except the last remaining one), removing all associated data.
- **FR-009**: System MUST validate profile names (non-empty, trimmed) before creation.
- **FR-010**: System MUST stop any active playback before completing a profile switch.
- **FR-011**: System MUST seamlessly migrate existing pre-profile data into a default profile on first run after the update, without user intervention.
- **FR-012**: System MUST allow users to rename an existing profile, applying the same validation rules as profile creation (non-empty, trimmed).
- **FR-013**: The Plugin API MUST expose profile storage helpers (`scopedGetItem`, `scopedSetItem`, `scopedRemoveItem`, `getActiveProfileId`) and the `ProfileIcon` component so that external plugins can scope their own storage and render the profile icon in their toolbars without importing internal host modules.
- **FR-014**: External plugins (e.g., Sessions Plugin) MUST scope their localStorage index keys and IndexedDB records by `profileId`, using only the Plugin API exports. Sessions and Goals must be isolated per profile.
- **FR-015**: The Vite build configuration MUST resolve the Plugin API barrel correctly for symlinked external plugins via a `resolve.alias`, ensuring production builds succeed regardless of plugin installation method.

### Key Entities

- **Profile**: Represents a user identity on the device. Key attributes: unique identifier, display name (can be renamed), creation timestamp, last-active timestamp.
- **Profile State**: The collection of all user-specific data associated with a profile: score index, practice history, volume setting, plugin preferences, and UI dismissal states.
- **Active Profile**: The currently selected profile whose state is reflected throughout the application. Only one profile can be active at a time.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create a new profile and switch to it in under 10 seconds.
- **SC-002**: All user-facing state (scores, practice data, settings) is fully isolated between profiles — no data leaks between profiles under any usage pattern.
- **SC-003**: First-time users and upgrading users experience zero disruption — the default profile is created transparently and all existing data is preserved.
- **SC-004**: Profile switching reflects the new profile's complete state within 2 seconds.
- **SC-005**: The profile icon is discoverable and accessible on all supported screen sizes without obscuring other toolbar controls.
- **SC-006**: 100% of existing application features continue to function identically after the profile system is introduced (backward compatibility).

## Assumptions

- Profiles are local-only (no cloud sync or authentication). Each device maintains its own set of profiles.
- The active profile is a page-level setting synchronized across all browser tabs. Switching in one tab updates all tabs.
- Profiles have no access protection (no PIN, no password). Any user on the device can freely switch to, modify, or delete any profile.
- The number of profiles per device is expected to be small (typically 2–5 family members). No pagination is needed for the profile list.
- Profile display names do not need to be unique — users are identified internally by a generated unique identifier.
- The profile icon will use a generic person/avatar icon consistent with the existing UI style.
- IndexedDB object stores can be keyed or partitioned by profile identifier without requiring a database schema version upgrade, or the upgrade path is handled transparently.
- The demo score is loaded fresh for each new profile, matching the current first-launch behavior.

