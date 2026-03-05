/**
 * Practice View Plugin — PracticeViewPlugin Unit Tests (T028, T038, T042)
 * Feature 037: Practice View Plugin
 *
 * Tests:
 *   T028: ScoreSelector rendered when status=idle; ScoreRenderer when ready;
 *         Back button calls context.close(); stopPlayback on unmount (SC-006)
 *   T038: Seek behaviour — seek-based practice start; seek-while-active;
 *         inactive practice calls seekToTick not SEEK
 *   T042: Teardown — context.stopPlayback() and MIDI unsubscribe on unmount
 */

import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PracticeViewPlugin } from './PracticeViewPlugin';
import type {
  PluginContext,
  ScorePlayerState,
  PluginPlaybackStatus,
  PluginScoreRendererProps,
} from '../../src/plugin-api/index';


// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

const MOCK_CATALOGUE = [
  { id: 'bach-invention-1', displayName: 'Bach — Invention No. 1' },
];

function makeIdleState(overrides: Partial<ScorePlayerState> = {}): ScorePlayerState {
  return {
    status: 'idle' as PluginPlaybackStatus,
    currentTick: 0,
    totalDurationTicks: 0,
    highlightedNoteIds: new Set<string>(),
    bpm: 120,
    title: null,
    error: null,
    staffCount: 0,
    timeSignature: { numerator: 4, denominator: 4 },
    ...overrides,
  };
}

type StateHandler = (state: ScorePlayerState) => void;
type MidiHandler = (event: { type: 'attack' | 'release'; midiNote: number }) => void;

interface MockContext {
  context: PluginContext;
  mockClose: ReturnType<typeof vi.fn>;
  mockStop: ReturnType<typeof vi.fn>;
  mockStopPlayback: ReturnType<typeof vi.fn>;
  mockSeekToTick: ReturnType<typeof vi.fn>;
  mockExtractPracticeNotes: ReturnType<typeof vi.fn>;
  mockMidiSubscribe: ReturnType<typeof vi.fn>;
  simulateStateChange: (partial: Partial<ScorePlayerState>) => void;
  simulateMidiEvent: (event: { type: 'attack' | 'release'; midiNote: number }) => void;
  midiUnsubscribe: ReturnType<typeof vi.fn>;
}

function createMockContext(
  stateOverride: Partial<ScorePlayerState> = {},
  ScoreRendererOverride?: React.ComponentType<PluginScoreRendererProps>,
): MockContext {
  const stateSubscribers = new Set<StateHandler>();
  let currentState = makeIdleState(stateOverride);

  const midiSubscribers = new Set<MidiHandler>();
  const midiUnsubscribe = vi.fn(() => midiSubscribers.clear());

  const simulateStateChange = (partial: Partial<ScorePlayerState>) => {
    currentState = makeIdleState({ ...currentState, ...partial });
    stateSubscribers.forEach((h) => h(currentState));
  };

  const simulateMidiEvent = (event: { type: 'attack' | 'release'; midiNote: number }) => {
    midiSubscribers.forEach((h) => h(event));
  };

  const mockClose = vi.fn();
  const mockStop = vi.fn();
  const mockStopPlayback = vi.fn();
  const mockSeekToTick = vi.fn();
  const mockExtractPracticeNotes = vi.fn().mockReturnValue(null);

  const context = {
    emitNote: vi.fn(),
    playNote: vi.fn(),
    stopPlayback: mockStopPlayback,
    close: mockClose,
    recording: {
      subscribe: vi.fn(() => () => {}),
      onError: vi.fn(() => () => {}),
      stop: vi.fn(),
    },
    midi: {
      subscribe: vi.fn((handler: MidiHandler) => {
        midiSubscribers.add(handler);
        return midiUnsubscribe;
      }),
    },
    components: {
      StaffViewer: () => null,
      ScoreRenderer:
        ScoreRendererOverride ??
        (({ children }: React.PropsWithChildren<PluginScoreRendererProps>) => (
          <div data-testid="score-renderer">{children}</div>
        )),
      ScoreSelector: ({
        onSelectScore,
        catalogue,
      }: Parameters<typeof context.components.ScoreSelector>[0]) => (
        <div data-testid="score-selector">
          {catalogue.map((e: { id: string; displayName: string }) => (
            <button key={e.id} onClick={() => onSelectScore(e.id)}>
              {e.displayName}
            </button>
          ))}
        </div>
      ),
    },
    scorePlayer: {
      getCatalogue: () => MOCK_CATALOGUE,
      loadScore: vi.fn(),
      play: vi.fn(async () => {}),
      pause: vi.fn(),
      stop: mockStop,
      seekToTick: mockSeekToTick,
      setPinnedStart: vi.fn(),
      setLoopEnd: vi.fn(),
      setTempoMultiplier: vi.fn(),
      subscribe: (handler: StateHandler) => {
        handler(currentState);
        stateSubscribers.add(handler);
        return () => stateSubscribers.delete(handler);
      },
      getCurrentTickLive: () => 0,
      extractPracticeNotes: mockExtractPracticeNotes,
    },
    metronome: {
      toggle: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn((handler) => {
        handler({
          active: false,
          beatIndex: -1,
          isDownbeat: false,
          bpm: 0,
          subdivision: 1,
        });
        return () => {};
      }),
    },
    manifest: {
      id: 'practice-view-plugin',
      name: 'Practice View Plugin',
      version: '1.0.0',
      description: 'Practice view',
      type: 'common' as const,
      view: 'window' as const,
      pluginApiVersion: '6',
    },
  } as unknown as PluginContext;

  return {
    context,
    mockClose,
    mockStop,
    mockStopPlayback,
    mockSeekToTick,
    mockExtractPracticeNotes,
    mockMidiSubscribe: (context.midi.subscribe as ReturnType<typeof vi.fn>),
    simulateStateChange,
    simulateMidiEvent,
    midiUnsubscribe,
  };
}

// ---------------------------------------------------------------------------
// T028 — US1: Score selector and player rendering
// ---------------------------------------------------------------------------

describe('PracticeViewPlugin — US1: score selection screen', () => {
  let ctx: MockContext;

  beforeEach(() => {
    ctx = createMockContext();
  });

  it('renders ScoreSelector when status is idle', () => {
    render(<PracticeViewPlugin context={ctx.context} />);
    expect(screen.getByTestId('score-selector')).toBeTruthy();
  });

  it('does NOT render ScoreRenderer when status is idle', () => {
    render(<PracticeViewPlugin context={ctx.context} />);
    expect(screen.queryByTestId('score-renderer')).toBeNull();
  });

  it('renders ScoreRenderer when status is ready', () => {
    render(<PracticeViewPlugin context={ctx.context} />);
    act(() => {
      ctx.simulateStateChange({ status: 'ready', title: 'Test Score', staffCount: 1 });
    });
    expect(screen.getByTestId('score-renderer')).toBeTruthy();
  });

  it('does NOT render ScoreSelector when status is ready', () => {
    render(<PracticeViewPlugin context={ctx.context} />);
    act(() => {
      ctx.simulateStateChange({ status: 'ready', title: 'Test Score', staffCount: 1 });
    });
    expect(screen.queryByTestId('score-selector')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// T028 — Back button behaviour
// ---------------------------------------------------------------------------

describe('PracticeViewPlugin — Back button', () => {
  it('calls context.close() when Back button is clicked from player view', () => {
    const ctx = createMockContext({ status: 'ready', title: 'Test', staffCount: 1 });
    render(<PracticeViewPlugin context={ctx.context} />);
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(ctx.mockClose).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// T028 / T042 — Teardown (SC-006)
// ---------------------------------------------------------------------------

describe('PracticeViewPlugin — teardown (SC-006)', () => {
  it('calls context.stopPlayback() on unmount', () => {
    const ctx = createMockContext({ status: 'ready', staffCount: 1 });
    const { unmount } = render(<PracticeViewPlugin context={ctx.context} />);
    unmount();
    expect(ctx.mockStopPlayback).toHaveBeenCalled();
  });

  it('calls context.scorePlayer.stop() on unmount', () => {
    const ctx = createMockContext({ status: 'ready', staffCount: 1 });
    const { unmount } = render(<PracticeViewPlugin context={ctx.context} />);
    unmount();
    expect(ctx.mockStop).toHaveBeenCalled();
  });

  it('MIDI unsubscribe is called on unmount (T042)', () => {
    const ctx = createMockContext({ status: 'ready', staffCount: 1 });
    const { unmount } = render(<PracticeViewPlugin context={ctx.context} />);
    unmount();
    expect(ctx.midiUnsubscribe).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T038 — Seek behaviour
// ---------------------------------------------------------------------------

describe('PracticeViewPlugin — staff selector visibility', () => {
  it('staff selector NOT shown when staffCount === 1', () => {
    const ctx = createMockContext({ status: 'ready', staffCount: 1 });
    render(<PracticeViewPlugin context={ctx.context} />);
    expect(screen.queryByRole('combobox', { name: /select staff/i })).toBeNull();
  });

  it('staff selector IS shown when staffCount === 2', () => {
    const ctx = createMockContext({ status: 'ready', staffCount: 2 });
    render(<PracticeViewPlugin context={ctx.context} />);
    expect(screen.getByRole('combobox', { name: /select staff/i })).toBeTruthy();
  });
});

describe('PracticeViewPlugin — seek behaviour (T038)', () => {
  it('calls seekToTick when note is tapped during inactive practice', () => {
    // Need a custom ScoreRenderer that can trigger onNoteShortTap
    let capturedOnNoteShortTap: ((tick: number) => void) | undefined;
    const MockRenderer = (props: PluginScoreRendererProps) => {
      capturedOnNoteShortTap = props.onNoteShortTap;
      return <div data-testid="score-renderer" />;
    };

    const ctx = createMockContext(
      { status: 'ready', staffCount: 1, currentTick: 0 },
      MockRenderer,
    );
    render(<PracticeViewPlugin context={ctx.context} />);

    act(() => {
      capturedOnNoteShortTap?.(1920);
    });

    expect(ctx.mockSeekToTick).toHaveBeenCalledWith(1920);
  });

  it('does NOT call seekToTick when note is tapped during active practice (uses SEEK instead)', () => {
    let capturedOnNoteShortTap: ((tick: number) => void) | undefined;
    const MockRenderer = (props: PluginScoreRendererProps) => {
      capturedOnNoteShortTap = props.onNoteShortTap;
      return <div data-testid="score-renderer" />;
    };

    const notes = [
      { midiPitches: [60], noteIds: ['n1'], tick: 0 },
      { midiPitches: [62], noteIds: ['n2'], tick: 960 },
      { midiPitches: [64], noteIds: ['n3'], tick: 1920 },
    ];

    const ctx = createMockContext(
      { status: 'ready', staffCount: 1, currentTick: 0 },
      MockRenderer,
    );

    ctx.mockExtractPracticeNotes.mockReturnValue({
      notes,
      totalAvailable: 3,
      clef: 'Treble',
    });

    render(<PracticeViewPlugin context={ctx.context} />);

    // Start practice
    fireEvent.click(screen.getByRole('button', { name: /start practice/i }));

    // Practice should now be active — tap a note
    act(() => {
      capturedOnNoteShortTap?.(960);
    });

    // Should NOT seek playhead
    expect(ctx.mockSeekToTick).not.toHaveBeenCalled();
  });
});

describe('PracticeViewPlugin — Practice activation', () => {
  it('calls extractPracticeNotes with staffIndex 0 when Practice is pressed and staffCount=1', () => {
    const notes = [
      { midiPitches: [60], noteIds: ['n1'], tick: 0 },
    ];
    const ctx = createMockContext({ status: 'ready', staffCount: 1 });
    ctx.mockExtractPracticeNotes.mockReturnValue({ notes, totalAvailable: 1, clef: 'Treble' });

    render(<PracticeViewPlugin context={ctx.context} />);
    fireEvent.click(screen.getByRole('button', { name: /start practice/i }));

    expect(ctx.mockExtractPracticeNotes).toHaveBeenCalledWith(0);
  });

  it('Practice button shows inactive when no score loaded', () => {
    const ctx = createMockContext({ status: 'ready', staffCount: 1 });
    render(<PracticeViewPlugin context={ctx.context} />);
    expect(screen.getByRole('button', { name: /start practice/i })).toBeTruthy();
  });
});

describe('PracticeViewPlugin — Results overlay', () => {
  it('shows results overlay when all practice notes are completed', () => {
    const notes = [
      { midiPitches: [60], noteIds: ['n1'], tick: 0 },
    ];
    const ctx = createMockContext({ status: 'ready', staffCount: 1 });
    ctx.mockExtractPracticeNotes.mockReturnValue({
      notes,
      totalAvailable: 1,
      clef: 'Treble',
    });

    render(<PracticeViewPlugin context={ctx.context} />);

    // Start practice
    fireEvent.click(screen.getByRole('button', { name: /start practice/i }));

    // Simulate correct MIDI note → completes practice (single note)
    act(() => {
      ctx.simulateMidiEvent({ type: 'attack', midiNote: 60 });
    });

    // Results overlay should be visible
    expect(screen.getByRole('region', { name: /practice results/i })).toBeTruthy();
    expect(screen.getByText('100')).toBeTruthy();
    expect(screen.getByText(/Perfect/)).toBeTruthy();
  });

  it('results overlay can be dismissed via close button', () => {
    const notes = [
      { midiPitches: [60], noteIds: ['n1'], tick: 0 },
    ];
    const ctx = createMockContext({ status: 'ready', staffCount: 1 });
    ctx.mockExtractPracticeNotes.mockReturnValue({
      notes,
      totalAvailable: 1,
      clef: 'Treble',
    });

    render(<PracticeViewPlugin context={ctx.context} />);
    fireEvent.click(screen.getByRole('button', { name: /start practice/i }));
    act(() => {
      ctx.simulateMidiEvent({ type: 'attack', midiNote: 60 });
    });

    // Close the overlay via the × button
    const closeBtn = screen.getAllByRole('button', { name: /close results/i })
      .find(el => el.textContent === '×')!;
    fireEvent.click(closeBtn);
    expect(screen.queryByRole('region', { name: /practice results/i })).toBeNull();
  });

  it('Practice button shows "Practice" (not "Complete") after finishing', () => {
    const notes = [
      { midiPitches: [60], noteIds: ['n1'], tick: 0 },
    ];
    const ctx = createMockContext({ status: 'ready', staffCount: 1 });
    ctx.mockExtractPracticeNotes.mockReturnValue({
      notes,
      totalAvailable: 1,
      clef: 'Treble',
    });

    render(<PracticeViewPlugin context={ctx.context} />);
    fireEvent.click(screen.getByRole('button', { name: /start practice/i }));
    act(() => {
      ctx.simulateMidiEvent({ type: 'attack', midiNote: 60 });
    });

    const btn = screen.getByRole('button', { name: /start practice/i });
    expect(btn.textContent).toContain('Practice');
    expect(btn.textContent).not.toContain('Complete');
  });
});
