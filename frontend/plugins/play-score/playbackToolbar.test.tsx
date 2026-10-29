/**
 * PlaybackToolbar — Metronome button tests (T013)
 * Feature 035: Metronome for Play and Practice Views
 *
 * Tests for metronome toggle button rendering, aria-pressed state,
 * beat-pulse CSS class application, and toggle callback.
 */

import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlaybackToolbar, type PlaybackToolbarProps } from './playbackToolbar';
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
  overrides: Partial<PlaybackToolbarProps> = {}
): PlaybackToolbarProps {
  return {
    showBack: true,
    scoreTitle: 'Test Score',
    status: 'ready',
    currentTick: 0,
    totalDurationTicks: 100_000,
    bpm: 120,
    tempoMultiplier: 1.0,
    onBack: vi.fn(),
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onStop: vi.fn(),
    onTempoChange: vi.fn(),
    // Metronome props (Feature 035)
    metronomeActive: false,
    metronomeBeatIndex: -1,
    metronomeIsDownbeat: false,
    onMetronomeToggle: vi.fn(),
    metronomeSubdivision: 1 as const,
    onMetronomeSubdivisionChange: vi.fn(),
    metronomeSubBeatIndex: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// T013 — Metronome button rendering
// ---------------------------------------------------------------------------

/** Provide LocaleProvider for tests */
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <LocaleProvider locale="en">{children}</LocaleProvider>;
}

describe('PlaybackToolbar — metronome button (Feature 035)', () => {
  let onMetronomeToggle: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onMetronomeToggle = vi.fn();
  });

  it('renders a metronome button with aria-label "Toggle metronome"', () => {
    render(<PlaybackToolbar {...makeDefaultProps({ onMetronomeToggle })} />, { wrapper: TestWrapper });
    expect(screen.getByRole('button', { name: /toggle metronome/i })).toBeTruthy();
  });

  it('has aria-pressed="false" when metronome is inactive', () => {
    render(
      <PlaybackToolbar
        {...makeDefaultProps({ metronomeActive: false, onMetronomeToggle })}
      />, { wrapper: TestWrapper });
    const btn = screen.getByRole('button', { name: /toggle metronome/i });
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });

  it('has aria-pressed="true" when metronome is active', () => {
    render(
      <PlaybackToolbar
        {...makeDefaultProps({ metronomeActive: true, metronomeBeatIndex: 0, onMetronomeToggle })}
      />, { wrapper: TestWrapper });
    const btn = screen.getByRole('button', { name: /toggle metronome/i });
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('calls onMetronomeToggle when the button is clicked', () => {
    render(<PlaybackToolbar {...makeDefaultProps({ onMetronomeToggle })} />, { wrapper: TestWrapper });
    fireEvent.click(screen.getByRole('button', { name: /toggle metronome/i }));
    expect(onMetronomeToggle).toHaveBeenCalledTimes(1);
  });

  it('applies metro-pulse class when metronome is active and beating', () => {
    render(
      <PlaybackToolbar
        {...makeDefaultProps({
          metronomeActive: true,
          metronomeBeatIndex: 1,
          metronomeIsDownbeat: false,
          onMetronomeToggle,
        })}
      />, { wrapper: TestWrapper });
    const btn = screen.getByRole('button', { name: /toggle metronome/i });
    expect(btn.className).toContain('practice-plugin__metro-btn');
    expect(btn.className).toContain('practice-plugin__metro-btn--active');
  });

  it('applies additional metro-downbeat class on a downbeat', () => {
    render(
      <PlaybackToolbar
        {...makeDefaultProps({
          metronomeActive: true,
          metronomeBeatIndex: 0,
          metronomeIsDownbeat: true,
          onMetronomeToggle,
        })}
      />, { wrapper: TestWrapper });
    const btn = screen.getByRole('button', { name: /toggle metronome/i });
    expect(btn.className).toContain('practice-plugin__metro-btn');
    expect(btn.className).toContain('practice-plugin__metro-btn--active');
    expect(btn.className).toContain('practice-plugin__metro-btn--downbeat');
  });

  it('does NOT apply metro-pulse class when metronome is inactive', () => {
    render(
      <PlaybackToolbar
        {...makeDefaultProps({
          metronomeActive: false,
          metronomeBeatIndex: 2,
          onMetronomeToggle,
        })}
      />, { wrapper: TestWrapper });
    const btn = screen.getByRole('button', { name: /toggle metronome/i });
    expect(btn.className).not.toContain('practice-plugin__metro-btn--active');
  });

  it('updates aria-pressed reactively on re-render', () => {
    const { rerender } = render(
      <PlaybackToolbar
        {...makeDefaultProps({ metronomeActive: false, onMetronomeToggle })}
      />, { wrapper: TestWrapper });
    let btn = screen.getByRole('button', { name: /toggle metronome/i });
    expect(btn.getAttribute('aria-pressed')).toBe('false');

    rerender(
      <PlaybackToolbar
        {...makeDefaultProps({ metronomeActive: true, metronomeBeatIndex: 0, onMetronomeToggle })}
      />, { wrapper: TestWrapper });
    btn = screen.getByRole('button', { name: /toggle metronome/i });
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });
});


// ---------------------------------------------------------------------------
// Shared tempo + metronome widget (Feature 101 polish)
// The same digital BPM stepper the practice toolbar uses, now shared by the
// Play Score toolbar so the metronome/tempo UI is identical everywhere.
// ---------------------------------------------------------------------------

function stepTempoBtn(btn: HTMLElement, holdMs = 0) {
  fireEvent.pointerDown(btn);
  if (holdMs > 0) vi.setSystemTime(Date.now() + holdMs);
  fireEvent.pointerUp(btn);
}

describe('PlaybackToolbar — tempo stepper (shared widget)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  const mult = (next: number, from = 120) => Math.round((next / from) * 1000) / 1000;

  it('renders the current BPM on the metronome start button', () => {
    render(<PlaybackToolbar {...makeDefaultProps({ status: 'ready', bpm: 137 })} />, { wrapper: TestWrapper });
    const display = screen.getByTestId('tempo-display');
    expect(display.querySelector('.practice-plugin__tempo-step-value')!.textContent).toBe('137');
    expect(display.textContent).toContain('BPM');
  });

  it('a short minus press subtracts 1 BPM and a short plus press adds 1 BPM', () => {
    const onTempoChange = vi.fn();
    render(<PlaybackToolbar {...makeDefaultProps({ status: 'ready', onTempoChange })} />, { wrapper: TestWrapper });
    stepTempoBtn(screen.getByTestId('tempo-minus'), 0);
    expect(onTempoChange).toHaveBeenLastCalledWith(mult(119));
    stepTempoBtn(screen.getByTestId('tempo-plus'), 0);
    expect(onTempoChange).toHaveBeenLastCalledWith(mult(121));
  });

  it('holding ≥ 1 s auto-repeats +5 every 300 ms until release', () => {
    const onTempoChange = vi.fn();
    render(<PlaybackToolbar {...makeDefaultProps({ status: 'ready', onTempoChange })} />, { wrapper: TestWrapper });
    fireEvent.pointerDown(screen.getByTestId('tempo-plus'));
    act(() => { vi.advanceTimersByTime(1000); });
    act(() => { vi.advanceTimersByTime(300); });
    fireEvent.pointerUp(screen.getByTestId('tempo-plus'));
    expect(onTempoChange).toHaveBeenCalledWith(mult(125));
    expect(onTempoChange).toHaveBeenCalledWith(mult(130));
  });

  it('shows the BPM-floor tooltip when the floor is raised (bpm=40), none at bpm=120', () => {
    const low = render(<PlaybackToolbar {...makeDefaultProps({ status: 'ready', bpm: 40 })} />, { wrapper: TestWrapper });
    expect(low.getByTestId('tempo-display').getAttribute('title')).toMatch(/10\s*BPM/i);
    low.unmount();
    const ok = render(<PlaybackToolbar {...makeDefaultProps({ status: 'ready', bpm: 120 })} />, { wrapper: TestWrapper });
    expect(ok.getByTestId('tempo-display').getAttribute('title') ?? '').not.toMatch(/BPM/i);
  });

  it('disables the steppers while loading', () => {
    render(<PlaybackToolbar {...makeDefaultProps({ status: 'loading' })} />, { wrapper: TestWrapper });
    expect((screen.getByTestId('tempo-plus') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('tempo-minus') as HTMLButtonElement).disabled).toBe(true);
  });
});

