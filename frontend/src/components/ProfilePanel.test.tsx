/**
 * Feature 080 — User Profile Support
 * Unit tests for ProfilePanel component
 * Constitution: V. Test-First Development
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfilePanel } from './ProfilePanel';
import type { ProfileContextValue } from '../services/profiles/ProfileContext';
import type { Profile } from '../services/profiles/types';

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'p1',
    name: 'Default',
    createdAt: '2026-01-01T00:00:00.000Z',
    lastActiveAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const mockSwitch = vi.fn();
const mockCreate = vi.fn();
const mockRename = vi.fn();
const mockDelete = vi.fn().mockResolvedValue(undefined);

let mockProfiles: Profile[];
let mockActiveProfile: Profile;

vi.mock('../services/profiles/ProfileContext', () => ({
  useProfile: (): ProfileContextValue => ({
    activeProfile: mockActiveProfile,
    profiles: mockProfiles,
    switchProfile: mockSwitch,
    createProfile: mockCreate,
    renameProfile: mockRename,
    deleteProfile: mockDelete,
    ready: true,
  }),
}));

const onClose = vi.fn();
const onProfileChange = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockActiveProfile = makeProfile();
  mockProfiles = [mockActiveProfile];
});

describe('ProfilePanel', () => {
  it('renders the profile list', () => {
    render(<ProfilePanel onClose={onClose} />);
    expect(screen.getByText('Profiles')).toBeInTheDocument();
    expect(screen.getByText('Default')).toBeInTheDocument();
  });

  it('marks the active profile with a checkmark badge', () => {
    render(<ProfilePanel onClose={onClose} />);
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('shows the "+ New Profile" button', () => {
    render(<ProfilePanel onClose={onClose} />);
    expect(screen.getByText('+ New Profile')).toBeInTheDocument();
  });

  // --- Create flow ---
  it('shows the create form when "+ New Profile" is clicked', async () => {
    const user = userEvent.setup();
    render(<ProfilePanel onClose={onClose} />);
    await user.click(screen.getByText('+ New Profile'));
    expect(screen.getByPlaceholderText('Profile name')).toBeInTheDocument();
    expect(screen.getByText('Create')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls createProfile and closes on valid create', async () => {
    mockCreate.mockReturnValue(makeProfile({ id: 'p2', name: 'Bob' }));
    const user = userEvent.setup();
    render(<ProfilePanel onClose={onClose} onProfileChange={onProfileChange} />);

    await user.click(screen.getByText('+ New Profile'));
    await user.type(screen.getByPlaceholderText('Profile name'), 'Bob');
    await user.click(screen.getByText('Create'));

    expect(mockCreate).toHaveBeenCalledWith('Bob');
    expect(onClose).toHaveBeenCalled();
    expect(onProfileChange).toHaveBeenCalled();
  });

  it('shows validation error for empty name on create', async () => {
    const user = userEvent.setup();
    render(<ProfilePanel onClose={onClose} />);

    await user.click(screen.getByText('+ New Profile'));
    await user.click(screen.getByText('Create'));

    expect(screen.getByText('Profile name cannot be empty')).toBeInTheDocument();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('handles QuotaExceededError on create', async () => {
    const error = new DOMException('Quota exceeded', 'QuotaExceededError');
    mockCreate.mockImplementation(() => { throw error; });
    const user = userEvent.setup();
    render(<ProfilePanel onClose={onClose} />);

    await user.click(screen.getByText('+ New Profile'));
    await user.type(screen.getByPlaceholderText('Profile name'), 'NewProfile');
    await user.click(screen.getByText('Create'));

    expect(screen.getByText('Storage is full. Delete a profile to free space.')).toBeInTheDocument();
  });

  // --- Switch flow ---
  it('switches profile when clicking another profile', async () => {
    const p2 = makeProfile({ id: 'p2', name: 'Bob' });
    mockProfiles = [mockActiveProfile, p2];
    const user = userEvent.setup();
    render(<ProfilePanel onClose={onClose} onProfileChange={onProfileChange} />);

    await user.click(screen.getByTitle('Switch to Bob'));

    expect(mockSwitch).toHaveBeenCalledWith('p2');
    expect(onClose).toHaveBeenCalled();
    expect(onProfileChange).toHaveBeenCalled();
  });

  it('does not call switchProfile when clicking the active profile', async () => {
    const user = userEvent.setup();
    render(<ProfilePanel onClose={onClose} />);

    await user.click(screen.getByTitle('Active profile'));

    expect(mockSwitch).not.toHaveBeenCalled();
  });

  // --- Rename flow ---
  it('shows inline edit on rename button click', async () => {
    const user = userEvent.setup();
    render(<ProfilePanel onClose={onClose} />);

    await user.click(screen.getByLabelText('Rename Default'));

    expect(screen.getByDisplayValue('Default')).toBeInTheDocument();
  });

  it('calls renameProfile on confirm', async () => {
    const user = userEvent.setup();
    render(<ProfilePanel onClose={onClose} />);

    await user.click(screen.getByLabelText('Rename Default'));
    const input = screen.getByDisplayValue('Default');
    await user.clear(input);
    await user.type(input, 'NewName');
    await user.click(screen.getByText('✓'));

    expect(mockRename).toHaveBeenCalledWith('p1', 'NewName');
  });

  it('shows validation error for empty rename', async () => {
    const user = userEvent.setup();
    render(<ProfilePanel onClose={onClose} />);

    await user.click(screen.getByLabelText('Rename Default'));
    const input = screen.getByDisplayValue('Default');
    await user.clear(input);
    await user.click(screen.getByText('✓'));

    expect(screen.getByText('Profile name cannot be empty')).toBeInTheDocument();
    expect(mockRename).not.toHaveBeenCalled();
  });

  // --- Delete flow ---
  it('does not show delete button when only one profile exists', () => {
    render(<ProfilePanel onClose={onClose} />);
    expect(screen.queryByLabelText('Delete Default')).not.toBeInTheDocument();
  });

  it('shows delete button when multiple profiles exist', () => {
    mockProfiles = [mockActiveProfile, makeProfile({ id: 'p2', name: 'Bob' })];
    render(<ProfilePanel onClose={onClose} />);
    expect(screen.getByLabelText('Delete Default')).toBeInTheDocument();
    expect(screen.getByLabelText('Delete Bob')).toBeInTheDocument();
  });

  it('shows confirmation dialog before deleting', async () => {
    mockProfiles = [mockActiveProfile, makeProfile({ id: 'p2', name: 'Bob' })];
    const user = userEvent.setup();
    render(<ProfilePanel onClose={onClose} />);

    await user.click(screen.getByLabelText('Delete Bob'));

    expect(screen.getByText(/Delete "Bob"\?/)).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls deleteProfile on confirm', async () => {
    mockProfiles = [mockActiveProfile, makeProfile({ id: 'p2', name: 'Bob' })];
    const user = userEvent.setup();
    render(<ProfilePanel onClose={onClose} />);

    await user.click(screen.getByLabelText('Delete Bob'));
    await user.click(screen.getByText('Delete'));

    expect(mockDelete).toHaveBeenCalledWith('p2');
  });

  it('cancels deletion on cancel click', async () => {
    mockProfiles = [mockActiveProfile, makeProfile({ id: 'p2', name: 'Bob' })];
    const user = userEvent.setup();
    render(<ProfilePanel onClose={onClose} />);

    await user.click(screen.getByLabelText('Delete Bob'));
    await user.click(screen.getByText('Cancel'));

    expect(mockDelete).not.toHaveBeenCalled();
    // Normal view is restored
    expect(screen.getByTitle('Switch to Bob')).toBeInTheDocument();
  });
});
