import type { Score } from '../../types/score';
import { CURRENT_SCHEMA_VERSION } from '../storage/local-storage';

/**
 * Save a score to a JSON file using browser download
 * Creates a Blob with pretty-printed JSON and triggers download via anchor element
 * 
 * @param score - Score object to save
 * @param filename - Optional filename (without extension). Defaults to 'score'
 * 
 * @example
 * ```ts
 * const score = await apiClient.getScore(scoreId);
 * saveScore(score, 'my-symphony');
 * // Downloads: my-symphony.graditone.json
 * ```
 */
export function saveScore(score: Score, filename?: string): void {
  // Sanitize and prepare filename
  const sanitizedFilename = sanitizeFilename(filename || 'score');
  const fullFilename = ensureExtension(sanitizedFilename, '.graditone.json');

  // Convert score to pretty-printed JSON
  const json = JSON.stringify(score, null, 2);

  // Create Blob with JSON content
  const blob = new Blob([json], { type: 'application/json' });

  // Create object URL for blob
  const url = URL.createObjectURL(blob);

  // Create temporary anchor element and trigger download
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fullFilename;
  anchor.click();

  // Clean up object URL
  URL.revokeObjectURL(url);
}

/**
 * Sanitize filename by removing or replacing invalid characters
 * Invalid filename characters: / \ : * ? " < > |
 * 
 * @param filename - Raw filename string
 * @returns Sanitized filename safe for all operating systems
 */
function sanitizeFilename(filename: string): string {
  if (!filename || filename.trim() === '') {
    return 'score';
  }

  // Remove or replace invalid filename characters
  return filename
    .replace(/[/\\:*?"<>|]/g, '-') // Replace invalid chars with dash
    .replace(/\s+/g, '-')          // Replace whitespace with dash
    .replace(/-+/g, '-')           // Collapse multiple dashes
    .replace(/^-+|-+$/g, '')       // Trim leading/trailing dashes
    .substring(0, 200)             // Limit length (Windows path limit consideration)
    || 'score';                    // Fallback if result is empty
}

/**
 * Ensure filename has the correct extension
 * Avoids duplicate extensions (e.g., file.graditone.json.graditone.json)
 * 
 * @param filename - Filename to check
 * @param extension - Extension to add (e.g., '.graditone.json')
 * @returns Filename with extension
 */
function ensureExtension(filename: string, extension: string): string {
  if (filename.endsWith(extension)) {
    return filename;
  }

  // Remove any partial extension match
  if (filename.endsWith('.graditone') || filename.endsWith('.json')) {
    filename = filename.replace(/\.(graditone|json)$/, '');
  }

  return filename + extension;
}

/**
 * Load a score from a JSON file using browser file picker
 * 
 * @param file - File object to load
 * @returns Promise resolving to parsed Score object
 * @throws Error if file reading or parsing fails
 * 
 * @example
 * ```ts
 * const file = event.target.files[0];
 * const score = await loadScore(file);
 * ```
 */
export function loadScore(file: File): Promise<Score> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const json = event.target?.result as string;
        const parsed = JSON.parse(json);
        
        // Validate that parsed result is an object (not array or primitive)
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          reject(new Error('Failed to parse score file: expected JSON object, got ' + (Array.isArray(parsed) ? 'array' : typeof parsed)));
          return;
        }
        
        const score = parsed as Score;
        resolve(score);
      } catch (error) {
        reject(new Error('Failed to parse score file: ' + (error as Error).message));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}

/**
 * Create a new empty score with default settings
 * 
 * @returns New Score object with default tempo (120 BPM) and time signature (4/4)
 * 
 * @example
 * ```ts
 * const newScore = createNewScore();
 * // Score with id, default tempo (120 BPM), time signature (4/4), no instruments
 * ```
 */
export function createNewScore(): Score {
  return {
    id: crypto.randomUUID(),
    schema_version: CURRENT_SCHEMA_VERSION,
    global_structural_events: [
      {
        Tempo: {
          tick: 0,
          bpm: 120,
        },
      },
      {
        TimeSignature: {
          tick: 0,
          numerator: 4,
          denominator: 4,
        },
      },
    ],
    instruments: [],
  };
}
