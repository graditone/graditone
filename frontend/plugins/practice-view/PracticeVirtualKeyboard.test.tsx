/**
 * PracticeVirtualKeyboard.test.tsx — T003, T012
 * Feature 001: Virtual Keyboard in Practice View
 *
 * TDD: T003 tests must fail before PracticePlugin.tsx toggle is implemented.
 *      T012 tests must fail before PracticeVirtualKeyboard.tsx is implemented.
 * Constitution Principle V: Tests written first, green before consuming code merges.
 *
 * T003 (US1 toggle tests):
 *   - Keyboard toggle button renders adjacent to Mic/MIDI badge
 *   - Button shows active state when virtual keyboard is open
 *   - Pressing the button opens the keyboard panel; pressing again closes it
 *   - Mic/MIDI badge shows suspended state while VK is active
 *
 * T012 (US2 PracticeVirtualKeyboard component tests):
 *   - Renders 52 white keys and 36 black keys (full 88-key piano A0–C8)
 *   - onKeyDown fires with correct midiNote on mouse press
 *   - onKeyUp fires with correct midiNote on mouse release
 *   - context.playNote called on both key down and key up
 *   - Range label reads A0–C8
 *   - Touch guard: mouse events within 500 ms of touch are ignored
 *
 * ESLint boundary:
 * This file MUST NOT import from src/services/, src/components/, or src/wasm/.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type {
  PluginContext,
  PluginPitchEvent,
  PluginNoteEvent,
  PluginScorePlayerContext,
  PluginScoreSelectorProps,
} from '../../src/plugin-api/index';
import { PracticePlugin } from './PracticePlugin';
import { PracticeVirtualKeyboard } from './PracticeVirtualKeyboard';

// ---------------------------------------------------------------------------
// Mock helpers (shared with PracticePlugin.test.tsx)
// ---------------------------------------------------------------------------

type MockScorePlayerState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  currentTick: number; totalDurationTicks: number;
  highlightedNoteIds: ReadonlySet<string>;
  bpm: number; title: string | null; error: string | null;
};

function makeMockScorePlayer(): PluginScorePlayerContext & { _notify: (s: MockScorePlayerState) => void } {
  const subscribers = new Set<(state: MockScorePlayerState) => void>();
  let currentState: MockScorePlayerState = {
    status: 'idle', currentTick: 0, totalDurationTicks: 0,
    highlightedNoteIds: new Set<string>(), bpm: 0, title: null, error: null,
  };
  const notify = (state: MockScorePlayerState) => {
    currentState = state;
    subscribers.forEach(h => h(state));
  };
  return {
    getCatalogue: vi.fn(() => []),
    subscribe: vi.fn((handler: (s: MockScorePlayerState) => void) => {
      subscribers.add(handler);
      handler(currentState);
      return () => subscribers.delete(handler);
    }),
    loadScore: vi.fn(() => Promise.resolve()),
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn(),
    setTempo: vi.fn(),
    extractPracticeNotes: vi.fn(() => null),
    _notify: notify,
  };
}

function MockScoreSelector({ onCancel }: PluginScoreSelectorProps) {
  return <div data-testid="score-selector-dialog"><button onClick={onCancel}>Cancel</button></div>;
}

function makeMockContext(): PluginContext & {
  _pitchSubscribers: Set<(e: PluginPitchEvent) => void>;
  _midiSubscribers: Set<(e: PluginNoteEvent) => void>;
} {
  const pitchSubscribers = new Set<(e: PluginPitchEvent) => void>();
  const midiSubscribers = new Set<(e: PluginNoteEvent) => void>();
  return {
    emitNote: vi.fn(),
    playNote: vi.fn(),
    stopPlayback: vi.fn(),
    close: vi.fn(),
    recording: {
      subscribe: vi.fn((handler: (e: PluginPitchEvent) => void) => {
        pitchSubscribers.add(handler);
        return () => pitchSubscribers.delete(handler);
      }),
      onError: vi.fn(() => () => {}),
    },
    midi: {
      subscribe: vi.fn((handler: (e: PluginNoteEvent) => void) => {
        midiSubscribers.add(handler);
        return () => midiSubscribers.delete(handler);
      }),
    },
    scorePlayer: makeMockScorePlayer(),
    components: {
      StaffViewer: ({ clef }: { clef?: string }) => (
        <div data-testid="staff-viewer" data-clef={clef ?? 'Treble'} role="img" aria-label="staff" />
      ),
      ScoreSelector: MockScoreSelector,
    },
    manifest: {
      id: 'practice-view', name: 'Practice', version: '1.0.0',
      pluginApiVersion: '4', entryPoint: 'index.tsx', origin: 'builtin',
    } as const,
    _pitchSubscribers: pitchSubscribers,
    _midiSubscribers: midiSubscribers,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.runAllTimers(); vi.useRealTimers(); vi.clearAllMocks(); });

// ---------------------------------------------------------------------------
// T003 — US1 Toggle Button (tests PracticePlugin integration)
// ---------------------------------------------------------------------------

describe('T003 — Virtual keyboard toggle button in PracticePlugin', () => {
  it('renders a keyboard toggle button in the header toolbar', () => {
    const ctx = makeMockContext();
    render(<PracticePlugin context={ctx} />);
    const toggleBtn = screen.getByTestId('vkb-toggle-btn');
    expect(toggleBtn).toBeDefined();
  });

  it('toggle button is rendered adjacent to the Mic/MIDI badge', () => {
    const ctx = makeMockContext();
    const { container } = render(<PracticePlugin context={ctx} />);
    // Both the toggle button and the badge should be inside the same header-actions container
    const actionsDiv = container.querySelector('.practice-plugin__header-actions');
    expect(actionsDiv).not.toBeNull();
    const toggleBtn = actionsDiv!.querySelector('[data-testid="vkb-toggle-btn"]');
    const badge = actionsDiv!.querySelector('.practice-mic-badge');
    expect(toggleBtn).not.toBeNull();
    expect(badge).not.toBeNull();
  });

  it('toggle button has aria-pressed=false by default (keyboard hidden)', () => {
    const ctx = makeMockContext();
    render(<PracticePlugin context={ctx} />);
    const toggleBtn = screen.getByTestId('vkb-toggle-btn');
    expect(toggleBtn.getAttribute('aria-pressed')).toBe('false');
  });

  it('virtual keyboard panel is NOT shown on initial render', () => {
    const ctx = makeMockContext();
    render(<PracticePlugin context={ctx} />);
    expect(screen.queryByTestId('vkb-panel')).toBeNull();
  });

  it('pressing the toggle button shows the virtual keyboard panel', async () => {
    const ctx = makeMockContext();
    render(<PracticePlugin context={ctx} />);
    const toggleBtn = screen.getByTestId('vkb-toggle-btn');
    await act(async () => { fireEvent.click(toggleBtn); });
    expect(screen.getByTestId('vkb-panel')).toBeDefined();
  });

  it('toggle button has aria-pressed=true when panel is open', async () => {
    const ctx = makeMockContext();
    render(<PracticePlugin context={ctx} />);
    const toggleBtn = screen.getByTestId('vkb-toggle-btn');
    await act(async () => { fireEvent.click(toggleBtn); });
    expect(toggleBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('toggle button has active CSS class when panel is open', async () => {
    const ctx = makeMockContext();
    render(<PracticePlugin context={ctx} />);
    const toggleBtn = screen.getByTestId('vkb-toggle-btn');
    await act(async () => { fireEvent.click(toggleBtn); });
    expect(toggleBtn.className).toContain('practice-plugin__vkb-toggle--active');
  });

  it('pressing the toggle button again hides the virtual keyboard panel', async () => {
    const ctx = makeMockContext();
    render(<PracticePlugin context={ctx} />);
    const toggleBtn = screen.getByTestId('vkb-toggle-btn');
    await act(async () => { fireEvent.click(toggleBtn); }); // open
    await act(async () => { fireEvent.click(toggleBtn); }); // close
    expect(screen.queryByTestId('vkb-panel')).toBeNull();
  });

  it('Mic/MIDI badge gains suspended class when virtual keyboard is active', async () => {
    const ctx = makeMockContext();
    const { container } = render(<PracticePlugin context={ctx} />);
    const toggleBtn = screen.getByTestId('vkb-toggle-btn');
    await act(async () => { fireEvent.click(toggleBtn); });
    const badge = container.querySelector('.practice-mic-badge');
    expect(badge?.className).toContain('practice-mic-badge--suspended');
  });

  it('virtual keyboard state resets to hidden on fresh mount (FR-009)', () => {
    const ctx = makeMockContext();
    render(<PracticePlugin context={ctx} />);
    // On a fresh mount there should be no panel without any interaction
    expect(screen.queryByTestId('vkb-panel')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// T012 — US2 PracticeVirtualKeyboard component
// ---------------------------------------------------------------------------

describe('T012 — PracticeVirtualKeyboard component', () => {
  function makeVkbContext() {
    return { playNote: vi.fn() };
  }

  // ── Key count ───────────────────────────────────────────────────────────

  it('renders 52 white keys (full 88-key piano A0–C8)', () => {
    const ctx = makeVkbContext();
    const onKeyDown = vi.fn();
    const onKeyUp = vi.fn();
    render(<PracticeVirtualKeyboard context={ctx} onKeyDown={onKeyDown} onKeyUp={onKeyUp} />);
    const keyboard = screen.getByTestId('practice-vkb-keyboard');
    const whiteKeys = keyboard.querySelectorAll('.practice-vkb__key--white');
    expect(whiteKeys.length).toBe(52); // standard 88-key piano
  });

  it('renders 36 black keys (full 88-key piano A0–C8)', () => {
    const ctx = makeVkbContext();
    const onKeyDown = vi.fn();
    const onKeyUp = vi.fn();
    render(<PracticeVirtualKeyboard context={ctx} onKeyDown={onKeyDown} onKeyUp={onKeyUp} />);
    const keyboard = screen.getByTestId('practice-vkb-keyboard');
    const blackKeys = keyboard.querySelectorAll('.practice-vkb__key--black');
    expect(blackKeys.length).toBe(36); // standard 88-key piano
  });

  // ── Range label & scroll buttons

  it('range label defaults to C3–C5 (centred on C4)', () => {
    const ctx = makeVkbContext();
    render(<PracticeVirtualKeyboard context={ctx} onKeyDown={vi.fn()} onKeyUp={vi.fn()} />);
    const rangeLabel = screen.getByTestId('vkb-range-label');
    expect(rangeLabel.textContent).toContain('C3');
    expect(rangeLabel.textContent).toContain('C5');
  });

  it('scroll-right button increments the range label by one octave', async () => {
    const ctx = makeVkbContext();
    render(<PracticeVirtualKeyboard context={ctx} onKeyDown={vi.fn()} onKeyUp={vi.fn()} />);
    const upBtn = screen.getByTestId('vkb-octave-up');
    await act(async () => { fireEvent.click(upBtn); });
    const rangeLabel = screen.getByTestId('vkb-range-label');
    expect(rangeLabel.textContent).toContain('C4');
    expect(rangeLabel.textContent).toContain('C6');
  });

  it('scroll-left button decrements the range label by one octave', async () => {
    const ctx = makeVkbContext();
    render(<PracticeVirtualKeyboard context={ctx} onKeyDown={vi.fn()} onKeyUp={vi.fn()} />);
    const downBtn = screen.getByTestId('vkb-octave-down');
    await act(async () => { fireEvent.click(downBtn); });
    const rangeLabel = screen.getByTestId('vkb-range-label');
    expect(rangeLabel.textContent).toContain('C2');
    expect(rangeLabel.textContent).toContain('C4');
  });

  // ── onKeyDown callback ─────────────────────────────────────────────────

  it('calls onKeyDown with correct midiNote=48 (C3) on mouse press at shift=0', async () => {
    const ctx = makeVkbContext();
    const onKeyDown = vi.fn();
    const onKeyUp = vi.fn();
    render(<PracticeVirtualKeyboard context={ctx} onKeyDown={onKeyDown} onKeyUp={onKeyUp} />);
    const c3Key = screen.getByTestId('vkb-key-48'); // C3 = MIDI 48
    await act(async () => { fireEvent.mouseDown(c3Key); });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onKeyDown.mock.calls[0][0]).toBe(48);
  });

  // ── onKeyUp callback ───────────────────────────────────────────────────

  it('calls onKeyUp with correct midiNote=48 (C3) on mouse release', async () => {
    const ctx = makeVkbContext();
    const onKeyDown = vi.fn();
    const onKeyUp = vi.fn();
    render(<PracticeVirtualKeyboard context={ctx} onKeyDown={onKeyDown} onKeyUp={onKeyUp} />);
    const c3Key = screen.getByTestId('vkb-key-48');
    await act(async () => {
      fireEvent.mouseDown(c3Key);
      fireEvent.mouseUp(c3Key);
    });
    expect(onKeyUp).toHaveBeenCalledTimes(1);
    expect(onKeyUp.mock.calls[0][0]).toBe(48);
  });

  // ── context.playNote calls ──────────────────────────────────────────────

  it('calls context.playNote with type=attack on key press', async () => {
    const ctx = makeVkbContext();
    const onKeyDown = vi.fn();
    const onKeyUp = vi.fn();
    render(<PracticeVirtualKeyboard context={ctx} onKeyDown={onKeyDown} onKeyUp={onKeyUp} />);
    const c3Key = screen.getByTestId('vkb-key-48');
    await act(async () => { fireEvent.mouseDown(c3Key); });
    expect(ctx.playNote).toHaveBeenCalledWith(
      expect.objectContaining({ midiNote: 48, type: 'attack' })
    );
  });

  it('calls context.playNote with type=release on key release', async () => {
    const ctx = makeVkbContext();
    const onKeyDown = vi.fn();
    const onKeyUp = vi.fn();
    render(<PracticeVirtualKeyboard context={ctx} onKeyDown={onKeyDown} onKeyUp={onKeyUp} />);
    const c3Key = screen.getByTestId('vkb-key-48');
    await act(async () => {
      fireEvent.mouseDown(c3Key);
      fireEvent.mouseUp(c3Key);
    });
    expect(ctx.playNote).toHaveBeenCalledWith(
      expect.objectContaining({ midiNote: 48, type: 'release' })
    );
  });

  // ── Visual pressed state ────────────────────────────────────────────────

  it('adds pressed CSS class to the key on mouse press', async () => {
    const ctx = makeVkbContext();
    const onKeyDown = vi.fn();
    const onKeyUp = vi.fn();
    render(<PracticeVirtualKeyboard context={ctx} onKeyDown={onKeyDown} onKeyUp={onKeyUp} />);
    const c3Key = screen.getByTestId('vkb-key-48');
    await act(async () => { fireEvent.mouseDown(c3Key); });
    expect(c3Key.className).toContain('practice-vkb__key--pressed');
  });

  it('removes pressed CSS class from the key on mouse release', async () => {
    const ctx = makeVkbContext();
    const onKeyDown = vi.fn();
    const onKeyUp = vi.fn();
    render(<PracticeVirtualKeyboard context={ctx} onKeyDown={onKeyDown} onKeyUp={onKeyUp} />);
    const c3Key = screen.getByTestId('vkb-key-48');
    await act(async () => {
      fireEvent.mouseDown(c3Key);
      fireEvent.mouseUp(c3Key);
    });
    expect(c3Key.className).not.toContain('practice-vkb__key--pressed');
  });

  // ── Touch guard ──────────────────────────────────────────────────────

  it('ignores a mouse press that fires within 500 ms of a touch start', async () => {
    const ctx = makeVkbContext();
    const onKeyDown = vi.fn();
    const onKeyUp = vi.fn();
    render(<PracticeVirtualKeyboard context={ctx} onKeyDown={onKeyDown} onKeyUp={onKeyUp} />);
    const c3Key = screen.getByTestId('vkb-key-48');
    await act(async () => {
      // Simulate touch start (sets lastTouchTimeRef)
      fireEvent.touchStart(c3Key, { touches: [{ identifier: 0, target: c3Key }] });
      // Immediately fire mouse down — should be ignored (within 500 ms)
      fireEvent.mouseDown(c3Key);
    });
    // playNote should be called once (from touch) but NOT twice (mouseDown ignored)
    const attackCalls = (ctx.playNote as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([e]: [{ type: string }]) => e.type === 'attack'
    );
    expect(attackCalls.length).toBe(1);
  });
});
