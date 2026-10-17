import { beginAttempt, eventId, notify, setNotificationSession } from '@/lib/notify';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const LOGIN_NOTICE_KEY = 'resident-web:login-notice:v1';
const LOGIN_NOTICE_TTL_MS = 5 * 60 * 1000;
type LoginNotice = { userId: string | null; createdAt: number };
let pendingLogin: LoginNotice | null = null;

/** A tab-local, short-lived receipt survives the round trip through Google. */
export function queueLoginNotification(userId: string | null = null) {
  pendingLogin = { userId, createdAt: Date.now() };
  try { sessionStorage.setItem(LOGIN_NOTICE_KEY, JSON.stringify(pendingLogin)); } catch { /* Storage may be disabled. */ }
}

function clearLoginNotification() {
  pendingLogin = null;
  try { sessionStorage.removeItem(LOGIN_NOTICE_KEY); } catch { /* Storage may be disabled. */ }
}

/** Consume the existing callback's short-lived receipt before any async welcome read.
 * This cookie is UI feedback only: it grants no auth or account permissions. */
function showCallbackNotification(userId: string | null) {
  if (typeof document === 'undefined') return;
  const cookie = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith('resident-web-callback-notice='));
  if (!cookie) return;
  try {
    const notice: unknown = JSON.parse(decodeURIComponent(cookie.slice('resident-web-callback-notice='.length)));
    if (!notice || typeof notice !== 'object' || !('kind' in notice)) return;
    const path = notice.kind === 'google-error' ? '/auth/error' : '/settings/email-verification';
    // Removing the receipt makes reload/back/effect replay quiet, even without storage.
    document.cookie = `resident-web-callback-notice=; Max-Age=0; Path=${path}; SameSite=Lax`;
    if (!('id' in notice) || typeof notice.id !== 'string' || !/^[\da-f-]{36}$/i.test(notice.id) ||
      !('createdAt' in notice) || typeof notice.createdAt !== 'number' || Date.now() - notice.createdAt < 0 || Date.now() - notice.createdAt > 120000) return;
    if (notice.kind === 'google-error') clearLoginNotification();
    if (!('userId' in notice) || (notice.userId !== null && notice.userId !== userId)) return;
    const id = eventId('auth-callback', notice.id);
    if (notice.kind === 'google-error') {
      notify.error("Google sign-in couldn't be completed. Please start again.", { id });
    } else if (notice.kind === 'email-error') notify.error("Couldn't complete email confirmation. Request a new confirmation email.", { id });
    else if (notice.kind === 'email-changed') notify.success('Email address changed.', { id });
    else if (notice.kind === 'email-pending') notify.info('One more confirmation may be needed. Check both inboxes.', { id });
    else if (notice.kind === 'email-confirmed') notify.info('Email confirmation completed. Check your account details.', { id });
  } catch { /* A missing/malformed receipt leaves the existing inline guidance intact. */ }
}

/** Called after the destination confirms its current account; callback-only pages do
 * not consume or create a login welcome. No additional auth/data request is made. */
export async function showPendingLoginNotification(userId: string | null, callbackOnly = false) {
  showCallbackNotification(userId);
  if (!userId || callbackOnly) return;
  let notice = pendingLogin;
  try {
    const stored = sessionStorage.getItem(LOGIN_NOTICE_KEY);
    if (stored) notice = JSON.parse(stored) as LoginNotice;
  } catch { /* Use the in-memory receipt when storage is unavailable. */ }
  if (!notice) return;
  // Consume before fetching, including under React's effect replay.
  clearLoginNotification();
  if (typeof notice.createdAt !== 'number' || Date.now() - notice.createdAt > LOGIN_NOTICE_TTL_MS ||
      (notice.userId !== null && notice.userId !== userId)) return;

  const attempt = beginAttempt('login-welcome');
  let name = '';
  try {
    const { data } = await createSupabaseBrowserClient()
      .from('profiles').select('first_name, last_name').eq('id', userId).maybeSingle();
    name = [data?.first_name?.trim(), data?.last_name?.trim()].filter(Boolean).join(' ');
  } catch { /* A greeting must not turn a successful login into a failure. */ }
  // The adapter suppresses this outcome if the account changed during the read.
  notify.success(name ? `Welcome back ${name}` : 'Welcome back', { id: attempt });
}

/** A null message captures a guest attempt for a recovery navigation still in flight. */
export function notifyLoggedOut(message: string | null = 'Logged out') {
  clearLoginNotification();
  // Issue the outcome under the guest session so the layout cannot clear its ID.
  setNotificationSession(null);
  const attempt = beginAttempt('logout-result');
  if (message !== null) notify.success(message, { id: attempt, keepOnSessionChange: true });
  return attempt;
}
