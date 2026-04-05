# Tasks: Landing Page i18n (073)

**Input**: Design documents from `/specs/073-landing-page-i18n/`
**Prerequisites**: [plan.md](plan.md) · [spec.md](spec.md) · [research.md](research.md) · [data-model.md](data-model.md) · [contracts/translation-api.md](contracts/translation-api.md) · [quickstart.md](quickstart.md)

**Worktree**: `../worktrees/073-landing-page-i18n`

---

## Phase 1: Setup

**Purpose**: Create the i18n module directory and install no new dependencies (custom implementation — dependency-free by design per research.md).

- [X] T001 Create directory `frontend/src/i18n/locales/` and add placeholder files `en.json`, `es.json` (empty objects `{}`) to establish module structure

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The i18n module — `LocaleProvider`, `useTranslation()`, locale resolver, typed catalogs, and the locale registry — must be fully built and tested before any component can be migrated. No user story work can begin until this phase is complete.

**⚠️ CRITICAL**: All component migration tasks (Phase 3+) depend on T002–T011 completing first.

### Tests — Write First, Verify They FAIL

- [X] T002 [P] Write failing unit test for `resolveLocale()` in `frontend/src/test/i18n/locale-resolver.test.ts` — assert `'es'` for `'es'`, `'es-MX'`, `'es-AR'`; assert `'en'` for `'en'`, `'en-US'`; assert `'en'` (fallback) for `'fr'`, `'zh-Hant-TW'`, `''`, and undefined
- [X] T003 [P] Write failing catalog-completeness test in `frontend/src/test/i18n/catalog-completeness.test.ts` — assert every key in `en.json` exists in `es.json` with a non-empty string value; assert both catalogs have exactly 30 keys
- [X] T004 [P] Write failing contract test for `useTranslation()` in `frontend/src/test/i18n/use-translation.test.ts` — assert `t('header.slogan')` renders the correct EN string when `LocaleProvider locale="en"` wraps the tree; assert `t('header.slogan')` renders the correct ES string when `LocaleProvider locale="es"` wraps the tree; assert English fallback when key absent from ES catalog

### Implementation

- [X] T005 Populate `frontend/src/i18n/locales/en.json` with the full 30-key English catalog from data-model.md
- [X] T006 [P] Populate `frontend/src/i18n/locales/es.json` with the full 30-key Spanish catalog from data-model.md
- [X] T007 Create `frontend/src/i18n/registry.ts` — export `SUPPORTED_LOCALES = ['en', 'es'] as const`, `SupportedLocale` type, `DEFAULT_LOCALE = 'en'`; export `resolveLocale(raw: string | undefined): SupportedLocale` using primary-subtag extraction + supported-locale lookup + English fallback
- [X] T008 Create `frontend/src/i18n/index.ts` — export `TranslationKey` type derived from `keyof typeof enCatalog`; implement `LocaleContext`; implement `LocaleProvider` component (reads `navigator.language` on mount unless `locale` prop provided; selects catalog; provides `t: TranslateFn`); export `useTranslation()` hook returning `{ t }`
- [X] T009 Verify T002 tests pass: run `npx vitest run src/test/i18n/locale-resolver.test.ts`
- [X] T010 Verify T003 tests pass: run `npx vitest run src/test/i18n/catalog-completeness.test.ts`
- [X] T011 Verify T004 tests pass: run `npx vitest run src/test/i18n/use-translation.test.ts`

**Checkpoint**: i18n module is fully functional and typed. `useTranslation()` hook works and is covered by tests. All component migration can proceed.

---

## Phase 3: User Story 1 — Spanish-Speaking User Sees Native Language (Priority: P1) 🎯 MVP

**Goal**: A user with Spanish browser language sees all landing page strings in Spanish, automatically, with no action required.

**Independent Test**: Run the app in a browser with `navigator.language = 'es'` (or open Chrome DevTools → override `Accept-Language: es`) and verify every visible landing page string is in Spanish.

### Tests — Write First, Verify They FAIL

- [X] T012 Wrap `<App>` in `<LocaleProvider locale="es">` in the existing `frontend/src/App.test.tsx`; add assertions that the loading string (`"Cargando el motor de música..."`) and the slogan (`"La plataforma abierta para la práctica musical"`) are rendered; verify tests FAIL before implementation

### Implementation

- [X] T013 Wrap the app root in `<LocaleProvider>` in `frontend/src/main.tsx` (auto-detects locale from `navigator.language`)
- [X] T014 [US1] Migrate `frontend/src/App.tsx` — replace all 12 hardcoded strings with `t()` calls using keys: `loading.engine`, `errors.wasm.*` (8 keys), `header.slogan`, `header.plugins_button`, `header.plugins_button_label`, `header.installed_plugins_nav`; import `useTranslation` from `../i18n`
- [X] T015 [US1] Verify T012 tests pass: run `npx vitest run src/App.test.tsx`

**Checkpoint**: US1 fully functional — Spanish browser loads the app and sees Spanish text in the main app shell (loading state, error states, header). Independently demonstrable.

---

## Phase 4: User Story 2 — Unsupported Language Falls Back to English (Priority: P2)

**Goal**: A user with a browser language other than `en` or `es` (e.g., French) sees all landing page strings in English, never raw keys or blank strings.

**Independent Test**: Override `navigator.language` to `'fr'` in a test or browser and verify all text renders in English.

### Tests — Write First, Verify They FAIL

- [X] T016 [US2] In `frontend/src/test/i18n/locale-resolver.test.ts` add assertions (already written in T002) confirming French and other unsupported codes resolve to `'en'` — verify these assertions exist and PASS (covered by Phase 2 foundational tests)
- [X] T017 [US2] In `frontend/src/App.test.tsx` add a test wrapping `<App>` with `<LocaleProvider locale="fr">` (unsupported) — assert the slogan shows the English value `"The open platform for musical practice"`; verify test FAILS before T018

### Implementation

- [X] T018 [US2] Confirm `resolveLocale()` in `frontend/src/i18n/registry.ts` (built in T007) returns `'en'` for all unrecognised locales — no code change needed if T002 already passes; inspect tests only
- [X] T019 [US2] Verify T017 test passes: run `npx vitest run src/App.test.tsx`

**Checkpoint**: US2 fully functional — any unsupported-language browser sees English strings throughout. Zero translation keys or blank strings visible.

---

## Phase 5: User Story 3 — All Landing Page Surfaces Are Translated (Priority: P2)

**Goal**: Every translatable surface other than `App.tsx` is wired to the translation system: `LandingScreen`, `IOSInstallModal`, `AndroidInstallBanner`, `OfflineBanner`.

**Independent Test**: Switch browser to Spanish and verify each surface in turn: pause/resume aria-labels on the landing animation, iOS install modal copy, Android install banner copy and accessible labels, offline banner text.

### Tests — Write First, Verify They FAIL

- [X] T020 [P] [US3] Write failing test in `frontend/src/test/components/LandingScreen.test.tsx` — render with `<LocaleProvider locale="es">`; assert `aria-label` includes Spanish pause string (`"Pantalla de inicio (haz clic para pausar)"`) and Spanish resume string
- [X] T021 [P] [US3] Write failing test in `frontend/src/test/components/IOSInstallModal.test.tsx` — render with `<LocaleProvider locale="es">`; assert heading text, step copy, and dismiss button label all render in Spanish
- [X] T022 [P] [US3] Write failing test in `frontend/src/test/components/AndroidInstallBanner.test.tsx` — render with `<LocaleProvider locale="es">`; assert banner title, subtitle, CTA text, and all `aria-label` values render in Spanish
- [X] T023 [P] [US3] Write failing test in `frontend/src/test/components/OfflineBanner.test.tsx` — render with `<LocaleProvider locale="es">`; assert the offline message renders in Spanish (`"Estás sin conexión — todas las funciones funcionan normalmente"`)

### Implementation

- [X] T024 [P] [US3] Migrate `frontend/src/components/LandingScreen.tsx` — replace 2 hardcoded `aria-label` strings with `t('landing.aria_playing')` and `t('landing.aria_paused')`; import `useTranslation`
- [X] T025 [P] [US3] Migrate `frontend/src/components/IOSInstallModal.tsx` — replace 8 hardcoded strings with `t()` calls using `ios_install.*` keys; import `useTranslation`
- [X] T026 [P] [US3] Migrate `frontend/src/components/AndroidInstallBanner.tsx` — replace 6 hardcoded strings with `t()` calls using `android_install.*` keys; import `useTranslation`
- [X] T027 [P] [US3] Migrate `frontend/src/components/OfflineBanner.tsx` — replace 1 hardcoded string with `t('offline.banner')`; import `useTranslation`
- [X] T028 [P] [US3] Verify T020 test passes: run `npx vitest run src/test/components/LandingScreen.test.tsx`
- [X] T029 [P] [US3] Verify T021 test passes: run `npx vitest run src/test/components/IOSInstallModal.test.tsx`
- [X] T030 [P] [US3] Verify T022 test passes: run `npx vitest run src/test/components/AndroidInstallBanner.test.tsx`
- [X] T031 [P] [US3] Verify T023 test passes: run `npx vitest run src/test/components/OfflineBanner.test.tsx`

**Checkpoint**: US3 fully functional — all 7 surfaces are wired to the translation system. SC-001 and SC-002 are now satisfied.

---

## Phase 6: User Story 4 — Adding a New Language Is Straightforward (Priority: P3)

**Goal**: Validate the extensibility contract from quickstart.md — adding a third language requires exactly 2 file changes and 0 component changes.

**Independent Test**: Create a minimal `fr.json` French catalog + register `'fr'` in `registry.ts`; set browser locale to `fr`; verify French text renders. Then revert.

### Tests — Write First, Verify They FAIL

- [X] T032 [US4] Write failing test in `frontend/src/test/i18n/extensibility.test.ts` — import a minimal mock catalog object with all 30 keys; pass it directly to `LocaleProvider` as an injected catalog; assert `t('header.slogan')` returns the mock value — validates that `LocaleProvider` uses whichever catalog is registered, not a hardcoded one

### Implementation

- [X] T033 [US4] Refactor `frontend/src/i18n/index.ts` if needed so `LocaleProvider` retrieves the catalog from the registry by `SupportedLocale` key (not via hardcoded `if/else`) — confirms FR-007 (no language-specific conditional in component code) and FR-008 (new catalog = new registry entry only)
- [X] T034 [US4] Verify T032 test passes: run `npx vitest run src/test/i18n/extensibility.test.ts`
- [X] T035 [US4] Add inline code comment to `frontend/src/i18n/registry.ts` citing quickstart.md for maintainers adding future languages

**Checkpoint**: US4 validated — `SUPPORTED_LOCALES` and a catalog file are the only 2 changes required to add a new language. SC-004 satisfied.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: E2E smoke test, full test suite run, and final validation.

- [X] T036 Write Playwright E2E smoke test in `frontend/tests/e2e/i18n-landing.spec.ts` — create a browser context with `locale: 'es'`; navigate to the landing page; assert at minimum: slogan text in Spanish, loading text in Spanish (or skip if engine loads before assertion can run, check header); assert no visible English-only strings from the 30-key catalog appear
- [X] T037 [P] Run full Vitest suite: `cd frontend && npx vitest run` — confirm 0 failures; record total test count
- [X] T038 [P] Run TypeScript compiler check: `cd frontend && npx tsc --noEmit` — confirm 0 type errors (validates `TranslationKey` exhaustiveness across all components and both catalogs)
- [X] T039 Run Playwright E2E smoke test: `cd frontend && npx playwright test tests/e2e/i18n-landing.spec.ts` — confirm test passes
- [X] T040 [P] Verify quickstart.md procedure works: add `fr` to `SUPPORTED_LOCALES` and a minimal `fr.json` (copy of `en.json`); confirm TypeScript compiles; revert both changes — validates SC-004 (2-file change process)
- [X] T041 [P] Search `frontend/src/components/` and `frontend/src/App.tsx` for any remaining hardcoded English strings from the 30-key catalog — confirm 0 occurrences (validates SC-001, SC-002 completeness)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user story phases
- **Phase 3 (US1 — P1)**: Depends on Phase 2 — can start immediately after Foundational ✅
- **Phase 4 (US2 — P2)**: Depends on Phase 2 — can run in parallel with Phase 3 ✅
- **Phase 5 (US3 — P2)**: Depends on Phase 2 — can run in parallel with Phases 3 & 4 ✅
- **Phase 6 (US4 — P3)**: Depends on Phase 2 — can start after Phase 2; logically after Phase 3 (needs `LocaleProvider` to exist)
- **Phase 7 (Polish)**: Depends on all user story phases completing

### User Story Dependencies

- **US1 (P1)**: No dependency on other stories — pure foundation + App.tsx migration
- **US2 (P2)**: No dependency on US1 — `resolveLocale` fallback is already in the foundational module; App.tsx migration from US1 makes US2 verification easier but isn't strictly required
- **US3 (P2)**: No dependency on US1 or US2 — each component migration is independent
- **US4 (P3)**: Depends on `LocaleProvider` existing (T008/T013); otherwise independent

### Within Each User Story

1. Write tests first → verify they FAIL
2. Implement → verify tests PASS
3. Run full suite before moving to next story

### Parallel Opportunities

Within Phase 2:
- T002, T003, T004 (test writing) can all run in parallel
- T005, T006 (catalog population) can run in parallel
- T007, T008 have an ordering dependency (T007 before T008 since `index.ts` imports from `registry.ts`)

Within Phase 5 (US3 — largest phase):
- T020–T023 (write all 4 component tests) fully parallel — different files
- T024–T027 (migrate all 4 components) fully parallel — different files
- T028–T031 (verify tests) can run in parallel

Within Phase 7:
- T037, T038, T040, T041 can all run in parallel

---

## Parallel Example: Phase 5 (US3 Component Migrations)

```bash
# After foundational module is complete (T008 done):

# In parallel — 4 independent terminal sessions:
npx vitest run src/test/components/LandingScreen.test.tsx    # after T020 + T024
npx vitest run src/test/components/IOSInstallModal.test.tsx  # after T021 + T025
npx vitest run src/test/components/AndroidInstallBanner.test.tsx  # after T022 + T026
npx vitest run src/test/components/OfflineBanner.test.tsx    # after T023 + T027
```

---

## Implementation Strategy

### MVP Scope (US1 only — Phase 1 + 2 + 3)

T001–T015 deliver the complete MVP: the i18n module is built, tested, and the primary app shell (`App.tsx`) is fully translated. A Spanish-speaking user loads the app and sees Spanish text throughout the main shell. This is independently demonstrable and verifiable.

### Incremental Delivery

1. **MVP** (T001–T015): i18n module + App.tsx migration — US1 satisfied
2. **+US2** (T016–T019): Unsupported-language fallback validation — no new code, tests only
3. **+US3** (T020–T031): All remaining 4 components migrated — full surface coverage
4. **+US4** (T032–T035): Extensibility validated — 2-file new-language process confirmed
5. **+Polish** (T036–T041): E2E smoke + full validation suite

Total: **41 tasks** across 7 phases.
