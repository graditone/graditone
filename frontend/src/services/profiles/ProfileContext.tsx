import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Profile } from './types';
import {
  listProfiles,
  getActiveProfile,
  createProfile as pmCreate,
  switchProfile as pmSwitch,
  renameProfile as pmRename,
  deleteProfile as pmDelete,
  migrateIfNeeded,
  notifyProfileChange,
} from './profileManager';
import { ACTIVE_PROFILE_KEY } from './profileStorage';
import { ToneAdapter } from '../playback/ToneAdapter';

export interface ProfileContextValue {
  activeProfile: Profile;
  profiles: Profile[];
  switchProfile: (id: string) => void;
  createProfile: (name: string) => Profile;
  renameProfile: (id: string, newName: string) => void;
  deleteProfile: (id: string) => Promise<void>;
  ready: boolean;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within a ProfileProvider');
  return ctx;
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [activeProfile, setActiveProfile] = useState<Profile>(() => getActiveProfile());
  const [profiles, setProfiles] = useState<Profile[]>(() => listProfiles());

  // Run migration on mount
  useEffect(() => {
    migrateIfNeeded().then(() => {
      setActiveProfile(getActiveProfile());
      setProfiles(listProfiles());
      setReady(true);
    });
  }, []);

  // Cross-tab sync: listen for storage events on the active profile key
  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === ACTIVE_PROFILE_KEY && e.newValue) {
        const updated = getActiveProfile();
        setActiveProfile(updated);
        setProfiles(listProfiles());
        notifyProfileChange(updated);
      }
    }
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleSwitch = useCallback((id: string) => {
    pmSwitch(id);
    const updated = getActiveProfile();
    setActiveProfile(updated);
    setProfiles(listProfiles());
    // Reload volume for the new profile
    try { ToneAdapter.getInstance().loadPersistedVolume(); } catch { /* not initialized yet */ }
  }, []);

  const handleCreate = useCallback((name: string): Profile => {
    const profile = pmCreate(name);
    setProfiles(listProfiles());
    return profile;
  }, []);

  const handleRename = useCallback((id: string, newName: string) => {
    pmRename(id, newName);
    setProfiles(listProfiles());
    // If renamed profile is the active one, update it
    const active = getActiveProfile();
    setActiveProfile(active);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    await pmDelete(id);
    setActiveProfile(getActiveProfile());
    setProfiles(listProfiles());
  }, []);

  const value: ProfileContextValue = {
    activeProfile,
    profiles,
    switchProfile: handleSwitch,
    createProfile: handleCreate,
    renameProfile: handleRename,
    deleteProfile: handleDelete,
    ready,
  };

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
}
