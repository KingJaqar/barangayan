'use client';

import { RouteError } from '@/components/shared/route-error';

/**
 * Auth segment error boundary, inside the auth layout (whose signed-in redirect still
 * runs first). It only covers unexpected render failures. Expected auth outcomes keep
 * their existing handling: inline form errors, the /login?authError notice, and the
 * /auth/error page for failed OAuth callbacks.
 */
export default function AuthError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-6">
      <RouteError error={error} retry={retry} returnHref="/login" returnLabel="Go to Log In" />
    </div>
  );
}
