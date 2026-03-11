/**
 * UserScoreList.test.tsx — Unit tests for the UserScoreList component.
 * Feature 045: Persist Uploaded Scores — T012
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserScoreList } from '../../components/load-score/UserScoreList';
import type { UserScore } from '../../services/userScoreIndex';

function makeScore(overrides: Partial<UserScore> = {}): UserScore {
  return {
    id: 'score-1',
    displayName: 'My Nocturne',
    uploadedAt: new Date('2024-01-15').toISOString(),
    ...overrides,
  };
}

describe('UserScoreList', () => {
  it('renders "My Scores" heading when scores.length > 0', () => {
    render(
      <UserScoreList
        scores={[makeScore()]}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByText('My Scores')).toBeInTheDocument();
  });

  it('renders each score displayName', () => {
    const scores = [
      makeScore({ id: 'a', displayName: 'Waltz' }),
      makeScore({ id: 'b', displayName: 'Mazurka' }),
    ];
    render(
      <UserScoreList scores={scores} onSelect={vi.fn()} onDelete={vi.fn()} />
    );
    expect(screen.getByText('Waltz')).toBeInTheDocument();
    expect(screen.getByText('Mazurka')).toBeInTheDocument();
  });

  it('renders nothing when scores is empty', () => {
    const { container } = render(
      <UserScoreList scores={[]} onSelect={vi.fn()} onDelete={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('calls onSelect with correct score object on row click', async () => {
    const onSelect = vi.fn();
    const score = makeScore({ id: 'sel-1', displayName: 'Prelude' });
    render(
      <UserScoreList scores={[score]} onSelect={onSelect} onDelete={vi.fn()} />
    );

    // The row button has the score name as part of its text but NOT "Remove" prefix
    const rowBtn = screen.getByRole('button', { name: /^prelude/i });
    await userEvent.click(rowBtn);
    expect(onSelect).toHaveBeenCalledWith(score);
  });

  it('calls onDelete with correct id on × button click', async () => {
    const onDelete = vi.fn();
    const score = makeScore({ id: 'del-1', displayName: 'Etude' });
    render(
      <UserScoreList scores={[score]} onSelect={vi.fn()} onDelete={onDelete} />
    );

    const deleteBtn = screen.getByRole('button', { name: /remove etude/i });
    await userEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith('del-1');
  });

  it('applies user-score-item--selected class when selectedId matches', () => {
    const score = makeScore({ id: 'active-1', displayName: 'Sonata' });
    render(
      <UserScoreList
        scores={[score]}
        selectedId="active-1"
        onSelect={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    // Row button accessible name starts with "Sonata" + date; delete button starts with "Remove"
    const rowBtn = screen.getByRole('button', { name: /^Sonata/i });
    expect(rowBtn).toHaveClass('user-score-item--selected');
  });

  it('does NOT apply selected class when selectedId does not match', () => {
    const score = makeScore({ id: 'other-1', displayName: 'Sonata' });
    render(
      <UserScoreList
        scores={[score]}
        selectedId="different-id"
        onSelect={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    const rowBtn = screen.getByRole('button', { name: /^Sonata/i });
    expect(rowBtn).not.toHaveClass('user-score-item--selected');
  });

  it('disables all buttons when disabled prop is true', () => {
    const score = makeScore({ id: 's1', displayName: 'Barcarolle' });
    render(
      <UserScoreList
        scores={[score]}
        disabled={true}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });

  it('does not disable buttons when disabled is false (default)', () => {
    const score = makeScore({ id: 's2', displayName: 'Gigue' });
    render(
      <UserScoreList scores={[score]} onSelect={vi.fn()} onDelete={vi.fn()} />
    );
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => {
      expect(btn).not.toBeDisabled();
    });
  });
});
