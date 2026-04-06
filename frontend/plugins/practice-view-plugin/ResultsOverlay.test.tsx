import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ResultsOverlay } from './ResultsOverlay';
import { INITIAL_PRACTICE_STATE } from './practiceEngine.types';
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
});
