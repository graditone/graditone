/**
 * useUserScores.ts — React hook for reactive access to the user score index.
 * Feature 045: Persist Uploaded Scores
 *
 * Wraps userScoreIndex CRUD with useState so components re-render on changes.
 */
import { useState, useCallback, useEffect } from 'react';
import {
  listUserScores,
  addUserScore as indexAdd,
  removeUserScore as indexRemove,
  type UserScore,
} from '../services/userScoreIndex';
import type { DifficultyLevel } from '../types/score';
import { useProfile } from '../services/profiles/ProfileContext';

export interface UseUserScoresResult {
  userScores: UserScore[];
  addUserScore: (id: string, rawDisplayName: string, difficulty_level?: DifficultyLevel) => { entry: UserScore; evictedIds: string[] };
  removeUserScore: (id: string) => void;
  refreshUserScores: () => void;
}

/**
 * Hook that exposes the user-uploaded score list with reactive updates.
 * Call `addUserScore` / `removeUserScore` from upload/delete handlers to
 * trigger re-renders wherever this hook is used.
 */
export function useUserScores(): UseUserScoresResult {
  const { activeProfile } = useProfile();
  const [userScores, setUserScores] = useState<UserScore[]>(() =>
    listUserScores()
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUserScores(listUserScores());
  }, [activeProfile.id]);

  const addUserScore = useCallback(
    (id: string, rawDisplayName: string, difficulty_level?: DifficultyLevel): { entry: UserScore; evictedIds: string[] } => {
      const result = indexAdd(id, rawDisplayName, difficulty_level);
      setUserScores(listUserScores());
      return result;
    },
    []
  );

  const removeUserScore = useCallback((id: string): void => {
    indexRemove(id);
    setUserScores(listUserScores());
  }, []);

  const refreshUserScores = useCallback((): void => {
    setUserScores(listUserScores());
  }, []);

  return { userScores, addUserScore, removeUserScore, refreshUserScores };
}
