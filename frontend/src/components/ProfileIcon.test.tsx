/**
 * Feature 080 — User Profile Support
 * Unit tests for ProfileIcon component
 * Constitution: V. Test-First Development
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProfileIcon } from './ProfileIcon';
import type { ProfileContextValue } from '../services/profiles/ProfileContext';

// Mock ProfileContext
const mockContextValue: ProfileContextValue = {
  activeProfile: {
    id: 'p1',
    name: 'Alice',
    createdAt: '2026-01-01T00:00:00.000Z',
    lastActiveAt: '2026-01-01T00:00:00.000Z',
  },
  profiles: [{
    id: 'p1',
    name: 'Alice',
    createdAt: '2026-01-01T00:00:00.000Z',
    lastActiveAt: '2026-01-01T00:00:00.000Z',
  }],
  switchProfile: vi.fn(),
  createProfile: vi.fn(),
  renameProfile: vi.fn(),
  deleteProfile: vi.fn(),
  ready: true,
};

vi.mock('../services/profiles/ProfileContext', () => ({
  useProfile: () => mockContextValue,
}));

// Mock ProfilePanel to avoid deep rendering
vi.mock('./ProfilePanel', () => ({
  ProfilePanel: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="profile-panel">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

beforeEach(() => {
  mockContextValue.ready = true;
  mockContextValue.activeProfile = {
    id: 'p1',
    name: 'Alice',
    createdAt: '2026-01-01T00:00:00.000Z',
    lastActiveAt: '2026-01-01T00:00:00.000Z',
  };
});

describe('ProfileIcon', () => {
  it('renders nothing when not ready', () => {
    mockContextValue.ready = false;
    const { container } = render(<ProfileIcon />);
    expect(container.innerHTML).toBe('');
  });

  it('renders the profile abbreviation (3-char mixed-case)', () => {
    render(<ProfileIcon />);
    const btn = screen.getByRole('button', { name: /Profile: Alice/i });
    expect(btn).toBeInTheDocument();
    // "Alice" → "Ali" → "A" + "li" → "Ali"
    expect(btn.textContent).toBe('Ali');
  });

  it('applies custom className', () => {
    const { container } = render(<ProfileIcon className="profile-icon-container--toolbar" />);
    const div = container.firstChild as HTMLElement;
    expect(div.classList.contains('profile-icon-container--toolbar')).toBe(true);
  });

  it('opens the panel on click', () => {
    render(<ProfileIcon />);
    expect(screen.queryByTestId('profile-panel')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Profile: Alice/i }));
    expect(screen.getByTestId('profile-panel')).toBeInTheDocument();
  });

  it('closes the panel when clicking outside', () => {
    render(<ProfileIcon />);
    fireEvent.click(screen.getByRole('button', { name: /Profile: Alice/i }));
    expect(screen.getByTestId('profile-panel')).toBeInTheDocument();

    // Simulate click outside
    fireEvent.mouseDown(document.body);
    expect(screen.queryByTestId('profile-panel')).not.toBeInTheDocument();
  });

  it('renders single-char name abbreviation correctly', () => {
    mockContextValue.activeProfile = {
      id: 'p2',
      name: 'X',
      createdAt: '2026-01-01T00:00:00.000Z',
      lastActiveAt: '2026-01-01T00:00:00.000Z',
    };
    render(<ProfileIcon />);
    const btn = screen.getByRole('button', { name: /Profile: X/i });
    expect(btn.textContent).toBe('X');
  });
});
