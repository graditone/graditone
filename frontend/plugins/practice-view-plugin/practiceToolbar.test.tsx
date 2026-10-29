/**
 * Practice View Plugin — PracticeToolbar Unit Tests (T027)
 * Feature 037: Practice View Plugin
 *
 * Tests:
 *   - Practice button is visible when score is loaded
 *   - Practice button shows inactive state when practiceMode === 'inactive'
 *   - Practice button shows active state when practiceMode === 'active'
 *   - Staff selector is hidden when staffCount === 1
 *   - Staff selector is visible when staffCount === 2
 *   - No-MIDI notice shown when practice active and midiConnected === false
 *   - No-MIDI notice hidden when midiConnected === true
 *   - Practice button calls onPracticeToggle on click
 *   - Staff selector calls onStaffChange with numeric index
 */

import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PracticeToolbar, type PracticeToolbarProps } from './practiceToolbar';
import { LocaleProvider } from '../../src/i18n/index';

// Stable ProfileContext so ProfileIcon (added to toolbar) doesn't throw
vi.mock('../../src/services/profiles/ProfileContext', () => ({
  useProfile: () => ({ activeProfile: { id: 'test', name: 'Test' } }),
  ProfileProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDefaultProps(
  overrides: Partial<PracticeToolbarProps> = {},
): PracticeToolbarProps {
  return {
    scoreTitle: 'Test Score',
    status: 'ready',
    currentTick: 0,
    totalDurationTicks: 96000,
    bpm: 120,
    tempoMultiplier: 1.0,
    onBack: vi.fn(),
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onStop: vi.fn(),
    onTempoChange: vi.fn(),
    staffCount: 1,
    selectedStaffIndex: 0,
    onStaffChange: vi.fn(),
    practiceMode: 'inactive',
    currentPracticeIndex: 0,
    totalPracticeNotes: 0,
    onPracticeToggle: vi.fn(),
    showStaffPicker: false,
    midiConnected: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// T027 — Toolbar rendering
// ---------------------------------------------------------------------------

/** Provide LocaleProvider for tests */
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <LocaleProvider locale="en">{children}</LocaleProvider>;
}

describe('PracticeToolbar', () => {
  it('renders the toolbar role', () => {
    render(<PracticeToolbar {...makeDefaultProps()} />, { wrapper: TestWrapper });
    expect(screen.getByRole('toolbar')).toBeTruthy();
  });

  it('renders the Back button', () => {
    render(<PracticeToolbar {...makeDefaultProps()} />, { wrapper: TestWrapper });
    expect(screen.getByRole('button', { name: /back/i })).toBeTruthy();
  });

  it('calls onBack when Back button is clicked', () => {
    const onBack = vi.fn();
    render(<PracticeToolbar {...makeDefaultProps({ onBack })} />, { wrapper: TestWrapper });
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders score title', () => {
    render(<PracticeToolbar {...makeDefaultProps({ scoreTitle: 'My Score' })} />, { wrapper: TestWrapper });
    expect(screen.getByText('My Score')).toBeTruthy();
  });
});

describe('PracticeToolbar — Practice button', () => {
  it('Practice button is visible when score is loaded (status=ready)', () => {
    render(<PracticeToolbar {...makeDefaultProps({ status: 'ready' })} />, { wrapper: TestWrapper });
    expect(screen.getByRole('button', { name: /practice/i })).toBeTruthy();
  });

  it('Practice button is visible when score is loaded (status=playing)', () => {
    render(<PracticeToolbar {...makeDefaultProps({ status: 'playing' })} />, { wrapper: TestWrapper });
    expect(screen.getByRole('button', { name: /practice/i })).toBeTruthy();
  });

  it('Practice button shows inactive aria-pressed=false when practiceMode=inactive', () => {
    render(
      <PracticeToolbar {...makeDefaultProps({ practiceMode: 'inactive' })} />, { wrapper: TestWrapper });
    const btn = screen.getByRole('button', { name: /start practice/i });
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });

  it('Practice button shows active (aria-pressed=true) when practiceMode=active', () => {
    render(
      <PracticeToolbar {...makeDefaultProps({ practiceMode: 'active' })} />, { wrapper: TestWrapper });
    const btn = screen.getByRole('button', { name: /stop practice/i });
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('calls onPracticeToggle when Practice button is clicked', () => {
    const onPracticeToggle = vi.fn();
    render(
      <PracticeToolbar {...makeDefaultProps({ onPracticeToggle, midiConnected: true })} />, { wrapper: TestWrapper });
    fireEvent.click(screen.getByRole('button', { name: /start practice/i }));
    expect(onPracticeToggle).toHaveBeenCalledTimes(1);
  });

  it('Practice button is disabled and shows MIDI tooltip when midiConnected=false', () => {
    render(<PracticeToolbar {...makeDefaultProps({ midiConnected: false })} />, { wrapper: TestWrapper });
    const btn = screen.getByRole('button', { name: /start practice/i });
    expect(btn).toBeDisabled();
    // Tooltip lives on the wrapper span, not the button itself
    const wrapper = btn.closest('[title]') as HTMLElement;
    expect(wrapper).toBeTruthy();
    expect(wrapper.title).toMatch(/midi/i);
  });

  it('Practice button is disabled when status=idle', () => {
    render(<PracticeToolbar {...makeDefaultProps({ status: 'idle' })} />, { wrapper: TestWrapper });
    const btn = screen.getByRole('button', { name: /practice/i });
    expect(btn).toBeDisabled();
  });

  it('Practice button shows "♩ Practice" (ready for retry) when practiceMode=complete', () => {
    render(<PracticeToolbar {...makeDefaultProps({ practiceMode: 'complete', midiConnected: true })} />, { wrapper: TestWrapper });
    const btn = screen.getByRole('button', { name: /start practice/i });
    expect(btn).not.toBeDisabled();
    expect(btn.textContent).toContain('Practice');
    expect(btn.textContent).not.toContain('Complete');
  });
});

describe('PracticeToolbar — Staff selector', () => {
  it('is NOT rendered when staffCount === 1', () => {
    render(<PracticeToolbar {...makeDefaultProps({ staffCount: 1 })} />, { wrapper: TestWrapper });
    expect(screen.queryByRole('button', { name: /select hand/i })).toBeNull();
  });

  it('is NOT rendered when staffCount === 0', () => {
    render(<PracticeToolbar {...makeDefaultProps({ staffCount: 0 })} />, { wrapper: TestWrapper });
    expect(screen.queryByRole('button', { name: /select hand/i })).toBeNull();
  });

  it('is rendered when staffCount === 2', () => {
    render(<PracticeToolbar {...makeDefaultProps({ staffCount: 2 })} />, { wrapper: TestWrapper });
    expect(screen.getByRole('button', { name: /select hand/i })).toBeTruthy();
  });

  it('has correct number of options when staffCount === 3 (3 staves + Both Hands)', () => {
    render(<PracticeToolbar {...makeDefaultProps({ staffCount: 3 })} />, { wrapper: TestWrapper });
    // Open the menu
    fireEvent.click(screen.getByRole('button', { name: /select hand/i }));
    // 3 staves + Both Hands = 4 menu items
    expect(screen.getAllByRole('option').length).toBe(4);
  });

  it('includes a "Both Hands" option when staffCount === 2', () => {
    render(<PracticeToolbar {...makeDefaultProps({ staffCount: 2 })} />, { wrapper: TestWrapper });
    fireEvent.click(screen.getByRole('button', { name: /select hand/i }));
    const options = screen.getAllByRole('option');
    expect(options.some((o) => o.textContent?.includes('Both Hands'))).toBe(true);
  });

  it('calls onStaffChange with -1 when "Both Hands" is selected', () => {
    const onStaffChange = vi.fn();
    render(
      <PracticeToolbar {...makeDefaultProps({ staffCount: 2, onStaffChange })} />, { wrapper: TestWrapper });
    fireEvent.click(screen.getByRole('button', { name: /select hand/i }));
    fireEvent.click(screen.getByRole('option', { name: /both hands/i }));
    expect(onStaffChange).toHaveBeenCalledWith(-1);
  });

  it('calls onStaffChange with numeric index when option is selected', () => {
    const onStaffChange = vi.fn();
    render(
      <PracticeToolbar {...makeDefaultProps({ staffCount: 2, onStaffChange })} />, { wrapper: TestWrapper });
    fireEvent.click(screen.getByRole('button', { name: /select hand/i }));
    fireEvent.click(screen.getByRole('option', { name: /left hand/i }));
    expect(onStaffChange).toHaveBeenCalledWith(1);
  });
});

describe('PracticeToolbar — No-MIDI notice', () => {
  it('shows notice when practiceMode=active and midiConnected=false', () => {
    render(
      <PracticeToolbar
        {...makeDefaultProps({ practiceMode: 'active', midiConnected: false })}
      />, { wrapper: TestWrapper });
    expect(
      screen.getByText(/connect a midi device to practice/i),
    ).toBeTruthy();
  });

  it('does NOT show notice when practiceMode=active and midiConnected=true', () => {
    render(
      <PracticeToolbar
        {...makeDefaultProps({ practiceMode: 'active', midiConnected: true })}
      />, { wrapper: TestWrapper });
    expect(
      screen.queryByText(/connect a midi device to practice/i),
    ).toBeNull();
  });

  it('does NOT show notice when practiceMode=inactive', () => {
    render(
      <PracticeToolbar
        {...makeDefaultProps({ practiceMode: 'inactive', midiConnected: false })}
      />, { wrapper: TestWrapper });
    expect(
      screen.queryByText(/connect a midi device to practice/i),
    ).toBeNull();
  });
});

describe('PracticeToolbar — practice progress', () => {
  it('shows progress counter when practiceMode=active', () => {
    render(
      <PracticeToolbar
        {...makeDefaultProps({
          practiceMode: 'active',
          currentPracticeIndex: 2,
          totalPracticeNotes: 10,
        })}
      />, { wrapper: TestWrapper });
    // Progress label: "3 / 10"
    expect(screen.getByText(/3/)).toBeTruthy();
    expect(screen.getByText(/10/)).toBeTruthy();
  });

  it('does NOT show progress counter when practiceMode=inactive', () => {
    render(
      <PracticeToolbar
        {...makeDefaultProps({
          practiceMode: 'inactive',
          currentPracticeIndex: 0,
          totalPracticeNotes: 10,
        })}
      />, { wrapper: TestWrapper });
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('PracticeToolbar — Play/Stop controls', () => {
  it('calls onPlay when Play button is clicked', () => {
    const onPlay = vi.fn();
    render(<PracticeToolbar {...makeDefaultProps({ status: 'ready', onPlay })} />, { wrapper: TestWrapper });
    fireEvent.click(screen.getByRole('button', { name: /^play$/i }));
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it('calls onPause when Pause button is shown (status=playing)', () => {
    const onPause = vi.fn();
    render(<PracticeToolbar {...makeDefaultProps({ status: 'playing', onPause })} />, { wrapper: TestWrapper });
    fireEvent.click(screen.getByRole('button', { name: /pause/i }));
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it('calls onStop when Stop button is clicked', () => {
    const onStop = vi.fn();
    render(<PracticeToolbar {...makeDefaultProps({ status: 'ready', onStop })} />, { wrapper: TestWrapper });
    fireEvent.click(screen.getByRole('button', { name: /stop/i }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// T010 — MIDI not supported message (Feature 081)
// ---------------------------------------------------------------------------

describe('PracticeToolbar — MIDI not supported', () => {
  it('renders "MIDI not supported" message when midiSupported={false}', () => {
    render(
      <PracticeToolbar {...makeDefaultProps({ midiSupported: false })} />,
      { wrapper: TestWrapper },
    );
    expect(screen.getByText(/MIDI is not supported/i)).toBeTruthy();
  });

  it('does not render "MIDI not supported" message when midiSupported is true', () => {
    render(
      <PracticeToolbar {...makeDefaultProps({ midiSupported: true, midiConnected: true })} />,
      { wrapper: TestWrapper },
    );
    expect(screen.queryByText(/MIDI is not supported/i)).toBeNull();
  });

  it('does not render "MIDI not supported" message when midiSupported is not provided (default)', () => {
    render(
      <PracticeToolbar {...makeDefaultProps()} />,
      { wrapper: TestWrapper },
    );
    expect(screen.queryByText(/MIDI is not supported/i)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Feature 101 — Digital BPM stepper (replaces the tempo slider)
//
// The slider had far too little precision on touch/tablet. The stepper edits
// the effective BPM in whole beats: a short press (hold < 1 s) steps ±1 BPM,
// a long press (hold ≥ 1 s) steps ±5 BPM. onTempoChange receives the
// resulting multiplier (next BPM / original score BPM).
// ---------------------------------------------------------------------------

function stepTempoBtn(btn: HTMLElement, holdMs = 0) {
  fireEvent.pointerDown(btn);
  if (holdMs > 0) vi.setSystemTime(Date.now() + holdMs);
  fireEvent.pointerUp(btn);
}

describe('PracticeToolbar — tempo stepper (Feature 101)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  const mult = (next: number, from = 120) => Math.round((next / from) * 1000) / 1000;

  it('renders the current BPM with the BPM unit', () => {
    render(<PracticeToolbar {...makeDefaultProps({ status: 'ready', bpm: 137 })} />, { wrapper: TestWrapper });
    const display = screen.getByTestId('tempo-display');
    expect(display.querySelector('.practice-plugin__tempo-step-value')!.textContent).toBe('137');
    expect(display.textContent).toContain('BPM');
  });

  it('a short minus press subtracts 1 BPM', () => {
    const onTempoChange = vi.fn();
    render(<PracticeToolbar {...makeDefaultProps({ status: 'ready', bpm: 120, onTempoChange })} />, { wrapper: TestWrapper });
    stepTempoBtn(screen.getByTestId('tempo-minus'), 0);
    expect(onTempoChange).toHaveBeenCalledTimes(1);
    expect(onTempoChange).toHaveBeenCalledWith(mult(119));
  });

  it('a short plus press adds 1 BPM', () => {
    const onTempoChange = vi.fn();
    render(<PracticeToolbar {...makeDefaultProps({ status: 'ready', bpm: 120, onTempoChange })} />, { wrapper: TestWrapper });
    stepTempoBtn(screen.getByTestId('tempo-plus'), 0);
    expect(onTempoChange).toHaveBeenCalledWith(mult(121));
  });

  it('the 1 s hold boundary: 999 ms steps 1 BPM, 1000 ms steps 5 BPM', () => {
    const onTempoChange = vi.fn();
    render(<PracticeToolbar {...makeDefaultProps({ status: 'ready', bpm: 120, onTempoChange })} />, { wrapper: TestWrapper });

    stepTempoBtn(screen.getByTestId('tempo-plus'), 999);
    expect(onTempoChange).toHaveBeenLastCalledWith(mult(121));

    stepTempoBtn(screen.getByTestId('tempo-plus'), 1000);
    expect(onTempoChange).toHaveBeenLastCalledWith(mult(125));

    stepTempoBtn(screen.getByTestId('tempo-minus'), 1000);
    expect(onTempoChange).toHaveBeenLastCalledWith(mult(115));
  });

  it('holding ≥ 1 s auto-repeats +5 every 300 ms until release', () => {
    const onTempoChange = vi.fn();
    render(<PracticeToolbar {...makeDefaultProps({ status: 'ready', bpm: 120, onTempoChange })} />, { wrapper: TestWrapper });
    const plus = screen.getByTestId('tempo-plus');

    fireEvent.pointerDown(plus);
    // 1 s → the first +5 lands (120 → 125), then +5 every 300 ms.
    act(() => { vi.advanceTimersByTime(1000); });
    act(() => { vi.advanceTimersByTime(300); });  // 130
    act(() => { vi.advanceTimersByTime(300); });  // 135

    fireEvent.pointerUp(plus);
    const callsAfterRelease = onTempoChange.mock.calls.length;

    // Nothing after the release: the interval is gone.
    act(() => { vi.advanceTimersByTime(1200); });
    expect(onTempoChange.mock.calls.length).toBe(callsAfterRelease);

    expect(onTempoChange).toHaveBeenCalledWith(mult(125));
    expect(onTempoChange).toHaveBeenCalledWith(mult(130));
    expect(onTempoChange).toHaveBeenCalledWith(mult(135));
  });

  it('the metronome start button carries the BPM readout: pressing it never changes tempo, clicking it toggles the metronome', () => {
    const onTempoChange = vi.fn();
    const onMetronomeToggle = vi.fn();
    render(<PracticeToolbar {...makeDefaultProps({ status: 'ready', bpm: 120, onTempoChange, onMetronomeToggle })} />, { wrapper: TestWrapper });
    const button = screen.getByTestId('tempo-display');
    // A touch on the readout surface must not adjust the tempo.
    fireEvent.pointerDown(button);
    fireEvent.pointerUp(button);
    expect(onTempoChange).not.toHaveBeenCalled();
    // It is still the metronome ON/OFF control.
    fireEvent.click(button);
    expect(onMetronomeToggle).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /toggle metronome/i })).toBeTruthy();
  });

  it('clamps at the 2× ceiling: pressing + at 240 BPM emits nothing', () => {
    const onTempoChange = vi.fn();
    render(<PracticeToolbar {...makeDefaultProps({ status: 'ready', bpm: 240, tempoMultiplier: 2.0, onTempoChange })} />, { wrapper: TestWrapper });
    stepTempoBtn(screen.getByTestId('tempo-plus'), 0);
    expect(onTempoChange).not.toHaveBeenCalled();
  });

  it('clamps at the absolute BPM floor: pressing − at 10 BPM emits nothing', () => {
    const onTempoChange = vi.fn();
    render(<PracticeToolbar {...makeDefaultProps({ status: 'ready', bpm: 10, tempoMultiplier: 0.25, onTempoChange })} />, { wrapper: TestWrapper });
    stepTempoBtn(screen.getByTestId('tempo-minus'), 0);
    expect(onTempoChange).not.toHaveBeenCalled();
  });

  it('caps the displayed BPM just below 999: pressing + at 998 emits nothing', () => {
    const onTempoChange = vi.fn();
    render(<PracticeToolbar {...makeDefaultProps({ status: 'ready', bpm: 998, tempoMultiplier: 1.663, onTempoChange })} />, { wrapper: TestWrapper });
    stepTempoBtn(screen.getByTestId('tempo-plus'), 0);
    expect(onTempoChange).not.toHaveBeenCalled();
  });

  it('shows the BPM-floor tooltip when the floor is raised (bpm=40), none at bpm=120', () => {
    const low = render(<PracticeToolbar {...makeDefaultProps({ status: 'ready', bpm: 40 })} />, { wrapper: TestWrapper });
    expect(low.getByTestId('tempo-display').getAttribute('title')).toMatch(/10\s*BPM/i);
    low.unmount();
    const ok = render(<PracticeToolbar {...makeDefaultProps({ status: 'ready', bpm: 120 })} />, { wrapper: TestWrapper });
    expect(ok.getByTestId('tempo-display').getAttribute('title') ?? '').not.toMatch(/BPM/i);
  });

  it('disables the stepper while loading or when the task is locked', () => {
    const taskTag = { taskNumber: 1, sessionName: 's' };
    const locked = render(<PracticeToolbar {...makeDefaultProps({ status: 'ready', taskTag })} />, { wrapper: TestWrapper });
    expect((locked.getByTestId('tempo-plus') as HTMLButtonElement).disabled).toBe(true);
    expect((locked.getByTestId('tempo-minus') as HTMLButtonElement).disabled).toBe(true);
    locked.unmount();
    const loading = render(<PracticeToolbar {...makeDefaultProps({ status: 'loading' })} />, { wrapper: TestWrapper });
    expect((loading.getByTestId('tempo-plus') as HTMLButtonElement).disabled).toBe(true);
  });
});

// Feature 093 — Tempo readout is orchestrator-driven (guard test)
// ---------------------------------------------------------------------------

describe('PracticeToolbar — tempo readout (Feature 093)', () => {
  function readoutBpm(): string | null {
    const el = document.querySelector('.practice-plugin__toolbar-bpm');
    return el ? el.textContent : null;
  }

  it('T004: renders the bpm prop verbatim as the numeric readout', () => {
    render(
      <PracticeToolbar {...makeDefaultProps({ status: 'ready', bpm: 137 })} />,
      { wrapper: TestWrapper },
    );
    expect(readoutBpm()).toBe('137');
  });

  it('T004b: free practice readout also mirrors the bpm prop (no hardcoded value)', () => {
    render(
      <PracticeToolbar
        {...makeDefaultProps({ status: 'ready', bpm: 77, isFreePractice: true })}
      />,
      { wrapper: TestWrapper },
    );
    expect(readoutBpm()).toBe('77');
  });
});

// ---------------------------------------------------------------------------
// Feature 083 — Metronome armed state: deferred start (T013)
// ---------------------------------------------------------------------------

describe('PracticeToolbar — metronome armed state (Feature 083 US3)', () => {
  const metronomeProps = {
    metronomeActive: false,
    metronomeBeatIndex: -1,
    metronomeIsDownbeat: false,
    onMetronomeToggle: vi.fn(),
    metronomeSubdivision: 1 as const,
    onMetronomeSubdivisionChange: vi.fn(),
  };

  it('metronome button has --armed CSS class when metronomeArmed=true', () => {
    render(
      <PracticeToolbar {...makeDefaultProps({ ...metronomeProps, metronomeArmed: true })} />,
      { wrapper: TestWrapper },
    );
    const btn = screen.getByRole('button', { name: /toggle metronome/i });
    expect(btn.className).toContain('practice-plugin__metro-btn--armed');
    expect(btn.className).not.toContain('practice-plugin__metro-btn--active');
  });

  it('metronome button does NOT have --armed class when metronomeArmed=false', () => {
    render(
      <PracticeToolbar {...makeDefaultProps({ ...metronomeProps, metronomeArmed: false })} />,
      { wrapper: TestWrapper },
    );
    const btn = screen.getByRole('button', { name: /toggle metronome/i });
    expect(btn.className).not.toContain('practice-plugin__metro-btn--armed');
  });

  it('armed class absent when metronomeActive=true (active wins over armed)', () => {
    render(
      <PracticeToolbar
        {...makeDefaultProps({
          ...metronomeProps,
          metronomeActive: true,
          metronomeArmed: true,
          metronomeBeatIndex: 0,
        })}
      />,
      { wrapper: TestWrapper },
    );
    const btn = screen.getByRole('button', { name: /toggle metronome/i });
    expect(btn.className).not.toContain('practice-plugin__metro-btn--armed');
    expect(btn.className).toContain('practice-plugin__metro-btn--active');
  });
});

// ---------------------------------------------------------------------------
// T015 — Feature 084: Staff dropdown controls hand mode (no separate hand-mode UI)
// ---------------------------------------------------------------------------

describe('PracticeToolbar — Staff dropdown hand mode (Feature 084)', () => {
  it('staff selector is NOT shown when staffCount < 2', () => {
    render(
      <PracticeToolbar {...makeDefaultProps({ staffCount: 1 })} />,
      { wrapper: TestWrapper },
    );
    expect(screen.queryByRole('button', { name: /select hand/i })).toBeNull();
  });

  it('staff selector is shown when staffCount >= 2', () => {
    render(
      <PracticeToolbar {...makeDefaultProps({ staffCount: 2 })} />,
      { wrapper: TestWrapper },
    );
    expect(screen.getByRole('button', { name: /select hand/i })).toBeTruthy();
  });

  it('clicking "Left Hand" option calls onStaffChange(1)', () => {
    const onStaffChange = vi.fn();
    render(
      <PracticeToolbar {...makeDefaultProps({ staffCount: 2, onStaffChange })} />,
      { wrapper: TestWrapper },
    );
    fireEvent.click(screen.getByRole('button', { name: /select hand/i }));
    fireEvent.click(screen.getByRole('option', { name: /left hand/i }));
    expect(onStaffChange).toHaveBeenCalledWith(1);
  });

  it('clicking "Both Hands" option calls onStaffChange(-1)', () => {
    const onStaffChange = vi.fn();
    render(
      <PracticeToolbar {...makeDefaultProps({ staffCount: 2, onStaffChange })} />,
      { wrapper: TestWrapper },
    );
    fireEvent.click(screen.getByRole('button', { name: /select hand/i }));
    fireEvent.click(screen.getByRole('option', { name: /both hands/i }));
    expect(onStaffChange).toHaveBeenCalledWith(-1);
  });

  it('clicking "Right Hand" option calls onStaffChange(0)', () => {
    const onStaffChange = vi.fn();
    render(
      <PracticeToolbar {...makeDefaultProps({ staffCount: 2, selectedStaffIndex: 1, onStaffChange })} />,
      { wrapper: TestWrapper },
    );
    fireEvent.click(screen.getByRole('button', { name: /select hand/i }));
    fireEvent.click(screen.getByRole('option', { name: /right hand/i }));
    expect(onStaffChange).toHaveBeenCalledWith(0);
  });
});

// ---------------------------------------------------------------------------
// Feature 101 — Strict tempo indicator (US3, T023)
// ---------------------------------------------------------------------------

describe('PracticeToolbar — strict tempo badge (feature 101, T023)', () => {
  it('is hidden when strictTempoActive is false', () => {
    render(<PracticeToolbar {...makeDefaultProps({ metronomeActive: true, strictTempoActive: false })} />, { wrapper: TestWrapper });
    expect(screen.queryByTestId('strict-tempo-indicator')).toBeNull();
  });

  it('is hidden during Free Practice even when active', () => {
    render(
      <PracticeToolbar
        {...makeDefaultProps({
          metronomeActive: true,
          strictTempoActive: true,
          strictFailureCount: 1,
          isFreePractice: true,
        })}
      />,
      { wrapper: TestWrapper },
    );
    expect(screen.queryByTestId('strict-tempo-indicator')).toBeNull();
  });

  it('shows the strict-tempo label at the none level when practice starts', () => {
    render(<PracticeToolbar {...makeDefaultProps({ metronomeActive: true, strictTempoActive: true })} />, { wrapper: TestWrapper });
    const badge = screen.getByTestId('strict-tempo-indicator');
    expect(badge.textContent).toBe('Strict tempo');
    expect(badge.className).toContain('practice-plugin__strict-badge--none');
    expect(badge.getAttribute('data-failures')).toBe('0');
  });

  it('keeps the static label while the warn/danger levels follow the count', () => {
    const one = render(<PracticeToolbar {...makeDefaultProps({ metronomeActive: true, strictTempoActive: true, strictFailureCount: 1 })} />, { wrapper: TestWrapper });
    let badge = screen.getByTestId('strict-tempo-indicator');
    expect(badge.textContent).toBe('Strict tempo');
    expect(badge.className).toContain('practice-plugin__strict-badge--warn');
    expect(badge.getAttribute('data-failures')).toBe('1');
    one.unmount();

    render(<PracticeToolbar {...makeDefaultProps({ metronomeActive: true, strictTempoActive: true, strictFailureCount: 2 })} />, { wrapper: TestWrapper });
    badge = screen.getByTestId('strict-tempo-indicator');
    expect(badge.textContent).toBe('Strict tempo');
    expect(badge.className).toContain('practice-plugin__strict-badge--danger');
    expect(badge.getAttribute('data-failures')).toBe('2');
  });

  it('is informational: aria-live polite, localized title + aria-label with the count, and not a focusable button', () => {
    render(<PracticeToolbar {...makeDefaultProps({ metronomeActive: true, strictTempoActive: true, strictFailureCount: 1 })} />, { wrapper: TestWrapper });
    const badge = screen.getByTestId('strict-tempo-indicator');
    expect(badge.getAttribute('aria-live')).toBe('polite');
    expect(badge.getAttribute('title')).toContain('Metronome strict tempo — 1 of 3 consecutive timing misses');
    // The live label carries the count for screen readers even though the
    // visible text is the static "Strict tempo".
    expect(badge.getAttribute('aria-label')).toContain('Metronome strict tempo — 1 of 3 consecutive timing misses');
    expect(badge.tagName).toBe('SPAN');
  });
});
