import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoadScoreDialog } from './LoadScoreDialog';
import type { ImportResult } from '../../services/import/MusicXMLImportService';

// --- helpers -----------------------------------------------------------------

function makeOnImportComplete() {
  return vi.fn<[ImportResult], void>();
}

// <dialog> showModal / close are not implemented in jsdom
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn();
  HTMLDialogElement.prototype.close = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// --- T010: open/close/dismiss tests -----------------------------------------

describe('LoadScoreDialog — open/close/dismiss', () => {
  it('calls showModal when open=true', () => {
    render(
      <LoadScoreDialog
        open={true}
        onClose={vi.fn()}
        onImportComplete={makeOnImportComplete()}
      />,
    );
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledTimes(1);
  });

  it('calls dialog.close() when open changes false→true→false', () => {
    const { rerender } = render(
      <LoadScoreDialog
        open={true}
        onClose={vi.fn()}
        onImportComplete={makeOnImportComplete()}
      />,
    );
    rerender(
      <LoadScoreDialog
        open={false}
        onClose={vi.fn()}
        onImportComplete={makeOnImportComplete()}
      />,
    );
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalledTimes(1);
  });

  it('renders preloaded score list heading', () => {
    render(
      <LoadScoreDialog
        open={true}
        onClose={vi.fn()}
        onImportComplete={makeOnImportComplete()}
      />,
    );
    expect(screen.getByText(/preloaded scores/i)).toBeInTheDocument();
  });

  it('calls onClose when Close / Cancel button is clicked', () => {
    const onClose = vi.fn();
    render(
      <LoadScoreDialog
        open={true}
        onClose={onClose}
        onImportComplete={makeOnImportComplete()}
      />,
    );
    // The footer cancel button
    fireEvent.click(screen.getByRole('button', { name: /cancel/i, hidden: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// --- T016: fetch / preloaded score selection tests ---------------------------

describe('LoadScoreDialog — preloaded score selection', () => {
  it('shows a list of preloaded scores equal to PRELOADED_SCORES length', () => {
    render(
      <LoadScoreDialog
        open={true}
        onClose={vi.fn()}
        onImportComplete={makeOnImportComplete()}
      />,
    );
    // Each score should be rendered as a clickable button (hidden: true needed for closed <dialog> in jsdom)
    const items = screen.getAllByRole('button', { name: /Bach|Beethoven|Burgm|Chopin|Pachelbel/i, hidden: true });
    expect(items.length).toBeGreaterThanOrEqual(6);
  });

  it('shows loading state while fetchin a preloaded score', async () => {
    // Mock a slow fetch
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise(() => {}), // never resolves
    );

    render(
      <LoadScoreDialog
        open={true}
        onClose={vi.fn()}
        onImportComplete={makeOnImportComplete()}
      />,
    );

    // Click the first score button
    const bachButton = screen.getAllByRole('button', { name: /Bach/i, hidden: true })[0];
    fireEvent.click(bachButton);

    await waitFor(() => {
      expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument();
    });

    fetchMock.mockRestore();
  });
});

// --- T027: regression guards --------------------------------------------------

describe('LoadScoreDialog — regression guards', () => {
  it('renders without error when userScores is an empty array', () => {
    expect(() =>
      render(
        <LoadScoreDialog
          open={true}
          onClose={vi.fn()}
          onImportComplete={makeOnImportComplete()}
          userScores={[]}
          onSelectUserScore={vi.fn()}
          onDeleteUserScore={vi.fn()}
        />,
      ),
    ).not.toThrow();

    // "My Scores" section should NOT appear when list is empty
    expect(screen.queryByText(/my scores/i)).not.toBeInTheDocument();
  });

  it('still renders ≥6 preloaded scores when userScores is provided', () => {
    render(
      <LoadScoreDialog
        open={true}
        onClose={vi.fn()}
        onImportComplete={makeOnImportComplete()}
        userScores={[]}
        onSelectUserScore={vi.fn()}
        onDeleteUserScore={vi.fn()}
      />,
    );
    const items = screen.getAllByRole('button', {
      name: /Bach|Beethoven|Burgm|Chopin|Pachelbel/i,
      hidden: true,
    });
    expect(items.length).toBeGreaterThanOrEqual(6);
  });
});

// --- T022: fetch-error tests --------------------------------------------------

describe('LoadScoreDialog — fetch error handling', () => {
  it('shows named error message when fetch rejects', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network failure'));

    render(
      <LoadScoreDialog
        open={true}
        onClose={vi.fn()}
        onImportComplete={makeOnImportComplete()}
      />,
    );

    const bachButton = screen.getAllByRole('button', { name: /Bach/i, hidden: true })[0];
    fireEvent.click(bachButton);

    await waitFor(() => {
      expect(screen.getByRole('alert', { hidden: true })).toBeInTheDocument();
    });

    const alert = screen.getByRole('alert', { hidden: true });
    expect(alert.textContent).toMatch(/Bach/);

    vi.restoreAllMocks();
  });

  it('shows Retry button after error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network failure'));

    render(
      <LoadScoreDialog
        open={true}
        onClose={vi.fn()}
        onImportComplete={makeOnImportComplete()}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: /Bach/i, hidden: true })[0]);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /retry/i, hidden: true })).toBeInTheDocument();
    });

    vi.restoreAllMocks();
  });

  it('clears error when a different score is selected', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('network failure'))
      .mockImplementation(() => new Promise(() => {})); // second call never resolves

    render(
      <LoadScoreDialog
        open={true}
        onClose={vi.fn()}
        onImportComplete={makeOnImportComplete()}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: /Bach/i, hidden: true })[0]);

    await waitFor(() => {
      expect(screen.getByRole('alert', { hidden: true })).toBeInTheDocument();
    });

    // Click a different score — error should clear
    fireEvent.click(screen.getAllByRole('button', { name: /Beethoven/i, hidden: true })[0]);

    await waitFor(() => {
      expect(screen.queryByRole('alert', { hidden: true })).not.toBeInTheDocument();
    });

    vi.restoreAllMocks();
  });
});
