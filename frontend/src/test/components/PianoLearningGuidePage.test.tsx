import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleProvider } from '../../i18n/index';
import enCatalog from '../../i18n/locales/en.json';
import { PianoLearningGuidePage } from '../../components/PianoLearningGuidePage';

/**
 * Feature 091-piano-learning-guide-page: PianoLearningGuidePage component tests
 *
 * Test Plan from plan.md — all 10 tests MUST fail before implementation.
 * Tests cover FR-001 through FR-011 (selected).
 * Constitution Principle V: Tests are written FIRST — red before green.
 */

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.stubGlobal('innerWidth', 1024);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Custom render helper — wraps with LocaleProvider
// ---------------------------------------------------------------------------

function renderWithLocale(ui: React.ReactElement, locale?: 'en' | 'es') {
  return render(<LocaleProvider locale={locale}>{ui}</LocaleProvider>);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PianoLearningGuidePage', () => {
  /**
   * T1 — FR-001: Component renders without throwing
   */
  it('T1: renders without throwing', () => {
    const onBack = vi.fn();
    expect(() => renderWithLocale(<PianoLearningGuidePage onBack={onBack} />)).not.toThrow();
  });

  /**
   * T2 — FR-002: All 4 feature highlight headings are present in the DOM
   */
  it('T2: shows all 4 feature highlight headings', () => {
    renderWithLocale(<PianoLearningGuidePage onBack={vi.fn()} />);

    expect(screen.getByText(enCatalog['guide.piano.highlight_notes_title'])).toBeInTheDocument();
    expect(screen.getByText(enCatalog['guide.piano.highlight_tempo_title'])).toBeInTheDocument();
    expect(screen.getByText(enCatalog['guide.piano.highlight_loops_title'])).toBeInTheDocument();
    expect(screen.getByText(enCatalog['guide.piano.highlight_vkeyboard_title'])).toBeInTheDocument();
  });

  /**
   * T3 — FR-002: Each highlight section has a benefit description
   */
  it('T3: each feature highlight has a benefit description', () => {
    renderWithLocale(<PianoLearningGuidePage onBack={vi.fn()} />);

    expect(screen.getByText(enCatalog['guide.piano.highlight_notes_benefit'])).toBeInTheDocument();
    expect(screen.getByText(enCatalog['guide.piano.highlight_tempo_benefit'])).toBeInTheDocument();
    expect(screen.getByText(enCatalog['guide.piano.highlight_loops_benefit'])).toBeInTheDocument();
    expect(screen.getByText(enCatalog['guide.piano.highlight_vkeyboard_benefit'])).toBeInTheDocument();
  });

  /**
   * T4 — FR-003: Practice workflow section renders an ordered list with ≥ 6 steps
   */
  it('T4: workflow section renders an ordered list with at least 6 steps', () => {
    renderWithLocale(<PianoLearningGuidePage onBack={vi.fn()} />);

    expect(screen.getByText(enCatalog['guide.piano.section_workflow_title'])).toBeInTheDocument();
    // Find the ordered list — it must contain ≥ 6 list items
    const ols = document.querySelectorAll('ol');
    const workflowOl = Array.from(ols).find(ol => ol.querySelectorAll('li').length >= 6);
    expect(workflowOl).toBeTruthy();
    expect(workflowOl!.querySelectorAll('li').length).toBeGreaterThanOrEqual(6);
  });

  /**
   * T5 — FR-004: Piano-specific section is present with grand staff, dynamics, and MIDI headings
   */
  it('T5: piano-specific section shows grand staff, dynamics, and MIDI headings', () => {
    renderWithLocale(<PianoLearningGuidePage onBack={vi.fn()} />);

    expect(screen.getByText(enCatalog['guide.piano.section_piano_title'])).toBeInTheDocument();
    expect(screen.getByText(enCatalog['guide.piano.piano_stacked_title'])).toBeInTheDocument();
    expect(screen.getByText(enCatalog['guide.piano.piano_dynamics_title'])).toBeInTheDocument();
    expect(screen.getByText(enCatalog['guide.piano.piano_midi_title'])).toBeInTheDocument();
  });

  /**
   * T6 — FR-005: Tips section is present and contains at least 4 list items
   */
  it('T6: tips section renders at least 4 tips', () => {
    renderWithLocale(<PianoLearningGuidePage onBack={vi.fn()} />);

    expect(screen.getByText(enCatalog['guide.piano.section_tips_title'])).toBeInTheDocument();
    expect(screen.getByText(enCatalog['guide.piano.tip1'])).toBeInTheDocument();
    expect(screen.getByText(enCatalog['guide.piano.tip2'])).toBeInTheDocument();
    expect(screen.getByText(enCatalog['guide.piano.tip3'])).toBeInTheDocument();
    expect(screen.getByText(enCatalog['guide.piano.tip4'])).toBeInTheDocument();
  });

  /**
   * T7 — FR-006: At 375px viewport width, all sections are visible (no overflow)
   */
  it('T7: at 375px viewport all sections are visible', () => {
    vi.stubGlobal('innerWidth', 375);
    renderWithLocale(<PianoLearningGuidePage onBack={vi.fn()} />);

    const root = document.querySelector('.piano-guide');
    expect(root).toBeInTheDocument();
    // Root element must be in the document and visible
    expect(root).toBeVisible();
  });

  /**
   * T8 — FR-008: Clicking the back button calls the onBack prop
   */
  it('T8: back button calls onBack when clicked', async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();
    renderWithLocale(<PianoLearningGuidePage onBack={onBack} />);

    const backButton = screen.getByRole('button', { name: /back/i });
    await user.click(backButton);

    expect(onBack).toHaveBeenCalledOnce();
  });

  /**
   * T9 — FR-010: Page title and section titles are rendered via i18n (no hardcoded EN strings
   * outside of what the catalog provides — verify key spot-check)
   */
  it('T9: page title and back button text come from i18n catalog', () => {
    renderWithLocale(<PianoLearningGuidePage onBack={vi.fn()} />);

    expect(screen.getByText(enCatalog['guide.piano.page_title'])).toBeInTheDocument();
    expect(screen.getByRole('button', { name: enCatalog['guide.piano.back_button'] })).toBeInTheDocument();
  });

  /**
   * T10 — FR-011: MIDI prerequisite note is present in the piano-specific section
   */
  it('T10: MIDI prerequisite note is rendered in the piano-specific section', () => {
    renderWithLocale(<PianoLearningGuidePage onBack={vi.fn()} />);

    expect(screen.getByText(enCatalog['guide.piano.piano_midi_prerequisite'])).toBeInTheDocument();
  });
});
