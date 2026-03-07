/**
 * Play Score Plugin — Entry Point
 * Feature 033: Play Score Plugin
 *
 * Implements the Plugin API v3 GraditonePlugin contract.
 * Context is stored at module level and passed to the React component.
 */

/* eslint-disable react-refresh/only-export-components */

import type { GraditonePlugin, PluginContext } from '../../src/plugin-api/index';
import { PlayScorePlugin } from './PlayScorePlugin';

let _context: PluginContext | null = null;

function PlayScorePluginWithContext() {
  if (!_context) {
    return <div className="play-score-plugin">Play Score: context not initialised</div>;
  }
  return <PlayScorePlugin context={_context} />;
}

const playScorePlugin: GraditonePlugin = {
  init(context: PluginContext) {
    _context = context;
  },
  dispose() {
    _context = null;
  },
  Component: PlayScorePluginWithContext,
};

export default playScorePlugin;
