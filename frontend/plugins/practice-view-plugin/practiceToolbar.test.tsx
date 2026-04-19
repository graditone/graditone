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

import { render, screen, fireEvent } from '@testing-library/react';
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
