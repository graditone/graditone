/**
 * Train plugin — entry point
 * Feature 036: Rename Practice Plugin to Train (was Practice View plugin, Feature 031)
 *
 * Default export satisfies the GraditonePlugin interface.
 * Only imports from ../../src/plugin-api are permitted (enforced by ESLint).
 *
 * This plugin is registered as a built-in in builtinPlugins.ts.
 *
 * Note: react-refresh/only-export-components is silenced here because plugin
 * entry points export a GraditonePlugin object (not a React component) by design.
 * HMR for plugins is not required.
 */
/* eslint-disable react-refresh/only-export-components */

import type { GraditonePlugin, PluginContext } from '../../src/plugin-api/index';
import { TrainPlugin } from './TrainPlugin';
import { migrateStorageKeys } from './migrateStorageKeys';

let _context: PluginContext | null = null;

/**
 * Wrapper component that provides the stored PluginContext to TrainPlugin.
 * Context is injected via init() before the component is first rendered.
 */
function TrainPluginWithContext() {
  if (!_context) {
    // Should never happen in practice — init() is called before Component renders.
    return <div className="train-plugin">Train: context not initialised</div>;
  }
  return <TrainPlugin context={_context} />;
}

const trainViewPlugin: GraditonePlugin = {
  init(context: PluginContext) {
    migrateStorageKeys();
    _context = context;
    console.log('[TrainView] init', context.manifest.version);
  },

  dispose() {
    _context = null;
  },

  Component: TrainPluginWithContext,
};

export default trainViewPlugin;
