# Contract: Guide Plugin — Plugin API Contract

**Phase 1 output** | Feature `001-docs-plugin` | 2026-03-13

This file documents the interface contracts between the Guide plugin and the Graditone plugin host (App.tsx).

---

## Contract 1: `plugin.json` Schema

The Guide plugin manifest must satisfy `PluginManifest` (omitting `origin`, which is set by the host):

```jsonc
{
  "id": "guide",
  "name": "Guide",
  "version": "1.0.0",
  "pluginApiVersion": "1",
  "entryPoint": "index.tsx",
  "description": "App guide and usage documentation for Graditone.",
  "type": "common",         // required: makes plugin appear in the nav bar
  "view": "window",         // required: host provides back-button bar
  "icon": "📖",             // required: displayed in nav bar entry
  "order": 99               // required: guarantees rightmost nav bar placement
}
```

**Invariants enforced by host**:
- If `type` ≠ `"common"`, the plugin will NOT appear in the nav bar.
- If `order` is absent or non-finite, the plugin sorts alphabetically after ordered common plugins.
- If `pluginApiVersion` ≥ `"3"`, the host uses the V3PluginWrapper (no host back button rendered) — Guide must remain at `"1"` to receive the host back button.

---

## Contract 2: `GraditonePlugin` Interface

The default export from `index.tsx` must satisfy:

```ts
import type { GraditonePlugin, PluginContext } from '../../src/plugin-api/index';

const guidePlugin: GraditonePlugin = {
  init(context: PluginContext): void { /* store context, no features consumed */ },
  dispose(): void { /* release stored context */ },
  Component: GuidePlugin,   // React ComponentType; renders the full guide view
};

export default guidePlugin;
```

**Invariants**:
- Only `../../src/plugin-api/index` may be imported from the host application (ESLint `no-restricted-imports` enforced).
- `Component` must render without crashing when `init()` has been called (context set).
- No network requests are permitted in `Component` — content must be fully static.

---

## Contract 3: Component Rendering Contract

The `GuidePlugin` React component must satisfy:

| Requirement | Specification |
|-------------|---------------|
| Props | None (stateless; receives no props) |
| DOM structure | Root element with `className="guide-plugin"` |
| Sections | Five `<section>` elements, each with a unique `<h2>` heading |
| Section headings | "What is Graditone?", "Playing a Score", "Practice Mode", "Train", "Loading a Score" |
| Scroll | Root element must scroll vertically (`overflow-y: auto`) |
| Responsive | Width must not overflow viewport on 375 px–1366 px screens |
| Offline | No `fetch`, `import()`, or dynamic content loading |
| Theming | All CSS colours and fonts MUST use `--color-*` custom properties (see Contract 5) |

**Tested by**: `GuidePlugin.test.tsx` — tests 1 (render), 2 (sections), 3 (contract), 4 (manifest order).

---

## Contract 4: Nav Bar Positioning Contract

The Guide plugin must be the rightmost visible entry in the Graditone nav bar.

**Mechanism**: `sortPluginsByOrder` in `sortPlugins.ts` sorts all plugin entries by `manifest.order` ascending (Infinity for absent). The nav bar renders `allPlugins.filter(type !== 'core' && !hidden)`. With `order: 99`, Guide sorts after all current core plugins (order 1/2/3) in the global sort; core plugins are filtered out before rendering, leaving Guide as the only (rightmost) visible nav entry.

**Future compatibility**: Any future `common` plugin without an explicit `order` value will sort at Infinity and appear to the right of Guide. Any future `common` plugin with `order < 99` will appear to the left of Guide. No code changes are required in Guide to maintain rightmost placement among intentionally ordered plugins.

---

## Contract 5: CSS Theming Contract

All colour and font values in `GuidePlugin.css` MUST use the app's `--color-*` CSS custom property tokens. Hard-coded colour values are not permitted.

**Token reference** (defined on `body[data-landing-theme]` in `App.css`, bridged from `--ls-*` theme tokens):

| Token | Role | Fallback |
|-------|------|----------|
| `--color-surface` | Background of the guide panel | `#fff` |
| `--color-text` | Heading / bold text colour | `#222` |
| `--color-text-secondary` | Body / paragraph text colour | `#555` |
| `--color-border` | Section divider line colour | `#e0e0e0` |
| `--color-accent` | Accent highlight (e.g. h2 underline) | `#4a90e2` |

**Rationale**: This is the established pattern for all plugins (`TrainPlugin.css`, `plugin-dialog.css`). When a user switches landing theme, every theme-aware property in GuidePlugin.css updates automatically without requiring a code change in the Guide.
