# Research: Graditone Documentation Plugin

**Phase 0 output** | Feature `001-docs-plugin` | 2026-03-13

---

## R-001: Plugin type classification — `"core"` vs `"common"`

**Question**: Should the Guide plugin be `"type": "core"` or `"type": "common"`?

**Research findings**:

The Graditone Plugin API (types.ts) defines two roles:
- `'core'` — first-class feature; shown as a launch button on the Landing Screen. The host rendering in App.tsx uses an early-return pattern when a core full-screen plugin is active: the entire React tree (including header and nav bar) is replaced by the plugin's component.
- `'common'` — utility/tool; accessible via the plugin nav bar in the header. The nav bar rendering in App.tsx filters to `p.manifest.type !== 'core' && !p.manifest.hidden`.

**Implication**: `type: "core"` plugins do NOT appear in the top nav bar — they appear on the landing screen as large launch buttons. This directly contradicts the user requirement "shown in the top menu bar, to the right."

The spec clarification session (Q3) incorrectly recommended `"type": "core"` based on the mistaken assumption that Play/Train/Practice appear in the nav bar. In reality, they appear on the landing screen only.

**Decision**: `"type": "common"`

**Rationale**: Only `common` plugins appear in the top nav bar. This is the only way to satisfy FR-002 and the user requirement.

**Alternatives rejected**:
- `"type": "core"`: Places plugin on landing screen, not in nav bar. Contradicts requirement.

---

## R-002: Plugin view mode — `"window"` vs `"full-screen"`

**Question**: What view mode should the Guide use?

**Research findings**:

- `"view": "full-screen"`: When `activePlugin` targets a full-screen plugin, App.tsx performs an early return — the entire app tree (header, nav, landing) is replaced. The plugin owns the entire viewport and must provide its own back navigation.
- `"view": "window"`: The common plugin overlay (position: fixed, inset 0, z-index 100) is rendered inline within the existing app tree. For plugins with `pluginApiVersion < 3`, App.tsx renders a host-provided back button bar (`← Back`). For `pluginApiVersion >= 3`, the V3PluginWrapper is used (no host back button — plugin must handle its own navigation).

**Decision**: `"view": "window"` + `"pluginApiVersion": "1"`

**Rationale**: The Guide is a simple documentation plugin that does not need to own viewport navigation. Using `view: "window"` and declaring `pluginApiVersion: "1"` (the base contract) causes App.tsx to render the host-provided `← Back` button automatically. The Guide component only needs to render content. This is the minimal, correct approach.

**Alternatives rejected**:
- `"view": "full-screen"`: Requires Guide to implement its own back navigation, adding complexity without benefit.
- `pluginApiVersion: "6"` with `view: "window"`: Would activate V3PluginWrapper, which does not render a host back button; Guide would need its own back button. Unnecessary for a static content plugin.

---

## R-003: Plugin order and nav-bar positioning

**Question**: How does `order: 99` guarantee rightmost placement in the nav bar?

**Research findings**:

`App.tsx` calls `sortPluginsByOrder(entries)` where `entries` = BUILTIN_PLUGINS + imported plugins. `sortPluginsByOrder` (sortPlugins.ts) sorts all entries by `manifest.order` ascending (Infinity if absent).

Current order values:
- `play-score`: 1 (core)
- `train-view`: 2 (core)
- `practice-view-plugin`: 3 (core)
- `virtual-keyboard`: no order, hidden (common)
- User-imported plugins: no order (sorts as Infinity)

The nav bar renders `allPlugins.filter(p => p.manifest.type !== 'core' && !p.manifest.hidden)`. After filtering, visible common plugins appear in the same order as the sorted `allPlugins` array.

With `order: 99`, Guide appears after core plugins (1/2/3) in the global sort. When the nav bar filters out core plugins, Guide is positionally before any unordered common plugins (Infinity). This ensures:
- Guide appears to the right of all other visible common plugins (none currently)
- Any future common plugin with no order (Infinity) appears to the right of Guide — unless they also specify an order < 99

**Decision**: `"order": 99` is correct and sufficient.

**Issue**: `builtinPlugins.ts` builds COMMON_BUILTINS sorting only by `id` alphabetically (ignores `order`). However, `builtinPlugins.ts` is only one input — the final sort comes from `sortPluginsByOrder` in App.tsx which processes all plugins together. The common-sort in `builtinPlugins.ts` only determines order within `BUILTIN_PLUGINS` before it reaches `sortPluginsByOrder`. Since `sortPluginsByOrder` re-sorts everything by `order`, the internal common sort in `builtinPlugins.ts` does not matter for final nav bar order.

**Conclusion**: No change to `builtinPlugins.ts` is required for order. `sortPluginsByOrder` already handles common plugins correctly. The preliminary `buildEntries('common')` sort by id inside `builtinPlugins.ts` is overridden by the final `sortPluginsByOrder` call.

---

## R-004: Plugin API surface required by Guide

**Question**: What Plugin API features does the Guide plugin need?

**Research findings**: The Guide plugin is pure documentation — static content in a scrollable React component. It does not need:
- Score loading or playback (`context.scorePlayer`)
- MIDI input (`context.recording`)
- Staff viewer rendering (`context.components.StaffViewer`)
- Metronome (`context.metronome`)

It uses only the base `GraditonePlugin` contract:
```ts
interface GraditonePlugin {
  init(context: PluginContext): void;
  dispose?(): void;
  Component: ComponentType;
}
```
The `context` argument in `init()` can be stored but is not read (no context features used).

**Decision**: Declare `"pluginApiVersion": "1"`. This is semantically correct (uses only v1 API surface) and activates the host back-button bar.

---

## R-005: Plugin content structure and format

**Question**: How should the Guide content be authored and stored?

**Research findings**:

Options considered:
- **Markdown files loaded at runtime**: Requires a markdown parser dependency and either a fetch (breaking offline guarantee) or bundling as raw string (complex Vite config).
- **Inline JSX with semantic HTML**: Zero dependencies, works offline by definition, fully type-checked, consistent with React component conventions. Other plugins do not load external content files.
- **Separate JSON data file imported as module**: Possible but adds indirection with no benefit over inline JSX.

**Decision**: Inline JSX/HTML in `GuidePlugin.tsx`. Sections are `<section>` elements with `<h2>` headings and `<p>`/`<ul>` content. The component receives no props (static).

**Rationale**: Simplest approach, fully offline, no new dependencies. Consistent with constitutional principle of minimal complexity.

---

## R-006: Test strategy for a static content plugin

**Question**: What tests are needed for a plugin that renders only static content?

**Research findings**:

Following the existing plugin test pattern (e.g., `PlayScorePlugin.test.tsx`), tests use Vitest + `@testing-library/react`. For a static content plugin, the meaningful tests are:

1. **Rendering smoke test**: Component renders without throwing.
2. **Section heading presence**: All four required sections have labelled headings in the DOM (maps to FR-004, SC-003).
3. **Plugin contract**: The `index.tsx` exports a valid `GraditonePlugin` object with `init`, `Component` fields (maps to FR-001).
4. **Nav entry rightmost**: A test verifying the manifest declares `order: 99` and `type: "common"` (structural, maps to FR-002).
5. **Offline capability**: Content renders without any `fetch` or network calls (implicit in static JSX; can be verified with a mock that throws on `fetch`).

**Decision**: Write tests 1–4. Test 5 is implicit (static JSX cannot trigger fetch) — document in comments but no assertion needed.

---

## R-007: Spec correction — Update required before implementation

The following spec fields must be updated to reflect R-001 findings:

| Location | Current value | Correct value |
|----------|--------------|---------------|
| Assumptions bullet 2 | `"type": "core"` | `"type": "common"` |
| FR-001 | `"type": "core"` | `"type": "common"` |
| Clarification Q3 | `full-screen — consistent with core nav plugins` | `window — common plugin, host provides back button` |

These will be corrected as part of the plan deliverables (spec updated in-place).

---

## Summary of Decisions

| Decision | Value | Research ref |
|----------|-------|-------------|
| Plugin type | `"common"` | R-001 |
| Plugin view | `"window"` | R-002 |
| pluginApiVersion | `"1"` | R-002, R-004 |
| Plugin icon/name | `📖 / "Guide"` | Clarification Q1 |
| Plugin order | `99` | R-003 |
| `builtinPlugins.ts` change needed? | No | R-003 |
| Content format | Inline JSX | R-005 |
| Test strategy | 4 tests (render, sections, contract, order) | R-006 |
| Plugin id | `guide` | Convention (`frontend/plugins/guide/`) |
