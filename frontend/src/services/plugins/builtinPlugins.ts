/**
 * Built-in plugin registry — T016
 * Feature 030: Plugin Architecture
 *
 * Built-in plugins are bundled at build time and registered in-memory on app
 * startup. They are NOT written to IndexedDB (see research.md R-006).
 *
 * Plugins are discovered automatically via Vite's import.meta.glob — only
 * directories under frontend/plugins/ that have both an index file and a
 * plugin.json with `"type": "core"` are included. Display order is driven
 * by the `order` field in each plugin.json (lower = earlier; plugins without
 * an order appear last, sorted alphabetically by id).
 *
 * To add a new core plugin: create the directory, add index + plugin.json
 * with `"type": "core"` and the desired `"order"` — no manual registration
 * needed here.
 */

import type { PluginManifest, MusicorePlugin } from '../../plugin-api/index';
import virtualKeyboardPlugin from '../../../plugins/virtual-keyboard/index';
import virtualKeyboardManifestJson from '../../../plugins/virtual-keyboard/plugin.json';

// Both globs are resolved eagerly at build time by Vite (no runtime overhead).
const indexModules = import.meta.glob('../../../plugins/*/index.{ts,tsx}', {
  eager: true,
  import: 'default',
}) as Record<string, MusicorePlugin>;

const manifestModules = import.meta.glob('../../../plugins/*/plugin.json', {
  eager: true,
}) as Record<string, Omit<PluginManifest, 'origin'>>;

export interface BuiltinPluginEntry {
  manifest: PluginManifest;
  plugin: MusicorePlugin;
}

const CORE_BUILTINS: BuiltinPluginEntry[] = Object.entries(indexModules)
  .flatMap(([indexPath, plugin]) => {
    const manifestPath = indexPath.replace(/index\.(ts|tsx)$/, 'plugin.json');
    const manifestJson = manifestModules[manifestPath];
    // Only include plugins whose manifest declares type: 'core'
    if (!manifestJson || manifestJson.type !== 'core') return [];
    return [{
      plugin,
      manifest: { ...manifestJson, origin: 'builtin' as const },
    }];
  })
  .sort((a, b) => {
    const oa = a.manifest.order ?? Infinity;
    const ob = b.manifest.order ?? Infinity;
    if (oa !== ob) return oa - ob;
    return a.manifest.id.localeCompare(b.manifest.id);
  });

// Common-type builtin plugins are not auto-discovered (no order field convention
// for common plugins). They are appended after the core plugins.
const COMMON_BUILTINS: BuiltinPluginEntry[] = [
  {
    plugin: virtualKeyboardPlugin,
    manifest: {
      ...(virtualKeyboardManifestJson as Omit<PluginManifest, 'origin'>),
      origin: 'builtin' as const,
    },
  },
];

export const BUILTIN_PLUGINS: BuiltinPluginEntry[] = [...CORE_BUILTINS, ...COMMON_BUILTINS];
