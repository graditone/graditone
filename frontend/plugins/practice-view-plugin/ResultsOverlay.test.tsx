import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ResultsOverlay } from './ResultsOverlay';
import { INITIAL_PRACTICE_STATE } from './practiceEngine.types';
import type { PracticeNoteResult } from './practiceEngine.types';
import type { PluginContext, ScorePlayerState } from '../../src/plugin-api/index';
import { LocaleProvider } from '../../src/i18n/index';

function makeMockProps() {
  const playerState: ScorePlayerState = {
    status: 'idle',
    currentTick: 0,
    totalDurationTicks: 0,
    highlightedNoteIds: new Set<string>(),
    bpm: 120,
    title: null,
    error: null,
    staffCount: 0,
    timeSignature: { numerator: 4, denominator: 4 },
  };
  const context = {
    stopPlayback: vi.fn(),
    playNote: vi.fn(),
  } as unknown as PluginContext;

  return {
    practiceState: { ...INITIAL_PRACTICE_STATE },
    playerState,
    performanceRecord: null,
    partialPerformanceRecord: null,
    resultsOverlayVisible: false,
    loopRegion: null,
    loopCount: 1,
    setLoopCount: vi.fn(),
    context,
    onRepractice: vi.fn(),
    onDismiss: vi.fn(),
    isReplaying: false,
    replayHighlightedNoteIds: new Set<string>(),
    setIsReplaying: vi.fn(),
    setReplayHighlightedNoteIds: vi.fn(),
  };
}

/** Build minimal props to show the complete results overlay with a loop slider */
function makeCompleteOverlayProps(extra?: Record<string, unknown>) {
  const base = makeMockProps();
  const noteResult = {
    noteIndex: 0,
    outcome: 'correct',
    playedMidi: 60,
    expectedMidi: [60],
    responseTimeMs: 1000,
    expectedTimeMs: 1000,
    relativeDeltaMs: 0,
    wrongAttempts: 0,
  } as unknown as PracticeNoteResult;

  return {
    ...base,
    practiceState: {
      ...INITIAL_PRACTICE_STATE,
      mode: 'complete' as const,
      noteResults: [noteResult],
    },
    resultsOverlayVisible: true,
    loopRegion: { startTick: 0, endTick: 100 },
    loopCount: 3,
    ...extra,
  };
}

/** Provide LocaleProvider for tests */
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <LocaleProvider locale="en">{children}</LocaleProvider>;
}

describe('ResultsOverlay', () => {
  it('renders without crashing when overlay is hidden', () => {
    const props = makeMockProps();
    const { container } = render(<ResultsOverlay {...props} />, { wrapper: TestWrapper });
    // When not visible, should render nothing
    expect(container.querySelector('.practice-results')).toBeNull();
  });

  // T004: loop slider is disabled when loopCountLocked=true
  it('disables loop count slider when loopCountLocked is true', () => {
    const props = makeCompleteOverlayProps({ loopCountLocked: true });
    const { container } = render(<ResultsOverlay {...props} />, { wrapper: TestWrapper });
    const slider = container.querySelector('.practice-results__loop-slider') as HTMLInputElement | null;
    expect(slider).not.toBeNull();
    expect(slider!.disabled).toBe(true);
  });

  // T005: loop slider is enabled when loopCountLocked is absent
  it('enables loop count slider when loopCountLocked is absent', () => {
    const props = makeCompleteOverlayProps();
    const { container } = render(<ResultsOverlay {...props} />, { wrapper: TestWrapper });
    const slider = container.querySelector('.practice-results__loop-slider') as HTMLInputElement | null;
    expect(slider).not.toBeNull();
    expect(slider!.disabled).toBe(false);
  });

  // T006: loop slider shows tooltip text when locked
  it('shows loop locked tooltip when loopCountLocked is true', () => {
    const props = makeCompleteOverlayProps({ loopCountLocked: true });
    const { container } = render(<ResultsOverlay {...props} />, { wrapper: TestWrapper });
    const slider = container.querySelector('.practice-results__loop-slider') as HTMLInputElement | null;
    expect(slider).not.toBeNull();
    expect(slider!.title).toBeTruthy();
    expect(slider!.title).not.toBe('');
  });
});
