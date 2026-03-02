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
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// T013 — Metronome button rendering
// ---------------------------------------------------------------------------

describe('PlaybackToolbar — metronome button (Feature 035)', () => {
  let onMetronomeToggle: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onMetronomeToggle = vi.fn();
  });

  it('renders a metronome button with aria-label "Toggle metronome"', () => {
    render(<PlaybackToolbar {...makeDefaultProps({ onMetronomeToggle })} />);
    expect(screen.getByRole('button', { name: /toggle metronome/i })).toBeTruthy();
  });

  it('has aria-pressed="false" when metronome is inactive', () => {
    render(
      <PlaybackToolbar
        {...makeDefaultProps({ metronomeActive: false, onMetronomeToggle })}
      />
    );
    const btn = screen.getByRole('button', { name: /toggle metronome/i });
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });

  it('has aria-pressed="true" when metronome is active', () => {
    render(
      <PlaybackToolbar
        {...makeDefaultProps({ metronomeActive: true, metronomeBeatIndex: 0, onMetronomeToggle })}
      />
    );
    const btn = screen.getByRole('button', { name: /toggle metronome/i });
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('calls onMetronomeToggle when the button is clicked', () => {
    render(<PlaybackToolbar {...makeDefaultProps({ onMetronomeToggle })} />);
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
      />
    );
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
      />
    );
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
      />
    );
    const btn = screen.getByRole('button', { name: /toggle metronome/i });
    expect(btn.className).not.toContain('metro-pulse');
  });

  it('updates aria-pressed reactively on re-render', () => {
    const { rerender } = render(
      <PlaybackToolbar
        {...makeDefaultProps({ metronomeActive: false, onMetronomeToggle })}
      />
    );
    let btn = screen.getByRole('button', { name: /toggle metronome/i });
    expect(btn.getAttribute('aria-pressed')).toBe('false');

    rerender(
      <PlaybackToolbar
        {...makeDefaultProps({ metronomeActive: true, metronomeBeatIndex: 0, onMetronomeToggle })}
      />
    );
    btn = screen.getByRole('button', { name: /toggle metronome/i });
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });
});
