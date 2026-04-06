# Research: Sessions Plugin i18n (074)

**Phase 0 output** | Branch: `074-sessions-plugin-i18n` | Date: 2026-04-06

---

## Research Question 1: Library vs Custom Implementation

**Context**: ~200 translation keys, 2 languages, pluralization needed (task/tasks, activity/activities, session/sessions), string interpolation needed (`{count} tasks`, `{percent}%`, etc.). Plugin API boundary prohibits importing from the host's `frontend/src/i18n/` module (FR-008).

**Decision**: Custom lightweight implementation — same approach as Feature 073, extended with a pluralization helper

**Rationale**:
- Feature 073's 50-line custom implementation already covers interpolation and the `LocaleProvider` / `useTranslation` pattern
- The sessions plugin is larger than the landing page (~200 vs 30 keys) and introduces plural forms, but both are still well below the threshold where a third-party library pays for itself
- `i18next` / `react-i18next` are ~50 KB+ gzipped, require async namespace loading configuration, and impose ICU message syntax — none of this is warranted for a self-contained plugin bundle
- A custom implementation keeps the bundle minimal (JSON catalogs are ~5–8 KB), is 100% statically typed via `keyof typeof enCatalog`, and is fully testable with Vitest + a mock `LocaleProvider`
- Pluralization is handled by separate catalog keys (`task` vs `tasks`, `activity` vs `activities`) — the component selects the key, not the translation function. This eliminates runtime plural-rule logic while remaining fully translatable

**Alternatives considered**:
- `i18next` + `react-i18next`: Eliminated — 50 KB+ overhead for 200 static keys; async loading by default; adds 2 runtime deps to a standalone plugin ZIP
- `@formatjs/intl` + `react-intl`: Eliminated — ICU plural syntax requires build tooling; heavier than needed; no async loading advantage
- Shared host i18n module: Eliminated — violates Plugin API boundary (FR-008); would tightly couple the plugin to the host app version

---

## Research Question 2: Pluralization Strategy

**Context**: Many sessions plugin strings require plural forms: `{N} task / tasks`, `{N} activity / activities`, `{N} session / sessions`. Feature 073 had no pluralization. Options include ICU plural rules, a `plural()` helper function, or separate catalog keys per plural form.

**Decision**: Separate catalog keys per plural form, selected by the component

**Rationale**:
- The calling component always has the count available and can choose the key: `t(count === 1 ? 'common.task' : 'common.tasks', { count })`
- This approach requires zero runtime plural-rule processing and zero special syntax in the catalog JSON
- All plural forms are statically typed — a misspelled key is a TypeScript error at compile time
- Spanish pluralization follows the same singular/plural split as English for all strings in this plugin (no irregular plural forms), so 2 keys per concept is sufficient
- The `count` parameter can be interpolated into either key when needed: `t('calendar.activity_plural', { count: 5 })` → `"5 activities"`
- Shared plural keys are namespaced under `common.*` to avoid duplication across components

**Alternatives considered**:
- ICU plural syntax (`{count, plural, one {# activity} other {# activities}}`): Eliminated — requires a parser in `useTranslation`; not needed for EN/ES which share the same plural split
- `plural(count, t('key.singular'), t('key.plural'))` helper: Eliminated — adds a helper function that just obscures the component's intent; the direct ternary is clearer and equally brief

---

## Research Question 3: Guide Prose Translation Strategy

**Context**: `SessionsGuide.tsx` contains rich HTML content with `<strong>`, `<ol>`, `<ul>`, `<li>`, `<p>`, and `<code>` elements. Unlike simple UI strings, guide content is paragraph-length and contains inline markup. This is in scope per clarification Q1.

**Decision**: Store guide strings as HTML-containing catalog values; render with `dangerouslySetInnerHTML` in translated guide sections

**Rationale**:
- The core app's `en.json` already uses this pattern: `"guide.what.p3"` contains a full `<a>` tag with href and attributes
- All catalog strings are developer-authored at build time (compiled into the bundle) — not user input — so there is no XSS risk when using `dangerouslySetInnerHTML` with these values
- This approach keeps the `SessionsGuide` component structure intact: guide sections remain as JSX containers (`<section>`, `<h3>`), while their text content is replaced with translated HTML strings using `dangerouslySetInnerHTML`
- The alternative (splitting each bold word into its own key) would multiply key count and make the catalog illegible
- List items that contain only inline `<strong>` markup are stored as complete HTML strings: `"<strong>Scheduled</strong> — planned for a future date. Tap ▶ Activate when ready."`

**Alternatives considered**:
- Plain-text only (strip `<strong>` from guide): Eliminated — loses the visual emphasis that makes the guide usable; downgrade to users
- Split keys per bold segment: Eliminated — explodes key count; catalog becomes unreadable and unmaintainable
- Markdown rendering: Eliminated — adds a Markdown parser dependency with no other use in the plugin

---

## Research Question 4: Locale Detection and Context Placement

**Context**: The sessions plugin is a React component tree rooted at `SessionsPlugin` (rendered by `index.tsx` → Plugin API → host). The `LocaleProvider` must wrap this root to share the resolved locale with ~16 child components. The host does not expose its active locale through the Plugin API.

**Decision**: `LocaleProvider` wraps `SessionsPlugin` in `index.tsx` (the plugin entry point); locale is resolved once from `navigator.language` at mount

**Rationale**:
- `index.tsx` is the plugin entry point where the `Component` export is defined — wrapping here ensures every render of the plugin, in any context, has a `LocaleProvider`
- The `SessionsPlugin.tsx` component itself should not own the `LocaleProvider` (it would be harder to test in isolation); placing it in `index.tsx` follows the same pattern as the core app where `LocaleProvider` wraps `App` at the top level
- `navigator.language` is read once at mount — no re-reads per component; consistent locale throughout the session
- `LocaleProvider` accepts an optional `locale` prop for unit tests to inject a fixed locale (no `navigator.language` mock needed in tests)
- This is identical to Feature 073's pattern: provider at root, hook at leaf

**Alternatives considered**:
- `LocaleProvider` inside `SessionsPlugin` root: Functional duplicate — works but forces `SessionsPlugin` tests to always provide a locale; cleaner to keep provider in entry point
- Per-component `navigator.language` reads: Eliminated — redundant reads, inconsistent locale if system language changes mid-session, harder to test

---

## Research Question 5: TypeScript Key Safety with ~200 Keys

**Context**: The sessions plugin has ~200 translation keys vs the 30 in Feature 073. The same `keyof typeof enCatalog` pattern must enforce exhaustiveness on both the component call sites and the Spanish catalog.

**Decision**: Same approach as Feature 073 — `enCatalog` as source of truth; `TranslationKey = keyof typeof enCatalog`; Spanish catalog typed as `Record<TranslationKey, string>`

**Rationale**:
- 200 keys present no additional complexity for TypeScript's type system vs 30 keys
- The `resolveJsonModule: true` is already in the sessions plugin's `tsconfig.json` (Vite projects enable this by default)
- A catalog-completeness test (FR-012d) is added to `i18n.test.ts` to catch any Spanish key missing at runtime during testing, complementing the compile-time check
- The same `tDynamic` escape hatch from Feature 073 (for runtime-assembled keys) can be included but is unlikely to be needed here — all keys are statically known

**Alternatives considered**:
- Codegen (extract keys from source files): Eliminated — introduces a build step; for 200 keys in a single module, static authoring is manageable
- Separate namespace objects: Eliminated — adds indirection; flat JSON with dotted keys is already hierarchical enough for navigation

---

## Summary of Decisions

| Question | Decision | Rationale Summary |
|---|---|---|
| Library selection | **Custom implementation** | 200 static keys; catalog compiled into bundle; no library overhead |
| Pluralization | **Separate keys per plural form** | Component selects key by count; zero runtime plural logic; fully typed |
| Guide prose | **HTML strings + `dangerouslySetInnerHTML`** | Developer-authored content (no XSS); matches core app pattern; preserves bold emphasis |
| Context placement | **`LocaleProvider` wraps root in `index.tsx`** | Consistent with Feature 073; injectable locale for testing without mocks |
| TypeScript safety | **`keyof typeof enCatalog` + runtime completeness test** | Compile-time + test-time exhaustiveness; same pattern as Feature 073 |
