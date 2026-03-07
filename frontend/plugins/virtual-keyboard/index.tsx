/**
 * Virtual Keyboard plugin — entry point (T015)
 * Feature 030: Plugin Architecture
 *
 * Default export must satisfy the GraditonePlugin interface.
 * Only imports from ../../src/plugin-api are permitted (enforced by ESLint).
 *
 * This plugin is registered as a built-in in builtinPlugins.ts (T016).
 *
 * Note: react-refresh/only-export-components is silenced here because plugin
 * entry points export a GraditonePlugin object (not a React component) by design.
 * HMR for plugins is not required — see R-006 in research.md.
 */
/* eslint-disable react-refresh/only-export-components */

import type { GraditonePlugin, PluginContext } from '../../src/plugin-api/index';
import { VirtualKeyboard } from './VirtualKeyboard';

let _context: PluginContext | null = null;

/**
 * Wrapper component that provides the stored PluginContext to VirtualKeyboard.
 * Context is injected via init() before the component is first rendered.
 */
function VirtualKeyboardWithContext() {
  if (!_context) {
    // Should never happen in practice — init() is called before Component renders.
    return <div>Virtual Keyboard: context not initialised</div>;
  }
  return <VirtualKeyboard context={_context} />;
}

const virtualKeyboardPlugin: GraditonePlugin = {
  init(context: PluginContext) {
    _context = context;
    console.log('[VirtualKeyboard] init', context.manifest.version);
  },

  dispose() {
    _context = null;
  },

  Component: VirtualKeyboardWithContext,
};

export default virtualKeyboardPlugin;
