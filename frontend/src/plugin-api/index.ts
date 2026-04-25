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
  // v8 additions (Feature 060)
  PracticeSavedEvent,
} from './types';

export { PLUGIN_API_VERSION } from './types';

// Utility classes exposed to plugins (no API version bump — additive)
export { ChordDetector } from '../utils/chordDetector';
export type { ChordDetectorOptions, ChordResult } from '../utils/chordDetector';

// Feature 080: Profile icon for plugin toolbars
export { ProfileIcon } from '../components/ProfileIcon';
export { scopedGetItem, scopedSetItem, scopedRemoveItem, getActiveProfileId } from '../services/profiles/profileStorage';

// Feature 056: Saved practice types and storage services
export type { ScoreRef, SavedPractice, SavedPerformanceData, SavedPracticeIndexEntry } from '../services/savedPractice.types';
export { savePracticeToIndexedDB, generatePracticeName, loadPracticeFromIndexedDB, deletePracticeFromIndexedDB } from '../services/savedPracticeStorage';
export { addSavedPracticeIndex, listSavedPractices, removeSavedPracticeIndex } from '../services/savedPracticeIndex';

// Feature 060: Practice-saved event bus (allows plugins to emit/subscribe to practice-save events)
export { broadcastPracticeSaved } from './practiceSavedBus';

// Feature 060: Sessions plugin needs openDB for session store access
export { openDB } from '../services/storage/local-storage';

// Feature 060: Shared practice score computation
export { computePracticeScore } from './computePracticeScore';
export type { PracticeScoreBreakdown, ScorableNoteResult } from './computePracticeScore';

// Feature 083: Tempo calculation utilities (re-exported so plugins can import from plugin-api)
export { computeEffectiveMinMultiplier, MIN_TEMPO_MULTIPLIER, MAX_TEMPO_MULTIPLIER, ABSOLUTE_BPM_FLOOR } from '../utils/tempoCalculations';
