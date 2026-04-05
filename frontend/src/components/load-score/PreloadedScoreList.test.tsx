import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PreloadedScoreList } from './PreloadedScoreList';
import { LocaleProvider } from '../../i18n/index';
import { PRELOADED_SCORES } from '../../data/preloadedScores';

const W = ({ children }: { children: React.ReactNode }) => <LocaleProvider locale="en">{children}</LocaleProvider>;

describe('PreloadedScoreList', () => {
  it('renders all preloaded scores', () => {
    render(
      <W><PreloadedScoreList
        scores={PRELOADED_SCORES}
        onSelect={vi.fn()}
      /></W>,
    );

    for (const score of PRELOADED_SCORES) {
      expect(screen.getByText(score.displayName)).toBeInTheDocument();
    }
  });

  it('calls onSelect with the correct score when an item is clicked', () => {
    const onSelect = vi.fn();
    render(
      <W><PreloadedScoreList
        scores={PRELOADED_SCORES}
        onSelect={onSelect}
      /></W>,
    );

    fireEvent.click(screen.getByText('Bach — Invention No. 1'));
    expect(onSelect).toHaveBeenCalledWith(PRELOADED_SCORES[0]);
  });

  it('highlights the selected score', () => {
    render(
      <W><PreloadedScoreList
        scores={PRELOADED_SCORES}
        selectedId="bach-invention-1"
        onSelect={vi.fn()}
      /></W>,
    );

    const item = screen.getByText('Bach — Invention No. 1').closest('[data-selected]');
    expect(item).toHaveAttribute('data-selected', 'true');
  });

  it('disables all items when disabled=true', () => {
    render(
      <W><PreloadedScoreList
        scores={PRELOADED_SCORES}
        onSelect={vi.fn()}
        disabled
      /></W>,
    );

    const buttons = screen.getAllByRole('button');
    for (const btn of buttons) {
      expect(btn).toBeDisabled();
    }
  });
});
