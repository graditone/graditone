/**
 * useUserScores.ts — React hook for reactive access to the user score index.
 * Feature 045: Persist Uploaded Scores
 *
 * Wraps userScoreIndex CRUD with useState so components re-render on changes.
 */
import { useState, useCallback } from 'react';
import {
  listUserScores,
  addUserScore as indexAdd,
  removeUserScore as indexRemove,
  type UserScore,
} from '../services/userScoreIndex';

export interface UseUserScoresResult {
  userScores: UserScore[];
  addUserScore: (id: string, rawDisplayName: string) => UserScore;
  removeUserScore: (id: string) => void;
  refreshUserScores: () => void;
}

/**
 * Hook that exposes the user-uploaded score list with reactive updates.
 * Call `addUserScore` / `removeUserScore` from upload/delete handlers to
 * trigger re-renders wherever this hook is used.
 */
export function useUserScores(): UseUserScoresResult {
  const [userScores, setUserScores] = useState<UserScore[]>(() =>
    listUserScores()
  );

  const addUserScore = useCallback(
    (id: string, rawDisplayName: string): UserScore => {
      const entry = indexAdd(id, rawDisplayName);
      setUserScores(listUserScores());
      return entry;
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
