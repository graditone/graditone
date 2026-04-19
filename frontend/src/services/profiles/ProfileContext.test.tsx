/**
 * Feature 080 — User Profile Support
 * Unit tests for ProfileContext (ProfileProvider + useProfile hook)
 * Constitution: V. Test-First Development
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { ProfileProvider, useProfile } from './ProfileContext';
import type { Profile } from './types';

// Mock data
const defaultProfile: Profile = {
  id: 'default-1',
  name: 'Default',
  createdAt: '2026-01-01T00:00:00.000Z',
  lastActiveAt: '2026-01-01T00:00:00.000Z',
};

const mockListProfiles = vi.fn<() => Profile[]>(() => [defaultProfile]);
const mockGetActiveProfile = vi.fn<() => Profile>(() => defaultProfile);
const mockCreateProfile = vi.fn<(name: string) => Profile>();
const mockSwitchProfile = vi.fn();
const mockRenameProfile = vi.fn();
const mockDeleteProfile = vi.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined);
const mockMigrateIfNeeded = vi.fn().mockResolvedValue(undefined);
const mockNotifyProfileChange = vi.fn();

vi.mock('./profileManager', () => ({
  listProfiles: (...args: unknown[]) => mockListProfiles(...(args as [])),
  getActiveProfile: (...args: unknown[]) => mockGetActiveProfile(...(args as [])),
  createProfile: (name: string) => mockCreateProfile(name),
  switchProfile: (...args: unknown[]) => mockSwitchProfile(...args),
  renameProfile: (...args: unknown[]) => mockRenameProfile(...args),
  deleteProfile: (id: string) => mockDeleteProfile(id),
  migrateIfNeeded: () => mockMigrateIfNeeded(),
  notifyProfileChange: (...args: unknown[]) => mockNotifyProfileChange(...args),
}));

vi.mock('./profileStorage', () => ({
  ACTIVE_PROFILE_KEY: 'graditone-active-profile',
}));

vi.mock('../playback/ToneAdapter', () => ({
  ToneAdapter: {
    getInstance: () => ({
      loadPersistedVolume: vi.fn(),
    }),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockListProfiles.mockReturnValue([defaultProfile]);
  mockGetActiveProfile.mockReturnValue(defaultProfile);
  mockMigrateIfNeeded.mockResolvedValue(undefined);
});

function Wrapper({ children }: { children: React.ReactNode }) {
  return <ProfileProvider>{children}</ProfileProvider>;
}

describe('useProfile', () => {
  it('throws when used outside ProfileProvider', () => {
    // Suppress console.error for the expected error
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useProfile())).toThrow(
      'useProfile must be used within a ProfileProvider'
    );
    spy.mockRestore();
  });
});

describe('ProfileProvider', () => {
  it('runs migration on mount', async () => {
    render(
      <ProfileProvider>
        <div data-testid="child">Hello</div>
      </ProfileProvider>
    );

    await waitFor(() => {
      expect(mockMigrateIfNeeded).toHaveBeenCalledTimes(1);
    });
  });

  it('provides active profile and profiles list', async () => {
    function Consumer() {
      const { activeProfile, profiles, ready } = useProfile();
      return (
        <div>
          <span data-testid="ready">{String(ready)}</span>
          <span data-testid="active">{activeProfile.name}</span>
          <span data-testid="count">{profiles.length}</span>
        </div>
      );
    }

    render(
      <ProfileProvider>
        <Consumer />
      </ProfileProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('ready').textContent).toBe('true');
    });
    expect(screen.getByTestId('active').textContent).toBe('Default');
    expect(screen.getByTestId('count').textContent).toBe('1');
  });

  it('creates a profile and updates state', async () => {
    const newProfile: Profile = {
      id: 'new-1',
      name: 'Bob',
      createdAt: '2026-01-02T00:00:00.000Z',
      lastActiveAt: '2026-01-02T00:00:00.000Z',
    };
    mockCreateProfile.mockReturnValue(newProfile);
    mockListProfiles.mockReturnValue([defaultProfile, newProfile]);

    function Consumer() {
      const { createProfile, profiles, ready } = useProfile();
      return (
        <div>
          <span data-testid="ready">{String(ready)}</span>
          <span data-testid="count">{profiles.length}</span>
          <button onClick={() => createProfile('Bob')}>Create</button>
        </div>
      );
    }

    render(
      <ProfileProvider>
        <Consumer />
      </ProfileProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('ready').textContent).toBe('true');
    });

    act(() => {
      screen.getByText('Create').click();
    });

    expect(mockCreateProfile).toHaveBeenCalledWith('Bob');
    expect(screen.getByTestId('count').textContent).toBe('2');
  });

  it('switches profile and updates state', async () => {
    const p2: Profile = {
      id: 'p2',
      name: 'Charlie',
      createdAt: '2026-01-02T00:00:00.000Z',
      lastActiveAt: '2026-01-02T00:00:00.000Z',
    };
    mockListProfiles.mockReturnValue([defaultProfile, p2]);

    function Consumer() {
      const { switchProfile, activeProfile, ready } = useProfile();
      return (
        <div>
          <span data-testid="ready">{String(ready)}</span>
          <span data-testid="active">{activeProfile.name}</span>
          <button onClick={() => {
            mockGetActiveProfile.mockReturnValue(p2);
            switchProfile('p2');
          }}>Switch</button>
        </div>
      );
    }

    render(
      <ProfileProvider>
        <Consumer />
      </ProfileProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('ready').textContent).toBe('true');
    });

    act(() => {
      screen.getByText('Switch').click();
    });

    expect(mockSwitchProfile).toHaveBeenCalledWith('p2');
    expect(screen.getByTestId('active').textContent).toBe('Charlie');
  });

  it('deletes a profile and updates state', async () => {
    const p2: Profile = {
      id: 'p2',
      name: 'ToDelete',
      createdAt: '2026-01-02T00:00:00.000Z',
      lastActiveAt: '2026-01-02T00:00:00.000Z',
    };
    mockListProfiles.mockReturnValue([defaultProfile, p2]);

    function Consumer() {
      const { deleteProfile, profiles, ready } = useProfile();
      return (
        <div>
          <span data-testid="ready">{String(ready)}</span>
          <span data-testid="count">{profiles.length}</span>
          <button onClick={async () => {
            mockListProfiles.mockReturnValue([defaultProfile]);
            await deleteProfile('p2');
          }}>Delete</button>
        </div>
      );
    }

    render(
      <ProfileProvider>
        <Consumer />
      </ProfileProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('ready').textContent).toBe('true');
    });

    await act(async () => {
      screen.getByText('Delete').click();
    });

    expect(mockDeleteProfile).toHaveBeenCalledWith('p2');
    expect(screen.getByTestId('count').textContent).toBe('1');
  });
});
