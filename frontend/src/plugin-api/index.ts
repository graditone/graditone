/**
 * Graditone Plugin API — public barrel (v5)
 * Feature 030: Plugin Architecture (v1 baseline)
 * Feature 031: Practice View Plugin — adds PluginPitchEvent, PluginRecordingContext (v2)
 * Feature 033: Play Score Plugin — adds scorePlayer namespace + ScoreRenderer (v3)
 * Feature 034: Practice from Score — adds PluginScorePitches, PluginScoreSelectorProps,
 *   extractPracticeNotes(), ScoreSelector component (v4)
 * Feature 035: Metronome — adds MetronomeState, PluginMetronomeContext,
 *   context.metronome namespace, ScorePlayerState.timeSignature (v5) * Feature 037 (amendment): adds ChordDetector, ChordDetectorOptions, ChordResult —
 *   reusable simultaneous chord detection utility; no version bump (additive only). *
 * THIS IS THE ONLY MODULE plugin code is permitted to import from the host.
 * ESLint enforces this boundary via `no-restricted-imports` scoped to plugins/**.
 *
 * Re-exports the complete public API surface from types.ts.
 * Nothing from src/ other than this barrel may be imported by plugins.
 */

export type {
  PluginNoteEvent,
  PluginManifest,
  PluginContext,
  PluginStaffViewerProps,
  GraditonePlugin,
  PluginPitchEvent,
  PluginRecordingContext,
  // v3 additions (Feature 033)
  PluginPreloadedScore,
  ScoreLoadSource,
  PluginPlaybackStatus,
  ScorePlayerState,
  PluginScorePlayerContext,
  PluginScoreRendererProps,
  // v4 additions (Feature 034)
  PluginScorePitches,
  PluginScoreSelectorProps,
  // v5 additions (Feature 035)
  MetronomeState,
  PluginMetronomeContext,
  MetronomeSubdivision,
  // v7 additions (Feature 048)
  ListDialogItem,
  OpenListDialogOptions,
} from './types';

export { PLUGIN_API_VERSION } from './types';

// Utility classes exposed to plugins (no API version bump — additive)
export { ChordDetector } from '../utils/chordDetector';
export type { ChordDetectorOptions, ChordResult } from '../utils/chordDetector';
