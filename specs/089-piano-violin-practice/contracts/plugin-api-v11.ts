/**
 * Plugin API Contract — v11
 * Feature 089: Piano Practice with Violin Accompaniment Playback
 *
 * Changes from v10:
 *   + PluginInstrumentInfo  — new type: instrument part descriptor
 *   + PluginScorePlayerContext.getInstruments() — expose loaded score's instrument list
 *   + PluginScorePlayerContext.setPartVolume()  — control per-instrument audio gain
 *
 * v10 was defined in Feature 070 (getRegionDifficulty).
 * v11 adds instrument metadata access and per-part volume control.
 *
 * Implementation targets:
 *   - frontend/src/plugin-api/types.ts              (interface definitions)
 *   - frontend/src/plugin-api/scorePlayerContext.ts  (implementation)
 *
 * Stub targets (must also be updated):
 *   - createNoOpScorePlayer() in scorePlayerContext.ts
 *   - proxy delegation object in scorePlayerContext.ts
 */

// ---------------------------------------------------------------------------
// New type: PluginInstrumentInfo
// ---------------------------------------------------------------------------

/**
 * Descriptor for a single instrument part from the loaded score.
 * Returned by PluginScorePlayerContext.getInstruments().
 *
 * Feature 089: Piano Practice with Violin Accompaniment Playback
 */
export interface PluginInstrumentInfo {
  /**
   * 0-based part index.
   * Matches ToneAdapter channel keys and TaggedNote._partIndex.
   * Used as the `partIndex` argument to setPartVolume().
   */
  partIndex: number;

  /**
   * Canonical instrument type resolved from MusicXML metadata.
   * Resolved at score load via resolveInstrumentType() in InstrumentTimbres.ts.
   *
   * Examples: "piano", "violin", "cello", "viola", "flute", "guitar"
   *
   * Piano part detection: `instrumentType === "piano"`
   * Accompaniment parts: any part where `instrumentType !== "piano"`
   */
  instrumentType: string;

  /**
   * Human-readable display name from the MusicXML <part-name> element.
   * Examples: "Piano", "Violin", "Violoncello"
   */
  name: string;

  /**
   * Number of staves for this instrument.
   * Piano typically has 2 (treble + bass grand staff).
   * Most other instruments have 1.
   */
  staffCount: number;
}

// ---------------------------------------------------------------------------
// Extension to PluginScorePlayerContext
// ---------------------------------------------------------------------------

/**
 * v11 additions to PluginScorePlayerContext.
 * These methods are appended to the existing PluginScorePlayerContext interface
 * in frontend/src/plugin-api/types.ts.
 *
 * Feature 089: Piano Practice with Violin Accompaniment Playback
 */
export interface PluginScorePlayerContext_v11_additions {
  /**
   * Feature 089: Returns the instrument list from the currently-loaded score.
   *
   * Returns an empty array when no score is loaded (status !== 'ready').
   * Parts are ordered by their 0-based partIndex (matching MusicXML part order).
   *
   * Use case: detect whether the score contains piano and non-piano parts
   * to determine whether accompaniment playback should be active.
   *
   * Piano detection: `info.instrumentType === "piano"`
   * Accompaniment parts: all entries where `instrumentType !== "piano"`
   *
   * @returns Instrument descriptors, empty array if no score loaded.
   */
  getInstruments(): ReadonlyArray<PluginInstrumentInfo>;

  /**
   * Feature 089: Set the audio gain for a specific instrument part channel.
   *
   * `volume` is a linear scalar in [0.0, 1.0]:
   *   - 0.0 = fully muted (silence)
   *   - 1.0 = full channel volume (default at score load)
   *   - 0.7 = the recommended accompaniment default
   *
   * The change takes effect immediately — already-scheduled Tone.js notes
   * playing through the channel's Volume node will be affected within one
   * audio processing block (≤16ms at 60fps).
   *
   * Out-of-range `partIndex` values are silently ignored (no-op).
   * `volume` is clamped to [0.0, 1.0] by the host before application.
   *
   * Must only be called when a score is loaded (status === 'ready').
   * Has no effect if called before a score is loaded.
   *
   * @param partIndex 0-based instrument part index from PluginInstrumentInfo.partIndex
   * @param volume    Linear gain scalar, clamped to [0.0, 1.0]
   */
  setPartVolume(partIndex: number, volume: number): void;
}

// ---------------------------------------------------------------------------
// Stub / no-op implementations
// ---------------------------------------------------------------------------

/**
 * No-op implementations for createNoOpScorePlayer() stub.
 * Add these to the stub object in scorePlayerContext.ts.
 */
export const noOpV11Additions: PluginScorePlayerContext_v11_additions = {
  getInstruments: () => [],
  setPartVolume: (_partIndex: number, _volume: number) => {},
};

// ---------------------------------------------------------------------------
// Implementation sketch (for implementor reference — not normative)
// ---------------------------------------------------------------------------

/*
// In scorePlayerContext.ts, inside useScorePlayerContext():

// getInstruments — reads from the loaded score's instruments array
const getInstruments = useCallback((): ReadonlyArray<PluginInstrumentInfo> => {
  const currentScore = scoreRef.current;
  if (!currentScore) return [];
  return currentScore.instruments.map((instrument, partIndex) => ({
    partIndex,
    instrumentType: resolveInstrumentType(instrument.instrument_type, instrument.name),
    name: instrument.name,
    staffCount: instrument.staves.length,
  }));
}, []); // stable — reads from ref, no reactive dependencies

// setPartVolume — delegates to ToneAdapter channel
const setPartVolume = useCallback((partIndex: number, volume: number): void => {
  const clamped = Math.max(0, Math.min(1, volume));
  const toneAdapter = ToneAdapter.getInstance();
  toneAdapter.getChannel(partIndex)?.setVolume(clamped);
}, []); // stable — no reactive dependencies

// Add both to the api useMemo and proxy object
*/
