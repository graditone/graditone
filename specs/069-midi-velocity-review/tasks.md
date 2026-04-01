# Tasks: Review MIDI Keys Velocity

**Input**: Design documents from `/specs/069-midi-velocity-review/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Baseline** (2026-04-01): 1750/1775 tests pass in `frontend/` (25 skipped). All changes are frontend-only (`frontend/src/`). No backend, WASM, or sessions-plugin changes.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. Tests are included per Constitution Principle V (Test-First Development — MANDATORY).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unresolved dependencies)
- **[Story]**: `[US1]`, `[US2]`, `[US3]`, `[US4]` — user story phase tasks only
- Exact file paths are included in every task description

---

## Phase 1: Setup

**Purpose**: Establish a green baseline before any changes.

- [X] T001 Verify existing test suite passes with `npx vitest run` in frontend/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Type extensions that ALL user story phases depend on. Must be complete before Phase 3.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 Add optional `velocity?: number`, `channel?: number`, `rawBytes?: readonly number[]` to `NoteOnset` and `rawBytes?: readonly number[]` to `MidiNoteEvent` in frontend/src/types/recording.ts
- [X] T003 Run `npm run typecheck` in frontend/ and confirm zero errors (pure type additions must compile cleanly with backward-compatible optional fields)

**Checkpoint**: All optional fields present on `NoteOnset` and `MidiNoteEvent`. Typecheck passes. No runtime behavior has changed yet.

---

## Phase 3: User Story 1 — View Velocity for Each Played Note (Priority: P1) 🎯 MVP

**Goal**: Every MIDI note in the Recording view note history shows its numeric velocity value. Mic-path entries show nothing (FR-006).

**Independent Test**: Connect MIDI controller → play notes at soft and hard touch → verify velocity numbers (e.g. 30, 110) appear next to each note label and elapsed time. Switch to mic input → verify no velocity column appears.

### Tests for User Story 1 (write FIRST — must FAIL before T006/T007)

- [X] T004 [P] [US1] Write failing tests for NoteHistoryList velocity number: entry with `velocity: 80` renders `"80"`, entry without velocity (mic path) renders no velocity column in frontend/src/components/recording/NoteHistoryList.test.tsx
- [X] T005 [P] [US1] Write failing tests for RecordingView `handleMidiNoteOn` populating velocity: given `MidiNoteEvent { velocity: 80 }`, the resulting history entry has `velocity: 80`; mic-path onset has `velocity: undefined` in frontend/src/components/recording/RecordingView.test.tsx

### Implementation for User Story 1

- [X] T006 [US1] Add `velocity: event.velocity` to `NoteOnset` construction in `handleMidiNoteOn` in frontend/src/components/recording/RecordingView.tsx
- [X] T007 [US1] Render `<span className="note-history-list__entry-velocity">{entry.velocity}</span>` in each `<li>` when `entry.velocity !== undefined` in frontend/src/components/recording/NoteHistoryList.tsx

**Checkpoint**: US1 fully functional. Velocity number appears for every MIDI note. Mic-path entries unaffected. `npx vitest run` — T004 and T005 tests must pass.

---

## Phase 4: User Story 2 — Visual Velocity Indicator (Priority: P2)

**Goal**: Each MIDI note entry displays a proportional horizontal bar whose width represents velocity (velocity 1 → ~0% width, velocity 127 → 100% width). Absent for mic-path entries.

**Independent Test**: Play note at velocity 1 → bar is near-empty. Play note at velocity 127 → bar is full-width. Play note at velocity 64 → bar is ~50%. Mic entries show no bar.

### Tests for User Story 2 (write FIRST — must FAIL before T009)

- [X] T008 [US2] Write failing tests for NoteHistoryList velocity bar: entry with `velocity: 127` renders bar element with `width` at/near `100%`; `velocity: 1` near `0%`; `velocity: 64` near `50%`; mic entry renders no bar element in frontend/src/components/recording/NoteHistoryList.test.tsx

### Implementation for User Story 2

- [X] T009 [US2] Add `<div className="note-history-list__velocity-bar" style={{ width: \`${Math.round((entry.velocity / 127) * 100)}%\` }} />` inside each `<li>` when `entry.velocity !== undefined` in frontend/src/components/recording/NoteHistoryList.tsx
- [X] T010 [P] [US2] Add `.note-history-list__velocity-bar` (height 4px, green, border-radius 2px, max-width 100%) and `.note-history-list__entry-velocity` (tabular-nums, min-width 2.5ch) CSS classes in frontend/src/components/recording/RecordingView.css

**Checkpoint**: US2 fully functional. Visual bar scales proportionally with velocity. `npx vitest run` — T008 tests must pass.

---

## Phase 5: User Story 3 — Display MIDI Channel Information (Priority: P3)

**Goal**: Each MIDI note entry shows its channel as "Ch N" (e.g. "Ch 1", "Ch 10"). Absent for mic-path entries.

**Independent Test**: Send notes on channel 1 and channel 10 → "Ch 1" and "Ch 10" appear for respective entries. Mic input → no channel shown.

### Tests for User Story 3 (write FIRST — must FAIL before T013/T014)

- [X] T011 [P] [US3] Write failing tests for NoteHistoryList channel display: entry with `channel: 1` renders `"Ch 1"`, `channel: 10` renders `"Ch 10"`, mic entry (no channel) renders no channel element in frontend/src/components/recording/NoteHistoryList.test.tsx
- [X] T012 [P] [US3] Write failing tests for RecordingView `handleMidiNoteOn` populating channel: given `MidiNoteEvent { channel: 2 }`, resulting history entry has `channel: 2`; mic-path onset has `channel: undefined` in frontend/src/components/recording/RecordingView.test.tsx

### Implementation for User Story 3

- [X] T013 [US3] Add `channel: event.channel` to `NoteOnset` construction in `handleMidiNoteOn` in frontend/src/components/recording/RecordingView.tsx
- [X] T014 [US3] Render `<span className="note-history-list__entry-channel">Ch {entry.channel}</span>` in each `<li>` when `entry.channel !== undefined` in frontend/src/components/recording/NoteHistoryList.tsx
- [X] T015 [P] [US3] Add `.note-history-list__entry-channel` CSS class (monospace, muted colour, small font) in frontend/src/components/recording/RecordingView.css

**Checkpoint**: US3 fully functional. Channel displayed as "Ch N" for all MIDI notes. `npx vitest run` — T011 and T012 tests must pass.

---

## Phase 6: User Story 4 — View Raw MIDI Message Data (Priority: P4)

**Goal**: Each note entry has an expandable detail view showing raw hex bytes (e.g. `0x90 0x3C 0x64`). A separate CC log section lists all received CC messages with controller number, value, and channel.

**Independent Test**: Play note → click/tap entry → raw bytes appear in hex format. Send CC message → CC log section shows controller/value/channel.

### Tests for User Story 4 (write FIRST — must FAIL before T019/T020/T021)

- [X] T016 [P] [US4] Write failing tests for `useMidiInput`: note-on event attaches `rawBytes: Array.from(ev.data)` to `MidiNoteEvent`; ALL CC messages (not just CC7/CC11) are routed to `onCC` callback in frontend/src/services/recording/useMidiInput.test.ts
- [X] T017 [P] [US4] Write failing tests for NoteHistoryList expandable raw bytes: clicking entry with `rawBytes: [0x90, 60, 100]` shows formatted hex `"0x90 0x3C 0x64"`; entry without rawBytes shows no expand control in frontend/src/components/recording/NoteHistoryList.test.tsx
- [X] T018 [P] [US4] Write failing tests for RecordingView: `handleMidiNoteOn` forwards `rawBytes` from event to `NoteOnset`; `handleMidiCC` appends to `midiCCHistory`; CC log section renders controller, value, and channel for each CC entry in frontend/src/components/recording/RecordingView.test.tsx

### Implementation for User Story 4

- [X] T019 [US4] Update `subscribeToInput` in `useMidiInput.ts` to attach `rawBytes: Array.from(ev.data as Uint8Array)` to `MidiNoteEvent` after `parseMidiNoteOn()`; remove `cc.controller === 7 || cc.controller === 11` filter so all CC are routed to `onCC` in frontend/src/services/recording/useMidiInput.ts
- [X] T020 [US4] Add `midiCCHistory: MidiCCEvent[]` state + `handleMidiCC` callback (200-entry cap) + `onCC: handleMidiCC` in `useMidiInput` wiring; add `rawBytes: event.rawBytes` to `NoteOnset` construction in `handleMidiNoteOn`; render CC log section below note history when `midiCCHistory.length > 0` in frontend/src/components/recording/RecordingView.tsx
- [X] T021 [US4] Add per-entry `expanded` toggle state to `NoteHistoryList.tsx`; render expand button when `entry.rawBytes` present; render hex bytes as `entry.rawBytes.map(b => \`0x\${b.toString(16).toUpperCase().padStart(2, '0')}\`).join(' ')` in `.note-history-list__raw-bytes` span when expanded in frontend/src/components/recording/NoteHistoryList.tsx

**Checkpoint**: US4 fully functional. Raw bytes expandable, CC log scrollable. `npx vitest run` — T016, T017, T018 tests must pass.

---

## Final Phase: Polish & Cross-Cutting Concerns

- [X] T022 [P] Add `.note-history-list__raw-bytes` (monospace, font-size smaller, muted), `.note-history-list__cc-log` (scrollable list, max-height), and `.note-history-list__cc-entry` CSS classes in frontend/src/components/recording/RecordingView.css
- [X] T023 Run `npm run typecheck` in frontend/ and confirm zero errors
- [X] T024 Run `npx vitest run` in frontend/ and confirm 1760+ tests pass (baseline 1750 + new T004/T005/T008/T011/T012/T016/T017/T018 test blocks)
- [X] T025 Run quickstart.md validation per specs/069-midi-velocity-review/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS all user story phases**
- **Phase 3 (US1)**: Requires Phase 2 complete — MVP; no dependency on US2, US3, US4
- **Phase 4 (US2)**: Requires Phase 3 (US1 implementation T007 must exist — adds to existing velocity rendering) — US2 bar builds on US1 component
- **Phase 5 (US3)**: Requires Phase 2 complete — independent of US2; shares NoteHistoryList.tsx with US1/US2 so start after T007
- **Phase 6 (US4)**: Requires Phase 2 complete; `rawBytes` forwarding in handler builds on T006/T013 wiring — start after US1 + US3 implementation
- **Final Phase**: Requires all user story phases complete

### User Story Dependencies

- **US1 (P1)**: Start immediately after Phase 2
- **US2 (P2)**: Start after T007 (NoteHistoryList already renders velocity span — bar goes inside same guard block)
- **US3 (P3)**: Start after T007 (shares NoteHistoryList.tsx — avoid concurrent edits); tests T011/T012 can be written in parallel with T008
- **US4 (P4)**: Start after T006 + T013 complete (handler already populates velocity + channel — add rawBytes); T016/T017/T018 tests can be written in parallel

### Within Each Phase

- Tests MUST be written and confirmed FAILING before implementation (Constitution Principle V)
- T004 and T005 can be written in parallel (different files: NoteHistoryList.test.tsx vs RecordingView.test.tsx)
- T011 and T012 can be written in parallel (different files)
- T016, T017, T018 can be written in parallel (all different files: useMidiInput.test.ts, NoteHistoryList.test.tsx, RecordingView.test.tsx)
- T006 must complete before T013 (same function `handleMidiNoteOn` — avoid merge conflicts)
- T007 must complete before T009 (same JSX block in NoteHistoryList — sequential additions to `<li>`)
- T009 must complete before T014 (same JSX block)
- T014 must complete before T021 (same `<li>` block in NoteHistoryList)

---

## Parallel Execution Examples

### Phase 2 (Foundational)

```
T002 (recording.ts — type extensions)
  ↓
T003 (typecheck — validates T002)
```

### Phase 3 test-writing (can run in parallel)

```
T004 (NoteHistoryList.test.tsx)     T005 (RecordingView.test.tsx)
              ↓                                   ↓
         T007 (NoteHistoryList.tsx)         T006 (RecordingView.tsx)
```

### Phase 4 + Phase 5 overlap

```
T008 (NoteHistoryList.test.tsx — bar tests)
         ↓
T009 (NoteHistoryList.tsx — bar impl)   T011 (NoteHistoryList.test.tsx — channel tests) ← sequential same file
T010 [P] (RecordingView.css)            T012 [P] (RecordingView.test.tsx — channel wiring tests)
                                                ↓
                                        T013 (RecordingView.tsx — channel wiring)
                                        T014 (NoteHistoryList.tsx — channel pill)
                                        T015 [P] (RecordingView.css)
```

### Phase 6 test-writing (all parallel — different files)

```
T016 [P] (useMidiInput.test.ts)   T017 [P] (NoteHistoryList.test.tsx)   T018 [P] (RecordingView.test.tsx)
              ↓                                  ↓                                 ↓
         T019 (useMidiInput.ts)          T021 (NoteHistoryList.tsx)        T020 (RecordingView.tsx)
```

### Final Phase

```
T022 [P] (RecordingView.css)
       ↓  (with T023, T024, T025 sequential)
T023 (typecheck)
       ↓
T024 (vitest run — 1760+ pass)
       ↓
T025 (quickstart validation)
```

---

## Implementation Strategy

**MVP scope**: Phase 1 + Phase 2 + Phase 3 (US1) delivers numeric velocity in the note history. A musician can immediately see velocity values for every MIDI note they play.

**Incremental delivery**:
1. Phase 1–3: Velocity numbers in note history (MVP — 4 implementation files)
2. + Phase 4: Visual velocity bar — at-a-glance dynamics overview
3. + Phase 5: Channel display — multi-channel controller diagnostics
4. + Phase 6: Raw bytes + CC log — power-user / debug diagnostics
5. + Final: Clean typecheck, full test suite green

**Total tasks**: 25
- Setup: 1 task
- Foundational: 2 tasks
- US1: 4 tasks (2 tests + 2 impl)
- US2: 3 tasks (1 test + 2 impl)
- US3: 5 tasks (2 tests + 3 impl)
- US4: 6 tasks (3 tests + 3 impl)
- Final Phase: 4 tasks

**Completed**: 0/25 | **Remaining**: 25 tasks
