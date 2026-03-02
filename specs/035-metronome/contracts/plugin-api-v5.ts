/**
 * Musicore Plugin API — v5 Contract
 * Feature 035: Metronome for Play and Practice Views
 *
 * This file defines the canonical v5 additions to the Plugin API.
 * Changes from v4:
 *   1. New `MetronomeState` type
 *   2. New `PluginMetronomeContext` interface
 *   3. New `readonly metronome: PluginMetronomeContext` field on `PluginContext`
 *   4. Extended `ScorePlayerState` with `timeSignature` field
 *   5. `PLUGIN_API_VERSION` bumped from '4' to '5'
 *
 * v5 is backward compatible:
 *   - All v1–v4 plugins receive `context.metronome` as a no-op stub.
 *   - Existing v3/v4 plugins that subscribe to `ScorePlayerState` receive
 *     the new `timeSignature` field but can safely ignore it.
 *   - No new `pluginApiVersion` gate required; existing `>= 3` gate in App.tsx
 *     already activates V3PluginWrapper for all v3+ plugins.
 */

// ---------------------------------------------------------------------------
// v5 additions — Metronome namespace
// ---------------------------------------------------------------------------

/**
 * Immutable snapshot of metronome state pushed to plugin subscribers.
 * Delivered whenever `active`, `beatIndex`, or `bpm` changes.
 */
export interface MetronomeState {
  /** Whether the metronome is currently ticking. */
  readonly active: boolean;
  /**
   * 0-based index of the most recently fired beat within the measure.
   * 0 = the downbeat (first beat of the bar).
   * -1 when the metronome is inactive or no beat has fired since activation.
   */
  readonly beatIndex: number;
  /**
   * `true` when beatIndex === 0 (downbeat). Convenience flag for rendering
   * a distinct visual style on beat 1 without arithmetic in plugin code.
   */
  readonly isDownbeat: boolean;
  /**
   * Current effective BPM (0 when inactive; clamped to 20–300 when active).
   * Derived from the loaded score's tempo at the current playback position —
   * not the raw score BPM directly, so it reflects tempo multiplier changes.
   */
  readonly bpm: number;
}

/**
 * Metronome control context injected into plugins via `context.metronome`.
 *
 * Usage example (play-score plugin):
 * ```tsx
 * const [metroState, setMetroState] = useState<MetronomeState | null>(null);
 *
 * useEffect(() => {
 *   return context.metronome.subscribe(setMetroState);
 * }, [context]);
 *
 * // In toolbar:
 * <button
 *   onClick={() => context.metronome.toggle()}
 *   aria-label={metroState?.active ? 'Stop metronome' : 'Start metronome'}
 *   className={metroState?.isDownbeat ? 'metro-pulse' : ''}
 * >
 *   ♩
 * </button>
 * ```
 */
export interface PluginMetronomeContext {
  /**
   * Toggle the metronome on or off.
   *
   * - If currently inactive: initializes audio (calls ToneAdapter.init()),
   *   reads BPM and time signature from the currently loaded score (or from
   *   the practice view's configured BPM), and starts Transport-scheduled
   *   clicks. Beat counter resets to beat 1. Resolves when audio is unlocked
   *   and the first beat is scheduled.
   *
   * - If currently active: stops all scheduled clicks immediately, silences
   *   sustaining synths, and resets beatIndex to -1.
   *
   * - If browser autoplay policy blocks audio: the host shows a brief inline
   *   message and retries on the next user pointer event. The returned promise
   *   resolves after the retry succeeds or rejcts with 'NotAllowedError'.
   *
   * @returns Promise that resolves when the state change is complete.
   *          Never throws — errors are surfaced in MetronomeState (future extension).
   */
  toggle(): Promise<void>;

  /**
   * Subscribe to MetronomeState snapshots.
   * The handler is called synchronously once with the current state, then
   * on each change (active/beatIndex/bpm changes).
   * Returns an unsubscribe function — call it in your cleanup:
   *
   * ```tsx
   * useEffect(() => context.metronome.subscribe(setMetroState), [context]);
   * ```
   */
  subscribe(handler: (state: MetronomeState) => void): () => void;
}

// ---------------------------------------------------------------------------
// v5 extension to ScorePlayerState
// ---------------------------------------------------------------------------

/**
 * ScorePlayerState — v5 extension only (delta from v4).
 *
 * Add this field to the existing ScorePlayerState interface:
 *
 * ```typescript
 * /** Time signature at tick 0; defaults to { numerator: 4, denominator: 4 }.
 *  * The metronome uses this to determine the number of beats per measure and
 *  * to distinguish downbeat from upbeats. *\/
 * readonly timeSignature: { readonly numerator: number; readonly denominator: number };
 * ```
 *
 * Populated at `loadScore()` completion from `score.global_structural_events`.
 * Default (no score loaded or no TimeSignature event found): `{ numerator: 4, denominator: 4 }`.
 */
export type ScorePlayerStateV5Extension = {
  readonly timeSignature: { readonly numerator: number; readonly denominator: number };
};

// ---------------------------------------------------------------------------
// PluginContext — v5 extension only (delta from v4)
// ---------------------------------------------------------------------------

/**
 * v5 addition to PluginContext.
 * The full interface in types.ts gets one new field:
 *
 * ```typescript
 * readonly metronome: PluginMetronomeContext;
 * ```
 */
export type PluginContextV5Extension = {
  readonly metronome: PluginMetronomeContext;
};

// ---------------------------------------------------------------------------
// Version constant
// ---------------------------------------------------------------------------

/** Plugin API version for v5 (metronome namespace). */
export const PLUGIN_API_VERSION_V5 = '5' as const;

// ---------------------------------------------------------------------------
// No-op stub shape (for createNoOpMetronome implementation reference)
// ---------------------------------------------------------------------------

/**
 * Shape of the no-op stub returned by `createNoOpMetronome()`.
 * Injected into all v1–v4 plugins so `context.metronome` is safe to access
 * without null checks, but is silent when called.
 *
 * Implementation in metronomeContext.ts:
 * ```typescript
 * export function createNoOpMetronome(): PluginMetronomeContext {
 *   const INACTIVE: MetronomeState = { active: false, beatIndex: -1, isDownbeat: false, bpm: 0 };
 *   const handlers = new Set<(s: MetronomeState) => void>();
 *   return {
 *     toggle: () => Promise.resolve(),
 *     subscribe: (handler) => {
 *       handler(INACTIVE);
 *       handlers.add(handler);
 *       return () => handlers.delete(handler);
 *     },
 *   };
 * }
 * ```
 */
export type NoOpMetronomeShape = PluginMetronomeContext;
