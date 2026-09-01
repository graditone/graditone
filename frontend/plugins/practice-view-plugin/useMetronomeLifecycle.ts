/**
 * useMetronomeLifecycle (097-metronome-lifecycle-api)
 *
 * Single, unified practice-side metronome lifecycle policy built on the
 * shared PluginMetronomeContext API. Both score practice and free practice
 * drive the metronome exclusively through this hook, so their behaviour is
 * identical and all bespoke armed/enabled refs live in one place.
 *
 * Lifecycle (see specs/097-metronome-lifecycle-api/contracts/):
 *   - onToggle(true)  while idle        → arm()            (deferred start on first note)
 *   - onToggle        while armed       → disarm()         (second tap cancels)
 *   - onToggle        while active      → toggle() (stop)
 *   - onToggle(false) while idle        → toggle() (start now)
 *   - onFirstNote()                     → startFromDeferred() (only acts while armed)
 *   - onSessionStart()                  → if running standalone, stop + arm (defer)
 *   - onSessionEnd()                    → stop engine, then re-arm if enabled
 *   - onExit()                          → stop + disarm + clear enabled preference
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MetronomeState, PluginMetronomeContext } from '../../src/plugin-api/index';

const INACTIVE: MetronomeState = {
  active: false,
  armed: false,
  beatIndex: -1,
  isDownbeat: false,
  bpm: 0,
  subdivision: 1,
  subBeatIndex: 0,
};

export interface UseMetronomeLifecycleParams {
  /** Full plugin context surface; only `metronome` is used. */
  context: { metronome: PluginMetronomeContext };
}

export interface UseMetronomeLifecycleReturn {
  /** Latest MetronomeState snapshot (includes `armed`). */
  state: MetronomeState;
  /** Derived: `state.armed`. */
  armed: boolean;
  /** Derived: `state.active`. */
  active: boolean;
  /**
   * Toggle handler. `canArm` is true when the caller's practice is in the
   * "waiting for the first note" state (arming defers the start to the first
   * note); false starts/stops immediately.
   */
  onToggle: (canArm: boolean) => void;
  /** First-note handler — consumes the arm via startFromDeferred(). */
  onFirstNote: () => void;
  /** Practice-session start: stop a running standalone metronome and defer it. */
  onSessionStart: () => void;
  /** Practice-session end: stop the engine, re-arm if the metronome was enabled. */
  onSessionEnd: () => void;
  /** Leave the practice entirely: stop + disarm + clear the enabled preference. */
  onExit: () => void;
}

export function useMetronomeLifecycle({
  context,
}: UseMetronomeLifecycleParams): UseMetronomeLifecycleReturn {
  const [state, setState] = useState<MetronomeState>(INACTIVE);
  const stateRef = useRef<MetronomeState>(INACTIVE);
  /** User preference: metronome should be enabled for the current/next session. */
  const enabledRef = useRef(false);

  const metro = context.metronome;

  useEffect(() => {
    return metro.subscribe((s) => {
      stateRef.current = s;
      setState(s);
    });
  }, [metro]);

  const onToggle = useCallback(
    (canArm: boolean): void => {
      const s = stateRef.current;
      if (s.active) {
        enabledRef.current = false;
        void metro.toggle().catch(() => {});
      } else if (s.armed) {
        enabledRef.current = false;
        metro.disarm();
      } else if (canArm) {
        enabledRef.current = true;
        metro.arm();
      } else {
        enabledRef.current = true;
        void metro.toggle().catch(() => {});
      }
    },
    [metro],
  );

  const onFirstNote = useCallback((): void => {
    // Only acts while armed (engine start); safe on every first-note event.
    void metro.startFromDeferred().catch(() => {});
  }, [metro]);

  const onSessionStart = useCallback((): void => {
    // A metronome left running standalone (e.g. toggled on manually) is
    // stopped and deferred to the first note of the new session.
    if (stateRef.current.active) {
      enabledRef.current = true;
      void metro.toggle().catch(() => {});
      metro.arm();
    }
    // Otherwise armed (from a previous onSessionEnd) or fully off — nothing to do.
  }, [metro]);

  const onSessionEnd = useCallback((): void => {
    if (stateRef.current.active) {
      void metro.toggle().catch(() => {});
    }
    if (enabledRef.current) {
      metro.arm();
    } else {
      metro.disarm();
    }
  }, [metro]);

  const onExit = useCallback((): void => {
    enabledRef.current = false;
    if (stateRef.current.active) {
      void metro.toggle().catch(() => {});
    }
    metro.disarm();
  }, [metro]);

  return {
    state,
    armed: state.armed,
    active: state.active,
    onToggle,
    onFirstNote,
    onSessionStart,
    onSessionEnd,
    onExit,
  };
}