---
name: Graditone Plugin Development
description: Rules and workflow for building Graditone/Musicore plugins — public (in-repo) and private (separate graditone-pro-plugins repo), builtin and importable. Use whenever creating, editing, reviewing, or packaging a plugin under frontend/plugins/ or plugins-external/, touching plugin.json, wiring a plugin into the host, or setting up a private-plugin worktree, to keep integration strictly within the Plugin API boundary.
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

**Note the scope:** the host lint rule covers `frontend/plugins/` (public
plugins). Private plugins under `plugins-external/` are guarded by their own
`eslint.config.js`, which carries a matching `no-restricted-imports` boundary
rule (same Plugin API-only rule, matched at any nesting depth). The host-side
files *inside* `src/plugin-api/` are the adapters and legitimately use host
internals.

## Constitution Principle VI — layout authority

`PluginNoteEvent` carries **musical data only** (`midiNote`, `timestamp`,
`velocity`, `type`, `offsetMs`, `durationMs`). Never add coordinates, bounding
boxes, or layout geometry. The WASM engine is the sole authority over spatial
layout; `emitNote()` feeds it and the API/WASM compute geometry. TypeScript-side
layout in plugin code is prohibited.

## Where plugins live: public vs private

Plugins are developed in **two different repositories** with different workflows.
Decide which one a task belongs to before touching anything.

| | Public plugins | Private plugins |
|---|---|---|
| Repo | the graditone repo itself | `graditone-pro-plugins` (private; GitHub org `aylabs`) |
| Source | `frontend/plugins/<id>/` — committed | `plugins-external/<id>/` — **gitignored** in graditone |
| Branch/PR | graditone branch & PR | its own branch & PR in the private repo |
| Tooling | host Vite / esbuild / `tsc` / Vitest / main ESLint | own `package.json`, `tsconfig.json`, Vitest, esbuild `build.sh`, own `eslint.config.js` |
| Host dev | bundled at build time via `import.meta.glob` | symlinked into `frontend/plugins/` for HMR, or ZIP import |
| Shipped as | part of the app | `build.sh` → `<id>.zip` (bundled ESM + inlined CSS) |
| Boundary guard | ESLint `no-restricted-imports` — hard error | own ESLint `no-restricted-imports` in `plugins-external/eslint.config.js` — hard error |
| E2E tests | `frontend/e2e/` | the plugin's own `e2e/` folder, not `frontend/e2e/` |

### Private-plugin workflow (gitignored, separate repo)

`plugins-external/` maps 1:1 to the *root* of the `graditone-pro-plugins`
monorepo, so `../../frontend/` resolves back to the graditone worktree. Each
subdirectory (`sessions-plugin/`, `virtual-keyboard-pro/`, …) is a standalone
package. Because git worktrees cover only graditone, clone the monorepo into the
**feature worktree's** `plugins-external/`:

```bash
# inside the graditone worktree
git clone git@github.com:aylabs/graditone-pro-plugins.git plugins-external
cd plugins-external && git checkout -b <same-branch>
cd <plugin-id> && npm install
```

> ⚠️ Clone into `plugins-external/` directly, never into
> `plugins-external/<plugin-id>/` — the monorepo root must equal
> `plugins-external/` for relative imports to resolve.

Edit only files inside `plugins-external/<plugin-id>/`; spec paths (plan/tasks)
are written relative to the plugin subdirectory. For live host development,
symlink it in (the symlink is gitignored, never committed):

```bash
ln -s ../../plugins-external/<plugin-id> frontend/plugins/<plugin-id>
# then run both dev servers: frontend/ `npm run dev` + plugin `npm run dev`
```

Private plugins are excluded from the host's `tsc`/`vitest`; run their own suite
and build: `npm test && npm run build` in the plugin dir. The change usually
yields **two PRs** — one in graditone (host/API, if any) and one in
`graditone-pro-plugins`.

## Distribution shapes (builtin vs importable)

Independent of the repo, how a plugin reaches the host:

| | Builtin | Importable |
|---|---|---|
| Discovery | build time (`import.meta.glob`) | runtime via Blob URL + dynamic `import()` |
| Entry | `index.tsx` | pre-bundled `index.js` (ESM, default-exports the plugin) |
| Registration | auto (dir with `index` + `plugin.json`) | user imports ZIP in the UI |

Manifest (`plugin.json`), all shapes: `id`, `name`, `version`,
`pluginApiVersion`, `entryPoint` are required strings. Do **not** include
`origin` — the host sets it (`builtin` | `imported`).

`pluginApiVersion` is the **minimum** host API version the plugin needs. It must
be **≤** the host's `PLUGIN_API_VERSION`: the importer rejects any plugin whose
declared version exceeds the host's (`PluginImporter.ts`), while older plugins
keep working. Read the host constant, don't hardcode a number.

## Plugin API versioning policy

`PLUGIN_API_VERSION` (in `frontend/src/plugin-api/types.ts`) is a single
integer — the host's current public-surface version. `pluginApiVersion` in a
manifest is the minimum the plugin requires.

**Bump it (+1) on *any* change to the public surface:** a new exported type,
`PluginContext` member, host-provided component, utility class, or shared value
(e.g. `SCALE_OPTIONS`). Rationale: the importer gates on
`pluginApiVersion ≤ PLUGIN_API_VERSION`, so an un-bumped addition could load on
an older host that lacks it. Do **not** bump for internal-only changes.

When you bump, in the same change:
1. Update the constant in `types.ts`.
2. Update the barrel header and its versioned export comments (`index.ts`).
3. Update the `PLUGIN_API_VERSION` contract test in `plugin-api.test.ts`.
4. Any plugin that newly depends on the surface sets its `plugin.json`
   `pluginApiVersion` to the new value (private plugins too).

**Additive only.** Never rename or remove an existing export — that breaks
already-published plugins. Extend with new members and leave the old ones.

## Plugin entry skeleton (public and private, same shape)

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
- **React is externals.** Bundlers (esbuild for private plugins) must mark
  `react`/`react-dom` external; the host provides them. A bundled private plugin
  has no Vite CSS pipeline — it injects its CSS into `<head>` at runtime.
- **Tests required.** Vitest + Testing Library; test-first is mandatory for API
  methods and plugin interactions. Public → host suite; private → plugin's own.

## Authoritative references

Read these instead of trusting memory — they are the source of truth and drift:

- `PLUGINS.md` — full developer guide (API reference, packaging, ESLint boundary, i18n; Virtual Keyboard Pro as importable reference)
- `frontend/src/plugin-api/index.ts` — the public barrel + current `PLUGIN_API_VERSION`
- `frontend/src/plugin-api/types.ts` — full `PluginContext` / manifest / event types
- `frontend/eslint.config.js` — the enforced import boundary (public plugins)
- `plugins-external/README.md` — private monorepo layout, symlink dev loop, per-plugin tooling
- `docs/e2e-external-plugins.md` — e2e test requirements for private plugins
- `.specify/memory/constitution.md` → “External Plugin Repositories” — the clone-per-worktree rule
- `docs/plugin-system.md`, `specs/030-plugin-architecture/`, `specs/049-architecture-review/adrs/ADR-049-001-plugin-architecture.md`
