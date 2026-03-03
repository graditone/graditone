/**
 * TrainVirtualKeyboard.tsx — Feature 001: Virtual Keyboard in Practice View
 *
 * Renders an interactive two-octave piano keyboard inside the Practice plugin.
 * Mirrors the visual design and interaction model of VirtualKeyboard.tsx but is
 * a self-contained component inside train-view/ to respect the cross-plugin
 * import boundary (R-002).
 *
 * Responsibilities:
 *   - Render piano keys (white + black) for a two-octave range based on octaveShift
 *   - Call props.onKeyDown/onKeyUp so the parent routes notes through the MIDI
 *     scoring pipeline (handleMidiAttackRef — R-003)
 *   - Call context.playNote on every key down AND up unconditionally (FR-006:
 *     always audible, regardless of exercise phase)
 *   - Apply pressed-key visual highlight (FR-007)
 *   - Provide octave Up/Down shift controls within ±2 bounds (FR-008, R-005)
 *   - Suppress synthetic mouse events on mobile via touch/mouse guard (R-008)
 *
 * Constitution Principle VI: this component emits ONLY midiNote integers via
 * props callbacks. It does NOT perform coordinate or layout calculations.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import './TrainVirtualKeyboard.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Width of each white key in px — meets 44 px touch target requirement. */
const WHITE_KEY_WIDTH = 44;

/** Standard 88-key piano: A0 (MIDI 21) → C8 (MIDI 108). */
const PIANO_FIRST_MIDI = 21;
const PIANO_LAST_MIDI  = 108;

/**
 * Milliseconds after a touch event during which synthesised mouse events are
 * ignored.  Prevents double-triggering on mobile browsers.
 */
const TOUCH_GUARD_MS = 500;

/** Semitones that are black keys (within any octave). */
const BLACK_SEMITONE_SET = new Set([1, 3, 6, 8, 10]);

// ---------------------------------------------------------------------------
// Key definition helpers
// ---------------------------------------------------------------------------

interface NoteDefinition {
  midi: number;
  isBlack: boolean;
  /** 0-based global index of the white key immediately left of this black key. */
  whiteKeyBeforeGlobal?: number;
  label: string;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function midiLabel(midi: number): string {
  const name = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

/**
 * Build the standard 88-key piano: A0 (MIDI 21) → C8 (MIDI 108).
 * 52 white keys, 36 black keys.
 */
function buildPianoNotes(): NoteDefinition[] {
  const notes: NoteDefinition[] = [];
  let whiteIndex = 0;
  for (let midi = PIANO_FIRST_MIDI; midi <= PIANO_LAST_MIDI; midi++) {
    const semitone = ((midi % 12) + 12) % 12;
    if (BLACK_SEMITONE_SET.has(semitone)) {
      notes.push({
        midi,
        isBlack: true,
        whiteKeyBeforeGlobal: whiteIndex - 1,
        label: midiLabel(midi),
      });
    } else {
      notes.push({ midi, isBlack: false, label: midiLabel(midi) });
      whiteIndex++;
    }
  }
  return notes;
}

// Pre-computed once — the full 88-key layout never changes.
const PIANO_NOTES       = buildPianoNotes();
const PIANO_WHITE_NOTES = PIANO_NOTES.filter(n => !n.isBlack);
const PIANO_BLACK_NOTES = PIANO_NOTES.filter(n =>  n.isBlack);

// Left-edge pixel of C4 (MIDI 60) within the 88-key layout.
// A0–B0 = 2 white keys, then 3 full octaves (C1–B3) = 21 white keys → C4 is white key index 23.
const C4_LEFT_PX = 23 * WHITE_KEY_WIDTH; // 1012 px

/** Pixel width of one octave (7 white keys). */
const OCTAVE_PX = 7 * WHITE_KEY_WIDTH; // 308 px

/** Total pixel width of the 88-key piano (52 white keys). */
const PIANO_TOTAL_WIDTH = PIANO_WHITE_NOTES.length * WHITE_KEY_WIDTH; // 2288 px

/**
 * Left position (px) of a black key.
 * Centres the key exactly at the boundary between white keys — translateX(-50%)
 * in CSS shifts the rendered box left by half its own width, so
 * `left = (n+1) × WHITE_KEY_WIDTH` places the midpoint on the gap between
 * white key n and white key n+1.
 */
function blackKeyLeft(whiteKeyBeforeGlobal: number): number {
  return (whiteKeyBeforeGlobal + 1) * WHITE_KEY_WIDTH;
}

// ---------------------------------------------------------------------------
// Props contract (matches contracts/input-source.ts)
// ---------------------------------------------------------------------------

export interface TrainVirtualKeyboardProps {
  /** Plugin context — used ONLY for context.playNote (audio). */
  context: {
    playNote: (event: { midiNote: number; timestamp: number; type: 'attack' | 'release' }) => void;
  };
  /** Called when a key is pressed. Parent routes to scoring pipeline. */
  onKeyDown: (midiNote: number, timestamp: number) => void;
  /** Called when a key is released. Parent may use for flow-mode release relay. */
  onKeyUp: (midiNote: number, attackedAt: number) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TrainVirtualKeyboard({ context, onKeyDown, onKeyUp }: TrainVirtualKeyboardProps) {
  // Fixed 88-key piano: A0–C8.
  const whiteNotes = PIANO_WHITE_NOTES;   // 52 white keys
  const blackNotes = PIANO_BLACK_NOTES;   // 36 black keys
  const totalWidth = PIANO_TOTAL_WIDTH;   // 2288 px

  // Octave scroll offset relative to C4 centre. 0 = centred on C4. ±1 = ±1 octave.
  const [octaveShift, setOctaveShift] = useState(0);
  // Measured width of the scroll container (updated by ResizeObserver).
  const [containerWidth, setContainerWidth] = useState(0);

  // Keys currently pressed (for visual highlight — FR-007)
  const [pressedKeys, setPressedKeys] = useState<Set<number>>(new Set());
  // Mirror into ref so cleanup can access without stale closure
  const pressedKeysRef = useRef<Set<number>>(new Set());
  useEffect(() => { pressedKeysRef.current = pressedKeys; }, [pressedKeys]);

  // Attack timestamps: midiNote → Date.now() at press time
  const attackTimestamps = useRef<Map<number, number>>(new Map());

  // Touch/mouse dual-source guard (R-008, matching VirtualKeyboard.tsx)
  const lastTouchTimeRef = useRef<number>(0);

  // isMouseHeldRef: tracks whether primary button is currently down (for slide-play)
  const isMouseHeldRef = useRef(false);

  // Ref to the scrollable wrapper — used by scroll effects and ResizeObserver.
  const scrollRef = useRef<HTMLDivElement>(null);

  // Track container width so scroll and button-disabled state stay in sync.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Scroll to the position that centres C4 + octaveShift whenever either changes.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || containerWidth === 0) return;
    const target = Math.max(0, Math.min(
      C4_LEFT_PX + octaveShift * OCTAVE_PX - containerWidth / 2,
      PIANO_TOTAL_WIDTH - containerWidth,
    ));
    el.scrollTo({ left: target, behavior: octaveShift === 0 ? 'instant' : 'smooth' });
  }, [octaveShift, containerWidth]);

  // Lock orientation to landscape on mobile so the keyboard has maximum width.
  // The Screen Orientation API is not universally supported; failures are silently
  // ignored so desktop browsers and restricted contexts are unaffected.
  useEffect(() => {
    const orient = (screen as unknown as {
      orientation?: { lock?: (o: string) => Promise<void>; unlock?: () => void };
    }).orientation;
    orient?.lock?.('landscape')?.catch(() => {});
    return () => { orient?.unlock?.(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On unmount: release any keys still held (avoids sustained notes after panel close)
  useEffect(() => {
    return () => {
      for (const midi of pressedKeysRef.current) {
        context.playNote({ midiNote: midi, timestamp: Date.now(), type: 'release' });
      }
    };
  // context is stable — intentional empty dep array
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Document-level mouseup: reset isMouseHeldRef when button released outside keyboard
  useEffect(() => {
    const onDocMouseUp = () => { isMouseHeldRef.current = false; };
    document.addEventListener('mouseup', onDocMouseUp);
    return () => document.removeEventListener('mouseup', onDocMouseUp);
  }, []);

  // ---------------------------------------------------------------------------
  // Key down / up handlers (shared by touch and mouse paths)
  // ---------------------------------------------------------------------------

  const handleKeyDown = useCallback((note: NoteDefinition) => {
    // Ignore if already pressed (prevents re-entry during slide-play)
    if (pressedKeysRef.current.has(note.midi)) return;

    const ts = Date.now();
    attackTimestamps.current.set(note.midi, ts);

    // Audio first — unconditional (FR-006: always audible regardless of phase)
    context.playNote({ midiNote: note.midi, timestamp: ts, type: 'attack' });

    // Scoring: parent routes through handleMidiAttackRef (R-003)
    onKeyDown(note.midi, ts);

    setPressedKeys(prev => {
      const next = new Set(prev);
      next.add(note.midi);
      return next;
    });
  }, [context, onKeyDown]);

  const handleKeyUp = useCallback((midi: number) => {
    const attackedAt = attackTimestamps.current.get(midi) ?? Date.now();
    attackTimestamps.current.delete(midi);

    // Audio release — unconditional (FR-006)
    context.playNote({ midiNote: midi, timestamp: Date.now(), type: 'release' });

    // Notify parent (used for flow-mode release relay if needed)
    onKeyUp(midi, attackedAt);

    setPressedKeys(prev => {
      const next = new Set(prev);
      next.delete(midi);
      return next;
    });
  }, [context, onKeyUp]);

  // ---------------------------------------------------------------------------
  // Touch handlers
  // ---------------------------------------------------------------------------

  const handleTouchStart = useCallback((e: React.TouchEvent, note: NoteDefinition) => {
    e.preventDefault();
    lastTouchTimeRef.current = Date.now();
    handleKeyDown(note);
  }, [handleKeyDown]);

  const handleTouchEnd = useCallback((e: React.TouchEvent, midi: number) => {
    e.preventDefault();
    handleKeyUp(midi);
  }, [handleKeyUp]);

  // ---------------------------------------------------------------------------
  // Mouse handlers (guarded against synthesised events after touch)
  // ---------------------------------------------------------------------------

  const handleMouseDown = useCallback((note: NoteDefinition) => {
    if (Date.now() - lastTouchTimeRef.current < TOUCH_GUARD_MS) return;
    isMouseHeldRef.current = true;
    handleKeyDown(note);
  }, [handleKeyDown]);

  const handleMouseUp = useCallback((midi: number) => {
    if (Date.now() - lastTouchTimeRef.current < TOUCH_GUARD_MS) return;
    isMouseHeldRef.current = false;
    handleKeyUp(midi);
  }, [handleKeyUp]);

  const handleMouseLeave = useCallback((midi: number) => {
    if (Date.now() - lastTouchTimeRef.current < TOUCH_GUARD_MS) return;
    if (!isMouseHeldRef.current) return;
    handleKeyUp(midi);
  }, [handleKeyUp]);

  const handleMouseEnter = useCallback((note: NoteDefinition) => {
    if (Date.now() - lastTouchTimeRef.current < TOUCH_GUARD_MS) return;
    if (!isMouseHeldRef.current) return;
    handleKeyDown(note);
  }, [handleKeyDown]);

  // ---------------------------------------------------------------------------
  // Octave scroll controls
  // ---------------------------------------------------------------------------

  const shiftDown = useCallback(() => setOctaveShift(s => s - 1), []);
  const shiftUp   = useCallback(() => setOctaveShift(s => s + 1), []);

  // Compute the clamped scrollLeft for the current shift so we can derive
  // whether the buttons should be disabled without reading the DOM.
  const targetScrollLeft = containerWidth > 0
    ? Math.max(0, Math.min(
        C4_LEFT_PX + octaveShift * OCTAVE_PX - containerWidth / 2,
        PIANO_TOTAL_WIDTH - containerWidth,
      ))
    : C4_LEFT_PX;
  const atLeftEdge  = targetScrollLeft <= 0;
  const atRightEdge = containerWidth > 0 && targetScrollLeft + containerWidth >= PIANO_TOTAL_WIDTH;

  // Range label: show the C note closest to the centre of the visible area.
  const centreOctave = 4 + octaveShift;
  const rangeLabel = `C${centreOctave - 1}–C${centreOctave + 1}`;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="train-vkb" data-testid="train-vkb" role="group" aria-label="Virtual piano keyboard">
      {/* Hidden label — consumed by screen readers and unit tests */}
      <span
        className="train-vkb__range-label--sr"
        aria-live="polite"
        data-testid="vkb-range-label"
      >
        {rangeLabel}
      </span>

      {/* Oct− button — left of keyboard */}
      <button
        className="train-vkb__octave-btn"
        onClick={shiftDown}
        disabled={atLeftEdge}
        aria-label="Scroll keyboard left one octave"
        data-testid="vkb-octave-down"
      >
        ◀
      </button>

      {/* Keyboard (scrollable, centred on C4+shift) */}
      <div className="train-vkb__scroll" ref={scrollRef}>
        <div
          className="train-vkb__keyboard"
          style={{ width: `${totalWidth}px` }}
          data-testid="train-vkb-keyboard"
        >
          {/* White keys (z-index 1) */}
          {whiteNotes.map(note => (
            <div
              key={note.midi}
              className={`train-vkb__key train-vkb__key--white${pressedKeys.has(note.midi) ? ' train-vkb__key--pressed' : ''}`}
              data-midi={note.midi}
              data-testid={`vkb-key-${note.midi}`}
              onMouseDown={() => handleMouseDown(note)}
              onMouseUp={() => handleMouseUp(note.midi)}
              onMouseLeave={() => handleMouseLeave(note.midi)}
              onMouseEnter={() => handleMouseEnter(note)}
              onTouchStart={e => handleTouchStart(e, note)}
              onTouchEnd={e => handleTouchEnd(e, note.midi)}
              onContextMenu={e => e.preventDefault()}
              role="button"
              aria-label={note.label}
              aria-pressed={pressedKeys.has(note.midi)}
            >
              {/* Show octave C note label */}
              {note.label.startsWith('C') && !note.label.startsWith('C#') ? note.label : ''}
            </div>
          ))}

          {/* Black keys (z-index 2, absolutely positioned) */}
          {blackNotes.map(note => (
            <div
              key={note.midi}
              className={`train-vkb__key train-vkb__key--black${pressedKeys.has(note.midi) ? ' train-vkb__key--pressed' : ''}`}
              data-midi={note.midi}
              data-testid={`vkb-key-${note.midi}`}
              style={{ left: `${blackKeyLeft(note.whiteKeyBeforeGlobal!)}px` }}
              onMouseDown={() => handleMouseDown(note)}
              onMouseUp={() => handleMouseUp(note.midi)}
              onMouseLeave={() => handleMouseLeave(note.midi)}
              onMouseEnter={() => handleMouseEnter(note)}
              onTouchStart={e => handleTouchStart(e, note)}
              onTouchEnd={e => handleTouchEnd(e, note.midi)}
              onContextMenu={e => e.preventDefault()}
              role="button"
              aria-label={note.label}
              aria-pressed={pressedKeys.has(note.midi)}
            />
          ))}
        </div>
      </div>

      {/* Oct+ button — right of keyboard */}
      <button
        className="train-vkb__octave-btn"
        onClick={shiftUp}
        disabled={atRightEdge}
        aria-label="Scroll keyboard right one octave"
        data-testid="vkb-octave-up"
      >
        ▶
      </button>
    </div>
  );
}
