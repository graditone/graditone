import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DifficultyTag } from '../../src/components/load-score/DifficultyTag';

describe('DifficultyTag', () => {
  it('renders nothing when level is undefined', () => {
    const { container } = render(<DifficultyTag level={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders "Easy" for level 1', () => {
    render(<DifficultyTag level={1} />);
    expect(screen.getByText('Easy')).toBeTruthy();
  });

  it('renders "Medium" for level 2', () => {
    render(<DifficultyTag level={2} />);
    expect(screen.getByText('Medium')).toBeTruthy();
  });

  it('renders "Hard" for level 3', () => {
    render(<DifficultyTag level={3} />);
    expect(screen.getByText('Hard')).toBeTruthy();
  });

  it('renders accessible aria-label for Easy', () => {
    render(<DifficultyTag level={1} />);
    expect(screen.getByLabelText('Difficulty: Easy')).toBeTruthy();
  });

  it('renders accessible aria-label for Medium', () => {
    render(<DifficultyTag level={2} />);
    expect(screen.getByLabelText('Difficulty: Medium')).toBeTruthy();
  });

  it('renders accessible aria-label for Hard', () => {
    render(<DifficultyTag level={3} />);
    expect(screen.getByLabelText('Difficulty: Hard')).toBeTruthy();
  });
});
