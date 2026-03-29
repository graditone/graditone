import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { ToneAdapter } from './ToneAdapter';
import { PlaybackScheduler, secondsToTicks, ticksToSeconds } from './PlaybackScheduler';
import { useTempoState } from '../state/TempoStateContext';
import type { Note } from '../../types/score';
import type { PlaybackStatus, ITickSource } from '../../types/playback';

/**
 * PlaybackState interface for usePlayback hook return value
 */
export interface PlaybackState {
  status: PlaybackStatus;
  currentTick: number;
  totalDurationTicks: number; // Feature 022: Total score duration in ticks for timer display
  error: string | null; // US3 T052: Error message for autoplay policy failures
  /** Feature 024: ITickSource snapshot for React consumers */
  tickSource: ITickSource;
  /** Feature 024: Live ref for rAF consumers (bypasses shouldComponentUpdate freezing) */
  tickSourceRef: { current: ITickSource };
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  seekToTick: (tick: number) => void; // Feature 009: Seek to specific tick position
  unpinStartTick: () => void; // Feature 009: Clear pinned start position
  /**
   * Set the pinned start tick — the position Play always restarts from when a
   * green marker is active.  ONLY called from the long-press pin gesture;
   * seekToTick() intentionally does NOT touch this so that seek-and-play and
   * pause/resume never clobber the user's pinned position.
   */
  setPinnedStart: (tick: number | null) => void;
  /**
   * Set (or clear) the loop end tick for loop-region playback.
   * When set, the rAF tick loop jumps back to pinnedStartTickRef when
   * currentTick reaches or exceeds this value.
   * Pass null to disable looping.
   */
  setLoopEnd: (tick: number | null) => void;
  /**
   * Hard-reset all playback state to the beginning.
   * Stops audio, clears all pins and loop markers, resets currentTick to 0,
   * and transitions to 'stopped'. Safe to call from any state.
   * Used when loading a new score so the previous position is not inherited.
   */
  resetPlayback: () => void;
}

/**
 * MusicTimeline - React hook for managing playback state
 * 
 * Feature 003 - Music Playback: User Story 1
 * Feature 008 - Tempo Change: T015 Added tempo multiplier support
 * 
 * Manages playback lifecycle: stopped → playing → paused → stopped
 * Coordinates with ToneAdapter for audio initialization and control.
 * 
 * @param notes - Array of notes to play
 * @param tempo - Tempo in BPM (beats per minute)
 * @returns PlaybackState with status, currentTick, and control functions
 * 
 * @example
 * ```typescript
 * const { status, currentTick, play, pause, stop } = usePlayback(notes, 120);
 * 
 * <button onClick={play} disabled={status === 'playing'}>Play</button>
 * <button onClick={pause} disabled={status !== 'playing'}>Pause</button>
 * <button onClick={stop} disabled={status === 'stopped'}>Stop</button>
 * ```
 */
export function usePlayback(notes: Note[], tempo: number): PlaybackState {
  const [status, setStatus] = useState<PlaybackStatus>('stopped');
  const [currentTick, setCurrentTick] = useState<number>(0);
  const [error, setError] = useState<string | null>(null); // US3 T052: Track autoplay errors
  
  // Feature 008 - Tempo Change: T015 Get tempo multiplier from context
  const { tempoState } = useTempoState();
  
  // Refs to track timing information
  const startTimeRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const playbackStartTickRef = useRef<number>(0); // Feature 009: Track tick position when playback started
  const playbackEndTimeoutRef = useRef<number | null>(null); // Timer for auto-stop when playback ends
  const pinnedStartTickRef = useRef<number | null>(null); // Feature 009: Pinned start position from selected note
  const loopEndTickRef = useRef<number | null>(null); // Loop end tick — rAF loop jumps back when reached
  const rafIdRef = useRef<number>(0); // Feature 024: rAF handle for tick broadcast
  const lastReactTickRef = useRef<number>(0); // Feature 024: Last tick value pushed to React state

  // Feature 024 (T018): Mutable tick source for rAF-driven consumers
  // This avoids React re-renders for every tick update.
  const tickSourceRef = useRef<ITickSource>({
    currentTick: 0,
    status: 'stopped' as PlaybackStatus,
  });

  // Keep tick source status in sync (must happen during render for immediate sync)
  // eslint-disable-next-line react-hooks/refs
  tickSourceRef.current = { ...tickSourceRef.current, status };
  
  // Feature 022: Calculate total duration from all notes
  const totalDurationTicks = useMemo(() => {
    if (notes.length === 0) return 0;
    return Math.max(...notes.map(n => n.start_tick + n.duration_ticks));
  }, [notes]);

  // Get ToneAdapter singleton
  const adapter = ToneAdapter.getInstance();

  // US2 T037: Create PlaybackScheduler instance (memoized to persist across renders)
  const scheduler = useMemo(() => new PlaybackScheduler(adapter), [adapter]);

  // Feature 009 & 024 - Playback Scroll and Highlight: T006, T018
  // Feature 024 (T018): Use rAF + ref instead of setInterval + setState.
  // Update tickSourceRef every rAF frame; only push to React state when
  // the tick has changed significantly (avoids 60Hz React re-renders).
  useEffect(() => {
    if (status !== 'playing') {
      return undefined;
    }

    const REACT_UPDATE_INTERVAL = 100; // ms — only update React state every ~100ms

    const tick = (): void => {
      // Guard: if status was externally reset (e.g. natural-end handler ran before
      // this rAF frame), stop immediately — do NOT overwrite currentTick with a
      // stale large value.  This prevents the race where rAF fires one extra frame
      // after the natural-end handler sets tickSourceRef.status = 'stopped' and
      // setCurrentTick(0), which would overwrite 0 with the end-of-score tick and
      // make the next play() find no schedulable notes.
      if (tickSourceRef.current.status !== 'playing') return;

      const currentTime = adapter.getCurrentTime();
      const elapsedTime = currentTime - startTimeRef.current;
      
      // Convert elapsed time to ticks, accounting for tempo multiplier
      const elapsedTicks = secondsToTicks(elapsedTime, tempo) * tempoState.tempoMultiplier;
      
      // Calculate absolute position: starting tick + elapsed ticks
      const newCurrentTick = playbackStartTickRef.current + elapsedTicks;
      
      // Loop enforcement: jump back to loop start when loop end is reached
      if (loopEndTickRef.current !== null && newCurrentTick >= loopEndTickRef.current) {
        const loopStartTick = pinnedStartTickRef.current ?? 0;
        // clearSchedule() stops the Transport; restart it before rescheduling
        // so the newly-queued notes actually play (Transport.schedule() only
        // fires while the Transport is running).
        scheduler.clearSchedule();
        adapter.startTransport(); // stops residual state, starts fresh from pos 0
        // Reset timing refs AFTER startTransport so getCurrentTime() captures
        // the new Transport start moment.
        playbackStartTickRef.current = loopStartTick;
        startTimeRef.current = adapter.getCurrentTime();
        // Filter notes by loop end so the lookahead scheduler doesn't queue
        // notes beyond the boundary (same as in play()).
        const loopNotes = loopEndTickRef.current != null
          ? notes.filter(n => n.start_tick < loopEndTickRef.current!)
          : notes;
        scheduler.scheduleNotes(loopNotes, tempo, loopStartTick, tempoState.tempoMultiplier).catch(() => {});
        lastReactTickRef.current = loopStartTick;
        tickSourceRef.current = { currentTick: loopStartTick, status: 'playing' };
        setCurrentTick(loopStartTick);
        rafIdRef.current = requestAnimationFrame(tick);
        return;
      }

      // Feature 024: Always update the mutable tick source (no React re-render)
      tickSourceRef.current = { currentTick: newCurrentTick, status: 'playing' };
      
      // Feature 024: Only update React state periodically for components that
      // need it (e.g., timer display, position indicator). This dramatically
      // reduces React re-renders from ~60/sec to ~10/sec.
      const tickDelta = Math.abs(newCurrentTick - lastReactTickRef.current);
      if (tickDelta >= secondsToTicks(REACT_UPDATE_INTERVAL / 1000, tempo)) {
        lastReactTickRef.current = newCurrentTick;
        setCurrentTick(newCurrentTick);
      }
      
      rafIdRef.current = requestAnimationFrame(tick);
    };
    
    rafIdRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafIdRef.current);
  }, [status, adapter, tempo, tempoState.tempoMultiplier]);

  /**
   * US1 T021: Implement play() - Initialize audio and transition to 'playing'
   * US2 T037: Integrate PlaybackScheduler to schedule notes
   * US3 T052: Handle browser autoplay policy errors with user-friendly message
   * 
   * Initializes Tone.js audio context (if not already initialized) and
   * transitions playback status to 'playing'. Handles resume from paused state.
   * Catches autoplay policy errors and displays user-friendly message.
   */
  const play = useCallback(async () => {
    try {
      // Clear any previous errors
      setError(null);

      // Clear any existing playback end timeout
      if (playbackEndTimeoutRef.current !== null) {
        window.clearTimeout(playbackEndTimeoutRef.current);
        playbackEndTimeoutRef.current = null;
      }

      // Determine playback start tick — snapshot this BEFORE any await so concurrent
      // state changes (rAF tick updates) cannot alter it mid-flight.
      // Priority: pinned position (long-press pin) > current position > first note.
      // Use lastReactTickRef.current (sync-updated by seekToTick) rather than the
      // closed-over `currentTick` React state, which may be stale when play() is
      // called in the same event handler as seekToTick().
      let playbackStartTick: number;
      if (pinnedStartTickRef.current !== null) {
        // Use pinned position from long-press selection
        playbackStartTick = pinnedStartTickRef.current;
        setCurrentTick(playbackStartTick);
      } else if (lastReactTickRef.current === 0 && notes.length > 0) {
        // Skip leading silence — jump to first real note
        const firstNote = notes.reduce((earliest, note) =>
          note.start_tick < earliest.start_tick ? note : earliest
        );
        playbackStartTick = firstNote.start_tick;
        setCurrentTick(playbackStartTick);
      } else {
        playbackStartTick = lastReactTickRef.current;
      }

      // Feature 009: Store the tick position where playback starts for scroll calculations
      playbackStartTickRef.current = playbackStartTick;

      // Initialize audio context (required for browser autoplay policy)
      // US1 T021: Call ToneAdapter.init()
      await adapter.init();

      // Start Transport fresh for this playback
      adapter.startTransport();

      // Store start time for timeline tracking
      startTimeRef.current = adapter.getCurrentTime();

      // US1 T021: Transition status to 'playing' immediately for responsive UI
      setStatus('playing');

      // US2 T037: Schedule notes for playback
      // Feature 008 - Tempo Change: T015 Pass tempo multiplier to scheduler
      // Filter out notes at or beyond the loop end so the lookahead scheduler
      // never queues them on the Transport (they would play before the rAF
      // loop can detect the boundary and clear the schedule).
      const notesToSchedule = loopEndTickRef.current != null
        ? notes.filter(n => n.start_tick < loopEndTickRef.current!)
        : notes;
      await scheduler.scheduleNotes(notesToSchedule, tempo, playbackStartTick, tempoState.tempoMultiplier);

      // Calculate when playback will end and auto-stop.
      // Skip the end-timeout when a loop is active — the rAF loop handles looping.
      if (notes.length > 0 && loopEndTickRef.current === null) {
        // Find the last note end time
        const notesToPlay = notes.filter(note => note.start_tick >= playbackStartTick);
        if (notesToPlay.length > 0) {
          const lastNote = notesToPlay.reduce((latest, note) => {
            const noteEndTick = note.start_tick + note.duration_ticks;
            const latestEndTick = latest.start_tick + latest.duration_ticks;
            return noteEndTick > latestEndTick ? note : latest;
          });
          
          const lastNoteEndTick = lastNote.start_tick + lastNote.duration_ticks;
          const ticksFromCurrent = lastNoteEndTick - playbackStartTick;
          let playbackDurationSeconds = ticksToSeconds(ticksFromCurrent, tempo);
          
          // Feature 008 - Tempo Change: T015 Adjust timeout for tempo multiplier
          playbackDurationSeconds = playbackDurationSeconds / tempoState.tempoMultiplier;
          
          // Add a small buffer (100ms) to ensure the last note completes
          const timeoutMs = (playbackDurationSeconds + 0.1) * 1000;
          
          playbackEndTimeoutRef.current = window.setTimeout(() => {
            // Feature 026 (Fix P1): Clean up audio state on natural playback end.
            // Without this, Tone.js Transport stays active and replay overlaps.
            //
            // Cancel the rAF loop FIRST — before any state updates — so it cannot
            // fire one last frame and overwrite currentTick(0) with the end-of-score
            // tick value. That race caused the next play() to pass a too-large
            // playbackStartTick to scheduleNotes(), which filtered out every note.
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = 0;
            // Reset startTimeRef so any lingering rAF that already fired cannot
            // compute a meaningful elapsed time (elapsedTicks would be ~0).
            startTimeRef.current = 0;

            scheduler.clearSchedule();
            adapter.stopAll();
            // NOTE: do NOT clear pinnedStartTickRef here — if the user has pinned a
            // position (green marker), it must survive the natural score end so that
            // pressing Play again restarts from the pin.  Only explicit Stop() and
            // unpinStartTick() (note de-selection) should clear the pin.
            lastReactTickRef.current = 0;
            tickSourceRef.current = { currentTick: 0, status: 'stopped' };
            // Update React state
            setStatus('stopped');
            setCurrentTick(0);
            playbackEndTimeoutRef.current = null;
          }, timeoutMs);
        }
      }
    } catch (error) {
      // US3 T052: Handle browser autoplay policy errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Reset status in case setStatus('playing') was already called before the error
      setStatus('stopped');
      setCurrentTick(0);
      lastReactTickRef.current = 0;
      tickSourceRef.current = { currentTick: 0, status: 'stopped' };

      // Check if this is an autoplay policy error
      if (errorMessage.includes('autoplay') || 
          errorMessage.includes('user interaction') ||
          errorMessage.includes('gesture')) {
        setError('Audio playback requires user interaction. Please try clicking Play again.');
      } else {
        setError('Failed to initialize audio playback. Please refresh the page and try again.');
      }
      
      console.error('Failed to initialize audio:', error);
    }
  // currentTick intentionally omitted: play() now reads lastReactTickRef.current
  // (sync-updated) instead of the closed-over React state to avoid stale values.
  }, [adapter, scheduler, notes, tempo, tempoState.tempoMultiplier]);

  /**
   * US1 T022: Implement pause() - Pause playback and track currentTick
   * US2 T038: Clear scheduled notes
   * 
   * Transitions to 'paused' state and preserves currentTick for resume capability.
   * In US2, this also stops note scheduling.
   */
  const pause = useCallback(() => {
    if (status !== 'playing') {
      return; // Only pause if currently playing
    }

    // Clear playback end timeout since we're manually pausing
    if (playbackEndTimeoutRef.current !== null) {
      window.clearTimeout(playbackEndTimeoutRef.current);
      playbackEndTimeoutRef.current = null;
    }

    // Calculate exact tick position at the moment of pause
    // (same calculation as the 60 Hz interval for consistency)
    const currentTime = adapter.getCurrentTime();
    const elapsedTime = currentTime - startTimeRef.current;
    
    // Convert elapsed time to ticks, accounting for tempo multiplier
    const elapsedTicks = secondsToTicks(elapsedTime, tempo) * tempoState.tempoMultiplier;
    
    // Calculate absolute position: starting tick + elapsed ticks
    const newCurrentTick = playbackStartTickRef.current + elapsedTicks;
    
    // US2 T038: Clear all scheduled notes
    scheduler.clearSchedule();

    // Update currentTick to exact pause position for resume
    setCurrentTick(newCurrentTick);
    pausedAtRef.current = currentTime;

    // US1 T022: Transition status to 'paused'
    setStatus('paused');
  }, [status, adapter, scheduler, tempo, tempoState.tempoMultiplier]);

  /**
   * US1 T023: Implement stop() - Stop playback, reset to initial state
   * US2 T038: Clear scheduled notes
   * 
   * Stops all audio, resets currentTick to 0, and transitions to 'stopped'.
   * Feature 009: If a note is pinned (selected), reset to that position instead.
   */
  const stop = useCallback(() => {
    if (status === 'stopped') {
      return; // Already stopped
    }

    // Clear playback end timeout since we're manually stopping
    if (playbackEndTimeoutRef.current !== null) {
      window.clearTimeout(playbackEndTimeoutRef.current);
      playbackEndTimeoutRef.current = null;
    }

    // US2 T038: Clear all scheduled notes
    scheduler.clearSchedule();

    // US1 T023: Call ToneAdapter.stopAll()
    adapter.stopAll();

    // Feature 009: Reset currentTick to pinned position if set, otherwise 0
    const resetTick = pinnedStartTickRef.current !== null ? pinnedStartTickRef.current : 0;
    setCurrentTick(resetTick);
    lastReactTickRef.current = resetTick;
    tickSourceRef.current = { currentTick: resetTick, status: 'stopped' };

    // US1 T023: Transition to 'stopped'
    setStatus('stopped');

    // Reset timing refs
    startTimeRef.current = 0;
    pausedAtRef.current = 0;
  }, [status, adapter, scheduler]);

  /**
   * Feature 009: Seek to specific tick position
   * 
   * Sets the playback position to a specific tick. If currently playing,
   * stops playback and sets status to paused so user can continue from
   * the new position with play button.
   * 
   * This also "pins" the start position - pressing Stop will return to this
   * position instead of tick 0, and Play will always start from here until
   * unpinStartTick() is called.
   * 
   * @param tick - The tick position to seek to
   */
  const seekToTick = useCallback((tick: number) => {
    // Clear any scheduled notes if playing
    if (status === 'playing') {
      scheduler.clearSchedule();
      adapter.stopAll();
    }

    // Clear playback end timeout
    if (playbackEndTimeoutRef.current !== null) {
      window.clearTimeout(playbackEndTimeoutRef.current);
      playbackEndTimeoutRef.current = null;
    }

    // Update the position indicator — but do NOT touch pinnedStartTickRef.
    // The pin anchor is managed exclusively by setPinnedStart() (called only
    // from the long-press gesture) so that seek-and-play taps never overwrite
    // the user's green marker position.
    setCurrentTick(tick);
    lastReactTickRef.current = tick;
    tickSourceRef.current = { currentTick: tick, status: tickSourceRef.current.status };

    // If currently playing, transition to paused so user can resume
    if (status === 'playing') {
      setStatus('paused');
    }
  }, [status, adapter, scheduler]);

  /**
   * Set (or clear) the pinned start position for the Play button.
   * This is the ONLY function that mutates pinnedStartTickRef.
   * Called exclusively from the long-press pin gesture in the UI.
   */
  const setPinnedStart = useCallback((tick: number | null) => {
    pinnedStartTickRef.current = tick;
  }, []);

  /**
   * Set (or clear) the loop end tick.
   * When non-null, the rAF tick loop will jump back to pinnedStartTickRef on reaching this tick.
   * The tick is treated as an exclusive upper bound: notes starting at this tick are NOT played.
   */
  const setLoopEnd = useCallback((tick: number | null) => {
    loopEndTickRef.current = tick;
  }, []);

  /**
   * Feature 009: Clear pinned start position
   * 
   * Removes the pinned start position set by seekToTick(). After calling this,
   * Stop will reset to tick 0 and Play will start from the first note as normal.
   * 
   * Called when a note is deselected in the UI.
   */
  const unpinStartTick = useCallback(() => {
    pinnedStartTickRef.current = null;
    // If stopped, reset to tick 0
    if (status === 'stopped') {
      setCurrentTick(0);
    }
  }, [status]);

  /**
   * Hard-reset all playback state to the beginning.
   * Safe to call from any state (stopped, paused, playing).
   */
  const resetPlayback = useCallback(() => {
    // Stop any running audio unconditionally
    scheduler.clearSchedule();
    adapter.stopAll();

    // Cancel the end-of-score auto-stop timer
    if (playbackEndTimeoutRef.current !== null) {
      window.clearTimeout(playbackEndTimeoutRef.current);
      playbackEndTimeoutRef.current = null;
    }

    // Clear loop and pin markers
    pinnedStartTickRef.current = null;
    loopEndTickRef.current = null;

    // Reset all tick and timing state to the very beginning
    setCurrentTick(0);
    lastReactTickRef.current = 0;
    tickSourceRef.current = { currentTick: 0, status: 'stopped' };
    startTimeRef.current = 0;
    pausedAtRef.current = 0;

    setStatus('stopped');
  }, [adapter, scheduler]);

  /* eslint-disable react-hooks/refs -- intentional: tickSourceRef exposes a live ref for rAF consumers */
  return {
    status,
    currentTick,
    totalDurationTicks, // Feature 022: Total score duration for timer
    error, // US3 T052: Expose error message for UI display
    // Feature 024: ITickSource snapshot for React consumers
    tickSource: tickSourceRef.current,
    // Feature 024: Live ref for rAF consumers (bypasses shouldComponentUpdate freezing)
    tickSourceRef,
    play,
    pause,
    stop,
    seekToTick,
    unpinStartTick,
    setPinnedStart,
    setLoopEnd,
    resetPlayback,
  };
  /* eslint-enable react-hooks/refs */
}
