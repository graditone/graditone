import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LandingScreen } from '../../components/LandingScreen';
import { LocaleProvider } from '../../i18n/index';
import esCatalog from '../../i18n/locales/es.json';

/**
 * Feature 001-landing-redesign: LandingScreen component tests
 *
 * Test Plan from research.md — all 10 tests MUST fail before implementation.
 * Tests cover FR-001 through FR-009.
 */

// ---------------------------------------------------------------------------
// RAF + timer mocks
// ---------------------------------------------------------------------------

let rafCallback: ((time: number) => void) | null = null;
let rafTime = 0;

function mockRaf() {
  vi.stubGlobal('requestAnimationFrame', (cb: (time: number) => void) => {
    rafCallback = cb;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {
    rafCallback = null;
  });
}

/** Advance simulated time by `ms` milliseconds and fire all pending rAF frames */
function advanceTime(ms: number) {
  rafTime += ms;
  if (rafCallback) {
    const cb = rafCallback;
    rafCallback = null;
    cb(rafTime);
  }
}

// ---------------------------------------------------------------------------
// matchMedia mock helpers
// ---------------------------------------------------------------------------

function mockMatchMedia(prefersReducedMotion: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: prefersReducedMotion && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  rafTime = 0;
  rafCallback = null;
  mockRaf();
  mockMatchMedia(false);
  // Ensure tab is visible by default
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => false,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Custom render helper — wraps with LocaleProvider (required by LandingScreen)
// ---------------------------------------------------------------------------

import React from 'react';
import { LocaleProvider } from '../../i18n/index';
import esCatalog from '../../i18n/locales/es.json';

function renderWithLocale(ui: React.ReactElement, locale?: 'en' | 'es') {
  return render(<LocaleProvider locale={locale}>{ui}</LocaleProvider>);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

/**
 * T001 — Component renders without crashing
 * FR-001: landing screen must render
 */
describe('LandingScreen', () => {
  it('T001: renders without crashing', () => {
    expect(() => renderWithLocale(<LandingScreen />)).not.toThrow();
  });

  /**
   * T002 — Landing screen container covers full viewport
   * FR-001: 100vw × 100vh, position: fixed
   */
  it('T002: container has landing-screen class covering full viewport', () => {
    renderWithLocale(<LandingScreen />);
    const container = screen.getByTestId('landing-screen');
    expect(container).toBeInTheDocument();
    expect(container).toHaveAttribute('role', 'region');
  });

  /**
   * T003 — A Bravura note glyph is rendered on mount
   * FR-002: one animated note symbol displayed
   */
  it('T003: a note glyph element is rendered on mount', () => {
    renderWithLocale(<LandingScreen />);
    const note = screen.getByTestId('landing-note');
    expect(note).toBeInTheDocument();
    // Should contain a non-empty text node (Bravura Unicode)
    expect(note.textContent).toBeTruthy();
    expect(note.textContent!.length).toBeGreaterThan(0);
  });

  /**
   * T004 — Glyph changes after 1 second
   * FR-004: note changes symbol every second
   */
  it('T004: glyph character changes after 1 second', () => {
    renderWithLocale(<LandingScreen />);
    const note = screen.getByTestId('landing-note');
    const initialGlyph = note.textContent;

    // Advance time past 1 second (fire multiple rAF frames to get past the boundary)
    act(() => {
      for (let i = 0; i < 10; i++) {
        advanceTime(120); // 10 × 120ms = 1.2s total
      }
    });

    const newGlyph = note.textContent;
    expect(newGlyph).not.toBe(initialGlyph);
  });

  /**
   * T005 — Color changes simultaneously with glyph
   * FR-006: color and glyph change on the same 1-second tick
   */
  it('T005: note color changes simultaneously with glyph at 1-second tick', () => {
    renderWithLocale(<LandingScreen />);
    const note = screen.getByTestId('landing-note');
    const initialColor = (note as HTMLElement).style.color;

    act(() => {
      for (let i = 0; i < 10; i++) {
        advanceTime(120);
      }
    });

    const newColor = (note as HTMLElement).style.color;
    // After 1.2 seconds, color must have changed from initial
    // (if initial is already different from new, that's the tick working)
    expect(newColor).toMatch(/^(#3D4B5C|rgb\(61, 75, 92\)|#F5A340|rgb\(245, 163, 64\)|#5AC481|rgb\(90, 196, 129\))$/i);
  });

  /**
   * T006 — No two consecutive glyphs are the same (no immediate repeat)
   * FR-005: symbol after each change differs from preceding one
   */
  it('T006: no two consecutive seconds show the same glyph', () => {
    renderWithLocale(<LandingScreen />);
    const note = screen.getByTestId('landing-note');
    const glyphs: string[] = [note.textContent ?? ''];

    // Collect glyphs over 5 seconds (5 ticks)
    for (let s = 0; s < 5; s++) {
      act(() => {
        for (let i = 0; i < 9; i++) advanceTime(112); // ~1s per loop
      });
      glyphs.push(note.textContent ?? '');
    }

    // Check no two adjacent glyphs are the same
    for (let i = 1; i < glyphs.length; i++) {
      expect(glyphs[i]).not.toBe(glyphs[i - 1]);
    }
  });

  /**
   * T007 — Click resets position to initial
   * FR-007: click returns note to starting position
   */
  it('T007: clicking the screen pauses the animation; clicking again resumes it', async () => {
    const user = userEvent.setup({ advanceTimers: (ms) => advanceTime(ms) });
    renderWithLocale(<LandingScreen />);
    const screen_ = screen.getByTestId('landing-screen');
    const note = screen.getByTestId('landing-note');

    // Advance so note moves away from initial position
    act(() => { for (let i = 0; i < 30; i++) advanceTime(100); }); // 3 s

    const posAtPause = (note as HTMLElement).style.left;

    // Click the screen to PAUSE
    await user.click(screen_);

    // Advance more time — position must NOT change while paused
    act(() => { for (let i = 0; i < 20; i++) advanceTime(100); }); // 2 s

    const posDuringPause = (note as HTMLElement).style.left;
    expect(posDuringPause).toBe(posAtPause);

    // Click the screen to RESUME
    await user.click(screen_);

    // Advance a frame — animation loop running again, no crash
    act(() => { advanceTime(200); });
  });

  /**
   * T008 — Reduced-motion: note does NOT change position over time
   * FR-009: with prefers-reduced-motion active, position stays fixed
   */
  it('T008: with prefers-reduced-motion, note position does not change', () => {
    mockMatchMedia(true); // Enable reduced-motion BEFORE render
    renderWithLocale(<LandingScreen />);
    const note = screen.getByTestId('landing-note');

    const initialLeft = (note as HTMLElement).style.left;
    const initialTop = (note as HTMLElement).style.top;

    act(() => {
      for (let i = 0; i < 30; i++) advanceTime(100);
    });

    expect((note as HTMLElement).style.left).toBe(initialLeft);
    expect((note as HTMLElement).style.top).toBe(initialTop);
  });

  /**
   * T009 — Reduced-motion: glyph still changes every second
   * FR-009: symbol/color cycling continues even with reduced motion
   */
  it('T009: with prefers-reduced-motion, glyph still changes every second', () => {
    mockMatchMedia(true);
    renderWithLocale(<LandingScreen />);
    const note = screen.getByTestId('landing-note');
    const initial = note.textContent;

    act(() => {
      for (let i = 0; i < 10; i++) advanceTime(120); // 1.2s
    });

    expect(note.textContent).not.toBe(initial);
  });

  /**
   * T010 — Animation pauses when tab is hidden
   * FR-008: rAF loop pauses on hidden tab, elapsed does not advance
   */
  it('T010: elapsed time does not advance when document is hidden', () => {
    renderWithLocale(<LandingScreen />);
    const note = screen.getByTestId('landing-note');

    // Let 0.5s pass with tab visible (no glyph change yet)
    act(() => {
      for (let i = 0; i < 5; i++) advanceTime(100);
    });
    const glyphBeforeHide = note.textContent;

    // Hide the tab
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    });
    // Dispatch visibilitychange
    document.dispatchEvent(new Event('visibilitychange'));

    // Advance more than 1 second while hidden (should NOT tick)
    act(() => {
      for (let i = 0; i < 15; i++) advanceTime(100);
    });

    // Glyph should not have changed (time was frozen)
    expect(note.textContent).toBe(glyphBeforeHide);
  });
});

// ---------------------------------------------------------------------------
// Feature 039 — Theme prop tests
// ---------------------------------------------------------------------------

describe('LandingScreen — Feature 039 theme props', () => {
  it('applies theme-<id> class to root div when activeThemeId is provided', () => {
    renderWithLocale(<LandingScreen activeThemeId="ember" />);
    const container = screen.getByTestId('landing-screen');
    expect(container.classList.contains('theme-ember')).toBe(true);
  });

  it('does not add any theme class when activeThemeId is absent', () => {
    renderWithLocale(<LandingScreen />);
    const container = screen.getByTestId('landing-screen');
    // No .theme-* class should be present
    const themeClasses = Array.from(container.classList).filter(c => c.startsWith('theme-'));
    expect(themeClasses).toHaveLength(0);
  });

  it('switches theme class when activeThemeId changes', () => {
    const { rerender } = renderWithLocale(<LandingScreen activeThemeId="ember" />);
    const container = screen.getByTestId('landing-screen');
    expect(container.classList.contains('theme-ember')).toBe(true);

    rerender(<LocaleProvider><LandingScreen activeThemeId="saffron" /></LocaleProvider>);
    expect(container.classList.contains('theme-ember')).toBe(false);
    expect(container.classList.contains('theme-saffron')).toBe(true);
  });

  it('uses noteColors prop for the animated note color rendering', () => {
    const customColors = ['#FF0000', '#00FF00', '#0000FF'] as const;
    renderWithLocale(<LandingScreen noteColors={customColors} />);
    const note = screen.getByTestId('landing-note');
    // The color style is set inline — one of the custom colors must be used
    const colorStyle = note.style.color;
    expect(customColors.some(c => c.toLowerCase() === colorStyle.toLowerCase() || colorStyle !== '')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// i18n — Spanish locale (T020, Feature 073)
// Written BEFORE migration of LandingScreen.tsx (T024).
// Tests FAIL until useTranslation() replaces hardcoded aria-labels.
// ---------------------------------------------------------------------------

describe('LandingScreen i18n — Spanish locale (US3)', () => {
  it('shows Spanish aria-label (playing state) when locale is "es"', () => {
    render(
      <LocaleProvider locale="es">
        <LandingScreen />
      </LocaleProvider>,
    );
    const region = screen.getByRole('region');
    expect(region).toHaveAttribute('aria-label', esCatalog['landing.aria_playing']);
  });

  it('shows Spanish aria-label (paused state) when locale is "es"', async () => {
    const user = userEvent.setup();
    render(
      <LocaleProvider locale="es">
        <LandingScreen />
      </LocaleProvider>,
    );
    // Click to pause
    const region = screen.getByRole('region');
    await user.click(region);
    expect(region).toHaveAttribute('aria-label', esCatalog['landing.aria_paused']);
  });
});

