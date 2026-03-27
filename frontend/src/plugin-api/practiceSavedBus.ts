/**
 * Practice-saved event bus — Feature 060: Sessions Plugin (v8)
 *
 * Module-level pub-sub for PracticeSavedEvent. Any plugin can subscribe
 * (via context.onPracticeSaved) and any plugin can broadcast after a
 * successful practice save.
 */

import type { PracticeSavedEvent } from './types';

type Handler = (event: PracticeSavedEvent) => void;
const handlers = new Set<Handler>();

export function subscribePracticeSaved(handler: Handler): () => void {
  handlers.add(handler);
  return () => { handlers.delete(handler); };
}

export function broadcastPracticeSaved(event: PracticeSavedEvent): void {
  handlers.forEach((h) => h(event));
}
