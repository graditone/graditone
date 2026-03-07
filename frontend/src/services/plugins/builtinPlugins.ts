/**
 * Built-in plugin registry — T016
 * Feature 030: Plugin Architecture
 *
 * Built-in plugins are bundled at build time and registered in-memory on app
 * startup. They are NOT written to IndexedDB (see research.md R-006).
 *
 * Both core and common plugins are discovered automatically via Vite's
 * import.meta.glob — any directory under frontend/plugins/ that has both an
 * index file and a plugin.json is included. Type is read from plugin.json:
 *
 *   type: "core"   → landing screen buttons, sorted by `order` field
 *   type: "common" → banner items below the title, sorted alphabetically by id
 *
 * To add a new plugin (built-in or symlinked external): create / symlink the
 * directory with index + plugin.json — no manual registration needed here.
 */

import type { PluginManifest, GraditonePlugin } from '../../plugin-api/index';

// Both globs are resolved eagerly at build time by Vite (no runtime overhead).
const indexModules = import.meta.glob('../../../plugins/*/index.{ts,tsx}', {
  eager: true,
  import: 'default',
}) as Record<string, GraditonePlugin>;

const manifestModules = import.meta.glob('../../../plugins/*/plugin.json', {
  eager: true,
}) as Record<string, Omit<PluginManifest, 'origin'>>;

export interface BuiltinPluginEntry {
  manifest: PluginManifest;
  plugin: GraditonePlugin;
}

function buildEntries(type: 'core' | 'common'): BuiltinPluginEntry[] {
  return Object.entries(indexModules)
    .flatMap(([indexPath, plugin]) => {
      const manifestPath = indexPath.replace(/index\.(ts|tsx)$/, 'plugin.json');
      const manifestJson = manifestModules[manifestPath];
      if (!manifestJson || manifestJson.type !== type) return [];
      return [{
        plugin,
        manifest: { ...manifestJson, origin: 'builtin' as const },
      }];
    })
    .sort((a, b) => {
      // Core plugins: sort by explicit order field, then by id.
      // Common plugins: sort alphabetically by id (no order convention).
      if (type === 'core') {
        const oa = a.manifest.order ?? Infinity;
        const ob = b.manifest.order ?? Infinity;
        if (oa !== ob) return oa - ob;
      }
      return a.manifest.id.localeCompare(b.manifest.id);
    });
}

const CORE_BUILTINS = buildEntries('core');
const COMMON_BUILTINS = buildEntries('common');

export const BUILTIN_PLUGINS: BuiltinPluginEntry[] = [...CORE_BUILTINS, ...COMMON_BUILTINS];
