# Tasks: Documentation Architecture

**Input**: Design documents from `/specs/059-doc-architecture/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Not requested — documentation-only feature with manual validation.

**Organization**: Tasks are grouped by user story to enable independent implementation and verification.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Exact file paths included in all task descriptions

---

## Phase 1: Setup

**Purpose**: Verify existing documentation structure before making changes

- [X] T001 Verify docs/ directory exists and docs/LOCAL-VALIDATION.md is present and will be preserved

---

## Phase 2: User Story 4 — Root Folder is Clean and Navigable (Priority: P1) 🎯 MVP

**Goal**: Remove all orphaned PR descriptions, commit message drafts, and misplaced scripts from the repository root so only essential project files remain.

**Independent Test**: After cleanup, `ls *.md` in root shows only README.md, FEATURES.md, PLUGINS.md, VERSIONING.md, and LICENSE. No PR-*, commit-*, or ad-hoc scripts remain.

- [X] T002 [P] [US4] Delete all PR description files from root: PR-015-description.md, PR-021-description.md, PR-023-description.md, PR-033-description.md, PR-037-description.md, PR-050-description.md, PR-350-description.md
- [X] T003 [P] [US4] Delete commit-msg-008-plan.txt and commit-test-analysis.txt from root
- [X] T004 [US4] Move generate_dense_fixture.py to scripts/generate_dense_fixture.py

**Checkpoint**: Root directory contains only essential project files (README.md, FEATURES.md, PLUGINS.md, VERSIONING.md, LICENSE, docker-compose.yml, and standard config directories)

---

## Phase 3: User Story 1 — Developer Finds Architecture Documentation Quickly (Priority: P1)

**Goal**: Create a complete architecture documentation set in `docs/` with Mermaid diagrams so any developer can navigate from README.md to any subsystem's architecture in ≤ 3 clicks.

**Independent Test**: A contributor with no prior Graditone experience can navigate from README.md → docs/architecture.md → docs/{subsystem}.md and understand the high-level data flow and module structure.

### Architecture Overview

- [X] T005 [US1] Create docs/architecture.md with high-level Mermaid diagram (≤ 8 nodes), subsystem descriptions, and links to all 6 subsystem pages per specs/059-doc-architecture/contracts/architecture-overview.md

### Subsystem Pages

- [X] T006 [P] [US1] Create docs/frontend-pwa.md with React component hierarchy, service layer, and PWA infrastructure diagram per specs/059-doc-architecture/contracts/subsystem-pages.md
- [X] T007 [P] [US1] Create docs/wasm-engine.md with hexagonal architecture (ports & adapters) and WASM compilation diagram per specs/059-doc-architecture/contracts/subsystem-pages.md
- [X] T008 [P] [US1] Create docs/layout-engine.md with pipeline processing diagram (extraction → spacing → breaking → positioning → batching) per specs/059-doc-architecture/contracts/subsystem-pages.md
- [X] T009 [P] [US1] Create docs/svg-renderer.md with two-tier render model and virtualization diagram per specs/059-doc-architecture/contracts/subsystem-pages.md
- [X] T010 [P] [US1] Create docs/plugin-system.md with Plugin API v4 lifecycle and event communication diagram per specs/059-doc-architecture/contracts/subsystem-pages.md
- [X] T011 [P] [US1] Create docs/musicxml-importer.md with three-layer import pipeline diagram (parser → converter → domain) per specs/059-doc-architecture/contracts/subsystem-pages.md

### README Architecture Integration

- [X] T012 [US1] Add simplified Mermaid architecture diagram (≤ 8 nodes) to README.md
- [X] T013 [US1] Add feature highlights section with concise entries linking to FEATURES.md, PLUGINS.md, and docs/ pages in README.md
- [X] T014 [US1] Add link to docs/architecture.md in Documentation section of README.md

**Checkpoint**: docs/ contains 8+ files (architecture.md + 6 subsystem pages + LOCAL-VALIDATION.md). README.md has architecture diagram and feature highlights. Navigation from README → any subsystem page ≤ 3 clicks.

---

## Phase 4: User Story 3 — User Understands What Graditone Runs On (Priority: P2)

**Goal**: Update README.md platform messaging so users immediately understand device support, limitations (iOS Safari MIDI), and the PWA update process.

**Independent Test**: A user reading README.md can determine within 10 seconds whether their device is supported and how updates are delivered.

- [X] T015 [US3] Replace all "tablet-native" occurrences with "tablet-first" in README.md and add multi-device messaging (desktop, laptop, tablet, mobile)
- [X] T016 [US3] Add iOS Safari MIDI limitation note to platform support area of README.md
- [X] T017 [US3] Add PWA update process documentation (refresh browser to get updates) to README.md

**Checkpoint**: README.md contains zero mentions of "tablet-native". Platform support and PWA update process are clearly documented.

---

## Phase 5: User Story 2 — Contributor Updates Docs After Completing a Feature (Priority: P2)

**Goal**: Create a post-spec documentation update checklist so documentation stays current after every feature implementation.

**Independent Test**: A contributor finishing a feature can follow the checklist step-by-step and knows exactly which files to update and how to verify.

- [X] T018 [US2] Create docs/doc-update-checklist.md with 7-step checklist, conditions, target files, and Mermaid verification instructions per specs/059-doc-architecture/contracts/doc-update-checklist.md

**Checkpoint**: docs/doc-update-checklist.md exists, is linked from docs/architecture.md, and provides clear step-by-step guidance.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: README cleanup items that span multiple user stories, plus final validation

- [X] T019 Remove "Implementation Progress" section entirely from README.md
- [X] T020 Update Constitutional Principles section to include all 7 principles (add VI: Layout Engine Authority, VII: Regression Prevention) in README.md
- [X] T021 Verify all Mermaid diagrams render correctly on GitHub by pushing branch and checking rendered markdown
- [X] T022 Verify all cross-reference links between docs/ pages resolve correctly
- [X] T023 Verify navigation from README.md → any subsystem architecture page in ≤ 3 clicks
- [X] T024 Run quickstart.md verification checklist at specs/059-doc-architecture/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **US4 (Phase 2)**: No dependencies — can run in parallel with Phase 1
- **US1 (Phase 3)**: T005 should complete before T006–T011 (overview before subsystem pages); T012–T014 depend on docs/ pages existing
- **US3 (Phase 4)**: Can start after US1 README tasks (T012–T014) to avoid merge conflicts on README.md
- **US2 (Phase 5)**: Can start after T005 (architecture.md links to checklist); independent of US3
- **Polish (Phase 6)**: Depends on all user story phases being complete

### User Story Dependencies

- **US4 (P1)**: No dependencies on other stories — can start immediately
- **US1 (P1)**: No dependencies on US4, but logically follows root cleanup
- **US3 (P2)**: Independent — only touches README.md content, not docs/ structure
- **US2 (P2)**: Independent — only creates docs/doc-update-checklist.md

### Within Each User Story

- US4: T002, T003 are parallel (different files); T004 independent
- US1: T005 first (overview page); T006–T011 all parallel (different subsystem files); T012–T014 sequential (all edit README.md)
- US3: T015–T017 sequential (all edit README.md)
- US2: Single task (T018)

### Parallel Opportunities

```text
# Phase 2 — All root cleanup tasks in parallel:
T002 (delete PR files)  ║  T003 (delete commit files)  ║  T004 (move script)

# Phase 3 — All 6 subsystem pages in parallel after T005:
T006 (frontend-pwa.md)  ║  T007 (wasm-engine.md)  ║  T008 (layout-engine.md)
T009 (svg-renderer.md)  ║  T010 (plugin-system.md) ║  T011 (musicxml-importer.md)

# Phase 5 can run in parallel with Phase 4:
T018 (doc-update-checklist.md)  ║  T015–T017 (README platform changes)
```

---

## Implementation Strategy

### MVP First (US4 + US1)

1. Complete Phase 1: Setup (verify docs/ directory)
2. Complete Phase 2: US4 — Root Folder Cleanup (delete 9 files, move 1)
3. Complete Phase 3: US1 — Architecture Documentation (create 7 docs pages + README integration)
4. **STOP and VALIDATE**: Root is clean, docs/ has all architecture pages, Mermaid renders on GitHub
5. This delivers the core value: clean root + navigable architecture docs

### Incremental Delivery

1. US4 (root cleanup) → Clean repo root → Commit
2. US1 (architecture docs) → Full docs/ structure + README diagram → Commit (MVP complete!)
3. US3 (platform messaging) → README tablet-first + MIDI + PWA → Commit
4. US2 (update checklist) → docs/doc-update-checklist.md → Commit
5. Polish → Final README cleanup + verification → Commit
6. Each phase adds value without breaking previous work
