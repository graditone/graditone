import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DifficultyTag } from '../../src/components/load-score/DifficultyTag';
import { LocaleProvider } from '../../src/i18n/index';

const W = ({ children }: { children: React.ReactNode }) => <LocaleProvider locale="en">{children}</LocaleProvider>;

describe('DifficultyTag', () => {
  it('renders nothing when level is undefined', () => {
    const { container } = render(<W><DifficultyTag level={undefined} /></W>);
    expect(container.firstChild).toBeNull();
  });

  it('renders "Easy" for level 1', () => {
    render(<W><DifficultyTag level={1} /></W>);
    expect(screen.getByText('Easy')).toBeTruthy();
  });

  it('renders "Medium" for level 2', () => {
    render(<W><DifficultyTag level={2} /></W>);
    expect(screen.getByText('Medium')).toBeTruthy();
  });

  it('renders "Hard" for level 3', () => {
    render(<W><DifficultyTag level={3} /></W>);
    expect(screen.getByText('Hard')).toBeTruthy();
  });

  it('renders accessible aria-label for Easy', () => {
    render(<W><DifficultyTag level={1} /></W>);
    expect(screen.getByLabelText('Difficulty: Easy')).toBeTruthy();
  });

  it('renders accessible aria-label for Medium', () => {
    render(<W><DifficultyTag level={2} /></W>);
    expect(screen.getByLabelText('Difficulty: Medium')).toBeTruthy();
  });

  it('renders accessible aria-label for Hard', () => {
    render(<W><DifficultyTag level={3} /></W>);
    expect(screen.getByLabelText('Difficulty: Hard')).toBeTruthy();
  });
});
