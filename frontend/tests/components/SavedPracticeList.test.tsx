/**
 * SavedPracticeList.test.tsx — Component tests for SavedPracticeList
 * Feature 056: Save and Load Practices (T010)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SavedPracticeList } from '../../src/components/load-score/SavedPracticeList';
import type { SavedPracticeIndexEntry } from '../../src/services/savedPractice.types';

const makePractice = (overrides: Partial<SavedPracticeIndexEntry> = {}): SavedPracticeIndexEntry => ({
  id: crypto.randomUUID(),
  name: 'FurElise-RH-all-20260325T140000',
  savedAt: '2026-03-25T14:00:00.000Z',
  completionStatus: 'complete',
  scoreTitle: 'Für Elise',
  ...overrides,
});

describe('SavedPracticeList', () => {
  it('returns null when practices is empty', () => {
    const { container } = render(
      <SavedPracticeList practices={[]} onSelect={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders list sorted by date (most recent first when passed in order)', () => {
    const practices = [
      makePractice({ id: 'a', name: 'Practice-A', savedAt: '2026-03-26T10:00:00Z' }),
      makePractice({ id: 'b', name: 'Practice-B', savedAt: '2026-03-25T10:00:00Z' }),
    ];
    render(<SavedPracticeList practices={practices} onSelect={vi.fn()} onDelete={vi.fn()} />);
    const items = screen.getAllByRole('listitem');
    expect(items[0].querySelector('.saved-practice-item__name')!.textContent).toBe('Practice-A');
    expect(items[1].querySelector('.saved-practice-item__name')!.textContent).toBe('Practice-B');
  });

  it('fires onSelect with the practice entry when clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const practice = makePractice({ name: 'My-Practice' });
    render(<SavedPracticeList practices={[practice]} onSelect={onSelect} onDelete={vi.fn()} />);
    await user.click(screen.getByText('My-Practice'));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(practice);
  });

  it('fires onDelete with practice id when delete button is clicked', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const practice = makePractice({ name: 'Delete-Me' });
    render(<SavedPracticeList practices={[practice]} onSelect={vi.fn()} onDelete={onDelete} />);
    await user.click(screen.getByRole('button', { name: /Delete Delete-Me/ }));
    expect(onDelete).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledWith(practice.id);
  });

  it('renders partial badge for partial practices', () => {
    const practice = makePractice({ completionStatus: 'partial' });
    render(<SavedPracticeList practices={[practice]} onSelect={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Partial')).toBeDefined();
  });

  it('does not render partial badge for complete practices', () => {
    const practice = makePractice({ completionStatus: 'complete' });
    render(<SavedPracticeList practices={[practice]} onSelect={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.queryByText('Partial')).toBeNull();
  });

  it('disables all buttons when disabled prop is true', () => {
    const practice = makePractice();
    render(
      <SavedPracticeList practices={[practice]} disabled onSelect={vi.fn()} onDelete={vi.fn()} />,
    );
    const buttons = screen.getAllByRole('button');
    for (const btn of buttons) {
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it('shows practice count in summary', () => {
    const practices = [makePractice(), makePractice()];
    render(<SavedPracticeList practices={practices} onSelect={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText(/Saved Practices \(2\)/)).toBeDefined();
  });
});
