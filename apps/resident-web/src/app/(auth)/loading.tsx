import { LoadingStatus } from '@/components/shared/loading-status';
import { Skeleton } from '@/components/ui/loading';

/**
 * Auth group fallback, below the auth layout (its signed-in redirect has already run).
 * A centered max-w-sm form card matches the shared geometry of the auth pages without
 * guessing which form is coming.
 */
export default function AuthLoading() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <div aria-hidden className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-8">
          <Skeleton className="mx-auto size-20 rounded-full" />
          <Skeleton className="mx-auto h-7 w-40 rounded-lg" />
          {[0, 1].map((i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-11 rounded-lg" />
            </div>
          ))}
          <Skeleton className="h-11 rounded-full" />
        </div>
        <LoadingStatus active label="Loading…" className="text-center" />
      </div>
    </div>
  );
}
