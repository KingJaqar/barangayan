import type { Href } from 'expo-router';
import type { InboxItem } from '../../data/resident-api';
import { destinationHref, inboxEntry, parsePushData } from './model';

/** Where a notification tap leads. The inbox outcomes carry a reason the inbox explains; no record content is ever put in it. */
export type TapOutcome =
  | { kind: 'open'; href: Href; inboxId: string }
  | { kind: 'inbox'; reason: 'malformed' | 'unavailable' | 'unreachable' };

export type TapReader = (inboxId: string, signal: AbortSignal) => Promise<InboxItem | null>;

/**
 * Resolves the data of a tapped notification (cold start, background or foreground alike).
 *
 * The payload is only a pointer. The target is taken from the signed-in resident's own stored inbox row, read through
 * row-level security, so a notification meant for another account, a purged entry or a forged payload cannot open anything:
 * it falls back to the inbox. The payload and the stored row must agree, and the stored destination must be allowlisted.
 * The destination screen then re-reads the record itself, which is what handles a deleted or no longer visible record.
 */
export async function resolveTap(data: unknown, read: TapReader, signal: AbortSignal): Promise<TapOutcome> {
  const pushed = parsePushData(data);
  if (!pushed) return { kind: 'inbox', reason: 'malformed' };
  const item = await read(pushed.inboxId, signal);
  if (!item) return { kind: 'inbox', reason: 'unavailable' };
  const stored = inboxEntry(item).destination;
  if (!stored || stored.kind !== pushed.destination.kind || stored.id !== pushed.destination.id) return { kind: 'inbox', reason: 'malformed' };
  return { kind: 'open', href: destinationHref(stored), inboxId: item.id };
}

/**
 * Remembers which notification responses were already handled so the same tap is never routed twice (the last response
 * is re-delivered after a re-render, a foreground return or a restart of the listener). Bounded, oldest first.
 */
export function createReplayGuard(limit = 50) {
  const seen = new Set<string>();
  return {
    /** True when the response was handled before; otherwise records it and returns false. */
    handled(responseId: string): boolean {
      if (seen.has(responseId)) return true;
      seen.add(responseId);
      if (seen.size > limit) seen.delete(seen.values().next().value as string);
      return false;
    },
  };
}
