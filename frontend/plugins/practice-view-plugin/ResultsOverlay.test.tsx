import { render, fireEvent } from '@testing-library/react';
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

  const results = extra?.noteResults ? (extra.noteResults as PracticeNoteResult[]) : [noteResult];

  return {
    ...base,
    practiceState: {
      ...INITIAL_PRACTICE_STATE,
      mode: 'complete' as const,
      noteResults: results,
    },
    resultsOverlayVisible: true,
    loopRegion: { startTick: 0, endTick: 100 },
    loopCount: 3,
    ...extra,
  };
}

/** Build a minimal PracticeNoteResult with the given outcome and deviation. */
function makeNoteResult(outcome: string, relativeDeltaMs: number, index = 0): PracticeNoteResult {
  return {
    noteIndex: index,
    outcome,
    playedMidi: 60,
    expectedMidi: [60],
    responseTimeMs: 1000 + index * 500,
    expectedTimeMs: 1000 + index * 500,
    relativeDeltaMs,
    wrongAttempts: 0,
  } as unknown as PracticeNoteResult;
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

// T011: the saved-record path renders the same State labels as the live path (US2)
  it('T011: shows "+120 ms" for a correct-late note rendered from a saved record', () => {
    const props = makeCompleteOverlayProps({
      practiceState: {
        ...INITIAL_PRACTICE_STATE,
        mode: 'inactive' as const,
        noteResults: [],
      },
      performanceRecord: {
        notes: [],
        noteResults: [makeNoteResult('correct-late', 120)],
        wrongNoteEvents: [],
        bpmAtCompletion: 120,
        tempoMultiplier: 1.0,
      },
      partialPerformanceRecord: null,
    });
    const { container } = render(<ResultsOverlay {...props} />, { wrapper: TestWrapper });
    fireEvent.click(container.querySelector('.practice-results__details-summary')!);
    const row = container.querySelector('.practice-results__row--correct-late');
    expect(row).not.toBeNull();
    const statusCell = row!.children[3];
    expect(statusCell.textContent).toContain('+120 ms');
    expect(statusCell.textContent).toContain('⏱️');
  });

// T006: out-of-time rows show the signed ms deviation in the State column
  it('T006a: shows "+120 ms" for a correct-late note played late', () => {
    const props = makeCompleteOverlayProps({
      noteResults: [makeNoteResult('correct-late', 120)],
    });
    const { container } = render(<ResultsOverlay {...props} />, { wrapper: TestWrapper });
    fireEvent.click(container.querySelector('.practice-results__details-summary')!);
    const row = container.querySelector('.practice-results__row--correct-late');
    expect(row).not.toBeNull();
    // Status cell is the 4th column (0:#, 1:expected, 2:played, 3:status)
    const statusCell = row!.children[3];
    expect(statusCell.textContent).toContain('+120 ms');
    expect(statusCell.textContent).toContain('⏱️');
  });

  it('T006b: shows "-80 ms" for an early-release note', () => {
    const props = makeCompleteOverlayProps({
      noteResults: [makeNoteResult('early-release', -80)],
    });
    const { container } = render(<ResultsOverlay {...props} />, { wrapper: TestWrapper });
    fireEvent.click(container.querySelector('.practice-results__details-summary')!);
    const row = container.querySelector('.practice-results__row--early-release');
    expect(row).not.toBeNull();
    const statusCell = row!.children[3];
    expect(statusCell.textContent).toContain('-80 ms');
    expect(statusCell.textContent).toContain('⏱️');
  });

  it('T006c: shows "0 ms" for an out-of-time note with zero deviation', () => {
    const props = makeCompleteOverlayProps({
      noteResults: [makeNoteResult('correct-late', 0)],
    });
    const { container } = render(<ResultsOverlay {...props} />, { wrapper: TestWrapper });
    fireEvent.click(container.querySelector('.practice-results__details-summary')!);
    const row = container.querySelector('.practice-results__row--correct-late');
    expect(row).not.toBeNull();
    const statusCell = row!.children[3];
    expect(statusCell.textContent).toContain('0 ms');
  });

  it('T006d: keeps the "Correct" label for in-tolerance notes', () => {
    const props = makeCompleteOverlayProps({
      noteResults: [makeNoteResult('correct', 40)],
    });
    const { container } = render(<ResultsOverlay {...props} />, { wrapper: TestWrapper });
    fireEvent.click(container.querySelector('.practice-results__details-summary')!);
    const row = container.querySelector('.practice-results__row--correct');
    expect(row).not.toBeNull();
    const statusCell = row!.children[3];
    expect(statusCell.textContent).toContain('Correct');
    expect(statusCell.textContent).toContain('✅');
  });

  it('T006e: keeps the "Wrong" label for wrong-note rows', () => {
    const props = makeCompleteOverlayProps({
      noteResults: [makeNoteResult('wrong', -200)],
    });
    const { container } = render(<ResultsOverlay {...props} />, { wrapper: TestWrapper });
    fireEvent.click(container.querySelector('.practice-results__details-summary')!);
    const row = container.querySelector('.practice-results__row--wrong');
    expect(row).not.toBeNull();
    const statusCell = row!.children[3];
    expect(statusCell.textContent).toContain('Wrong');
    expect(statusCell.textContent).toContain('❌');
  });

  it('replays a sustained chord as ONE continuous attack per note (regression: no re-attack per tick)', () => {
    const props = makeMockProps();

    // Left-hand whole-note chord at tick 0; right-hand note at tick 960 where
    // the left-hand pitches are carried as sustained (merged into midiPitches).
    // This mirrors the scorePlayerContext multi-voice merge: the pitched recur
    // across consecutive practice steps while held.
    const notes = [
      { midiPitches: [36, 43], noteIds: ['lh1', 'lh2'], tick: 0, durationTicks: 3840 },
      { midiPitches: [36, 43, 67], noteIds: ['lh1', 'lh2', 'rh1'], tick: 960, durationTicks: 3840 },
    ] as unknown as PerformanceRecord['notes'];

    const noteResults = [
      { noteIndex: 0, outcome: 'correct', playedMidi: 36, expectedMidi: [36, 43], responseTimeMs: 0, expectedTimeMs: 0, relativeDeltaMs: 0, wrongAttempts: 0, holdDurationMs: 0, requiredHoldMs: 0 },
      { noteIndex: 1, outcome: 'correct', playedMidi: 67, expectedMidi: [36, 43, 67], responseTimeMs: 500, expectedTimeMs: 500, relativeDeltaMs: 0, wrongAttempts: 0, holdDurationMs: 0, requiredHoldMs: 0 },
    ] as unknown as PracticeNoteResult[];

    Object.assign(props, {
      practiceState: { ...INITIAL_PRACTICE_STATE, mode: 'complete' as const, noteResults },
      performanceRecord: { notes, noteResults, wrongNoteEvents: [], bpmAtCompletion: 120, tempoMultiplier: 1 },
      resultsOverlayVisible: true,
    });

    const { container } = render(<ResultsOverlay {...props} />, { wrapper: TestWrapper });
    fireEvent.click(container.querySelector('.practice-results__replay-btn')!);

    const calls = (props.context.playNote as ReturnType<typeof vi.fn>).mock.calls;
    const byMidi = (m: number) => calls.filter((c) => c[0].midiNote === m);

    // The left-hand chord pitches are attacked ONCE at their onset (t=0) and
    // sustained across the right-hand step — never re-attacked at t=500.
    expect(byMidi(36)).toHaveLength(1);
    expect(byMidi(43)).toHaveLength(1);
    expect(byMidi(36)[0][0].offsetMs).toBe(0);
    expect(byMidi(36)[0][0].durationMs).toBeGreaterThan(500); // sustains past the r.h. step

    // The right-hand onset is attacked at its own time.
    expect(byMidi(67)).toHaveLength(1);
    expect(byMidi(67)[0][0].offsetMs).toBe(500);
  });
});
