/**
 * useMetronome — React hook wrapping MetronomeEngine
 * Feature 035: Metronome for Play and Practice Views
 * Task T005
 *
 * Creates a MetronomeEngine instance, subscribes to its state, and exposes
 * both the live MetronomeState (for React rendering) and the engine itself
 * (for imperative calls: start, stop, updateBpm).
 *
 * Lifecycle:
 *   - Engine is created once on mount (via useRef initialiser).
 *   - Engine is disposed on unmount → Tone.js Transport events are cancelled
 *     and synths are released.
 *
 * Usage (host side — not plugin code):
 * ```tsx
 * const { engine, state } = useMetronome();
 * // engine.start(bpm, numerator, denominator)
 * // state.active, state.beatIndex, state.isDownbeat, state.bpm
 * ```
 */

import { useRef, useState, useEffect } from 'react';
import { MetronomeEngine } from './MetronomeEngine';
import type { MetronomeState } from '../../plugin-api/types';

const INACTIVE_STATE: MetronomeState = {
  active: false,
  beatIndex: -1,
  isDownbeat: false,
  bpm: 0,
};

export interface UseMetronomeReturn {
  /** The live MetronomeEngine instance (stable across re-renders). */
  engine: MetronomeEngine;
  /** Latest MetronomeState snapshot — safe to read in React render. */
  state: MetronomeState;
}

/**
 * React hook that creates and manages a MetronomeEngine.
 *
 * Returns a stable `engine` for imperative calls and a reactive `state`
 * that re-renders the component when beats fire or the engine is toggled.
 *
 * Must be called inside a React component or custom hook.
 */
export function useMetronome(): UseMetronomeReturn {
  // Create engine once (useRef initialiser runs only on the first render).
  // Using a lazy initialiser avoids creating extra instances in Strict Mode
  // double-invocation: the same ref object is reused on re-render.
  const engineRef = useRef<MetronomeEngine>(null as unknown as MetronomeEngine);
  if (!engineRef.current) {
    engineRef.current = new MetronomeEngine();
  }
  const engine = engineRef.current;

  const [state, setState] = useState<MetronomeState>(INACTIVE_STATE);

  useEffect(() => {
    const unsubscribe = engine.subscribe(setState);
    return () => {
      unsubscribe();
      engine.dispose();
    };
    // engine ref is stable — no deps needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { engine, state };
}
