import { toast } from 'sonner';

/**
 * Admin-web notification adapter — the only module besides the Sonner host
 * (components/ui/sonner.tsx) that should import Sonner once a feature is migrated.
 *
 * It owns presentation defaults and deduplication only: it never fetches, mutates,
 * retries, or intercepts errors. The screen/action that awaited a result decides
 * whether and what to notify.
 *
 * - `beginAttempt(action)` returns a distinct ID per deliberate user attempt; pass it as
 *   `id` so repeated callbacks for the same attempt yield at most one terminal toast,
 *   while a later intentional attempt with identical text still notifies.
 * - `eventId(...parts)` returns a deterministic ID for an observed event (e.g. payment
 *   attempt + terminal state) so overlapping observers (poll + Realtime) notify once.
 *   The current session key is part of the ID.
 * - `setNotificationSession(key)` (via <NotificationSession/>) clears bookkeeping and
 *   dismisses this adapter's toasts when the signed-in account changes; attempts begun
 *   under the previous account no longer notify.
 */

export type NotifyKind = 'success' | 'error' | 'warning' | 'info';

/** Plan §4: success/info 4 s, warning 6 s, error 8 s. */
export const NOTIFY_DURATION_MS: Record<NotifyKind, number> = { success: 4000, info: 4000, warning: 6000, error: 8000 };

/** Opaque operation/event identity. Only beginAttempt()/eventId() create one. */
export type OperationId = string & { readonly __operationId: unique symbol };

export interface NotifyOptions {
  description?: string;
  /** Operation attempt or event ID; at most one toast is shown per ID. */
  id?: OperationId;
  /** Keep this toast when the session changes — only for the outcome of the action that
   * itself ends the session (sign-out, account deletion), shown on the next screen. */
  keepOnSessionChange?: boolean;
}

interface ShownToast {
  kind: NotifyKind;
  title: string;
  description?: string;
  keep: boolean;
  held: boolean;
}

const MAX_TRACKED = 200;
/** IDs issued in the current session (insertion-ordered, bounded). */
const issued = new Set<string>();
/** IDs that already produced their terminal toast in the current session. */
const delivered = new Set<string>();
/** Toasts this adapter is currently showing, keyed by Sonner toast ID. */
const shown = new Map<string, ShownToast>();

let sessionKey: string | null | undefined; // undefined until the first layout reports it
let attemptSeq = 0;
let toastSeq = 0;

function remember(set: Set<string>, value: string) {
  set.add(value);
  if (set.size > MAX_TRACKED) set.delete(set.values().next().value as string);
}

/** A new ID for one deliberate user attempt (submit, save, copy, export…). */
export function beginAttempt(action: string): OperationId {
  const id = `attempt:${action}:${++attemptSeq}`;
  remember(issued, id);
  return id as OperationId;
}

/** A deterministic ID for an observed event, scoped to the current session. */
export function eventId(...parts: Array<string | number>): OperationId {
  const id = `event:${sessionKey ?? 'guest'}:${parts.join(':')}`;
  if (!issued.has(id)) remember(issued, id);
  return id as OperationId;
}

/** Records the signed-in account (null for guests). A change from a known value to a
 * different one clears bookkeeping and dismisses this adapter's session-bound toasts. */
export function setNotificationSession(key: string | null) {
  if (sessionKey === undefined) {
    sessionKey = key;
    return;
  }
  if (sessionKey === key) return;
  sessionKey = key;
  issued.clear();
  delivered.clear();
  for (const [toastId, entry] of shown) {
    if (entry.keep) continue;
    shown.delete(toastId);
    toast.dismiss(toastId);
  }
}

function render(toastId: string, entry: ShownToast, duration: number) {
  toast[entry.kind](entry.title, {
    id: toastId,
    description: entry.description,
    duration,
    // The host reads this class to pause the timer while a toast has keyboard focus.
    className: `aw-toast ${toastId}`,
    onDismiss: () => shown.delete(toastId),
    onAutoClose: () => shown.delete(toastId),
  });
}

function show(kind: NotifyKind, title: string, options: NotifyOptions = {}): string | null {
  const { id, description, keepOnSessionChange = false } = options;
  if (id !== undefined) {
    // Unknown here means it was issued under a previous account/session (or never
    // issued) — that outcome no longer belongs to whoever is using this tab.
    if (!issued.has(id) || delivered.has(id)) return null;
    remember(delivered, id);
  }
  const toastId = `awn-${++toastSeq}`;
  // Existing callers can carry backend diagnostics. Preserve inline recovery text,
  // but keep database codes, tokens and implementation details out of popup copy.
  const diagnostics = /\bPGRST\d+\b|\bSQLSTATE\b|\b(?:22|23|42)[A-Z\d]{3}\b|violates .*?(?:constraint|policy)|invalid input syntax|relation .* does not exist|permission denied for (?:table|schema|relation)|\bJWT\b|(?:access|refresh)[_-]token|\bat \S+ \([^\n]+:\d+:\d+\)/i;
  const safeTitle = diagnostics.test(title) ? 'The action could not be completed. Review the details and try again.' : title;
  const safeDescription = description && !diagnostics.test(description) ? description : undefined;
  const entry: ShownToast = { kind, title: safeTitle, description: safeDescription, keep: keepOnSessionChange, held: false };
  shown.set(toastId, entry);
  render(toastId, entry, NOTIFY_DURATION_MS[kind]);
  return toastId;
}

export const notify = {
  success: (title: string, options?: NotifyOptions) => show('success', title, options),
  error: (title: string, options?: NotifyOptions) => show('error', title, options),
  warning: (title: string, options?: NotifyOptions) => show('warning', title, options),
  info: (title: string, options?: NotifyOptions) => show('info', title, options),
};

/** Host-only: the Sonner toast ID this adapter put on a toast element's class list. */
export function adapterToastIdOf(element: Element): string | null {
  const match = element.className.match(/\bawn-\d+\b/);
  return match && shown.has(match[0]) ? match[0] : null;
}

/** Host-only: pause auto-dismissal while the toast has keyboard focus. Sonner pauses on
 * hover and hidden pages itself; focus needs this. */
export function holdToast(toastId: string) {
  const entry = shown.get(toastId);
  if (!entry || entry.held) return;
  entry.held = true;
  render(toastId, entry, Infinity);
}

/** Host-only: resume auto-dismissal (a full duration) once focus leaves the toast. */
export function releaseToast(toastId: string) {
  const entry = shown.get(toastId);
  if (!entry || !entry.held) return;
  entry.held = false;
  render(toastId, entry, NOTIFY_DURATION_MS[entry.kind]);
}
