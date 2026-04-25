/**
 * PlaybackToolbar — Metronome button tests (T013)
 * Feature 035: Metronome for Play and Practice Views
 *
 * Tests for metronome toggle button rendering, aria-pressed state,
 * beat-pulse CSS class application, and toggle callback.
 */

import { render, screen, fireEvent } from '@testing-library/react';
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
    expect(btn.className).toContain('metro-pulse');
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
    expect(btn.className).toContain('metro-pulse');
    expect(btn.className).toContain('metro-downbeat');
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
    expect(btn.className).not.toContain('metro-pulse');
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
// Feature 083 — Tempo slider precision: 1% steps, ±0.03 snap (T002)
// ---------------------------------------------------------------------------

describe('PlaybackToolbar — tempo slider precision (Feature 083)', () => {
  it('slider step is 0.01 (1% granularity)', () => {
    render(<PlaybackToolbar {...makeDefaultProps({ status: 'ready' })} />, { wrapper: TestWrapper });
    const slider = screen.getByRole('slider', { name: /tempo/i }) as HTMLInputElement;
    expect(slider.step).toBe('0.01');
  });

  it('slider has a datalist providing the 100% snap tick mark', () => {
    render(<PlaybackToolbar {...makeDefaultProps({ status: 'ready' })} />, { wrapper: TestWrapper });
    const slider = screen.getByRole('slider', { name: /tempo/i }) as HTMLInputElement;
    expect(slider.getAttribute('list')).toBeTruthy();
    const datalist = document.getElementById(slider.getAttribute('list')!);
    expect(datalist).not.toBeNull();
    expect(datalist?.querySelector('option[value="1.0"]')).not.toBeNull();
  });

  it('snap zone is ±0.03: onChange at 0.96 does NOT snap to 1.0', () => {
    const onTempoChange = vi.fn();
    render(<PlaybackToolbar {...makeDefaultProps({ status: 'ready', onTempoChange })} />, { wrapper: TestWrapper });
    const slider = screen.getByRole('slider', { name: /tempo/i });
    fireEvent.change(slider, { target: { value: '0.96' } });
    expect(onTempoChange).toHaveBeenCalledWith(0.96);
  });

  it('snap zone is ±0.03: onChange at 0.97 snaps to 1.0', () => {
    const onTempoChange = vi.fn();
    render(<PlaybackToolbar {...makeDefaultProps({ status: 'ready', onTempoChange })} />, { wrapper: TestWrapper });
    const slider = screen.getByRole('slider', { name: /tempo/i });
    fireEvent.change(slider, { target: { value: '0.97' } });
    expect(onTempoChange).toHaveBeenCalledWith(1.0);
  });

  it('snap zone is ±0.03: onChange at 1.03 snaps to 1.0', () => {
    const onTempoChange = vi.fn();
    render(<PlaybackToolbar {...makeDefaultProps({ status: 'ready', onTempoChange })} />, { wrapper: TestWrapper });
    const slider = screen.getByRole('slider', { name: /tempo/i });
    fireEvent.change(slider, { target: { value: '1.03' } });
    expect(onTempoChange).toHaveBeenCalledWith(1.0);
  });

  it('snap zone is ±0.03: onChange at 1.04 does NOT snap to 1.0', () => {
    const onTempoChange = vi.fn();
    render(<PlaybackToolbar {...makeDefaultProps({ status: 'ready', onTempoChange })} />, { wrapper: TestWrapper });
    const slider = screen.getByRole('slider', { name: /tempo/i });
    fireEvent.change(slider, { target: { value: '1.04' } });
    expect(onTempoChange).toHaveBeenCalledWith(1.04);
  });
});

// ---------------------------------------------------------------------------
// Feature 083 — Tempo slider dynamic minimum (FR-014) (T007)
// ---------------------------------------------------------------------------

describe('PlaybackToolbar — tempo slider dynamic minimum (Feature 083 FR-014)', () => {
  it('slider min is 0.1 when bpm=120 (BPM floor not triggered)', () => {
    render(<PlaybackToolbar {...makeDefaultProps({ status: 'ready', bpm: 120 })} />, { wrapper: TestWrapper });
    const slider = screen.getByRole('slider', { name: /tempo/i }) as HTMLInputElement;
    expect(parseFloat(slider.min)).toBeCloseTo(0.1);
  });

  it('slider min is ~0.25 when bpm=40 (10 BPM floor: 10/40=0.25)', () => {
    render(<PlaybackToolbar {...makeDefaultProps({ status: 'ready', bpm: 40 })} />, { wrapper: TestWrapper });
    const slider = screen.getByRole('slider', { name: /tempo/i }) as HTMLInputElement;
    expect(parseFloat(slider.min)).toBeCloseTo(0.25);
  });

  it('shows BPM-floor tooltip on slider when effective min > 0.1 (bpm=40)', () => {
    render(<PlaybackToolbar {...makeDefaultProps({ status: 'ready', bpm: 40 })} />, { wrapper: TestWrapper });
    const slider = screen.getByRole('slider', { name: /tempo/i }) as HTMLInputElement;
    expect(slider.getAttribute('title')).toMatch(/10\s*BPM/i);
  });

  it('does NOT show BPM-floor tooltip when effective min equals 0.1 (bpm=120)', () => {
    render(<PlaybackToolbar {...makeDefaultProps({ status: 'ready', bpm: 120 })} />, { wrapper: TestWrapper });
    const slider = screen.getByRole('slider', { name: /tempo/i }) as HTMLInputElement;
    expect(slider.getAttribute('title') ?? '').not.toMatch(/BPM/i);
  });
});
