# Feature Specification: Fix MIDI Detection in Tablet in Practice Mode

**Feature Branch**: `081-fix-tablet-midi`  
**Created**: 2026-04-20  
**Status**: Closed — Verified 2026-04-20. Root cause: Android MIDI subsystem blocked under low-battery/power-saving mode. Fix confirmed working on tablet with adequate charge. PR #449.  
**Input**: User description: "fix MIDI detection in tablet in practice mode"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - MIDI Device Detected on Tablet in Practice Mode (Priority: P1)

A musician opens the app on a tablet device with a MIDI keyboard connected (via USB adapter or Bluetooth). They navigate to the Practice view and activate practice mode. The app correctly detects the MIDI device and shows the MIDI-connected indicator, allowing them to play notes from the keyboard and have them registered by the practice engine.

**Why this priority**: This is the core bug — MIDI detection fails on tablets in practice mode, making the practice feature completely unusable for tablet users with MIDI keyboards. This is the primary flow that must be fixed.

**Independent Test**: Can be fully tested by connecting a MIDI device on a tablet browser, opening Practice mode, and verifying that the MIDI connectivity indicator shows "connected" and that key presses register in the practice engine.

**Acceptance Scenarios**:

1. **Given** a tablet device with a MIDI input device connected and the app open in practice mode, **When** the practice view loads, **Then** the MIDI connectivity indicator correctly reflects the connected state (not "no MIDI device").
2. **Given** a tablet device with a MIDI device connected and practice mode active, **When** the user presses a note on the MIDI keyboard, **Then** the note is registered by the practice engine and the correct visual feedback is shown.
3. **Given** a tablet device where MIDI access is requested, **When** the Web MIDI API is unavailable (e.g. iOS Safari without a MIDI bridge), **Then** the app shows a clear "MIDI not supported on this device" message instead of silently failing or staying in a "checking" state indefinitely.

---

### User Story 2 - MIDI Connection Status Resolves Within Expected Time on Tablet (Priority: P2)

A musician on a tablet waits for the practice view to detect their MIDI keyboard. The app does not hang in a "checking" state — it resolves to either "connected" or "no MIDI" within a reasonable time even if the tablet takes longer to grant MIDI access permissions than a desktop browser.

**Why this priority**: On tablets, MIDI permission prompts or slower hardware negotiation can cause the existing check to time out or stall, leaving the user with a false or perpetual "no MIDI" state even though the device is available.

**Independent Test**: Can be tested by loading the practice view on a tablet with a MIDI device and observing whether the MIDI status indicator eventually settles to "connected" within a bounded time.

**Acceptance Scenarios**:

1. **Given** a tablet where MIDI access permission is slow to be granted, **When** the user waits in the practice view, **Then** the MIDI state resolves to "connected" once the permission is granted (within 8 seconds of opening the view).
2. **Given** a tablet where MIDI access is denied by the user, **When** the practice view loads, **Then** the MIDI indicator shows "no MIDI" immediately after denial, without leaving a perpetual "checking" state.

---

### User Story 3 - MIDI Device Hot-plug Detected on Tablet in Practice Mode (Priority: P3)

A musician opens practice mode on a tablet without their MIDI keyboard connected, then connects it mid-session. The app detects the new device and updates the MIDI indicator without requiring a page reload.

**Why this priority**: Hot-plug support is the expected standard behavior already working on desktop; this ensures parity for tablet users.

**Independent Test**: Can be tested by opening practice mode on a tablet with no MIDI device, connecting a MIDI keyboard, and observing whether the MIDI status indicator updates to "connected" within a few seconds.

**Acceptance Scenarios**:

1. **Given** practice mode open on a tablet with no MIDI device, **When** the user plugs in (or pairs via Bluetooth) a MIDI keyboard, **Then** the MIDI indicator updates to show "connected" within 2 seconds.
2. **Given** practice mode open on a tablet with a connected MIDI device, **When** the user unplugs the device, **Then** the MIDI indicator updates to show "no MIDI" within 2 seconds.

---

### Edge Cases

- What happens when the tablet browser does not support Web MIDI API at all (e.g. iOS Safari without a WebMIDI bridge)?
- How does the app behave when multiple MIDI devices are connected and then one disconnects on a tablet?
- What happens when the user denies MIDI permission on the tablet and then navigates away and back to practice mode?
- What happens if the MIDI connection check races with the practice mode start — does the practice engine start without MIDI, or wait for the MIDI check to complete?
- What happens on tablets with power-saving modes that may delay background permission grants?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The practice view MUST correctly reflect MIDI device connectivity on tablet browsers that support the Web MIDI API (e.g. Chrome for Android, desktop-mode Chrome on iPad).
- **FR-002**: The MIDI connectivity check in practice mode MUST complete (resolve to connected or not-connected) within 8 seconds of the practice view mounting, even on tablet devices with slower permission negotiation.
- **FR-003**: When the Web MIDI API is unavailable on the tablet browser, the practice view MUST display a clear, user-friendly "MIDI not supported on this browser/device" message rather than silently stalling or displaying an incorrect status.
- **FR-004**: The MIDI statechange listener in practice mode MUST correctly detect hot-plug events (connect and disconnect) on tablet devices, consistent with desktop behavior.
- **FR-005**: The MIDI connectivity state in practice mode MUST NOT remain in the `null` (checking) state indefinitely — it MUST transition to a definitive connected or not-connected state within a bounded time.
- **FR-006**: The fix MUST NOT break existing MIDI detection behavior on desktop browsers.
- **FR-007**: The fix MUST NOT interfere with the MIDI subscription used by the practice engine for note events, which is a separate code path from the connectivity indicator check.

### Key Entities

- **MIDI Connectivity State**: A three-value state (pending / connected / not-connected) shown in the practice toolbar. Drives the "no MIDI device" notice. Must resolve to a definitive value within a bounded time.
- **MIDI Permission Negotiation**: The browser's process of granting or denying access to MIDI hardware. On tablets this may be slower or produce different outcomes than on desktop.
- **Tablet Browser**: Any mobile browser on a tablet device — primarily Chrome on Android tablets and Chrome in desktop-mode on iPad — where Web MIDI API behavior may differ from desktop Chrome.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On all supported tablet browsers (Chrome on Android, desktop-mode Chrome on iPad), the MIDI connectivity indicator shows "connected" within 8 seconds when a MIDI device is plugged in before opening the practice view.
- **SC-002**: The MIDI connectivity state resolves from pending to a definitive value in under 8 seconds on all supported tablet browsers, with no indefinitely-stuck "checking" state.
- **SC-003**: Zero regression in desktop MIDI detection — existing desktop users report no new MIDI connectivity issues after the fix is deployed.
- **SC-004**: When MIDI is unavailable on the tablet browser, users see a legible status message within 2 seconds of opening the practice view.
- **SC-005**: Hot-plug detection (device connected after practice view is already open) works on tablet within 2 seconds of physical connection on supported browsers.

## Assumptions

- The bug manifests in the MIDI connectivity check within `PracticeViewPlugin` (the `midiConnected` state derived from `requestMIDIAccess`), not in the note-event subscription path used by the practice engine.
- Tablets using iOS Safari without a Web MIDI bridge are out of scope for full MIDI support; the fix only needs to handle the "unsupported" state gracefully rather than adding new MIDI support to Safari.
- Desktop browser behavior is correct and must be preserved — no changes to desktop logic unless strictly required.
- The issue is most likely a missing timeout guard or an incorrect handling of the `null` initial state on tablet, rather than a fundamental incompatibility.

## Known Issues & Regression Tests *(if applicable)*

*(This section will be populated as issues are discovered during implementation.)*

