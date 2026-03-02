/**
 * metronomeContext — T006 proxy pattern for the metronome Plugin API namespace
 * Feature 035: Metronome for Play and Practice Views
 * Task T009 (useMetronomeBridge, createNoOpMetronome, createMetronomeProxy)
 * Task T020 (BPM tracking — subscribe to scorePlayer, call engine.updateBpm)
 *
 * Mirrors the structure of scorePlayerContext.ts:
 *   - useMetronomeBridge(scorePlayer) → creates real PluginMetronomeContext
 *   - createNoOpMetronome()           → no-op stub for v1–v4 plugins
 *   - createMetronomeProxy(ref)       → proxy that delegates to ref.current
 *
 * Architecture (research.md R-005):
 *   App.tsx creates one metronomeRef per plugin and injects
 *   `metronome: createMetronomeProxy(metronomeRef)` into PluginContext.
 *   V3PluginWrapper calls useMetronomeBridge(scorePlayerApi) during render
 *   and sets proxyRefs.metronomeRef.current = api — so all plugin calls
 *   transparently reach the real hook-backed implementation.
 *
 * T020 — BPM tracking:
 *   useMetronomeBridge subscribes to the scorePlayer to detect BPM changes.
 *   When the engine is active and a different BPM arrives, it calls
 *   engine.updateBpm(newBpm) so the metronome stays in sync during playback
 *   tempo changes (FR-007, FR-007a — US3).
 */

import { useRef, useCallback, useMemo, useEffect } from 'react';
import type { PluginMetronomeContext, MetronomeState, PluginScorePlayerContext, MetronomeSubdivision } from './types';
import { useMetronome } from '../services/metronome/useMetronome';
import { PPQ } from '../services/metronome/MetronomeEngine';
import { ToneAdapter } from '../services/playback/ToneAdapter';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_BPM = 120;
const DEFAULT_TIME_SIGNATURE = { numerator: 4, denominator: 4 };

const INACTIVE_STATE: MetronomeState = {
  active: false,
  beatIndex: -1,
  isDownbeat: false,
  bpm: 0,
  subdivision: 1,
};

// ─── Beat-phase helper ────────────────────────────────────────────────────────

/**
 * Given the score tick at which the Transport is currently positioned (or about
 * to start from), compute the beat index and Transport-time offset at which the
 * first metronome click should fire so that clicks land exactly on measure-beat
 * boundaries.
 *
 * The caller must pass the current `Tone.Transport.seconds` value so the offset
 * is expressed in absolute Transport time (works both when Transport just started
 * at position 0 and when it has been running for some time and `engine.start()`
 * is called mid-song).
 *
 * @param currentTick    - Score tick (absolute) corresponding to Transport position
 *                         `transportSeconds`.
 * @param transportSeconds - Current `Tone.Transport.seconds` at the moment of the call.
 * @param bpm            - Effective BPM.
 * @param numerator      - Time-signature numerator.
 * @param denominator    - Time-signature denominator.
 * @returns startBeatIndex and scheduleOffsetSeconds to pass to engine.start()
 */
function computeBeatPhase(
  currentTick: number,
  transportSeconds: number,
  bpm: number,
  numerator: number,
  denominator: number,
): { startBeatIndex: number; scheduleOffsetSeconds: number } {
  const ticksPerBeat = PPQ * (4 / denominator);
  const beatInterval = (60 / bpm) * (4 / denominator);

  const ticksIntoCurrentBeat = currentTick % ticksPerBeat;
  const fractionalBeat = ticksIntoCurrentBeat / ticksPerBeat;

  // Always schedule the NEXT beat boundary so that:
  //   1. scheduleOffsetSeconds is always strictly ahead of transportSeconds
  //      → Tone.js never has to decide whether to fire "now" or "one cycle later"
  //   2. startBeatIndex always matches the beat that actually fires first.
  //
  // The old "snap to current boundary if fractionalBeat < 2%" case was the source
  // of the strong-beat displacement: it set startBeatIndex=0 (downbeat) but
  // passed scheduleOffsetSeconds ≈ transportSeconds.  Tone.js, seeing that
  // startTime is at or behind the current Transport position, skipped one full
  // interval — so the first click landed one beat later while still announcing
  // "downbeat", shifting every subsequent strong-beat marker by one beat.
  const nextBeatOrdinal = Math.floor(currentTick / ticksPerBeat) + 1;
  const startBeatIndex = nextBeatOrdinal % numerator;
  // Guard against exactly-zero fractional part (currentTick on a boundary):
  // use a full interval rather than 0 to avoid a startTime == transportSeconds race.
  const timeUntilNextBeat = fractionalBeat < 1e-9
    ? beatInterval
    : beatInterval * (1 - fractionalBeat);

  return {
    startBeatIndex,
    scheduleOffsetSeconds: transportSeconds + timeUntilNextBeat,
  };
}

// ─── useMetronomeBridge ───────────────────────────────────────────────────────

/**
 * React hook that creates a PluginMetronomeContext backed by a MetronomeEngine.
 *
 * Responsibilities:
 *   1. Creates/manages a MetronomeEngine via useMetronome().
 *   2. Subscribes to scorePlayer state to read BPM and time signature.
 *   3. Exposes toggle() and subscribe() as PluginMetronomeContext.
 *   4. Calls engine.updateBpm() when scorePlayer BPM changes during playback
 *      (T020 — US3: metronome follows tempo changes).
 *
 * Must be called inside a component rendered within V3PluginWrapper.
 *
 * @param scorePlayer - Live PluginScorePlayerContext from useScorePlayerBridge().api
 * @returns PluginMetronomeContext — assign to proxyRefs.metronomeRef.current
 */
export function useMetronomeBridge(
  scorePlayer: PluginScorePlayerContext
): PluginMetronomeContext {
  const { engine, state } = useMetronome();

  // Track latest scorePlayer state for BPM + time signature without causing
  // extra re-renders (same pattern as tickSourceRef in MusicTimeline).
  const scoreStateRef = useRef({
    bpm: DEFAULT_BPM,
    timeSignature: DEFAULT_TIME_SIGNATURE,
    status: 'idle' as string,
    currentTick: 0,
  });

  // Current engine active state — stable ref so toggle() closure always reads latest.
  const engineStateRef = useRef(state);
  engineStateRef.current = state;

  /** Persists the chosen subdivision across engine restart cycles. */
  const subdivisionRef = useRef<MetronomeSubdivision>(1);

  // T020: Subscribe to scorePlayer for BPM + timeSignature.
  // On BPM change while engine is active, call engine.updateBpm() (FR-007a).
  useEffect(() => {
    const unsubscribe = scorePlayer.subscribe((s) => {
      const newBpm = s.bpm > 0 ? s.bpm : DEFAULT_BPM;
      const newTs = s.timeSignature ?? DEFAULT_TIME_SIGNATURE;

      const prevBpm = scoreStateRef.current.bpm;
      const prevStatus = scoreStateRef.current.status;
      scoreStateRef.current = {
        bpm: newBpm,
        timeSignature: newTs,
        status: s.status,
        currentTick: s.currentTick,
      };

      // Update running engine if BPM changed while active
      if (engineStateRef.current.active && newBpm !== prevBpm) {
        engine.updateBpm(newBpm);
      }

      // ── Playback starts / resumes while metronome is active ──────────────
      // startTransport() restarts the Transport from position 0 (= s.currentTick).
      // The old metronome scheduleRepeat is still registered and would fire with
      // a stale beat counter during the async gap before engine.start() completes.
      // Fix: synchronously stop() the engine to kill the old event, then start()
      // to re-register at the correct beat phase.
      if (
        engineStateRef.current.active &&
        prevStatus !== 'playing' &&
        s.status === 'playing'
      ) {
        const { bpm, timeSignature } = scoreStateRef.current;
        // Synchronous: immediately kill old scheduleRepeat so no stale clicks fire
        // before we re-register at the correct beat phase.
        engine.stop();
        // Phase-lock: read the live tick and Transport position NOW (after the
        // async subscriber fires) so scheduleRepeat starts at the correct beat
        // boundary.  This mirrors the same logic used in toggle() when playback
        // is already active — using s.currentTick (the start tick, t=0) would
        // schedule the first click at Transport t≈0.05s instead of t=beatInterval,
        // causing persistent phase drift.
        const liveTick = scorePlayer.getCurrentTickLive();
        const transportSeconds = ToneAdapter.getInstance().getTransportSeconds();
        const { startBeatIndex, scheduleOffsetSeconds } = computeBeatPhase(
          liveTick,
          transportSeconds,
          bpm,
          timeSignature.numerator,
          timeSignature.denominator,
        );
        engine
          .start(bpm, timeSignature.numerator, timeSignature.denominator, startBeatIndex, scheduleOffsetSeconds, subdivisionRef.current)
          .catch((err) => {
            console.error('[useMetronomeBridge] failed to sync on playback start:', err);
          });
        return;
      }

      // ── Playback stops / pauses while metronome is active ────────────────
      // Transport is halted; restart the engine in standalone mode from beat 1.
      if (
        engineStateRef.current.active &&
        prevStatus === 'playing' &&
        (s.status === 'ready' || s.status === 'idle' || s.status === 'paused')
      ) {
        const { bpm, timeSignature } = scoreStateRef.current;
        // Synchronous stop first to avoid stale clicks
        engine.stop();
        engine.start(bpm, timeSignature.numerator, timeSignature.denominator, 0, 0, subdivisionRef.current).catch((err) => {
          console.error('[useMetronomeBridge] failed to resume after playback stop:', err);
        });
      }
    });
    return unsubscribe;
    // scorePlayer is stable (proxy ref) — no dep array churn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, scorePlayer]);

  // ─── setSubdivision() ─────────────────────────────────────────────────────

  const setSubdivision = useCallback(async (subdivision: MetronomeSubdivision): Promise<void> => {
    subdivisionRef.current = subdivision;
    // If engine is running, restart immediately at the new subdivision from beat 1
    if (engineStateRef.current.active) {
      const { bpm, timeSignature } = scoreStateRef.current;
      const effectiveBpm = bpm > 0 ? bpm : DEFAULT_BPM;
      await engine.start(effectiveBpm, timeSignature.numerator, timeSignature.denominator, 0, 0, subdivision);
    }
  }, [engine]);

  // ─── toggle() ─────────────────────────────────────────────────────────────

  const toggle = useCallback(async (): Promise<void> => {
    const currentState = engineStateRef.current;

    if (currentState.active) {
      engine.stop();
    } else {
      const { bpm, timeSignature, status } = scoreStateRef.current;
      const effectiveBpm = bpm > 0 ? bpm : DEFAULT_BPM;

      if (status === 'playing') {
        // Phase-lock to the current measure position.
        // getCurrentTickLive() gives a sub-10 Hz-latency tick reading.
        const liveTick = scorePlayer.getCurrentTickLive();
        const transportSeconds = ToneAdapter.getInstance().getTransportSeconds();
        const { startBeatIndex, scheduleOffsetSeconds } = computeBeatPhase(
          liveTick,
          transportSeconds,
          effectiveBpm,
          timeSignature.numerator,
          timeSignature.denominator,
        );
        await engine.start(
          effectiveBpm,
          timeSignature.numerator,
          timeSignature.denominator,
          startBeatIndex,
          scheduleOffsetSeconds,
          subdivisionRef.current,
        );
      } else {
        // Standalone mode (no playback) — start from the downbeat.
        await engine.start(effectiveBpm, timeSignature.numerator, timeSignature.denominator, 0, 0, subdivisionRef.current);
      }
    }
  }, [engine, scorePlayer]);

  // ─── subscribe() ──────────────────────────────────────────────────────────

  const subscribe = useCallback(
    (handler: (state: MetronomeState) => void): () => void => {
      return engine.subscribe(handler);
    },
    [engine]
  );

  // ─── Return stable API ────────────────────────────────────────────────────

  return useMemo((): PluginMetronomeContext => ({
    toggle,
    setSubdivision,
    subscribe,
  }), [toggle, setSubdivision, subscribe]);
}

// ─── createNoOpMetronome ──────────────────────────────────────────────────────

/**
 * No-op stub PluginMetronomeContext for v1–v4 plugins (backward compatibility).
 * toggle() is a no-op, subscribe() calls handler immediately with inactive state.
 */
export function createNoOpMetronome(): PluginMetronomeContext {
  return {
    toggle: async () => {},
    setSubdivision: async () => {},
    subscribe: (handler) => {
      handler(INACTIVE_STATE);
      return () => {};
    },
  };
}

// ─── createMetronomeProxy ─────────────────────────────────────────────────────

/**
 * Creates a stable PluginMetronomeContext proxy that delegates all calls
 * to `proxyRef.current` at the time of each call.
 *
 * Usage (App.tsx):
 *   const metronomeRef = { current: createNoOpMetronome() };
 *   context.metronome = createMetronomeProxy(metronomeRef);
 *   // V3PluginWrapper later: proxyRef.current = useMetronomeBridge(api)
 *
 * @param proxyRef - Ref updated by V3PluginWrapper with the real hook-backed API.
 */
export function createMetronomeProxy(
  proxyRef: { current: PluginMetronomeContext }
): PluginMetronomeContext {
  return {
    toggle: (...args) => proxyRef.current.toggle(...args),
    setSubdivision: (...args) => proxyRef.current.setSubdivision(...args),
    subscribe: (handler) => proxyRef.current.subscribe(handler),
  };
}
