/**
 * Contract: PluginManifest — Feature 036 addition
 *
 * Adds the optional `order` field to the existing PluginManifest interface.
 * This contract shows the FULL updated shape of PluginManifest after feature 036.
 *
 * Source of truth: frontend/src/plugin-api/types.ts
 *
 * Target app navigation order (ascending order value):
 *   1 — Play Score  (order: 1, id: "play-score")
 *   2 — Train       (order: 2, id: "train-view")
 *   ∞ — Virtual Keyboard  (order: absent → treated as Infinity)
 *   ∞ — Any imported plugin without an order field
 */
export interface PluginManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly pluginApiVersion: string;
  readonly entryPoint: string;
  readonly description?: string;
  /**
   * Plugin role:
   * - `'core'`   — first-class feature; shown as a launch button on the Landing
   *                Screen so users discover it without loading a score first.
   * - `'common'` — utility/tool; accessible via the plugin nav bar but not
   *                featured on the Landing Screen.
   * Defaults to `'common'` when omitted.
   */
  readonly type?: 'core' | 'common';
  /**
   * Display mode:
   * - `'full-screen'` — replaces the entire app viewport (no header, no nav bar).
   *                     The plugin must provide its own back/close button.
   * - `'window'`      — renders in a windowed overlay with the host's back-bar.
   * Defaults to `'window'` when omitted.
   */
  readonly view?: 'full-screen' | 'window';
  /**
   * Optional emoji or single character used as the plugin's icon.
   * Displayed on the Landing Screen launch button and any other plugin entry points.
   * Example: '𝄞' (treble clef), '🎹' (keyboard).
   */
  readonly icon?: string;
  /**
   * NEW — Feature 036
   *
   * Controls the position of this plugin in the app navigation.
   * Lower values appear before higher values.
   *
   * Plugins that omit this field are placed after all plugins that declare it,
   * then sorted alphabetically by `id` as a stable tiebreaker.
   *
   * If the value is present but not a finite number (e.g., NaN, Infinity, or a
   * non-numeric JSON value), it is treated as absent and a console.warn is emitted.
   *
   * Target app navigation order:
   *   order: 1  →  Play Score   (id: "play-score")
   *   order: 2  →  Train        (id: "train-view")
   *   order: 3  →  Practice     (future plugin — not yet built)
   *   order: 4  →  Performance  (future plugin — not yet built)
   *
   * Example plugin.json:
   *   { "order": 2 }
   */
  readonly order?: number;
  /**
   * Set by the host at runtime — NOT present in plugin.json.
   * - `'builtin'` — bundled with the repo, loaded from memory.
   * - `'imported'` — installed by the user from a ZIP package, loaded from IndexedDB.
   */
  readonly origin?: 'builtin' | 'imported';
}

// ---------------------------------------------------------------------------
// Sort utility contract
// ---------------------------------------------------------------------------

/**
 * Returns a new array of BuiltinPluginEntry sorted by ascending order, then id.
 * Entries without a valid `order` value trail all ordered entries.
 * Input array is not mutated.
 */
export type PluginEntry = { manifest: PluginManifest };
export declare function sortPluginsByOrder<T extends PluginEntry>(entries: T[]): T[];

// ---------------------------------------------------------------------------
// Example manifests illustrating the order field
// ---------------------------------------------------------------------------

/** play-score plugin.json after feature 036 */
export const playScoreManifestExample = {
  id: 'play-score',
  name: 'Play Score',
  version: '1.0.0',
  pluginApiVersion: '3',
  entryPoint: 'index.tsx',
  description: 'Load and play scores from the library or a file.',
  type: 'core' as const,
  view: 'full-screen' as const,
  icon: '🎼',
  order: 1,
};

/** train-view plugin.json after feature 036 */
export const trainManifestExample = {
  id: 'train-view',
  name: 'Train',
  version: '1.0.0',
  pluginApiVersion: '4',
  entryPoint: 'index.tsx',
  description: 'Piano training exercise — play along and see your score.',
  type: 'core' as const,
  view: 'full-screen' as const,
  icon: '🎹',
  order: 2,
};
