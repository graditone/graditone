/**
 * useMidiConnectivity — MIDI connectivity detection hook for Practice View.
 * Feature 081: Fix MIDI Detection in Tablet in Practice Mode
 *
 * Replaces the inline useEffect in PracticeViewPlugin.tsx that had three bugs:
 * 1. No timeout — requestMIDIAccess() could wait forever on tablet
 * 2. Silent catch — permission denial left state as null
 * 3. API absent path returned early without setting state to false
 *
 * Uses addEventListener('statechange', ...) — never onstatechange assignment —
 * to avoid clobbering useMidiInput's handler on the shared MIDIAccess singleton.
 */

import { useState, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MidiConnectivityState {
  /**
   * Whether at least one MIDI input device is currently connected.
   * - null  → check pending (resolves within MIDI_CONNECTIVITY_TIMEOUT_MS)
   * - true  → one or more MIDI inputs present
   * - false → check completed, no inputs (or permission denied / timeout)
   */
  connected: boolean | null;

  /**
   * Whether the Web MIDI API is available in this browser.
   * - true  → navigator.requestMIDIAccess exists
   * - false → API absent (iOS Safari without bridge, etc.)
   * Set synchronously on mount — never changes after mount.
   */
  supported: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Timeout for MIDI access request — generous for tablet permission prompts. */
export const MIDI_CONNECTIVITY_TIMEOUT_MS = 8000;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMidiConnectivity(): MidiConnectivityState {
  // Synchronous API detection
  const apiAvailable =
    typeof navigator !== 'undefined' &&
    'requestMIDIAccess' in navigator &&
    typeof navigator.requestMIDIAccess === 'function';

  const [connected, setConnected] = useState<boolean | null>(
    apiAvailable ? null : false,
  );

  useEffect(() => {
    if (!apiAvailable) return;

    let cancelled = false;
    let midiAccess: MIDIAccess | null = null;

    const handleStateChange = () => {
      if (!cancelled && midiAccess) {
        setConnected(midiAccess.inputs.size > 0);
      }
    };

    const nav = navigator as Navigator & {
      requestMIDIAccess: (options?: { sysex?: boolean }) => Promise<MIDIAccess>;
    };

    // Timeout promise — resolves to null after MIDI_CONNECTIVITY_TIMEOUT_MS
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), MIDI_CONNECTIVITY_TIMEOUT_MS);
    });

    Promise.race([nav.requestMIDIAccess({ sysex: false }), timeoutPromise])
      .then((result) => {
        if (cancelled) return;
        if (result === null) {
          // Timeout — set connected to false
          setConnected(false);
          return;
        }
        const access = result;
        midiAccess = access;
        setConnected(access.inputs.size > 0);
        access.addEventListener('statechange', handleStateChange);
      })
      .catch(() => {
        // Permission denied or other error — definitive "not connected"
        if (!cancelled) setConnected(false);
      });

    return () => {
      cancelled = true;
      if (midiAccess) {
        midiAccess.removeEventListener('statechange', handleStateChange);
      }
    };
  }, [apiAvailable]);

  return { connected, supported: apiAvailable };
}
