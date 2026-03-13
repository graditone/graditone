/**
 * Guide Plugin — Entry Point
 * Feature 001-docs-plugin: Graditone Documentation Plugin
 *
 * Default export must satisfy the GraditonePlugin interface.
 * Only imports from ../../src/plugin-api/index are permitted — no Graditone internals.
 *
 * Context is stored module-level and injected into the component via init().
 * The Guide plugin is purely static — context is stored for future extensibility
 * but no context features are consumed.
 */

/* eslint-disable react-refresh/only-export-components */

import type { GraditonePlugin, PluginContext } from '../../src/plugin-api/index';
import { GuidePlugin } from './GuidePlugin';

let _context: PluginContext | null = null;

/**
 * Wrapper that provides the stored PluginContext to GuidePlugin.
 * Returns a fallback if Component is called before init() (defensive guard).
 */
function GuidePluginWithContext() {
  if (!_context) {
    return <div className="guide-plugin">Guide: context not initialised</div>;
  }
  return <GuidePlugin />;
}

const guidePlugin: GraditonePlugin = {
  init(context: PluginContext) {
    _context = context;
  },
  dispose() {
    _context = null;
  },
  Component: GuidePluginWithContext,
};

export default guidePlugin;
