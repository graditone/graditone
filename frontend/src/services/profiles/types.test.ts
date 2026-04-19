/**
 * Feature 080 — User Profile Support
 * Unit tests for types.ts (validateProfileName, generateProfileId)
 * Constitution: V. Test-First Development
 */
import { describe, it, expect } from 'vitest';
import { validateProfileName, generateProfileId, MAX_PROFILE_NAME_LENGTH } from './types';

describe('validateProfileName', () => {
  it('returns error for empty string', () => {
    expect(validateProfileName('')).toBe('Profile name cannot be empty');
  });

  it('returns error for whitespace-only string', () => {
    expect(validateProfileName('   ')).toBe('Profile name cannot be empty');
  });

  it('returns null for a valid name', () => {
    expect(validateProfileName('Alice')).toBeNull();
  });

  it('returns null for a name with leading/trailing whitespace (after trim)', () => {
    expect(validateProfileName('  Bob  ')).toBeNull();
  });

  it('returns error when name exceeds max length', () => {
    const longName = 'A'.repeat(MAX_PROFILE_NAME_LENGTH + 1);
    expect(validateProfileName(longName)).toBe(
      `Profile name cannot exceed ${MAX_PROFILE_NAME_LENGTH} characters`
    );
  });

  it('returns null for a name at exactly max length', () => {
    const exactName = 'A'.repeat(MAX_PROFILE_NAME_LENGTH);
    expect(validateProfileName(exactName)).toBeNull();
  });
});

describe('generateProfileId', () => {
  it('returns a UUID string', () => {
    const id = generateProfileId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('generates unique IDs', () => {
    const id1 = generateProfileId();
    const id2 = generateProfileId();
    expect(id1).not.toBe(id2);
  });
});
