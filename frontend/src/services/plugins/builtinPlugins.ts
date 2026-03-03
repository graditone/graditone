/**
 * Built-in plugin registry — T016
 * Feature 030: Plugin Architecture
 *
 * Built-in plugins are bundled at build time and registered in-memory on app
 * startup. They are NOT written to IndexedDB (see research.md R-006).
 *
 * The Virtual Keyboard plugin manifests here as the first built-in.
 */

import type { PluginManifest, MusicorePlugin } from '../../plugin-api/index';
import virtualKeyboardPlugin from '../../../plugins/virtual-keyboard/index';
import virtualKeyboardManifestJson from '../../../plugins/virtual-keyboard/plugin.json';
import trainViewPlugin from '../../../plugins/train-view/index';
import trainViewManifestJson from '../../../plugins/train-view/plugin.json';
import playScorePlugin from '../../../plugins/play-score/index';
import playScoreManifestJson from '../../../plugins/play-score/plugin.json';

export interface BuiltinPluginEntry {
  manifest: PluginManifest;
  plugin: MusicorePlugin;
}

/**
 * All built-in plugins bundled with the repository.
 * origin is set to 'builtin' here — it is NOT present in plugin.json.
 */
export const BUILTIN_PLUGINS: BuiltinPluginEntry[] = [
  {
    manifest: {
      ...(virtualKeyboardManifestJson as Omit<PluginManifest, 'origin'>),
      origin: 'builtin' as const,
    },
    plugin: virtualKeyboardPlugin,
  },
  {
    manifest: {
      ...(trainViewManifestJson as Omit<PluginManifest, 'origin'>),
      origin: 'builtin' as const,
    },
    plugin: trainViewPlugin,
  },
  // T012 / Feature 033: Play Score core plugin (Plugin API v3)
  {
    manifest: {
      ...(playScoreManifestJson as Omit<PluginManifest, 'origin'>),
      origin: 'builtin' as const,
    },
    plugin: playScorePlugin,
  },
];
