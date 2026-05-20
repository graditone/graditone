---
description: "Task list for Feature 091 — Credits Page for Preloaded Songs in Guide Plugin"
---

# Tasks: Credits Page for Preloaded Songs in Guide Plugin

**Feature**: `091-guide-credits-preloaded-songs`
**Branch**: `agents-credits-page-preloaded-songs`
**Input**: Design documents from `specs/091-guide-credits-preloaded-songs/`
**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/ ✅ · quickstart.md ✅

**Tech Stack**: TypeScript 5 / React 18 · Vitest + @testing-library/react · flat-key i18n catalog
**Scope**: 7 credit entries · 1 new data file · 1 updated component · 10 new i18n keys × 2 locales · 2 new/updated test files · 2 new CSS rules
**Tests**: TDD — tests MUST be written before implementation code (Constitution Principle V)

## Format: `[ID] [P?] [Story?] Description with file path`

- **[P]**: Can run in parallel (different files, no incomplete dependencies)
- **[Story]**: User story this task belongs to ([US1], [US2], [US3])
- Exact file paths are included in every task description

---

## Phase 1: Foundational — i18n Keys

**Purpose**: Add the 10 `guide.credits.*` translation keys to both locale files **before any other
file is touched**. `TranslationKey` is derived at compile time as `keyof typeof enCatalog`
(see `frontend/src/i18n/index.tsx`). Until these keys exist in `en.json`, the TypeScript compiler
will reject the `licenseKey: TranslationKey` field in `SongCredit` and every `t('guide.credits.*')`
call in `GuidePlugin.tsx`.

**⚠️ CRITICAL**: No downstream TypeScript file (`creditsCatalog.ts`, `GuidePlugin.tsx`) can compile
until Phase 1 is complete.

- [ ] T001 Add 10 `guide.credits.*` keys with English values to `frontend/src/i18n/locales/en.json` — append after the last `guide.loading.*` key: `guide.credits.heading: "Credits"` · `guide.credits.intro: "The following preloaded scores are bundled with Graditone. Composition and arrangement attribution is listed below."` · `guide.credits.label.composer: "Composer"` · `guide.credits.label.arranger: "Arranged by"` · `guide.credits.label.license: "License"` · `guide.credits.label.source: "Source"` · `guide.credits.license.pd: "Public Domain"` · `guide.credits.license.ccbyncsa: "CC BY-NC-SA"` · `guide.credits.license.all_rights_reserved: "All rights reserved — personal/educational use only"` · `guide.credits.source.internal: "Graditone original engraving"`
- [ ] T002 [P] Add 10 `guide.credits.*` keys with Spanish values to `frontend/src/i18n/locales/es.json` — append in the same order as T001 with keys in exact parity: `guide.credits.heading: "Créditos"` · `guide.credits.intro: "Las siguientes partituras precargadas están incluidas con Graditone. A continuación se detalla la atribución de composición y arreglo."` · `guide.credits.label.composer: "Compositor"` · `guide.credits.label.arranger: "Arreglado por"` · `guide.credits.label.license: "Licencia"` · `guide.credits.label.source: "Fuente"` · `guide.credits.license.pd: "Dominio público"` · `guide.credits.license.ccbyncsa: "CC BY-NC-SA"` · `guide.credits.license.all_rights_reserved: "Todos los derechos reservados — solo uso personal/educativo"` · `guide.credits.source.internal: "Grabado original de Graditone"`

**Checkpoint**: Run `npm run test -- src/i18n/locales.test` from `frontend/` — the existing key-parity
test must pass with the 10 new keys present in both files and no value missing in either locale.

---

## Phase 2: User Story 1 — User Discovers Song Attribution in the Guide (Priority: P1) 🎯 MVP

**Goal**: A Credits section (Section 6) appears at the bottom of the Guide plugin's scrollable
page, listing all 7 preloaded songs with their composer, source, and license. All text uses `t()`;
no hardcoded English strings.

**Independent Test**: Open the Guide plugin → scroll to Section 6 → verify all 7 song entries
(Bach — Invention No. 1, Beethoven — Für Elise, Burgmüller — Arabesque, Burgmüller — La Candeur,
Chopin — Nocturne Op. 9 No. 2, Pachelbel — Canon in D, Two Steps from Hell — Star Sky) appear
with Composer, License, and Source rows. Verify the Star Sky entry reads
"All rights reserved — personal/educational use only".

### Tests for User Story 1 ⚠️ Write FIRST — verify they FAIL before writing implementation

- [ ] T003 Write `frontend/src/data/creditsCatalog.test.ts` with the following failing tests (import `CREDITS_CATALOG` from `./creditsCatalog` — file does not exist yet so tests fail at import): (1) `CREDITS_CATALOG` has exactly 7 entries; (2) every entry has a non-empty `id`, non-empty `displayName`, non-empty `composer`, and a `licenseKey` that is one of the three valid `guide.credits.license.*` keys; (3) all `id` values are unique across the catalog; (4) the Bach entry (`id: 'bach-invention-1'`) has no `sourceUrl` and `licenseKey === 'guide.credits.license.pd'`; (5) the Star Sky entry (`id: 'star-sky-two-steps-from-hell'`) has `arranger: 'Smiley32'` and `licenseKey === 'guide.credits.license.all_rights_reserved'`; (6) all four MuseScore-sourced entries (Beethoven, both Burgmüller, Pachelbel) have a `sourceUrl` starting with `'https://musescore.com'` and `licenseKey === 'guide.credits.license.ccbyncsa'`
- [ ] T004 [P] Update `frontend/plugins/guide/GuidePlugin.test.tsx`: (1) in the `'renders exactly five <section> elements'` test, change `toHaveLength(5)` → `toHaveLength(6)` and update the FR comment to FR-004 of Feature 091; (2) add a new `describe` block `'GuidePlugin — Credits section (US1, Feature 091)'` containing: a test that finds a heading matching `/credits/i`; a test that finds a heading matching `/créditos/i` when rendered with `locale="es"` (wrap in a `LocaleProvider` with `locale="es"`); tests that each of the 7 song `displayName` strings appears in the document (use `screen.getByText` or `screen.getAllByText`); a test that the Star Sky entry contains the text "All rights reserved" anywhere in the section

### Implementation for User Story 1

- [ ] T005 Create `frontend/src/data/creditsCatalog.ts` — define and export the `SongCredit` interface (fields: `id: string`, `displayName: string`, `composer: string`, `arranger?: string`, `licenseKey: TranslationKey`, `sourceUrl?: string`; all fields `readonly`), the `CreditsCatalog = ReadonlyArray<SongCredit>` type alias, and the `CREDITS_CATALOG` const array with all 7 entries per the catalog table in `data-model.md` (import `TranslationKey` from `../../src/i18n/index`; do NOT import from `preloadedScores.ts`): bach-invention-1 (pd, no sourceUrl), beethoven-fur-elise (ccbyncsa, `https://musescore.com/user/71467306/scores/31905605`), burgmuller-arabesque (ccbyncsa, `https://musescore.com/user/71467306/scores/31905425`), burgmuller-la-candeur (ccbyncsa, `https://musescore.com/user/71467306/scores/31905386`), chopin-nocturne-op9-2 (pd, no sourceUrl), pachelbel-canon-d (ccbyncsa, `https://musescore.com/user/71467306/scores/31030811`), star-sky-two-steps-from-hell (all_rights_reserved, `https://musescore.com/user/1642096/scores/4156611`, arranger: `'Smiley32'`)
- [ ] T006 Add Section 6 (Credits) to `frontend/plugins/guide/GuidePlugin.tsx` — import `CREDITS_CATALOG` from `../../src/data/creditsCatalog`; append a sixth `<section className="guide-section" aria-labelledby="guide-h-credits">` after Section 5, containing: `<h2 id="guide-h-credits">{t('guide.credits.heading')}</h2>`, `<p>{t('guide.credits.intro')}</p>`, and `{CREDITS_CATALOG.map(credit => (<div className="guide-credits__entry" key={credit.id}><h3 className="guide-credits__title">{credit.displayName}</h3><dl className="guide-credits__dl"><dt>{t('guide.credits.label.composer')}</dt><dd>{credit.composer}</dd>{credit.arranger && <><dt>{t('guide.credits.label.arranger')}</dt><dd>{credit.arranger}</dd></>}<dt>{t('guide.credits.label.license')}</dt><dd>{t(credit.licenseKey)}</dd><dt>{t('guide.credits.label.source')}</dt><dd>{credit.sourceUrl ? <a href={credit.sourceUrl} target="_blank" rel="noopener noreferrer">{credit.sourceUrl}</a> : t('guide.credits.source.internal')}</dd></dl></div>))}` — match indentation and comment style of existing sections
- [ ] T007 [P] Add 2 CSS rules to `frontend/plugins/guide/GuidePlugin.css` after the `/* ── Links ───── */` block: `.guide-credits__entry { margin-bottom: 1.5rem; }` and `.guide-credits__dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.2rem 1rem; }` — add a `/* ── Credits entries ── */` section comment matching existing comment style

**Checkpoint**: Run `npm run test -- plugins/guide src/data/creditsCatalog` from `frontend/` —
all tests pass (green). Open Guide plugin in dev server (`npm run dev`) and scroll to Credits
section; verify all 7 entries render with the correct fields and the Star Sky entry shows the
all-rights-reserved license text.

---

## Phase 3: User Story 2 — Spanish-Speaking User Reads Credits in Their Language (Priority: P2)

**Goal**: All Credits section headings, labels, and descriptive text render correctly in Spanish.
Composer names, arranger names, and song titles remain in their original form (proper nouns, not
translated). No regressions to existing guide text in either locale.

**Independent Test**: Set `locale="es"` in `LocaleProvider`; render `GuidePlugin`; verify the
Credits heading reads "Créditos" and labels read "Compositor", "Licencia", "Fuente". Run the
i18n parity test to confirm no orphaned keys.

- [ ] T008 [US2] Verify `frontend/src/i18n/locales.test.ts` parity check passes for the 10 new `guide.credits.*` keys — run `npm run test -- src/i18n/locales.test` from `frontend/`; if the test fails, inspect the diff between `en.json` and `es.json` key sets and add any missing key to the file lacking it; confirm the Spanish locale test added to `GuidePlugin.test.tsx` in T004 passes (heading renders as "Créditos" with `locale="es"`)

**Checkpoint**: Run `npm run test -- src/i18n/locales.test plugins/guide` — all parity and
Spanish-locale rendering tests pass. No existing English-locale tests regress.

---

## Phase 4: User Story 3 — Developer Adds a New Preloaded Song and Updates Credits (Priority: P3)

**Goal**: Adding or removing a `SongCredit` entry in `creditsCatalog.ts` automatically updates the
Credits section in the Guide plugin with zero component changes. The catalog is the single source
of truth (FR-007, SC-005).

**Independent Test**: Add a mock entry to `CREDITS_CATALOG` (or verify the test does so
temporarily); render `GuidePlugin`; confirm the entry appears without any changes to
`GuidePlugin.tsx`.

- [ ] T009 [P] [US3] Add a "catalog-driven rendering" test to `frontend/plugins/guide/GuidePlugin.test.tsx` inside the Credits section describe block: import `CREDITS_CATALOG` from `../../src/data/creditsCatalog`; assert that `container.querySelectorAll('.guide-credits__entry').length` equals `CREDITS_CATALOG.length` (dynamic count, not hardcoded `7`) — this test proves that removing or adding an entry in the catalog changes the rendered output without touching `GuidePlugin.tsx`

**Checkpoint**: Run `npm run test -- plugins/guide` — the catalog-driven count test passes.
Manually verify: temporarily comment out one entry in `CREDITS_CATALOG` and confirm the test
fails (then uncomment to restore).

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Full regression sweep and confirmation that all acceptance criteria are met before
the PR is opened.

- [ ] T010 Run the full frontend test suite (`npm run test` from `frontend/`) and confirm zero
  failures; fix any regressions introduced by the feature; verify `locales.test.ts` passes (en ↔ es
  key parity), `creditsCatalog.test.ts` passes (all 7 entries with correct fields), and
  `GuidePlugin.test.tsx` passes (6 sections, credits heading in EN + ES, all 7 song names,
  Star Sky license text, catalog-driven count)

---

## Dependencies (Story Completion Order)

```
T001 ──┐
       ├──► T003 ──► T005 ──► T006 ──► T010
T002 ──┘         ╲                    ╱
                  ╲► T004 ──► T009 ──/
                               ╱
                    T007 ──►──/
                    T008 ──►──/
```

| Task | Depends On | Reason |
|------|-----------|--------|
| T001 | — | First: `TranslationKey` derived from `en.json` at compile time |
| T002 | — | Parallel with T001: different file, same key set |
| T003 | T001, T002 | `creditsCatalog.test.ts` imports `TranslationKey` indirectly; i18n must exist |
| T004 | T001, T002 | `GuidePlugin.test.tsx` renders with `LocaleProvider`; credits keys must resolve |
| T005 | T003 | TDD: tests must exist and fail (red) before implementation |
| T006 | T004, T005 | Tests updated (5→6 + credits); catalog exists to import |
| T007 | — | CSS is independent; safe to add at any point after Phase 1 |
| T008 | T001, T002 | Verifies parity after both locale files are updated |
| T009 | T004, T005 | Uses `CREDITS_CATALOG` import in test file; catalog must exist |
| T010 | T005–T009 | Full regression sweep after all changes |

---

## Parallel Execution Opportunities

| Parallel Set | Tasks | Why Safe |
|---|---|---|
| Locale files | T001 ‖ T002 | Different files: `en.json` ‖ `es.json` |
| Test files | T003 ‖ T004 | Different files: `creditsCatalog.test.ts` ‖ `GuidePlugin.test.tsx` |
| CSS | T007 ‖ T005/T006 | Different files: `GuidePlugin.css` ‖ `creditsCatalog.ts` / `GuidePlugin.tsx` |
| Parity check | T008 ‖ T009 | Both depend on T004+T005 but operate independently |

**Maximum parallelism** (after T001+T002 complete):
- Thread A: T003 → T005 → T006
- Thread B: T004 → T009
- Thread C: T007 (any time after T001/T002)
- Thread D: T008 (any time after T001/T002)

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (T001 + T002 in parallel) — i18n foundation
2. Complete Phase 2 (T003 + T004 in parallel → T005 → T006 + T007 in parallel)
3. **STOP and VALIDATE**: Open Guide plugin → scroll to Credits → confirm all 7 entries
4. US1 is fully functional and independently testable — MVP deliverable complete

### Incremental Delivery

1. Phase 1 → Phase 2 → validate → **MVP demo** (US1 live)
2. Phase 3 (T008) → **US2 complete** (Spanish locale verified)
3. Phase 4 (T009) → **US3 complete** (catalog-driven contract locked in)
4. Phase 5 (T010) → **PR ready**

Each phase adds value without breaking previous phases.

### Parallel Team Strategy

With two developers after Phase 1:

- **Dev A**: T003 → T005 → T006 (data model + component implementation)
- **Dev B**: T004 → T007 → T009 (test updates + CSS + catalog-driven test)
- Both: run T008 and T010 together

---

## Acceptance Criteria Traceability

| Acceptance Criterion | Task(s) | Test Location |
|---|---|---|
| SC-001: All 7 songs visible in Credits section | T005, T006 | T003 (catalog count), T004 (display names) |
| SC-002: Every entry has title, composer, license | T005 | T003 (field validation) |
| SC-003: Text correct in EN and ES | T001, T002, T008 | T004 (locale="es"), locales.test.ts |
| SC-004: Accessible — labelled heading, screen-reader order | T006 | T004 (aria-labelledby via role heading) |
| SC-005: New entry = zero component changes | T005 (catalog design), T006 (map pattern) | T009 (catalog-driven count) |

---

## Notes

- **[P]** tasks operate on different files — no merge conflicts when run in parallel
- **[US]** label maps each task to its user story for traceability
- TDD constraint (Constitution Principle V): T003 and T004 **must** be written and run (failing) before T005/T006 implementation begins
- Regression prevention (Constitution Principle VII): the `toHaveLength(5)` assertion in `GuidePlugin.test.tsx` **must** be changed to `toHaveLength(6)` in T004 **before** adding Section 6 in T006 — adding the section first would silently pass a stale assertion
- `creditsCatalog.ts` does NOT import from `preloadedScores.ts` — the two files are intentionally independent (data-model.md § Relationship to Existing Data Models)
- `licenseKey` is typed as `TranslationKey` — the TypeScript compiler will reject any key not present in `en.json` at build time; this is the intended compile-time safety net
- Star Sky is the only non-public-domain piece — its license entry `guide.credits.license.all_rights_reserved` must render exactly as specified (research.md § Risk note)
