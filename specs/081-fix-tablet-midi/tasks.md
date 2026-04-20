# Tasks: Fix MIDI Detection in Tablet in Practice Mode

**Input**: Design documents from `/specs/081-fix-tablet-midi/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, quickstart.md ✓

**Tests**: Included (TDD — Constitution Principle V; useMidiConnectivity.test.ts written before implementation)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Scaffold new files and confirm bug scope in existing code

- [X] T001 Read inline MIDI effect in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx` (lines ~140–170) to confirm the three defects (no timeout, silent catch, missing API-absent state set)
- [X] T002 [P] Create `frontend/plugins/practice-view-plugin/useMidiConnectivity.ts` with skeleton export (empty hook stub returning placeholder state)
- [X] T003 [P] Create `frontend/plugins/practice-view-plugin/useMidiConnectivity.test.ts` with `describe` block, imports for mockMidi helpers, and `vi.useFakeTimers()` setup

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared type definitions and i18n keys required by all user stories before any story implementation

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Define `MidiConnectivityState` interface `{ connected: boolean | null; supported: boolean }` and export it from `frontend/plugins/practice-view-plugin/useMidiConnectivity.ts`
- [X] T005 [P] Add `"practice.toolbar.midi_not_supported": "MIDI is not supported in this browser"` key to `frontend/src/i18n/locales/en.json`
- [X] T006 [P] Add `"practice.toolbar.midi_not_supported": "MIDI no está disponible en este navegador"` key to `frontend/src/i18n/locales/es.json`

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 — MIDI Device Detected on Tablet in Practice Mode (Priority: P1) 🎯 MVP

**Goal**: Core bug fix — MIDI connectivity indicator correctly shows "connected" or "not supported" on tablet, replacing the indefinitely-stuck `null` state from the inline effect.

**Independent Test**: Connect a MIDI device on a tablet browser (Chrome on Android or desktop-mode Chrome on iPad), open Practice mode, verify the MIDI indicator shows "connected" and key presses register. On iOS Safari (no MIDI bridge), verify "MIDI not supported" message appears within 2s.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T007 [P] [US1] Write test: API-absent path (`'requestMIDIAccess' not in navigator`) → hook returns `{ supported: false, connected: false }` synchronously on mount, in `frontend/plugins/practice-view-plugin/useMidiConnectivity.test.ts`
- [X] T008 [P] [US1] Write test: MIDI device present at mount → `connected` transitions from `null` to `true` once `requestMIDIAccess()` resolves, using `mockMidiSupported` + `createMockMidiAccess` from `frontend/src/test/mockMidi.ts`, in `frontend/plugins/practice-view-plugin/useMidiConnectivity.test.ts`
- [X] T009 [P] [US1] Write test: no MIDI devices present → `connected` transitions from `null` to `false` once access resolves with empty inputs, in `frontend/plugins/practice-view-plugin/useMidiConnectivity.test.ts`
- [X] T010 [P] [US1] Write test: `midiSupported={false}` prop → `practiceToolbar` renders the `practice.toolbar.midi_not_supported` i18n message, in `frontend/plugins/practice-view-plugin/practiceToolbar.test.tsx`

### Implementation for User Story 1

- [X] T011 [US1] Implement `useMidiConnectivity` — API-absent synchronous branch: if `!('requestMIDIAccess' in navigator)` set `{ supported: false, connected: false }` immediately in `frontend/plugins/practice-view-plugin/useMidiConnectivity.ts` (T007 must pass)
- [X] T012 [US1] Implement `useMidiConnectivity` — `requestMIDIAccess()` success branch: await access, resolve `connected` from `access.inputs.size > 0` in `frontend/plugins/practice-view-plugin/useMidiConnectivity.ts` (T008, T009 must pass)
- [X] T013 [US1] Add `midiSupported: boolean` prop to `PracticeToolbar` component signature and render `practice.toolbar.midi_not_supported` i18n message when `midiSupported === false` in `frontend/plugins/practice-view-plugin/practiceToolbar.tsx` (T010 must pass)
- [X] T014 [US1] Replace inline MIDI `useEffect` in `PracticeViewPlugin.tsx` with `const { connected, supported } = useMidiConnectivity()` and pass both values as props to `<PracticeToolbar midiConnected={connected} midiSupported={supported} />` in `frontend/plugins/practice-view-plugin/PracticeViewPlugin.tsx`

**Checkpoint**: US1 complete — core MIDI detection works on tablet; "MIDI not supported" shown on iOS Safari; no regressions on desktop

---

## Phase 4: User Story 2 — MIDI Connection Status Resolves Within Expected Time on Tablet (Priority: P2)

**Goal**: MIDI state always resolves to a definitive value within 8 seconds — no indefinitely-stuck "checking" state, even when tablet permission prompts are slow or access is denied.

**Independent Test**: Load practice view on a tablet with a MIDI device; observe that the MIDI status indicator settles to "connected" or "no MIDI" within 8 seconds even if permission prompt takes time. Deny the prompt — observe "no MIDI" shows promptly (not stuck at null).

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T015 [P] [US2] Write test: `requestMIDIAccess()` never resolves (slow permission) → `connected` resolves to `false` after `MIDI_CONNECTIVITY_TIMEOUT_MS` (8000ms) using `vi.useFakeTimers()` + `vi.advanceTimersByTime(8000)` in `frontend/plugins/practice-view-plugin/useMidiConnectivity.test.ts`
- [X] T016 [P] [US2] Write test: `requestMIDIAccess()` rejects (permission denied) → `connected` transitions to `false` (not stuck at `null`), using `mockMidiUnsupported` from `frontend/src/test/mockMidi.ts`, in `frontend/plugins/practice-view-plugin/useMidiConnectivity.test.ts`

### Implementation for User Story 2

- [X] T017 [US2] Add `MIDI_CONNECTIVITY_TIMEOUT_MS = 8000` named constant and `Promise.race([requestMIDIAccess(), timeoutPromise])` timeout guard to `useMidiConnectivity` in `frontend/plugins/practice-view-plugin/useMidiConnectivity.ts` (T015 must pass)
- [X] T018 [US2] Add `.catch(() => setConnected(false))` handler to the `requestMIDIAccess()` promise chain so that permission denial sets `connected = false` rather than leaving it at `null` in `frontend/plugins/practice-view-plugin/useMidiConnectivity.ts` (T016 must pass)

**Checkpoint**: US2 complete — MIDI state always resolves within 8s; denial and timeout cases handled; `null` state is bounded

---

## Phase 5: User Story 3 — MIDI Device Hot-plug Detected on Tablet in Practice Mode (Priority: P3)

**Goal**: Practice mode detects MIDI devices plugged in or unplugged after the view is already open, updating the indicator within 2 seconds — matching existing desktop behavior.

**Independent Test**: Open practice mode on a tablet with no MIDI device; connect a MIDI keyboard; observe MIDI status indicator updates to "connected" within 2s. Disconnect — observe "no MIDI" within 2s.

### Tests for User Story 3

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T019 [P] [US3] Write test: MIDI device connected after mount → statechange event fires → `connected` updates to `true`, using `fireMidiStateChange` from `frontend/src/test/mockMidi.ts`, in `frontend/plugins/practice-view-plugin/useMidiConnectivity.test.ts`
- [X] T020 [P] [US3] Write test: MIDI device disconnected after mount → statechange event fires → `connected` updates to `false`, in `frontend/plugins/practice-view-plugin/useMidiConnectivity.test.ts`

### Implementation for User Story 3

- [X] T021 [US3] Add `access.addEventListener('statechange', handler)` (NOT `access.onstatechange =` assignment — would clobber `useMidiInput`) inside the `requestMIDIAccess()` success branch to recompute `connected` on device changes in `frontend/plugins/practice-view-plugin/useMidiConnectivity.ts` (T019, T020 must pass)
- [X] T022 [US3] Add cleanup — `return () => access.removeEventListener('statechange', handler)` from the `useEffect` in `frontend/plugins/practice-view-plugin/useMidiConnectivity.ts`

**Checkpoint**: US3 complete — hot-plug detection works on tablet; all three user stories independently verifiable

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Regression verification and final validation across all stories

- [X] T023 [P] Run `npx vitest run src/i18n/locales.test.ts` from `frontend/` to verify locale parity is maintained with new `midi_not_supported` keys in both en.json and es.json
- [X] T024 [P] Run `npx vitest run plugins/practice-view-plugin/` from `frontend/` to verify all new tests (useMidiConnectivity, practiceToolbar) and existing `PracticeViewPlugin.test.tsx` pass green
- [X] T025 Run `npx vitest run` from `frontend/` to confirm zero regressions across the full frontend test suite
- [X] T026 [P] Follow manual tablet verification checklist in `specs/081-fix-tablet-midi/quickstart.md` (Test 1–4: device pre-connected, hot-plug, iOS Safari unsupported, permission denied)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — type definitions block hook implementation; i18n keys block toolbar rendering
- **User Story 1 (Phase 3)**: Depends on Phase 2 — implements core detection + API-absent path + toolbar wiring
- **User Story 2 (Phase 4)**: Depends on Phase 3 — extends the hook skeleton with timeout/catch robustness
- **User Story 3 (Phase 5)**: Depends on Phase 4 — extends the hook with statechange hot-plug listener
- **Polish (Phase 6)**: Depends on all user story phases completing

### User Story Dependencies

- **US1 (P1)**: Only depends on Foundational — implements the core detection path; standalone MVP
- **US2 (P2)**: Depends on US1 hook skeleton existing — adds timeout and denial robustness without changing the shape
- **US3 (P3)**: Depends on US2 (resolved state exists in hook) — adds statechange listener on the same `MIDIAccess` object

### Within Each User Story

- Tests MUST be written first and confirmed **failing** before implementation tasks begin
- Hook implementation tasks (T011→T012, T017→T018, T021→T022) accumulate in the same file — must be sequential
- Toolbar changes (T013) before plugin wiring (T014) — plugin depends on toolbar accepting new prop

### Parallel Opportunities

- T002 and T003 (Phase 1 file creation): Can run in parallel
- T005 and T006 (i18n keys in en.json / es.json): Can run in parallel
- T007, T008, T009, T010 (US1 test authoring): All can be written in parallel (independent test cases)
- T015 and T016 (US2 test authoring): Can run in parallel
- T019 and T020 (US3 test authoring): Can run in parallel
- T023 and T024 (Phase 6 regression runs): Can run in parallel

---

## Parallel Example: User Story 1

```bash
# Write all US1 tests in parallel (independent test cases in the same file):
# T007, T008, T009 → useMidiConnectivity.test.ts
# T010              → practiceToolbar.test.tsx

# Confirm all FAIL before implementation:
npx vitest run plugins/practice-view-plugin/useMidiConnectivity.test.ts  # red
npx vitest run plugins/practice-view-plugin/practiceToolbar.test.tsx     # red

# Implement sequentially:
# T011 → T012 → T013 → T014

# Verify green:
npx vitest run plugins/practice-view-plugin/
```

---

## Implementation Strategy

**MVP**: Complete Phase 3 (US1) first — this fixes the core bug and delivers a usable tablet experience. Basic detection + "not supported" message covers the primary complaint.

**Incremental delivery**:
1. **US1 (Phase 3)** → Tablet MIDI detection works; "not supported" on iOS Safari; desktop unaffected
2. **US2 (Phase 4)** → No more infinite "checking" state; slow permission + denial handled within 8s
3. **US3 (Phase 5)** → Hot-plug parity with desktop; device connect/disconnect reactive

**TDD Discipline**: Each story's tests must be written, run, and confirmed **red** before the matching implementation tasks. Use mock infrastructure from `frontend/src/test/mockMidi.ts` (`mockMidiSupported`, `mockMidiUnsupported`, `createMockMidiAccess`, `fireMidiStateChange`). For the timeout test (T015), use `vi.useFakeTimers()` + `act(async () => { vi.advanceTimersByTime(8000); })`.

**Key constraint (FR-007)**: `useMidiConnectivity` MUST use `addEventListener('statechange', …)` — never assign `onstatechange` directly, which would clobber the existing handler in `useMidiInput`.
