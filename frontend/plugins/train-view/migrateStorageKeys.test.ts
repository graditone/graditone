/**
 * Tests for migrateStorageKeys — Feature 036
 * Constitution Principle V: Tests written BEFORE implementation.
 *
 * Verifies the one-time migration from practice-* storage keys to train-* keys.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { migrateStorageKeys } from './migrateStorageKeys';

describe('migrateStorageKeys', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('localStorage: complexity level', () => {
    it('copies value from old key to new key and removes old key', () => {
      localStorage.setItem('practice-complexity-level-v1', 'medium');
      migrateStorageKeys();
      expect(localStorage.getItem('train-complexity-level-v1')).toBe('medium');
      expect(localStorage.getItem('practice-complexity-level-v1')).toBeNull();
    });

    it('does not overwrite new key if it already exists', () => {
      localStorage.setItem('train-complexity-level-v1', 'hard');
      localStorage.setItem('practice-complexity-level-v1', 'easy');
      migrateStorageKeys();
      expect(localStorage.getItem('train-complexity-level-v1')).toBe('hard');
      // old key is left untouched — migration is a no-op when new key present
      expect(localStorage.getItem('practice-complexity-level-v1')).toBe('easy');
    });

    it('does nothing when neither old nor new key exists', () => {
      migrateStorageKeys();
      expect(localStorage.getItem('train-complexity-level-v1')).toBeNull();
      expect(localStorage.getItem('practice-complexity-level-v1')).toBeNull();
    });
  });

  describe('sessionStorage: tips dismissed', () => {
    it('copies value from old key to new key and removes old key', () => {
      sessionStorage.setItem('practice-tips-v1-dismissed', 'yes');
      migrateStorageKeys();
      expect(sessionStorage.getItem('train-tips-v1-dismissed')).toBe('yes');
      expect(sessionStorage.getItem('practice-tips-v1-dismissed')).toBeNull();
    });

    it('does not overwrite new session key if already present', () => {
      sessionStorage.setItem('train-tips-v1-dismissed', 'yes');
      sessionStorage.setItem('practice-tips-v1-dismissed', 'yes');
      migrateStorageKeys();
      // Both present; old key untouched because new key already exists
      expect(sessionStorage.getItem('practice-tips-v1-dismissed')).toBe('yes');
    });

    it('does nothing when neither session key exists', () => {
      migrateStorageKeys();
      expect(sessionStorage.getItem('train-tips-v1-dismissed')).toBeNull();
    });
  });

  describe('idempotency', () => {
    it('second call after successful migration is a no-op', () => {
      localStorage.setItem('practice-complexity-level-v1', 'easy');
      migrateStorageKeys(); // first call — migrates
      migrateStorageKeys(); // second call — should be a no-op
      expect(localStorage.getItem('train-complexity-level-v1')).toBe('easy');
      expect(localStorage.getItem('practice-complexity-level-v1')).toBeNull();
    });

    it('multiple calls produce no errors when no keys are present', () => {
      expect(() => {
        migrateStorageKeys();
        migrateStorageKeys();
        migrateStorageKeys();
      }).not.toThrow();
    });
  });
});
