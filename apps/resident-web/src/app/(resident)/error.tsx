'use client';

import { RouteError } from '@/components/shared/route-error';

/**
 * Resident segment error boundary. It sits inside the resident shell, so the header and
 * navigation stay usable while the failed page shows an inline recovery view. Retry
 * refreshes the route; it never repeats a write (see RouteError).
 */
export default function ResidentError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <RouteError error={error} retry={retry} returnHref="/home" returnLabel="Go to Home" />;
}
