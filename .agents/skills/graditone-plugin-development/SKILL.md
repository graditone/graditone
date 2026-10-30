---
name: Graditone Plugin Development
description: Rules and workflow for building Graditone/Musicore plugins — builtin and importable. Use whenever creating, editing, reviewing, or packaging a plugin under frontend/plugins/ or plugins-external/, touching plugin.json, or wiring a plugin into the host, to keep integration strictly within the Plugin API boundary.
---

# Graditone Plugin Development

## The one rule

**A plugin integrates with the Graditone platform *only* through the Plugin API.**
Everything a plugin is allowed to know about the host is exported from a single
barrel:

```ts
import type { MusicorePlugin, PluginContext, PluginNoteEvent } from '../../src/plugin-api/index';
```

`frontend/src/plugin-api/index.ts` is the **only** host module a plugin may
import. `PluginContext` (injected into `init()`) is the **only** channel from
plugin → host. If an integration needs something the API does not expose, extend
the API surface (additive, versioned) — never reach around it.

## Forbidden — enforced by ESLint

`frontend/eslint.config.js` applies `no-restricted-imports` to
`plugins/**/*.{ts,tsx}`. These are hard, lint-time errors:

```ts
// ❌ host internals
import { ToneAdapter } from '../../src/services/playback/ToneAdapter';
import { ScoreViewer }  from '../../src/components/ScoreViewer';
import { someUtil }     from '../../src/utils/someUtil';
// forbidden patterns: src/components/*, src/services/*, src/pages/*,
//                    src/data/*, src/utils/*, src/hooks/*

// ❌ direct audio access — host owns the single AudioContext
import * as Tone from 'tone';
const ctx = new AudioContext();
```

Route audio through `context.playNote()` / `context.stopPlayback()`.
The host owns Tone.js + the shared AudioContext; plugins must not create one.

**Note the scope:** the lint rule covers `frontend/plugins/` (builtin plugins).
External plugins under `plugins-external/` follow the same boundary by
convention and are validated at ZIP import time. The host-side files *inside*
`src/plugin-api/` are the adapters and legitimately use host internals.

## Constitution Principle VI — layout authority

`PluginNoteEvent` carries **musical data only** (`midiNote`, `timestamp`,
`velocity`, `type`, `offsetMs`, `durationMs`). Never add coordinates, bounding
boxes, or layout geometry. The WASM engine is the sole authority over spatial
layout; `emitNote()` feeds it and the API/WASM compute geometry. TypeScript-side
layout in plugin code is prohibited.

## Two plugin shapes

| | Builtin | Importable |
|---|---|---|
| Location | `frontend/plugins/<id>/` | packaged ZIP, root-level files |
| Bundled | build time (`import.meta.glob`) | runtime via Blob URL + dynamic `import()` |
| Entry | `index.tsx` | pre-bundled `index.js` (ESM, default-exports the plugin) |
| Registration | add to `frontend/src/services/plugins/builtinPlugins.ts` | user imports ZIP in the UI |

Manifest (`plugin.json`), both shapes: `id`, `name`, `version`,
`pluginApiVersion`, `entryPoint` are required strings. Do **not** include
`origin` — the host sets it (`builtin` | `imported`).

`pluginApiVersion` must equal `PLUGIN_API_VERSION` exported from
`frontend/src/plugin-api/index.ts` — read it, do not hardcode a number.
Additive-only versioning means newer app versions keep loading older plugins;
a plugin requiring an API version the host doesn't have is rejected.

## Builtin plugin skeleton

```ts
// index.tsx
import type { MusicorePlugin, PluginContext } from '../../src/plugin-api/index';
import { MyPlugin } from './MyPlugin';

let _context: PluginContext | null = null; // module scope — Component closure reads it

const plugin: MusicorePlugin = {
  init(context) { _context = context; },
  dispose() { _context = null; },              // release resources
  Component: () => (_context ? <MyPlugin context={_context} /> : null),
};
export default plugin;
```

`init()` runs once at startup; `dispose()` on unregister. Initialization order
across plugins is undefined — never depend on state set by another plugin.

## Boundaries to respect

- **No host `i18n` imports.** A plugin bundles its own locale module (see the
  canonical `plugins-external/sessions-plugin/`). Same boundary rule.
- **Theming.** Use `--ls-*` CSS tokens (they cascade into plugin trees); avoid
  hard-coded colors, which break on non-default themes.
- **React is externals.** Bundlers must mark `react`/`react-dom` external; the
  host provides them.
- **Tests required.** Vitest + Testing Library; test-first is mandatory for API
  methods and plugin interactions.

## Authoritative references

Read these instead of trusting memory — they are the source of truth and drift:

- `PLUGINS.md` — full developer guide (API reference, packaging, ESLint boundary, i18n)
- `frontend/src/plugin-api/index.ts` — the public barrel + current `PLUGIN_API_VERSION`
- `frontend/src/plugin-api/types.ts` — full `PluginContext` / manifest / event types
- `frontend/eslint.config.js` — the enforced import boundary
- `docs/plugin-system.md`, `specs/030-plugin-architecture/`, `specs/049-architecture-review/adrs/ADR-049-001-plugin-architecture.md`
