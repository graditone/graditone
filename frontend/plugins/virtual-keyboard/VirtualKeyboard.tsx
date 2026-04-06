/**
 * VirtualKeyboard component — Feature 030: Plugin Architecture (US1)
 *
 * Renders an interactive two-octave piano keyboard (C3–B4).
 * On key press: calls context.playNote() (audio via host ToneAdapter) and
 * context.emitNote() (note data for the WASM layout pipeline), and records
 * the played note for on-screen display above the keyboard.
 *
 * Audio is intentionally routed through the Plugin API (context.playNote /
 * context.emitNote) — this component must NOT import Tone.js or the Web Audio
 * API directly. The host owns the audio engine.
 *
 * Constitution Principle VI: this component emits ONLY midiNote integers via
 * the Plugin API. It does NOT perform any coordinate or layout calculations;
 * those are delegated to the WASM engine through the host's note pipeline.
 *
 * Accessibility: ARIA roles + keyboard navigation are out of scope for US1.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { PluginContext, PluginNoteEvent } from '../../src/plugin-api/index';
import './VirtualKeyboard.css';
import { useTranslation } from '../../src/i18n';

// ---------------------------------------------------------------------------
// Note definitions
// ---------------------------------------------------------------------------

interface NoteDefinition {
  midi: number;
  isBlack: boolean;
  /** Only set for black keys: the 0-based index of the white key it follows */
  whiteKeyBefore?: number;
  /** Short label, e.g. "C4", "C#4" */
  label: string;
}

const WHITE_KEY_WIDTH = 44; // px — meets 44px touch target requirement

// Default BPM used for Rust layout engine tick conversion on free-play staff.
// Notes are offset relative to the first note's timestamp so the first note
// always lands on beat 1.  120 BPM is the conventional default tempo.
const DEFAULT_BPM = 120;

/**
 * Two octaves: C3 (MIDI 48) → B4 (MIDI 71)
 * White keys: 14 total (7 per octave)
 * Black keys: 10 total (5 per octave)
 */
const NOTES: NoteDefinition[] = [
  // Octave 3
  { midi: 48, isBlack: false, label: 'C3' },
  { midi: 49, isBlack: true,  whiteKeyBefore: 0,  label: 'C#3' },
  { midi: 50, isBlack: false, label: 'D3' },
  { midi: 51, isBlack: true,  whiteKeyBefore: 1,  label: 'D#3' },
  { midi: 52, isBlack: false, label: 'E3' },
  { midi: 53, isBlack: false, label: 'F3' },
  { midi: 54, isBlack: true,  whiteKeyBefore: 3,  label: 'F#3' },
  { midi: 55, isBlack: false, label: 'G3' },
  { midi: 56, isBlack: true,  whiteKeyBefore: 4,  label: 'G#3' },
  { midi: 57, isBlack: false, label: 'A3' },
  { midi: 58, isBlack: true,  whiteKeyBefore: 5,  label: 'A#3' },
  { midi: 59, isBlack: false, label: 'B3' },
  // Octave 4
  { midi: 60, isBlack: false, label: 'C4' },
  { midi: 61, isBlack: true,  whiteKeyBefore: 7,  label: 'C#4' },
  { midi: 62, isBlack: false, label: 'D4' },
  { midi: 63, isBlack: true,  whiteKeyBefore: 8,  label: 'D#4' },
  { midi: 64, isBlack: false, label: 'E4' },
  { midi: 65, isBlack: false, label: 'F4' },
  { midi: 66, isBlack: true,  whiteKeyBefore: 10, label: 'F#4' },
  { midi: 67, isBlack: false, label: 'G4' },
  { midi: 68, isBlack: true,  whiteKeyBefore: 11, label: 'G#4' },
  { midi: 69, isBlack: false, label: 'A4' },
  { midi: 70, isBlack: true,  whiteKeyBefore: 12, label: 'A#4' },
  { midi: 71, isBlack: false, label: 'B4' },
];

const WHITE_NOTES = NOTES.filter(n => !n.isBlack);
const BLACK_NOTES = NOTES.filter(n => n.isBlack);

/** Calculate the absolute left position for a black key (in px). */
function blackKeyLeft(note: NoteDefinition): number {
  // Centre the black key at 65% from the left edge of its preceding white key.
  return (note.whiteKeyBefore! * WHITE_KEY_WIDTH) + (0.65 * WHITE_KEY_WIDTH);
}

// Maximum displayed notes before oldest are dropped from the on-screen list
const MAX_DISPLAYED_NOTES = 20;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface VirtualKeyboardProps {
  context: PluginContext;
}

export function VirtualKeyboard({ context }: VirtualKeyboardProps) {
  const { t } = useTranslation();
  const [pressedKeys, setPressedKeys] = useState<Set<number>>(new Set());
  // Played notes as PluginNoteEvents — fed to the staff viewer.
  // Notes are appended on key-release so durationMs is always known.
  const [playedNotes, setPlayedNotes] = useState<PluginNoteEvent[]>([]);
  // The MIDI note most recently committed to the staff (set on each key release).
  // Passed to StaffViewer as `highlightedNotes` so only the just-added note is
  // accented, not all past occurrences of the same pitch.
  const [lastReleasedMidi, setLastReleasedMidi] = useState<number | null>(null);

  // Timestamp of the first played note — used as the origin for WASM tick
  // conversion so the initial note always lands at tick 0.
  const timestampOffset = useMemo(() => {
    const first = playedNotes.find(e => !e.type || e.type === 'attack');
    return first ? first.timestamp : 0;
  }, [playedNotes]);

  // Index of the most recently released note for WASM-path highlighting.
  // The WASM path uses highlightedNoteIndex (not highlightedNotes pitches).
  const highlightedNoteIndex = useMemo(() => {
    const count = playedNotes.filter(e => !e.type || e.type === 'attack').length;
    return count > 0 ? count - 1 : undefined;
  }, [playedNotes]);

  // ------------------------------------------------------------------

  // Mirror pressedKeys into a ref so the unmount cleanup can read the latest
  // value without capturing a stale closure.
  const pressedKeysRef = useRef<Set<number>>(new Set());
  useEffect(() => { pressedKeysRef.current = pressedKeys; }, [pressedKeys]);

  // Track when each MIDI key was pressed (midiNote → Date.now()) so we can
  // calculate durationMs when the key is released.
  const attackTimestamps = useRef<Map<number, number>>(new Map());

  // --------------------------------------------------------------------------
  // Touch / mouse dual-source guard
  //
  // On mobile browsers, a touchstart fires our touch handler, then — after
  // ~300 ms — the browser synthesises mousedown/mouseup.  Without this guard,
  // two notes would be added on every short tap.
  //
  // Strategy: record the last touch event time and skip any mouse handler that
  // fires within 500 ms of it.
  // --------------------------------------------------------------------------
  const lastTouchTimeRef = useRef<number>(0);
  const TOUCH_GUARD_MS = 500;

  // On unmount (e.g. Back button): release any notes that are still held down.
  // Without this a sustained note keeps playing after the component is gone.
  useEffect(() => {
    return () => {
      for (const midi of pressedKeysRef.current) {
        context.playNote({ midiNote: midi, timestamp: Date.now(), type: 'release' });
      }
    };
  // context is stable (created once in App loadPlugins), intentional empty-dep.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --------------------------------------------------------------------------
  // Key down / up handlers (shared between touch and mouse)
  // --------------------------------------------------------------------------

  const handleKeyDown = useCallback(
    (note: NoteDefinition) => {
      // Audio playback via Plugin API — host routes through ToneAdapter (Salamander piano)
      context.playNote({ midiNote: note.midi, timestamp: Date.now(), type: 'attack' });
      // Note data to WASM layout pipeline
      context.emitNote({ midiNote: note.midi, timestamp: Date.now() });
      // Record the attack time for duration calculation on release.
      attackTimestamps.current.set(note.midi, Date.now());

      setPressedKeys(prev => {
        const next = new Set(prev);
        next.add(note.midi);
        return next;
      });
      // Note is NOT appended to playedNotes here — it is appended on release
      // so that durationMs can be included.
    },
    [context]
  );

  const handleKeyUp = useCallback((midi: number) => {
    // Release the sustained note through the Plugin API
    context.playNote({ midiNote: midi, timestamp: Date.now(), type: 'release' });

    // Calculate how long the key was held.
    const attackedAt = attackTimestamps.current.get(midi);
    const durationMs = attackedAt != null ? Date.now() - attackedAt : undefined;
    attackTimestamps.current.delete(midi);

    // Append to the staff viewer — now with the measured duration.
    setLastReleasedMidi(midi);
    setPlayedNotes(prev => {
      const event: PluginNoteEvent = {
        midiNote: midi,
        timestamp: attackedAt ?? Date.now(),
        durationMs,
      };
      const next = [...prev, event];
      return next.length > MAX_DISPLAYED_NOTES ? next.slice(-MAX_DISPLAYED_NOTES) : next;
    });

    setPressedKeys(prev => {
      const next = new Set(prev);
      next.delete(midi);
      return next;
    });
  }, [context]);

  // --------------------------------------------------------------------------
  // Touch handlers
  //
  // e.preventDefault() on touchStart:
  //   - prevents the browser from synthesising mousedown/click events
  //   - prevents the iOS long-press "Save Image / Copy" callout
  //   - prevents scrolling while playing individual keys
  //
  // e.preventDefault() on touchEnd:
  //   - suppresses any residual synthetic mouse events (mouseup, click) that
  //     some browsers still emit even when touchStart was prevented
  // --------------------------------------------------------------------------
  const handleTouchStart = useCallback(
    (e: React.TouchEvent, note: NoteDefinition) => {
      e.preventDefault();
      lastTouchTimeRef.current = Date.now();
      handleKeyDown(note);
    },
    [handleKeyDown]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent, midi: number) => {
      e.preventDefault();
      handleKeyUp(midi);
    },
    [handleKeyUp]
  );

  // --------------------------------------------------------------------------
  // Mouse handlers — guarded to ignore events synthesised from touch
  //
  // isMouseHeldRef tracks whether the primary mouse button is currently down.
  // This prevents notes from sounding when the cursor merely hovers over keys
  // without a click, while still allowing intentional slide-playing (drag
  // across keys with button held).  A document-level mouseup listener resets
  // the flag when the button is released anywhere outside the keyboard.
  // --------------------------------------------------------------------------
  const isMouseHeldRef = useRef(false);

  useEffect(() => {
    const onDocMouseUp = () => { isMouseHeldRef.current = false; };
    document.addEventListener('mouseup', onDocMouseUp);
    return () => document.removeEventListener('mouseup', onDocMouseUp);
  }, []);

  const handleMouseDown = useCallback(
    (note: NoteDefinition) => {
      if (Date.now() - lastTouchTimeRef.current < TOUCH_GUARD_MS) return;
      isMouseHeldRef.current = true;
      handleKeyDown(note);
    },
    [handleKeyDown]
  );

  const handleMouseUp = useCallback(
    (midi: number) => {
      if (Date.now() - lastTouchTimeRef.current < TOUCH_GUARD_MS) return;
      isMouseHeldRef.current = false;
      handleKeyUp(midi);
    },
    [handleKeyUp]
  );

  // Only release the note when the cursor leaves while the button is held — a
  // pure hover-out (button not pressed) means no note was playing from mouse.
  const handleMouseLeave = useCallback(
    (midi: number) => {
      if (Date.now() - lastTouchTimeRef.current < TOUCH_GUARD_MS) return;
      if (!isMouseHeldRef.current) return;
      handleKeyUp(midi);
    },
    [handleKeyUp]
  );

  // Slide-to-play: when the cursor enters a key while the button is already
  // held (drag), sound that key.  Pure hover (button up) is silenced by the
  // isMouseHeldRef guard.
  const handleMouseEnter = useCallback(
    (note: NoteDefinition) => {
      if (Date.now() - lastTouchTimeRef.current < TOUCH_GUARD_MS) return;
      if (!isMouseHeldRef.current) return;
      handleKeyDown(note);
    },
    [handleKeyDown]
  );

  // --------------------------------------------------------------------------
  // MIDI hardware keyboard integration
  //
  // Subscribes to note events from any connected MIDI device via the Plugin API.
  // Pressing a physical key simulates the same flow as a mouse/touch press:
  //   attack  → handleKeyDown (visual highlight + audio + staff note on release)
  //   release → handleKeyUp   (audio release + note committed to staff)
  //
  // Only notes within the keyboard range (C3–B4, MIDI 48–71) are acted on;
  // out-of-range MIDI notes are ignored rather than clamped.
  // --------------------------------------------------------------------------
  useEffect(() => {
    return context.midi.subscribe((event) => {
      if (event.type === 'release') {
        handleKeyUp(event.midiNote);
      } else {
        const note = NOTES.find(n => n.midi === event.midiNote);
        if (note) handleKeyDown(note);
      }
    });
  }, [context, handleKeyDown, handleKeyUp]);

  const totalWidth = WHITE_NOTES.length * WHITE_KEY_WIDTH;

  return (
    <div className="virtual-keyboard">
      <h2 className="virtual-keyboard__title">{t('vkeyboard.title')}</h2>

      {/* Staff header: title + clear button */}
      <div className="virtual-keyboard__staff-header">
        <span className="virtual-keyboard__staff-label">{t('vkeyboard.staff')}</span>
        <button
          className="virtual-keyboard__clear-btn"
          onClick={() => setPlayedNotes([])}
          aria-label={t('vkeyboard.clear_aria')}
        >
          {t('vkeyboard.clear')}
        </button>
      </div>

      {/* Staff view — shows played notes as notation above the keyboard */}
      {/* onContextMenu suppresses the iOS/Android long-press OS menu on the SVG */}
      <div
        className="virtual-keyboard__staff-area"
        onContextMenu={e => e.preventDefault()}
      >
        <context.components.StaffViewer
          notes={playedNotes}
          highlightedNotes={lastReleasedMidi !== null ? [lastReleasedMidi] : []}
          highlightedNoteIndex={highlightedNoteIndex}
          clef="Treble"
          bpm={DEFAULT_BPM}
          timestampOffset={timestampOffset}
          autoScroll
        />
      </div>

      {/* Keyboard (scrollable on narrow screens) */}
      <div className="virtual-keyboard__scroll">
        <div className="keyboard" style={{ width: `${totalWidth}px` }}>
          {/* White keys first (z-index 1) */}
          {WHITE_NOTES.map(note => (
            <div
              key={note.midi}
              className={`key key--white${pressedKeys.has(note.midi) ? ' key--pressed' : ''}`}
              data-midi={note.midi}
              onMouseDown={() => handleMouseDown(note)}
              onMouseUp={() => handleMouseUp(note.midi)}
              onMouseLeave={() => handleMouseLeave(note.midi)}
              onMouseEnter={() => handleMouseEnter(note)}
              onTouchStart={e => handleTouchStart(e, note)}
              onTouchEnd={e => handleTouchEnd(e, note.midi)}
              onContextMenu={e => e.preventDefault()}
              role="button"
              aria-label={note.label}
            >
              {note.label.startsWith('C') ? note.label : ''}
            </div>
          ))}

          {/* Black keys last (z-index 2, absolutely positioned) */}
          {BLACK_NOTES.map(note => (
            <div
              key={note.midi}
              className={`key key--black${pressedKeys.has(note.midi) ? ' key--pressed' : ''}`}
              data-midi={note.midi}
              style={{ left: `${blackKeyLeft(note)}px` }}
              onMouseDown={() => handleMouseDown(note)}
              onMouseUp={() => handleMouseUp(note.midi)}
              onMouseLeave={() => handleMouseLeave(note.midi)}
              onMouseEnter={() => handleMouseEnter(note)}
              onTouchStart={e => handleTouchStart(e, note)}
              onTouchEnd={e => handleTouchEnd(e, note.midi)}
              onContextMenu={e => e.preventDefault()}
              role="button"
              aria-label={note.label}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
