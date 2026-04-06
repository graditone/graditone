/**
 * VirtualKeyboard component tests — T010
 * Feature 030: Plugin Architecture (US1 — Play Virtual Keyboard)
 *
 * Constitution Principle V: tests written and verified failing before
 * VirtualKeyboard.tsx implementation is committed.
 *
 * Covers (per tasks.md T010):
 * - Renders 14+ white keys and 10 black keys per octave
 * - Key press applies .key--pressed CSS class
 * - Key press calls context.emitNote() and context.playNote() with correct midiNote
 * - White key C4 emits midiNote: 60
 * - Black key C#4 emits midiNote: 61
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { VirtualKeyboard } from './VirtualKeyboard';
import type { PluginContext, PluginManifest, PluginStaffViewerProps } from '../../src/plugin-api/index';
import { LocaleProvider } from '../../src/i18n/index';

const makeManifest = (): PluginManifest => ({
  id: 'virtual-keyboard',
  name: 'Virtual Keyboard',
  version: '1.0.0',
  pluginApiVersion: '1',
  entryPoint: 'index.js',
  origin: 'builtin',
});

function makeContext(emitNote = vi.fn(), playNote = vi.fn()): PluginContext {
  return {
    emitNote,
    playNote,
    manifest: makeManifest(),
    midi: {
      // No-op stub: returns a no-op unsubscribe function.
      subscribe: () => () => {},
    },
    components: {
      // Lightweight stub — isolates VirtualKeyboard from the real notation engine.
      // Renders data-note-count so tests can inspect when notes are committed.
      StaffViewer: ({ notes }: PluginStaffViewerProps) => (
        <div data-testid="mock-staff-viewer" data-note-count={String(notes.length)} />
      ),
    },
  };
}

/** Provide LocaleProvider for tests */
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <LocaleProvider locale="en">{children}</LocaleProvider>;
}

describe('VirtualKeyboard', () => {
  let emitNote: ReturnType<typeof vi.fn>;
  let playNote: ReturnType<typeof vi.fn>;
  let context: PluginContext;

  beforeEach(() => {
    emitNote = vi.fn();
    playNote = vi.fn();
    context = makeContext(emitNote, playNote);
  });

  describe('keyboard layout', () => {
    it('renders at least 14 white keys', () => {
      render(<VirtualKeyboard context={context} />, { wrapper: TestWrapper });
      const whiteKeys = document.querySelectorAll('.key--white');
      expect(whiteKeys.length).toBeGreaterThanOrEqual(14);
    });

    it('renders at least 10 black keys', () => {
      render(<VirtualKeyboard context={context} />, { wrapper: TestWrapper });
      const blackKeys = document.querySelectorAll('.key--black');
      expect(blackKeys.length).toBeGreaterThanOrEqual(10);
    });

    it('renders the StaffViewer component via the plugin API', () => {
      render(<VirtualKeyboard context={context} />, { wrapper: TestWrapper });
      expect(screen.getByTestId('mock-staff-viewer')).toBeDefined();
    });
  });

  describe('key interactions', () => {
    it('calls context.emitNote when a white key is pressed', () => {
      render(<VirtualKeyboard context={context} />, { wrapper: TestWrapper });
      const whiteKeys = document.querySelectorAll('.key--white');
      fireEvent.mouseDown(whiteKeys[0]);
      expect(emitNote).toHaveBeenCalledTimes(1);
    });

    it('calls context.emitNote when a black key is pressed', () => {
      render(<VirtualKeyboard context={context} />, { wrapper: TestWrapper });
      const blackKeys = document.querySelectorAll('.key--black');
      fireEvent.mouseDown(blackKeys[0]);
      expect(emitNote).toHaveBeenCalledTimes(1);
    });

    it('calls context.playNote with type:attack on mousedown', () => {
      render(<VirtualKeyboard context={context} />, { wrapper: TestWrapper });
      const c4 = document.querySelector('[data-midi="60"]');
      fireEvent.mouseDown(c4!);
      expect(playNote).toHaveBeenCalledWith(
        expect.objectContaining({ midiNote: 60, type: 'attack' })
      );
    });

    it('calls context.playNote with type:release on mouseup', () => {
      render(<VirtualKeyboard context={context} />, { wrapper: TestWrapper });
      const c4 = document.querySelector('[data-midi="60"]');
      fireEvent.mouseDown(c4!);
      fireEvent.mouseUp(c4!);
      expect(playNote).toHaveBeenCalledWith(
        expect.objectContaining({ midiNote: 60, type: 'release' })
      );
    });

    it('emits a PluginNoteEvent with midiNote and timestamp', () => {
      render(<VirtualKeyboard context={context} />, { wrapper: TestWrapper });
      const before = Date.now();
      const whiteKeys = document.querySelectorAll('.key--white');
      fireEvent.mouseDown(whiteKeys[0]);
      const after = Date.now();

      const event = emitNote.mock.calls[0][0];
      expect(typeof event.midiNote).toBe('number');
      expect(event.timestamp).toBeGreaterThanOrEqual(before);
      expect(event.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('MIDI note mapping', () => {
    it('middle C (C4) emits midiNote: 60', () => {
      render(<VirtualKeyboard context={context} />, { wrapper: TestWrapper });
      // C4 is middle C — find the key with data-midi="60"
      const c4 = document.querySelector('[data-midi="60"]');
      expect(c4).not.toBeNull();
      fireEvent.mouseDown(c4!);
      expect(emitNote).toHaveBeenCalledWith(
        expect.objectContaining({ midiNote: 60 })
      );
    });

    it('C#4 (black key) emits midiNote: 61', () => {
      render(<VirtualKeyboard context={context} />, { wrapper: TestWrapper });
      const cSharp4 = document.querySelector('[data-midi="61"]');
      expect(cSharp4).not.toBeNull();
      fireEvent.mouseDown(cSharp4!);
      expect(emitNote).toHaveBeenCalledWith(
        expect.objectContaining({ midiNote: 61 })
      );
    });
  });

  describe('visual pressed state', () => {
    it('adds key--pressed class on mousedown', () => {
      render(<VirtualKeyboard context={context} />, { wrapper: TestWrapper });
      const c4 = document.querySelector('[data-midi="60"]') as HTMLElement;
      expect(c4.classList.contains('key--pressed')).toBe(false);
      fireEvent.mouseDown(c4);
      expect(c4.classList.contains('key--pressed')).toBe(true);
    });

    it('removes key--pressed class on mouseup', () => {
      render(<VirtualKeyboard context={context} />, { wrapper: TestWrapper });
      const c4 = document.querySelector('[data-midi="60"]') as HTMLElement;
      fireEvent.mouseDown(c4);
      fireEvent.mouseUp(c4);
      expect(c4.classList.contains('key--pressed')).toBe(false);
    });

    it('removes key--pressed class on mouseleave', () => {
      render(<VirtualKeyboard context={context} />, { wrapper: TestWrapper });
      const c4 = document.querySelector('[data-midi="60"]') as HTMLElement;
      fireEvent.mouseDown(c4);
      fireEvent.mouseLeave(c4);
      expect(c4.classList.contains('key--pressed')).toBe(false);
    });
  });

  describe('note timing and duration', () => {
    it('does NOT add a note to StaffViewer on mousedown — only on mouseup', async () => {
      render(<VirtualKeyboard context={context} />, { wrapper: TestWrapper });
      const viewer = screen.getByTestId('mock-staff-viewer');
      const c4 = document.querySelector('[data-midi="60"]') as HTMLElement;

      expect(viewer.getAttribute('data-note-count')).toBe('0');
      await act(async () => { fireEvent.mouseDown(c4); });
      // Note is NOT committed until the key is released
      expect(viewer.getAttribute('data-note-count')).toBe('0');

      await act(async () => { fireEvent.mouseUp(c4); });
      expect(viewer.getAttribute('data-note-count')).toBe('1');
    });

    it('sets durationMs on the committed note', async () => {
      // Use a capture helper to read the actual notes array passed to StaffViewer.
      let capturedNotes: import('../../src/plugin-api/index').PluginNoteEvent[] = [];
      const capturingContext: PluginContext = {
        emitNote: vi.fn(),
        playNote: vi.fn(),
        manifest: makeManifest(),
        midi: { subscribe: () => () => {} },
        components: {
          StaffViewer: ({ notes }: PluginStaffViewerProps) => {
            capturedNotes = [...notes];
            return <div data-testid="mock-staff-viewer" />;
          },
        },
      };

      render(<VirtualKeyboard context={capturingContext} />, { wrapper: TestWrapper });
      const c4 = document.querySelector('[data-midi="60"]') as HTMLElement;

      const before = Date.now();
      await act(async () => { fireEvent.mouseDown(c4); });
      await act(async () => { fireEvent.mouseUp(c4); });
      const after = Date.now();

      expect(capturedNotes).toHaveLength(1);
      const note = capturedNotes[0];
      expect(note.midiNote).toBe(60);
      expect(note.durationMs).toBeGreaterThanOrEqual(0);
      expect(note.durationMs).toBeLessThanOrEqual(after - before + 10); // small fuzz
    });
  });

  describe('touch / mouse dual-source guard', () => {
    it('does NOT fire a second attack when mousedown follows touchstart within 500 ms', () => {
      render(<VirtualKeyboard context={context} />, { wrapper: TestWrapper });
      const c4 = document.querySelector('[data-midi="60"]') as HTMLElement;

      // Simulate a touch sequence followed immediately by the browser's
      // synthetic mouse event (mobile browsers do this within ~300 ms).
      fireEvent.touchStart(c4, { touches: [{ identifier: 1 }] });
      fireEvent.mouseDown(c4);

      // emitNote should be called exactly once (from the touchstart handler),
      // not a second time from the synthetic mousedown.
      expect(emitNote).toHaveBeenCalledTimes(1);
    });
  });

  describe('clear button', () => {
    it('renders a "Clear" button', () => {
      render(<VirtualKeyboard context={context} />, { wrapper: TestWrapper });
      const btn = screen.getByRole('button', { name: /clear/i });
      expect(btn).toBeTruthy();
    });

    it('clicking Clear empties all notes from the StaffViewer', async () => {
      render(<VirtualKeyboard context={context} />, { wrapper: TestWrapper });
      const viewer = screen.getByTestId('mock-staff-viewer');
      const c4 = document.querySelector('[data-midi="60"]') as HTMLElement;

      // Add a note: press and release.
      await act(async () => { fireEvent.mouseDown(c4); });
      await act(async () => { fireEvent.mouseUp(c4); });
      expect(viewer.getAttribute('data-note-count')).toBe('1');

      // Click Clear.
      const btn = screen.getByRole('button', { name: /clear/i });
      await act(async () => { fireEvent.click(btn); });
      expect(viewer.getAttribute('data-note-count')).toBe('0');
    });
  });
});
