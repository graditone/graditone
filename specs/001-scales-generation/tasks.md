# Tasks: Scales Generation

**Input**: Design documents from `/specs/001-scales-generation/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/score-catalog.ts](contracts/score-catalog.ts)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label — US1, US2, or US3
- All file paths are absolute from repo root

---

## Phase 1: Setup

**Purpose**: Create output directory and validate static asset serving infrastructure.

- [x] T001 Create `scores/scales/` directory in repo root (this is where all 48 .mxl files will live — committed as static assets)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared infrastructure that US1 (TypeScript types) and US2/US3 (generator utilities) both depend on. These two tasks are independent of each other and can be developed in parallel.

**⚠️ CRITICAL**: No user story work can begin until its prerequisite in this phase is complete — T003 for US1; T002 for US2 and US3.

- [x] T002 [P] Create `scripts/generate_scales.py` with all shared MusicXML infrastructure: `write_mxl(filename, xml_str)` (writes ZIP with META-INF/container.xml + score.xml), `note_to_xml(step, octave, alter, duration)`, `CHROMATIC_TO_STEP` table (semitone → step+alter per flat/sharp key context), `KEY_SIG_FIFTHS` lookup, `MAJOR_INTERVALS` and `MINOR_INTERVALS` lists — no scale generation logic yet, just shared utilities and a runnable `main()` stub
- [x] T003 [P] Add `ScoreGroup` and `PreloadedCatalog` TypeScript interfaces to `frontend/src/data/preloadedScores.ts`; export them alongside existing `PreloadedScore` (no catalog data yet — just the type definitions per `contracts/score-catalog.ts`)

**Checkpoint**: Generator utilities importable/testable in isolation; TypeScript types compile clean.

---

## Phase 3: User Story 1 — Browse and Load Scale Score from Dialog (Priority: P1) 🎯 MVP

**Goal**: A musician opens the load score dialog and sees a collapsible "Scales" group alongside existing scores; selecting any scale score in that group loads it in the score viewer.

**Independent Test**: Open the load score dialog → verify "Scales" collapsible group is visible → expand it → click any scale score → confirm score loads and renders in viewer. Existing Bach, Beethoven etc. scores must continue loading without regression.

- [x] T004 [P] [US1] Create `frontend/src/components/load-score/ScoreGroupList.tsx` — renders a single `ScoreGroup` as a native `<details>/<summary>` collapsible block (collapsed by default); each score inside rendered as a button matching the existing `preloaded-score-item` styling; props match `ScoreGroupListProps` from `contracts/score-catalog.ts`
- [x] T005 [P] [US1] Create `frontend/src/components/load-score/ScoreGroupList.css` — styles for `.score-group`, `.score-group__summary` (header/toggle) and `.score-group__list` (score list inside details); summary styled consistently with existing `.load-score-dialog__panel-heading`
- [x] T006 [US1] Add `SCALE_SCORE_GROUP` stub constant (empty `scores: []`) and `PRELOADED_CATALOG` export to `frontend/src/data/preloadedScores.ts`; `PRELOADED_CATALOG.ungrouped` = `PRELOADED_SCORES`; `PRELOADED_CATALOG.groups` filters out groups with empty `scores` array (depends on T003)
- [x] T007 [US1] Update `frontend/src/components/load-score/LoadScoreDialog.tsx` to import `PRELOADED_CATALOG`; render `PRELOADED_CATALOG.groups` below the existing `PreloadedScoreList` using `ScoreGroupList`, passing `selectedId`, `disabled`, and `onSelect={loadPresetScore}`; import `ScoreGroupList.css` (depends on T003, T004)

**Checkpoint**: Dialog renders collapsible Scales group (empty — hidden if `SCALE_SCORE_GROUP.scores` is `[]`). Existing preloaded scores still load. Once T010/T013 populate the catalog, the group appears and all scale scores are selectable.

---

## Phase 4: User Story 2 — All Major Scales Across C4 and C5 Octaves (Priority: P2)

**Goal**: All 12 major scales (C, G, D, A, E, B, F#, D♭, A♭, E♭, B♭, F) are available as .mxl files for both octave 4 and octave 5 starting points, and visible/loadable in the dialog Scales group.

**Independent Test**: Run `python3 scripts/generate_scales.py`; count files in `scores/scales/` matching `*_major_oct*.mxl` → expect 24. Open dialog → expand Scales → select "C Major — Octave 4" → score loads and displays 8 ascending then 8 descending quarter notes in C major (no accidentals).

- [x] T008 [P] [US2] Implement major scale generation in `scripts/generate_scales.py`: add `generate_major_scale(root_note, root_octave, fifths, title, filename)` function that builds a 4/4, quarter-note, single-staff (treble clef) MusicXML score with 2 ascending bars + 2 descending bars; use conventional enharmonic spelling (derived from `fifths` value); iterate all 12 circle-of-fifths roots for oct4 and oct5, writing 24 files to `scores/scales/` (depends on T002)
- [x] T009 [US2] Run `python3 scripts/generate_scales.py` to produce the 24 major scale .mxl files in `scores/scales/`; verify `ls scores/scales/ | grep major | wc -l` → 24; spot-check C_major_oct4.mxl opens cleanly (depends on T008)
- [x] T010 [US2] Populate `SCALE_SCORE_GROUP.scores` in `frontend/src/data/preloadedScores.ts` with all 24 major scale `PreloadedScore` entries (circle of fifths order: C, G, D, A, E, B, F#, D♭, A♭, E♭, B♭, F; oct4 before oct5; `id` e.g., `"c-major-oct4"`, `displayName` e.g., `"C Major — Octave 4"`, `path` e.g., `\`${base}scores/scales/C_major_oct4.mxl\``) (depends on T006)

**Checkpoint**: Dialog Scales group shows 24 major scale scores. Each loads and renders correctly.

---

## Phase 5: User Story 3 — All Natural Minor Scales Across C4 and C5 Octaves (Priority: P3)

**Goal**: All 12 natural minor scales (C, G, D, A, E, B, F#, C#, G#, D#, B♭, F) are available as .mxl files for both octave 4 and octave 5 starting points, added after major scales in the Scales group.

**Independent Test**: Run `python3 scripts/generate_scales.py`; count files matching `*_minor_oct*.mxl` → expect 24 (total 48). Open dialog → expand Scales → scroll to minor scales → select "A Minor — Octave 4" → score loads with correct natural minor intervals (whole-half-whole-whole-half-whole-whole).

- [x] T011 [P] [US3] Extend `scripts/generate_scales.py` with `generate_minor_scale(root_note, root_octave, fifths, title, filename)` using natural minor intervals `[0, 2, 3, 5, 7, 8, 10, 12]` and correct key signature (relative major's fifths value + `<mode>minor</mode>`); iterate all 12 minor roots in circle-of-fifths order for oct4 and oct5 (depends on T002; extends T008's pattern)
- [x] T012 [US3] Run `python3 scripts/generate_scales.py` to produce 24 natural minor .mxl files in `scores/scales/`; verify `ls scores/scales/ | wc -l` → 48 total; spot-check A_minor_oct4.mxl opens cleanly (depends on T011)
- [x] T013 [US3] Append 24 minor scale `PreloadedScore` entries to `SCALE_SCORE_GROUP.scores` in `frontend/src/data/preloadedScores.ts` — after all major entries; circle of fifths order (C, G, D, A, E, B, F#, C#, G#, D#, B♭, F); oct4 before oct5; `id` e.g., `"a-minor-oct4"`, `displayName` e.g., `"A Minor — Octave 4"` (depends on T010)

**Checkpoint**: Dialog Scales group shows all 48 scores (24 major + 24 minor). All load and render correctly. Total `scores/scales/` → 48 files.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation completion and validation per constitution requirement (documentation currency).

- [x] T014 [P] Update `FEATURES.md` with Scales Generation feature entry (48 scale MusicXML files, collapsible dialog group, circle of fifths ordering)
- [x] T015 [P] Update `specs/001-scales-generation/spec.md` status from `Draft` to `Complete`
- [x] T016 Run `quickstart.md` validation checklist: `ls scores/scales/ | wc -l` → 48; `cd frontend && npx vitest run` → all pass; manual dialog smoke test (open dialog → expand Scales → load C Major → load A Minor → load existing Bach score → no regressions)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (T001) — T002 and T003 unblock US2/US3 and US1 respectively
- **Phase 3 (US1)**: T004, T005 can start immediately after Phase 1; T006 depends on T003; T007 depends on T003 + T004
- **Phase 4 (US2)**: T008 depends on T002; T009 depends on T008; T010 depends on T006
- **Phase 5 (US3)**: T011 depends on T002 (+ T008 as a pattern reference); T012 depends on T011; T013 depends on T010
- **Phase 6 (Polish)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: T003 → T006 → T007; T004/T005 are parallel with T003. No dependency on US2 or US3 (group is hidden while empty)
- **US2 (P2)**: T002 → T008 → T009 → T010. No dependency on US1 or US3
- **US3 (P3)**: T002 → T011 → T012 → T013; T013 depends on T010 (appended after major entries). No dependency on US1

### Task-Level Dependency Graph

```
T001
├── T002 ──→ T008 ──→ T009 ──→ T010 ──→ T013
│       └──→ T011 ──→ T012         ↑
│                               (T006)
└── T003 ──→ T006 ──→ T010
         └──→ T007 (also needs T004)

T004 ──→ T007
T005 (standalone CSS)
```

---

## Parallel Execution Examples

### Phase 2: Run these in parallel (T002 ∥ T003)

```bash
# Terminal A — Python generator base
vim scripts/generate_scales.py   # shared utilities + main stub

# Terminal B — TypeScript types
vim frontend/src/data/preloadedScores.ts  # ScoreGroup + PreloadedCatalog interfaces
```

### Phase 3 (US1): Run initial tasks in parallel (T004 ∥ T005)

```bash
# Terminal A — ScoreGroupList component
vim frontend/src/components/load-score/ScoreGroupList.tsx

# Terminal B — ScoreGroupList styles
vim frontend/src/components/load-score/ScoreGroupList.css
```

Then sequentially: T006 (after T003) → T007 (after T003 + T004)

### Phase 4/5: US2 and US3 generator work is sequential

```
T008 (implement major loop) → T009 (run → 24 files) → T010 (catalog entries)
T011 (implement minor loop) → T012 (run → 24 files) → T013 (catalog entries)
```

T011 can begin once T008's pattern is established (same file, no conflict if T008 is merged first).

---

## Implementation Strategy

**MVP**: Complete US1 + US2 (Phases 1–4) — dialog shows collapsible Scales group with all 12 major scales × 2 octaves (24 files). The dialog enhancement and major scale content together deliver immediately usable value for scale practice.

**Incremental**: Add US3 (Phase 5) to extend with all natural minor scales, completing the full 48-file collection.

**Format validation**: All tasks include exact file paths. All checklist items follow the required format (`- [ ] T### [P?] [USN?] description with path`).

---

## Summary

| Metric | Count |
|---|---|
| Total tasks | 16 |
| US1 (Dialog group UI) | 4 tasks (T004–T007) |
| US2 (Major scales) | 3 tasks (T008–T010) |
| US3 (Minor scales) | 3 tasks (T011–T013) |
| Setup / Foundational | 3 tasks (T001–T003) |
| Polish | 3 tasks (T014–T016) |
| Parallel opportunities | T002∥T003, T004∥T005, T014∥T015 |
| MVP scope | Phases 1–4 (US1 + US2, 13 tasks) |
