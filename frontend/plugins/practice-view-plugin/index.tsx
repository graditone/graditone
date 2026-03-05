/**
 * Practice View Plugin — Entry Point
 * Feature 037: Practice View Plugin (External)
 *
 * Default export must satisfy the MusicorePlugin interface.
 * Only imports from ../../frontend/src/plugin-api/index are permitted — no Musicore internals.
 *
 * Context is stored module-level and injected into the component via init().
 */

/* eslint-disable react-refresh/only-export-components */

import type { MusicorePlugin, PluginContext } from '../../src/plugin-api/index';
import { PracticeViewPlugin } from './PracticeViewPlugin';

let _context: PluginContext | null = null;

/**
 * Wrapper that provides the stored PluginContext to PracticeViewPlugin.
 * Context is always set before Component is first rendered (init → Component).
 */
function PracticeViewPluginWithContext() {
  if (!_context) {
    return <div className="practice-view-plugin">Practice View: context not initialised</div>;
  }
  return <PracticeViewPlugin context={_context} />;
}

const practiceViewPlugin: MusicorePlugin = {
  init(context: PluginContext) {
    _context = context;
  },

  dispose() {
    _context = null;
  },

  Component: PracticeViewPluginWithContext,
};

export default practiceViewPlugin;
