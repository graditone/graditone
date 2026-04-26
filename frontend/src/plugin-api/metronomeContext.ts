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
  subBeatIndex: 0,
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
 * @param pickupTicks    - Duration of the pickup/anacrusis measure in ticks (0 = no pickup).
 *                         When non-zero, tick 0 is beat `numerator - pickupTicks/ticksPerBeat`
 *                         within the first virtual measure, so the first real downbeat is at
 *                         tick `pickupTicks`.
 * @returns startBeatIndex and scheduleOffsetSeconds to pass to engine.start()
 */
function computeBeatPhase(
  currentTick: number,
  transportSeconds: number,
  bpm: number,
  numerator: number,
  denominator: number,
  pickupTicks = 0,
): { startBeatIndex: number; scheduleOffsetSeconds: number } {
  const ticksPerBeat = PPQ * (4 / denominator);
  const beatInterval = (60 / bpm) * (4 / denominator);

  // Adjust currentTick relative to the first real downbeat.
  // For pickup scores tick 0 is mid-measure; shifting by -pickupTicks makes
  // tick `pickupTicks` (the true downbeat) align with offset 0, so that
  // `beatOrdinal % numerator` correctly yields 0 there.
  const adjustedTick = currentTick - pickupTicks;

  const ticksIntoCurrentBeat = ((adjustedTick % ticksPerBeat) + ticksPerBeat) % ticksPerBeat;
  const fractionalBeat = ticksIntoCurrentBeat / ticksPerBeat;

  // ── Fresh-start optimisation ───────────────────────────────────────────────
  // If we are still within the first beat (transportSeconds < beatInterval) AND
  // the tick is at/near a beat boundary (fractionalBeat < 5%), schedule the
  // first click at transportSeconds + 1 ms rather than skipping a full beat.
  // Without this the downbeat is silently skipped — especially noticeable at
  // slow tempos (13 BPM → 4.6 s/beat) where the user hears the first note with
  // no click, then waits almost 5 s for the metronome to join in.
  //
  // Using transportSeconds < beatInterval (not a fixed 50 ms threshold) handles
  // React subscriber delays of 150–200 ms after startTransport().
  // `fractionalBeat < 0.05` prevents this from firing when toggled on mid-song.
  if (transportSeconds < beatInterval && fractionalBeat < 0.05) {
    const beatOrdinal = Math.floor(adjustedTick / ticksPerBeat);
    return {
      startBeatIndex: ((beatOrdinal % numerator) + numerator) % numerator,
      scheduleOffsetSeconds: transportSeconds + 0.001,
    };
  }

  // Always schedule the NEXT beat boundary so that scheduleOffsetSeconds is
  // strictly ahead of transportSeconds.  This avoids a Tone.js race where it
  // would otherwise have to decide whether to fire "now" or "one cycle later".
  const nextBeatOrdinal = Math.floor(adjustedTick / ticksPerBeat) + 1;
  const startBeatIndex = ((nextBeatOrdinal % numerator) + numerator) % numerator;
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
    pickupTicks: 0,
  });

  // Current engine active state — stable ref so toggle() closure always reads latest.
  const engineStateRef = useRef(state);
  engineStateRef.current = state;

  /** Persists the chosen subdivision across engine restart cycles. */
  const subdivisionRef = useRef<MetronomeSubdivision>(1);

  // T020: Subscribe to scorePlayer for BPM + timeSignature.
  // On BPM change while engine is active, call engine.updateBpm() (FR-007a).
  //
  // FR-003 / FR-004 (Issue #2 — loop restart fix): Also subscribe to
  // ToneAdapter.onTransportRestart so the engine re-registers its
  // scheduleRepeat after every loop-boundary Transport restart.
  // The listener fires synchronously BEFORE Transport.stop()/start(), so
  // engine.start() is deferred via a microtask to ensure the Transport is
  // already running at position 0 when scheduleRepeat is registered.
  useEffect(() => {
    const adapter = ToneAdapter.getInstance();
    const unsubTransportRestart = adapter.onTransportRestart(() => {
      if (!engineStateRef.current.active) return;
      // Capture state synchronously (before Transport restarts).
      const { bpm, timeSignature, pickupTicks } = scoreStateRef.current;
      const capturedStatus = scoreStateRef.current.status;
      Promise.resolve().then(() => {
        // ── Initial play (Transport restart triggered by user pressing Play) ──
        // When status is NOT yet 'playing' (e.g. 'ready'), the subscriber's
        // 'prevStatus !== playing → status === playing' branch will fire and
        // call engine.start() with the correct beat phase via computeBeatPhase.
        // Let it handle that — starting here would fire a wrong-phase click
        // (beat 0 at tick 0 ignores pickup) that the subscriber cannot undo
        // fast enough to prevent the user from hearing it.
        if (capturedStatus !== 'playing') return;

        // ── Loop-wrap restart (Transport resets to 0 mid-playback) ──
        // Status stays 'playing' throughout a loop wrap.  Re-register the
        // scheduleRepeat with the correct beat phase for the loop-start tick.
        if (!engineStateRef.current.active) return;
        const liveTick = scorePlayer.getCurrentTickLive();
        const transportSeconds = adapter.getTransportSeconds();
        const { startBeatIndex, scheduleOffsetSeconds } = computeBeatPhase(
          liveTick,
          transportSeconds,
          bpm,
          timeSignature.numerator,
          timeSignature.denominator,
          pickupTicks,
        );
        engine
          .start(bpm, timeSignature.numerator, timeSignature.denominator, startBeatIndex, scheduleOffsetSeconds, subdivisionRef.current, /* skipTransportStart */ true)
          .catch((err) => {
            console.error('[useMetronomeBridge] failed to restart after loop wrap:', err);
          });
      });
    });

    const unsubscribe = scorePlayer.subscribe((s) => {
      // Use exactBpm (unrounded) for all audio-timing calculations so the
      // metronome beat interval matches the note schedule exactly.  The rounded
      // s.bpm is only for display — at slow practice speeds (e.g. 120 BPM × 11 %
      // = 13.2 BPM, rounds to 13) the rounding error is 1.5 % which causes ~70 ms
      // of drift per beat.
      const newBpm = (s.exactBpm ?? s.bpm) > 0 ? (s.exactBpm ?? s.bpm) : DEFAULT_BPM;
      const newTs = s.timeSignature ?? DEFAULT_TIME_SIGNATURE;
      const newPickupTicks = s.pickupTicks ?? 0;

      const prevBpm = scoreStateRef.current.bpm;
      const prevStatus = scoreStateRef.current.status;
      scoreStateRef.current = {
        bpm: newBpm,
        timeSignature: newTs,
        status: s.status,
        currentTick: s.currentTick,
        pickupTicks: newPickupTicks,
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
        const { bpm, timeSignature, pickupTicks } = scoreStateRef.current;
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
          pickupTicks,
        );
        engine
          .start(bpm, timeSignature.numerator, timeSignature.denominator, startBeatIndex, scheduleOffsetSeconds, subdivisionRef.current, /* skipTransportStart */ true)
          .catch((err) => {
            console.error('[useMetronomeBridge] failed to sync on playback start:', err);
          });
        return;
      }

      // ── Playback stops / pauses while metronome is active ────────────────
      // When playback transitions playing → ready/paused (e.g. natural end of
      // score, user stop/pause, or transient state during a loop wrap), we do
      // NOT restart the engine here.  Doing so caused two bugs:
      //   1. A phantom DOWNBEAT click at the moment of the transition (since
      //      restart used startBeat=0, offset=0).
      //   2. The metronome "beat 1" was misaligned for the rest of playback
      //      because the standalone restart re-anchored the beat counter.
      // The engine's scheduleRepeat naturally goes silent when the Transport
      // stops, which is the correct behaviour: the metronome follows the score.
      // If the user wants the metronome to keep ticking after a stop, they can
      // toggle it off and on again.
    });
    return () => {
      unsubTransportRestart();
      unsubscribe();
    };
    // scorePlayer is stable (proxy ref) — no dep array churn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, scorePlayer]);

  // ─── setSubdivision() ─────────────────────────────────────────────────────

  const setSubdivision = useCallback(async (subdivision: MetronomeSubdivision): Promise<void> => {
    subdivisionRef.current = subdivision;
    // If engine is running, restart immediately at the new subdivision from beat 1
    if (engineStateRef.current.active) {
      const { bpm, timeSignature, status } = scoreStateRef.current;
      const effectiveBpm = bpm > 0 ? bpm : DEFAULT_BPM;
      // Skip Transport.start() if playback is running (it already owns the Transport)
      const skipTransportStart = status === 'playing';
      await engine.start(effectiveBpm, timeSignature.numerator, timeSignature.denominator, 0, 0, subdivision, skipTransportStart);
    }
  }, [engine]);

  // ─── toggle() ─────────────────────────────────────────────────────────────

  const toggle = useCallback(async (): Promise<void> => {
    const currentState = engineStateRef.current;

    if (currentState.active) {
      engine.stop();
    } else {
      const { bpm, timeSignature, status, pickupTicks } = scoreStateRef.current;
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
          pickupTicks,
        );
        // skipTransportStart=true: playback already owns the Transport
        await engine.start(
          effectiveBpm,
          timeSignature.numerator,
          timeSignature.denominator,
          startBeatIndex,
          scheduleOffsetSeconds,
          subdivisionRef.current,
          /* skipTransportStart */ true,
        );
      } else {
        // Standalone mode (no playback) — start from the downbeat.
        // skipTransportStart=false (default): engine.start() will start Transport.
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
