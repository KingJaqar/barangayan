import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { getAuthCookieOptions } from '@/lib/supabase/cookie-options';

/**
 * - `signed-out`: Auth confirmed the sign-out.
 * - `local-only`: Auth returned an error after supabase-js had already cleared this
 *   browser's session (it does that before reporting a failed revoke), so the browser
 *   is signed out but the server-side revoke wasn't confirmed.
 * - `failed`: the session is still stored in this browser.
 */
export type SignOutOutcome = 'signed-out' | 'local-only' | 'failed';

let intentionalSignOuts = 0;

/** True while this tab is running a sign-out it started itself, so the session
 * watcher (NotificationSession) doesn't report it as an unexpected session end. */
export function isIntentionalSignOut(): boolean {
  return intentionalSignOuts > 0;
}

/**
 * Ordinary logout revokes only this application's session. Explicit account-security
 * operations can request global revocation. Reports the outcome without retrying.
 */
export async function signOutBrowser(scope: 'global' | 'local' = 'local'): Promise<SignOutOutcome> {
  const supabase = createSupabaseBrowserClient();
  intentionalSignOuts++;
  try {
    try {
      const { error } = await supabase.auth.signOut({ scope });
      if (!error) return 'signed-out';
    } catch {
      // Fall through and check what the failed call left behind.
    }
    // supabase-js deletes its stored session (the `sb-…-auth-token` cookie, possibly
    // chunked) before reporting a failed revoke, and keeps it when the failure came
    // from refreshing an expired token. Read that storage directly: getSession() would
    // retry the same refresh with backoff for up to ~25 s.
    const sessionCookieName = getAuthCookieOptions().name;
    const hasSession = document.cookie.split(';').some(cookie => {
      const name = cookie.trim().split('=')[0];
      return name === sessionCookieName || (
        name.startsWith(`${sessionCookieName}.`) && /^\d+$/.test(name.slice(sessionCookieName.length + 1))
      );
    });
    return hasSession ? 'failed' : 'local-only';
  } finally {
    intentionalSignOuts--;
  }
}
