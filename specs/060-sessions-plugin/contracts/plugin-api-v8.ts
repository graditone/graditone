/**
 * Graditone Plugin API — v8 Contract (Feature 060: Sessions Plugin)
 *
 * Changes from v7:
 * 1. Adds `PracticeSavedEvent` type — emitted when any plugin saves a practice
 * 2. Adds `onPracticeSaved` subscription to `PluginContext` — allows plugins to
 *    react to practice-save events without direct coupling to the practice plugin
 * 3. Adds `protectedPracticeIds` prop to `PluginScoreSelectorProps` — prevents
 *    deletion of saved practices that are linked to session activities
 *
 * All v7 types remain unchanged. This file documents ONLY the v8 additions.
 * See specs/035-metronome/contracts/plugin-api-v5.ts for the v5 canonical contract.
 * See frontend/src/plugin-api/types.ts for the full current API.
 */

// ---------------------------------------------------------------------------
// v8 Addition: Practice Saved Event
// ---------------------------------------------------------------------------

/**
 * Event emitted when a practice is saved through the practice plugin.
 * Contains snapshotted metadata — enough for the sessions plugin to create
 * an activity without loading the full practice from IndexedDB.
 *
 * This is a read-only notification; the practice has already been persisted
 * by the time subscribers receive this event.
 */
export interface PracticeSavedEvent {
  /** UUID of the saved practice (matches SavedPractice.id in IndexedDB) */
  readonly savedPracticeId: string;
  /** Score title at the time of saving */
  readonly scoreTitle: string;
  /** Whether the practice was completed or stopped partway */
  readonly completionStatus: 'complete' | 'partial';
  /** ISO 8601 timestamp of when the practice was saved */
  readonly savedAt: string;
}

// ---------------------------------------------------------------------------
// v8 Addition: PluginContext extension
// ---------------------------------------------------------------------------

/**
 * New method added to PluginContext in v8.
 *
 * Follows the established subscribe pattern (same as midi.subscribe,
 * scorePlayer.subscribe, metronome.subscribe): returns an unsubscribe
 * function.
 *
 * Usage in a plugin's init():
 * ```ts
 * init(context: PluginContext) {
 *   this.unsubscribe = context.onPracticeSaved((event) => {
 *     // React to practice being saved
 *   });
 * }
 *
 * dispose() {
 *   this.unsubscribe?.();
 * }
 * ```
 */
export interface PluginContextV8Additions {
  /**
   * Subscribe to practice-saved events.
   * Called after a practice has been successfully persisted to storage.
   * Returns an unsubscribe function — call it in dispose() or cleanup.
   *
   * If no handler is registered, the event is silently dropped.
   * Multiple handlers are supported (each subscriber receives the event).
   */
  onPracticeSaved(handler: (event: PracticeSavedEvent) => void): () => void;
}

// ---------------------------------------------------------------------------
// v8 Addition: ScoreSelector deletion guard
// ---------------------------------------------------------------------------

/**
 * New optional prop added to PluginScoreSelectorProps in v8.
 *
 * When provided, practices whose IDs are in this set will have their
 * delete button disabled/hidden in the SavedPracticeList component.
 */
export interface PluginScoreSelectorPropsV8Additions {
  /**
   * Set of saved practice IDs that are protected from deletion.
   * Practices in this set have their delete button disabled.
   * Computed from all session activities' savedPracticeId references.
   *
   * When undefined or empty, all practices are deletable (v7 behavior).
   */
  readonly protectedPracticeIds?: ReadonlySet<string>;
}

// ---------------------------------------------------------------------------
// v8 Version constant
// ---------------------------------------------------------------------------

export const PLUGIN_API_VERSION = '8' as const;

// ---------------------------------------------------------------------------
// Session Plugin Types (new types for the sessions plugin itself)
// ---------------------------------------------------------------------------

/**
 * Represents a practice session — a named, time-bounded block of practice
 * containing ordered activities.
 */
export interface Session {
  /** UUID v4 primary key */
  readonly id: string;
  /** User-editable session name; default format: "Session YYYY-MM-DD HH:mm" */
  name: string;
  /** ISO 8601 creation timestamp */
  readonly createdAt: string;
  /** Lifecycle state: at most one session can be 'active' at any time */
  status: 'active' | 'closed';
  /** Ordered list of activities, chronological */
  activities: SessionActivity[];
}

/**
 * A single practice event within a session.
 * Display metadata is snapshotted at creation time for resilience.
 */
export interface SessionActivity {
  /** UUID v4, unique within session */
  readonly id: string;
  /** Activity type discriminator (only 'score-practice' in v1) */
  readonly type: 'score-practice';
  /** ISO 8601 timestamp of when the activity was created */
  readonly createdAt: string;
  /** Reference to SavedPractice.id for loading the full practice */
  readonly savedPracticeId: string;
  /** Snapshotted score title (survives even if practice is deleted) */
  readonly scoreTitle: string;
  /** Snapshotted completion status */
  readonly completionStatus: 'complete' | 'partial';
}

/**
 * Lightweight index entry for fast session list rendering.
 * Stored in localStorage alongside full Session data in IndexedDB.
 */
export interface SessionIndexEntry {
  /** Same UUID as Session.id */
  readonly id: string;
  /** Session name (kept in sync with Session.name) */
  name: string;
  /** ISO 8601 creation timestamp */
  readonly createdAt: string;
  /** Current lifecycle state */
  status: 'active' | 'closed';
  /** Number of activities in this session */
  activityCount: number;
}

// ---------------------------------------------------------------------------
// Session Storage Constants
// ---------------------------------------------------------------------------

/** Maximum number of sessions stored. Oldest closed sessions evicted first. */
export const MAX_SESSIONS = 50;

/** localStorage key for the sessions index */
export const SESSIONS_INDEX_KEY = 'graditone-sessions-index';

/** IndexedDB object store name for full session data */
export const SESSIONS_STORE = 'sessions';
