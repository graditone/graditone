/**
 * PracticeTimingDetails.test.tsx — Feature 101 (T014)
 *
 * Per-note timing table + delay chart extracted from ResultsOverlay.
 * Verifies the stable DOM contract: existing columns/classes/aria-labels,
 * `beatDeltaMs ?? relativeDeltaMs` value selection, strict failure marking,
 * and the early-release shortfall status.
 */

import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import React from 'react';
import { PracticeTimingDetails } from './PracticeTimingDetails';
import type { PracticeNoteResult } from './practiceEngine.types';
import { LocaleProvider } from '../../src/i18n/index';

/** Provide LocaleProvider for tests */
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <LocaleProvider locale="en">{children}</LocaleProvider>;
}

/** Build a PracticeNoteResult with sensible defaults plus overrides. */
function makeResult(
  noteIndex: number,
  overrides: Partial<PracticeNoteResult> = {},
): PracticeNoteResult {
  return {
    noteIndex,
    outcome: 'correct',
    playedMidi: 60,
    expectedMidi: [60 + noteIndex],
    responseTimeMs: 1000 + noteIndex * 500,
    expectedTimeMs: 1000 + noteIndex * 500,
    relativeDeltaMs: 0,
    wrongAttempts: 0,
    holdDurationMs: 0,
    requiredHoldMs: 0,
    ...overrides,
  } as PracticeNoteResult;
}

function renderDetails(results: PracticeNoteResult[]) {
  const utils = render(<PracticeTimingDetails results={results} />, { wrapper: TestWrapper });
  return utils;
}

/** Open both collapsible sections so their contents are queryable. */
function openDetails(container: HTMLElement) {
  const summaries = container.querySelectorAll('.practice-results__details-summary');
  for (const s of summaries) fireEvent.click(s);
}

describe('PracticeTimingDetails (feature 101, T014)', () => {
  it('renders the existing table columns, row classes and aria-label', () => {
    const { container } = renderDetails([
      makeResult(0, { outcome: 'correct-late', relativeDeltaMs: 120 }),
    ]);
    openDetails(container);
    const table = container.querySelector('table[aria-label="Per-note results"]');
    expect(table).not.toBeNull();
    expect(container.querySelector('.practice-results__table')).not.toBeNull();
    expect(container.querySelector('.practice-results__details-summary')).not.toBeNull();
    // Column headers: #, expected, played, status, wrong tries, timing Δ
    const headers = container.querySelectorAll('th');
    expect(headers.length).toBe(6);
    const row = container.querySelector('.practice-results__row--correct-late');
    expect(row).not.toBeNull();
    // Status cell is the 4th column (0:#, 1:expected, 2:played, 3:status)
    expect(row!.children[3].textContent).toContain('+120 ms');
    expect(row!.children[3].textContent).toContain('⏱️');
  });

  it('uses beatDeltaMs ?? relativeDeltaMs for the timing Δ column', () => {
    const { container } = renderDetails([
      makeResult(0, {
        outcome: 'correct-late',
        relativeDeltaMs: 0,
        beatDeltaMs: 150,
        strictFailure: true,
      }),
    ]);
    openDetails(container);
    const row = container.querySelector('.practice-results__row--strict-failure');
    expect(row).not.toBeNull();
    // Timing Δ cell is the 6th column (index 5)
    expect(row!.children[5].textContent).toContain('+150 ms');
    // The strict beat delta wins over the legacy relative delta
  });

  it('prefers relativeDeltaMs when beatDeltaMs is absent (legacy results)', () => {
    const { container } = renderDetails([
      makeResult(0, { outcome: 'correct-late', relativeDeltaMs: 333 }),
    ]);
    openDetails(container);
    const row = container.querySelector('.practice-results__row--correct-late');
    expect(row).not.toBeNull();
    expect(row!.children[5].textContent).toContain('+333 ms');
  });

  it('renders the dash for zero grace deltas where the existing UI does', () => {
    const { container } = renderDetails([
      makeResult(0, { outcome: 'correct', relativeDeltaMs: 0, beatDeltaMs: 0 }),
      makeResult(1, { outcome: 'correct', relativeDeltaMs: 0 }),
    ]);
    openDetails(container);
    const rows = container.querySelectorAll('.practice-results__row--correct');
    expect(rows.length).toBe(2);
    for (const row of rows) {
      expect(row.children[5].textContent).toBe('—');
    }
  });

  it('marks a strict onset failure row with the strict-failure class and shows the signed beat delta', () => {
    const { container } = renderDetails([
      makeResult(0, {
        outcome: 'correct-late',
        // Legacy interval delta is below the 500 ms threshold — strict mode
        // still flags this onset via beatDeltaMs.
        relativeDeltaMs: 120,
        beatDeltaMs: 200,
        strictFailure: true,
      }),
    ]);
    openDetails(container);
    const row = container.querySelector('.practice-results__row--strict-failure');
    expect(row).not.toBeNull();
    // Strict failure class comes IN ADDITION to the outcome class
    expect(row!.className).toContain('practice-results__row--correct-late');
    // Status shows the signed beat delta, not the legacy relative delta
    expect(row!.children[3].textContent).toContain('+200 ms');
    expect(row!.children[3].textContent).not.toContain('+120 ms');
  });

  it('shows the early-release shortfall for a strict early release', () => {
    const { container } = renderDetails([
      makeResult(0, {
        outcome: 'early-release',
        relativeDeltaMs: -80,
        requiredHoldMs: 2000,
        holdDurationMs: 800,
        strictFailure: true,
      }),
    ]);
    openDetails(container);
    const row = container.querySelector('.practice-results__row--strict-failure');
    expect(row).not.toBeNull();
    // 2000 − 800 = 1200 ms short of the required hold
    expect(row!.children[3].textContent).toContain('Released 1200 ms early');
    // Not the legacy relative-delta label
    expect(row!.children[3].textContent).not.toContain('-80 ms');
  });

  it('keeps formatStateLabel(relativeDeltaMs) for a legacy early release', () => {
    const { container } = renderDetails([
      makeResult(0, { outcome: 'early-release', relativeDeltaMs: -80 }),
    ]);
    openDetails(container);
    const row = container.querySelector('.practice-results__row--early-release');
    expect(row).not.toBeNull();
    expect(row!.className).not.toContain('practice-results__row--strict-failure');
    expect(row!.children[3].textContent).toContain('-80 ms');
  });

  it('renders the delay chart when at least two results exist', () => {
    const { container } = renderDetails([
      makeResult(0, { outcome: 'correct-late', relativeDeltaMs: 120 }),
      makeResult(1, { outcome: 'correct', relativeDeltaMs: 0 }),
    ]);
    openDetails(container);
    const svg = container.querySelector('.practice-results__chart');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('aria-label')).toBeTruthy();
  });

  it('does not render the chart for a single result', () => {
    const { container } = renderDetails([
      makeResult(0, { outcome: 'correct-late', relativeDeltaMs: 120 }),
    ]);
    openDetails(container);
    expect(container.querySelector('.practice-results__chart')).toBeNull();
  });

  it('marks strict failure chart points and keeps legacy late points warning-styled', () => {
    const { container } = renderDetails([
      // Strict failure: correct-late with a below-legacy-threshold onset miss
      makeResult(0, {
        outcome: 'correct-late',
        relativeDeltaMs: 120,
        beatDeltaMs: 200,
        strictFailure: true,
      }),
      // Legacy late: correct-late without the strict flag
      makeResult(1, { outcome: 'correct-late', relativeDeltaMs: 600 }),
      // In-time
      makeResult(2, { outcome: 'correct', relativeDeltaMs: 0 }),
    ]);
    openDetails(container);
    const svg = container.querySelector('.practice-results__chart');
    expect(svg).not.toBeNull();
    const circles = svg!.querySelectorAll('circle');
    // Two dots: one strict failure, one legacy late — the correct row has no dot
    expect(circles.length).toBe(2);
    const strictDot = svg!.querySelector('[data-strict-failure="true"]');
    expect(strictDot).not.toBeNull();
    const legacyDot = circles[1];
    expect(legacyDot.getAttribute('data-strict-failure')).toBeNull();
    // Legacy late dots keep the existing warning colour
    expect(legacyDot.getAttribute('fill')).toBe('#f57f17');
  });
});
