/**
 * useMidiInput — React hook for Web MIDI API input.
 *
 * T010 (Phase 3, US1 implementation).
 *
 * Requests MIDI access on mount (sysex: false).
 * Subscribes to all connected MIDI input devices on all channels.
 * Emits note-on events and connection changes via callbacks.
 * Cleans up all handlers on unmount.
 *
 * Timeout: if MIDI access does not resolve within 3 seconds,
 * sets error "MIDI access timed out" and falls back to empty devices.
 *
 * Feature: 029-midi-input
 */

import { useEffect, useRef, useState } from 'react';
import type { MidiDevice, MidiNoteEvent, MidiConnectionEvent } from '../../types/recording';
import { parseMidiNoteOn, parseMidiNoteOff, parseMidiCC } from './midiUtils';
import type { MidiCCEvent } from './midiUtils';

const MIDI_ACCESS_TIMEOUT_MS = 3000;
const CONNECT_DEBOUNCE_MS = 300;

export interface UseMidiInputCallbacks {
  /** Called for every MIDI note-on event (velocity > 0) on any channel */
  onNoteOn: (event: MidiNoteEvent) => void;
  /** Called for every MIDI note-off event (explicit 0x80 or velocity-0 0x90) */
  onNoteOff?: (noteNumber: number) => void;
  /** Called when a device connects or disconnects */
  onConnectionChange: (event: MidiConnectionEvent) => void;
  /** Called for CC7 (channel volume) and CC11 (expression) messages. Feature 063. */
  onCC?: (event: MidiCCEvent) => void;
  /** Session start timestamp in ms — used for computing session-relative event times */
  sessionStartMs?: number;
}

export interface UseMidiInputResult {
  /** Currently connected MIDI input devices */
  devices: MidiDevice[];
  /** Human-readable error message or null */
  error: string | null;
  /** True if the browser supports Web MIDI API */
  isSupported: boolean;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function portToDevice(port: Pick<MIDIPort, 'id' | 'name' | 'manufacturer' | 'state'>): MidiDevice {
  return {
    id: port.id,
    name: port.name ?? 'Unknown Device',
    manufacturer: port.manufacturer ?? '',
    state: port.state as 'connected' | 'disconnected',
  };
}

function accessToDevices(access: MIDIAccess): MidiDevice[] {
  const out: MidiDevice[] = [];
  access.inputs.forEach((input) => {
    out.push(portToDevice(input));
  });
  return out;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMidiInput(callbacks: UseMidiInputCallbacks): UseMidiInputResult {
  const [devices, setDevices] = useState<MidiDevice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  // Keep latest callbacks in a ref so the event handlers always see fresh values
  const callbacksRef = useRef(callbacks);
  useEffect(() => {
    callbacksRef.current = callbacks;
  });

  // Track the MIDIAccess object for cleanup
  const accessRef = useRef<MIDIAccess | null>(null);
  // Debounce timers for connect events
  const connectTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Track subscribed inputs for cleanup
  const subscribedInputsRef = useRef<MIDIInput[]>([]);

  useEffect(() => {
    let cancelled = false;

    // ── Browser support check ──────────────────────────────────────────────
    if (
      !('requestMIDIAccess' in navigator) ||
      typeof navigator.requestMIDIAccess !== 'function'
    ) {
      setIsSupported(false);
      setDevices([]);
      return;
    }

    setIsSupported(true);

    // ── Subscribe to inputs ────────────────────────────────────────────────
    function subscribeToInput(input: MIDIInput) {
      subscribedInputsRef.current.push(input);
      input.onmidimessage = (ev: MIDIMessageEvent) => {
        if (cancelled) return;
        if (!ev.data) return;
        const { sessionStartMs = 0 } = callbacksRef.current;
        const note = parseMidiNoteOn(ev.data as Uint8Array, sessionStartMs, ev.timeStamp);
        if (note) {
          const noteWithRawBytes = { ...note, rawBytes: Array.from(ev.data as Uint8Array) };
          callbacksRef.current.onNoteOn(noteWithRawBytes);
          return;
        }
        const offNote = parseMidiNoteOff(ev.data as Uint8Array);
        if (offNote !== null && callbacksRef.current.onNoteOff) {
          callbacksRef.current.onNoteOff(offNote);
          return;
        }
        // Feature 063 + 069: Route ALL CC messages to onCC callback
        const cc = parseMidiCC(ev.data as Uint8Array);
        if (cc && callbacksRef.current.onCC) {
          callbacksRef.current.onCC(cc);
        }
      };
    }

    function subscribeToAllInputs(access: MIDIAccess) {
      access.inputs.forEach((input) => subscribeToInput(input));
    }

    // ── State-change handler ───────────────────────────────────────────────
    function handleStateChange(ev: MIDIConnectionEvent) {
      if (cancelled || !accessRef.current) return;
      const port = ev.port;
      console.log('[useMidiInput] onstatechange', port?.id, port?.name, port?.type, port?.state);
      if (!port || port.type !== 'input') return;

      if (port.state === 'disconnected') {
        // Immediate — no debounce for disconnect
        const device = portToDevice(port);
        console.log('[useMidiInput] disconnect → calling onConnectionChange', device);
        callbacksRef.current.onConnectionChange({ device, kind: 'disconnected', timestamp: Date.now() });
        setDevices(accessToDevices(accessRef.current));
      } else if (port.state === 'connected') {
        // Debounce connect events 300 ms
        const existingTimer = connectTimersRef.current.get(port.id);
        if (existingTimer) clearTimeout(existingTimer);
        console.log('[useMidiInput] connect event — debouncing 300ms for', port.name);

        const timer = setTimeout(() => {
          if (cancelled || !accessRef.current) return;
          const input = port as MIDIInput;
          subscribeToInput(input);
          const device = portToDevice(port);
          console.log('[useMidiInput] connect debounce elapsed → calling onConnectionChange', device);
          callbacksRef.current.onConnectionChange({ device, kind: 'connected', timestamp: Date.now() });
          setDevices(accessToDevices(accessRef.current));
          connectTimersRef.current.delete(port.id);
        }, CONNECT_DEBOUNCE_MS);

        connectTimersRef.current.set(port.id, timer);
      }
    }

    // ── Request MIDI access with timeout ───────────────────────────────────
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('MIDI access timed out')), MIDI_ACCESS_TIMEOUT_MS);
    });

    Promise.race([
      navigator.requestMIDIAccess({ sysex: false }),
      timeoutPromise,
    ])
      .then((access) => {
        if (cancelled) return;
        accessRef.current = access;
        const initialDevices = accessToDevices(access);
        console.log('[useMidiInput] MIDI access granted, initial devices:', initialDevices.map(d => d.name));
        subscribeToAllInputs(access);
        // Use addEventListener instead of onstatechange assignment.
        // The browser returns the SAME MIDIAccess singleton from every
        // requestMIDIAccess() call — assigning onstatechange would be
        // overwritten by any other caller (e.g. plugin MIDI detection),
        // and their cleanup (onstatechange = null) would kill our handler.
        access.addEventListener('statechange', handleStateChange as EventListener);
        setDevices(initialDevices);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.log('[useMidiInput] MIDI access failed:', err);
        if (err instanceof Error && err.message === 'MIDI access timed out') {
          setError('MIDI access timed out');
        } else {
          setError('MIDI access denied');
        }
        setDevices([]);
      });

    // ── Cleanup ────────────────────────────────────────────────────────────
    return () => {
      cancelled = true;

      // Clear all pending connect debounce timers
      connectTimersRef.current.forEach((timer) => clearTimeout(timer));
      connectTimersRef.current.clear();

      // Remove all message handlers
      subscribedInputsRef.current.forEach((input) => {
        input.onmidimessage = null;
      });
      subscribedInputsRef.current = [];

      // Remove state-change handler (addEventListener-based, not onstatechange)
      if (accessRef.current) {
        accessRef.current.removeEventListener('statechange', handleStateChange as EventListener);
        accessRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount-only — callbacks are accessed via ref

  return { devices, error, isSupported };
}
