/**
 * useMidiConnectivity — Unit Tests
 * Feature 081: Fix MIDI Detection in Tablet in Practice Mode
 *
 * TDD: Tests written before implementation, verified red, then implementation makes them green.
 *
 * Tests:
 *   US1 — API absent → { supported: false, connected: false }
 *   US1 — Device present at mount → connected transitions null → true
 *   US1 — No devices at mount → connected transitions null → false
 *   US2 — requestMIDIAccess never resolves → connected = false after 8s timeout
 *   US2 — requestMIDIAccess rejects → connected = false
 *   US3 — Hot-plug connect → connected updates to true
 *   US3 — Hot-plug disconnect → connected updates to false
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  mockMidiSupported,
  mockMidiUnsupported,
  createMockMidiAccess,
  createMockMidiInput,
  fireMidiStateChange,
} from '../../src/test/mockMidi';
import { useMidiConnectivity, MIDI_CONNECTIVITY_TIMEOUT_MS } from './useMidiConnectivity';

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

describe('useMidiConnectivity', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ─── US1: API absent ────────────────────────────────────────────────────────

  describe('US1 — API absent (iOS Safari, etc.)', () => {
    it('returns { supported: false, connected: false } synchronously', () => {
      mockMidiUnsupported();

      const { result } = renderHook(() => useMidiConnectivity());

      expect(result.current.supported).toBe(false);
      expect(result.current.connected).toBe(false);
    });
  });

  // ─── US1: Device present at mount ──────────────────────────────────────────

  describe('US1 — MIDI device present at mount', () => {
    it('connected transitions from null to true', async () => {
      const input = createMockMidiInput('Piano');
      const access = createMockMidiAccess([input]);
      mockMidiSupported(access);

      const { result } = renderHook(() => useMidiConnectivity());

      // Initially null (check pending) — supported is true synchronously
      expect(result.current.supported).toBe(true);

      // Flush the resolved promise
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.connected).toBe(true);
    });
  });

  // ─── US1: No devices at mount ─────────────────────────────────────────────

  describe('US1 — No MIDI devices at mount', () => {
    it('connected transitions from null to false', async () => {
      const access = createMockMidiAccess([]);
      mockMidiSupported(access);

      const { result } = renderHook(() => useMidiConnectivity());

      expect(result.current.supported).toBe(true);

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.connected).toBe(false);
    });
  });

  // ─── US2: Timeout ─────────────────────────────────────────────────────────

  describe('US2 — requestMIDIAccess never resolves (slow permission)', () => {
    it('connected resolves to false after MIDI_CONNECTIVITY_TIMEOUT_MS', async () => {
      // Stub requestMIDIAccess to return a promise that never resolves
      const neverResolve = new Promise<never>(() => {});
      Object.defineProperty(globalThis.navigator, 'requestMIDIAccess', {
        value: vi.fn().mockReturnValue(neverResolve),
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useMidiConnectivity());

      expect(result.current.supported).toBe(true);
      expect(result.current.connected).toBe(null); // still pending

      // Advance past the timeout
      await act(async () => {
        vi.advanceTimersByTime(MIDI_CONNECTIVITY_TIMEOUT_MS);
        // Flush microtasks from Promise.race resolution
        await vi.runAllTimersAsync();
      });

      expect(result.current.connected).toBe(false);
    });
  });

  // ─── US2: Permission denied ───────────────────────────────────────────────

  describe('US2 — requestMIDIAccess rejects (permission denied)', () => {
    it('connected transitions to false (not stuck at null)', async () => {
      Object.defineProperty(globalThis.navigator, 'requestMIDIAccess', {
        value: vi.fn().mockRejectedValue(new DOMException('User denied', 'NotAllowedError')),
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useMidiConnectivity());

      expect(result.current.supported).toBe(true);

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.connected).toBe(false);
    });
  });

  // ─── US3: Hot-plug connect ────────────────────────────────────────────────

  describe('US3 — MIDI device connected after mount (hot-plug)', () => {
    it('connected updates from false to true', async () => {
      const access = createMockMidiAccess([]); // no devices initially
      mockMidiSupported(access);

      const { result } = renderHook(() => useMidiConnectivity());

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.connected).toBe(false);

      // Simulate hot-plug connect
      const newInput = createMockMidiInput('Piano');
      act(() => {
        fireMidiStateChange(access, newInput, 'connected');
      });

      expect(result.current.connected).toBe(true);
    });
  });

  // ─── US3: Hot-plug disconnect ──────────────────────────────────────────────

  describe('US3 — MIDI device disconnected after mount', () => {
    it('connected updates from true to false', async () => {
      const input = createMockMidiInput('Piano');
      const access = createMockMidiAccess([input]);
      mockMidiSupported(access);

      const { result } = renderHook(() => useMidiConnectivity());

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.connected).toBe(true);

      // Simulate disconnect — remove from inputs map and fire event
      act(() => {
        access.inputs.delete(input.id);
        fireMidiStateChange(access, input, 'disconnected');
      });

      expect(result.current.connected).toBe(false);
    });
  });
});
