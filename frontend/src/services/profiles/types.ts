export interface Profile {
  id: string;
  name: string;
  createdAt: string;
  lastActiveAt: string;
}

export const MAX_PROFILE_NAME_LENGTH = 50;

export function validateProfileName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return 'Profile name cannot be empty';
  if (trimmed.length > MAX_PROFILE_NAME_LENGTH) return `Profile name cannot exceed ${MAX_PROFILE_NAME_LENGTH} characters`;
  return null;
}

export function generateProfileId(): string {
  return crypto.randomUUID();
}
