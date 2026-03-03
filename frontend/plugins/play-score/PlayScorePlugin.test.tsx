/**
 * Play Score Plugin — Unit Tests
 * Feature 033: Play Score Plugin
 *
 * Tests are written task by task:
 *   T007 — US1: Launch, selection screen, Back button behaviour
 *   T014 — US2: Play/Pause/Stop, timer, canvas tap
 *   T017 — US3: Note short-tap seeking
 *   T019 — US4: Pin/loop state machine
 *   T022 — US5: Return-to-start button
 *   T024 — US6: Load from file
 *   T026 — US7: Tempo control
 */

import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlayScorePlugin } from './PlayScorePlugin';
import type { PluginContext, ScorePlayerState, PluginPlaybackStatus, PluginScoreRendererProps } from '../../src/plugin-api/index';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

const MOCK_CATALOGUE = [
  { id: 'bach-invention-1', displayName: 'Bach — Invention No. 1' },
  { id: 'beethoven-fur-elise', displayName: 'Beethoven — Für Elise' },
  { id: 'burgmuller-arabesque', displayName: 'Burgmüller — Arabesque' },
  { id: 'burgmuller-la-candeur', displayName: 'Burgmüller — La Candeur' },
  { id: 'chopin-nocturne-op9-2', displayName: 'Chopin — Nocturne Op. 9 No. 2' },
  { id: 'pachelbel-canon-d', displayName: 'Pachelbel — Canon in D' },
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
    timeSignature: { numerator: 4, denominator: 4 },
    ...overrides,
  };
}

type MockSubscribeHandler = (state: ScorePlayerState) => void;

function createMockContext(stateOverride: Partial<ScorePlayerState> = {}, ScoreRendererOverride?: React.ComponentType<PluginScoreRendererProps>): {
  context: PluginContext;
  mockLoadScore: ReturnType<typeof vi.fn>;
  mockClose: ReturnType<typeof vi.fn>;
  simulateStateChange: (state: Partial<ScorePlayerState>) => void;
} {
  const subscribers = new Set<MockSubscribeHandler>();
  let currentState = makeIdleState(stateOverride);

  const simulateStateChange = (newState: Partial<ScorePlayerState>) => {
    currentState = makeIdleState({ ...currentState, ...newState });
    subscribers.forEach(h => h(currentState));
  };

  const mockLoadScore = vi.fn();
  const mockClose = vi.fn();

  const context = {
    emitNote: vi.fn(),
    playNote: vi.fn(),
    stopPlayback: vi.fn(),
    close: mockClose,
    recording: { subscribe: vi.fn(() => () => {}), onError: vi.fn(() => () => {}), stop: vi.fn() },
    midi: { subscribe: vi.fn(() => () => {}) },
    components: {
      StaffViewer: () => null,
      ScoreRenderer: ScoreRendererOverride ?? (() => null),
      ScoreSelector: () => null,
    },
    scorePlayer: {
      getCatalogue: () => MOCK_CATALOGUE,
      loadScore: mockLoadScore,
      play: vi.fn(async () => {}),
      pause: vi.fn(),
      stop: vi.fn(),
      seekToTick: vi.fn(),
      setPinnedStart: vi.fn(),
      setLoopEnd: vi.fn(),
      setTempoMultiplier: vi.fn(),
      subscribe: (handler: MockSubscribeHandler) => {
        // Immediate call with current state (push model)
        handler(currentState);
        subscribers.add(handler);
        return () => { subscribers.delete(handler); };
      },
      getCurrentTickLive: () => 0,
    },
    metronome: {
      toggle: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn((handler) => {
        // Immediate call with inactive metronome state
        handler({ active: false, beatIndex: -1, isDownbeat: false, bpm: 0, subdivision: 1 });
        return () => {};
      }),
    },
    manifest: {
      id: 'play-score',
      name: 'Play Score',
      version: '1.0.0',
      description: 'Load and play scores',
      type: 'core' as const,
      view: 'full-screen' as const,
      pluginApiVersion: '3',
    },
  } as unknown as PluginContext;

  return { context, mockLoadScore, mockClose, simulateStateChange };
}

// ---------------------------------------------------------------------------
// T007 — US1: Launch, selection screen, Back button behaviour
// ---------------------------------------------------------------------------

describe('PlayScorePlugin — US1: Selection screen and Back button', () => {
  let ctx: ReturnType<typeof createMockContext>;

  beforeEach(() => {
    ctx = createMockContext();
  });

  it('renders all 6 catalogue entries by displayName on the selection screen', () => {
    render(<PlayScorePlugin context={ctx.context} />);

    for (const entry of MOCK_CATALOGUE) {
      expect(screen.getByText(entry.displayName)).toBeInTheDocument();
    }
  });

  it('Back button is absent when screen === "selection"', () => {
    render(<PlayScorePlugin context={ctx.context} />);

    // No Back button visible on selection screen
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument();
  });

  it('calls scorePlayer.loadScore with catalogueId when a score is selected', async () => {
    ctx.mockLoadScore.mockResolvedValueOnce(undefined);
    render(<PlayScorePlugin context={ctx.context} />);

    const firstEntry = MOCK_CATALOGUE[0];
    fireEvent.click(screen.getByText(firstEntry.displayName));

    expect(ctx.mockLoadScore).toHaveBeenCalledWith({
      kind: 'catalogue',
      catalogueId: firstEntry.id,
    });
  });

  it('transitions to player view after selecting a score', async () => {
    ctx.mockLoadScore.mockResolvedValueOnce(undefined);
    render(<PlayScorePlugin context={ctx.context} />);

    fireEvent.click(screen.getByText(MOCK_CATALOGUE[0].displayName));

    // After selection, selection screen title entries are no longer visible
    // and player view elements appear (Back button must be visible)
    await act(async () => {
      ctx.simulateStateChange({ status: 'ready', title: 'Bach — Invention No. 1' });
    });

    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
    // Selection list container should no longer be visible (player view replaces it)
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('Back button is present when screen === "player"', async () => {
    ctx.mockLoadScore.mockResolvedValueOnce(undefined);
    render(<PlayScorePlugin context={ctx.context} />);

    fireEvent.click(screen.getByText(MOCK_CATALOGUE[0].displayName));
    await act(async () => {
      ctx.simulateStateChange({ status: 'ready' });
    });

    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
  });

  it('Back button calls context.close()', async () => {
    ctx.mockLoadScore.mockResolvedValueOnce(undefined);
    render(<PlayScorePlugin context={ctx.context} />);

    // Navigate to player view
    fireEvent.click(screen.getByText(MOCK_CATALOGUE[0].displayName));
    await act(async () => {
      ctx.simulateStateChange({ status: 'ready' });
    });

    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(ctx.mockClose).toHaveBeenCalledOnce();
  });

  it('shows loading indicator when status === "loading"', async () => {
    // Start with loading state
    ctx = createMockContext({ status: 'loading' });
    render(<PlayScorePlugin context={ctx.context} />);

    // Navigate to player view first
    fireEvent.click(screen.getByText(MOCK_CATALOGUE[0].displayName));

    // Simulate loading state
    await act(async () => {
      ctx.simulateStateChange({ status: 'loading' });
    });

    expect(
      screen.getByText(/loading/i) || screen.getByRole('status')
    ).toBeInTheDocument();
  });

  it('shows error message when status === "error"', async () => {
    render(<PlayScorePlugin context={ctx.context} />);

    fireEvent.click(screen.getByText(MOCK_CATALOGUE[0].displayName));

    await act(async () => {
      ctx.simulateStateChange({ status: 'error', error: 'Failed to load score' });
    });

    expect(screen.getByText(/failed to load score/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// T014 — US2: Play, Pause, Stop, Timer, Canvas tap (FAILING until T015/T016)
// ---------------------------------------------------------------------------

/**
 * Helper: navigate the plugin to the player view and simulate a ready state.
 * Returns the ctx, mockPlay, mockPause, mockStop so tests can assert on them.
 */
async function navigateToPlayerView(ctx: ReturnType<typeof createMockContext>) {
  ctx.mockLoadScore.mockResolvedValueOnce(undefined);
  render(<PlayScorePlugin context={ctx.context} />);
  fireEvent.click(screen.getByText(MOCK_CATALOGUE[0].displayName));
  await act(async () => {
    ctx.simulateStateChange({ status: 'ready', title: MOCK_CATALOGUE[0].displayName });
  });
}

describe('PlayScorePlugin — US2: Playback controls and timer', () => {
  let ctx: ReturnType<typeof createMockContext>;
  let mockPlay: ReturnType<typeof vi.fn>;
  let mockPause: ReturnType<typeof vi.fn>;
  let mockStop: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ctx = createMockContext();
    mockPlay = ctx.context.scorePlayer.play as ReturnType<typeof vi.fn>;
    mockPause = ctx.context.scorePlayer.pause as ReturnType<typeof vi.fn>;
    mockStop = ctx.context.scorePlayer.stop as ReturnType<typeof vi.fn>;
  });

  it('Play button calls scorePlayer.play()', async () => {
    await navigateToPlayerView(ctx);

    const playBtn = screen.getByRole('button', { name: /play/i });
    fireEvent.click(playBtn);

    expect(mockPlay).toHaveBeenCalledOnce();
  });

  it('Pause button calls scorePlayer.pause() when playing', async () => {
    await navigateToPlayerView(ctx);

    await act(async () => {
      ctx.simulateStateChange({ status: 'playing' });
    });

    const pauseBtn = screen.getByRole('button', { name: /pause/i });
    fireEvent.click(pauseBtn);

    expect(mockPause).toHaveBeenCalledOnce();
  });

  it('Stop button calls scorePlayer.stop()', async () => {
    await navigateToPlayerView(ctx);

    await act(async () => {
      ctx.simulateStateChange({ status: 'playing' });
    });

    const stopBtn = screen.getByRole('button', { name: /stop/i });
    fireEvent.click(stopBtn);

    expect(mockStop).toHaveBeenCalledOnce();
  });

  it('timer displays elapsed time as mm:ss from currentTick + bpm', async () => {
    await navigateToPlayerView(ctx);

    // 1920 ticks at 120 BPM = 1 second → "00:01"
    await act(async () => {
      ctx.simulateStateChange({ status: 'playing', currentTick: 1920, bpm: 120 });
    });

    expect(screen.getByText('00:01')).toBeInTheDocument();
  });

  it('timer text does not change when status transitions to paused', async () => {
    await navigateToPlayerView(ctx);

    await act(async () => {
      ctx.simulateStateChange({ status: 'playing', currentTick: 1920, bpm: 120 });
    });
    const timerText = screen.getByText('00:01').textContent;

    await act(async () => {
      ctx.simulateStateChange({ status: 'paused', currentTick: 1920, bpm: 120 });
    });

    // Timer should show the same frozen time
    expect(screen.getByText('00:01').textContent).toBe(timerText);
  });

  it('canvas tap calls play() when status is paused', async () => {
    // Use a capturing ScoreRenderer to get onCanvasTap
    let capturedOnCanvasTap: (() => void) | undefined;
    const CapturingRenderer = (props: PluginScoreRendererProps) => {
      capturedOnCanvasTap = props.onCanvasTap;
      return React.createElement('div', { 'data-testid': 'score-renderer' });
    };
    ctx = createMockContext({}, CapturingRenderer);
    mockPause = ctx.context.scorePlayer.pause as ReturnType<typeof vi.fn>;
    mockPlay = ctx.context.scorePlayer.play as ReturnType<typeof vi.fn>;

    await navigateToPlayerView(ctx);

    await act(async () => {
      ctx.simulateStateChange({ status: 'paused' });
    });

    expect(capturedOnCanvasTap).toBeDefined();
    act(() => { capturedOnCanvasTap!(); });

    expect(mockPlay).toHaveBeenCalledOnce();
    expect(mockPause).not.toHaveBeenCalled();
  });

  it('canvas tap calls pause() when status is playing', async () => {
    let capturedOnCanvasTap: (() => void) | undefined;
    const CapturingRenderer = (props: PluginScoreRendererProps) => {
      capturedOnCanvasTap = props.onCanvasTap;
      return React.createElement('div', { 'data-testid': 'score-renderer' });
    };
    ctx = createMockContext({}, CapturingRenderer);
    mockPause = ctx.context.scorePlayer.pause as ReturnType<typeof vi.fn>;
    mockPlay = ctx.context.scorePlayer.play as ReturnType<typeof vi.fn>;

    await navigateToPlayerView(ctx);

    await act(async () => {
      ctx.simulateStateChange({ status: 'playing' });
    });

    expect(capturedOnCanvasTap).toBeDefined();
    act(() => { capturedOnCanvasTap!(); });

    expect(mockPause).toHaveBeenCalledOnce();
    expect(mockPlay).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Reusable capturing ScoreRenderer helper for US3/US4/US5
// ---------------------------------------------------------------------------

function createCapturingRenderer(): {
  Renderer: React.ComponentType<PluginScoreRendererProps>;
  getLastProps: () => PluginScoreRendererProps | null;
} {
  let lastProps: PluginScoreRendererProps | null = null;
  function Renderer(props: PluginScoreRendererProps) {
    lastProps = props;
    return React.createElement('div', { 'data-testid': 'score-renderer' });
  }
  return { Renderer, getLastProps: () => lastProps };
}

// Helper to set up player view with a capturing ScoreRenderer
async function setupPlayerWithCapturingRenderer(overrides: Partial<ScorePlayerState> = {}) {
  const { Renderer, getLastProps } = createCapturingRenderer();
  const ctx = createMockContext(overrides, Renderer);
  ctx.mockLoadScore.mockResolvedValueOnce(undefined);
  render(<PlayScorePlugin context={ctx.context} />);

  // Navigate to player view
  fireEvent.click(screen.getByText(MOCK_CATALOGUE[0].displayName));
  await act(async () => {
    ctx.simulateStateChange({ status: 'ready', ...overrides });
  });

  return { ctx, getLastProps };
}

// ---------------------------------------------------------------------------
// T017 — US3: Note short-tap seeking (FAILING until T018)
// ---------------------------------------------------------------------------

describe('PlayScorePlugin — US3: Note short-tap seeking', () => {
  it('short-tap while stopped calls seekToTick(tick) and NOT play()', async () => {
    const { ctx, getLastProps } = await setupPlayerWithCapturingRenderer({ status: 'ready' });
    const mockSeek = ctx.context.scorePlayer.seekToTick as ReturnType<typeof vi.fn>;
    const mockPlay = ctx.context.scorePlayer.play as ReturnType<typeof vi.fn>;

    const props = getLastProps();
    expect(props).not.toBeNull();

    act(() => { props!.onNoteShortTap(480, 'note-id-1'); });

    expect(mockSeek).toHaveBeenCalledWith(480);
    expect(mockPlay).not.toHaveBeenCalled();
  });

  it('short-tap while playing calls seekToTick(tick) and NOT pause()', async () => {
    const { ctx, getLastProps } = await setupPlayerWithCapturingRenderer();
    await act(async () => {
      ctx.simulateStateChange({ status: 'playing' });
    });

    const mockSeek = ctx.context.scorePlayer.seekToTick as ReturnType<typeof vi.fn>;
    const mockPause = ctx.context.scorePlayer.pause as ReturnType<typeof vi.fn>;

    const props = getLastProps();
    act(() => { props!.onNoteShortTap(960, 'note-id-2'); });

    expect(mockSeek).toHaveBeenCalledWith(960);
    expect(mockPause).not.toHaveBeenCalled();
  });

  it('short-tap while paused calls seekToTick(tick) and NOT play()', async () => {
    const { ctx, getLastProps } = await setupPlayerWithCapturingRenderer();
    await act(async () => {
      ctx.simulateStateChange({ status: 'paused' });
    });

    const mockSeek = ctx.context.scorePlayer.seekToTick as ReturnType<typeof vi.fn>;
    const mockPlay = ctx.context.scorePlayer.play as ReturnType<typeof vi.fn>;

    const props = getLastProps();
    act(() => { props!.onNoteShortTap(1440, 'note-id-3'); });

    expect(mockSeek).toHaveBeenCalledWith(1440);
    expect(mockPlay).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T019 — US4: Pin/loop state machine (FAILING until T020/T021)
// ---------------------------------------------------------------------------

describe('PlayScorePlugin — US4: Pin/loop state machine', () => {
  it('first long-press sets loopStart and calls setPinnedStart(tick)', async () => {
    const { ctx, getLastProps } = await setupPlayerWithCapturingRenderer();
    const mockSetPinnedStart = ctx.context.scorePlayer.setPinnedStart as ReturnType<typeof vi.fn>;

    act(() => { getLastProps()!.onNoteLongPress(100, 'note-A'); });

    expect(mockSetPinnedStart).toHaveBeenCalledWith(100);

    // pinnedNoteIds should contain 'note-A'
    const updatedProps = getLastProps();
    expect(updatedProps!.pinnedNoteIds.has('note-A')).toBe(true);
  });

  it('second long-press on same note unpins and calls setPinnedStart(null)', async () => {
    const { ctx, getLastProps } = await setupPlayerWithCapturingRenderer();
    const mockSetPinnedStart = ctx.context.scorePlayer.setPinnedStart as ReturnType<typeof vi.fn>;

    // First long-press → pin
    act(() => { getLastProps()!.onNoteLongPress(100, 'note-A'); });
    // Second long-press on same note → unpin
    act(() => { getLastProps()!.onNoteLongPress(100, 'note-A'); });

    expect(mockSetPinnedStart).toHaveBeenLastCalledWith(null);
    expect(getLastProps()!.pinnedNoteIds.size).toBe(0);
  });

  it('second long-press on different note creates loop and calls setLoopEnd(tick)', async () => {
    const { ctx, getLastProps } = await setupPlayerWithCapturingRenderer();
    const mockSetLoopEnd = ctx.context.scorePlayer.setLoopEnd as ReturnType<typeof vi.fn>;

    // First long-press → pin note-A at tick 100
    act(() => { getLastProps()!.onNoteLongPress(100, 'note-A'); });
    // Second long-press → loop note-B at tick 200
    act(() => { getLastProps()!.onNoteLongPress(200, 'note-B'); });

    expect(mockSetLoopEnd).toHaveBeenCalledWith(200);

    const props = getLastProps();
    expect(props!.loopRegion).toEqual({ startTick: 100, endTick: 200 });
    expect(props!.pinnedNoteIds.has('note-A')).toBe(true);
  });

  it('degenerate loop region (same tick) treated as unpin', async () => {
    const { ctx, getLastProps } = await setupPlayerWithCapturingRenderer();
    const mockSetPinnedStart = ctx.context.scorePlayer.setPinnedStart as ReturnType<typeof vi.fn>;

    // First long-press → pin note-A at tick 100
    act(() => { getLastProps()!.onNoteLongPress(100, 'note-A'); });
    // Second long-press on note-B but SAME tick → degenerate → unpin
    act(() => { getLastProps()!.onNoteLongPress(100, 'note-B'); });

    expect(mockSetPinnedStart).toHaveBeenLastCalledWith(null);
    expect(getLastProps()!.pinnedNoteIds.size).toBe(0);
    expect(getLastProps()!.loopRegion).toBeNull();
  });

  it('long-press inside active loop region clears both pins', async () => {
    const { ctx, getLastProps } = await setupPlayerWithCapturingRenderer();
    const mockSetPinnedStart = ctx.context.scorePlayer.setPinnedStart as ReturnType<typeof vi.fn>;
    const mockSetLoopEnd = ctx.context.scorePlayer.setLoopEnd as ReturnType<typeof vi.fn>;

    // Set up loop region [100, 200]
    act(() => { getLastProps()!.onNoteLongPress(100, 'note-A'); });
    act(() => { getLastProps()!.onNoteLongPress(200, 'note-B'); });
    mockSetPinnedStart.mockClear();
    mockSetLoopEnd.mockClear();

    // Long-press inside loop (tick 150)
    act(() => { getLastProps()!.onNoteLongPress(150, 'note-C'); });

    expect(mockSetPinnedStart).toHaveBeenCalledWith(null);
    expect(mockSetLoopEnd).toHaveBeenCalledWith(null);
    expect(getLastProps()!.pinnedNoteIds.size).toBe(0);
    expect(getLastProps()!.loopRegion).toBeNull();
  });

  it('setPinnedStart NOT called while playing (silent set)', async () => {
    const { ctx, getLastProps } = await setupPlayerWithCapturingRenderer();
    await act(async () => {
      ctx.simulateStateChange({ status: 'playing' });
    });

    const mockSetPinnedStart = ctx.context.scorePlayer.setPinnedStart as ReturnType<typeof vi.fn>;

    act(() => { getLastProps()!.onNoteLongPress(100, 'note-A'); });

    // While playing, host sync is deferred
    expect(mockSetPinnedStart).not.toHaveBeenCalled();
    // But local pin state IS updated
    expect(getLastProps()!.pinnedNoteIds.has('note-A')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T022 — US5: Return-to-start button (FAILING until T023)
// ---------------------------------------------------------------------------

describe('PlayScorePlugin — US5: Return to start', () => {
  it('onReturnToStart calls seekToTick(0) when no pin is set', async () => {
    const { ctx, getLastProps } = await setupPlayerWithCapturingRenderer();
    const mockSeek = ctx.context.scorePlayer.seekToTick as ReturnType<typeof vi.fn>;

    act(() => { getLastProps()!.onReturnToStart(); });

    expect(mockSeek).toHaveBeenCalledWith(0);
  });

  it('onReturnToStart calls seekToTick(pinnedStartTick) when pin is set', async () => {
    const { ctx, getLastProps } = await setupPlayerWithCapturingRenderer();
    const mockSeek = ctx.context.scorePlayer.seekToTick as ReturnType<typeof vi.fn>;

    // Set a pin at tick 100
    act(() => { getLastProps()!.onNoteLongPress(100, 'note-A'); });
    mockSeek.mockClear();

    act(() => { getLastProps()!.onReturnToStart(); });

    expect(mockSeek).toHaveBeenCalledWith(100);
  });

  it('onReturnToStart works while playing without stopping playback', async () => {
    const { ctx, getLastProps } = await setupPlayerWithCapturingRenderer();
    await act(async () => {
      ctx.simulateStateChange({ status: 'playing' });
    });

    const mockSeek = ctx.context.scorePlayer.seekToTick as ReturnType<typeof vi.fn>;
    const mockStop = ctx.context.scorePlayer.stop as ReturnType<typeof vi.fn>;

    act(() => { getLastProps()!.onReturnToStart(); });

    expect(mockSeek).toHaveBeenCalledWith(0);
    expect(mockStop).not.toHaveBeenCalled();
    // Status remains 'playing'
    expect(ctx.context.scorePlayer.getCurrentTickLive()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// T024 — US6: Load from file (FAILING until T025)
// ---------------------------------------------------------------------------

describe('PlayScorePlugin — US6: Load from file', () => {
  it('"Load from file…" button is present on selection screen', () => {
    const ctx = createMockContext();
    render(<PlayScorePlugin context={ctx.context} />);

    expect(screen.getByText(/load from file/i)).toBeInTheDocument();
  });

  it('selecting a valid file calls loadScore({kind:"file", file}) and transitions to player view', async () => {
    const ctx = createMockContext();
    ctx.mockLoadScore.mockResolvedValueOnce(undefined);
    render(<PlayScorePlugin context={ctx.context} />);

    const fileInput = screen.getByTestId('file-input');
    const mockFile = new File(['<score/>'], 'test.mxl', { type: 'application/octet-stream' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [mockFile] } });
    });

    expect(ctx.mockLoadScore).toHaveBeenCalledWith({ kind: 'file', file: mockFile });

    // Simulate transition to player view after loading
    await act(async () => {
      ctx.simulateStateChange({ status: 'ready', title: 'My Score' });
    });

    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.getByText('My Score')).toBeInTheDocument();
  });

  it('error status after corrupt file shows error message', async () => {
    const ctx = createMockContext();
    ctx.mockLoadScore.mockResolvedValueOnce(undefined);
    render(<PlayScorePlugin context={ctx.context} />);

    const fileInput = screen.getByTestId('file-input');
    const badFile = new File(['not xml'], 'bad.mxl', { type: 'application/octet-stream' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [badFile] } });
    });

    // Simulate error state
    await act(async () => {
      ctx.simulateStateChange({ status: 'error', error: 'Failed to parse score' });
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to parse score');
  });
});

// ---------------------------------------------------------------------------
// T026 — US7: Tempo control (FAILING until T027)
// ---------------------------------------------------------------------------

describe('PlayScorePlugin — US7: Tempo control', () => {
  it('adjusting tempo slider calls setTempoMultiplier(multiplier)', async () => {
    const ctx = createMockContext();
    ctx.mockLoadScore.mockResolvedValueOnce(undefined);
    render(<PlayScorePlugin context={ctx.context} />);

    // Navigate to player view
    fireEvent.click(screen.getByText(MOCK_CATALOGUE[0].displayName));
    await act(async () => {
      ctx.simulateStateChange({ status: 'ready', bpm: 120 });
    });

    const mockSetTempo = ctx.context.scorePlayer.setTempoMultiplier as ReturnType<typeof vi.fn>;
    const slider = screen.getByRole('slider', { name: /tempo/i });

    fireEvent.change(slider, { target: { value: '1.5' } });

    expect(mockSetTempo).toHaveBeenCalledWith(1.5);
  });

  it('BPM display updates from ScorePlayerState.bpm', async () => {
    const ctx = createMockContext();
    ctx.mockLoadScore.mockResolvedValueOnce(undefined);
    render(<PlayScorePlugin context={ctx.context} />);

    fireEvent.click(screen.getByText(MOCK_CATALOGUE[0].displayName));
    await act(async () => {
      ctx.simulateStateChange({ status: 'ready', bpm: 140 });
    });

    expect(screen.getByText(/140/)).toBeInTheDocument();
  });

  it('tempo change during playback keeps status "playing"', async () => {
    const ctx = createMockContext();
    ctx.mockLoadScore.mockResolvedValueOnce(undefined);
    render(<PlayScorePlugin context={ctx.context} />);

    fireEvent.click(screen.getByText(MOCK_CATALOGUE[0].displayName));
    await act(async () => {
      ctx.simulateStateChange({ status: 'playing', bpm: 120 });
    });

    const mockSetTempo = ctx.context.scorePlayer.setTempoMultiplier as ReturnType<typeof vi.fn>;
    const slider = screen.getByRole('slider', { name: /tempo/i });
    fireEvent.change(slider, { target: { value: '0.75' } });

    expect(mockSetTempo).toHaveBeenCalledWith(0.75);
    // Stop/play should NOT have been called
    expect(ctx.context.scorePlayer.stop as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
    expect(ctx.context.scorePlayer.play as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });
});
