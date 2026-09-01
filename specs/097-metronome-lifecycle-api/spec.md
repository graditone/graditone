# Feature Specification: Unified Metronome Lifecycle API

**Feature Branch**: `097-metronome-lifecycle-api`
**Created**: 2026-09-01
**Status**: Draft
**Input**: User description: "The metronome is a critical piece that will be used in several plugins. It must be as robust as possible and as clean as possible. Refactor so there is a clear metronome component with a clear API to control its lifecycle, used consistently by all plugins."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One shared metronome lifecycle API (Priority: P1)

A developer integrating the metronome into any plugin uses a single, consistent lifecycle API: `toggle()`, `arm()`, `disarm()`, `startFromDeferred()`, `setSubdivision()`, `subscribe()`. The "arm → start on first note → stop → re-arm" behaviour used by the Practice plugin is owned by one promoted engine/API layer plus one lifecycle hook, no longer duplicated across score-practice, free-practice, and toolbar code.

**Why this priority**: This is the entire refactor. A single robust API removes the duplicated lifecycle logic (currently spread across `PracticeViewPlugin.tsx`, `usePracticeMidi.ts`, `useFreePractice.ts`, `practiceToolbar.tsx`) and is the foundation every plugin builds on.

**Independent Test**: The engine exposes `armed` in its state; `arm()`/`disarm()`/`startFromDeferred()` are exercised through the plugin API; unit tests cover the lifecycle transitions without running the plugin UI.

**Acceptance Scenarios**:

1. **Given** an idle metronome, **When** `arm()` is called, **Then** `state.armed` is `true`, `state.active` is `false`.
2. **Given** an armed metronome, **When** `startFromDeferred()` is called, **Then** the engine starts (`active: true`, `armed: false`).
3. **Given** an idle metronome, **When** `startFromDeferred()` is called, **Then** nothing changes (`active` stays `false`).
4. **Given** a stopped (previously active) metronome, **When** `stop()` completes, **Then** `armed` is cleared (`active`/`armed` both `false`) unless a caller re-arms.
5. **Given** any plugin, **When** it subscribes, **Then** it receives `armed` in every `MetronomeState` snapshot (uniform field, Play/Train unaffected — they never arm).

### User Story 2 - Practice plugin uses only the shared lifecycle (Priority: P1)

The Practice plugin's score and free practice both drive the metronome through the single lifecycle hook built on the API. All bespoke armed/enabled refs (`metronomeArmedRef`, `scoreMetronomeEnabledRef`, `freeMetronomeEnabledRef`, `stopScoreMetronome`, `stopFreeMetronome`, the inline `onFirstNoteAttack`) are removed; the button state reads `state.armed`.

**Why this priority**: Eliminates the duplicate/diverging logic that caused the recent metronome regressions, and keeps behaviour identical: deferred start on first note when armed, immediate toggle mid-session, re-arm after stop/finish when the metronome was enabled.

**Independent Test**: Existing metronome plugin tests (deferred start, stop-on-finish, re-arm, no silent-arm) pass unchanged in behaviour; free-practice lifecycle tests pass unchanged.

**Acceptance Scenarios**:

1. **Given** practice is in 'waiting' mode, **When** the user toggles the metronome, **Then** it becomes `armed` (not ticking); the button shows the armed state.
2. **Given** an armed metronome and an idle practice session, **When** the first note is played, **Then** the engine starts on the first note (score practice and free practice behave identically).
3. **Given** a practice session finishes or is stopped with the metronome enabled, **When** results appear, **Then** the engine stops audibly and the metronome returns to the armed state.
4. **Given** a practice session finishes or is stopped with the metronome disabled, **When** results appear, **Then** the metronome remains fully off.
5. **Given** the user toggles the metronome OFF mid-session (active mode), **When** the session stops, **Then** the metronome stays off (preference cleared, no surprise re-arm).

### User Story 3 - Play and Train plugins unaffected (Priority: P2)

The Play and Train plugins continue to use `toggle()` / `setSubdivision()` / `subscribe()` exactly as before. Adding `armed` to `MetronomeState` is additive; their behaviour is unchanged.

**Why this priority**: Confirms the refactor is non-breaking for the simple consumers.

**Independent Test**: Play/Train metronome tests pass unchanged; their `MetronomeState` constants compile with the new field.

**Acceptance Scenarios**:

1. **Given** the Play plugin, **When** the user toggles the metronome, **Then** it starts/stops immediately as before (never arms).
2. **Given** the Train plugin, **When** the user toggles the metronome and subdivision, **Then** behaviour is identical to before the refactor.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The metronome must expose a single lifecycle API through `PluginMetronomeContext`: existing `toggle()`, `setSubdivision()`, `subscribe()`, plus new `arm()`, `disarm()`, `startFromDeferred()`.
- **FR-002**: `MetronomeState` MUST include a readonly `armed: boolean` field. Invariant: `armed` and `active` are mutually exclusive (`!(armed && active)`).
- **FR-003**: `arm()` MUST set `armed = true` only when the engine is not active (no-op while active). `disarm()` MUST clear `armed`. `toggle()` from `armed` MUST disarm (second-tap disarms), from `active` MUST stop, and otherwise MUST start immediately.
- **FR-004**: `startFromDeferred()` MUST start the engine (consuming `armed`) only when armed; otherwise MUST be a no-op. It MUST be safe to call from any plugin on every first-note event.
- **FR-005**: `stop()` MUST stop the engine AND clear `armed` (full stop). Callers that want "stopped but re-armed for next session" MUST call `arm()` afterwards — composed by the shared practice lifecycle hook.
- **FR-006**: The Practice plugin MUST drive the metronome exclusively through one shared lifecycle hook (new `useMetronomeLifecycle`) built on the API. All bespoke armed/enabled refs and stop/disarm helpers MUST be removed from practice code.
- **FR-007**: Score practice and free practice MUST produce identical metronome behaviour through the shared hook: armed in waiting, first-note deferred start, immediate toggle mid-session, re-arm on session end if enabled, full-off otherwise.
- **FR-008**: Practice toolbar MUST render armed/active solely from `MetronomeState` (`state.armed`, `state.active`), not from plugin-local flags.
- **FR-009**: Play and Train plugins MUST keep using only `toggle()`, `setSubdivision()`, `subscribe()`; their behaviour MUST be unchanged.

### Key Entities

- **MetronomeEngine**: audio engine (owning active/armed state). State transitions: `idle → armed`, `armed → active` (consumed), `active → idle` (stop), any → (no-op for invalid).
- **PluginMetronomeContext**: the plugin-facing lifecycle API (existing + `arm`/`disarm`/`startFromDeferred`).
- **useMetronomeLifecycle (Practice)**: unified practice-lifecycle policy hook over the API — owns the "enabled during session" preference and composes `arm`/`disarm`/`startFromDeferred`/`stop`.
- **MetronomeState**: shared snapshot incl. `armed`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero references to `metronomeArmed*`, `*MetronomeEnabledRef`, `stopScoreMetronome`, `stopFreeMetronome`, or bespoke `onFirstNoteAttack` logic remain in practice code (grep-verifiable).
- **SC-002**: 100% of existing metronome behaviour tests (deferred start, stop-on-finish, re-arm, no silent-arm, free lifecycle) pass unchanged or with only mechanical constant/name updates — no assertion about behaviour weakens.
- **SC-003**: `armed` is present in 100% of emitted `MetronomeState` snapshots; Play/Train suites pass with zero behaviour changes.
- **SC-004**: Score and free practice each have at least one test driving the full lifecycle (arm → first note → running → stop → re-arm) through the shared hook/API, not against plugin internals.

## Known Issues & Regression Tests *(if applicable)*

No issues recorded yet. This section will grow during implementation, deployment, or production use per Principle VII (Regression Prevention).