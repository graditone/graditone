/**
 * PluginStaffViewer — Host-side notation staff component for plugins
 * Feature 030: Plugin Architecture
 *
 * Injected into every PluginContext as `context.components.StaffViewer`.
 * Plugins render this component to display their played notes on a live
 * notation staff — no direct access to the notation engine is needed.
 *
 * Architecture:
 *   PluginNoteEvent[]  →  toNotes()  →  Note[]
 *   Note[]  →  NotationLayoutEngine.calculateLayout()  →  LayoutGeometry
 *   LayoutGeometry  →  NotationRenderer  →  SVG staff
 *
 * Auto-scroll:
 *   When `autoScroll={true}`, the container scrolls right after every new note
 *   so the latest note stays visible.  A `useEffect` on `staffNotes.length`
 *   fires `container.scrollLeft = container.scrollWidth` after React paints.
 *   The live `scrollX` offset is fed back into the layout engine so only the
 *   visible slice of the score is computed (matching the main app strategy).
 *
 * This file is HOST code (src/), not plugin code.  It may freely import from
 * the rest of src/ — the no-restricted-imports ESLint rule only applies to
 * files under plugins/.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NotationLayoutEngine } from '../services/notation/NotationLayoutEngine';
import { NotationRenderer } from '../components/notation/NotationRenderer';
import { DEFAULT_STAFF_CONFIG } from '../types/notation/config';
import type { Note, ClefType } from '../types/score';
import type { PluginNoteEvent, PluginStaffViewerProps } from './types';
import { computeLayout } from '../wasm/layout';
import { initWasm } from '../services/wasm/loader';
import { ScoreViewer, LABEL_MARGIN } from '../pages/ScoreViewer';
import type { GlobalLayout } from '../wasm/layout';
import { buildSpellingTable } from './pitchSpelling';

// ---------------------------------------------------------------------------
// MIDI-event → Note conversion
// ---------------------------------------------------------------------------

/**
 * Duration mapping for a touch keyboard (NOT BPM-proportional):
 *
 * On a touchscreen, a natural "tap" lasts ~80–200 ms regardless of tempo.
 * Using a BPM ratio (500 ms = quarter at 120 BPM) means every tap maps to a
 * sixteenth — not what the user expects.  Instead we use intuitive thresholds:
 *
 *   tap   < 300 ms  →  quarter  (480 ticks)  — normal press
 *   hold  < 800 ms  →  half     (960 ticks)  — deliberate hold
 *   hold  ≥ 800 ms  →  whole    (1920 ticks) — long hold
 *
 * Eighth and sixteenth are intentionally excluded: physical tap duration on
 * glass cannot reliably distinguish them from a quarter.
 */
const QUARTER_TICKS = 480;

import { msToDurationTicks } from './staffViewerUtils';

/** Fallback visual span when no duration is known (quarter note). */
const DEFAULT_TICK_STEP = QUARTER_TICKS;

/**
 * Filters attack events from `events` and converts them to the `Note` format
 * expected by `NotationLayoutEngine`.  Notes are laid out left-to-right in the
 * order they appear in the array.  `durationMs` is used to compute the correct
 * note value; events without `durationMs` default to a quarter note.
 */
function toNotes(events: readonly PluginNoteEvent[]): Note[] {
  const attacks = events.filter(e => !e.type || e.type === 'attack');
  let tick = 0;
  return attacks.map((e, i) => {
    const durationTicks = e.durationMs != null
      ? msToDurationTicks(e.durationMs)
      : DEFAULT_TICK_STEP;
    const note: Note = {
      id: `plugin-note-${i}-${e.midiNote}`,
      start_tick: tick,
      duration_ticks: durationTicks,
      pitch: e.midiNote,
    };
    tick += durationTicks;
    return note;
  });
}

// Fixed height; width is measured from the container at runtime.
const VIEWER_HEIGHT = 160;
const VIEWER_WIDTH_FALLBACK = 800;

// Throttle layout recalculations to every 200 px of scroll (mirrors StaffNotation strategy).
const SCROLL_THROTTLE = 200;

// Quarter notes in 960 PPQ — matches Rust layout engine expectation.
const WASM_QUARTER_TICKS = 960;

/**
 * Convert PluginNoteEvent[] to the ConvertedScore shape expected by computeLayout.
 * Note timestamps are treated as ms-from-exercise-start; with the given BPM they
 * are converted to 960 PPQ tick positions for tick-accurate layout.
 */
function toConvertedScore(events: readonly PluginNoteEvent[], clef: string, bpm: number, timestampOffset = 0, keySignature = 0) {
  const msPerBeat = 60_000 / bpm;
  const attacks = events.filter(e => !e.type || e.type === 'attack');
  const spellingTable = buildSpellingTable(keySignature);
  return {
    instruments: [{
      id: 'practice',
      name: '',
      staves: [{
        clef,
        time_signature: { numerator: 4, denominator: 4 },
        key_signature: { sharps: keySignature },
        voices: [{
          notes: attacks.map((e) => {
            const sp = spellingTable[e.midiNote % 12];
            return {
              tick: Math.max(0, Math.round(((e.timestamp - timestampOffset) / msPerBeat) * WASM_QUARTER_TICKS)),
              duration: Math.max(1, Math.round(((e.durationMs ?? msPerBeat) / msPerBeat) * WASM_QUARTER_TICKS)),
              pitch: e.midiNote,
              articulation: null,
              spelling: { step: sp.step, alter: sp.alter },
            };
          }),
        }],
      }],
    }],
    tempo_changes: [],
    time_signature_changes: [],
  };
}

/**
 * Build sourceToNoteIdMap and pitchToNoteIds from the WASM layout output.
 * Mirrors the system-local event_index scheme used by buildSourceToNoteIdMap.
 */
function buildPluginSourceMap(
  events: readonly PluginNoteEvent[],
  layout: GlobalLayout,
  bpm: number,
  timestampOffset: number,
): { sourceToNoteIdMap: Map<string, string>; pitchToNoteIds: Map<number, string[]> } {
  const sourceToNoteIdMap = new Map<string, string>();
  const pitchToNoteIds = new Map<number, string[]>();
  const msPerBeat = 60_000 / bpm;
  const attacks = events.filter(e => !e.type || e.type === 'attack');
  const ticks = attacks.map(e =>
    Math.max(0, Math.round(((e.timestamp - timestampOffset) / msPerBeat) * WASM_QUARTER_TICKS))
  );
  for (const system of layout.systems) {
    const { start_tick, end_tick } = system.tick_range;
    let localIdx = 0;
    attacks.forEach((attack, globalIdx) => {
      const tick = ticks[globalIdx];
      if (tick >= start_tick && tick < end_tick) {
        const noteId = `pnote-${globalIdx}-${attack.midiNote}`;
        const key = `${system.index}/practice/0/0/${localIdx}`;
        sourceToNoteIdMap.set(key, noteId);
        const list = pitchToNoteIds.get(attack.midiNote) ?? [];
        list.push(noteId);
        pitchToNoteIds.set(attack.midiNote, list);
        localIdx++;
      }
    });
  }
  return { sourceToNoteIdMap, pitchToNoteIds };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * PluginStaffViewer
 *
 * Renders a scrollable notation staff from an ordered list of `PluginNoteEvent`s.
 * Currently pressed keys (supplied via `highlightedNotes`) are shown with a
 * filled accent colour.  When `autoScroll` is true the viewport tracks the
 * latest note on every new keypress.
 *
 * @example
 * ```tsx
 * <context.components.StaffViewer
 *   notes={recordedNotes}
 *   highlightedNotes={[...pressedKeys]}
 *   clef="Treble"
 *   autoScroll
 * />
 * ```
 */
export const PluginStaffViewer: React.FC<PluginStaffViewerProps> = ({
  notes,
  highlightedNotes = [],
  clef = 'Treble',
  autoScroll = false,
  bpm,
  timestampOffset = 0,
  highlightedNoteIndex,
  keySignature = 0,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // ── WASM path: container ref + width measurement ──────────────────────────
  const wasmContainerRef = useRef<HTMLDivElement>(null);
  const [wasmContainerWidth, setWasmContainerWidth] = useState(VIEWER_WIDTH_FALLBACK);

  useEffect(() => {
    const el = wasmContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      setWasmContainerWidth(el.clientWidth || VIEWER_WIDTH_FALLBACK)
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── WASM path hooks (always run — bpm guard is inside the effect) ─────────
  const [wasmLayout, setWasmLayout] = useState<GlobalLayout | null>(null);

  useEffect(() => {
    if (bpm == null) return;
    let cancelled = false;
    (async () => {
      if (notes.length === 0) {
        if (!cancelled) setWasmLayout(null);
        return;
      }
      try {
        await initWasm();
        const score = toConvertedScore(notes, clef, bpm, timestampOffset, keySignature);
        // Convert CSS px width to layout units (BASE_SCALE = 0.5, so layout units = px * 2)
        // Subtract LABEL_MARGIN so the rendered content fits the container exactly.
        const maxSystemWidth = Math.max(400, wasmContainerWidth * 2 - LABEL_MARGIN);
        const layout = await computeLayout(score, {
          max_system_width: maxSystemWidth,
          system_height: 200,
          system_spacing: 0,
          units_per_space: 20,
        });
        if (!cancelled) setWasmLayout(layout);
      } catch {
        if (!cancelled) setWasmLayout(null);
      }
    })();
    return () => { cancelled = true; };
  }, [notes, clef, bpm, timestampOffset, keySignature, wasmContainerWidth]);

  // Build source map + pitch→noteId index for highlighting (WASM path)
  const { sourceToNoteIdMap: pluginSourceMap } = useMemo(() => {
    if (bpm == null || wasmLayout == null) {
      return { sourceToNoteIdMap: new Map<string, string>() };
    }
    return buildPluginSourceMap(notes, wasmLayout, bpm, timestampOffset);
  }, [notes, wasmLayout, bpm, timestampOffset]);

  const highlightedNoteIdsForWasm = useMemo(() => {
    if (bpm == null || highlightedNoteIndex == null) return undefined;
    const attacks = notes.filter(e => !e.type || e.type === 'attack');
    const note = attacks[highlightedNoteIndex];
    if (!note) return undefined;
    return new Set([`pnote-${highlightedNoteIndex}-${note.midiNote}`]);
  }, [notes, bpm, highlightedNoteIndex]);

  // ── JS path hooks (always run — results unused when bpm is set) ───────────
  const [scrollX, setScrollX] = useState(0);
  const staffNotes = useMemo(() => toNotes(notes), [notes]);

  const highlightedNoteIds = useMemo(() => {
    if (highlightedNotes.length === 0) return [];
    const midiSet = new Set(highlightedNotes);
    const seen = new Set<number>();
    const ids: string[] = [];
    for (let i = staffNotes.length - 1; i >= 0; i--) {
      const n = staffNotes[i];
      if (midiSet.has(n.pitch) && !seen.has(n.pitch)) {
        ids.push(n.id);
        seen.add(n.pitch);
      }
    }
    return ids;
  }, [staffNotes, highlightedNotes]);

  const [viewportWidth, setViewportWidth] = useState(VIEWER_WIDTH_FALLBACK);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewportWidth(el.clientWidth || VIEWER_WIDTH_FALLBACK));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scrollXThrottled = useMemo(
    () => Math.round(scrollX / SCROLL_THROTTLE) * SCROLL_THROTTLE,
    [scrollX],
  );

  const jsLayout = useMemo(() => {
    return NotationLayoutEngine.calculateLayout({
      notes: staffNotes,
      clef: clef as ClefType,
      timeSignature: { numerator: 4, denominator: 4 },
      config: {
        ...DEFAULT_STAFF_CONFIG,
        viewportWidth,
        viewportHeight: VIEWER_HEIGHT,
        scrollX: scrollXThrottled,
      },
    });
  }, [staffNotes, clef, viewportWidth, scrollXThrottled]);

  useEffect(() => {
    if (!autoScroll || !containerRef.current) return;
    const el = containerRef.current;
    let raf2: number;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const target = el.scrollWidth - el.clientWidth;
        el.scrollLeft = target;
        setScrollX(target);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [staffNotes.length, autoScroll]);

  const handleScroll = () => {
    if (containerRef.current) setScrollX(containerRef.current.scrollLeft);
  };

  // ── Conditional rendering ─────────────────────────────────────────────────
  if (bpm != null) {
    return (
      <div
        ref={wasmContainerRef}
        data-testid="plugin-staff-viewer"
        style={{
          width: '100%',
          overflowX: 'hidden',
          overflowY: 'hidden',
          border: '1px solid #e0e0e0',
          borderRadius: 4,
          backgroundColor: '#ffffff',
          marginBottom: 12,
          minHeight: wasmLayout == null ? 100 : undefined,
        }}
      >
        {wasmLayout != null && (
          <ScoreViewer
            layout={wasmLayout}
            hideMeasureNumbers
            highlightedNoteIds={highlightedNoteIdsForWasm}
            sourceToNoteIdMap={pluginSourceMap}
          />
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-testid="plugin-staff-viewer"
      onScroll={handleScroll}
      style={{
        width: '100%',
        overflowX: 'auto',
        border: '1px solid #e0e0e0',
        borderRadius: 4,
        backgroundColor: '#ffffff',
        marginBottom: 12,
      }}
    >
      <NotationRenderer
        layout={jsLayout}
        highlightedNoteIds={highlightedNoteIds}
      />
    </div>
  );
};
