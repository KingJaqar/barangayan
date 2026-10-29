import { parseNotificationDestination } from './notification-hub';

/** A tapped notification: its identifier (for replay suppression) and its data (an untrusted pointer). */
export type PushTap = { id: string; data: unknown };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * The inbox row a push points at, or null for anything else (local alerts carry no data, a forged or future payload).
 * The sender attaches exactly the destination plus `inbox` (worker `buildMessage`); the destination must be one of the
 * shapes the database accepts. The id is only a pointer: the Announcements screen re-reads it as the signed-in owner.
 */
export function pushInboxId(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const { inbox, v, kind, id, screen } = data as Record<string, unknown>;
  if (typeof inbox !== 'string' || !UUID.test(inbox)) return null;
  // Only the destination fields are read, so a provider-added key never makes a valid pointer unreadable.
  return parseNotificationDestination(screen === undefined ? { v, kind, id } : { v, kind, screen }) ? inbox : null;
}

/**
 * Remembers which responses were handled so one tap is never routed twice: the last response is re-delivered after a
 * remount or a foreground return. Bounded, oldest first.
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

/** What the app knows when a tap may be acted on. `reachable` is null while the setup state is still loading. */
export type TapContext = { restoring: boolean; userId: string | null; reachable: boolean | null };
export type TapStep = { type: 'idle' } | { type: 'wait' } | { type: 'drop' } | { type: 'open'; inboxId: string };

/**
 * The one pending tap (a newer one replaces it), bound to the account it was received for. A cold tap arrives while the
 * session is still being restored and is bound to whoever is restored; a tap for an account that has since changed, a tap
 * received signed out, or one the app cannot open (setup incomplete, password recovery) is dropped, never carried over to
 * the next account.
 */
export function createTapIntent() {
  let pending: { inboxId: string; owner: string | null; bindOnRestore: boolean } | null = null;
  return {
    receive(inboxId: string, context: Pick<TapContext, 'restoring' | 'userId'>): void {
      pending = { inboxId, owner: context.restoring ? null : context.userId, bindOnRestore: context.restoring };
    },
    settle(context: TapContext): TapStep {
      if (!pending) return { type: 'idle' };
      if (context.restoring) return { type: 'wait' };
      if (pending.bindOnRestore) { pending.owner = context.userId; pending.bindOnRestore = false; }
      if (!context.userId || pending.owner !== context.userId || context.reachable === false) { pending = null; return { type: 'drop' }; }
      if (context.reachable === null) return { type: 'wait' };
      const { inboxId } = pending;
      pending = null;
      return { type: 'open', inboxId };
    },
  };
}
