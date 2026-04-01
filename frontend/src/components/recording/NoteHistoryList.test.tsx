/**
 * Tests for NoteHistoryList component
 * T026 — rendering, auto-scroll, clear, and empty state
 *
 * TDD: Written before implementation. Fail until T028 creates NoteHistoryList.tsx.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { NoteOnset } from '../../types/recording';
import { NoteHistoryList } from './NoteHistoryList';

// ─── Test data ────────────────────────────────────────────────────────────────

function makeEntry(label: string, elapsedMs: number): NoteOnset {
  return {
    label,
    note: label.replace(/\d/g, ''),
    octave: parseInt(label.replace(/[^\d]/g, ''), 10),
    confidence: 0.95,
    elapsedMs,
  };
}

describe('NoteHistoryList (T026)', () => {
  beforeEach(() => {
    // Stub scrollTop assignment
    Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
      set: vi.fn(),
      get: vi.fn(() => 0),
      configurable: true,
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      get: vi.fn(() => 100),
      configurable: true,
    });
  });

  it('renders all entries with note label and elapsed time', () => {
    const entries = [
      makeEntry('A4', 0),
      makeEntry('B4', 123),
      makeEntry('C5', 456),
    ];
    render(<NoteHistoryList entries={entries} onClear={vi.fn()} />);
    expect(screen.getByText(/A4/)).toBeInTheDocument();
    expect(screen.getByText(/B4/)).toBeInTheDocument();
    expect(screen.getByText(/C5/)).toBeInTheDocument();
  });

  it('renders placeholder text when entries list is empty', () => {
    render(<NoteHistoryList entries={[]} onClear={vi.fn()} />);
    expect(screen.getByText(/no notes/i)).toBeInTheDocument();
  });

  it('calls onClear when the Clear button is clicked', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    const entries = [makeEntry('A4', 0)];
    render(<NoteHistoryList entries={entries} onClear={onClear} />);
    await user.click(screen.getByRole('button', { name: /clear/i }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('Clear button is present even when list has entries', () => {
    const entries = [makeEntry('A4', 0), makeEntry('B4', 100)];
    render(<NoteHistoryList entries={entries} onClear={vi.fn()} />);
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
  });
});

// ─── T004: 069-midi-velocity — velocity number display (US1) ──────────────────

describe('T004: NoteHistoryList velocity number (US1)', () => {
  function makeEntryWithVelocity(label: string, elapsedMs: number, velocity: number): NoteOnset {
    return { ...makeEntry(label, elapsedMs), velocity };
  }

  it('renders velocity value when entry has velocity', () => {
    const entries = [makeEntryWithVelocity('A4', 0, 80)];
    render(<NoteHistoryList entries={entries} onClear={vi.fn()} />);
    expect(screen.getByText('80')).toBeInTheDocument();
  });

  it('renders different velocity values correctly', () => {
    const entries = [
      makeEntryWithVelocity('A4', 0, 30),
      makeEntryWithVelocity('B4', 100, 110),
    ];
    render(<NoteHistoryList entries={entries} onClear={vi.fn()} />);
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('110')).toBeInTheDocument();
  });

  it('does not render velocity column when entry has no velocity (mic path)', () => {
    const entries = [makeEntry('A4', 0)];
    const { container } = render(<NoteHistoryList entries={entries} onClear={vi.fn()} />);
    expect(container.querySelector('.note-history-list__entry-velocity')).toBeNull();
  });
});

// ─── T008: 069-midi-velocity — velocity bar display (US2) ────────────────────

describe('T008: NoteHistoryList velocity bar (US2)', () => {
  function makeEntryWithVelocity(label: string, elapsedMs: number, velocity: number): NoteOnset {
    return { ...makeEntry(label, elapsedMs), velocity };
  }

  it('renders velocity bar element when entry has velocity', () => {
    const entries = [makeEntryWithVelocity('A4', 0, 80)];
    const { container } = render(<NoteHistoryList entries={entries} onClear={vi.fn()} />);
    const bar = container.querySelector('.note-history-list__velocity-bar') as HTMLElement | null;
    expect(bar).not.toBeNull();
  });

  it('velocity 127 renders bar at 100% width', () => {
    const entries = [makeEntryWithVelocity('A4', 0, 127)];
    const { container } = render(<NoteHistoryList entries={entries} onClear={vi.fn()} />);
    const bar = container.querySelector('.note-history-list__velocity-bar') as HTMLElement;
    expect(bar.style.width).toBe('100%');
  });

  it('velocity 1 renders bar at near-0% width', () => {
    const entries = [makeEntryWithVelocity('A4', 0, 1)];
    const { container } = render(<NoteHistoryList entries={entries} onClear={vi.fn()} />);
    const bar = container.querySelector('.note-history-list__velocity-bar') as HTMLElement;
    const width = parseInt(bar.style.width, 10);
    expect(width).toBeLessThanOrEqual(2);
  });

  it('velocity 64 renders bar at ~50% width', () => {
    const entries = [makeEntryWithVelocity('A4', 0, 64)];
    const { container } = render(<NoteHistoryList entries={entries} onClear={vi.fn()} />);
    const bar = container.querySelector('.note-history-list__velocity-bar') as HTMLElement;
    const width = parseInt(bar.style.width, 10);
    expect(width).toBeGreaterThanOrEqual(49);
    expect(width).toBeLessThanOrEqual(51);
  });

  it('does not render velocity bar when entry has no velocity (mic path)', () => {
    const entries = [makeEntry('A4', 0)];
    const { container } = render(<NoteHistoryList entries={entries} onClear={vi.fn()} />);
    expect(container.querySelector('.note-history-list__velocity-bar')).toBeNull();
  });
});

// ─── T011: 069-midi-velocity — channel display (US3) ───────────────────

describe('T011: NoteHistoryList channel display (US3)', () => {
  function makeEntryWithChannel(label: string, elapsedMs: number, channel: number): NoteOnset {
    return { ...makeEntry(label, elapsedMs), channel };
  }

  it('renders "Ch 1" when entry has channel 1', () => {
    const entries = [makeEntryWithChannel('A4', 0, 1)];
    render(<NoteHistoryList entries={entries} onClear={vi.fn()} />);
    expect(screen.getByText('ch1')).toBeInTheDocument();
  });

  it('renders "Ch 10" when entry has channel 10', () => {
    const entries = [makeEntryWithChannel('A4', 0, 10)];
    render(<NoteHistoryList entries={entries} onClear={vi.fn()} />);
    expect(screen.getByText('ch10')).toBeInTheDocument();
  });

  it('does not render channel element when entry has no channel (mic path)', () => {
    const entries = [makeEntry('A4', 0)];
    const { container } = render(<NoteHistoryList entries={entries} onClear={vi.fn()} />);
    expect(container.querySelector('.note-history-list__entry-channel')).toBeNull();
  });
});

// ─── T017: 069-midi-velocity — expandable raw bytes (US4) ─────────────────

describe('T017: NoteHistoryList expandable raw bytes (US4)', () => {
  function makeEntryWithRawBytes(label: string, elapsedMs: number, rawBytes: number[]): NoteOnset {
    return { ...makeEntry(label, elapsedMs), rawBytes };
  }

  it('shows expand button when entry has rawBytes', () => {
    const entries = [makeEntryWithRawBytes('A4', 0, [0x90, 69, 100])];
    render(<NoteHistoryList entries={entries} onClear={vi.fn()} />);
    // Expand button should be present
    expect(screen.getByRole('button', { name: /expand|show bytes|detail/i })).toBeInTheDocument();
  });

  it('does not show expand button when entry has no rawBytes', () => {
    const entries = [makeEntry('A4', 0)];
    render(<NoteHistoryList entries={entries} onClear={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /expand|show bytes|detail/i })).not.toBeInTheDocument();
  });

  it('clicking expand shows hex bytes formatted as 0xNN', async () => {
    const entries = [makeEntryWithRawBytes('A4', 0, [0x90, 0x3c, 0x64])];
    render(<NoteHistoryList entries={entries} onClear={vi.fn()} />);
    const expandBtn = screen.getByRole('button', { name: /expand|show bytes|detail/i });
    await act(async () => {
      expandBtn.click();
    });
    // Should render the hex bytes
    expect(screen.getByText(/0x90.*0x3C.*0x64/i)).toBeInTheDocument();
  });
});
