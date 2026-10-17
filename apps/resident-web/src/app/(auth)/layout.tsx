import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { NotificationSession } from '@/components/shared/notification-session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// Routes under this layout that intentionally render WITH a session already present —
// every other route here redirects an authenticated visitor straight to /home.
// verify-otp validates Settings recovery itself and redirects other authenticated visits.
const ALLOWED_WHILE_AUTHENTICATED = new Set(['/reset-password', '/verify-otp', '/complete-profile']);

/**
 * Unauthenticated shell for login/register/verify-otp/forgot-password/reset-password —
 * redirects away if a session already exists, so a logged-in resident can't land back
 * on an auth screen via a stale bookmark or browser-back.
 *
 * Authenticated exemptions:
 * - /verify-otp: the page checks the Settings recovery account/session itself;
 *   other authenticated visits still redirect to /home.
 * - /reset-password: verify-otp's verifyOtp({type:'recovery'}) establishes a real
 *   session before the resident ever reaches that page, and a session cookie alone
 *   can't distinguish a recovery session from a normal one server-side (that
 *   distinction is a client-SDK-only PASSWORD_RECOVERY event, not a persisted session
 *   property) — so this route needs its own carve-out rather than a check this layout
 *   could get right generically.
 * - /complete-profile: authenticated residents finish missing required fields here.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get('x-pathname') ?? '';
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && !ALLOWED_WHILE_AUTHENTICATED.has(pathname)) {
    redirect('/home');
  }

  return (
    <div className="h-full overflow-y-auto bg-background">
      <NotificationSession userId={user?.id ?? null} />
      {children}
    </div>
  );
}
