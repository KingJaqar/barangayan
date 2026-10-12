'use client';

import { RouteError } from '@/components/shared/route-error';

/**
 * Root error boundary. It catches unexpected failures in the (resident) and (auth)
 * layouts themselves (for example the session read), which their own segment boundaries
 * don't wrap. Like app/loading.tsx it shows no shell or account details, and it links
 * to the guest-safe home page.
 */
export default function RootError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="flex h-full flex-1 items-center justify-center overflow-y-auto bg-background p-6">
      <RouteError error={error} retry={retry} returnHref="/home" returnLabel="Go to Home" />
    </div>
  );
}
