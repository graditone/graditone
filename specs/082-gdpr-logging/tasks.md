---
description: "Task list for GDPR-Compliant Logging implementation"
---

# Tasks: GDPR-Compliant Logging

**Input**: Design documents from `/specs/082-gdpr-logging/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: E2E tests are required by the feature specification (US2 testing).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 [P] Create directory structure `frontend/src/services/telemetry/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 [P] Create telemetry contract interface in `frontend/src/services/telemetry/contract.ts` matching `specs/082-gdpr-logging/contracts/analytics-contract.ts`
- [X] T003 Implement base telemetry adapter in `frontend/src/services/telemetry/index.ts` to export standard tracking functions (`trackPageview`, `trackEvent`) adhering to the contract interface

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Anonymous Usage Tracking (Priority: P1) 🎯 MVP

**Goal**: Record page views and key user interactions on the graditone.com landing page without identifying individual users.

**Independent Test**: Visit the landing page and verify via browser console/network tab that navigation and clicks trigger anonymous telemetry events.

### Implementation for User Story 1

- [X] T004 [P] [US1] Inject Plausible Analytics `<script defer>` tag in `frontend/index.html` configured for `graditone.com`
- [X] T005 [P] [US1] Integrate `trackPageview` in the main application entry/router to record initial page load
- [X] T006 [US1] Instrument main Call-To-Action (CTA) buttons in landing page components (`frontend/src/`) using `trackEvent('cta_click')`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Privacy Compliance & Cookie Banners (Priority: P2)

**Goal**: Verify and maintain strict tracking compliance so no persistent identifiers or PII data are transmitted/stored, bypassing the need for cookie banners.

**Independent Test**: Automated E2E test verifying local storage and cookies remain identifier-free.

### Implementation for User Story 2

- [X] T007 [P] [US2] Create E2E test skeleton in `frontend/tests/e2e/telemetry.spec.ts` using Playwright framework
- [X] T008 [US2] Add Playwright test in `frontend/tests/e2e/telemetry.spec.ts` asserting that cookies and `localStorage` are free of trackers
- [X] T009 [US2] Add Playwright test in `frontend/tests/e2e/telemetry.spec.ts` to intercept `/api/event` network requests and verify payloads lack PII or raw IPs

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T010 Run local Lighthouse/performance audit to assert tracking script evaluate overhead is < 100ms
- [X] T011 Document the new telemetry adapter and its constraints in frontend project documentation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can proceed in priority order (P1 → P2). P2 (testing compliance) logically depends on P1 (actual tracking).
- **Polish (Final Phase)**: Depends on all user stories being complete

### Parallel Opportunities

- T004 and T005 can be done in parallel for US1.
- E2E testing creation (T007) can be scaffolded in parallel with US1 tracking injection.
- Once Foundational phase completes, developers can concurrently start adding custom track events (T006) while someone tests tracking compliance (T008, T009).

### Implementation Strategy

- MVP relies completely on Phase 3 (US1). The telemetry adapter should cleanly map to `window.plausible()`.
- The E2E tests written in Phase 4 formally guarantee privacy constraints defined in `spec.md`.